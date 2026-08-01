import { describe, it, expect, beforeEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMValidator } from "../src/Designers/ORM/XORMValidator.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { XGuid } from "../src/Core/XGuid.js";
import { DescribeInheritableFields, ResolveInheritance } from "../src/Designers/ORM/XORMInheritance.js";
import { XDesignerErrorSeverity } from "../src/Core/XValidation.js";

RegisterORMElements();

describe("ResolveInheritance", () => {

    let doc: XORMDocument;
    let design: XORMDesign;

    beforeEach(() => {
        doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
    });

    function CriarTabela(pNome: string, pCampos: string[] = []) {
        const t = design.CreateTable({ Name: pNome });
        t.CreatePKField({ Name: `${pNome}ID`, DataType: "Int64" });
        for (const nome of pCampos)
            t.CreateField({ Name: nome, DataType: "String", Length: 60 });
        return t;
    }

    it("sem Inheritance não herda nada", () => {
        const t = CriarTabela("VNDxPedido", ["Numero"]);

        const r = ResolveInheritance(t, design);

        expect(r.Fields).toEqual([]);
        expect(r.Chain).toEqual([]);
        expect(r.Missing).toBe("");
        expect(r.Cycle).toBe("");
    });

    it("traz os campos da base declarada", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm", "CriadoPor"]);
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxAuditavel";

        const r = ResolveInheritance(filha, design);

        expect(r.Fields.map(f => f.Name)).toEqual(["CriadoEm", "CriadoPor"]);
        expect(r.Chain).toEqual(["VNDxAuditavel"]);
    });

    /**
     * A chave da base fica de fora: quem herda tem a sua, e duas colunas marcadas como
     * primária na mesma tabela não é modelo válido em banco nenhum. Herança aqui é
     * achatamento de colunas comuns, não chave compartilhada.
     */
    it("não traz a chave primária da base", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        expect(ResolveInheritance(filha, design).Fields.map(f => f.Name)).toEqual(["CriadoEm"]);
    });

    /**
     * Do ancestral mais DISTANTE para o mais próximo: é a ordem em que as colunas entram na
     * filha, e a que mantém a saída estável quando um nível novo é inserido no meio.
     */
    it("percorre a cadeia inteira, do ancestral mais distante para o mais próximo", () => {
        CriarTabela("VNDxRaiz", ["Versao"]);
        const meio = CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        meio.Inheritance = "VNDxRaiz";
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxAuditavel";

        const r = ResolveInheritance(filha, design);

        expect(r.Fields.map(f => f.Name)).toEqual(["Versao", "CriadoEm"]);
        expect(r.Chain).toEqual(["VNDxAuditavel", "VNDxRaiz"]);
    });

    /**
     * Sem o corte, a cadeia A→B→A rodaria para sempre e travaria o designer inteiro na
     * primeira validação. O nome onde ela se fecha volta como dado, para o erro dizer onde.
     */
    it("interrompe o ciclo em vez de girar para sempre", () => {
        const a = CriarTabela("A");
        const b = CriarTabela("B");
        a.Inheritance = "B";
        b.Inheritance = "A";

        const r = ResolveInheritance(a, design);

        expect(r.Cycle).toBe("A");
        expect(r.Chain).toEqual(["B"]);
    });

    it("herdar de si mesma é ciclo", () => {
        const t = CriarTabela("A");
        t.Inheritance = "A";

        expect(ResolveInheritance(t, design).Cycle).toBe("A");
    });

    it("base que não existe volta como Missing, sem lançar", () => {
        const t = CriarTabela("VNDxPedido");
        t.Inheritance = "SYSxAuditavel";

        const r = ResolveInheritance(t, design);

        expect(r.Missing).toBe("SYSxAuditavel");
        expect(r.Fields).toEqual([]);
    });

    it("resolve a base numa tabela de outro modelo", () => {
        const t = CriarTabela("VNDxPedido", ["Numero"]);
        t.Inheritance = "SYSxAuditavel";

        const r = ResolveInheritance(t, design, [{
            Name: "SYSxAuditavel",
            Inheritance: "",
            Module: "Tootega.SYS",
            Fields: [{
                Name: "CriadoEm", Description: "", DataType: "DateTime", Length: 0, Scale: 0,
                IsRequired: true, IsAutoIncrement: false, DefaultValue: "", TargetTable: "", IsOneToOne: false
            }]
        }]);

        expect(r.Missing).toBe("");
        expect(r.Fields.map(f => f.Name)).toEqual(["CriadoEm"]);
    });

    /** A cadeia pode atravessar a fronteira dos modelos: base local que herda de base externa. */
    it("segue a cadeia do modelo aberto para o modelo externo", () => {
        const local = CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        local.Inheritance = "SYSxBase";
        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        const r = ResolveInheritance(filha, design, [{
            Name: "SYSxBase",
            Inheritance: "",
            Module: "Tootega.SYS",
            Fields: [{
                Name: "Versao", Description: "", DataType: "Int32", Length: 0, Scale: 0,
                IsRequired: true, IsAutoIncrement: false, DefaultValue: "", TargetTable: "", IsOneToOne: false
            }]
        }]);

        expect(r.Fields.map(f => f.Name)).toEqual(["Versao", "CriadoEm"]);
        expect(r.Chain).toEqual(["VNDxAuditavel", "SYSxBase"]);
    });

    /**
     * Um espelho é só a marca de que a original mora em outro módulo — não tem campo nenhum.
     * Herdar dele tem de cair na tabela REAL, que costuma vir junto pelos modelos importados;
     * parar no espelho geraria a filha sem as colunas da base.
     */
    it("pula a tabela espelho e usa a original do modelo externo", () => {
        const espelho = design.CreateTable({ Name: "SYSxAuditavel" });
        espelho.IsShadow = true;
        espelho.ShadowTableName = "SYSxAuditavel";

        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "SYSxAuditavel";

        const r = ResolveInheritance(filha, design, [{
            Name: "SYSxAuditavel",
            Inheritance: "",
            Module: "Tootega.SYS",
            Fields: [{
                Name: "CriadoEm", Description: "", DataType: "DateTime", Length: 0, Scale: 0,
                IsRequired: true, IsAutoIncrement: false, DefaultValue: "", TargetTable: "", IsOneToOne: false
            }]
        }]);

        expect(r.Fields.map(f => f.Name)).toEqual(["CriadoEm"]);
    });

    it("campo repetido em dois níveis entra uma vez só", () => {
        CriarTabela("VNDxRaiz", ["CriadoEm"]);
        const meio = CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        meio.Inheritance = "VNDxRaiz";
        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        expect(ResolveInheritance(filha, design).Fields.map(f => f.Name)).toEqual(["CriadoEm"]);
    });

    it("a mesma base declarada duas vezes entre as externas usa a primeira", () => {
        const t = CriarTabela("VNDxPedido");
        t.Inheritance = "SYSxBase";

        const campo = (pNome: string) => ({
            Name: pNome, Description: "", DataType: "String", Length: 10, Scale: 0,
            IsRequired: true, IsAutoIncrement: false, DefaultValue: "", TargetTable: "", IsOneToOne: false
        });

        const r = ResolveInheritance(t, design, [
            { Name: "SYSxBase", Module: "Tootega.SYS", Inheritance: "", Fields: [campo("DoPrimeiro")] },
            { Name: "SYSxBase", Module: "Tootega.SYS", Inheritance: "", Fields: [campo("DoSegundo")] }
        ]);

        expect(r.Fields.map(f => f.Name)).toEqual(["DoPrimeiro"]);
    });

    it("tabela solta, fora de qualquer design, não quebra", () => {
        const t = CriarTabela("VNDxPedido");
        t.Inheritance = "Qualquer";

        expect(ResolveInheritance(t, null).Missing).toBe("Qualquer");
    });
});

describe("DescribeInheritableFields", () => {

    let doc: XORMDocument;
    let design: XORMDesign;

    beforeEach(() => {
        doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
    });

    /**
     * A FK herdada tem de continuar sendo FK na filha: o nome da tabela apontada é o que
     * atravessa a fronteira do documento, porque o ID da referência não significa nada no
     * modelo que herda.
     */
    it("leva o alvo da chave estrangeira pelo nome", () => {
        const alvo = design.CreateTable({ Name: "SYSxUsuario" });
        alvo.CreatePKField({ Name: "SYSxUsuarioID", DataType: "Int64" });

        const base = design.CreateTable({ Name: "VNDxAuditavel" });
        base.CreatePKField({ Name: "VNDxAuditavelID", DataType: "Int64" });
        const fk = base.CreateField({ Name: "CriadoPorID", DataType: "Int64" });
        design.CreateReference({ SourceFieldID: fk.ID, TargetTableID: alvo.ID });

        const campos = DescribeInheritableFields(base, design);

        expect(campos).toHaveLength(1);
        expect(campos[0].Name).toBe("CriadoPorID");
        expect(campos[0].TargetTable).toBe("SYSxUsuario");
    });

    it("campo sem referência não vira chave estrangeira", () => {
        const base = design.CreateTable({ Name: "VNDxAuditavel" });
        base.CreatePKField({ Name: "VNDxAuditavelID", DataType: "Int64" });
        base.CreateField({ Name: "CriadoEm", DataType: "DateTime" });

        expect(DescribeInheritableFields(base, design)[0].TargetTable).toBe("");
    });

    /**
     * A referência pode ter perdido o alvo — tabela apagada de um arquivo editado à mão. Quem
     * acusa isso é o validador; aqui o campo só não pode virar FK para lugar nenhum, senão a
     * filha geraria um relacionamento contra um nome vazio.
     */
    it("referência sem tabela alvo não vira chave estrangeira", () => {
        const alvo = design.CreateTable({ Name: "SYSxUsuario" });
        alvo.CreatePKField({ Name: "SYSxUsuarioID", DataType: "Int64" });

        const base = design.CreateTable({ Name: "VNDxAuditavel" });
        base.CreatePKField({ Name: "VNDxAuditavelID", DataType: "Int64" });
        const fk = base.CreateField({ Name: "CriadoPorID", DataType: "Int64" });
        const ref = design.CreateReference({ SourceFieldID: fk.ID, TargetTableID: alvo.ID });
        ref.Target = XGuid.NewValue();

        expect(DescribeInheritableFields(base, design)[0].TargetTable).toBe("");
    });

    it("tabela fora de um design devolve os campos sem alvo nenhum", () => {
        const base = design.CreateTable({ Name: "VNDxAuditavel" });
        base.CreatePKField({ Name: "VNDxAuditavelID", DataType: "Int64" });
        base.CreateField({ Name: "CriadoEm", DataType: "DateTime" });

        const campos = DescribeInheritableFields(base, null);

        expect(campos.map(f => f.Name)).toEqual(["CriadoEm"]);
        expect(campos[0].TargetTable).toBe("");
    });
});

describe("XORMValidator — herança", () => {

    let doc: XORMDocument;
    let design: XORMDesign;
    let validator: XORMValidator;

    beforeEach(() => {
        doc = new XORMDocument();
        doc.Initialize();
        doc.Name = "MER";
        design = doc.Design;
        design.Name = "Modelo";
        validator = new XORMValidator();
    });

    function CriarTabela(pNome: string, pCampos: string[] = []) {
        const t = design.CreateTable({ Name: pNome });
        t.CreatePKField({ Name: `${pNome}ID`, DataType: "Int64" });
        for (const nome of pCampos)
            t.CreateField({ Name: nome, DataType: "String", Length: 60 });
        return t;
    }

    const Erros = () => validator.Validate(doc).filter(i => i.Severity === XDesignerErrorSeverity.Error);

    /**
     * Redeclarar na filha uma coluna que a base já dá produz duas propriedades de mesmo nome
     * na classe gerada — código que nem compila. O erro aponta o CAMPO, para o clique levar
     * direto ao que precisa ser renomeado.
     */
    it("acusa campo que colide com o herdado", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const filha = CriarTabela("VNDxPedido", ["CriadoEm"]);
        filha.Inheritance = "VNDxAuditavel";

        const erro = Erros().find(i => i.Message.includes("collides"));

        expect(erro).toBeDefined();
        expect(erro!.ElementName).toBe("CriadoEm");
        expect(erro!.Message).toContain("VNDxAuditavel");
    });

    it("nome que só difere por maiúsculas também colide", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const filha = CriarTabela("VNDxPedido", ["criadoem"]);
        filha.Inheritance = "VNDxAuditavel";

        expect(Erros().some(i => i.Message.includes("collides"))).toBe(true);
    });

    it("sem colisão, herdar não gera erro", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxAuditavel";

        expect(Erros()).toEqual([]);
    });

    it("acusa o ciclo com o caminho percorrido", () => {
        const a = CriarTabela("A");
        const b = CriarTabela("B");
        a.Inheritance = "B";
        b.Inheritance = "A";

        const erro = Erros().find(i => i.Message.includes("cycle"));

        expect(erro).toBeDefined();
        expect(erro!.Message).toContain("A -> B -> A");
    });

    /**
     * A base pode morar num modelo pai ou importado, que o TFX não lê. Acusar aqui poria erro
     * vermelho em todo modelo modular que herda de outro módulo.
     */
    it("cala sobre base que não está neste modelo", () => {
        const t = CriarTabela("VNDxPedido");
        t.Inheritance = "SYSxAuditavel";

        expect(Erros()).toEqual([]);
    });

    it("acusa espelho que declara herança", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const espelho = design.CreateTable({ Name: "SYSxInquilino" });
        espelho.IsShadow = true;
        espelho.ShadowTableName = "SYSxInquilino";
        espelho.Inheritance = "VNDxAuditavel";

        expect(Erros().some(i => i.Message.includes("has no fields of its own"))).toBe(true);
    });
});

describe("persistência de IsModel e Inheritance", () => {

    const engine = XSerializationEngine.Instance;

    it("nascem no default e não escrevem nada no arquivo", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        const t = doc.Design.CreateTable({ Name: "VNDxPedido" });

        expect(t.IsModel).toBe(false);
        expect(t.Inheritance).toBe("");

        const xml = engine.Serialize(doc).XmlOutput ?? "";
        expect(xml).not.toContain("IsModel");
        expect(xml).not.toContain("Inheritance");
    });

    it("sobrevivem a gravar e reler", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        const t = doc.Design.CreateTable({ Name: "VNDxPedido" });
        t.CreatePKField({ Name: "VNDxPedidoID", DataType: "Int64" });
        t.IsModel = true;
        t.Inheritance = "SYSxAuditavel";

        const xml = engine.Serialize(doc).XmlOutput ?? "";
        const relido = engine.Deserialize<XORMDocument>(xml);
        relido.Data!.Initialize();

        const tabela = relido.Data!.Design.GetTables()[0];
        expect(tabela.IsModel).toBe(true);
        expect(tabela.Inheritance).toBe("SYSxAuditavel");
    });
});
