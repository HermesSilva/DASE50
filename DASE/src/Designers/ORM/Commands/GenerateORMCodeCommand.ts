import * as vscode from "vscode";
import * as path from "path";
import {
    XTypeResolver, BuildCodeModel, XCodeGenerator,
    type XIProfileSpec, type XIGeneratedFile, type XORMDataTypeInfo, type XIExternalTable
} from "@tootega/tfx";
import type { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import type { XORMDesignerState } from "../ORMDesignerState";
import { XAgentBridge } from "../../../AgentIntegration/AgentBridge";
import { XTFXBridge } from "../../../Services/TFXBridge";
import { GetLogService } from "../../../Services/LogService";

/**
 * Geração de código ORM a partir de templates.
 *
 * O caminho é DETERMINÍSTICO: mesmo modelo e mesmos templates produzem byte a byte o mesmo
 * código. É o que permite versionar o resultado — a geração por IA que existia aqui antes
 * devolvia texto diferente a cada execução, num arquivo só, ignorando a convenção do projeto.
 *
 * Tudo que é específico da solução (namespace, raiz de saída, perfil) vem do próprio `.dsorm`;
 * os templates em `.DASE/Templates/<perfil>/` são copiáveis entre repositórios sem edição.
 */
export class XGenerateORMCodeCommand {

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void {
        pContext.subscriptions.push(
            // Devolve o resultado de Execute: um resumo (string) no sucesso ou { ok:false, error }
            // na falha. Quem dispara pela paleta ignora o retorno e só vê o toast; quem dispara
            // pelo agent bridge (MCP) recebe o resultado e, assim, ENXERGA a falha — antes ela
            // morria num toast que só a UI do VS Code via, e o MCP reportava sucesso falso.
            vscode.commands.registerCommand("Dase.GenerateORMCode", async () => {
                return await XGenerateORMCodeCommand.Execute(pProvider);
            })
        );
    }

    // ── resolução do .DASE ────────────────────────────────────────────────────

    /**
     * Sobe da pasta do modelo até a raiz procurando `.DASE/<relativo>`.
     * Mesma hierarquia que o XConfigurationManager usa para os arquivos de configuração.
     */
    static async FindInDase(pStartDir: string, pRelative: string): Promise<string | null> {
        let dir = pStartDir;

        for (;;) {
            const candidate = path.join(dir, ".DASE", pRelative);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
                return candidate;
            }
            catch { /* não existe neste nível */ }

            const parent = path.dirname(dir);
            if (parent === dir)
                return null;
            dir = parent;
        }
    }

    /** Perfis disponíveis: subpastas de `.DASE/Templates` que tenham `profile.json`. */
    private static async ListProfiles(pTemplatesDir: string): Promise<string[]> {
        const found: string[] = [];

        let entries: [string, vscode.FileType][];
        try { entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(pTemplatesDir)); }
        catch { return found; }

        for (const [name, type] of entries) {
            if (type !== vscode.FileType.Directory)
                continue;
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(path.join(pTemplatesDir, name, "profile.json")));
                found.push(name);
            }
            catch { /* pasta sem profile.json não é perfil */ }
        }

        return found.sort((a, b) => a.localeCompare(b));
    }

    private static async ReadText(pPath: string): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(pPath));
        return Buffer.from(bytes).toString("utf-8");
    }

    /**
     * Descobre o namespace raiz a partir da estrutura, para não obrigar a redigitar o que a
     * pasta já diz. O `Namespace` declarado no modelo continua vencendo — isto é o default.
     *
     * Ordem: prefixo comum dos projetos vizinhos (`Tootega.SYS.API`, `Tootega.SYS.Infra`, …
     * ⇒ `Tootega.SYS`), depois o nome da pasta que contém o `.dsorm`.
     */
    static async DeriveNamespace(pModelDir: string): Promise<string> {
        const projetos = await XGenerateORMCodeCommand.ListProjects(pModelDir);
        const pasta = path.basename(pModelDir);

        // Sinal mais forte: a pasta se chama como os projetos que ela contém
        // (`Tootega.ID/` com `Tootega.ID.Infra`). É a convenção de módulo do repositório.
        if (projetos.some(p => p === pasta || p.startsWith(pasta + ".")))
            return pasta;

        if (projetos.length === 1)
            return projetos[0];

        if (projetos.length > 1) {
            // Prefixo por SEGMENTOS, escolhendo o mais longo que cubra a maioria dos projetos.
            //
            // Prefixo comum de TODOS não serve: basta um projeto fora do padrão — um
            // `TID.Launcher` ao lado de sete `Tootega.ID.*` — para o comum virar "T" e o
            // código inteiro ir parar numa pasta `T.Infra`.
            const votos = new Map<string, number>();

            for (const nome of projetos) {
                const partes = nome.split(".");
                for (let i = 1; i <= partes.length; i++) {
                    const candidato = partes.slice(0, i).join(".");
                    votos.set(candidato, (votos.get(candidato) ?? 0) + 1);
                }
            }

            const minimo = Math.ceil(projetos.length / 2);
            let melhor = "";

            for (const [candidato, quantos] of votos) {
                if (quantos < minimo) continue;
                if (candidato.length > melhor.length) melhor = candidato;
            }

            if (melhor.length > 0) return melhor;
        }

        return pasta;
    }

    /** Nomes de projeto encontrados na pasta do modelo e nas filhas diretas. */
    static async ListProjects(pModelDir: string): Promise<string[]> {
        const projetos: string[] = [];

        const coletar = async (pDir: string) => {
            let entries: [string, vscode.FileType][];
            try { entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(pDir)); }
            catch { return; }

            for (const [name, type] of entries)
                if (type === vscode.FileType.File && /\.(csproj|vbproj|fsproj)$/i.test(name))
                    projetos.push(name.replace(/\.(csproj|vbproj|fsproj)$/i, ""));
        };

        await coletar(pModelDir);
        try {
            for (const [name, type] of await vscode.workspace.fs.readDirectory(vscode.Uri.file(pModelDir)))
                if (type === vscode.FileType.Directory)
                    await coletar(path.join(pModelDir, name));
        }
        catch { /* pasta ilegível */ }

        return projetos;
    }

    /**
     * Casa cada sufixo declarado pelo perfil com o projeto real correspondente:
     * `"Infra"` ⇒ `"Tootega.ID.Infra"`.
     *
     * Havendo mais de um candidato, vence o de nome mais curto — `Tootega.ID.Test` antes de
     * `Tootega.ID.Test.Integration`, que é o projeto de teste específico, não a raiz.
     */
    static MatchProjects(pProjects: string[], pSuffixes: string[]): Record<string, string> {
        const mapa: Record<string, string> = {};

        for (const sufixo of pSuffixes) {
            const candidatos = pProjects
                .filter(p => p === sufixo || p.endsWith("." + sufixo))
                .sort((a, b) => a.length - b.length || a.localeCompare(b));

            if (candidatos.length > 0) mapa[sufixo] = candidatos[0];
        }

        return mapa;
    }

    /**
     * Namespace de cada módulo dono citado por tabela espelho, lido do `.dsorm` do dono.
     * É de lá que sai o `using` da entidade espelho — o espelho herda o tipo do dono.
     */
    private static async ResolveOwnerNamespaces(
        pDoc: any,
        pModelDir: string
    ): Promise<Record<string, string>> {
        const owners: Record<string, string> = {};

        for (const table of pDoc.Design?.GetTables?.() ?? []) {
            if (!table.IsShadow)
                continue;

            const prefix = (table.Name.match(/^([A-Z]{2,4})x/) ?? [])[1];
            if (!prefix || owners[prefix])
                continue;

            // Convenção do repositório: cada módulo guarda o próprio MER ao lado do código.
            const ownerDir = `Tootega.${prefix}`;
            const ownerMer = path.join(path.dirname(pModelDir), ownerDir, `MER-${prefix}.dsorm`);
            let resolved = table.ShadowModuleName || "";

            try {
                const text = await XGenerateORMCodeCommand.ReadText(ownerMer);
                const match = text.match(/Name="Namespace"[^>]*>([^<]+)</);
                if (match) resolved = match[1];

                // O MER do dono existe mas não declara Namespace — modelo importado, por exemplo.
                // A pasta dele responde: é dado do disco, não palpite, e o espelho precisa herdar
                // de ALGUM tipo. Sem isso o template escreveria `.Infra.Persistencia.Entidades.X`.
                else if (!resolved) resolved = ownerDir;
            }
            catch { /* sem o MER do dono, fica o que o espelho registrou */ }

            if (resolved) owners[prefix] = resolved;
        }

        return owners;
    }

    // ── execução ──────────────────────────────────────────────────────────────

    /**
     * Gera o código e devolve o desfecho ao chamador. O retorno existe para o agent bridge (MCP):
     * uma STRING é o resumo do sucesso (ou de um estado sem-o-que-fazer), e `{ ok:false, error }`
     * é uma falha — que o servidor do bridge traduz em `ok:false` para o agente. A UI continua
     * recebendo o mesmo toast; ela apenas ignora o retorno. Falhas NÃO são relançadas: relançar
     * dispararia, além do nosso toast, o aviso genérico do VS Code na invocação pela paleta.
     */
    private static async Execute(
        pProvider: XORMDesignerEditorProvider
    ): Promise<string | { ok: false; error: string }> {
        const log = GetLogService();

        const fail = (pMsg: string): { ok: false; error: string } => ({ ok: false, error: pMsg });

        // Qual documento gerar. O agent bridge (MCP) fixa um ALVO — que pode NEM estar aberto num
        // designer, porque gerar não exige o designer. Sem alvo (paleta), vale o editor ativo.
        const targetUri = XAgentBridge.GetInstance().GetTargetUri();
        let docUri: vscode.Uri | null = null;
        let openState: XORMDesignerState | null = null;

        if (targetUri) {
            docUri = vscode.Uri.parse(targetUri);
            openState = pProvider.GetStateByUri(targetUri);
        }
        else {
            const active = pProvider.GetActiveStateWithUri();
            if (active) {
                docUri = active.Uri;
                openState = active.State;
            }
        }

        if (!docUri) {
            const msg = "No ORM model to generate. Open a .dsorm designer, or pass 'document' to target a model on disk.";
            vscode.window.showWarningMessage(msg);
            return fail(msg);
        }

        if (docUri.scheme === "untitled") {
            const msg = "Save the model to a file before generating code.";
            vscode.window.showWarningMessage(msg);
            return fail(msg);
        }

        // O modelo NÃO precisa do designer aberto. Se ele está aberto, usa-se o documento em
        // memória (respeita edições ainda não salvas); senão, carrega-se do DISCO por um bridge
        // headless — o mesmo caminho de desserialização e de resolução de herança, sem webview.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- o getter Document é `any`, como no fluxo original.
        let ormDoc: any;
        let external: XIExternalTable[];
        try {
            if (openState?.Bridge?.Document) {
                ormDoc = openState.Bridge.Document;
                await openState.Bridge.LoadInheritanceSources?.();
                external = openState.Bridge.GetExternalInheritanceTables?.() ?? [];
            }
            else {
                const headless = new XTFXBridge();
                headless.Initialize();
                headless.SetContextPath(docUri.fsPath);
                const text = Buffer.from(await vscode.workspace.fs.readFile(docUri)).toString("utf-8");
                headless.LoadOrmModelFromText(text);
                ormDoc = headless.Document;
                await headless.LoadInheritanceSources();
                external = headless.GetExternalInheritanceTables();
            }
        }
        catch (err: any) {
            const message = err?.message ?? String(err);
            log.Error("GenerateORMCode: failed to load model", err);
            const msg = `The model could not be read: ${message}`;
            vscode.window.showErrorMessage(msg);
            return fail(msg);
        }

        const design = ormDoc?.Design;
        if (!design) {
            const msg = "The model could not be read.";
            vscode.window.showWarningMessage(msg);
            return fail(msg);
        }

        if (design.GenerateCode === false) {
            const msg = "This model has Generate Code turned off. Enable it in the model properties to generate.";
            vscode.window.showInformationMessage(msg);
            return msg;
        }

        const modelDir = path.dirname(docUri.fsPath);

        try {
            // ── perfil ────────────────────────────────────────────────────────
            const templatesDir = await XGenerateORMCodeCommand.FindInDase(modelDir, "Templates");
            if (!templatesDir) {
                const msg = "No .DASE/Templates folder found above this model. Add a template profile to generate code.";
                vscode.window.showErrorMessage(msg);
                return fail(msg);
            }

            const profiles = await XGenerateORMCodeCommand.ListProfiles(templatesDir);
            if (profiles.length === 0) {
                const msg = `No template profile found in ${templatesDir} (a profile needs a profile.json).`;
                vscode.window.showErrorMessage(msg);
                return fail(msg);
            }

            const declared = (design.CodeTemplate ?? "").trim();
            let chosen = declared || profiles[0];

            if (declared && !profiles.includes(declared)) {
                const msg = `Template profile "${declared}" not found. Available: ${profiles.join(", ")}`;
                vscode.window.showErrorMessage(msg);
                return fail(msg);
            }

            // Vários perfis e nenhum declarado: quem escolhe é o usuário, não a ordem alfabética.
            // Mas headless (disparo via agent bridge, com alvo fixado) não há usuário para o
            // seletor — abri-lo penduraria a chamada. Nesse caso, erra pedindo CodeTemplate no
            // modelo, em vez de escolher um perfil no escuro.
            if (!declared && profiles.length > 1) {
                if (targetUri) {
                    const msg = `Model has no CodeTemplate set and ${profiles.length} profiles exist (${profiles.join(", ")}). `
                        + "Set the model's CodeTemplate property to generate headlessly.";
                    vscode.window.showErrorMessage(msg);
                    return fail(msg);
                }
                const picked = await vscode.window.showQuickPick(profiles, {
                    title: "Generate ORM Code",
                    placeHolder: "Select the template profile to use"
                });
                if (!picked) return "Generation cancelled: no template profile selected.";
                chosen = picked;
            }

            const profileDir = path.join(templatesDir, chosen);
            const profile = JSON.parse(
                await XGenerateORMCodeCommand.ReadText(path.join(profileDir, "profile.json"))
            ) as XIProfileSpec;

            const templates = new Map<string, string>();
            for (const [name, type] of await vscode.workspace.fs.readDirectory(vscode.Uri.file(profileDir)))
                if (type === vscode.FileType.File && name.endsWith(".tpl"))
                    templates.set(name, await XGenerateORMCodeCommand.ReadText(path.join(profileDir, name)));

            if (templates.size === 0) {
                const msg = `Profile "${chosen}" has no .tpl templates.`;
                vscode.window.showErrorMessage(msg);
                return fail(msg);
            }

            // ── tipos ─────────────────────────────────────────────────────────
            const typesPath = await XGenerateORMCodeCommand.FindInDase(modelDir, "ORM.Types.json");
            if (!typesPath) {
                const msg = "No .DASE/ORM.Types.json found above this model.";
                vscode.window.showErrorMessage(msg);
                return fail(msg);
            }

            const types = JSON.parse(await XGenerateORMCodeCommand.ReadText(typesPath)).Types as XORMDataTypeInfo[];
            const resolver = new XTypeResolver(types, profile.Id);

            // Tipo sem mapeamento produziria código silenciosamente errado — melhor parar aqui.
            const unmapped = resolver.GetUnmappedTypes();
            if (unmapped.length > 0) {
                const msg = `ORM.Types.json has no Mappings["${profile.Id}"] for: ${unmapped.join(", ")}`;
                vscode.window.showErrorMessage(msg);
                return fail(msg);
            }

            // ── geração ───────────────────────────────────────────────────────
            const owners = await XGenerateORMCodeCommand.ResolveOwnerNamespaces(ormDoc, modelDir);

            // Declarado no modelo vence; sem ele, a estrutura de pastas e projetos responde.
            const declaredNs = (design.Namespace ?? "").trim();
            const namespace = declaredNs || await XGenerateORMCodeCommand.DeriveNamespace(modelDir);

            // Projetos REAIS para os sufixos que o perfil declara. É daqui que o template tira
            // o caminho de saída e o namespace de cada arquivo — nada de concatenar à mão.
            const suffixes = profile.ProjectSuffixes ?? [];
            const projects = XGenerateORMCodeCommand.MatchProjects(
                await XGenerateORMCodeCommand.ListProjects(modelDir),
                suffixes
            );

            const naoAchados = suffixes.filter(s => !projects[s]);
            if (naoAchados.length > 0)
                log.Info(`GenerateORMCode: sem projeto para ${naoAchados.join(", ")} — usando "${namespace}.<sufixo>"`);

            // `external` (bases de herança da árvore inteira de modelos) já foi resolvido acima,
            // junto com o carregamento do modelo — do bridge aberto ou do headless, do disco.
            const model = BuildCodeModel(ormDoc, {
                Resolver: resolver,
                OwnerNamespaces: owners,
                Namespace: namespace,
                Projects: projects,
                ProjectSuffixes: suffixes,
                ExternalTables: external
            });

            if (!declaredNs)
                log.Info(`GenerateORMCode: namespace derivado da estrutura: "${namespace}"`);

            if (model.Tables.length === 0) {
                const msg = "The model has no tables to generate.";
                vscode.window.showInformationMessage(msg);
                return msg;
            }

            const files = new XCodeGenerator(profile, templates).Generate(model);
            const outputRoot = path.resolve(modelDir, model.OutputRoot || ".");

            const written = await XGenerateORMCodeCommand.WriteFiles(files, outputRoot);

            const summary =
                `${written.Created} created, ${written.Updated} updated, ${written.Unchanged} unchanged` +
                ` — ${model.Entities.length} entities, ${model.Lookups.length} lookups, ${model.Mirrors.length} mirrors.`;

            log.Info(`GenerateORMCode: ${files.length} files with profile "${chosen}" — ${summary}`);

            const result = `ORM code generated — ${chosen} / ${model.Namespace}${declaredNs ? "" : " (derived)"}: ${summary}`;

            // NÃO aguarda o toast: um aviso com botão só resolve quando o usuário interage, e uma
            // invocação headless (via agent bridge / MCP) ficaria pendurada aqui PARA SEMPRE — os
            // arquivos já foram gravados, mas a chamada nunca retornaria. Dispara e trata a ação à
            // parte; a resposta ao chamador é o `result` devolvido logo abaixo.
            void Promise.resolve(vscode.window.showInformationMessage(result, "Show Folder")).then(action => {
                if (action === "Show Folder")
                    void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outputRoot));
            });

            return result;
        }
        catch (err: any) {
            const message = err?.message ?? String(err);
            log.Error("GenerateORMCode failed", err);
            vscode.window.showErrorMessage(`ORM code generation failed: ${message}`);
            return fail(`ORM code generation failed: ${message}`);
        }
    }

    /**
     * Grava os arquivos, pulando os que já estão idênticos — assim regenerar não
     * marca meia centena de arquivos como modificados no controle de versão.
     */
    static async WriteFiles(
        pFiles: XIGeneratedFile[],
        pOutputRoot: string
    ): Promise<{ Created: number; Updated: number; Unchanged: number }> {
        let created = 0, updated = 0, unchanged = 0;

        for (const file of pFiles) {
            const target = vscode.Uri.file(path.join(pOutputRoot, file.Path));

            let previous: string | null = null;
            try { previous = Buffer.from(await vscode.workspace.fs.readFile(target)).toString("utf-8"); }
            catch { previous = null; }

            if (previous === file.Content) { unchanged++; continue; }

            await vscode.workspace.fs.writeFile(target, Buffer.from(file.Content, "utf-8"));
            if (previous === null) created++; else updated++;
        }

        return { Created: created, Updated: updated, Unchanged: unchanged };
    }
}
