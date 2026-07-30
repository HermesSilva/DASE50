/**
 * Regenera XConfigResources.GetORMDataType() a partir de Resources/ORM.DataType.json.
 *
 * O recurso é embarcado como TypeScript porque o build não usa resolveJsonModule e o
 * pacote precisa funcionar dentro do VSIX sem ler disco. Manter as duas cópias à mão
 * convida a divergência — daí este script, e o teste
 * `tests/XConfigResourcesCodeGen.test.ts`, que falha se elas se separarem.
 *
 *   npm run sync-resources
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(AQUI, "..", "src", "Config");

const json = JSON.parse(readFileSync(join(CONFIG, "Resources", "ORM.DataType.json"), "utf-8"));
const alvo = join(CONFIG, "XConfigResources.ts");

const corpo = JSON.stringify(json, null, 4)
    .split("\n")
    .map((linha, i) => i === 0 ? linha : "        " + linha)
    .join("\n");

const original = readFileSync(alvo, "utf-8");

const inicio = original.indexOf("    static GetORMDataType(): XORMTypesConfig");
const fim = original.indexOf("    /**", inicio);

if (inicio < 0 || fim < 0)
    throw new Error("não achei os limites de GetORMDataType em XConfigResources.ts");

const novo =
    original.slice(0, inicio) +
    "    static GetORMDataType(): XORMTypesConfig\n" +
    "    {\n" +
    `        return ${corpo} as XORMTypesConfig;\n` +
    "    }\n\n" +
    original.slice(fim);

if (novo === original)
{
    console.log("XConfigResources.ts já está em dia.");
    process.exit(0);
}

writeFileSync(alvo, novo, "utf-8");
console.log(`XConfigResources.ts regenerado — ${json.Types.length} tipos, formato v${json.Version ?? 1}.`);
