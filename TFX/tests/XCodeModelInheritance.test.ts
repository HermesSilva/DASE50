import { describe, it, expect, beforeEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XTypeResolver, BuildCodeModel } from "../src/CodeGen/index.js";
import { XConfigResources } from "../src/Config/XConfigResources.js";
import type { XIExternalTable, XIInheritedField } from "../src/Designers/ORM/XORMInheritance.js";

RegisterORMElements();

const Resolver = () => new XTypeResolver(XConfigResources.GetORMDataType().Types, "csharp-efcore");

const CampoExterno = (pNome: string, pOpcoes: Partial<XIInheritedField> = {}): XIInheritedField => ({
    Name: pNome,
    Description: "",
    DataType: "String",
    Length: 60,
    Scale: 0,
    IsRequired: true,
    IsAutoIncrement: false,
    DefaultValue: "",
    TargetTable: "",
    IsOneToOne: false,
    ...pOpcoes
});

describe("herança na geração", () => {

    let doc: XORMDocument;
    let design: XORMDesign;

    beforeEach(() => {
        doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
        design.Namespace = "Acme.VND";
    });

    function CriarTabela(pNome: string, pCampos: string[] = []) {
        const t = design.CreateTable({ Name: pNome });
        t.CreatePKField({ Name: `${pNome}ID`, DataType: "Int64" });
        for (const nome of pCampos)
            t.CreateField({ Name: nome, DataType: "String", Length: 60 });
        return t;
    }

    const Montar = (pExternas?: XIExternalTable[]) => BuildCodeModel(doc, {
        Resolver: Resolver(),
        Namespace: "Acme.VND",
        ExternalTables: pExternas
    });

    it("a tabela gera os campos próprios e os da base", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm", "CriadoPor"]);
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Fields.map(f => f.Name)).toEqual(["VNDxPedidoID", "Numero", "CriadoEm", "CriadoPor"]);
        expect(tabela.InheritedFields.map(f => f.Name)).toEqual(["CriadoEm", "CriadoPor"]);
        expect(tabela.Inheritance).toBe("VNDxAuditavel");
    });

    /** O campo herdado passa pelo mesmo resolvedor: a coluna gerada é igual à da base. */
    it("o campo herdado sai com tipo e coluna resolvidos", () => {
        const base = CriarTabela("VNDxAuditavel");
        base.CreateField({ Name: "CriadoEm", DataType: "DateTime", IsRequired: false });
        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        const herdado = Montar().Tables.find(t => t.Name === "VNDxPedido")!.InheritedFields[0];
        const naBase = Montar().Tables.find(t => t.Name === "VNDxAuditavel")!.DataFields[0];

        expect(herdado.Type).toBe(naBase.Type);
        expect(herdado.ColumnType).toBe(naBase.ColumnType);
        expect(herdado.IsRequired).toBe(false);
    });

    it("o campo herdado nunca vira chave primária da filha", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Fields.filter(f => f.IsPrimaryKey).map(f => f.Name)).toEqual(["VNDxPedidoID"]);
        expect(tabela.PK!.Name).toBe("VNDxPedidoID");
    });

    /**
     * Redeclarar na filha é especializar — é a leitura natural de quem escreveu os dois. Emitir
     * as duas colunas produziria uma classe com a propriedade repetida, que nem compila.
     */
    it("o campo próprio vence o herdado de mesmo nome", () => {
        const base = CriarTabela("VNDxAuditavel");
        base.CreateField({ Name: "CriadoEm", DataType: "DateTime" });
        const filha = CriarTabela("VNDxPedido");
        filha.CreateField({ Name: "CriadoEm", DataType: "String", Length: 30 });
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Fields.filter(f => f.Name === "CriadoEm")).toHaveLength(1);
        expect(tabela.Fields.find(f => f.Name === "CriadoEm")!.DataType).toBe("String");
        expect(tabela.InheritedFields).toHaveLength(0);
    });

    it("a FK herdada continua sendo FK, apontando a mesma tabela", () => {
        const alvo = CriarTabela("SYSxUsuario");
        const base = CriarTabela("VNDxAuditavel");
        const fk = base.CreateField({ Name: "CriadoPorID", DataType: "Int64" });
        design.CreateReference({ SourceFieldID: fk.ID, TargetTableID: alvo.ID });

        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.ForeignKeys.map(f => f.Name)).toEqual(["CriadoPorID"]);
        expect(tabela.ForeignKeys[0].TargetTable).toBe("SYSxUsuario");
    });

    it("a FK herdada que aponta lookup leva o enum junto", () => {
        const lookup = design.CreateTable({ Name: "VNDxEstado" });
        lookup.CreatePKField({ Name: "VNDxEstadoID", DataType: "Int16" });
        lookup.CreateField({ Name: "Valor", DataType: "String", Length: 40 });

        const base = CriarTabela("VNDxAuditavel");
        const fk = base.CreateField({ Name: "VNDxEstadoID", DataType: "Int16" });
        design.CreateReference({ SourceFieldID: fk.ID, TargetTableID: lookup.ID });

        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.ForeignKeys[0].LookupEnum).toBe("VNDxEstado");
    });

    it("herda de tabela de outro modelo", () => {
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "SYSxAuditavel";

        const tabela = Montar([{
            Name: "SYSxAuditavel",
            Inheritance: "",
            Module: "Tootega.SYS",
            Fields: [CampoExterno("CriadoEm", { DataType: "DateTime", Length: 0 })]
        }]).Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Fields.map(f => f.Name)).toEqual(["VNDxPedidoID", "Numero", "CriadoEm"]);
    });

    /**
     * A classe-mãe do código gerado é a base declarada. Vindo de outro módulo, o gerado precisa
     * nomeá-la por inteiro — sem o namespace da origem, o nome curto não resolveria lá.
     */
    it("base de outro módulo publica o namespace da origem", () => {
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "SYSxAuditavel";

        const tabela = Montar([{
            Name: "SYSxAuditavel",
            Inheritance: "",
            Module: "Tootega.SYS",
            Fields: [CampoExterno("CriadoEm", { DataType: "DateTime", Length: 0 })]
        }]).Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Inheritance).toBe("SYSxAuditavel");
        expect(tabela.BaseModule).toBe("Tootega.SYS");
    });

    /** Base do próprio modelo não se qualifica: mesmo namespace, nome curto basta. */
    it("base local não publica namespace", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxAuditavel";

        expect(Montar().Tables.find(t => t.Name === "VNDxPedido")!.BaseModule).toBe("");
    });

    /**
     * Modelo importado do PRÓPRIO módulo devolve o namespace daqui. Qualificar nesse caso só
     * encomprida a linha: a classe base nasce no mesmo namespace da filha.
     */
    it("base de modelo importado do mesmo módulo não se qualifica", () => {
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxBase";

        const tabela = Montar([{
            Name: "VNDxBase",
            Inheritance: "",
            Module: "Acme.VND",
            Fields: [CampoExterno("CriadoEm", { DataType: "DateTime", Length: 0 })]
        }]).Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.BaseModule).toBe("");
    });

    /**
     * Só a base IMEDIATA vira classe-mãe. O ancestral distante chega achatado em colunas, e
     * publicar o módulo DELE faria a filha herdar a classe errada.
     */
    it("o módulo publicado é o da base imediata, não o do ancestral", () => {
        const local = CriarTabela("VNDxVersionavel", ["Origem"]);
        local.Inheritance = "SYSxAuditavel";
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxVersionavel";

        const tabela = Montar([{
            Name: "SYSxAuditavel",
            Inheritance: "",
            Module: "Tootega.SYS",
            Fields: [CampoExterno("CriadoEm", { DataType: "DateTime", Length: 0 })]
        }]).Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Inheritance).toBe("VNDxVersionavel");
        expect(tabela.BaseModule).toBe("");
    });

    /**
     * Sem as tabelas externas a cadeia simplesmente para, e a tabela sai com MENOS colunas do
     * que o modelo declara. É por isso que a base não resolvida vira erro na validação: o
     * gerador não tem como saber que faltou algo.
     */
    it("base externa não informada some da geração, sem quebrar", () => {
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "SYSxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Fields.map(f => f.Name)).toEqual(["VNDxPedidoID", "Numero"]);
    });

    /**
     * A coluna de posse pode vir da base: é justamente o caso de uma tabela-modelo com o
     * inquilino. Não enxergá-la ali deixaria a entidade de fora do filtro multi-tenant.
     */
    it("posse por inquilino herdada conta como posse", () => {
        design.TenantControlTable = "SYSxInquilino";
        CriarTabela("VNDxAuditavel", ["SYSxInquilinoID"]);
        const filha = CriarTabela("VNDxPedido");
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.HasTenant).toBe(true);
        expect(tabela.TenantColumn).toBe("SYSxInquilinoID");
    });

    /**
     * Quem participa de hierarquia é entidade. Sem esta regra, um catálogo de chave Int16 com
     * duas colunas de texto que herda auditoria seria lido como enum e geraria membro de enum
     * a partir de linhas que não são domínio fechado.
     */
    it("tabela que herda não é deduzida como lookup", () => {
        CriarTabela("VNDxAuditavel", ["CriadoEm"]);

        const catalogo = design.CreateTable({ Name: "VNDxTipo" });
        catalogo.CreatePKField({ Name: "VNDxTipoID", DataType: "Int16" });
        catalogo.CreateField({ Name: "Valor", DataType: "String", Length: 40 });
        catalogo.Inheritance = "VNDxAuditavel";

        expect(Montar().Tables.find(t => t.Name === "VNDxTipo")!.Stereotype).toBe("Entity");
    });
});

describe("tabela-modelo não gera", () => {

    let doc: XORMDocument;
    let design: XORMDesign;

    beforeEach(() => {
        doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
        design.Namespace = "Acme.VND";
    });

    function CriarTabela(pNome: string, pCampos: string[] = []) {
        const t = design.CreateTable({ Name: pNome });
        t.CreatePKField({ Name: `${pNome}ID`, DataType: "Int64" });
        for (const nome of pCampos)
            t.CreateField({ Name: nome, DataType: "String", Length: 60 });
        return t;
    }

    const Montar = () => BuildCodeModel(doc, { Resolver: Resolver(), Namespace: "Acme.VND" });

    /**
     * A tabela-modelo existe para ser herdada. Gerá-la duplicaria no banco exatamente as
     * colunas que ela já emprestou a cada filha, e criaria uma migração para uma tabela que
     * ninguém consulta.
     */
    it("some das tabelas geradas", () => {
        const base = CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        base.IsModel = true;
        CriarTabela("VNDxPedido", ["Numero"]);

        const modelo = Montar();

        expect(modelo.Tables.map(t => t.Name)).toEqual(["VNDxPedido"]);
        expect(modelo.Entities.map(t => t.Name)).toEqual(["VNDxPedido"]);
    });

    it("mas seus campos continuam chegando a quem a herda", () => {
        const base = CriarTabela("VNDxAuditavel", ["CriadoEm"]);
        base.IsModel = true;
        const filha = CriarTabela("VNDxPedido", ["Numero"]);
        filha.Inheritance = "VNDxAuditavel";

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;

        expect(tabela.Fields.map(f => f.Name)).toEqual(["VNDxPedidoID", "Numero", "CriadoEm"]);
    });

    it("tabela comum continua gerando", () => {
        CriarTabela("VNDxPedido", ["Numero"]);

        expect(Montar().Tables.map(t => t.Name)).toEqual(["VNDxPedido"]);
    });
});
