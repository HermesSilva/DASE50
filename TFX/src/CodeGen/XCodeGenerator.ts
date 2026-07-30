/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                  GERADOR DE CÓDIGO                                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Lê um perfil em `.DASE/Templates/<perfil>/profile.json`, renderiza cada artefato e devolve   ║
 * ║  os arquivos a gravar.                                                                        ║
 * ║                                                                                               ║
 * ║  Escopos de artefato:                                                                         ║
 * ║    Model  — um arquivo por modelo (DbContext, base configuration, factory)                    ║
 * ║    Table  — um arquivo por tabela que passar no filtro (entidade, configuration)              ║
 * ║                                                                                               ║
 * ║  O perfil NÃO contém nada específico da solução: namespace, raiz de saída e seleção do        ║
 * ║  perfil vivem no `.dsorm`. É o que torna `.DASE/Templates/` copiável entre repositórios.      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import { XTemplateEngine, type XCompiledTemplate } from "./XTemplateEngine.js";
import { ParseExpression, AvaliarExpressao, EhVerdadeiro } from "./XTemplateExpression.js";
import { XDefaultFilters } from "./XTemplateFilters.js";
import type { XICodeModel, XICodeTable } from "./XCodeModel.js";

export type XCodeScope = "Model" | "Table";

export interface XIArtifactSpec
{
    Id: string;
    Scope: XCodeScope;
    /** Expressão booleana sobre a tabela: `Stereotype == "Entity"`. Vazio = todas. */
    Where?: string;
    Template: string;
    /** Caminho de saída, ele próprio um template. */
    Output: string;
}

export interface XIProfileSpec
{
    Id: string;
    Language?: string;
    Framework?: string;

    /**
     * Sufixos de projeto que os templates deste perfil endereçam — `["Infra", "Common"]`.
     *
     * Quem gera procura, junto ao modelo, o projeto cujo nome termina em cada sufixo e
     * publica o nome REAL em `Model.Projects.<sufixo>`. O template usa esse valor em vez
     * de concatenar `Namespace + ".Infra"`, que quebra assim que a solução foge da
     * convenção. Cada perfil declara o que precisa: um perfil Prisma não teria nenhum.
     */
    ProjectSuffixes?: string[];

    Artifacts: XIArtifactSpec[];
}

export interface XIGeneratedFile
{
    /** Caminho relativo à raiz de saída. */
    Path: string;
    Content: string;
    ArtifactId: string;
}

export class XCodeGenerationError extends Error
{
    constructor(pMessage: string)
    {
        super(pMessage);
        this.name = "XCodeGenerationError";
    }
}

export class XCodeGenerator
{
    private readonly _Engine = new XTemplateEngine();
    private readonly _Filtros = new Map(Object.entries(XDefaultFilters));

    /**
     * @param pProfile   Conteúdo de `profile.json`.
     * @param pTemplates Templates do perfil, por nome de arquivo (`Entity.tpl`).
     */
    constructor(
        private readonly _Profile: XIProfileSpec,
        pTemplates: Map<string, string>
    )
    {
        for (const [nome, texto] of pTemplates)
            this._Compilados.set(nome, this._Engine.Compile(texto, nome));
    }

    private readonly _Compilados = new Map<string, XCompiledTemplate>();

    /** Avalia o `Where` de um artefato contra uma tabela. */
    private Aceita(pArtefato: XIArtifactSpec, pTabela: XICodeTable): boolean
    {
        if (!pArtefato.Where || pArtefato.Where.trim().length === 0)
            return true;

        const no = ParseExpression(pArtefato.Where);
        return EhVerdadeiro(AvaliarExpressao(no, pTabela as unknown as Record<string, unknown>, this._Filtros));
    }

    /** Renderiza o caminho de saída, que também é um template. */
    private Caminho(pMolde: string, pEscopo: Record<string, unknown>): string
    {
        const bruto = this._Engine.Render(pMolde, pEscopo, { Partials: this._Compilados });

        // Normaliza separadores e remove segmentos vazios, para que um molde com
        // variável vazia não produza `a//b`.
        return bruto.replace(/\\/g, "/").split("/").filter(s => s.length > 0).join("/");
    }

    Generate(pModel: XICodeModel): XIGeneratedFile[]
    {
        const arquivos: XIGeneratedFile[] = [];
        const vistos = new Map<string, string>();

        for (const artefato of this._Profile.Artifacts)
        {
            const template = this._Compilados.get(artefato.Template);
            if (!template)
                throw new XCodeGenerationError(
                    `artefato '${artefato.Id}' referencia template inexistente: '${artefato.Template}'`);

            const alvos: Array<Record<string, unknown>> = artefato.Scope === "Model"
                ? [{ Model: pModel }]
                : pModel.Tables
                    .filter(t => this.Aceita(artefato, t))
                    .map(t => ({ Model: pModel, Table: t }));

            for (const escopo of alvos)
            {
                const caminho = this.Caminho(artefato.Output, escopo);
                const conteudo = this._Engine.RenderCompiled(template, escopo, { Partials: this._Compilados });

                // Dois alvos gravando no mesmo caminho seria perda silenciosa de arquivo.
                // A comparação inclui o MESMO artefato repetindo o caminho: duas tabelas de
                // nome igual, ou um Output que não usa nada que as distinga.
                const anterior = vistos.get(caminho);
                if (anterior !== undefined)
                    throw new XCodeGenerationError(
                        anterior === artefato.Id
                            ? `o artefato '${artefato.Id}' gera duas vezes o mesmo arquivo: ${caminho}`
                            : `artefatos '${anterior}' e '${artefato.Id}' geram o mesmo arquivo: ${caminho}`);
                vistos.set(caminho, artefato.Id);

                arquivos.push({ Path: caminho, Content: conteudo, ArtifactId: artefato.Id });
            }
        }

        // Ordem estável por caminho: a lista alimenta escrita e relatório, e não pode
        // variar entre execuções.
        arquivos.sort((a, b) => a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0);
        return arquivos;
    }
}
