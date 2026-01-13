/**
 * XORMPKFieldMetadataProvider - Provider de metadados para XORMPKField
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * REGRAS IMPLEMENTADAS
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. DATATYPE
 *    - ReadOnly sempre (não pode ser alterado após criação)
 *    - Validação: deve ser Int32, Int64 ou Guid
 * 
 * 2. NAME
 *    - Obrigatório
 *    - Validação: identificador válido
 * 
 * 3. ISNULLABLE
 *    - Não visível (PK nunca é nullable)
 * 
 * 4. ISAUTOINCREMENT
 *    - Visível apenas para Int32 e Int64
 *    - Não visível para Guid
 * 
 * 5. LENGTH, SCALE
 *    - Não visíveis (não aplicáveis a tipos PK)
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { XPropertyMetadataProvider, XIPropertyContext, CreateCustomValidator, WhenPropertyIn } from "../../Core/XPropertyMetadata.js";
import { XDesignerErrorSeverity } from "../../Core/XValidation.js";
import type { XORMPKField } from "./XORMPKField.js";

/**
 * Contexto de propriedade para XORMPKField
 */
class XORMPKFieldPropertyContext implements XIPropertyContext<XORMPKField>
{
    public readonly Element: XORMPKField;
    public readonly PropertyID: string;
    public readonly PropertyName: string;
    public readonly CurrentValue: unknown;

    constructor(pElement: XORMPKField, pPropertyID: string, pPropertyName: string, pCurrentValue: unknown)
    {
        this.Element = pElement;
        this.PropertyID = pPropertyID;
        this.PropertyName = pPropertyName;
        this.CurrentValue = pCurrentValue;
    }

    public GetPropertyValue(pPropertyID: string): unknown
    {
        return XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(this.Element, pPropertyID);
    }
}

/**
 * Provider de metadados para XORMPKField
 * Define regras específicas para campos de chave primária
 */
export class XORMPKFieldMetadataProvider extends XPropertyMetadataProvider<XORMPKField>
{
    private static _Instance: XORMPKFieldMetadataProvider | null = null;

    /**
     * Obtém a instância singleton do provider
     */
    public static get Instance(): XORMPKFieldMetadataProvider
    {
        if (!XORMPKFieldMetadataProvider._Instance)
            XORMPKFieldMetadataProvider._Instance = new XORMPKFieldMetadataProvider();
        return XORMPKFieldMetadataProvider._Instance;
    }

    /**
     * Reseta a instância (útil para testes)
     */
    public static ResetInstance(): void
    {
        XORMPKFieldMetadataProvider._Instance = null;
    }

    private constructor()
    {
        super();
        this.RegisterRules();
    }

    /**
     * Registra todas as regras de propriedades
     */
    private RegisterRules(): void
    {
        this.RegisterNameRules();
        this.RegisterDataTypeRules();
        this.RegisterAutoIncrementRules();
        this.RegisterHiddenProperties();
    }

    /**
     * Regras para Name
     */
    private RegisterNameRules(): void
    {
        this.AddPropertyRule("Name", "Name", {
            IsRequired: () => true,
            Validators: [
                CreateCustomValidator<XORMPKField>(
                    "Name",
                    "Name",
                    (val) => typeof val === "string" && val.trim().length > 0,
                    "Name is required",
                    XDesignerErrorSeverity.Error
                ),
                CreateCustomValidator<XORMPKField>(
                    "Name",
                    "Name",
                    (val) => typeof val !== "string" || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val),
                    "Name should start with a letter or underscore and contain only letters, numbers, and underscores",
                    XDesignerErrorSeverity.Warning
                )
            ],
            HintProvider: () => "Primary key field name (usually 'ID')"
        });
    }

    /**
     * Regras para DataType - sempre readonly
     */
    private RegisterDataTypeRules(): void
    {
        this.AddPropertyRule("DataType", "Data Type", {
            IsReadOnly: () => true,
            HintProvider: (ctx) => `Primary key type: ${ctx.CurrentValue} (cannot be changed)`
        });
    }

    /**
     * Regras para IsAutoIncrement - visível apenas para tipos numéricos compatíveis
     */
    private RegisterAutoIncrementRules(): void
    {
        this.AddPropertyRule("IsAutoIncrement", "Is Auto Increment", {
            IsVisible: (ctx) => 
            {
                const dataType = ctx.GetPropertyValue("DataType") as string;
                return ["Int32", "Int64"].includes(dataType);
            },
            HintProvider: (ctx) =>
            {
                const dataType = ctx.GetPropertyValue("DataType") as string;
                if (dataType === "Guid")
                    return "Guid fields do not support auto-increment";
                return "Automatically generate incremental values for the primary key";
            }
        });
    }

    /**
     * Propriedades que não são visíveis para PKField
     */
    private RegisterHiddenProperties(): void
    {
        // IsNullable - PK nunca é nullable
        this.AddPropertyRule("IsNullable", "Is Nullable", {
            IsVisible: () => false,
            HintProvider: () => "Primary key fields cannot be nullable"
        });

        // Length - não aplicável a tipos PK
        this.AddPropertyRule("Length", "Length", {
            IsVisible: () => false,
            HintProvider: () => "Length is not applicable for primary key fields"
        });

        // Scale - não aplicável a tipos PK
        this.AddPropertyRule("Scale", "Scale", {
            IsVisible: () => false,
            HintProvider: () => "Scale is not applicable for primary key fields"
        });

        // IsPrimaryKey - não visível pois sempre é true
        this.AddPropertyRule("IsPrimaryKey", "Is Primary Key", {
            IsVisible: () => false,
            HintProvider: () => "This is a primary key field"
        });
    }

    /**
     * Cria o contexto de avaliação para uma propriedade
     */
    protected CreateContext(
        pElement: XORMPKField,
        pPropertyID: string,
        pPropertyName: string
    ): XIPropertyContext<XORMPKField>
    {
        const currentValue = XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pElement, pPropertyID);
        return new XORMPKFieldPropertyContext(pElement, pPropertyID, pPropertyName, currentValue);
    }

    /**
     * Obtém o valor de uma propriedade do campo PK
     */
    protected GetPropertyValue(pElement: XORMPKField, pPropertyID: string): unknown
    {
        return XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pElement, pPropertyID);
    }

    /**
     * Método estático para obter valor de propriedade
     */
    public static GetPKFieldPropertyValue(pElement: XORMPKField, pPropertyID: string): unknown
    {
        switch (pPropertyID)
        {
            case "Name": return pElement.Name;
            case "DataType": return pElement.DataType;
            case "Length": return pElement.Length;
            case "Scale": return pElement.Scale;
            case "IsPrimaryKey": return pElement.IsPrimaryKey;
            case "IsNullable": return pElement.IsNullable;
            case "IsAutoIncrement": return pElement.IsAutoIncrement;
            case "IsRequired": return pElement.IsRequired;
            case "DefaultValue": return pElement.DefaultValue;
            case "IsDataTypeLocked": return pElement.IsDataTypeLocked;
            default: return undefined;
        }
    }

    /**
     * Obtém o nome de uma propriedade
     */
    protected GetPropertyName(pPropertyID: string): string
    {
        switch (pPropertyID)
        {
            case "Name": return "Name";
            case "DataType": return "Data Type";
            case "IsAutoIncrement": return "Is Auto Increment";
            case "IsPrimaryKey": return "Is Primary Key";
            default: return pPropertyID;
        }
    }

    /**
     * Obtém lista de todos os property IDs de XORMPKField
     */
    public static GetAllPropertyIDs(): string[]
    {
        return [
            "Name",
            "DataType",
            "IsAutoIncrement"
        ];
    }
}
