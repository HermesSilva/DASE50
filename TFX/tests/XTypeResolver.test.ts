import { describe, it, expect } from "vitest";
import { XTypeResolver, XTypeResolverError } from "../src/CodeGen/index.js";
import { XConfigResources } from "../src/Config/XConfigResources.js";

const Tipos = () => XConfigResources.GetORMDataType().Types;
const R = () => new XTypeResolver(Tipos(), "csharp-efcore");

describe("resolução de tipo", () => {

    it("resolve String com tamanho como no TootegaERP", () => {
        expect(R().Resolve({ DataType: "String", Length: 160, IsRequired: true }))
            .toMatchObject({ Type: "string", ColumnType: "VarChar(160)", Init: '""' });
    });

    it("usa a forma max quando não há tamanho", () => {
        expect(R().Resolve({ DataType: "String", IsRequired: true }).ColumnType).toBe("VarCharMax()");
        expect(R().Resolve({ DataType: "Binary", IsRequired: true }).ColumnType).toBe("VarBinaryMax()");
        expect(R().Resolve({ DataType: "Binary", Length: 32, IsRequired: true }).ColumnType).toBe("VarBinary(32)");
    });

    it("resolve Numeric com precisão e escala", () => {
        expect(R().Resolve({ DataType: "Numeric", Length: 19, Scale: 4, IsRequired: true }))
            .toMatchObject({ Type: "decimal", ColumnType: "Decimal(19,4)" });
    });

    it("resolve Guid e Int16 sem parâmetro", () => {
        expect(R().Resolve({ DataType: "Guid", IsRequired: true }).ColumnType).toBe("UniqueIdentifier()");
        expect(R().Resolve({ DataType: "Int16", IsRequired: true }).ColumnType).toBe("SmallInt()");
    });

    it("usa o tipo anulável quando o campo não é obrigatório", () => {
        const r = R().Resolve({ DataType: "Guid", IsRequired: false });
        expect(r.Type).toBe("Guid?");
        expect(r.BaseType).toBe("Guid");
    });

    it("não põe sentinela em campo anulável", () => {
        expect(R().Resolve({ DataType: "String", Length: 40, IsRequired: false }).Init).toBe("");
        expect(R().Resolve({ DataType: "String", Length: 40, IsRequired: true }).Init).toBe('""');
    });
});

describe("literais de seed", () => {

    it("formata conforme o tipo", () => {
        const r = R();
        expect(r.FormatLiteral("String", "Tootega")).toBe('"Tootega"');
        expect(r.FormatLiteral("Guid", "69f9352d-0d5e-4354-b634-99683f13cf72"))
            .toBe('new("69f9352d-0d5e-4354-b634-99683f13cf72")');
        expect(r.FormatLiteral("Numeric", "10.5")).toBe("10.5m");
        expect(r.FormatLiteral("Int16", "3")).toBe("3");
    });

    it("emite verbatim o valor prefixado por = (expressão de código)", () => {
        expect(R().FormatLiteral("Guid", "=SYSxCidade.NaoInformadoID")).toBe("SYSxCidade.NaoInformadoID");
    });
});

describe("falhas", () => {

    it("recusa tipo inexistente em vez de adivinhar", () => {
        expect(() => R().Resolve({ DataType: "Inventado" })).toThrow(XTypeResolverError);
    });

    it("recusa perfil sem mapeamento", () => {
        const r = new XTypeResolver(Tipos(), "perfil-que-nao-existe");
        expect(() => r.Resolve({ DataType: "String", Length: 10 })).toThrow(/Mappings/);
    });

    it("lista os tipos sem mapeamento para o perfil", () => {
        expect(R().GetUnmappedTypes()).toEqual([]);
        expect(new XTypeResolver(Tipos(), "outro").GetUnmappedTypes().length).toBe(Tipos().length);
    });
});

describe("coluna por provider", () => {

    it("escolhe o provider pedido e cai no Default quando não há", () => {
        const tipos = [{
            TypeName: "String", CanUseInPK: false, HasLength: true, HasScale: false,
            CanUseInIndex: true, IsUTF8: true, CanAutoIncrement: false,
            Mappings: {
                "ts-prisma": {
                    Type: "String",
                    Column: { Default: "varchar({Length})", Sqlite: "TEXT" }
                }
            }
        }];

        expect(new XTypeResolver(tipos, "ts-prisma", "Sqlite")
            .Resolve({ DataType: "String", Length: 50 }).ColumnType).toBe("TEXT");

        expect(new XTypeResolver(tipos, "ts-prisma", "PostgreSQL")
            .Resolve({ DataType: "String", Length: 50 }).ColumnType).toBe("varchar(50)");
    });
});

describe("cobertura do catálogo", () => {

    it("todo tipo do ORM.Types.json embarcado tem mapeamento csharp-efcore utilizável", () => {
        const r = R();
        for (const t of Tipos())
            expect(() => r.Resolve({ DataType: t.TypeName, Length: t.HasLength ? 10 : 0, Scale: t.HasScale ? 2 : 0 }))
                .not.toThrow();
    });
});
