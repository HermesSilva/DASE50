/**
 * XORMTableMetadataProvider - Provider de metadados para XORMTable
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * REGRAS IMPLEMENTADAS
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. NAME
 *    - Obrigatório
 *    - Validação: identificador válido (sem espaços, caracteres especiais)
 * 
 * 2. PKTYPE
 *    - ReadOnly (determinado pelo campo PKField)
 *    - Mostra o tipo da chave primária da tabela
 * 
 * 3. BOUNDS
 *    - Posição e tamanho da tabela no designer
 * 
 * 4. VALIDAÇÃO ESTRUTURAL
 *    - Toda tabela DEVE ter um campo XORMPKField
 *    - UserFix disponível para criar o PKField automaticamente
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { XPropertyMetadataProvider, XIPropertyContext, CreateCustomValidator, XIUserFix } from "../../Core/XPropertyMetadata.js";
import { XDesignerErrorSeverity } from "../../Core/XValidation.js";
import type { XORMTable } from "./XORMTable.js";

/**
 * IDs dos UserFixes disponíveis para tabelas
 */
export const ORM_TABLE_USER_FIX_IDS = {
    CREATE_PK_FIELD: "CreatePKField"
} as const;

/**
 * Contexto de propriedade para XORMTable
 */
class XORMTablePropertyContext implements XIPropertyContext<XORMTable>
{
    public readonly Element: XORMTable;
    public readonly PropertyID: string;
    public readonly PropertyName: string;
    public readonly CurrentValue: unknown;

    constructor(pElement: XORMTable, pPropertyID: string, pPropertyName: string, pCurrentValue: unknown)
    {
        this.Element = pElement;
        this.PropertyID = pPropertyID;
        this.PropertyName = pPropertyName;
        this.CurrentValue = pCurrentValue;
    }

    public GetPropertyValue(pPropertyID: string): unknown
    {
        return XORMTableMetadataProvider.GetTablePropertyValue(this.Element, pPropertyID);
    }
}

/**
 * Provider de metadados para XORMTable
 * Define regras de validação e UserFixes para tabelas
 */
export class XORMTableMetadataProvider extends XPropertyMetadataProvider<XORMTable>
{
    private static _Instance: XORMTableMetadataProvider | null = null;

    /**
     * Obtém a instância singleton do provider
     */
    public static get Instance(): XORMTableMetadataProvider
    {
        if (!XORMTableMetadataProvider._Instance)
            XORMTableMetadataProvider._Instance = new XORMTableMetadataProvider();
        return XORMTableMetadataProvider._Instance;
    }

    /**
     * Reseta a instância (útil para testes)
     */
    public static ResetInstance(): void
    {
        XORMTableMetadataProvider._Instance = null;
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
        this.RegisterPKTypeRules();
        this.RegisterStructuralValidation();
    }

    /**
     * Regras para Name
     */
    private RegisterNameRules(): void
    {
        this.AddPropertyRule("Name", "Name", {
            IsRequired: () => true,
            Validators: [
                CreateCustomValidator<XORMTable>(
                    "Name",
                    "Name",
                    (val) => typeof val === "string" && val.trim().length > 0,
                    "Table name is required",
                    XDesignerErrorSeverity.Error
                ),
                CreateCustomValidator<XORMTable>(
                    "Name",
                    "Name",
                    (val) => typeof val !== "string" || !val.includes(" "),
                    "Table name should not contain spaces",
                    XDesignerErrorSeverity.Warning
                ),
                CreateCustomValidator<XORMTable>(
                    "Name",
                    "Name",
                    (val) => typeof val !== "string" || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val),
                    "Table name should start with a letter or underscore and contain only letters, numbers, and underscores",
                    XDesignerErrorSeverity.Warning
                )
            ],
            HintProvider: () => "Unique identifier for this table in the database"
        });
    }

    /**
     * Regras para PKType - readonly, determinado pelo PKField
     */
    private RegisterPKTypeRules(): void
    {
        this.AddPropertyRule("PKType", "Primary Key Type", {
            IsReadOnly: () => true,
            HintProvider: (ctx) =>
            {
                const pkType = ctx.CurrentValue as string;
                return `Primary key type is ${pkType} (determined by the PK field)`;
            }
        });
    }

    /**
     * Validação estrutural - verifica se tabela tem PKField
     */
    private RegisterStructuralValidation(): void
    {
        // Propriedade virtual "_Structure" para validação estrutural
        this.AddPropertyRule("_Structure", "Structure", {
            Validators: [
                CreateCustomValidator<XORMTable>(
                    "_Structure",
                    "Structure",
                    (_val, ctx) => ctx.Element.HasPKField(),
                    "Table must have a primary key field",
                    XDesignerErrorSeverity.Error,
                    [XORMTableMetadataProvider.CreatePKFieldUserFix()]
                )
            ]
        });
    }

    /**
     * Cria o UserFix para adicionar campo PK
     */
    private static CreatePKFieldUserFix(): XIUserFix
    {
        return {
            ID: ORM_TABLE_USER_FIX_IDS.CREATE_PK_FIELD,
            Label: "Add Primary Key Field",
            Description: "Creates an 'ID' field with Int32 type as the primary key",
            Apply: (pElement: unknown) =>
            {
                const table = pElement as XORMTable;
                if (typeof table.EnsurePKField === "function")
                {
                    table.EnsurePKField();
                    return true;
                }
                return false;
            }
        };
    }

    /**
     * Valida a estrutura da tabela (se tem PKField)
     */
    public ValidateStructure(pTable: XORMTable): { IsValid: boolean; UserFixes: XIUserFix[] }
    {
        const hasPK = pTable.HasPKField();
        if (hasPK)
            return { IsValid: true, UserFixes: [] };

        return {
            IsValid: false,
            UserFixes: [XORMTableMetadataProvider.CreatePKFieldUserFix()]
        };
    }

    /**
     * Aplica um UserFix na tabela
     */
    public ApplyUserFix(pTable: XORMTable, pFixID: string): boolean
    {
        if (pFixID === ORM_TABLE_USER_FIX_IDS.CREATE_PK_FIELD)
        {
            pTable.EnsurePKField();
            return true;
        }
        return false;
    }

    /**
     * Cria o contexto de avaliação para uma propriedade
     */
    protected CreateContext(
        pElement: XORMTable,
        pPropertyID: string,
        pPropertyName: string
    ): XIPropertyContext<XORMTable>
    {
        const currentValue = XORMTableMetadataProvider.GetTablePropertyValue(pElement, pPropertyID);
        return new XORMTablePropertyContext(pElement, pPropertyID, pPropertyName, currentValue);
    }

    /**
     * Obtém o valor de uma propriedade da tabela
     */
    protected GetPropertyValue(pElement: XORMTable, pPropertyID: string): unknown
    {
        return XORMTableMetadataProvider.GetTablePropertyValue(pElement, pPropertyID);
    }

    /**
     * Método estático para obter valor de propriedade
     */
    public static GetTablePropertyValue(pElement: XORMTable, pPropertyID: string): unknown
    {
        switch (pPropertyID)
        {
            case "Name": return pElement.Name;
            case "PKType": return pElement.PKType;
            case "ID": return pElement.ID;
            case "_Structure": return pElement.HasPKField();
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
            case "PKType": return "Primary Key Type";
            case "_Structure": return "Structure";
            default: return pPropertyID;
        }
    }

    /**
     * Obtém lista de todos os property IDs de XORMTable
     */
    public static GetAllPropertyIDs(): string[]
    {
        return [
            "Name",
            "PKType"
        ];
    }
}
