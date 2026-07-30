import { describe, it, expect, beforeEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMIndex } from "../src/Designers/ORM/XORMIndex.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

RegisterORMElements();
const engine = XSerializationEngine.Instance;

describe("propriedades de geração — defaults", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
    });

    it("um modelo novo já gera código", () => {
        expect(design.GenerateCode).toBe(true);
    });

    it("uma tabela nova já gera código", () => {
        expect(design.CreateTable({ Name: "T" }).GenerateCode).toBe(true);
    });

    it("perfil vazio e saída na pasta do modelo", () => {
        expect(design.CodeTemplate).toBe("");
        expect(design.Namespace).toBe("");
        expect(design.OutputRoot).toBe(".");
    });

    it("índice nasce completo, sem filtro", () => {
        const t = design.CreateTable({ Name: "T" });
        expect(t.CreateChild(XORMIndex).Filter).toBe("");
    });

    it("guarda o que foi atribuído", () => {
        design.GenerateCode = false;
        design.CodeTemplate = "csharp-efcore";
        design.Namespace = "Tootega.SYS";
        design.OutputRoot = "../saida";

        expect(design.GenerateCode).toBe(false);
        expect(design.CodeTemplate).toBe("csharp-efcore");
        expect(design.Namespace).toBe("Tootega.SYS");
        expect(design.OutputRoot).toBe("../saida");
    });
});

describe("propriedades de geração — serialização", () => {

    /**
     * O ponto que mais importa: propriedade em valor default NÃO é gravada. Sem isso,
     * abrir e salvar qualquer modelo antigo encheria o arquivo de atributos redundantes
     * e sujaria o diff de todo commit.
     */
    it("não escreve nada quando tudo está no default", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.CreateTable({ Name: "T" });

        const xml = engine.Serialize(doc).XmlOutput ?? "";

        expect(xml).not.toContain("GenerateCode");
        expect(xml).not.toContain("CodeTemplate");
        expect(xml).not.toContain("OutputRoot");
        expect(xml).not.toContain("Namespace");
    });

    it("escreve e relê o que difere do default", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.GenerateCode = false;
        doc.Design.Namespace = "Tootega.VND";
        doc.Design.CodeTemplate = "csharp-efcore";
        doc.Design.OutputRoot = "..";

        const tabela = doc.Design.CreateTable({ Name: "T" });
        tabela.GenerateCode = false;

        const indice = tabela.CreateChild(XORMIndex);
        indice.Name = "IX_T_A";
        indice.IsUnique = true;
        indice.Filter = "A <> ''";

        const xml = engine.Serialize(doc).XmlOutput ?? "";
        const relido = engine.Deserialize<XORMDocument>(xml).Data!;
        const design = relido.Design;

        expect(design.GenerateCode).toBe(false);
        expect(design.Namespace).toBe("Tootega.VND");
        expect(design.CodeTemplate).toBe("csharp-efcore");
        expect(design.OutputRoot).toBe("..");

        const t = design.GetTables()[0];
        expect(t.GenerateCode).toBe(false);

        const ix = t.GetChildrenOfType(XORMIndex)[0];
        expect(ix.IsUnique).toBe(true);
        expect(ix.Filter).toBe("A <> ''");
        expect(ix.Name).toBe("IX_T_A");
    });

    it("modelo antigo, sem as chaves novas, abre com os defaults", () => {
        const xml =
            '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<XORMDocument ID="11111111-1111-1111-1111-111111111111" Name="M">\n' +
            '  <XORMDesign Name="D">\n' +
            '    <XORMTable ID="22222222-2222-2222-2222-222222222222" Name="T" />\n' +
            '  </XORMDesign>\n' +
            '</XORMDocument>';

        const doc = engine.Deserialize<XORMDocument>(xml).Data!;

        expect(doc.Design.GenerateCode).toBe(true);
        expect(doc.Design.OutputRoot).toBe(".");
        expect(doc.Design.GetTables()[0].GenerateCode).toBe(true);
    });
});
