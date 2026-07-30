// Compara o CÓDIGO GERADO com o código real do módulo, no plano semântico.
//
// Não compara texto: o gerado é partial e o real é uma classe só, então diff textual
// não diz nada. Compara o que decide o ESQUEMA — que é o que a migração vazia exige:
// colunas com tipo, obrigatoriedade, defaults, chaves, índices e FKs.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import {
    XSerializationEngine, RegisterORMElements,
    XTypeResolver, BuildCodeModel
} from "../../TFX/dist/index.js";
import { LerModulo } from "./ler-codigo.mjs";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

const BASE = "D:/Tootega/Source/TootegaERP/Back/Modules";
const ALVOS = [
    { Prefixo: "SYS", Raiz: `${BASE}/Tootega.SYS`, Mer: `${BASE}/Tootega.SYS/MER-SYS.dsorm` },
    { Prefixo: "VND", Raiz: `${BASE}/Tootega.VND`, Mer: `${BASE}/Tootega.VND/MER-VND.dsorm` }
];

function AcharNoDase(pPartida, pRelativo) {
    let dir = pPartida;
    for (;;) {
        const c = join(dir, ".DASE", pRelativo);
        if (existsSync(c)) return c;
        const pai = dirname(dir);
        if (pai === dir) return null;
        dir = pai;
    }
}

/** Normaliza a expressão de coluna do código real para comparar com a gerada. */
const Norm = s => (s ?? "").replace(/\s+/g, "");

let totalDivergencias = 0;

for (const alvo of ALVOS) {
    console.log(`\n${"=".repeat(72)}\n  ${alvo.Prefixo}\n${"=".repeat(72)}`);

    const codigo = LerModulo(alvo.Raiz, alvo.Prefixo);
    const doc = engine.Deserialize(readFileSync(alvo.Mer, "utf-8")).Data;

    const tiposPath = AcharNoDase(dirname(alvo.Mer), "ORM.Types.json");
    const tipos = JSON.parse(readFileSync(tiposPath, "utf-8")).Types;
    const resolver = new XTypeResolver(tipos, "csharp-efcore");

    const modelo = BuildCodeModel(doc, { Resolver: resolver });
    const problemas = [];

    for (const t of modelo.Tables) {
        const real = codigo.Tabelas[t.Name];
        if (!real) { problemas.push(`${t.Name}: existe no modelo mas não no código`); continue; }

        // estereótipo
        const esperado = real.Espelho ? "Mirror" : real.EhLookup ? "Lookup" : "Entity";
        if (t.Stereotype !== esperado)
            problemas.push(`${t.Name}: estereótipo ${t.Stereotype}, código diz ${esperado}`);

        // colunas
        for (const f of t.Fields) {
            const c = real.Colunas[f.Name];
            if (!c) {
                // A PK de lookup é configurada na base por `Property(NomeChave)` — nome
                // dinâmico que o leitor de código não resolve. Não é ausência real.
                if (!(t.Stereotype === "Lookup" && f.IsPrimaryKey))
                    problemas.push(`${t.Name}.${f.Name}: gerada mas ausente no código`);
                continue;
            }

            if (c.ColumnType && Norm(c.ColumnType) !== Norm(f.ColumnType))
                problemas.push(`${t.Name}.${f.Name}: coluna gerada ${f.ColumnType}, código ${c.ColumnType}`);

            // `.IsRequired()` no código só é escrito para string; para os demais tipos a
            // obrigatoriedade vem da nulabilidade em C#, comparada na Fase 0.
            if (f.BaseType === "string" && c.IsRequired !== f.IsRequired)
                problemas.push(`${t.Name}.${f.Name}: IsRequired gerado ${f.IsRequired}, código ${c.IsRequired}`);
        }

        for (const nome of Object.keys(real.Colunas))
            if (!t.Fields.some(f => f.Name === nome))
                problemas.push(`${t.Name}.${nome}: existe no código mas não foi gerada`);

        // A PK de lookup é configurada na base por `Property(NomeChave)`, um nome dinâmico
        // que o leitor de código não resolve — não é ausência de verdade.

        // chave
        if (real.PK.length === 1 && t.PK && t.PK.Name !== real.PK[0])
            problemas.push(`${t.Name}: PK gerada ${t.PK.Name}, código ${real.PK[0]}`);

        const realVGN = real.PK.length === 1 && real.Colunas[real.PK[0]]?.ValueGeneratedNever === true;
        if (realVGN !== t.PKValueGeneratedNever)
            problemas.push(`${t.Name}: ValueGeneratedNever gerado ${t.PKValueGeneratedNever}, código ${realVGN}`);

        // índices
        const chaveIdx = i => `${[...(i.Campos ?? i.Fields)].join(",")}|${i.IsUnique}`;
        const gerados = new Set(t.Indexes.map(chaveIdx));
        const reais = new Set(real.Indices.map(chaveIdx));
        for (const k of reais) if (!gerados.has(k)) problemas.push(`${t.Name}: índice do código não gerado: ${k}`);
        for (const k of gerados) if (!reais.has(k)) problemas.push(`${t.Name}: índice gerado a mais: ${k}`);

        // chaves estrangeiras
        const fksReais = new Set(real.FKs.map(f => f.Campo));
        const fksGeradas = new Set(t.ForeignKeys.map(f => f.Name));
        for (const k of fksReais) if (!fksGeradas.has(k)) problemas.push(`${t.Name}: FK do código não gerada: ${k}`);
        for (const k of fksGeradas) if (!fksReais.has(k)) problemas.push(`${t.Name}: FK gerada a mais: ${k}`);
    }

    for (const nome of Object.keys(codigo.Tabelas))
        if (!modelo.Tables.some(t => t.Name === nome))
            problemas.push(`${nome}: existe no código mas não no modelo`);

    // seeds das lookups: todo membro do enum precisa de linha com identificador
    for (const t of modelo.Lookups) {
        const real = codigo.Tabelas[t.Name];
        const membros = codigo.Enums[real?.EnumTipo || t.Name];
        if (!membros) continue;

        for (const m of membros) {
            const linha = t.Seed.find(r => r.Raw[t.PK.Name] === String(m.Cod));
            if (!linha) { problemas.push(`${t.Name}: falta seed do membro ${m.Id} = ${m.Cod}`); continue; }
            if (linha.Member !== m.Id)
                problemas.push(`${t.Name}: membro do código ${m.Cod} é '${m.Id}', modelo diz '${linha.Member}'`);
        }
    }

    totalDivergencias += problemas.length;

    console.log(`  tabelas ${modelo.Tables.length} | entidades ${modelo.Entities.length} | lookups ${modelo.Lookups.length} | espelhos ${modelo.Mirrors.length} | posse ${modelo.Owned.length}`);
    if (problemas.length === 0) console.log(`  ✓ nenhuma divergência`);
    else {
        console.log(`  ${problemas.length} divergências:`);
        for (const p of problemas.slice(0, 40)) console.log(`     ${p}`);
        if (problemas.length > 40) console.log(`     … e mais ${problemas.length - 40}`);
    }
}

console.log(`\n${totalDivergencias} divergências no total.`);
