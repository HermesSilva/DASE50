/**
 * XORMFieldMetadataProvider - Provider de metadados para XORMField
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * REGRAS IMPLEMENTADAS (campos regulares, não PK)
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. DATATYPE
 *    - ReadOnly quando o campo é FK (Foreign Key)
 *    - Validação: deve ser um tipo válido
 * 
 * 2. LENGTH
 *    - Visível apenas para: String, Numeric, Decimal
 *    - Obrigatório para: String, Numeric
 *    - Validação: deve ser > 0 quando obrigatório
 * 
 * 3. SCALE
 *    - Visível apenas para: Numeric, Decimal
 *    - Validação: deve ser <= Length
 * 
 * 4. ISNULLABLE
 *    - Permite definir se o campo aceita valores nulos
 * 
 * 5. ISAUTOINCREMENT
 *    - Visível apenas para tipos inteiros: Int32, Int64
 * 
 * NOTA: Para campos de chave primária (XORMPKField), use XORMPKFieldMetadataProvider
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { XPropertyMetadataProvider, XIPropertyContext, CreateRangeValidator, WhenPropertyIn, CreateCustomValidator } from "../../Core/XPropertyMetadata.js";
import { XDesignerErrorSeverity } from "../../Core/XValidation.js";
import type { XORMField } from "./XORMField.js";

/**
 * DataTypes válidos para campos ORM
 */
export const ORM_VALID_DATA_TYPES = [
    "String",
    "Int32",
    "Int64",
    "Decimal",
    "Numeric",
    "Boolean",
    "DateTime",
    "Date",
    "Time",
    "Guid",
    "Binary",
    "Text"
] as const;

/**
 * DataTypes que requerem/suportam Length
 */
export const ORM_LENGTH_DATA_TYPES = ["String", "Numeric", "Decimal"];

/**
 * DataTypes que requerem Length obrigatório
 */
export const ORM_LENGTH_REQUIRED_DATA_TYPES = ["String", "Numeric"];

/**
 * DataTypes que suportam Scale
 */
export const ORM_SCALE_DATA_TYPES = ["Numeric", "Decimal"];

/**
 * DataTypes inteiros que suportam AutoIncrement
 */
export const ORM_INTEGER_DATA_TYPES = ["Int32", "Int64"];

/**
 * Contexto de propriedade para XORMField
 */
class XORMFieldPropertyContext implements XIPropertyContext<XORMField>
{
    public readonly Element: XORMField;
    public readonly PropertyID: string;
    public readonly PropertyName: string;
    public readonly CurrentValue: unknown;

    constructor(pElement: XORMField, pPropertyID: string, pPropertyName: string, pCurrentValue: unknown)
    {
        this.Element = pElement;
        this.PropertyID = pPropertyID;
        this.PropertyName = pPropertyName;
        this.CurrentValue = pCurrentValue;
    }

    public GetPropertyValue(pPropertyID: string): unknown
    {
        return XORMFieldMetadataProvider.GetFieldPropertyValue(this.Element, pPropertyID);
    }
}

/**
 * Provider de metadados para XORMField
 * Define regras de visibilidade, read-only, obrigatoriedade e validação
 */
export class XORMFieldMetadataProvider extends XPropertyMetadataProvider<XORMField>
{
    private static _Instance: XORMFieldMetadataProvider | null = null;

    /**
     * Obtém a instância singleton do provider
     */
    public static get Instance(): XORMFieldMetadataProvider
    {
        if (!XORMFieldMetadataProvider._Instance)
            XORMFieldMetadataProvider._Instance = new XORMFieldMetadataProvider();
        return XORMFieldMetadataProvider._Instance;
    }

    /**
     * Reseta a instância (útil para testes)
     */
    public static ResetInstance(): void
    {
        XORMFieldMetadataProvider._Instance = null;
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
        this.RegisterDataTypeRules();
        this.RegisterLengthRules();
        this.RegisterScaleRules();
        this.RegisterNullableRules();
        this.RegisterAutoIncrementRules();
        this.RegisterNameRules();
    }

    /**
     * Regras para DataType
     */
    private RegisterDataTypeRules(): void
    {
        this.AddPropertyRule("DataType", "Data Type", {
            IsReadOnly: (ctx) => ctx.Element.IsForeignKey,
            Validators: [
                CreateCustomValidator<XORMField>(
                    "DataType",
                    "Data Type",
                    (val) => ORM_VALID_DATA_TYPES.includes(val as typeof ORM_VALID_DATA_TYPES[number]),
                    `Data Type must be one of: ${ORM_VALID_DATA_TYPES.join(", ")}`
                )
            ],
            HintProvider: (ctx) =>
            {
                if (ctx.Element.IsForeignKey)
                {
                    const expected = ctx.Element.GetExpectedDataType();
                    return `Foreign Key field - DataType is determined by target table (${expected})`;
                }
                return "Select the data type for this field";
            }
        });
    }

    /**
     * Regras para Length
     */
    private RegisterLengthRules(): void
    {
        this.AddPropertyRule("Length", "Length", {
            IsVisible: WhenPropertyIn<XORMField>("DataType", ORM_LENGTH_DATA_TYPES),
            IsRequired: WhenPropertyIn<XORMField>("DataType", ORM_LENGTH_REQUIRED_DATA_TYPES),
            Validators: [
                CreateCustomValidator<XORMField>(
                    "Length",
                    "Length",
                    (val, ctx) =>
                    {
                        const dataType = ctx.GetPropertyValue("DataType") as string;
                        if (!ORM_LENGTH_DATA_TYPES.includes(dataType))
                            return true;
                        if (ORM_LENGTH_REQUIRED_DATA_TYPES.includes(dataType))
                            return typeof val === "number" && val > 0;
                        return true;
                    },
                    "Length must be greater than 0 for String and Numeric fields",
                    XDesignerErrorSeverity.Error
                ),
                CreateRangeValidator<XORMField>("Length", "Length", 0, 8000)
            ],
            HintProvider: (ctx) =>
            {
                const dataType = ctx.GetPropertyValue("DataType") as string;
                if (dataType === "String")
                    return "Maximum number of characters";
                if (dataType === "Numeric" || dataType === "Decimal")
                    return "Total number of digits (precision)";
                return undefined;
            }
        });
    }

    /**
     * Regras para Scale
     */
    private RegisterScaleRules(): void
    {
        this.AddPropertyRule("Scale", "Scale", {
            IsVisible: WhenPropertyIn<XORMField>("DataType", ORM_SCALE_DATA_TYPES),
            Validators: [
                CreateCustomValidator<XORMField>(
                    "Scale",
                    "Scale",
                    (val, ctx) =>
                    {
                        const dataType = ctx.GetPropertyValue("DataType") as string;
                        if (!ORM_SCALE_DATA_TYPES.includes(dataType))
                            return true;

                        const length = ctx.GetPropertyValue("Length") as number;
                        const scale = val as number;
                        if (typeof scale !== "number" || typeof length !== "number")
                            return true;

                        return scale <= length;
                    },
                    "Scale cannot exceed Length",
                    XDesignerErrorSeverity.Error
                ),
                CreateRangeValidator<XORMField>("Scale", "Scale", 0, 38)
            ],
            HintProvider: () => "Number of decimal places"
        });
    }

    /**
     * Regras para IsNullable
     */
    private RegisterNullableRules(): void
    {
        this.AddPropertyRule("IsNullable", "Is Nullable", {
            HintProvider: () => "Allow null values for this field"
        });
    }

    /**
     * Regras para IsAutoIncrement
     */
    private RegisterAutoIncrementRules(): void
    {
        this.AddPropertyRule("IsAutoIncrement", "Is Auto Increment", {
            IsVisible: WhenPropertyIn<XORMField>("DataType", ORM_INTEGER_DATA_TYPES),
            HintProvider: () => "Automatically generate incremental values"
        });
    }

    /**
     * Regras para Name
     */
    private RegisterNameRules(): void
    {
        this.AddPropertyRule("Name", "Name", {
            IsRequired: () => true,
            Validators: [
                CreateCustomValidator<XORMField>(
                    "Name",
                    "Name",
                    (val) => typeof val === "string" && val.trim().length > 0,
                    "Name is required",
                    XDesignerErrorSeverity.Error
                ),
                CreateCustomValidator<XORMField>(
                    "Name",
                    "Name",
                    (val) => typeof val !== "string" || !val.includes(" "),
                    "Name should not contain spaces",
                    XDesignerErrorSeverity.Warning
                ),
                CreateCustomValidator<XORMField>(
                    "Name",
                    "Name",
                    (val) => typeof val !== "string" || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val),
                    "Name should start with a letter or underscore and contain only letters, numbers, and underscores",
                    XDesignerErrorSeverity.Warning
                )
            ],
            HintProvider: () => "Unique identifier for this field within the table"
        });
    }

    /**
     * Cria o contexto de avaliação para uma propriedade
     */
    protected CreateContext(
        pElement: XORMField,
        pPropertyID: string,
        pPropertyName: string
    ): XIPropertyContext<XORMField>
    {
        const currentValue = XORMFieldMetadataProvider.GetFieldPropertyValue(pElement, pPropertyID);
        return new XORMFieldPropertyContext(pElement, pPropertyID, pPropertyName, currentValue);
    }

    /**
     * Obtém o valor de uma propriedade do campo
     */
    protected GetPropertyValue(pElement: XORMField, pPropertyID: string): unknown
    {
        return XORMFieldMetadataProvider.GetFieldPropertyValue(pElement, pPropertyID);
    }

    /**
     * Método estático para obter valor de propriedade
     * Exposto para uso no contexto
     */
    public static GetFieldPropertyValue(pElement: XORMField, pPropertyID: string): unknown
    {
        switch (pPropertyID)
        {
            case "Name": return pElement.Name;
            case "DataType": return pElement.DataType;
            case "Length": return pElement.Length;
            case "Scale": return pElement.Scale;
            case "IsNullable": return pElement.IsNullable;
            case "IsAutoIncrement": return pElement.IsAutoIncrement;
            case "IsRequired": return pElement.IsRequired;
            case "DefaultValue": return pElement.DefaultValue;
            case "IsForeignKey": return pElement.IsForeignKey;
            case "IsPrimaryKey": return pElement.IsPrimaryKey;
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
            case "Length": return "Length";
            case "Scale": return "Scale";
            case "IsNullable": return "Is Nullable";
            case "IsAutoIncrement": return "Is Auto Increment";
            case "IsRequired": return "Is Required";
            case "DefaultValue": return "Default Value";
            case "IsForeignKey": return "Is Foreign Key";
            default: return pPropertyID;
        }
    }

    /**
     * Obtém lista de todos os property IDs de XORMField
     */
    public static GetAllPropertyIDs(): string[]
    {
        return [
            "Name",
            "DataType",
            "Length",
            "Scale",
            "IsNullable",
            "IsAutoIncrement",
            "IsRequired",
            "DefaultValue"
        ];
    }
}
