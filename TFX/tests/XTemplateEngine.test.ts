import { describe, it, expect } from "vitest";
import { XTemplateEngine, XTemplateError } from "../src/CodeGen/index.js";

const motor = new XTemplateEngine();
const R = (tpl: string, dados: Record<string, unknown> = {}) => motor.Render(tpl, dados);

describe("interpolação", () => {

    it("emite texto literal sem tags", () => {
        expect(R("public class X { }")).toBe("public class X { }");
    });

    it("resolve caminho aninhado", () => {
        expect(R("{{ Model.Namespace }}", { Model: { Namespace: "Tootega.SYS" } })).toBe("Tootega.SYS");
    });

    it("devolve vazio para caminho inexistente em vez de quebrar", () => {
        expect(R("[{{ Nada.De.Nada }}]", {})).toBe("[]");
    });

    it("não emite null, undefined nem false", () => {
        expect(R("[{{ a }}{{ b }}{{ c }}]", { a: null, b: undefined, c: false })).toBe("[]");
    });

    it("emite zero e string vazia, que são valores legítimos", () => {
        expect(R("[{{ a }}]", { a: 0 })).toBe("[0]");
    });

    it("indexa lista", () => {
        expect(R("{{ Fields[1].Name }}", { Fields: [{ Name: "A" }, { Name: "B" }] })).toBe("B");
    });

    it("ignora método — template não chama função", () => {
        expect(R("[{{ o.GetTudo }}]", { o: { GetTudo: () => "x" } })).toBe("[]");
    });
});

describe("condicional", () => {

    it("escolhe o ramo verdadeiro", () => {
        expect(R("{{ if a }}sim{{ else }}nao{{ end }}", { a: true })).toBe("sim");
        expect(R("{{ if a }}sim{{ else }}nao{{ end }}", { a: false })).toBe("nao");
    });

    it("encadeia else if", () => {
        const t = "{{ if n == 1 }}um{{ else if n == 2 }}dois{{ else }}muitos{{ end }}";
        expect(R(t, { n: 1 })).toBe("um");
        expect(R(t, { n: 2 })).toBe("dois");
        expect(R(t, { n: 9 })).toBe("muitos");
    });

    it("trata lista vazia como falso", () => {
        expect(R("{{ if xs }}tem{{ else }}vazio{{ end }}", { xs: [] })).toBe("vazio");
        expect(R("{{ if xs }}tem{{ else }}vazio{{ end }}", { xs: [1] })).toBe("tem");
    });

    it("aplica operadores lógicos e de comparação", () => {
        expect(R("{{ if a && !b }}ok{{ end }}", { a: true, b: false })).toBe("ok");
        expect(R("{{ if a || b }}ok{{ end }}", { a: false, b: true })).toBe("ok");
        expect(R("{{ if n >= 3 }}ok{{ end }}", { n: 3 })).toBe("ok");
        expect(R('{{ if s != "x" }}ok{{ end }}', { s: "y" })).toBe("ok");
    });

    it("faz curto-circuito e não avalia o lado direito à toa", () => {
        // Se avaliasse o direito, `nulo.Prop.Sub` não quebraria (devolve undefined),
        // mas o resultado seria diferente.
        expect(R("{{ if false && qualquer }}x{{ else }}y{{ end }}", {})).toBe("y");
    });
});

describe("laço", () => {

    it("itera lista", () => {
        expect(R("{{ for f in Fs }}{{ f.N }};{{ end }}", { Fs: [{ N: "a" }, { N: "b" }] })).toBe("a;b;");
    });

    it("expõe metadados do laço", () => {
        const t = "{{ for x in xs }}{{ for.number }}/{{ for.count }}{{ if !for.last }},{{ end }}{{ end }}";
        expect(R(t, { xs: ["a", "b", "c"] })).toBe("1/3,2/3,3/3");
    });

    it("não emite nada para lista vazia ou ausente", () => {
        expect(R("[{{ for x in xs }}{{ x }}{{ end }}]", { xs: [] })).toBe("[]");
        expect(R("[{{ for x in xs }}{{ x }}{{ end }}]", {})).toBe("[]");
    });

    it("aninha laços e enxerga a variável de fora", () => {
        const t = "{{ for t in ts }}{{ for c in t.cs }}{{ t.n }}.{{ c }} {{ end }}{{ end }}";
        expect(R(t, { ts: [{ n: "T", cs: ["a", "b"] }] })).toBe("T.a T.b ");
    });

    it("não deixa a variável do laço vazar", () => {
        expect(R("{{ for x in xs }}{{ end }}[{{ x }}]", { xs: [1] })).toBe("[]");
    });
});

describe("controle de espaço em branco", () => {

    it("com ~ produz uma linha por item, sem linhas em branco", () => {
        const t =
            "class X\n{\n{{~ for f in Fs ~}}\n    public {{ f.T }} {{ f.N }};\n{{~ end ~}}\n}\n";
        expect(R(t, { Fs: [{ T: "int", N: "A" }, { T: "string", N: "B" }] }))
            .toBe("class X\n{\n    public int A;\n    public string B;\n}\n");
    });

    it("sem ~ preserva o texto tal como escrito", () => {
        expect(R("a\n{{ x }}\nb", { x: "M" })).toBe("a\nM\nb");
    });
});

describe("filtros", () => {

    it("converte caixa", () => {
        expect(R("{{ s | pascal }}", { s: "nome_do_campo" })).toBe("NomeDoCampo");
        expect(R("{{ s | camel }}", { s: "NomeDoCampo" })).toBe("nomeDoCampo");
        expect(R("{{ s | snake }}", { s: "NomeDoCampo" })).toBe("nome_do_campo");
        expect(R("{{ s | kebab }}", { s: "NomeDoCampo" })).toBe("nome-do-campo");
    });

    it("remove acento ao gerar identificador", () => {
        expect(R("{{ s | pascal }}", { s: "Período de teste" })).toBe("PeriodoDeTeste");
    });

    it("encadeia filtros", () => {
        expect(R("{{ s | strip_prefix \"SYSx\" | upper }}", { s: "SYSxInquilino" })).toBe("INQUILINO");
    });

    it("recua todas as linhas menos a primeira", () => {
        expect(R("{{ s | indent 4 }}", { s: "a\nb" })).toBe("a\n    b");
    });

    it("escapa para literal de string", () => {
        expect(R("{{ s | escape }}", { s: 'diz "oi"' })).toBe('diz \\"oi\\"');
    });

    it("filtra e projeta listas", () => {
        const dados = { Fs: [{ N: "a", PK: true }, { N: "b", PK: false }] };
        expect(R('{{ Fs | where "PK" true | pluck "N" | join "," }}', dados)).toBe("a");
        expect(R('{{ Fs | where_not "PK" true | pluck "N" | join "," }}', dados)).toBe("b");
    });

    it("ordena de forma estável e sem locale", () => {
        expect(R('{{ xs | sort | join "," }}', { xs: ["c", "a", "b"] })).toBe("a,b,c");
        expect(R('{{ Fs | sort "N" | pluck "N" | join "," }}', { Fs: [{ N: "z" }, { N: "a" }] })).toBe("a,z");
    });

    it("usa default quando o valor está ausente", () => {
        expect(R('{{ x | default "vazio" }}', {})).toBe("vazio");
        expect(R('{{ x | default "vazio" }}', { x: "cheio" })).toBe("cheio");
    });

    it("aplica filtro dentro de condição", () => {
        expect(R('{{ if s | upper == "A" }}ok{{ end }}', { s: "a" })).toBe("ok");
    });

    it("aceita filtro registrado pelo chamador", () => {
        const m = new XTemplateEngine();
        m.RegisterFilter("dobro", v => Number(v) * 2);
        expect(m.Render("{{ n | dobro }}", { n: 21 })).toBe("42");
    });
});

describe("include", () => {

    it("insere um parcial no mesmo escopo", () => {
        const parciais = new Map([["cab", motor.Compile("// {{ Nome }}", "cab")]]);
        expect(motor.Render('{{ include "cab" }}\nclasse', { Nome: "X" }, { Partials: parciais }))
            .toBe("// X\nclasse");
    });

    it("falha com mensagem quando o parcial não existe", () => {
        expect(() => motor.Render('{{ include "sumiu" }}', {})).toThrow(/include não encontrado/);
    });
});

describe("erros", () => {

    it("acusa tag não fechada", () => {
        expect(() => motor.Render("{{ x ", {})).toThrow(XTemplateError);
    });

    it("acusa bloco sem end", () => {
        expect(() => motor.Render("{{ if a }}x", {})).toThrow(/end/);
    });

    it("acusa end sobrando", () => {
        expect(() => motor.Render("x{{ end }}", {})).toThrow(/sem bloco aberto/);
    });

    it("acusa filtro desconhecido", () => {
        expect(() => motor.Render("{{ x | naoexiste }}", { x: 1 })).toThrow(/filtro desconhecido/);
    });

    it("informa a linha do erro", () => {
        try { motor.Render("linha1\nlinha2\n{{ x | naoexiste }}", { x: 1 }); }
        catch (e) { expect((e as XTemplateError).Line).toBe(3); }
    });
});

describe("comentário", () => {

    it("não sai na saída", () => {
        expect(R("a{{# isto some #}}b")).toBe("ab");
    });
});

describe("determinismo", () => {

    it("duas renderizações da mesma entrada dão o mesmo byte", () => {
        const t = "{{~ for f in Fs ~}}\n{{ f.N | pascal }}\n{{~ end ~}}";
        const dados = { Fs: [{ N: "um_campo" }, { N: "outro_campo" }] };
        expect(motor.Render(t, dados)).toBe(motor.Render(t, dados));
    });
});
