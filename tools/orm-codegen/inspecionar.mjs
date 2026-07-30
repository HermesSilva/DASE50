import { readFileSync } from "node:fs";
import { XSerializationEngine, RegisterORMElements, XORMDataSet, XORMIndex } from "../../TFX/dist/index.js";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

const caminho = process.argv[2];
const alvos = process.argv.slice(3);

const doc = engine.Deserialize(readFileSync(caminho, "utf-8")).Data;
const design = doc.Design;

for (const t of design.GetTables()) {
    if (alvos.length && !alvos.includes(t.Name)) continue;

    const pk = t.GetPKField?.();
    const marcas = [
        t.IsShadow ? "SHADOW" : "",
        t.PKType ? `PKType=${t.PKType}` : "",
        t.UseStateControl ? "state" : ""
    ].filter(Boolean).join(" ");

    console.log(`\n■ ${t.Name}   ${marcas}`);
    if (pk) console.log(`   PK  ${pk.Name.padEnd(34)} ${pk.DataType}`);
    for (const f of t.GetFields()) {
        const det = [
            f.DataType,
            f.Length ? `(${f.Length}${f.Scale ? "," + f.Scale : ""})` : "",
            f.IsRequired ? "" : "NULL",
            f.DefaultValue ? `def=${f.DefaultValue}` : "",
            f.IsFK ? "FK" : ""
        ].filter(Boolean).join(" ");
        console.log(`       ${f.Name.padEnd(34)} ${det}`);
    }

    for (const idx of t.GetChildrenOfType(XORMIndex))
        console.log(`   IDX ${idx.Name}  ${idx.IsUnique ? "UNIQUE" : ""}  [${idx.GetIndexFields().map(f => f.Name).join(", ")}]`);

    const ds = t.GetChildrenOfType(XORMDataSet)[0];
    if (ds) {
        console.log(`   SEED ${ds.Name} (${ds.GetTuples().length} linhas)`);
        for (const tp of ds.GetTuples().slice(0, 4))
            console.log(`       ${String(tp.Name).padEnd(24)} ${tp.GetFieldValues().map(v => v.Value).join(" | ")}`);
    }
}
