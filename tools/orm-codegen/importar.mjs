// Fase 0 — importador. Traz para o MER o que hoje só existe no código EF:
// IsRequired, DefaultValue, índices, seed das lookups (com o identificador do enum
// no Name da tupla) e as tabelas espelho.
//
//   node importar.mjs            → simulação, não grava
//   node importar.mjs --gravar   → grava os .dsorm
//
// O round-trip do TFX é fiel byte a byte (temp/roundtrip.mjs), então tudo que
// este importador NÃO tocar sai do serializador exatamente como entrou.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import {
    XSerializationEngine, RegisterORMElements,
    XORMDataSet, XORMDataTuple, XFieldValue, XORMIndex, XORMIndexField
} from "../../TFX/dist/index.js";
import { LerModulo, PropriedadesComHeranca } from "./ler-codigo.mjs";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

const GRAVAR = process.argv.includes("--gravar");
const BASE = "D:/Tootega/Source/TootegaERP/Back/Modules";

const MODULOS = [
    { Prefixo: "SYS", Raiz: `${BASE}/Tootega.SYS`, Mer: `${BASE}/Tootega.SYS/MER-SYS.dsorm` },
    { Prefixo: "VND", Raiz: `${BASE}/Tootega.VND`, Mer: `${BASE}/Tootega.VND/MER-VND.dsorm` }
];

/** Onde vive o MER de cada módulo dono, para os espelhos apontarem. */
const MER_DO_MODULO = {
    SYS: "MER-SYS", CRM: "MER-CRM", STQ: "MER-STQ", NFE: "MER-NFE", VND: "MER-VND", ID: "MER-ID"
};

// ── helpers de modelo ─────────────────────────────────────────────────────────

// XORMPKField deriva de XORMField, então GetFields() já devolve a PK junto.
const CamposDaTabela = t => t.GetFields();

const SeedDaTabela = t => t.GetChildrenOfType?.(XORMDataSet)?.[0] ?? null;

/** Mapa DataType do EF (helper multi-banco) → tipo do catálogo DSORM. */
function TipoDoHelper(pExpressao) {
    const e = pExpressao.replace(/\s/g, "");
    if (/^UniqueIdentifier\(\)/.test(e)) return { Tipo: "Guid" };
    if (/^SmallInt\(\)/.test(e)) return { Tipo: "Int16" };
    if (/^Int\(\)/.test(e)) return { Tipo: "Int32" };
    if (/^BigInt\(\)/.test(e)) return { Tipo: "Int64" };
    if (/^TinyInt\(\)/.test(e)) return { Tipo: "Int8" };
    if (/^Bit\(\)/.test(e)) return { Tipo: "Boolean" };
    if (/^Date\(\)/.test(e)) return { Tipo: "Date" };
    if (/^DateTime2?\(/.test(e)) return { Tipo: "DateTime" };
    if (/^VarCharMax\(\)|^NVarCharMax\(\)/.test(e)) return { Tipo: "Text" };
    if (/^VarBinaryMax\(\)/.test(e)) return { Tipo: "Binary" };

    let m = e.match(/^N?VarChar\((\d+)\)/);
    if (m) return { Tipo: "String", Length: Number(m[1]) };
    m = e.match(/^N?Char\((\d+)\)/);
    if (m) return { Tipo: "String", Length: Number(m[1]) };
    m = e.match(/^VarBinary\((\d+)\)/);
    if (m) return { Tipo: "Binary", Length: Number(m[1]) };
    m = e.match(/^Decimal\((\d+),(\d+)\)/);
    if (m) return { Tipo: "Numeric", Length: Number(m[1]), Scale: Number(m[2]) };

    return null;
}

// ── execução ──────────────────────────────────────────────────────────────────

let totalMudancas = 0;

for (const mod of MODULOS) {
    console.log(`\n${"=".repeat(72)}\n  ${mod.Prefixo}\n${"=".repeat(72)}`);

    const codigo = LerModulo(mod.Raiz, mod.Prefixo);

    // Um espelho herda a entidade do módulo DONO (padrão VND-D6), e é lá que está a
    // nulabilidade real das colunas. Sem carregar o dono, a auditoria do espelho sairia
    // NOT NULL. Carrega sob demanda, só os módulos citados pelos espelhos.
    const entidadesDoDono = {};
    const donosLidos = new Set();
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        if (!t.Espelho) continue;
        const dono = (nome.match(/^([A-Z]{2,4})x/) ?? [])[1];
        if (!dono || dono === mod.Prefixo || donosLidos.has(dono)) continue;
        donosLidos.add(dono);
        try { Object.assign(entidadesDoDono, LerModulo(`${BASE}/Tootega.${dono}`, dono).Entidades); }
        catch { console.log(`     ! não consegui ler o módulo dono ${dono}`); }
    }

    const xmlOriginal = readFileSync(mod.Mer, "utf-8");
    const lido = engine.Deserialize(xmlOriginal);
    if (!lido.Success) { console.log(`  ERRO ao ler o MER: ${lido.Errors?.map(e => e.Message).join("; ")}`); continue; }

    const design = lido.Data.Design;
    const porNome = new Map(design.GetTables().map(t => [t.Name, t]));
    const conta = { Required: 0, Default: 0, Indice: 0, Tupla: 0, Seed: 0, Espelho: 0, Campo: 0, Tipo: 0, Estereotipo: 0 };
    const divergencias = [];

    // 1) tabelas espelho ausentes ─────────────────────────────────────────────
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        if (!t.Espelho || porNome.has(nome)) continue;

        // A classe local do espelho é vazia (`class SYSxInquilino : Sys.SYSxInquilino;`) e tem o
        // mesmo nome da do dono — resolver a cadeia nela pararia no primeiro salto. Vai direto
        // ao dicionário do dono.
        const propsDono = PropriedadesComHeranca(entidadesDoDono, nome);
        const prefixoDono = (nome.match(/^([A-Z]{2,4})x/) ?? [])[1] ?? "";
        const merDono = MER_DO_MODULO[prefixoDono] ?? "";

        const tabela = design.CreateTable({ Name: nome });
        tabela.Name = nome;
        tabela.IsShadow = true;
        tabela.ShadowTableName = nome;
        tabela.ShadowDocumentName = merDono;
        tabela.ShadowModuleName = prefixoDono ? `Tootega.${prefixoDono}` : "";
        if (t.PK.length) tabela.PKType = TipoDoHelper(t.Colunas[t.PK[0]]?.ColumnType ?? "")?.Tipo ?? "Guid";

        // Campos: a PK primeiro, depois as demais colunas na ordem da configuration.
        for (const col of Object.keys(t.Colunas)) {
            const info = TipoDoHelper(t.Colunas[col].ColumnType);
            if (!info) { console.log(`     ! tipo não reconhecido em ${nome}.${col}: ${t.Colunas[col].ColumnType}`); continue; }

            if (t.PK.includes(col)) {
                const pk = tabela.CreatePKField({ Name: col, DataType: info.Tipo });
                pk.Name = col;

                // IsAutoIncrement de PK não é confiável no TFX: a desserialização aplica os
                // valores por SetValue, sem passar pelos setters, então a regra "Guid não é
                // identity" (XORMPKField.UpdateAutoIncrementForDataType) não roda ao carregar e
                // TODO PK relido fica com o `true` do construtor. Como `false` é o default da
                // propriedade, ele jamais chega ao arquivo.
                //
                // Gravar `true` aqui apenas alinha o arquivo ao que a leitura produz, deixando o
                // .dsorm estável entre abrir e salvar. A geração NÃO consulta este campo para PK:
                // usa regras semânticas — PK Guid, PK que é chave compartilhada 1:1, e PK de
                // tabela espelho (chave do módulo dono) nunca são identity.
                pk.IsAutoIncrement = true;
                continue;
            }
            const campo = tabela.CreateField({ Name: col, DataType: info.Tipo });
            campo.Name = col;
            campo.DataType = info.Tipo;
            if (info.Length !== undefined) campo.Length = info.Length;
            if (info.Scale !== undefined) campo.Scale = info.Scale;
            if (propsDono[col]?.Nullable) campo.IsRequired = false;
            conta.Campo++;
        }

        porNome.set(nome, tabela);
        conta.Espelho++;
    }

    // 1b) estereótipo ─────────────────────────────────────────────────────────
    // O código sabe com certeza o que a forma da tabela não distingue: quem deriva de
    // `...LookupConfiguration` é lookup, o resto é entidade. Espelho fica de fora —
    // IsShadow já o determina.
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        const tm = porNome.get(nome);
        if (!tm || t.Espelho) continue;

        const papel = t.EhLookup ? "Lookup" : "Entity";
        if (tm.Stereotype !== papel) { tm.Stereotype = papel; conta.Estereotipo++; }
    }

    // 2) nulabilidade e DefaultValue por campo ────────────────────────────────
    // IsRequired tem default TRUE no TFX: o MER já trata todo campo como obrigatório.
    // O que precisa ser gravado é o inverso — os campos anuláveis (Guid?, DateTime?).
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        const tm = porNome.get(nome);
        if (!tm) continue;

        const props = t.Espelho
            ? PropriedadesComHeranca(entidadesDoDono, nome)
            : PropriedadesComHeranca(codigo.Entidades, t.EntidadeTipo.split(".").pop());

        for (const campo of CamposDaTabela(tm)) {
            const c = t.Colunas[campo.Name];
            if (!c) continue;

            const prop = props[campo.Name];
            const anulavel = prop ? prop.Nullable : false;
            if (anulavel && campo.IsRequired) { campo.IsRequired = false; conta.Required++; }

            // Chave que chega pronta da aplicação (ValueGeneratedNever no código). Precisa
            // ser explícita no modelo: não dá para derivar de IsAutoIncrement, que o TFX
            // não preserva na leitura.
            if (c.ValueGeneratedNever && !campo.ValueGeneratedNever) {
                campo.ValueGeneratedNever = true;
                conta.Required++;
            }

            // Tipo e tamanho: o banco em produção reflete o CÓDIGO, então é ele que manda
            // nesta importação. Toda divergência é registrada — é decisão do dono.
            const info = TipoDoHelper(c.ColumnType);
            if (info) {
                if (info.Tipo !== campo.DataType) {
                    divergencias.push(`${nome}.${campo.Name}: tipo MER=${campo.DataType} código=${info.Tipo}`);
                    campo.DataType = info.Tipo;
                    conta.Tipo++;
                }
                const alvoLen = info.Length ?? 0;
                if (alvoLen !== campo.Length) {
                    if (campo.Length) divergencias.push(`${nome}.${campo.Name}: tamanho MER=${campo.Length} código=${alvoLen}`);
                    campo.Length = alvoLen;
                    conta.Tipo++;
                }
                const alvoEsc = info.Scale ?? 0;
                if (alvoEsc !== campo.Scale) { campo.Scale = alvoEsc; conta.Tipo++; }
            }

            // Valor default vindo de expressão C# (SYSxCidade.NaoInformadoID) entra
            // prefixado por '=' — o gerador emite verbatim em vez de formatar como literal.
            if (c.DefaultValue) {
                const valor = /^[A-Za-z_][\w.]*$/.test(c.DefaultValue) ? `=${c.DefaultValue}` : c.DefaultValue;
                if (campo.DefaultValue !== valor) { campo.DefaultValue = valor; conta.Default++; }
            }
        }
    }

    // 3) índices ──────────────────────────────────────────────────────────────
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        const tm = porNome.get(nome);
        if (!tm || t.Indices.length === 0) continue;

        const jaExistem = tm.GetChildrenOfType(XORMIndex);
        const assinatura = i => `${i.GetIndexFields().map(f => f.ParentID).join(",")}|${i.IsUnique}`;
        const presentes = new Set(jaExistem.map(assinatura));

        for (const idx of t.Indices) {
            const campos = idx.Campos
                .map(c => CamposDaTabela(tm).find(f => f.Name === c))
                .filter(Boolean);

            if (campos.length !== idx.Campos.length) {
                console.log(`     ! índice de ${nome} cita campo inexistente: ${idx.Campos.join(", ")}`);
                continue;
            }

            const chave = `${campos.map(c => c.ID).join(",")}|${idx.IsUnique}`;
            if (presentes.has(chave)) continue;

            const indice = tm.CreateChild(XORMIndex);
            indice.Name = `IX_${nome}_${idx.Campos.join("_")}`;
            indice.IsUnique = idx.IsUnique;

            for (const campo of campos) {
                const ref = indice.CreateChild(XORMIndexField);
                ref.Name = campo.Name;
                ref.ParentID = campo.ID;
            }

            presentes.add(chave);
            conta.Indice++;

            if (idx.Filter)
                console.log(`     · índice ${indice.Name} tem filtro no código (${idx.Filter}) — XORMIndex.Filter ainda não existe (Fase 3)`);
        }
    }

    // 4) seed das lookups + identificador do enum no Name da tupla ────────────
    for (const [nome, t] of Object.entries(codigo.Tabelas)) {
        if (!t.EhLookup) continue;
        const membros = codigo.Enums[t.EnumTipo || nome];
        const tm = porNome.get(nome);
        if (!membros || !tm) continue;

        const campos = CamposDaTabela(tm);
        const campoPK = tm.GetPKField?.() ?? campos.find(f => /ID$/.test(f.Name));
        const campoValor = campos.find(f => f.Name === "Valor") ?? campos.find(f => f !== campoPK);
        if (!campoPK || !campoValor) { console.log(`     ! ${nome}: sem PK ou coluna Valor no MER`); continue; }

        let seed = SeedDaTabela(tm);
        if (!seed) {
            seed = tm.CreateChild(XORMDataSet);
            seed.Name = `${nome}Records`;
            conta.Seed++;
        }

        const tuplas = seed.GetTuples();
        const porCodigo = new Map();
        for (const tupla of tuplas) {
            const vs = tupla.GetFieldValues();
            const vpk = vs.find(v => v.FieldID === campoPK.ID);
            if (vpk) porCodigo.set(String(vpk.Value), tupla);
        }

        for (const m of membros) {
            let tupla = porCodigo.get(String(m.Cod));

            if (!tupla) {
                tupla = seed.CreateChild(XORMDataTuple);
                const vpk = tupla.CreateChild(XFieldValue);
                vpk.FieldID = campoPK.ID;
                vpk.Value = String(m.Cod);
                const vval = tupla.CreateChild(XFieldValue);
                vval.FieldID = campoValor.ID;
                vval.Value = m.Desc || m.Id;
                conta.Tupla++;
            }

            // O identificador do enum é decisão de programador (BRL, Trial, Z0Confiavel) e
            // não se deriva do texto pt-BR — por isso vive no Name da tupla.
            if (tupla.Name !== m.Id) { tupla.Name = m.Id; conta.Tupla++; }
        }
    }

    // ── resultado ─────────────────────────────────────────────────────────────
    const mudancas = Object.values(conta).reduce((a, b) => a + b, 0);
    totalMudancas += mudancas;

    console.log(`  tabelas espelho criadas .. ${conta.Espelho}  (${conta.Campo} campos)`);
    console.log(`  estereótipos ............. ${conta.Estereotipo}`);
    console.log(`  campos marcados anuláveis  ${conta.Required}`);
    console.log(`  tipo/tamanho alinhados ... ${conta.Tipo}`);
    console.log(`  DefaultValue ............. ${conta.Default}`);
    console.log(`  índices .................. ${conta.Indice}`);
    console.log(`  seeds criados ............ ${conta.Seed}`);
    console.log(`  tuplas criadas/nomeadas .. ${conta.Tupla}`);

    if (divergencias.length) {
        console.log(`\n  DIVERGÊNCIAS MER × código (${divergencias.length}) — o código venceu:`);
        for (const d of divergencias) console.log(`     ${d}`);
    }

    const gerado = engine.Serialize(lido.Data);
    if (!gerado.Success) { console.log(`  ERRO ao serializar: ${gerado.Errors?.map(e => e.Message).join("; ")}`); continue; }

    if (mudancas === 0) { console.log(`  → nada a fazer`); continue; }

    if (!GRAVAR) {
        console.log(`  → simulação (use --gravar para aplicar); saída teria ${gerado.XmlOutput.length} bytes (era ${xmlOriginal.length})`);
        continue;
    }

    const backup = `${mod.Mer}.bak`;
    if (!existsSync(backup)) copyFileSync(mod.Mer, backup);
    writeFileSync(mod.Mer, gerado.XmlOutput, "utf-8");
    console.log(`  → gravado (${gerado.XmlOutput.length} bytes; backup em ${backup.split("/").pop()})`);
}

console.log(`\n${totalMudancas} alterações no total.${GRAVAR ? "" : "  (simulação)"}`);
