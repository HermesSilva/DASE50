import { describe, it, expect, beforeEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

describe("ImportModels", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
    });

    it("nasce vazia", () => {
        expect(design.ImportModels).toBe("");
        expect(design.GetImportedModels()).toEqual([]);
    });

    it("guarda vários modelos separados por barra vertical", () => {
        design.ImportModels = "Back/Modules/Tootega.SYS/MER-SYS.dsorm|Back/Modules/Tootega.CRM/MER-CRM.dsorm";

        expect(design.GetImportedModels()).toEqual([
            "Back/Modules/Tootega.SYS/MER-SYS.dsorm",
            "Back/Modules/Tootega.CRM/MER-CRM.dsorm"
        ]);
    });

    it("descarta entradas vazias da lista", () => {
        design.ImportModels = "|A.dsorm||B.dsorm|";
        expect(design.GetImportedModels()).toEqual(["A.dsorm", "B.dsorm"]);
    });

    /**
     * São propriedades distintas, com finalidades distintas: `ParentModel` responde por
     * outro papel e não pode ser afetada pelo que se põe em `ImportModels`.
     */
    it("é independente de ParentModel", () => {
        design.ParentModel = "Vizinho.dsorm";
        design.ImportModels = "Back/Outro/MER.dsorm";

        expect(design.ParentModel).toBe("Vizinho.dsorm");
        expect(design.ImportModels).toBe("Back/Outro/MER.dsorm");
    });

    it("não escreve nada no arquivo enquanto está vazia", () => {
        const doc = new XORMDocument();
        doc.Initialize();

        expect(engine.Serialize(doc).XmlOutput ?? "").not.toContain("ImportModels");
    });

    it("sobrevive a gravar e reler, junto com ParentModel", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.ParentModel = "Vizinho.dsorm";
        doc.Design.ImportModels = "Back/Modules/Tootega.SYS/MER-SYS.dsorm|Back/Modules/Tootega.CRM/MER-CRM.dsorm";

        const relido = engine.Deserialize<XORMDocument>(engine.Serialize(doc).XmlOutput!).Data!;

        expect(relido.Design.ParentModel).toBe("Vizinho.dsorm");
        expect(relido.Design.GetImportedModels()).toHaveLength(2);
    });

    /**
     * A propriedade é nova: modelo antigo simplesmente não a tem, e ParentModel continua
     * sendo lido como sempre — as duas usam identificadores diferentes.
     */
    /**
     * Regressão: um modelo salvo ANTES da primeira tabela perdia todas as propriedades do
     * design ao ser reaberto.
     *
     * `XORMDocument.Initialize` consolida os designs duplicados escolhendo o que tem
     * filhos; quando nenhum tinha, ficava com o design vazio criado pelo construtor e
     * descartava o desserializado — junto com Schema, Namespace, ParentModel e o resto.
     */
    it("guarda as propriedades mesmo num modelo ainda sem tabela", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.Schema = "vendas";
        doc.Design.Namespace = "Acme.Vendas";
        doc.Design.ParentModel = "V.dsorm";
        doc.Design.ImportModels = "Outro/MER.dsorm";

        const relido = engine.Deserialize<XORMDocument>(engine.Serialize(doc).XmlOutput!).Data!;

        expect(relido.Design.GetTables()).toHaveLength(0);
        expect(relido.Design.Schema).toBe("vendas");
        expect(relido.Design.Namespace).toBe("Acme.Vendas");
        expect(relido.Design.ParentModel).toBe("V.dsorm");
        expect(relido.Design.ImportModels).toBe("Outro/MER.dsorm");
    });

    it("modelo antigo com ParentModel continua íntegro", () => {
        const xml =
            '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<XORMDocument ID="11111111-1111-1111-1111-111111111111" Name="M">\n' +
            '  <XORMDesign Name="D">\n' +
            '    <XValues>\n' +
            '      <XData Name="ParentModel" ID="C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20" Type="String">Antigo.dsorm</XData>\n' +
            '    </XValues>\n' +
            '  </XORMDesign>\n' +
            '</XORMDocument>';

        const doc = engine.Deserialize<XORMDocument>(xml).Data!;

        expect(doc.Design.ParentModel).toBe("Antigo.dsorm");
        expect(doc.Design.ImportModels).toBe("");
    });
});
