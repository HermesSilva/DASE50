import { describe, it, expect } from "vitest";
import { XTemplateEngine } from "../src/CodeGen/index.js";

/**
 * Valida os exemplos publicados em `Templates/REFERENCIA.md` e `Templates/GUIA.md`.
 *
 * Documentação de template envelhece calada: alguém ajusta um filtro, o texto continua
 * dizendo o antigo, e quem escreve um perfil novo perde a tarde. Cada caso aqui é uma
 * afirmação daqueles arquivos — se o motor mudar, isto quebra antes de o leitor descobrir.
 */

const motor = new XTemplateEngine();
const R = (tpl: string, dados: Record<string, unknown> = {}) => motor.Render(tpl, dados);

describe("REFERENCIA.md — espaço em branco", () => {

    it("o exemplo do bloco com ~ produz exatamente o que está documentado", () => {
        const tpl =
            "class X\n{\n{{~ for F in Fs ~}}\n    public {{ F.T }} {{ F.N }};\n{{~ end ~}}\n}\n";

        expect(R(tpl, { Fs: [{ T: "int", N: "A" }, { T: "string", N: "B" }] }))
            .toBe("class X\n{\n    public int A;\n    public string B;\n}\n");
    });
});

describe("REFERENCIA.md — verdade", () => {

    it("lista vazia, zero e string vazia são falsos", () => {
        expect(R("{{ if xs }}s{{ else }}n{{ end }}", { xs: [] })).toBe("n");
        expect(R("{{ if n }}s{{ else }}n{{ end }}", { n: 0 })).toBe("n");
        expect(R("{{ if s }}s{{ else }}n{{ end }}", { s: "" })).toBe("n");
    });

    it("zero é falso na condição mas é escrito na interpolação", () => {
        expect(R("[{{ n }}]", { n: 0 })).toBe("[0]");
    });

    it("caminho inexistente sai vazio em vez de quebrar", () => {
        expect(R("[{{ a.b.c }}]", {})).toBe("[]");
    });

    it("método de objeto é ignorado — template não chama função", () => {
        expect(R("[{{ o.F }}]", { o: { F: () => "x" } })).toBe("[]");
    });
});

describe("REFERENCIA.md — for", () => {

    it("o idioma do separador não deixa sobra no fim", () => {
        expect(R("{{ for C in xs }}e.{{ C }}{{ if !for.last }}, {{ end }}{{ end }}", { xs: ["A", "B", "C"] }))
            .toBe("e.A, e.B, e.C");
    });

    it("expõe index, number, first, last e count", () => {
        expect(R("{{ for x in xs }}{{ for.index }}{{ for.number }}{{ for.count }}|{{ end }}", { xs: ["a", "b"] }))
            .toBe("012|122|");
        expect(R("{{ for x in xs }}{{ if for.first }}F{{ end }}{{ if for.last }}L{{ end }}{{ end }}", { xs: ["a", "b"] }))
            .toBe("FL");
    });

    it("a variável do laço não vaza", () => {
        expect(R("{{ for x in xs }}{{ end }}[{{ x }}]", { xs: [1] })).toBe("[]");
    });
});

describe("REFERENCIA.md — filtros de identificador", () => {

    it("converte caixa como documentado", () => {
        expect(R("{{ s | pascal }}", { s: "nome_do_campo" })).toBe("NomeDoCampo");
        expect(R("{{ s | camel }}", { s: "NomeDoCampo" })).toBe("nomeDoCampo");
        expect(R("{{ s | snake }}", { s: "NomeDoCampo" })).toBe("nome_do_campo");
        expect(R("{{ s | kebab }}", { s: "NomeDoCampo" })).toBe("nome-do-campo");
    });

    it("as conversões de caixa já removem acento", () => {
        expect(R("{{ s | pascal }}", { s: "Período de teste" })).toBe("PeriodoDeTeste");
        expect(R("{{ s | unaccent }}", { s: "Período" })).toBe("Periodo");
    });

    it("capitalize mexe só na primeira letra", () => {
        expect(R("{{ s | capitalize }}", { s: "nomeDoCampo" })).toBe("NomeDoCampo");
    });
});

describe("REFERENCIA.md — filtros de texto", () => {

    it("indent recua todas as linhas menos a primeira", () => {
        expect(R("{{ s | indent 4 }}", { s: "a\nb" })).toBe("a\n    b");
    });

    it("prefix marca cada linha", () => {
        expect(R('{{ s | prefix "// " }}', { s: "a\nb" })).toBe("// a\n// b");
    });

    it("escape prepara para literal de string", () => {
        expect(R("{{ s | escape }}", { s: 'diz "oi"' })).toBe('diz \\"oi\\"');
    });

    it("strip_prefix, strip_suffix, replace, trim e default", () => {
        expect(R('{{ s | strip_prefix "SYSx" }}', { s: "SYSxInquilino" })).toBe("Inquilino");
        expect(R('{{ s | strip_suffix "ID" }}', { s: "SYSxInquilinoID" })).toBe("SYSxInquilino");
        expect(R('{{ s | replace "a" "b" }}', { s: "aaa" })).toBe("bbb");
        expect(R("[{{ s | trim }}]", { s: "  x  " })).toBe("[x]");
        expect(R('{{ x | default "vazio" }}', {})).toBe("vazio");
    });
});

describe("REFERENCIA.md — filtros de lista", () => {

    const dados = { Fs: [{ N: "a", PK: true }, { N: "b", PK: false }] };

    it("where, where_not, pluck e join encadeiam", () => {
        expect(R('{{ Fs | where "PK" true | pluck "N" | join "," }}', dados)).toBe("a");
        expect(R('{{ Fs | where_not "PK" true | pluck "N" | join "," }}', dados)).toBe("b");
    });

    it("sort ordena com e sem propriedade", () => {
        expect(R('{{ xs | sort | join "," }}', { xs: ["c", "a", "b"] })).toBe("a,b,c");
        expect(R('{{ Fs | sort "N" | pluck "N" | join "," }}', dados)).toBe("a,b");
    });

    it("count, first, last, take, skip e reverse", () => {
        expect(R("{{ xs | count }}", { xs: [1, 2, 3] })).toBe("3");
        expect(R("{{ xs | first }}{{ xs | last }}", { xs: ["a", "z"] })).toBe("az");
        expect(R('{{ xs | take 2 | join "" }}', { xs: ["a", "b", "c"] })).toBe("ab");
        expect(R('{{ xs | skip 2 | join "" }}', { xs: ["a", "b", "c"] })).toBe("c");
        expect(R('{{ xs | reverse | join "" }}', { xs: ["a", "b"] })).toBe("ba");
    });
});

describe("REFERENCIA.md — sintaxe", () => {

    it("filtro liga mais forte que comparação", () => {
        expect(R('{{ if s | upper == "A" }}ok{{ end }}', { s: "a" })).toBe("ok");
    });

    it("else if encadeia", () => {
        const t = "{{ if n == 1 }}um{{ else if n == 2 }}dois{{ else }}n{{ end }}";
        expect(R(t, { n: 2 })).toBe("dois");
    });

    it("&& e || fazem curto-circuito", () => {
        expect(R("{{ if false && q }}x{{ else }}y{{ end }}", {})).toBe("y");
        expect(R("{{ if true || q }}x{{ else }}y{{ end }}", {})).toBe("x");
    });

    it("índice de lista e comentário", () => {
        expect(R("{{ xs[1] }}", { xs: ["a", "b"] })).toBe("b");
        expect(R("a{{# nada #}}b")).toBe("ab");
    });
});

describe("REFERENCIA.md — seed", () => {

    it("o idioma do membro de enum cobre o caso sem identificador", () => {
        const t = '{{ for R in S }}{{ if R.Member }}{{ R.Member }}{{ else }}{{ R.Raw["Valor"] | pascal }}{{ end }};{{ end }}';

        expect(R(t, {
            S: [
                { Member: "BRL", Raw: { Valor: "Real brasileiro" } },
                { Member: "", Raw: { Valor: "Em atraso" } }
            ]
        })).toBe("BRL;EmAtraso;");
    });
});

describe("GUIA.md — os templates do exemplo compilam e rodam", () => {

    it("Entity.tpl do guia produz a classe esperada", () => {
        const parciais = new Map([["_Header.tpl", motor.Compile("// gerado\n", "_Header.tpl")]]);

        const tpl =
            '{{ include "_Header.tpl" }}\n' +
            '@Entity("{{ Table.Name }}")\n' +
            "export class {{ Table.Name }} {\n" +
            "{{~ for F in Table.Fields ~}}\n" +
            "    @{{ if F.IsPrimaryKey }}PrimaryColumn{{ else }}Column{{ end }}({{ F.ColumnType }})\n" +
            "    {{ F.Name | camel }}!: {{ F.Type }};\n" +
            "{{~ end ~}}\n" +
            "}\n";

        const saida = motor.Render(tpl, {
            Table: {
                Name: "Cliente",
                Fields: [
                    { Name: "ClienteID", IsPrimaryKey: true, ColumnType: '{ type: "uuid" }', Type: "string" },
                    { Name: "Nome", IsPrimaryKey: false, ColumnType: '{ type: "varchar", length: 160 }', Type: "string" }
                ]
            }
        }, { Partials: parciais });

        expect(saida).toBe(
            "// gerado\n\n" +
            '@Entity("Cliente")\n' +
            "export class Cliente {\n" +
            '    @PrimaryColumn({ type: "uuid" })\n' +
            "    clienteID!: string;\n" +
            '    @Column({ type: "varchar", length: 160 })\n' +
            "    nome!: string;\n" +
            "}\n"
        );
    });

    it("Index.tpl do guia lista as entidades", () => {
        const tpl = '{{~ for T in Model.Entities ~}}\nexport * from "./{{ T.Name | kebab }}.entity";\n{{~ end ~}}';

        expect(motor.Render(tpl, { Model: { Entities: [{ Name: "ClienteFiel" }, { Name: "Pedido" }] } }))
            .toBe('export * from "./cliente-fiel.entity";\nexport * from "./pedido.entity";\n');
    });
});

describe("determinismo", () => {

    it("mesma entrada produz byte a byte a mesma saída", () => {
        const t = "{{~ for f in Fs ~}}\n{{ f.N | pascal }}\n{{~ end ~}}";
        const dados = { Fs: [{ N: "um_campo" }, { N: "outro_campo" }] };

        expect(motor.Render(t, dados)).toBe(motor.Render(t, dados));
    });
});
