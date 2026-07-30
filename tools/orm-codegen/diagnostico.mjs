// Fase 0 — diagnóstico. Compara o que o código EF descreve com o que o MER guarda,
// e lista exatamente o que o importador precisa gravar. Não escreve nada.

import { readFileSync } from "node:fs";
import { XSerializationEngine, RegisterORMElements, XORMDataSet } from "../../TFX/dist/index.js";
import { LerModulo } from "./ler-codigo.mjs";

/** Campos da tabela, PK incluída — GetFields() devolve só os não-PK. */
function CamposDaTabela(pTabela) {
    const pk = pTabela.GetPKField?.();
    return [...(pk ? [pk] : []), ...pTabela.GetFields()];
}

/** Primeiro XORMDataSet da tabela, ou null. */
function SeedDaTabela(pTabela) {
    return pTabela.GetChildrenOfType?.(XORMDataSet)?.[0] ?? null;
}

RegisterORMElements();
const engine = XSerializationEngine.Instance;

const BASE = "D:/Tootega/Source/TootegaERP/Back/Modules";

const MODULOS = [
    { Prefixo: "SYS", Raiz: `${BASE}/Tootega.SYS`, Mer: `${BASE}/Tootega.SYS/MER-SYS.dsorm` },
    { Prefixo: "VND", Raiz: `${BASE}/Tootega.VND`, Mer: `${BASE}/Tootega.VND/MER-VND.dsorm` }
];

/** Normaliza texto pt-BR para um identificador C# candidato. */
function Derivar(pTexto) {
    const semAcento = pTexto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return semAcento
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map(p => p[0].toUpperCase() + p.slice(1))
        .join("");
}

function LerMer(pCaminho) {
    const r = engine.Deserialize(readFileSync(pCaminho, "utf-8"));
    if (!r.Success) throw new Error(`falha ao ler ${pCaminho}: ${r.Errors?.map(e => e.Message).join("; ")}`);
    return r.Data;
}

for (const mod of MODULOS) {
    console.log(`\n${"=".repeat(78)}\n  ${mod.Prefixo}\n${"=".repeat(78)}`);

    const codigo = LerModulo(mod.Raiz, mod.Prefixo);
    const doc = LerMer(mod.Mer);
    const design = doc.Design;
    const tabelasMer = design.GetTables();

    const porNome = new Map(tabelasMer.map(t => [t.Name, t]));

    // ── cobertura de tabelas ──────────────────────────────────────────────────
    const noCodigo = Object.keys(codigo.Tabelas).sort();
    const noMer = tabelasMer.map(t => t.Name).sort();

    const faltamNoMer = noCodigo.filter(n => !porNome.has(n));
    const sobramNoMer = noMer.filter(n => !codigo.Tabelas[n]);

    console.log(`\nTabelas: código ${noCodigo.length} | MER ${noMer.length}`);
    if (faltamNoMer.length) {
        console.log(`\n  AUSENTES no MER (${faltamNoMer.length}):`);
        for (const n of faltamNoMer) {
            const t = codigo.Tabelas[n];
            const tipo = t.Espelho ? "espelho" : t.EhLookup ? "lookup" : "entidade";
            console.log(`     ${n.padEnd(38)} ${tipo}`);
        }
    }
    if (sobramNoMer.length)
        console.log(`\n  No MER sem configuration (${sobramNoMer.length}): ${sobramNoMer.join(", ")}`);

    // ── IsRequired, DefaultValue, ValueGeneratedNever ─────────────────────────
    let totReq = 0, totDef = 0, totVgn = 0, camposAusentes = [];
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        const tm = porNome.get(nome);
        for (const [col, c] of Object.entries(t.Colunas)) {
            if (c.IsRequired) totReq++;
            if (c.DefaultValue) totDef++;
            if (c.ValueGeneratedNever) totVgn++;
            if (tm && !CamposDaTabela(tm).some(f => f.Name === col))
                camposAusentes.push(`${nome}.${col}`);
        }
    }
    console.log(`\nA gravar no MER:`);
    console.log(`   IsRequired ............ ${totReq}`);
    console.log(`   DefaultValue .......... ${totDef}`);
    console.log(`   ValueGeneratedNever ... ${totVgn}`);

    const totIdx = Object.values(codigo.Tabelas).reduce((s, t) => s + t.Indices.length, 0);
    const totUni = Object.values(codigo.Tabelas).reduce((s, t) => s + t.Indices.filter(i => i.IsUnique).length, 0);
    const totFil = Object.values(codigo.Tabelas).reduce((s, t) => s + t.Indices.filter(i => i.Filter).length, 0);
    console.log(`   Índices ............... ${totIdx}  (únicos ${totUni}, com filtro ${totFil})`);

    if (camposAusentes.length)
        console.log(`\n  Colunas no código sem campo no MER (${camposAusentes.length}):\n     ${camposAusentes.slice(0, 25).join("\n     ")}`);

    // ── identificadores de enum ───────────────────────────────────────────────
    let membros = 0, derivaveis = 0;
    const divergentes = [];
    const lookupsSemSeedNoMer = [];

    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        if (!t.EhLookup) continue;
        const enumeracao = codigo.Enums[t.EnumTipo || nome];
        if (!enumeracao) continue;

        const tm = porNome.get(nome);
        const ds = tm ? SeedDaTabela(tm) : null;
        if (!ds || ds.GetTuples().length === 0) {
            lookupsSemSeedNoMer.push(`${nome} (${enumeracao.length} membros no enum)`);
            continue;
        }

        for (const m of enumeracao) {
            membros++;
            const derivado = Derivar(m.Desc || m.Id);
            if (derivado === m.Id) derivaveis++;
            else divergentes.push(`${nome.padEnd(26)} ${String(m.Cod).padStart(3)}  '${m.Desc}' -> '${derivado}'  real '${m.Id}'`);
        }
    }

    console.log(`\nEnums de lookup: ${membros} membros | deriváveis ${derivaveis} | precisam de Name explícito ${divergentes.length}`);
    if (lookupsSemSeedNoMer.length)
        console.log(`\n  Lookups SEM seed no MER (${lookupsSemSeedNoMer.length}):\n     ${lookupsSemSeedNoMer.join("\n     ")}`);
    if (divergentes.length)
        console.log(`\n  Identificadores não deriváveis:\n     ${divergentes.join("\n     ")}`);
}
