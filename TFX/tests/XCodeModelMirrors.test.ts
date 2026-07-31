import { describe, it, expect, beforeEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XTypeResolver, BuildCodeModel, XCodeGenerator, XCodeGenerationError } from "../src/CodeGen/index.js";
import { XConfigResources } from "../src/Config/XConfigResources.js";

RegisterORMElements();

const Resolver = () => new XTypeResolver(XConfigResources.GetORMDataType().Types, "csharp-efcore");

describe("tabelas espelho repetidas", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
        design.Namespace = "Acme.VND";
    });

    function CriarEspelho(pNome: string, pX: number, pY: number) {
        const t = design.CreateTable({ Name: pNome, X: pX, Y: pY });
        t.Name = pNome;
        t.IsShadow = true;
        t.ShadowTableName = pNome;
        t.ShadowDocumentName = "Back/Modules/Tootega.SYS/MER-SYS";
        t.ShadowModuleName = "Tootega.SYS";
        const pk = t.CreatePKField({ Name: `${pNome}ID`, DataType: "Guid" });
        pk.Name = `${pNome}ID`;
        return t;
    }

    function Montar() {
        const doc = design.ParentNode as unknown as XORMDocument;
        return BuildCodeModel(doc, {
            Resolver: Resolver(),
            Namespace: "Acme.VND",
            Projects: { Infra: "Acme.VND.Infra", Common: "Acme.VND.Common" },
            ProjectSuffixes: ["Infra", "Common"],
            OwnerNamespaces: { SYS: "Tootega.SYS" }
        });
    }

    /**
     * O mesmo espelho pode ser desenhado várias vezes — duas cópias de SYSxInquilino perto
     * de quem as referencia evitam atravessar o canvas com uma linha. São o mesmo espelho:
     * uma tabela, uma entidade, um DbSet. Sem a redução saíam arquivos duplicados e um
     * DbContext com o membro repetido, que nem compila.
     */
    it("várias cópias da mesma origem produzem um só espelho", () => {
        CriarEspelho("SYSxInquilino", 400, 0);
        CriarEspelho("SYSxInquilino", 400, 300);
        CriarEspelho("SYSxInquilino", 400, 600);

        const modelo = Montar();

        expect(modelo.Mirrors).toHaveLength(1);
        expect(modelo.Mirrors[0].Name).toBe("SYSxInquilino");
        expect(modelo.Tables.filter(t => t.Name === "SYSxInquilino")).toHaveLength(1);
    });

    it("espelhos de origens distintas continuam distintos", () => {
        CriarEspelho("SYSxInquilino", 400, 0);
        CriarEspelho("SYSxUsuario", 400, 300);

        expect(Montar().Mirrors.map(m => m.Name).sort()).toEqual(["SYSxInquilino", "SYSxUsuario"]);
    });

    /**
     * Uma FK desenhada contra qualquer das cópias tem de virar a MESMA referência em C#,
     * apontando para a entidade original — no padrão de espelho, o tipo local herda a do
     * módulo dono.
     */
    it("FK contra qualquer cópia aponta para a mesma entidade", () => {
        const a = CriarEspelho("SYSxInquilino", 400, 0);
        const b = CriarEspelho("SYSxInquilino", 400, 300);

        const pedido = design.CreateTable({ Name: "VNDxPedido" });
        pedido.CreatePKField({ Name: "VNDxPedidoID", DataType: "Int64" });

        for (const [i, alvo] of [a, b].entries()) {
            const fk = pedido.CreateField({ Name: `Inq${i}ID`, DataType: "Guid" });
            fk.Name = `Inq${i}ID`;
            design.CreateReference({ SourceFieldID: fk.ID, TargetTableID: alvo.ID });
        }

        const tabela = Montar().Tables.find(t => t.Name === "VNDxPedido")!;
        const alvos = tabela.ForeignKeys.map(f => f.TargetTable);

        expect(alvos).toEqual(["SYSxInquilino", "SYSxInquilino"]);
    });
});

describe("espelho só nasce de tabela shadow", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
        design.Namespace = "Acme.VND";
    });

    const Montar = () => BuildCodeModel(design.ParentNode as unknown as XORMDocument, {
        Resolver: Resolver(),
        Namespace: "Acme.VND",
        Projects: { Infra: "Acme.VND.Infra", Common: "Acme.VND.Common" },
        ProjectSuffixes: ["Infra", "Common"]
    });

    /**
     * Um espelho representa uma tabela cujo dono é outro módulo, e essa origem só existe
     * quando a tabela veio como shadow. Sem origem, o gerador não teria de quem herdar a
     * entidade nem que migração excluir — por isso declarar "Mirror" não basta.
     */
    it('declarar Stereotype "Mirror" numa tabela própria não a torna espelho', () => {
        const t = design.CreateTable({ Name: "VNDxPedido" });
        t.CreatePKField({ Name: "VNDxPedidoID", DataType: "Int64" });
        t.Stereotype = "Mirror";

        const modelo = Montar();

        expect(modelo.Mirrors).toHaveLength(0);
        expect(modelo.Tables[0].Stereotype).toBe("Entity");
    });

    it("tabela shadow é espelho mesmo sem Stereotype declarado", () => {
        const t = design.CreateTable({ Name: "SYSxInquilino" });
        t.Name = "SYSxInquilino";
        t.IsShadow = true;
        t.ShadowTableName = "SYSxInquilino";
        t.CreatePKField({ Name: "SYSxInquilinoID", DataType: "Guid" });

        expect(Montar().Mirrors).toHaveLength(1);
    });

    /**
     * O namespace do dono entra na herança da entidade espelho — `X : Tootega.SYS.Infra…X`.
     * Vazio ali sairia `.Infra.Persistencia.Entidades.X`, arquivo que nem compila, e é o que
     * acontecia quando o `.dsorm` do dono não declarava Namespace e o espelho tinha vindo de
     * um import antigo, sem ShadowModuleName. Na falta dos dois, vale a convenção de irmãos.
     */
    it("espelho sem dono resolvido cai na convenção de irmãos, nunca em vazio", () => {
        const t = design.CreateTable({ Name: "CRMxPessoa" });
        t.Name = "CRMxPessoa";
        t.IsShadow = true;
        t.ShadowTableName = "CRMxPessoa";
        t.CreatePKField({ Name: "CRMxPessoaID", DataType: "Int64" });

        expect(Montar().Mirrors[0].OwnerModule).toBe("Acme.CRM");
    });

    it("o que o espelho registrou vence a convenção", () => {
        const t = design.CreateTable({ Name: "CRMxPessoa" });
        t.Name = "CRMxPessoa";
        t.IsShadow = true;
        t.ShadowTableName = "CRMxPessoa";
        t.ShadowModuleName = "Outra.Casa.CRM";
        t.CreatePKField({ Name: "CRMxPessoaID", DataType: "Int64" });

        expect(Montar().Mirrors[0].OwnerModule).toBe("Outra.Casa.CRM");
    });

    it("Stereotype declarado não sobrepõe o shadow", () => {
        const t = design.CreateTable({ Name: "SYSxInquilino" });
        t.Name = "SYSxInquilino";
        t.IsShadow = true;
        t.ShadowTableName = "SYSxInquilino";
        t.Stereotype = "Lookup";
        t.CreatePKField({ Name: "SYSxInquilinoID", DataType: "Guid" });

        const modelo = Montar();

        expect(modelo.Mirrors).toHaveLength(1);
        expect(modelo.Lookups).toHaveLength(0);
    });
});

describe("colisão de caminho na geração", () => {

    /**
     * A checagem antiga só acusava artefatos DIFERENTES gravando no mesmo caminho, então um
     * artefato que repetisse o próprio caminho passava batido e o arquivo era sobrescrito
     * em silêncio.
     */
    it("acusa o mesmo artefato gerando duas vezes o mesmo arquivo", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.CreateTable({ Name: "A" });
        doc.Design.CreateTable({ Name: "B" });

        const modelo = BuildCodeModel(doc, { Resolver: Resolver(), Namespace: "X" });

        // Output sem nada que distinga uma tabela da outra.
        const perfil = {
            Id: "csharp-efcore",
            Artifacts: [{ Id: "entity", Scope: "Table" as const, Template: "E.tpl", Output: "saida/fixo.cs" }]
        };

        const gerador = new XCodeGenerator(perfil, new Map([["E.tpl", "// {{ Table.Name }}"]]));

        expect(() => gerador.Generate(modelo)).toThrow(XCodeGenerationError);
        expect(() => gerador.Generate(modelo)).toThrow(/duas vezes o mesmo arquivo/);
    });
});
