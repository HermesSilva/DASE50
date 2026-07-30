// Define Namespace/OutputRoot nos MER do piloto. Faz parte da Fase 0: são metadados da
// solução, e o lugar deles é o modelo — não os templates.
import { readFileSync, writeFileSync } from "node:fs";
import { XSerializationEngine, RegisterORMElements } from "../../TFX/dist/index.js";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

const BASE = "D:/Tootega/Source/TootegaERP/Back/Modules";
const ALVOS = [
    // TenantControlTable é o mestre de posse: dele sai a lista de entidades que recebem
    // filtro de inquilino na leitura e enforcement na escrita.
    { Mer: `${BASE}/Tootega.SYS/MER-SYS.dsorm`, Namespace: "Tootega.SYS", Tenant: "SYSxInquilino" },
    { Mer: `${BASE}/Tootega.VND/MER-VND.dsorm`, Namespace: "Tootega.VND", Tenant: "SYSxInquilino" }
];

for (const alvo of ALVOS) {
    const doc = engine.Deserialize(readFileSync(alvo.Mer, "utf-8")).Data;
    const design = doc.Design;

    const antes = `${design.Namespace}|${design.OutputRoot}|${design.CodeTemplate}|${design.TenantControlTable}`;
    design.Namespace = alvo.Namespace;
    design.OutputRoot = ".";
    design.CodeTemplate = "csharp-efcore";
    design.TenantControlTable = alvo.Tenant;
    const depois = `${design.Namespace}|${design.OutputRoot}|${design.CodeTemplate}|${design.TenantControlTable}`;

    if (antes === depois) { console.log(`${alvo.Namespace}: já configurado`); continue; }

    writeFileSync(alvo.Mer, engine.Serialize(doc).XmlOutput, "utf-8");
    console.log(`${alvo.Namespace}: Namespace/OutputRoot/CodeTemplate gravados`);
}
