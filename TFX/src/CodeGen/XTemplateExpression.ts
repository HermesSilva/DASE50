/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                          TFX TEMPLATE — AVALIADOR DE EXPRESSÕES                               ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Mini-linguagem das tags {{ }}. Sintaxe no estilo Scriban/Liquid, deliberadamente pequena:    ║
 * ║  o suficiente para descrever geração de código, sem virar uma linguagem de programação.       ║
 * ║                                                                                               ║
 * ║    Caminho .......... Table.Name, Model.Vars.Namespace                                        ║
 * ║    Literal .......... "texto", 'texto', 123, true, false, null                                ║
 * ║    Índice ........... Table.Fields[0]                                                         ║
 * ║    Filtro ........... Table.Name | pascal | indent 8                                          ║
 * ║    Comparação ....... ==  !=  <  <=  >  >=                                                    ║
 * ║    Lógica ........... &&  ||  !                                                               ║
 * ║    Agrupamento ...... ( ... )                                                                 ║
 * ║                                                                                               ║
 * ║  NÃO há atribuição, chamada de função arbitrária nem acesso ao ambiente: um template não      ║
 * ║  executa código, só descreve saída. Toda transformação passa por um filtro registrado.        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */

/** Assinatura de um filtro: recebe o valor à esquerda do `|` e os argumentos declarados. */
export type XTemplateFilter = (pValue: unknown, ...pArgs: unknown[]) => unknown;

/**
 * Erro de template com localização. `Line` e `Source` são preenchidos por quem tem o
 * contexto (o parser de template sabe o arquivo e a linha); o avaliador de expressão
 * lança sem eles e o chamador enriquece.
 */
export class XTemplateError extends Error
{
    Line: number;
    Source: string;

    constructor(pMessage: string, pLine = 0, pSource = "")
    {
        super(pSource || pLine ? `${pSource}:${pLine}: ${pMessage}` : pMessage);
        this.name = "XTemplateError";
        this.Line = pLine;
        this.Source = pSource;
    }
}

// ── tokens ────────────────────────────────────────────────────────────────────

const enum XTokenKind
{
    Name, Number, String, Operator, End
}

interface XToken
{
    Kind: XTokenKind;
    Text: string;
}

const OPERADORES = ["==", "!=", "<=", ">=", "&&", "||", "(", ")", "[", "]", ".", "|", "!", "<", ">", ","];

function Tokenizar(pTexto: string): XToken[]
{
    const tokens: XToken[] = [];
    let i = 0;

    while (i < pTexto.length)
    {
        const c = pTexto[i];

        if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }

        if (c === '"' || c === "'")
        {
            const aspas = c;
            let valor = "";
            i++;
            while (i < pTexto.length && pTexto[i] !== aspas)
            {
                if (pTexto[i] === "\\" && i + 1 < pTexto.length)
                {
                    const seguinte = pTexto[i + 1];
                    valor += seguinte === "n" ? "\n" : seguinte === "t" ? "\t" : seguinte;
                    i += 2;
                    continue;
                }
                valor += pTexto[i];
                i++;
            }
            i++;
            tokens.push({ Kind: XTokenKind.String, Text: valor });
            continue;
        }

        if (c >= "0" && c <= "9")
        {
            let valor = "";
            while (i < pTexto.length && /[0-9.]/.test(pTexto[i])) { valor += pTexto[i]; i++; }
            tokens.push({ Kind: XTokenKind.Number, Text: valor });
            continue;
        }

        if (/[A-Za-z_]/.test(c))
        {
            let valor = "";
            while (i < pTexto.length && /[A-Za-z0-9_]/.test(pTexto[i])) { valor += pTexto[i]; i++; }
            tokens.push({ Kind: XTokenKind.Name, Text: valor });
            continue;
        }

        const doisChars = pTexto.substr(i, 2);
        if (OPERADORES.includes(doisChars)) { tokens.push({ Kind: XTokenKind.Operator, Text: doisChars }); i += 2; continue; }
        if (OPERADORES.includes(c)) { tokens.push({ Kind: XTokenKind.Operator, Text: c }); i++; continue; }

        throw new XTemplateError(`caractere inesperado '${c}' na expressão: ${pTexto}`);
    }

    tokens.push({ Kind: XTokenKind.End, Text: "" });
    return tokens;
}

// ── árvore de expressão ───────────────────────────────────────────────────────

export type XExprNode =
    | { T: "lit"; V: unknown }
    | { T: "path"; Parts: Array<{ Kind: "prop"; Name: string } | { Kind: "index"; Expr: XExprNode }> }
    | { T: "not"; E: XExprNode }
    | { T: "bin"; Op: string; L: XExprNode; R: XExprNode }
    | { T: "filter"; E: XExprNode; Name: string; Args: XExprNode[] };

/**
 * Analisador descendente recursivo. Precedência, do menos para o mais forte:
 *   ||  →  &&  →  comparação  →  filtro (|)  →  unário (!)  →  primário
 *
 * O filtro liga mais forte que comparação para que `{{ if a.Nome | upper == "X" }}`
 * signifique `(upper a.Nome) == "X"`, que é a leitura natural.
 */
class XExpressionParser
{
    private _Tokens: XToken[];
    private _Pos = 0;

    constructor(pTexto: string)
    {
        this._Tokens = Tokenizar(pTexto);
    }

    private get Atual(): XToken { return this._Tokens[this._Pos]; }

    private Consumir(pTexto?: string): XToken
    {
        const token = this._Tokens[this._Pos];
        if (pTexto !== undefined && token.Text !== pTexto)
            throw new XTemplateError(`esperava '${pTexto}' e veio '${token.Text}'`);
        this._Pos++;
        return token;
    }

    private Aceita(pTexto: string): boolean
    {
        if (this.Atual.Kind === XTokenKind.Operator && this.Atual.Text === pTexto) { this._Pos++; return true; }
        return false;
    }

    Parse(): XExprNode
    {
        const no = this.ParseOu();
        if (this.Atual.Kind !== XTokenKind.End)
            throw new XTemplateError(`sobrou '${this.Atual.Text}' no fim da expressão`);
        return no;
    }

    private ParseOu(): XExprNode
    {
        let esq = this.ParseE();
        while (this.Aceita("||")) esq = { T: "bin", Op: "||", L: esq, R: this.ParseE() };
        return esq;
    }

    private ParseE(): XExprNode
    {
        let esq = this.ParseComparacao();
        while (this.Aceita("&&")) esq = { T: "bin", Op: "&&", L: esq, R: this.ParseComparacao() };
        return esq;
    }

    private ParseComparacao(): XExprNode
    {
        let esq = this.ParseFiltro();
        for (;;)
        {
            const op = ["==", "!=", "<=", ">=", "<", ">"].find(o => this.Atual.Kind === XTokenKind.Operator && this.Atual.Text === o);
            if (!op) break;
            this.Consumir();
            esq = { T: "bin", Op: op, L: esq, R: this.ParseFiltro() };
        }
        return esq;
    }

    private ParseFiltro(): XExprNode
    {
        let esq = this.ParseUnario();

        while (this.Aceita("|"))
        {
            const nome = this.Consumir().Text;
            const args: XExprNode[] = [];

            // Argumentos sem parênteses, separados por espaço: `indent 8`, `replace "a" "b"`.
            // Param até encontrar algo que não possa iniciar um argumento.
            while (this.PodeIniciarArgumento()) args.push(this.ParsePrimario());

            esq = { T: "filter", E: esq, Name: nome, Args: args };
        }

        return esq;
    }

    private PodeIniciarArgumento(): boolean
    {
        const t = this.Atual;
        if (t.Kind === XTokenKind.Number || t.Kind === XTokenKind.String) return true;
        if (t.Kind === XTokenKind.Name) return true;
        return t.Kind === XTokenKind.Operator && t.Text === "(";
    }

    private ParseUnario(): XExprNode
    {
        if (this.Aceita("!")) return { T: "not", E: this.ParseUnario() };
        return this.ParsePrimario();
    }

    private ParsePrimario(): XExprNode
    {
        const t = this.Atual;

        if (t.Kind === XTokenKind.Number) { this.Consumir(); return { T: "lit", V: Number(t.Text) }; }
        if (t.Kind === XTokenKind.String) { this.Consumir(); return { T: "lit", V: t.Text }; }

        if (t.Kind === XTokenKind.Operator && t.Text === "(")
        {
            this.Consumir("(");
            const dentro = this.ParseOu();
            this.Consumir(")");
            return dentro;
        }

        if (t.Kind === XTokenKind.Name)
        {
            if (t.Text === "true") { this.Consumir(); return { T: "lit", V: true }; }
            if (t.Text === "false") { this.Consumir(); return { T: "lit", V: false }; }
            if (t.Text === "null") { this.Consumir(); return { T: "lit", V: null }; }

            const partes: Array<{ Kind: "prop"; Name: string } | { Kind: "index"; Expr: XExprNode }> = [];
            partes.push({ Kind: "prop", Name: this.Consumir().Text });

            for (;;)
            {
                if (this.Aceita(".")) { partes.push({ Kind: "prop", Name: this.Consumir().Text }); continue; }
                if (this.Aceita("[")) { partes.push({ Kind: "index", Expr: this.ParseOu() }); this.Consumir("]"); continue; }
                break;
            }

            return { T: "path", Parts: partes };
        }

        throw new XTemplateError(`não sei o que fazer com '${t.Text}'`);
    }
}

const _Cache = new Map<string, XExprNode>();

export function ParseExpression(pTexto: string): XExprNode
{
    const emCache = _Cache.get(pTexto);
    if (emCache) return emCache;

    const no = new XExpressionParser(pTexto).Parse();
    _Cache.set(pTexto, no);
    return no;
}

// ── avaliação ─────────────────────────────────────────────────────────────────

/** Falso apenas para: null, undefined, false, 0, "" e lista vazia. */
export function EhVerdadeiro(pValor: unknown): boolean
{
    if (pValor === null || pValor === undefined || pValor === false) return false;
    if (pValor === 0 || pValor === "") return false;
    if (Array.isArray(pValor)) return pValor.length > 0;
    return true;
}

export function AvaliarExpressao(
    pNo: XExprNode,
    pEscopo: Record<string, unknown>,
    pFiltros: Map<string, XTemplateFilter>
): unknown
{
    switch (pNo.T)
    {
        case "lit":
            return pNo.V;

        case "not":
            return !EhVerdadeiro(AvaliarExpressao(pNo.E, pEscopo, pFiltros));

        case "bin":
        {
            // Curto-circuito: o lado direito de && / || só é avaliado quando decide.
            if (pNo.Op === "&&")
            {
                const esq = AvaliarExpressao(pNo.L, pEscopo, pFiltros);
                return EhVerdadeiro(esq) ? EhVerdadeiro(AvaliarExpressao(pNo.R, pEscopo, pFiltros)) : false;
            }
            if (pNo.Op === "||")
            {
                const esq = AvaliarExpressao(pNo.L, pEscopo, pFiltros);
                return EhVerdadeiro(esq) ? true : EhVerdadeiro(AvaliarExpressao(pNo.R, pEscopo, pFiltros));
            }

            const a = AvaliarExpressao(pNo.L, pEscopo, pFiltros);
            const b = AvaliarExpressao(pNo.R, pEscopo, pFiltros);

            switch (pNo.Op)
            {
                case "==": return a === b;
                case "!=": return a !== b;
                case "<": return (a as number) < (b as number);
                case "<=": return (a as number) <= (b as number);
                case ">": return (a as number) > (b as number);
                case ">=": return (a as number) >= (b as number);
            }
            throw new XTemplateError(`operador desconhecido '${pNo.Op}'`);
        }

        case "filter":
        {
            const filtro = pFiltros.get(pNo.Name);
            if (!filtro) throw new XTemplateError(`filtro desconhecido '${pNo.Name}'`);
            const valor = AvaliarExpressao(pNo.E, pEscopo, pFiltros);
            const args = pNo.Args.map(a => AvaliarExpressao(a, pEscopo, pFiltros));
            return filtro(valor, ...args);
        }

        case "path":
        {
            let atual: unknown = pEscopo;

            for (const parte of pNo.Parts)
            {
                if (atual === null || atual === undefined) return undefined;

                if (parte.Kind === "index")
                {
                    const idx = AvaliarExpressao(parte.Expr, pEscopo, pFiltros);
                    atual = (atual as Record<string, unknown>)[String(idx)];
                    continue;
                }

                const alvo = atual as Record<string, unknown>;
                const bruto = alvo[parte.Name];

                // Propriedade acessora do TFX (get Name()) chega como valor; método fica de fora
                // de propósito — template não chama função.
                atual = typeof bruto === "function" ? undefined : bruto;
            }

            return atual;
        }
    }
}
