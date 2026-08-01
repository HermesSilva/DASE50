/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                              TFX CONFIGURATION RESOURCES                                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  PURPOSE:                                                                                         ║
 * ║  Provides embedded default configurations for TFX designers.                                      ║
 * ║  These resources are used when no configuration file is found in the hierarchy.                   ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  RESOURCE NAMING:                                                                                 ║
 * ║  Resources follow the pattern: {Target}.{Group}.json                                              ║
 * ║  Located in: TFX/src/Config/Resources/                                                            ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  AVAILABLE RESOURCES:                                                                             ║
 * ║  - ORM.DataType.json: Default ORM data types configuration                                        ║
 * ║                                                                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import { XORMTypesConfig } from "./XConfigurationTypes.js";

/**
 * Embedded configuration resources
 * These are compiled into the library and used as defaults
 */
export class XConfigResources
{
    /**
     * Get default ORM DataType configuration
     * Source: Resources/ORM.DataType.json
     */
    static GetORMDataType(): XORMTypesConfig
    {
        return {
            "Name": "DSORMTypes",
            "Target": "ORM",
            "Group": "DataType",
            "Version": 2,
            "Types": [
                {
                    "TypeName": "Text",
                    "CanUseInPK": false,
                    "HasLength": true,
                    "HasScale": false,
                    "CanUseInIndex": false,
                    "IsUTF8": true,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "D6E6D29B-6496-4AB2-B7E8-7059413DB751",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "string",
                            "TypeNullable": "string?",
                            "Column": "VarCharMax()",
                            "ColumnMax": "VarCharMax()",
                            "Init": "\"\"",
                            "Literal": "\"{Value}\""
                        }
                    }
                },
                {
                    "TypeName": "Date",
                    "CanUseInPK": false,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "0A34C03B-458F-4BDA-BE51-22175CAAF1E0",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "DateTime",
                            "TypeNullable": "DateTime?",
                            "Column": "Date()",
                            "ColumnMax": "Date()",
                            "Literal": "DateTime.Parse(\"{Value}\", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal)"
                        }
                    }
                },
                {
                    "TypeName": "DateTime",
                    "CanUseInPK": false,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "6C9A2A8B-8418-4475-96DF-51F18B29F381",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "DateTime",
                            "TypeNullable": "DateTime?",
                            "Column": "DateTime()",
                            "ColumnMax": "DateTime()",
                            "Literal": "DateTime.Parse(\"{Value}\", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal)"
                        }
                    }
                },
                {
                    "TypeName": "Binary",
                    "CanUseInPK": false,
                    "HasLength": true,
                    "HasScale": false,
                    "CanUseInIndex": false,
                    "IsUTF8": false,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "B678215D-317B-4E8D-861A-B4F6FCA8AF45",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "byte[]",
                            "TypeNullable": "byte[]?",
                            "Column": "VarBinary({Length})",
                            "ColumnMax": "VarBinaryMax()"
                        }
                    }
                },
                {
                    "TypeName": "Boolean",
                    "CanUseInPK": false,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "B42D0699-00B6-4999-BD36-244B12990C2F",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "bool",
                            "TypeNullable": "bool?",
                            "Column": "Bit()",
                            "ColumnMax": "Bit()",
                            "Literal": "{Value}"
                        }
                    }
                },
                {
                    "TypeName": "Guid",
                    "CanUseInPK": true,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "8C5DEBC0-4165-4429-B106-1554552F802E",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "Guid",
                            "TypeNullable": "Guid?",
                            "Column": "UniqueIdentifier()",
                            "ColumnMax": "UniqueIdentifier()",
                            "Literal": "new(\"{Value}\")"
                        }
                    }
                },
                {
                    "TypeName": "Int16",
                    "CanUseInPK": true,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": true,
                    "CSharpTypeID": "5BD72111-603B-42E5-9488-53A4299E45EB",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "short",
                            "TypeNullable": "short?",
                            "Column": "SmallInt()",
                            "ColumnMax": "SmallInt()",
                            "Literal": "{Value}"
                        }
                    }
                },
                {
                    "TypeName": "Int32",
                    "CanUseInPK": true,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": true,
                    "CSharpTypeID": "FAADA046-C1B9-4E89-9B64-310E272FC0CC",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "int",
                            "TypeNullable": "int?",
                            "Column": "Int()",
                            "ColumnMax": "Int()",
                            "Literal": "{Value}"
                        }
                    }
                },
                {
                    "TypeName": "Int64",
                    "CanUseInPK": true,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": true,
                    "CSharpTypeID": "ADD41C4D-6BB4-49A6-856E-4CAA566DEBC2",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "long",
                            "TypeNullable": "long?",
                            "Column": "BigInt()",
                            "ColumnMax": "BigInt()",
                            "Literal": "{Value}"
                        }
                    }
                },
                {
                    "TypeName": "Numeric",
                    "CanUseInPK": false,
                    "HasLength": true,
                    "HasScale": true,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "0B16C95D-7DB8-425F-8DFB-F0A9DBA06400",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "decimal",
                            "TypeNullable": "decimal?",
                            "Column": "Decimal({Length},{Scale})",
                            "ColumnMax": "Decimal(18,2)",
                            "Literal": "{Value}m"
                        }
                    }
                },
                {
                    "TypeName": "String",
                    "CanUseInPK": false,
                    "HasLength": true,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": true,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "8A656713-0DBB-4D25-9CF9-8DA0DBAD4E62",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "string",
                            "TypeNullable": "string?",
                            "Column": "VarChar({Length})",
                            "ColumnMax": "VarCharMax()",
                            "Init": "\"\"",
                            "Literal": "\"{Value}\""
                        }
                    }
                },
                {
                    "TypeName": "Int8",
                    "CanUseInPK": true,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": false,
                    "CanAutoIncrement": true,
                    "CSharpTypeID": "D250B45C-AB2E-49F5-B4B9-9BD2479A725A",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "byte",
                            "TypeNullable": "byte?",
                            "Column": "TinyInt()",
                            "ColumnMax": "TinyInt()",
                            "Literal": "{Value}"
                        }
                    }
                },
                {
                    "TypeName": "Enum",
                    "CanUseInPK": false,
                    "HasLength": false,
                    "HasScale": false,
                    "CanUseInIndex": true,
                    "IsUTF8": true,
                    "CanAutoIncrement": false,
                    "CSharpTypeID": "A250B45C-AB2E-49F5-B4B9-9BD2479A275D",
                    "Mappings": {
                        "csharp-efcore": {
                            "Type": "short",
                            "TypeNullable": "short?",
                            "Column": "SmallInt()",
                            "ColumnMax": "SmallInt()",
                            "Literal": "{Value}"
                        }
                    }
                }
            ]
        } as XORMTypesConfig;
    }

    /**
     * Get resource content as JSON string
     * Useful for writing default files to disk
     */
    static GetORMDataTypeAsJson(): string
    {
        return JSON.stringify(XConfigResources.GetORMDataType(), null, 2);
    }
}
