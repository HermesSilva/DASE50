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
            Name: "DSORMTypes",
            Target: "ORM",
            Group: "DataType",
            Types: [
                {
                    TypeName: "Text",
                    CanUseInPK: false,
                    HasLength: true,
                    HasScale: false,
                    CanUseInIndex: false,
                    IsUTF8: true,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "Date",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "DateTime",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "Binary",
                    CanUseInPK: false,
                    HasLength: true,
                    HasScale: false,
                    CanUseInIndex: false,
                    IsUTF8: false,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "Boolean",
                    CanUseInPK: false,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "Guid",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "Int16",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true
                },
                {
                    TypeName: "Int32",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true
                },
                {
                    TypeName: "Int64",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true
                },
                {
                    TypeName: "Numeric",
                    CanUseInPK: true,
                    HasLength: true,
                    HasScale: true,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "String",
                    CanUseInPK: true,
                    HasLength: true,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: true,
                    CanAutoIncrement: false
                },
                {
                    TypeName: "Int8",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true
                }
            ]
        };
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
