// Lê o código EF Core de um módulo Tootega e devolve o modelo que ele descreve.
// Fonte: Configurations/*.cs, Entidades/**/*.cs, Lookups/*.cs e Common/Lookups/*.cs.
// Serve à Fase 0: trazer para o MER o que hoje só existe no código.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// ── utilidades ────────────────────────────────────────────────────────────────

function ArquivosCs(pDir) {
    if (!existsSync(pDir)) return [];
    const saida = [];
    for (const nome of readdirSync(pDir)) {
        const caminho = join(pDir, nome);
        if (statSync(caminho).isDirectory()) saida.push(...ArquivosCs(caminho));
        else if (nome.endsWith(".cs")) saida.push(caminho);
    }
    return saida;
}

/** Remove comentários de linha e de bloco para que regex não case dentro deles. */
function SemComentarios(pTexto) {
    return pTexto
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "")
        .replace(/\/\/.*$/gm, "");
}

// ── enums (Common/Lookups) ────────────────────────────────────────────────────

/** { NomeDoEnum: [{ Id, Cod, Desc }] } */
export function LerEnums(pCommonLookupsDir) {
    const enums = {};
    for (const arquivo of ArquivosCs(pCommonLookupsDir)) {
        const txt = readFileSync(arquivo, "utf-8");
        for (const m of txt.matchAll(/enum\s+(\w+)\s*:\s*\w+\s*\{([^}]*)\}/g)) {
            const membros = [];
            for (const mm of m[2].matchAll(/(?:\[Description\("([^"]*)"\)\]\s*)?(\w+)\s*=\s*(-?\d+)/g))
                membros.push({ Desc: mm[1] ?? "", Id: mm[2], Cod: mm[3] });
            if (membros.length) enums[m[1]] = membros;
        }
    }
    return enums;
}

// ── entidades ─────────────────────────────────────────────────────────────────

/** { NomeDaClasse: { Base, Propriedades: [{ Nome, Tipo, Nullable }], Espelho: bool, Dono } } */
export function LerEntidades(pDirs) {
    const entidades = {};
    for (const dir of pDirs) {
        for (const arquivo of ArquivosCs(dir)) {
            const bruto = readFileSync(arquivo, "utf-8");
            const txt = SemComentarios(bruto);

            // Aliases de using: `using Sys = Tootega.SYS.Infra.Persistencia.Entidades;`
            const aliases = {};
            for (const u of txt.matchAll(/using\s+(\w+)\s*=\s*([\w.]+)\s*;/g)) aliases[u[1]] = u[2];

            // Espelho no padrão VND-D6: `public sealed class X : Sys.Y;` (corpo vazio)
            for (const m of txt.matchAll(/class\s+(\w+)\s*:\s*([\w.]+)\s*;/g)) {
                const [, nome, base] = m;
                const partes = base.split(".");
                entidades[nome] = {
                    Base: base,
                    BaseAlias: partes.length > 1 ? partes[0] : "",
                    BaseNamespace: partes.length > 1 ? (aliases[partes[0]] ?? "") : "",
                    BaseClasse: partes[partes.length - 1],
                    Propriedades: [],
                    Espelho: true
                };
            }

            // Entidade normal: `class X : Base { ... }`
            for (const m of txt.matchAll(/class\s+(\w+)\s*(?::\s*([\w.<>, ]+?))?\s*\{/g)) {
                const nome = m[1];
                if (entidades[nome]) continue;

                // Recorta o corpo pelo balanceamento de chaves.
                let i = m.index + m[0].length, nivel = 1;
                while (i < txt.length && nivel > 0) {
                    if (txt[i] === "{") nivel++;
                    else if (txt[i] === "}") nivel--;
                    i++;
                }
                const corpo = txt.slice(m.index + m[0].length, i - 1);

                const props = [];
                for (const p of corpo.matchAll(/public\s+(?!static)([\w.<>\[\]]+\??)\s+(\w+)\s*\{\s*get;\s*set;\s*\}/g)) {
                    const tipoBruto = p[1];
                    props.push({
                        Nome: p[2],
                        Tipo: tipoBruto.replace(/\?$/, ""),
                        Nullable: tipoBruto.endsWith("?")
                    });
                }

                entidades[nome] = {
                    Base: (m[2] ?? "").trim(),
                    Propriedades: props,
                    Espelho: false
                };
            }
        }
    }
    return entidades;
}

// ── configurations ────────────────────────────────────────────────────────────

/**
 * { NomeDaTabela: {
 *     Arquivo, Classe, BaseConfig, EntidadeTipo, Espelho, ExcludeFromMigrations,
 *     PK: [nomes], Colunas: { nome: { ColumnType, IsRequired, DefaultValue, ValueGeneratedNever } },
 *     Indices: [{ Campos, IsUnique, Filter }],
 *     FKs: [{ Alvo, Campo, UmParaUm }],
 *     Ignores: [nomes], TemSeed
 * } }
 */
/** Colunas declaradas numa cadeia .Property(...).HasColumnType(...)... */
function LerColunas(pTexto) {
    const colunas = {};

    // (?<![A-Za-z]) impede casar dentro de GetProperty(...) — a base de lookup usa
    // typeof(T).GetProperty("Valor") logo abaixo do Property("Valor") de verdade.
    for (const m of pTexto.matchAll(
        /(?<![A-Za-z])Property\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)((?:\s*\.\s*\w+\((?:[^()]|\([^()]*\))*\))*)/g)) {
        const cadeia = m[2] ?? "";
        const tipo = cadeia.match(/HasColumnType\(\s*(\w+\([^()]*\)|[^()]+?)\s*\)/);
        const padrao = cadeia.match(/HasDefaultValue\(\s*([\w.]+\([^()]*\)|[^()]+?)\s*\)/);
        colunas[m[1]] = {
            ColumnType: tipo ? tipo[1].trim() : "",
            IsRequired: /\.IsRequired\(\)/.test(cadeia),
            DefaultValue: padrao ? padrao[1].trim() : "",
            ValueGeneratedNever: /\.ValueGeneratedNever\(\)/.test(cadeia)
        };
    }

    // Property("Nome") — forma usada pelas bases de lookup.
    for (const m of pTexto.matchAll(
        /(?<![A-Za-z])Property\(\s*"(\w+)"\s*\)((?:\s*\.\s*\w+\((?:[^()]|\([^()]*\))*\))*)/g)) {
        const cadeia = m[2] ?? "";
        const tipo = cadeia.match(/HasColumnType\(\s*(\w+\([^()]*\)|[^()]+?)\s*\)/);

        // Uma citação sem cadeia (typeof(T).GetProperty) não descreve coluna nenhuma.
        if (!tipo && colunas[m[1]]) continue;

        colunas[m[1]] = {
            ColumnType: tipo ? tipo[1].trim() : "",
            IsRequired: /\.IsRequired\(\)/.test(cadeia),
            DefaultValue: "",
            ValueGeneratedNever: false
        };
    }

    return colunas;
}

/**
 * Configurations-BASE do módulo — `SYSxBaseConfiguration<TEntidade>`, `SYSxLookupConfiguration<T,E>`.
 * Elas configuram colunas que TODA tabela derivada herda (as quatro de auditoria, o `Valor` da
 * lookup) e que por isso não aparecem em nenhuma configuration concreta.
 * Devolve { NomeDaBase: { colunas } }.
 */
export function LerBaseConfigurations(pConfigDir) {
    const bases = {};
    for (const arquivo of ArquivosCs(pConfigDir)) {
        const txt = SemComentarios(readFileSync(arquivo, "utf-8"));
        const decl = txt.match(/abstract\s+class\s+(\w+)\s*<[^>]*>\s*:/);
        if (!decl) continue;
        bases[decl[1]] = LerColunas(txt);
    }
    return bases;
}

export function LerConfigurations(pConfigDir) {
    const tabelas = {};

    for (const arquivo of ArquivosCs(pConfigDir)) {
        const bruto = readFileSync(arquivo, "utf-8");
        const txt = SemComentarios(bruto);

        const decl = txt.match(/class\s+(\w+Configuration)\s*:\s*([\w.]+)\s*<([^>]+)>/);
        if (!decl) continue;

        const [, classe, baseConfig, genericos] = decl;
        const tipoEntidade = genericos.split(",")[0].trim();

        // Lookup: base ...LookupConfiguration<TEnt, TEnum> — a tabela é o 1º genérico.
        const ehLookup = /LookupConfiguration$/.test(baseConfig);

        const mToTable = txt.match(/ToTable\(\s*(?:nameof\(([\w.]+)\)|"([^"]+)")/);
        const nomeTabela = mToTable
            ? (mToTable[1] ? mToTable[1].split(".").pop() : mToTable[2])
            : tipoEntidade.split(".").pop();

        const colunas = LerColunas(txt);

        const pk = [];
        const mKeyUm = txt.match(/HasKey\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/);
        const mKeyVarios = txt.match(/HasKey\(\s*\w+\s*=>\s*new\s*\{([^}]+)\}/);
        if (mKeyVarios) for (const c of mKeyVarios[1].matchAll(/\w+\.(\w+)/g)) pk.push(c[1]);
        else if (mKeyUm) pk.push(mKeyUm[1]);
        else {
            const mKeyStr = txt.match(/HasKey\(\s*(?:NomeChave|"(\w+)")\s*\)/);
            if (mKeyStr && mKeyStr[1]) pk.push(mKeyStr[1]);
        }

        const indices = [];
        for (const m of txt.matchAll(
            /HasIndex\(\s*\w+\s*=>\s*(new\s*\{[^}]+\}|\w+\.\w+)\s*\)((?:\s*\.\s*\w+\([^)]*\))*)/g)) {
            const campos = [...m[1].matchAll(/\w+\.(\w+)/g)].map(c => c[1]);
            const cadeia = m[2] ?? "";
            const filtro = cadeia.match(/HasFilter\(\s*([\w.]+\((?:[^()]|\([^()]*\))*\)|[^()]+?)\s*\)/);
            indices.push({
                Campos: campos,
                IsUnique: /\.IsUnique\(\)/.test(cadeia),
                Filter: filtro ? filtro[1].trim() : ""
            });
        }

        const fks = [];
        for (const m of txt.matchAll(
            /HasOne(?:<([\w.]+)>)?\(\s*(?:\w+\s*=>\s*\w+\.(\w+))?\s*\)\s*\.\s*(WithMany|WithOne)\(\s*\)\s*\.\s*HasForeignKey(?:<[\w.]+>)?\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g)) {
            fks.push({
                Alvo: (m[1] ?? "").split(".").pop() ?? "",
                Navegacao: m[2] ?? "",
                UmParaUm: m[3] === "WithOne",
                Campo: m[4]
            });
        }

        const ignores = [...txt.matchAll(/\.Ignore\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g)].map(m => m[1]);

        tabelas[nomeTabela] = {
            Arquivo: arquivo,
            Classe: classe,
            BaseConfig: baseConfig,
            EntidadeTipo: tipoEntidade,
            EhLookup: ehLookup,
            EnumTipo: ehLookup ? (genericos.split(",")[1] ?? "").trim().split(".").pop() : "",
            Espelho: /Espelho/.test(classe),
            ExcludeFromMigrations: /ExcludeFromMigrations\(\)/.test(txt),
            PK: pk,
            Colunas: colunas,
            Indices: indices,
            FKs: fks,
            Ignores: ignores,
            TemSeed: /HasData\(/.test(txt)
        };
    }

    return tabelas;
}

/**
 * Propriedades de uma entidade somando as herdadas (SYSxInquilino traz as quatro
 * colunas de auditoria de SYSxEntidadeAuditavel). Devolve { nome: { Tipo, Nullable } }.
 *
 * A nulabilidade da COLUNA vem daqui, não do `.IsRequired()` da configuration: no EF Core
 * é o tipo C# que manda (`Guid?` → NULL), e o `.IsRequired()` sobre string é redundante
 * com `#nullable enable`.
 */
export function PropriedadesComHeranca(pEntidades, pNome) {
    const saida = {};
    const vistos = new Set();
    let atual = pNome;

    while (atual && pEntidades[atual] && !vistos.has(atual)) {
        vistos.add(atual);
        const ent = pEntidades[atual];

        // As da classe derivada vencem as da base.
        for (const p of ent.Propriedades)
            if (!(p.Nome in saida)) saida[p.Nome] = { Tipo: p.Tipo, Nullable: p.Nullable };

        atual = (ent.Base ?? "").split(".").pop()?.replace(/<.*/, "") ?? "";
    }

    return saida;
}

// ── módulo inteiro ────────────────────────────────────────────────────────────

export function LerModulo(pRaizModulo, pPrefixo) {
    const infra = join(pRaizModulo, `Tootega.${pPrefixo}.Infra`, "Persistencia");
    const common = join(pRaizModulo, `Tootega.${pPrefixo}.Common`, "Lookups");
    const configs = join(infra, "Configurations");

    const tabelas = LerConfigurations(configs);
    const bases = LerBaseConfigurations(configs);

    // Colunas configuradas na BASE (auditoria, `Valor` da lookup) valem para toda tabela
    // derivada dela e não aparecem em nenhuma configuration concreta. A concreta vence.
    for (const t of Object.values(tabelas)) {
        const daBase = bases[t.BaseConfig.split(".").pop()];
        if (!daBase) continue;
        for (const [col, info] of Object.entries(daBase))
            if (!(col in t.Colunas)) t.Colunas[col] = { ...info, DaBase: true };
    }

    return {
        Prefixo: pPrefixo,
        Enums: LerEnums(common),
        Entidades: LerEntidades([join(infra, "Entidades"), join(infra, "Lookups")]),
        BasesConfig: bases,
        Tabelas: tabelas
    };
}
