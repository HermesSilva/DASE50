import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XTypeResolver, BuildCodeModel, XCodeGenerator } from "../src/CodeGen/index.js";
import { XConfigResources } from "../src/Config/XConfigResources.js";

RegisterORMElements();
const engine = XSerializationEngine.Instance;
const Resolver = () => new XTypeResolver(XConfigResources.GetORMDataType().Types, "csharp-efcore");

// O gerador roda contra os templates REAIS desta pasta versionada — é o que garante que as mudanças
// (Entity.tpl implementando a interface; CacheRegistro.tpl gerando o registro) estão de fato cobertas.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "Templates", "TootegaERP", "csharp-efcore");
function GeradorDeEntidade(): XCodeGenerator {
    const templates = new Map<string, string>([
        ["Entity.tpl", readFileSync(join(RAIZ, "Entity.tpl"), "utf-8")],
        ["_Header.tpl", readFileSync(join(RAIZ, "_Header.tpl"), "utf-8")],
    ]);
    const perfil = {
        Id: "csharp-efcore",
        Artifacts: [{
            Id: "entity",
            Scope: "Table" as const,
            Where: 'Stereotype == "Entity"',
            Template: "Entity.tpl",
            Output: "Entidades/{{ Table.Name }}.Design.cs",
        }],
    };
    return new XCodeGenerator(perfil as never, templates);
}

// Gerador do registro de cache (escopo Model): usa o CacheRegistro.tpl real.
function GeradorDeRegistro(): XCodeGenerator {
    const templates = new Map<string, string>([
        ["CacheRegistro.tpl", readFileSync(join(RAIZ, "CacheRegistro.tpl"), "utf-8")],
        ["_Header.tpl", readFileSync(join(RAIZ, "_Header.tpl"), "utf-8")],
    ]);
    const perfil = {
        Id: "csharp-efcore",
        Artifacts: [{
            Id: "cache-registro",
            Scope: "Model" as const,
            Template: "CacheRegistro.tpl",
            Output: "{{ Model.Prefix }}CacheRegistro.Design.cs",
        }],
    };
    return new XCodeGenerator(perfil as never, templates);
}

describe("IsCached — propriedade da tabela", () => {

    it("uma tabela nova NÃO fica em cache por padrão", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        expect(doc.Design.CreateTable({ Name: "T" }).IsCached).toBe(false);
    });

    /** Default não é gravado: não sujar o diff dos modelos existentes. */
    it("não escreve IsCached quando está no default", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.CreateTable({ Name: "T" });

        expect(engine.Serialize(doc).XmlOutput ?? "").not.toContain("IsCached");
    });

    it("escreve e relê IsCached quando difere do default", () => {
        const doc = new XORMDocument();
        doc.Initialize();
        doc.Design.CreateTable({ Name: "T" }).IsCached = true;

        const xml = engine.Serialize(doc).XmlOutput ?? "";
        expect(xml).toContain("IsCached");

        const relido = engine.Deserialize<XORMDocument>(xml).Data!;
        expect(relido.Design.GetTables()[0].IsCached).toBe(true);
    });
});

describe("IsCached — projeção no code model", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
        design.Namespace = "Acme.VND";
    });

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

    function CriarEntidade(pNome: string): XORMTable {
        const t = design.CreateTable({ Name: pNome, X: 0, Y: 0 });
        t.Name = pNome;
        const pk = t.CreatePKField({ Name: `${pNome}ID`, DataType: "Guid" });
        pk.Name = `${pNome}ID`;
        t.CreateField({ Name: "Nome", DataType: "String", Length: 60 });
        return t;
    }

    it("entidade marcada projeta IsCached=true; entidade normal, false", () => {
        CriarEntidade("VNDxClienteFiscal").IsCached = true;
        CriarEntidade("VNDxPedido");

        const modelo = Montar();
        const cacheada = modelo.Tables.find(t => t.Name === "VNDxClienteFiscal")!;
        const comum = modelo.Tables.find(t => t.Name === "VNDxPedido")!;

        expect(cacheada.IsCached).toBe(true);
        expect(comum.IsCached).toBe(false);
    });

    /** Espelho lê a tabela alheia; quem cacheia é o módulo dono. A marca não vaza para o espelho. */
    it("um espelho NUNCA sai como cacheado", () => {
        const t = design.CreateTable({ Name: "SYSxInquilino", X: 400, Y: 0 });
        t.Name = "SYSxInquilino";
        t.IsShadow = true;
        t.ShadowTableName = "SYSxInquilino";
        t.ShadowModuleName = "Tootega.SYS";
        t.IsCached = true; // ainda que alguém marque, o espelho não carrega a marca
        const pk = t.CreatePKField({ Name: "SYSxInquilinoID", DataType: "Guid" });
        pk.Name = "SYSxInquilinoID";

        expect(Montar().Mirrors[0].IsCached).toBe(false);
    });

    it("o Entity.tpl implementa XIEntidadeEmCache<Self> e gera ChaveDeCache pela PK", () => {
        CriarEntidade("VNDxClienteFiscal").IsCached = true;

        const saida = GeradorDeEntidade().Generate(Montar());
        const arquivo = saida.find(a => a.Path.includes("VNDxClienteFiscal"))!;

        expect(arquivo.Content).toContain("Tootega.Core.Data.XIEntidadeEmCache<VNDxClienteFiscal>");
        expect(arquivo.Content).toContain("ChaveDeCache => VNDxClienteFiscalID");
    });

    it("entidade não cacheada não menciona a interface de cache", () => {
        CriarEntidade("VNDxPedido");

        const saida = GeradorDeEntidade().Generate(Montar());
        const arquivo = saida.find(a => a.Path.includes("VNDxPedido"))!;

        expect(arquivo.Content).not.toContain("XIEntidadeEmCache");
    });

    it("Model.Cached traz só as marcadas", () => {
        CriarEntidade("VNDxTabelaFiscal").IsCached = true;
        CriarEntidade("VNDxOutraRef").IsCached = true;
        CriarEntidade("VNDxPedido");

        const nomes = Montar().Cached.map(t => t.Name).sort();
        expect(nomes).toEqual(["VNDxOutraRef", "VNDxTabelaFiscal"]);
    });
});

describe("CacheRegistro.tpl — registro automático no DI", () => {

    let design: XORMDesign;

    beforeEach(() => {
        const doc = new XORMDocument();
        doc.Initialize();
        design = doc.Design;
        design.Namespace = "Acme.VND";
    });

    function Montar() {
        const doc = design.ParentNode as unknown as XORMDocument;
        return BuildCodeModel(doc, {
            Resolver: Resolver(),
            Namespace: "Acme.VND",
            Projects: { Infra: "Acme.VND.Infra", Common: "Acme.VND.Common" },
            ProjectSuffixes: ["Infra", "Common"],
        });
    }

    function CriarEntidade(pNome: string): XORMTable {
        const t = design.CreateTable({ Name: pNome, X: 0, Y: 0 });
        t.Name = pNome;
        const pk = t.CreatePKField({ Name: `${pNome}ID`, DataType: "Int64" });
        pk.Name = `${pNome}ID`;
        return t;
    }

    it("referência global entra como RegistrarReferencia, com o carregador AsNoTracking", () => {
        CriarEntidade("VNDxCFOP").IsCached = true;

        const saida = GeradorDeRegistro().Generate(Montar());
        const reg = saida[0].Content;

        expect(reg).toContain("public static class VNDxCacheRegistro");
        expect(reg).toContain("AddCacheVND");
        expect(reg).toContain("XCacheEntidade.RegistrarReferencia<VNDxCFOP>(pServicos, CarregarVNDxCFOP)");
        expect(reg).toContain("Set<VNDxCFOP>().AsNoTracking().ToList()");
    });

    it("entidade com posse por inquilino entra como RegistrarPorInquilino, com o seletor de tenant", () => {
        design.TenantControlTable = "SYSxInquilino";
        const t = CriarEntidade("VNDxRegraTributaria");
        t.IsCached = true;
        t.CreateField({ Name: "SYSxInquilinoID", DataType: "Guid" });

        const saida = GeradorDeRegistro().Generate(Montar());
        const reg = saida[0].Content;

        expect(reg).toContain("RegistrarPorInquilino<VNDxRegraTributaria>(pServicos, CarregarVNDxRegraTributaria, e => e.SYSxInquilinoID)");
    });

    it("sem tabela cacheada, o registro ainda nasce vazio e válido (AddCache no-op)", () => {
        CriarEntidade("VNDxPedido");

        const saida = GeradorDeRegistro().Generate(Montar());
        const reg = saida[0].Content;

        expect(reg).toContain("AddCacheVND");
        expect(reg).not.toContain("RegistrarReferencia");
        expect(reg).not.toContain("RegistrarPorInquilino");
    });
});
