import { describe, it, expect, beforeEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

RegisterORMElements();

/**
 * Uma referência é o desenho de uma chave estrangeira. Apagando a coluna de origem, ela
 * deixa de representar qualquer coisa: sem esta limpeza, sobrava uma linha solta no
 * diagrama, apontando para o nada e voltando como erro a cada validação.
 */
describe("excluir campo remove a linha da FK", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
    });

    function MontarFK() {
        const origem = design.CreateTable({ Name: "Pedido" });
        const alvo = design.CreateTable({ Name: "Cliente" });
        alvo.CreatePKField({ Name: "ClienteID", DataType: "Int64" });

        const fk = origem.CreateField({ Name: "ClienteID", DataType: "Int64" });
        design.CreateReference({ SourceFieldID: fk.ID, TargetTableID: alvo.ID, Name: "FK_Pedido_Cliente" });

        return { origem, alvo, fk };
    }

    it("apaga a referência junto com o campo", () => {
        const { origem, fk } = MontarFK();
        expect(design.GetReferences()).toHaveLength(1);

        expect(origem.DeleteField(fk)).toBe(true);

        expect(design.GetReferences()).toHaveLength(0);
        expect(origem.FindFieldByID(fk.ID)).toBeNull();
    });

    it("preserva as referências dos outros campos", () => {
        const { origem, alvo } = MontarFK();

        const outra = design.CreateTable({ Name: "Produto" });
        outra.CreatePKField({ Name: "ProdutoID", DataType: "Int64" });
        const fk2 = origem.CreateField({ Name: "ProdutoID", DataType: "Int64" });
        design.CreateReference({ SourceFieldID: fk2.ID, TargetTableID: outra.ID });

        expect(design.GetReferences()).toHaveLength(2);

        origem.DeleteField(fk2);

        const restantes = design.GetReferences();
        expect(restantes).toHaveLength(1);
        expect(restantes[0].Target).toBe(alvo.ID);
    });

    it("campo comum, sem referência, some sem efeito colateral", () => {
        const t = design.CreateTable({ Name: "Pedido" });
        const campo = t.CreateField({ Name: "Observacao", DataType: "String" });

        expect(t.DeleteField(campo)).toBe(true);
        expect(design.GetReferences()).toHaveLength(0);
    });

    it("apagar a tabela de origem também leva a linha", () => {
        const { origem } = MontarFK();

        expect(design.DeleteTable(origem)).toBe(true);
        expect(design.GetReferences()).toHaveLength(0);
    });

    it("RemoveReferencesForField informa quantas removeu", () => {
        const { fk } = MontarFK();

        expect(design.RemoveReferencesForField(fk.ID)).toBe(1);
        expect(design.RemoveReferencesForField(fk.ID)).toBe(0);
    });
});
