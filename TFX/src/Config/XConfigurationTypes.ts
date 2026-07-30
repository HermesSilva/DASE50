/**
 * Configuration type definitions for TFX Configuration Manager
 */

import { IConfigurationFile } from "./XConfigurationManager.js";

/**
 * Projeção de um tipo do modelo numa linguagem/framework concreto — o que a geração de
 * código precisa saber para transformar `String(160)` em `public string Nome` mais
 * `.HasColumnType(VarChar(160))`.
 *
 * Vive no MESMO registro do tipo (ORM.Types.json) e não num arquivo à parte, para que
 * acrescentar um tipo seja UMA edição: se faltar mapeamento, o gerador acusa em vez de
 * emitir código silenciosamente errado.
 */
export interface XORMTypeMapping
{
    /** Tipo na linguagem: `string`, `Guid`, `short`, `decimal`. */
    Type: string;

    /** Forma anulável do tipo. Nem toda linguagem usa `?`, por isso é explícito. */
    TypeNullable?: string;

    /**
     * Expressão da coluna, com `{Length}` e `{Scale}` substituídos.
     * Aceita string única (o helper multi-banco resolve em runtime, como o
     * XBaseEntityConfiguration do Tootega) ou um valor por provider, quando o
     * framework-alvo precisa do tipo SQL literal na geração.
     */
    Column?: string | Record<string, string>;

    /** Usada no lugar de `Column` quando o campo não tem `Length` — `VarCharMax()`. */
    ColumnMax?: string | Record<string, string>;

    /** Inicializador de campo não anulável com sentinela: `""` para string. */
    Init?: string;

    /** Molde do valor num seed, com `{Value}`: `"{Value}"`, `new("{Value}")`, `{Value}m`. */
    Literal?: string;
}

/**
 * ORM Data Type information
 */
export interface XORMDataTypeInfo
{
    /** Type name (e.g., "String", "Int32", "DateTime") */
    TypeName: string;
    
    /** Can this type be used as a primary key */
    CanUseInPK: boolean;
    
    /** Does this type have a length parameter (e.g., String(100)) */
    HasLength: boolean;
    
    /** Does this type have a scale parameter (e.g., Numeric(18,2)) */
    HasScale: boolean;
    
    /** Can this type be used in an index */
    CanUseInIndex: boolean;
    
    /** Is this a UTF-8 text type */
    IsUTF8: boolean;
    
    /** Can this type support auto-increment */
    CanAutoIncrement: boolean;

    /**
     * Optional GUID used by the legacy C# DASE4VS application to identify this type.
     * Used during migration of .dsorm files created by the C# version.
     * TS-native files never write this field.
     */
    CSharpTypeID?: string;

    /**
     * Projeção do tipo por PERFIL de template (a pasta em `.DASE/Templates/`), permitindo
     * que o mesmo repositório gere para mais de uma linguagem.
     *
     * Opcional: um `ORM.Types.json` v1, sem esta chave, continua abrindo normalmente no
     * designer — só a geração de código reclama do que faltar.
     */
    Mappings?: Record<string, XORMTypeMapping>;
}

/**
 * ORM Types configuration file structure
 */
export interface XORMTypesConfig extends IConfigurationFile
{
    /**
     * Versão do formato. 2 introduziu `Mappings` nos tipos (projeção para geração de
     * código). Ausente significa v1: abre normalmente no designer, mas não gera código.
     */
    Version?: number;

    /** Array of supported data types */
    Types: XORMDataTypeInfo[];
}

/**
 * ORM Validation configuration file structure (future)
 */
export interface XORMValidationConfig extends IConfigurationFile
{
    /** Validation rules */
    Rules: Array<{
        RuleName: string;
        Severity: "Error" | "Warning" | "Info";
        Message: string;
        Enabled: boolean;
    }>;
}

/**
 * ORM Naming configuration file structure (future)
 */
export interface XORMNamingConfig extends IConfigurationFile
{
    /** Table naming conventions */
    TableNaming: {
        Prefix: string;
        Suffix: string;
        Case: "PascalCase" | "camelCase" | "snake_case" | "UPPER_CASE";
    };
    
    /** Field naming conventions */
    FieldNaming: {
        PrimaryKeyPattern: string;
        ForeignKeyPattern: string;
        Case: "PascalCase" | "camelCase" | "snake_case" | "UPPER_CASE";
    };
}

/**
 * UI Components configuration file structure (future)
 */
export interface XUIComponentsConfig extends IConfigurationFile
{
    /** Available UI components */
    Components: Array<{
        ComponentName: string;
        Category: string;
        Icon: string;
        DefaultProperties: Record<string, unknown>;
    }>;
}

/**
 * Display configuration file structure (future)
 */
export interface XDisplayConfig extends IConfigurationFile
{
    /** Default colors */
    Colors: {
        TableBackground: string;
        TableBorder: string;
        FieldText: string;
        PKFieldBackground: string;
        FKFieldBackground: string;
        ReferenceLineColor: string;
    };
    
    /** Default dimensions */
    Dimensions: {
        DefaultTableWidth: number;
        DefaultTableHeight: number;
        FieldRowHeight: number;
        HeaderHeight: number;
    };
}
