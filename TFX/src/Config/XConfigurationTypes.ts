/**
 * Configuration type definitions for TFX Configuration Manager
 */

import { IConfigurationFile } from "./XConfigurationManager.js";

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
}

/**
 * ORM Types configuration file structure
 */
export interface XORMTypesConfig extends IConfigurationFile
{
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
