// Roda o gerador contra um MER real e escreve (ou simula) os arquivos.
//
//   node gerar.mjs <MER.dsorm> [--gravar]
//
// Resolve o perfil, o mapa de tipos e os namespaces dos módulos donos do mesmo jeito que
// o DASE fará: subindo do modelo até achar `.DASE`.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import {
    XSerializationEngine, RegisterORMElements,
    XTypeResolver, BuildCodeModel, XCodeGenerator, DescribeInheritableFields
} from "../../TFX/dist/index.js";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

const alvo = resolve(process.argv[2] ?? "");
const GRAVAR = process.argv.includes("--gravar");

if (!alvo || !existsSync(alvo)) {
    console.error("uso: node gerar.mjs <MER.dsorm> [--gravar]");
    process.exit(1);
}

/** Sobe da pasta dada até achar um `.DASE` que contenha o arquivo/pasta pedido. */
function AcharNoDase(pPartida, pRelativo) {
    let dir = pPartida;
    for (;;) {
        const candidato = join(dir, ".DASE", pRelativo);
        if (existsSync(candidato)) return candidato;
        const pai = dirname(dir);
        if (pai === dir) return null;
        dir = pai;
    }
}

function LerDocumento(pCaminho) {
    const r = engine.Deserialize(readFileSync(pCaminho, "utf-8"));
    if (!r.Success) throw new Error(`falha ao ler ${pCaminho}: ${r.Errors?.map(e => e.Message).join("; ")}`);
    return r.Data;
}

const pastaModelo = dirname(alvo);
const doc = LerDocumento(alvo);
const design = doc.Design;

if (!design.GenerateCode) {
    console.log(`${basename(alvo)}: GenerateCode desligado no modelo — nada a fazer.`);
    process.exit(0);
}

// ── perfil ────────────────────────────────────────────────────────────────────

const templatesDir = AcharNoDase(pastaModelo, "Templates");
if (!templatesDir) throw new Error("não achei .DASE/Templates subindo a partir do modelo");

const perfis = readdirSync(templatesDir)
    .filter(n => statSync(join(templatesDir, n)).isDirectory())
    .filter(n => existsSync(join(templatesDir, n, "profile.json")));

const escolhido = design.CodeTemplate || perfis[0];
if (!escolhido || !perfis.includes(escolhido))
    throw new Error(`perfil '${escolhido}' não encontrado. Disponíveis: ${perfis.join(", ") || "(nenhum)"}`);

const perfilDir = join(templatesDir, escolhido);
const profile = JSON.parse(readFileSync(join(perfilDir, "profile.json"), "utf-8"));

const templates = new Map();
for (const nome of readdirSync(perfilDir))
    if (nome.endsWith(".tpl"))
        templates.set(nome, readFileSync(join(perfilDir, nome), "utf-8"));

// ── tipos ─────────────────────────────────────────────────────────────────────

const tiposPath = AcharNoDase(pastaModelo, "ORM.Types.json");
if (!tiposPath) throw new Error("não achei .DASE/ORM.Types.json");

const tipos = JSON.parse(readFileSync(tiposPath, "utf-8")).Types;
const resolver = new XTypeResolver(tipos, profile.Id);

const semMapa = resolver.GetUnmappedTypes();
if (semMapa.length)
    console.log(`   aviso: sem Mappings["${profile.Id}"]: ${semMapa.join(", ")}`);

// ── namespaces dos módulos donos (para os espelhos) ───────────────────────────

const ownerNamespaces = {};
for (const t of design.GetTables()) {
    if (!t.IsShadow) continue;
    const prefixo = (t.Name.match(/^([A-Z]{2,4})x/) ?? [])[1];
    if (!prefixo || ownerNamespaces[prefixo]) continue;

    // O .dsorm do dono declara o próprio Namespace — é dele que sai o `using` do espelho.
    const merDono = join(dirname(pastaModelo), `Tootega.${prefixo}`, `MER-${prefixo}.dsorm`);
    if (existsSync(merDono)) {
        try { ownerNamespaces[prefixo] = LerDocumento(merDono).Design.Namespace || `Tootega.${prefixo}`; }
        catch { ownerNamespaces[prefixo] = `Tootega.${prefixo}`; }
    }
    else ownerNamespaces[prefixo] = t.ShadowModuleName || `Tootega.${prefixo}`;
}

// ── geração ───────────────────────────────────────────────────────────────────

/**
 * Namespace raiz: o declarado no modelo vence; sem ele, a estrutura responde — prefixo comum
 * dos projetos vizinhos (Tootega.SYS.API, Tootega.SYS.Infra... => Tootega.SYS) e, na falta
 * deles, o nome da pasta. Mesma regra do comando no VS Code.
 */
function DerivarNamespace(pModelDir) {
    const projetos = [];

    const coletar = dir => {
        try {
            for (const nome of readdirSync(dir))
                if (/\.(csproj|vbproj|fsproj)$/i.test(nome))
                    projetos.push(nome.replace(/\.(csproj|vbproj|fsproj)$/i, ""));
        }
        catch { /* pasta ilegivel */ }
    };

    coletar(pModelDir);
    try {
        for (const nome of readdirSync(pModelDir))
            if (statSync(join(pModelDir, nome)).isDirectory()) coletar(join(pModelDir, nome));
    }
    catch { /* segue com o que houver */ }

    const pasta = basename(pModelDir);

    // Sinal mais forte: a pasta se chama como os projetos que contém.
    if (projetos.some(p => p === pasta || p.startsWith(pasta + "."))) return pasta;

    if (projetos.length === 1) return projetos[0];

    if (projetos.length > 1) {
        // Prefixo por segmentos, o mais longo que cubra a maioria. Prefixo comum de TODOS
        // não serve: um `TID.Launcher` ao lado de sete `Tootega.ID.*` reduziria tudo a "T".
        const votos = new Map();
        for (const nome of projetos) {
            const partes = nome.split(".");
            for (let i = 1; i <= partes.length; i++) {
                const c = partes.slice(0, i).join(".");
                votos.set(c, (votos.get(c) ?? 0) + 1);
            }
        }

        const minimo = Math.ceil(projetos.length / 2);
        let melhor = "";
        for (const [c, quantos] of votos)
            if (quantos >= minimo && c.length > melhor.length) melhor = c;

        if (melhor.length > 0) return melhor;
    }

    return pasta;
}

/** Nomes de projeto na pasta do modelo e nas filhas diretas. */
function ListarProjetos(pModelDir) {
    const projetos = [];
    const coletar = dir => {
        try {
            for (const nome of readdirSync(dir))
                if (/\.(csproj|vbproj|fsproj)$/i.test(nome))
                    projetos.push(nome.replace(/\.(csproj|vbproj|fsproj)$/i, ""));
        }
        catch { /* pasta ilegivel */ }
    };
    coletar(pModelDir);
    try {
        for (const nome of readdirSync(pModelDir))
            if (statSync(join(pModelDir, nome)).isDirectory()) coletar(join(pModelDir, nome));
    }
    catch { /* segue */ }
    return projetos;
}

/** Casa cada sufixo do perfil com o projeto real; empate vence o nome mais curto. */
function CasarProjetos(pProjetos, pSufixos) {
    const mapa = {};
    for (const sufixo of pSufixos) {
        const candidatos = pProjetos
            .filter(p => p === sufixo || p.endsWith("." + sufixo))
            .sort((a, b) => a.length - b.length || a.localeCompare(b));
        if (candidatos.length) mapa[sufixo] = candidatos[0];
    }
    return mapa;
}

const nsDeclarado = (design.Namespace ?? "").trim();
const namespace = nsDeclarado || DerivarNamespace(pastaModelo);

const sufixos = profile.ProjectSuffixes ?? [];
const projetos = CasarProjetos(ListarProjetos(pastaModelo), sufixos);

const semProjeto = sufixos.filter(s => !projetos[s]);
if (semProjeto.length)
    console.log(`   aviso: sem projeto para ${semProjeto.join(", ")} — usando "${namespace}.<sufixo>"`);

// ── bases de herança: a árvore INTEIRA de modelos alcançáveis ─────────────────
//
// Uma tabela pode herdar de outra que mora em outro modelo — e essa, de uma terceira, num
// modelo que só o segundo declara. Parar nos modelos declarados por ESTE aqui deixaria a
// tabela gerada sem as colunas do último nível, e o defeito só apareceria na migração.

/** Procura um modelo declarado subindo da pasta dada: `ParentModel` é relativo a ela, `ImportModels` à raiz do repositório. */
function AcharModeloDeclarado(pPartida, pRelativo) {
    let dir = pPartida;
    for (;;) {
        const candidato = join(dir, pRelativo);
        if (existsSync(candidato)) return candidato;
        const pai = dirname(dir);
        if (pai === dir) return null;
        dir = pai;
    }
}

/** Modelos que um documento declara, resolvidos a partir da pasta dele. */
function ModelosDeclarados(pDoc, pPasta) {
    const d = pDoc.Design;
    return [...(d.ParentModel ?? "").split("|"), ...d.GetImportedModels()]
        .filter(Boolean)
        .map(rel => ({ Relativo: rel, Caminho: AcharModeloDeclarado(pPasta, rel) }));
}

const externas = [];
const tabelasVistas = new Set();
const modelosVistos = new Set([resolve(alvo).toLowerCase()]);
const fila = ModelosDeclarados(doc, pastaModelo);

while (fila.length > 0) {
    const { Relativo: relativo, Caminho: caminho } = fila.shift();

    if (!caminho) {
        console.log(`   aviso: modelo declarado não encontrado: ${relativo}`);
        continue;
    }

    const chaveModelo = resolve(caminho).toLowerCase();
    if (modelosVistos.has(chaveModelo)) continue;
    modelosVistos.add(chaveModelo);

    try {
        const outro = LerDocumento(caminho);
        for (const t of outro.Design?.GetTables?.() ?? []) {
            const chave = (t.Name ?? "").toLowerCase();
            if (t.IsShadow || !chave || tabelasVistas.has(chave)) continue;
            tabelasVistas.add(chave);
            externas.push({
                Name: t.Name,
                Fields: DescribeInheritableFields(t, outro.Design),
                Inheritance: (t.Inheritance ?? "").trim()
            });
        }
        fila.push(...ModelosDeclarados(outro, dirname(caminho)));
    }
    catch (erro) {
        console.log(`   aviso: falha ao ler ${relativo}: ${erro.message}`);
    }
}

const modelo = BuildCodeModel(doc, {
    Resolver: resolver,
    OwnerNamespaces: ownerNamespaces,
    Namespace: namespace,
    Projects: projetos,
    ProjectSuffixes: sufixos,
    ExternalTables: externas
});
const gerador = new XCodeGenerator(profile, templates);
const arquivos = gerador.Generate(modelo);

const raiz = resolve(pastaModelo, modelo.OutputRoot || ".");

console.log(`\n${basename(alvo)}  →  perfil '${profile.Id}'`);
console.log(`   namespace ${modelo.Namespace || "(vazio!)"} | módulo ${modelo.Module} | raiz ${raiz}`);
console.log(`   ${modelo.Entities.length} entidades, ${modelo.Lookups.length} lookups, ${modelo.Mirrors.length} espelhos, ${modelo.Owned.length} com posse`);
console.log(`   ${arquivos.length} arquivos\n`);

let iguais = 0, novos = 0, mudados = 0;

for (const arq of arquivos) {
    const destino = join(raiz, arq.Path);
    const anterior = existsSync(destino) ? readFileSync(destino, "utf-8") : null;

    if (anterior === null) novos++;
    else if (anterior === arq.Content) iguais++;
    else mudados++;

    if (GRAVAR) {
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, arq.Content, "utf-8");
    }
}

console.log(`   ${novos} novos, ${mudados} alterados, ${iguais} sem mudança${GRAVAR ? " — GRAVADO" : "  (simulação)"}`);

// --mostrar <trecho> imprime os arquivos cujo caminho contenha o trecho.
const iMostrar = process.argv.indexOf("--mostrar");
if (iMostrar > 0) {
    const filtro = (process.argv[iMostrar + 1] ?? "").toLowerCase();
    for (const arq of arquivos.filter(a => a.Path.toLowerCase().includes(filtro))) {
        console.log(`\n${"─".repeat(76)}\n${arq.Path}\n${"─".repeat(76)}`);
        console.log(arq.Content);
    }
}
