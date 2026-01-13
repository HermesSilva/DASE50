import { XORMField } from "./XORMField.js";

/**
 * XORMPKField - Campo de Chave Primária para tabelas ORM
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * CARACTERÍSTICAS
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. HERANÇA
 *    - Herda de XORMField
 *    - Toda funcionalidade de campo regular está disponível
 * 
 * 2. RESTRIÇÕES
 *    - DataType é readonly (não pode ser alterado após criação)
 *    - IsNullable é sempre false (PK não pode ser nula)
 *    - Toda tabela DEVE ter exatamente um XORMPKField
 * 
 * 3. VALORES PADRÃO
 *    - DataType: "Int32" (pode ser Int32, Int64 ou Guid)
 *    - IsNullable: false (forçado)
 *    - IsAutoIncrement: true para Int32/Int64, false para Guid
 *    - Name: "ID" (padrão)
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */
export class XORMPKField extends XORMField
{
    /**
     * DataType padrão para chave primária.
     * NOTA: os DataTypes válidos para PK NÃO são estáticos; dependem do ORM.Types.json.
     */
    public static readonly DEFAULT_PK_DATA_TYPE = "Int32";

    /** Nome padrão para campo PK */
    public static readonly DEFAULT_PK_NAME = "ID";

    private _DataTypeLocked: boolean = false;

    public constructor()
    {
        super();
        this.InitializePKDefaults();
    }

    /**
     * Inicializa os valores padrão para um campo PK
     */
    private InitializePKDefaults(): void
    {
        // Define valores padrão de PK
        super.DataType = XORMPKField.DEFAULT_PK_DATA_TYPE;
        super.Name = XORMPKField.DEFAULT_PK_NAME;
        super.IsNullable = false;
        super.IsAutoIncrement = true;
    }

    /**
     * Indica se este campo é uma chave primária
     * Sempre retorna true para XORMPKField
     */
    public get IsPrimaryKey(): boolean
    {
        return true;
    }

    /**
     * DataType do campo PK
     * Só pode ser definido uma vez (na criação)
     */
    public override get DataType(): string
    {
        return super.DataType;
    }

    /**
     * Define o DataType do campo PK
     * Só funciona se ainda não estiver travado
     */
    public override set DataType(pValue: string)
    {
        if (this._DataTypeLocked)
            return; // Ignora tentativa de alteração após travado

        super.DataType = pValue;
        this.UpdateAutoIncrementForDataType(pValue);
    }

    /**
     * Trava o DataType, impedindo alterações futuras
     */
    public LockDataType(): void
    {
        this._DataTypeLocked = true;
    }

    /**
     * Verifica se o DataType está travado
     */
    public get IsDataTypeLocked(): boolean
    {
        return this._DataTypeLocked;
    }

    /**
     * IsNullable é sempre false para campos PK
     */
    public override get IsNullable(): boolean
    {
        return false;
    }

    /**
     * Tentativa de setar IsNullable é ignorada para PK
     */
    public override set IsNullable(_pValue: boolean)
    {
        // PK nunca pode ser nullable - ignora qualquer tentativa
    }

    /**
     * Atualiza IsAutoIncrement baseado no DataType
     * Int32/Int64 = true, Guid = false
     */
    private UpdateAutoIncrementForDataType(pDataType: string): void
    {
        if (pDataType === "Guid")
            super.IsAutoIncrement = false;
        else
            super.IsAutoIncrement = true;
    }
}
