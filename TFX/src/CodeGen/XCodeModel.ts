/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                     PROJEÇÃO DO MODELO PARA OS TEMPLATES                                      ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Transforma o XORMDocument em objetos simples — este é o CONTRATO que os templates veem.      ║
 * ║  Quem escreve template lê esta interface, não as classes do designer.                         ║
 * ║                                                                                               ║
 * ║  Aqui é onde as decisões semânticas são tomadas UMA vez, e não repetidas em cada template:    ║
 * ║    · estereótipo da tabela (Entity / Lookup / Mirror);                                        ║
 * ║    · tipo na linguagem e expressão da coluna, via ORM.Types.json;                             ║
 * ║    · quais chaves nunca são geradas pelo banco (ValueGeneratedNever);                         ║
 * ║    · quais tabelas têm posse por inquilino.                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import type { XORMDocument } from "../Designers/ORM/XORMDocument.js";
import type { XORMTable } from "../Designers/ORM/XORMTable.js";
import type { XORMField } from "../Designers/ORM/XORMField.js";
import { XORMDataSet } from "../Designers/ORM/XORMDataSet.js";
import { XORMIndex } from "../Designers/ORM/XORMIndex.js";
import { XORMReference } from "../Designers/ORM/XORMReference.js";
import { XTypeResolver } from "./XTypeResolver.js";

/** Papel da tabela na geração. Decide qual conjunto de artefatos ela produz. */
export type XCodeStereotype = "Entity" | "Lookup" | "Mirror";

export interface XICodeField
{
    Name: string;
    Description: string;
    DataType: string;
    Length: number;
    Scale: number;
    IsRequired: boolean;
    IsPrimaryKey: boolean;
    IsForeignKey: boolean;
    IsAutoIncrement: boolean;
    /** Valor default. Iniciado por `=` significa expressão de código, não literal. */
    DefaultValue: string;

    /** Tipo na linguagem, já na forma anulável quando o campo é anulável. */
    Type: string;
    /** Tipo na linguagem, sempre não anulável. */
    BaseType: string;
    /** Expressão da coluna: `VarChar(160)`, `Decimal(19,4)`, `UniqueIdentifier()`. */
    ColumnType: string;
    /** Inicializador do campo (`""` para string não anulável), ou vazio. */
    Init: string;

    /** Quando o campo é FK: nome da tabela apontada. */
    TargetTable: string;
    /** Quando o campo é FK: a referência é 1:1. */
    IsOneToOne: boolean;
    /** Quando o campo é FK e o alvo é lookup: nome do enum correspondente. */
    LookupEnum: string;
}

export interface XICodeIndex
{
    Name: string;
    IsUnique: boolean;
    /** Condição de índice parcial, ou vazio. */
    Filter: string;
    Fields: string[];
}

export interface XICodeSeedRow
{
    /** Identificador do membro do enum, quando a tabela é lookup. */
    Member: string;
    /** Valor por nome de coluna, já formatado como literal da linguagem. */
    Values: Record<string, string>;
    /** Valor bruto por nome de coluna, como está no modelo. */
    Raw: Record<string, string>;
}

export interface XICodeTable
{
    Name: string;
    Description: string;
    Stereotype: XCodeStereotype;

    IsShadow: boolean;
    /** Prefixo do módulo dono, quando espelho: `SYS`, `CRM`, `STQ`. */
    OwnerPrefix: string;
    /** Namespace do módulo dono, quando espelho. */
    OwnerModule: string;

    PKType: string;
    PK: XICodeField | null;
    /** Chave nunca gerada pelo banco — vira ValueGeneratedNever(). */
    PKValueGeneratedNever: boolean;

    Fields: XICodeField[];
    /** Campos exceto a PK. */
    DataFields: XICodeField[];
    /** Campos que são chave estrangeira. */
    ForeignKeys: XICodeField[];

    Indexes: XICodeIndex[];
    Seed: XICodeSeedRow[];

    /** Tabela tem coluna de posse por inquilino (multi-tenant). */
    HasTenant: boolean;
    /** Nome da coluna de posse, quando houver. */
    TenantColumn: string;

    /** Nome do enum gerado, quando lookup. */
    EnumName: string;
}

export interface XICodeModel
{
    Name: string;
    Namespace: string;
    Schema: string;
    OutputRoot: string;

    /**
     * Sigla do módulo, derivada das tabelas próprias ou do último segmento do
     * namespace: `SYS` para `Tootega.SYS` / `SYSxInquilino`.
     */
    Module: string;
    /** Prefixo das tabelas próprias: `SYSx`. Base dos nomes de classe convencionais. */
    Prefix: string;

    /**
     * Projetos REAIS encontrados junto ao modelo, indexados pelo último segmento do nome:
     * `{ Infra: "Tootega.ID.Infra", Common: "Tootega.ID.Common" }`.
     *
     * O template deve montar caminho e namespace a partir daqui, e não concatenando
     * `Namespace + ".Infra"`: o nome do projeto é o que existe no disco, e supor a
     * concatenação erra sempre que a solução foge um milímetro da convenção.
     *
     * Quando o projeto não é encontrado, a chave traz o palpite `Namespace + "." + sufixo`,
     * para o template continuar funcionando num diretório ainda vazio.
     */
    Projects: Record<string, string>;

    Tables: XICodeTable[];
    /** Só as entidades de domínio. */
    Entities: XICodeTable[];
    /** Só as tabelas-lookup. */
    Lookups: XICodeTable[];
    /** Só os espelhos de outros módulos. */
    Mirrors: XICodeTable[];
    /** Entidades com posse por inquilino. */
    Owned: XICodeTable[];

    /** Módulos donos citados pelos espelhos, para os `using` e os `Ignore<Base>()`. */
    OwnerModules: Array<{ Prefix: string; Module: string }>;

    TenantTable: string;
    StateTable: string;
}

export interface XICodeModelOptions
{
    /** Resolve tipo do modelo → tipo da linguagem e expressão de coluna. */
    Resolver: XTypeResolver;
    /** Namespace do modelo (vem do XORMDesign). */
    Namespace?: string;
    /**
     * Namespace de cada módulo dono, por prefixo — `{ SYS: "Tootega.SYS" }`.
     * Vem do `Namespace` declarado no `.dsorm` de cada dono.
     */
    OwnerNamespaces?: Record<string, string>;

    /**
     * Projetos achados no disco, por último segmento do nome:
     * `{ Infra: "Tootega.ID.Infra", Common: "Tootega.ID.Common" }`.
     *
     * Descobrir isso é papel de quem chama — o TFX não toca no sistema de arquivos.
     */
    Projects?: Record<string, string>;

    /** Sufixos declarados pelo perfil, para completar o que não foi achado. */
    ProjectSuffixes?: string[];
}

// ── heurísticas ───────────────────────────────────────────────────────────────

/**
 * Uma tabela é LOOKUP quando é a materialização de um enum: chave inteira pequena, poucas
 * colunas, todas de texto e nenhuma chave estrangeira. É como o Tootega modela suas
 * lookups (CE-1/CE-2, com Int16 como piso uniforme da chave) — algumas com `Valor` apenas,
 * outras com uma `Sigla` ao lado.
 *
 * Uma tabela com FK não é lookup: passou a se relacionar, e isso é entidade.
 */
function EhLookup(pTabela: XORMTable, pCampos: XORMField[], pTemFK: (pID: string) => boolean): boolean
{
    if (pTabela.IsShadow) return false;

    const pk = pTabela.GetPKField();
    if (!pk) return false;
    if (pk.DataType !== "Int16" && pk.DataType !== "Int8") return false;

    const demais = pCampos.filter(f => !f.IsPrimaryKey);
    if (demais.length === 0 || demais.length > 3) return false;

    return demais.every(f => (f.DataType === "String" || f.DataType === "Text") && !pTemFK(f.ID));
}

/** Prefixo de módulo em `SYSxInquilino` → `SYS`. */
function PrefixoDe(pNome: string): string
{
    return (pNome.match(/^([A-Z]{2,4})x/) ?? [])[1] ?? "";
}

/**
 * Completa o mapa de projetos: o que foi achado no disco vence, e o sufixo declarado pelo
 * perfil que não tiver projeto correspondente recebe o palpite `Namespace.Sufixo`. Assim
 * `{{ Model.Projects.Infra }}` nunca sai vazio e vira um caminho quebrado — o que acontece
 * num módulo cujos projetos ainda não existem.
 */
function MontarProjetos(
    pAchados: Record<string, string> | undefined,
    pSufixos: string[] | undefined,
    pNamespace: string
): Record<string, string>
{
    const saida: Record<string, string> = { ...(pAchados ?? {}) };

    for (const sufixo of pSufixos ?? [])
        if (!saida[sufixo])
            saida[sufixo] = pNamespace ? `${pNamespace}.${sufixo}` : sufixo;

    return saida;
}

// ── construção ────────────────────────────────────────────────────────────────

export function BuildCodeModel(pDoc: XORMDocument, pOpcoes: XICodeModelOptions): XICodeModel
{
    const design = pDoc.Design;
    if (!design)
        throw new Error("BuildCodeModel: o documento não tem design.");

    const resolver = pOpcoes.Resolver;
    const donos = pOpcoes.OwnerNamespaces ?? {};

    const todasTabelas = design.GetTables();
    const referencias = design.GetChildrenOfType(XORMReference);

    // Mapa campo → referência, para saber destino e cardinalidade de cada FK.
    const porCampoFK = new Map<string, { Alvo: XORMTable | null; UmParaUm: boolean }>();
    for (const ref of referencias)
    {
        const alvo = todasTabelas.find(t => t.ID === ref.Target) ?? null;
        porCampoFK.set(ref.Source, { Alvo: alvo, UmParaUm: (ref as unknown as { IsOneToOne?: boolean }).IsOneToOne === true });
    }

    // Estereótipo primeiro: o de uma tabela decide como as FKs que apontam para ela são tratadas.
    const estereotipos = new Map<string, XCodeStereotype>();
    const temFK = (pID: string) => porCampoFK.has(pID);
    for (const t of todasTabelas)
    {
        // ESPELHO SÓ NASCE DE TABELA SHADOW. `IsShadow` decide sozinho e nada o
        // contradiz: um espelho representa uma tabela cujo dono é outro módulo, e essa
        // origem só existe quando a tabela foi trazida como shadow. Declarar
        // `Stereotype = "Mirror"` numa tabela própria é ignorado — sem origem, o gerador
        // não teria de quem herdar a entidade nem que migração excluir.
        //
        // Para as demais, o que o modelo declara vence a dedução: lookup e catálogo
        // pequeno têm a mesma forma, e só o autor sabe qual é qual.
        const declarado = (t.Stereotype ?? "").trim();
        const papel: XCodeStereotype = t.IsShadow
            ? "Mirror"
            : declarado === "Lookup" || declarado === "Entity"
                ? declarado as XCodeStereotype
                : EhLookup(t, t.GetFields(), temFK) ? "Lookup" : "Entity";

        estereotipos.set(t.ID, papel);
    }

    // Índice código → membro de cada lookup. Uma FK para lookup no seed guarda o CÓDIGO
    // (`1`), mas o código gerado precisa do membro do enum (`SYSxEstadoInquilino.Ativo`);
    // sem este índice sairia `SYSxEstadoInquilino.1`, que nem compila.
    const membrosPorLookup = new Map<string, Map<string, string>>();
    for (const t of todasTabelas)
    {
        if (estereotipos.get(t.ID) !== "Lookup") continue;

        const pk = t.GetPKField();
        const dataset = t.GetChildrenOfType(XORMDataSet)[0];
        if (!pk || !dataset) continue;

        const porCodigo = new Map<string, string>();
        for (const tupla of dataset.GetTuples())
        {
            const valorPK = tupla.GetFieldValues().find(v => v.FieldID === pk.ID)?.Value;
            if (valorPK === undefined) continue;
            if (tupla.Name && tupla.Name !== "XORMDataTuple") porCodigo.set(valorPK, tupla.Name);
        }
        membrosPorLookup.set(t.Name, porCodigo);
    }

    const tenantTable = design.TenantControlTable ?? "";

    const tabelas: XICodeTable[] = [];

    for (const t of todasTabelas)
    {
        if (!t.GenerateCode) continue;

        const estereotipo = estereotipos.get(t.ID)!;
        const campos = t.GetFields();
        const pkBruto = t.GetPKField();

        const projetados: XICodeField[] = campos.map(f =>
        {
            const fk = porCampoFK.get(f.ID);
            const alvo = fk?.Alvo ?? null;
            const alvoEhLookup = alvo ? estereotipos.get(alvo.ID) === "Lookup" : false;

            const tipo = resolver.Resolve({
                DataType: f.DataType,
                Length: f.Length,
                Scale: f.Scale,
                IsRequired: f.IsRequired
            });

            return {
                Name: f.Name,
                Description: f.Description ?? "",
                DataType: f.DataType,
                Length: f.Length,
                Scale: f.Scale,
                IsRequired: f.IsRequired,
                IsPrimaryKey: f.IsPrimaryKey,
                IsForeignKey: alvo !== null,
                IsAutoIncrement: f.IsAutoIncrement,
                DefaultValue: f.DefaultValue ?? "",

                Type: tipo.Type,
                BaseType: tipo.BaseType,
                ColumnType: tipo.ColumnType,
                Init: tipo.Init,

                TargetTable: alvo?.Name ?? "",
                IsOneToOne: fk?.UmParaUm ?? false,
                LookupEnum: alvoEhLookup ? (alvo?.Name ?? "") : ""
            };
        });

        const pk = projetados.find(f => f.IsPrimaryKey) ?? null;

        // ValueGeneratedNever vem do campo (propriedade explícita do modelo) ou da chave ser
        // compartilhada 1:1 — a PK sendo ela própria uma FK, o valor vem da tabela apontada.
        //
        // NUNCA de `IsAutoIncrement` do PK, que a desserialização do TFX não preserva.
        // E não por ser espelho: um espelho que o módulo apenas LÊ não precisa da marca —
        // o EF só geraria valor num insert, que não acontece.
        const pkBrutoCampo = pkBruto;
        const pkNuncaGerada = pk !== null
            && ((pkBrutoCampo?.ValueGeneratedNever ?? false) || pk.IsForeignKey);

        const indices: XICodeIndex[] = t.GetChildrenOfType(XORMIndex).map(ix => ({
            Name: ix.Name,
            IsUnique: ix.IsUnique,
            Filter: ix.Filter ?? "",
            Fields: ix.GetIndexFields()
                .map(f => campos.find(c => c.ID === f.ParentID)?.Name ?? "")
                .filter(n => n.length > 0)
        }));

        // Seed: as colunas vêm por FieldID; o Name da tupla é o identificador do membro
        // do enum, que não se deriva do texto (BRL, Trial, Z0Confiavel).
        const dataset = t.GetChildrenOfType(XORMDataSet)[0] ?? null;
        const seed: XICodeSeedRow[] = (dataset?.GetTuples() ?? []).map(tupla =>
        {
            const valores: Record<string, string> = {};
            const brutos: Record<string, string> = {};

            for (const fv of tupla.GetFieldValues())
            {
                const campo = campos.find(c => c.ID === fv.FieldID);
                if (!campo) continue;
                brutos[campo.Name] = fv.Value;

                // FK para lookup: o seed guarda o código, o código gerado quer o membro.
                const projetado = projetados.find(p => p.Name === campo.Name);
                const membro = projetado?.LookupEnum
                    ? membrosPorLookup.get(projetado.LookupEnum)?.get(fv.Value)
                    : undefined;

                valores[campo.Name] = membro
                    ? `${projetado!.LookupEnum}.${membro}`
                    : resolver.FormatLiteral(campo.DataType, fv.Value);
            }

            const nome = tupla.Name;
            return {
                Member: nome && nome !== "XORMDataTuple" ? nome : "",
                Values: valores,
                Raw: brutos
            };
        });

        const temTenant = tenantTable.length > 0
            && estereotipo === "Entity"
            && projetados.some(f => f.Name === `${tenantTable}ID`);

        tabelas.push({
            Name: t.Name,
            Description: t.Description ?? "",
            Stereotype: estereotipo,

            IsShadow: t.IsShadow,
            OwnerPrefix: t.IsShadow ? PrefixoDe(t.Name) : "",
            OwnerModule: t.IsShadow ? (donos[PrefixoDe(t.Name)] ?? t.ShadowModuleName ?? "") : "",

            PKType: pkBruto?.DataType ?? t.PKType,
            PK: pk,
            PKValueGeneratedNever: pkNuncaGerada,

            Fields: projetados,
            DataFields: projetados.filter(f => !f.IsPrimaryKey),
            ForeignKeys: projetados.filter(f => f.IsForeignKey),

            Indexes: indices,
            Seed: seed,

            HasTenant: temTenant,
            TenantColumn: temTenant ? `${tenantTable}ID` : "",

            EnumName: estereotipo === "Lookup" ? t.Name : ""
        });
    }

    // Ordem alfabética estável: a saída vai para o git e não pode depender da
    // ordem em que as tabelas foram desenhadas.
    tabelas.sort((a, b) => a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0);

    // O mesmo espelho pode aparecer VÁRIAS VEZES no diagrama — desenhar duas cópias de
    // SYSxInquilino perto de quem as referencia evita atravessar o canvas com uma linha.
    // São o mesmo espelho: uma tabela, uma entidade, um DbSet. Sem esta redução sairiam
    // arquivos duplicados e um DbContext com o membro repetido, que nem compila.
    const espelhoVisto = new Set<string>();
    const semEspelhoRepetido = tabelas.filter(t =>
    {
        if (t.Stereotype !== "Mirror")
            return true;
        if (espelhoVisto.has(t.Name))
            return false;
        espelhoVisto.add(t.Name);
        return true;
    });

    tabelas.length = 0;
    tabelas.push(...semEspelhoRepetido);

    const espelhos = tabelas.filter(t => t.Stereotype === "Mirror");
    const modulosDonos = [...new Map(
        espelhos
            .filter(t => t.OwnerPrefix)
            .map(t => [t.OwnerPrefix, { Prefix: t.OwnerPrefix, Module: t.OwnerModule }])
    ).values()].sort((a, b) => a.Prefix < b.Prefix ? -1 : 1);

    const namespaceModelo = pOpcoes.Namespace ?? design.Namespace ?? "";

    // Sigla do módulo: o prefixo que a maioria das tabelas PRÓPRIAS compartilha. Cair no
    // último segmento do namespace cobre o modelo que ainda não tem tabela nomeada.
    const contagem = new Map<string, number>();
    for (const t of tabelas)
    {
        if (t.Stereotype === "Mirror") continue;
        const p = PrefixoDe(t.Name);
        if (p) contagem.set(p, (contagem.get(p) ?? 0) + 1);
    }
    const maisComum = [...contagem.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
    const modulo = maisComum ?? namespaceModelo.split(".").pop() ?? "";

    return {
        Name: pDoc.Name,
        Namespace: namespaceModelo,
        Schema: design.Schema ?? "",
        OutputRoot: design.OutputRoot ?? ".",

        Module: modulo,
        Prefix: modulo ? `${modulo}x` : "",
        Projects: MontarProjetos(pOpcoes.Projects, pOpcoes.ProjectSuffixes, namespaceModelo),

        Tables: tabelas,
        Entities: tabelas.filter(t => t.Stereotype === "Entity"),
        Lookups: tabelas.filter(t => t.Stereotype === "Lookup"),
        Mirrors: espelhos,
        Owned: tabelas.filter(t => t.HasTenant),

        OwnerModules: modulosDonos,

        TenantTable: tenantTable,
        StateTable: design.StateControlTable ?? ""
    };
}
