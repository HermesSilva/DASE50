/**
 * Filtros padrão dos templates de geração.
 *
 * Um filtro é a única forma de transformar valor dentro de um template — não há chamada de
 * função arbitrária. Por isso o conjunto cobre o que a geração de código realmente precisa:
 * caixa de identificadores, texto, listas e recuo.
 */

import type { XTemplateFilter } from "./XTemplateExpression.js";

const Texto = (pValor: unknown): string => pValor === null || pValor === undefined ? "" : String(pValor);

/** Quebra um identificador em palavras, aceitando PascalCase, camelCase, snake_case e kebab-case. */
function Palavras(pTexto: string): string[]
{
    return pTexto
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .split(/[^A-Za-z0-9]+/)
        .filter(p => p.length > 0);
}

/** Remove diacríticos: "Período" → "Periodo". Necessário para virar identificador. */
function SemAcento(pTexto: string): string
{
    return pTexto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export const XDefaultFilters: Record<string, XTemplateFilter> = {

    // ── caixa ─────────────────────────────────────────────────────────────────

    pascal: v => Palavras(SemAcento(Texto(v))).map(p => p[0].toUpperCase() + p.slice(1)).join(""),

    camel: v => {
        const partes = Palavras(SemAcento(Texto(v))).map(p => p[0].toUpperCase() + p.slice(1));
        if (partes.length === 0) return "";
        return partes[0][0].toLowerCase() + partes[0].slice(1) + partes.slice(1).join("");
    },

    snake: v => Palavras(SemAcento(Texto(v))).map(p => p.toLowerCase()).join("_"),
    kebab: v => Palavras(SemAcento(Texto(v))).map(p => p.toLowerCase()).join("-"),
    upper: v => Texto(v).toUpperCase(),
    lower: v => Texto(v).toLowerCase(),

    /** Primeira letra maiúscula, resto intacto — diferente de `pascal`, que reescreve tudo. */
    capitalize: v => { const s = Texto(v); return s ? s[0].toUpperCase() + s.slice(1) : ""; },

    unaccent: v => SemAcento(Texto(v)),

    // ── texto ─────────────────────────────────────────────────────────────────

    trim: v => Texto(v).trim(),

    /**
     * Recua todas as linhas MENOS a primeira. É o que se quer ao interpolar um bloco já
     * posicionado pelo template: `        {{ bloco | indent 8 }}`.
     */
    indent: (v, n) => {
        const espacos = " ".repeat(Number(n ?? 4));
        return Texto(v).split("\n").map((linha, i) => i === 0 || linha === "" ? linha : espacos + linha).join("\n");
    },

    /** Prefixa toda linha não vazia — usado para comentários de várias linhas. */
    prefix: (v, p) => Texto(v).split("\n").map(l => l === "" ? l : Texto(p) + l).join("\n"),

    replace: (v, de, para) => Texto(v).split(Texto(de)).join(Texto(para)),

    /** Escapa aspas e barras para caber num literal de string de C#/Java/TS. */
    escape: v => Texto(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, ""),

    /** Remove um prefixo, se presente: "SYSxInquilino" | strip_prefix "SYSx" → "Inquilino". */
    strip_prefix: (v, p) => { const s = Texto(v), q = Texto(p); return s.startsWith(q) ? s.slice(q.length) : s; },

    /** Remove um sufixo, se presente: "SYSxInquilinoID" | strip_suffix "ID" → "SYSxInquilino". */
    strip_suffix: (v, s) => { const t = Texto(v), q = Texto(s); return t.endsWith(q) ? t.slice(0, -q.length) : t; },

    default: (v, alt) => (v === null || v === undefined || v === "") ? alt : v,

    // ── listas ────────────────────────────────────────────────────────────────

    join: (v, sep) => Array.isArray(v) ? v.map(Texto).join(Texto(sep ?? ", ")) : Texto(v),
    first: v => Array.isArray(v) ? v[0] : undefined,
    last: v => Array.isArray(v) ? v[v.length - 1] : undefined,
    count: v => Array.isArray(v) ? v.length : Texto(v).length,
    reverse: v => Array.isArray(v) ? [...v].reverse() : Texto(v).split("").reverse().join(""),

    /** `Fields | where "IsPrimaryKey" true` — filtra por igualdade de propriedade. */
    where: (v, prop, valor) => {
        if (!Array.isArray(v)) return [];
        const chave = Texto(prop);
        const alvo = valor === undefined ? true : valor;
        return v.filter(item => (item as Record<string, unknown>)?.[chave] === alvo);
    },

    /** `Fields | where_not "IsShadow" true` — o complemento de `where`. */
    where_not: (v, prop, valor) => {
        if (!Array.isArray(v)) return [];
        const chave = Texto(prop);
        const alvo = valor === undefined ? true : valor;
        return v.filter(item => (item as Record<string, unknown>)?.[chave] !== alvo);
    },

    /** Projeta uma propriedade de cada item: `Fields | pluck "Name"`. */
    pluck: (v, prop) => Array.isArray(v) ? v.map(i => (i as Record<string, unknown>)?.[Texto(prop)]) : [],

    /**
     * Ordena por propriedade (ou pelo próprio valor). Estável e sem locale, porque a saída
     * precisa ser idêntica em qualquer máquina — geração é para o git.
     */
    sort: (v, prop) => {
        if (!Array.isArray(v)) return v;
        const chave = prop === undefined ? null : Texto(prop);
        const valor = (i: unknown) => chave === null ? i : (i as Record<string, unknown>)?.[chave];
        return [...v].sort((a, b) => {
            const x = valor(a), y = valor(b);
            if (x === y) return 0;
            return String(x) < String(y) ? -1 : 1;
        });
    },

    take: (v, n) => Array.isArray(v) ? v.slice(0, Number(n)) : v,
    skip: (v, n) => Array.isArray(v) ? v.slice(Number(n)) : v
};
