/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                              TFX TEMPLATE ENGINE                                              ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Motor de template para geração de código. Sintaxe no estilo Scriban/Liquid.                  ║
 * ║                                                                                               ║
 * ║    {{ expr }}                        interpola                                                ║
 * ║    {{~ expr ~}}                      idem, comendo o espaço em branco antes/depois            ║
 * ║    {{ if cond }} … {{ else if c }} … {{ else }} … {{ end }}                                   ║
 * ║    {{ for item in lista }} … {{ end }}                                                        ║
 * ║    {{ include "outro.tpl" }}         insere outro template no mesmo escopo                    ║
 * ║    {{# comentário #}}                não sai na saída                                         ║
 * ║                                                                                               ║
 * ║  Dentro de um `for` ficam disponíveis: `for.index` (base 0), `for.number` (base 1),           ║
 * ║  `for.first`, `for.last` e `for.count`.                                                       ║
 * ║                                                                                               ║
 * ║  DETERMINISMO: mesma entrada dá byte a byte a mesma saída. Não há acesso a relógio,           ║
 * ║  aleatoriedade, ambiente ou sistema de arquivos — `include` resolve por um mapa que o         ║
 * ║  chamador fornece. Código gerado vai para o git; instabilidade aqui polui todo commit.        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import {
    ParseExpression, AvaliarExpressao, EhVerdadeiro,
    XTemplateError, type XExprNode, type XTemplateFilter
} from "./XTemplateExpression.js";
import { XDefaultFilters } from "./XTemplateFilters.js";

// ── árvore do template ────────────────────────────────────────────────────────

type XNode =
    | { T: "text"; V: string }
    | { T: "interp"; E: XExprNode; Line: number }
    | { T: "if"; Ramos: Array<{ Cond: XExprNode | null; Corpo: XNode[] }>; Line: number }
    | { T: "for"; Var: string; Lista: XExprNode; Corpo: XNode[]; Line: number }
    | { T: "include"; Nome: XExprNode; Line: number };

interface XTag
{
    Texto: string;
    Linha: number;
    CortaAntes: boolean;
    CortaDepois: boolean;
}

/** Uma unidade do template: ou texto literal, ou uma tag. */
type XPedaco = { Kind: "text"; V: string } | { Kind: "tag"; Tag: XTag };

// ── análise léxica ────────────────────────────────────────────────────────────

function Fatiar(pTemplate: string, pNome: string): XPedaco[]
{
    const pedacos: XPedaco[] = [];
    let i = 0;
    let linha = 1;
    let textoAcumulado = "";

    const DespejarTexto = () => {
        if (textoAcumulado.length > 0) { pedacos.push({ Kind: "text", V: textoAcumulado }); textoAcumulado = ""; }
    };

    while (i < pTemplate.length)
    {
        const abre = pTemplate.indexOf("{{", i);

        if (abre < 0) { textoAcumulado += pTemplate.slice(i); break; }

        textoAcumulado += pTemplate.slice(i, abre);
        for (const c of pTemplate.slice(i, abre)) if (c === "\n") linha++;

        // Comentário {{# … #}} some por inteiro.
        if (pTemplate.startsWith("{{#", abre))
        {
            const fimC = pTemplate.indexOf("#}}", abre + 3);
            if (fimC < 0) throw new XTemplateError("comentário {{# sem #}}", linha, pNome);
            for (const c of pTemplate.slice(abre, fimC)) if (c === "\n") linha++;
            i = fimC + 3;
            continue;
        }

        const fecha = pTemplate.indexOf("}}", abre + 2);
        if (fecha < 0) throw new XTemplateError("tag {{ sem }}", linha, pNome);

        let corpo = pTemplate.slice(abre + 2, fecha);
        const cortaAntes = corpo.startsWith("~");
        if (cortaAntes) corpo = corpo.slice(1);
        const cortaDepois = corpo.endsWith("~");
        if (cortaDepois) corpo = corpo.slice(0, -1);

        DespejarTexto();
        pedacos.push({ Kind: "tag", Tag: { Texto: corpo.trim(), Linha: linha, CortaAntes: cortaAntes, CortaDepois: cortaDepois } });

        for (const c of pTemplate.slice(abre, fecha)) if (c === "\n") linha++;
        i = fecha + 2;
    }

    DespejarTexto();
    return pedacos;
}

/**
 * Aplica o controle de espaço em branco dos marcadores `~`.
 *
 * `{{~` remove espaços e tabs à ESQUERDA, sem tocar na quebra de linha anterior.
 * `~}}` remove espaços e tabs à DIREITA e mais a primeira quebra de linha.
 *
 * Combinados, fazem uma tag sozinha numa linha consumir a própria linha e nada além —
 * que é o que se quer ao escrever
 *
 *     class X
 *     {
 *     {{~ for f in Fs ~}}
 *         public {{ f.T }} {{ f.N }};
 *     {{~ end ~}}
 *     }
 *
 * e esperar uma declaração por linha, sem linha em branco e sem perder a quebra depois
 * do `{`. Cortar também a quebra à esquerda colaria tudo numa linha só.
 */
function AplicarCorte(pPedacos: XPedaco[]): XPedaco[]
{
    for (let i = 0; i < pPedacos.length; i++)
    {
        const p = pPedacos[i];
        if (p.Kind !== "tag") continue;

        if (p.Tag.CortaAntes)
        {
            const anterior = pPedacos[i - 1];
            if (anterior?.Kind === "text")
                anterior.V = anterior.V.replace(/[ \t]+$/, "");
        }

        if (p.Tag.CortaDepois)
        {
            const seguinte = pPedacos[i + 1];
            if (seguinte?.Kind === "text")
                seguinte.V = seguinte.V.replace(/^[ \t]*\r?\n/, "");
        }
    }

    return pPedacos;
}

// ── análise sintática ─────────────────────────────────────────────────────────

class XTemplateParser
{
    private _Pedacos: XPedaco[];
    private _Pos = 0;

    constructor(pTemplate: string, private readonly _Nome: string)
    {
        this._Pedacos = AplicarCorte(Fatiar(pTemplate, _Nome));
    }

    Parse(): XNode[]
    {
        const corpo = this.ParseBloco([]);
        if (this._Pos < this._Pedacos.length)
        {
            const p = this._Pedacos[this._Pos];
            const onde = p.Kind === "tag" ? p.Tag.Linha : 0;
            throw new XTemplateError(`'${p.Kind === "tag" ? p.Tag.Texto : ""}' sem bloco aberto`, onde, this._Nome);
        }
        return corpo;
    }

    /** Lê nós até encontrar uma das palavras de parada (que NÃO consome). */
    private ParseBloco(pParadas: string[]): XNode[]
    {
        const nos: XNode[] = [];

        while (this._Pos < this._Pedacos.length)
        {
            const p = this._Pedacos[this._Pos];

            if (p.Kind === "text") { nos.push({ T: "text", V: p.V }); this._Pos++; continue; }

            const palavra = p.Tag.Texto.split(/\s+/)[0];
            if (pParadas.includes(palavra)) return nos;

            this._Pos++;
            nos.push(this.ParseTag(p.Tag));
        }

        if (pParadas.length > 0)
            throw new XTemplateError(`faltou {{ end }} para fechar o bloco`, 0, this._Nome);

        return nos;
    }

    private ParseTag(pTag: XTag): XNode
    {
        const texto = pTag.Texto;
        const palavra = texto.split(/\s+/)[0];

        // Chegar aqui com um fechamento significa que não há bloco aberto para ele.
        // Sem esta guarda, `{{ end }}` solto viraria uma interpolação de nome `end`
        // e sairia silenciosamente como vazio.
        if (palavra === "end" || palavra === "else")
            throw new XTemplateError(`'${palavra}' sem bloco aberto`, pTag.Linha, this._Nome);

        try
        {
            if (palavra === "if")
            {
                const ramos: Array<{ Cond: XExprNode | null; Corpo: XNode[] }> = [];
                ramos.push({ Cond: ParseExpression(texto.slice(2).trim()), Corpo: this.ParseBloco(["else", "end"]) });

                for (;;)
                {
                    const atual = this._Pedacos[this._Pos];
                    if (!atual || atual.Kind !== "tag") throw new XTemplateError("if sem end", pTag.Linha, this._Nome);

                    if (atual.Tag.Texto === "end") { this._Pos++; break; }

                    // else / else if
                    const resto = atual.Tag.Texto.slice(4).trim();
                    this._Pos++;

                    if (resto.startsWith("if"))
                        ramos.push({ Cond: ParseExpression(resto.slice(2).trim()), Corpo: this.ParseBloco(["else", "end"]) });
                    else
                        ramos.push({ Cond: null, Corpo: this.ParseBloco(["end"]) });
                }

                return { T: "if", Ramos: ramos, Line: pTag.Linha };
            }

            if (palavra === "for")
            {
                const m = texto.match(/^for\s+(\w+)\s+in\s+(.+)$/s);
                if (!m) throw new XTemplateError(`for mal formado: '${texto}'`, pTag.Linha, this._Nome);

                const corpo = this.ParseBloco(["end"]);
                const fim = this._Pedacos[this._Pos];
                if (!fim || fim.Kind !== "tag" || fim.Tag.Texto !== "end")
                    throw new XTemplateError("for sem end", pTag.Linha, this._Nome);
                this._Pos++;

                return { T: "for", Var: m[1], Lista: ParseExpression(m[2].trim()), Corpo: corpo, Line: pTag.Linha };
            }

            if (palavra === "include")
                return { T: "include", Nome: ParseExpression(texto.slice(7).trim()), Line: pTag.Linha };

            return { T: "interp", E: ParseExpression(texto), Line: pTag.Linha };
        }
        catch (erro)
        {
            if (erro instanceof XTemplateError && erro.Line === 0)
                throw new XTemplateError(erro.message, pTag.Linha, this._Nome);
            throw erro;
        }
    }
}

// ── template compilado ────────────────────────────────────────────────────────

export class XCompiledTemplate
{
    constructor(readonly Name: string, readonly Nodes: XNode[]) {}
}

export interface XIRenderOptions
{
    /** Outros templates disponíveis a `{{ include "nome" }}`, por nome. */
    Partials?: Map<string, XCompiledTemplate>;
    /** Filtros adicionais ou substitutos dos padrão. */
    Filters?: Record<string, XTemplateFilter>;
}

export class XTemplateEngine
{
    private readonly _Filtros = new Map<string, XTemplateFilter>();
    private readonly _Cache = new Map<string, XCompiledTemplate>();

    constructor()
    {
        for (const [nome, fn] of Object.entries(XDefaultFilters)) this._Filtros.set(nome, fn);
    }

    RegisterFilter(pNome: string, pFiltro: XTemplateFilter): void
    {
        this._Filtros.set(pNome, pFiltro);
    }

    Compile(pTexto: string, pNome = "template"): XCompiledTemplate
    {
        const chave = `${pNome} ${pTexto}`;
        const emCache = this._Cache.get(chave);
        if (emCache) return emCache;

        const compilado = new XCompiledTemplate(pNome, new XTemplateParser(pTexto, pNome).Parse());
        this._Cache.set(chave, compilado);
        return compilado;
    }

    Render(pTexto: string, pDados: Record<string, unknown>, pOpcoes?: XIRenderOptions): string
    {
        return this.RenderCompiled(this.Compile(pTexto), pDados, pOpcoes);
    }

    RenderCompiled(pTemplate: XCompiledTemplate, pDados: Record<string, unknown>, pOpcoes?: XIRenderOptions): string
    {
        const filtros = new Map(this._Filtros);
        if (pOpcoes?.Filters)
            for (const [nome, fn] of Object.entries(pOpcoes.Filters)) filtros.set(nome, fn);

        const saida: string[] = [];
        this.Emitir(pTemplate.Nodes, pDados, filtros, pOpcoes?.Partials ?? new Map(), saida, pTemplate.Name, 0);
        return saida.join("");
    }

    // ── execução ──────────────────────────────────────────────────────────────

    private Emitir(
        pNos: XNode[],
        pEscopo: Record<string, unknown>,
        pFiltros: Map<string, XTemplateFilter>,
        pPartials: Map<string, XCompiledTemplate>,
        pSaida: string[],
        pNome: string,
        pProfundidade: number
    ): void
    {
        // Um include circular consumiria a pilha; 50 níveis é mais do que qualquer
        // hierarquia de template legítima e falha com mensagem em vez de estouro.
        if (pProfundidade > 50)
            throw new XTemplateError("include aninhado demais (ciclo?)", 0, pNome);

        for (const no of pNos)
        {
            switch (no.T)
            {
                case "text":
                    pSaida.push(no.V);
                    break;

                case "interp":
                {
                    const valor = this.Avaliar(no.E, pEscopo, pFiltros, no.Line, pNome);
                    if (valor !== null && valor !== undefined && valor !== false)
                        pSaida.push(Array.isArray(valor) ? valor.join("") : String(valor));
                    break;
                }

                case "if":
                {
                    for (const ramo of no.Ramos)
                    {
                        const entra = ramo.Cond === null
                            || EhVerdadeiro(this.Avaliar(ramo.Cond, pEscopo, pFiltros, no.Line, pNome));

                        if (entra)
                        {
                            this.Emitir(ramo.Corpo, pEscopo, pFiltros, pPartials, pSaida, pNome, pProfundidade);
                            break;
                        }
                    }
                    break;
                }

                case "for":
                {
                    const bruto = this.Avaliar(no.Lista, pEscopo, pFiltros, no.Line, pNome);
                    if (bruto === null || bruto === undefined) break;

                    const itens = Array.isArray(bruto) ? bruto : [bruto];

                    for (let i = 0; i < itens.length; i++)
                    {
                        // Escopo filho por iteração: a variável do laço não vaza, e o pai
                        // continua visível por herança de protótipo (sem cópia).
                        const filho: Record<string, unknown> = Object.create(pEscopo);
                        filho[no.Var] = itens[i];
                        filho["for"] = {
                            index: i,
                            number: i + 1,
                            first: i === 0,
                            last: i === itens.length - 1,
                            count: itens.length
                        };

                        this.Emitir(no.Corpo, filho, pFiltros, pPartials, pSaida, pNome, pProfundidade);
                    }
                    break;
                }

                case "include":
                {
                    const alvo = String(this.Avaliar(no.Nome, pEscopo, pFiltros, no.Line, pNome) ?? "");
                    const parcial = pPartials.get(alvo);
                    if (!parcial)
                        throw new XTemplateError(`include não encontrado: '${alvo}'`, no.Line, pNome);

                    this.Emitir(parcial.Nodes, pEscopo, pFiltros, pPartials, pSaida, parcial.Name, pProfundidade + 1);
                    break;
                }
            }
        }
    }

    private Avaliar(
        pNo: XExprNode,
        pEscopo: Record<string, unknown>,
        pFiltros: Map<string, XTemplateFilter>,
        pLinha: number,
        pNome: string
    ): unknown
    {
        try { return AvaliarExpressao(pNo, pEscopo, pFiltros); }
        catch (erro)
        {
            if (erro instanceof XTemplateError && erro.Line === 0)
                throw new XTemplateError(erro.message, pLinha, pNome);
            throw erro;
        }
    }
}
