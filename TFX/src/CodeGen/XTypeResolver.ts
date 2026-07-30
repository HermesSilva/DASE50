/**
 * Resolve um campo do modelo na sua projeção concreta de código, a partir dos `Mappings`
 * declarados em `ORM.Types.json`.
 *
 * Um campo `String` com `Length = 160`, sob o perfil `csharp-efcore`, vira:
 *     Type       → "string"
 *     ColumnType → "VarChar(160)"
 *     Init       → "\"\""
 *
 * Sem mapeamento para o tipo, lança — nunca devolve um palpite. Código gerado errado em
 * silêncio custa muito mais caro que uma falha na hora de gerar.
 */

import type { XORMDataTypeInfo, XORMTypeMapping } from "../Config/XConfigurationTypes.js";

export class XTypeResolverError extends Error
{
    constructor(pMessage: string)
    {
        super(pMessage);
        this.name = "XTypeResolverError";
    }
}

/** O que um campo precisa expor a um template. */
export interface XIResolvedType
{
    /** Tipo na linguagem, já anulável quando o campo é anulável. */
    Type: string;
    /** Tipo na linguagem sempre na forma não anulável. */
    BaseType: string;
    /** Expressão da coluna: `VarChar(160)`, `Decimal(19,4)`, `UniqueIdentifier()`. */
    ColumnType: string;
    /** Inicializador do campo, ou "" quando não há. */
    Init: string;
    /** Molde do literal de seed, ou "" quando não há. */
    Literal: string;
}

export interface XIFieldTypeInput
{
    DataType: string;
    Length?: number;
    Scale?: number;
    IsRequired?: boolean;
}

/** Substitui {Length} e {Scale} numa expressão de coluna. */
function Interpolar(pMolde: string, pLength: number, pScale: number): string
{
    return pMolde
        .split("{Length}").join(String(pLength))
        .split("{Scale}").join(String(pScale));
}

function EscolherPorProvider(
    pValor: string | Record<string, string> | undefined,
    pProvider: string | undefined
): string | undefined
{
    if (pValor === undefined) return undefined;
    if (typeof pValor === "string") return pValor;

    // Objeto por provider: usa o pedido, senão o Default declarado.
    if (pProvider && pValor[pProvider] !== undefined) return pValor[pProvider];
    return pValor["Default"];
}

export class XTypeResolver
{
    private readonly _PorNome = new Map<string, XORMDataTypeInfo>();

    /**
     * @param pTypes    Tipos de `ORM.Types.json`.
     * @param pProfile  Perfil de template (a chave dentro de `Mappings`).
     * @param pProvider Provider-alvo, quando `Column` for declarado por provider.
     */
    constructor(
        pTypes: XORMDataTypeInfo[],
        private readonly _Profile: string,
        private readonly _Provider?: string
    )
    {
        for (const t of pTypes) this._PorNome.set(t.TypeName, t);
    }

    /** Tipos sem mapeamento para o perfil corrente — para validar antes de gerar. */
    GetUnmappedTypes(): string[]
    {
        const faltando: string[] = [];
        for (const [nome, info] of this._PorNome)
            if (!info.Mappings?.[this._Profile]) faltando.push(nome);
        return faltando.sort();
    }

    GetMapping(pDataType: string): XORMTypeMapping
    {
        const info = this._PorNome.get(pDataType);
        if (!info)
            throw new XTypeResolverError(`tipo '${pDataType}' não existe em ORM.Types.json`);

        const mapa = info.Mappings?.[this._Profile];
        if (!mapa)
            throw new XTypeResolverError(
                `tipo '${pDataType}' não tem Mappings["${this._Profile}"] em ORM.Types.json`);

        return mapa;
    }

    Resolve(pCampo: XIFieldTypeInput): XIResolvedType
    {
        const mapa = this.GetMapping(pCampo.DataType);
        const length = pCampo.Length ?? 0;
        const scale = pCampo.Scale ?? 0;

        // Sem Length declarado, o tipo usa a forma "max" quando existir — é o que
        // separa VarChar(160) de VarCharMax() e VarBinary(n) de VarBinaryMax().
        const molde = length > 0
            ? EscolherPorProvider(mapa.Column, this._Provider)
            : EscolherPorProvider(mapa.ColumnMax, this._Provider) ?? EscolherPorProvider(mapa.Column, this._Provider);

        if (molde === undefined)
            throw new XTypeResolverError(
                `tipo '${pCampo.DataType}' não declara Column para o perfil '${this._Profile}'`
                + (this._Provider ? ` e provider '${this._Provider}'` : ""));

        const anulavel = pCampo.IsRequired === false;

        return {
            BaseType: mapa.Type,
            Type: anulavel ? (mapa.TypeNullable ?? mapa.Type) : mapa.Type,
            ColumnType: Interpolar(molde, length, scale),
            // Campo anulável não recebe sentinela: o default dele é o próprio null.
            Init: anulavel ? "" : (mapa.Init ?? ""),
            Literal: mapa.Literal ?? ""
        };
    }

    /**
     * Formata um valor de seed no literal da linguagem.
     *
     * Valor iniciado por `=` é emitido VERBATIM, sem o `=`: é como o modelo guarda uma
     * expressão de código (`=SYSxCidade.NaoInformadoID`), que não deve virar string.
     */
    FormatLiteral(pDataType: string, pValor: string): string
    {
        if (pValor.startsWith("=")) return pValor.slice(1);

        const mapa = this.GetMapping(pDataType);
        if (!mapa.Literal) return pValor;

        return mapa.Literal.split("{Value}").join(pValor);
    }
}
