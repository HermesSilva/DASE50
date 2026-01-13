import { describe, it, expect, beforeEach, vi } from "vitest";
import { XORMPKFieldMetadataProvider } from "../src/Designers/ORM/XORMPKFieldMetadataProvider.js";
import { XORMTableMetadataProvider, ORM_TABLE_USER_FIX_IDS } from "../src/Designers/ORM/XORMTableMetadataProvider.js";
import { XORMFieldMetadataProvider } from "../src/Designers/ORM/XORMFieldMetadataProvider.js";
import { XORMPKField } from "../src/Designers/ORM/XORMPKField.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";

describe("ORM Metadata Providers Coverage", () => {
    describe("XORMPKFieldMetadataProvider", () => {
        let pkField: XORMPKField;
        const provider = XORMPKFieldMetadataProvider.Instance;

        beforeEach(() => {
            pkField = new XORMPKField();
            pkField.InitializeNew();
        });

        it("should return valid metadata for Name", () => {
            const meta = provider.GetMetadata(pkField, "Name");
            expect(meta).toBeDefined();
            expect(meta.IsRequired).toBe(true);
            expect(meta.Hint).toBeDefined();
        });

        it("should return read-only metadata for DataType", () => {
            const meta = provider.GetMetadata(pkField, "DataType");
            expect(meta.IsReadOnly).toBe(true);
        });

        it("should return hint for DataType", () => {
            pkField.DataType = "Int32";
            const meta = provider.GetMetadata(pkField, "DataType");
            expect(meta.Hint).toContain("Int32");
        });

        it("should handle IsAutoIncrement visibility based on type", () => {
            pkField.DataType = "Int32";
            expect(provider.IsPropertyVisible(pkField, "IsAutoIncrement")).toBe(true);
            
            pkField.DataType = "Guid";
            expect(provider.IsPropertyVisible(pkField, "IsAutoIncrement")).toBe(false);
            
            const meta = provider.GetMetadata(pkField, "IsAutoIncrement");
            expect(meta.Hint).toBeDefined();
        });

        it("should hide IsNullable", () => {
            expect(provider.IsPropertyVisible(pkField, "IsNullable")).toBe(false);
            expect(provider.GetMetadata(pkField, "IsNullable").Hint).toBeDefined();
        });
        
        it("should hide Length and Scale", () => {
            expect(provider.IsPropertyVisible(pkField, "Length")).toBe(false);
            expect(provider.IsPropertyVisible(pkField, "Scale")).toBe(false);
        });

        it("should cover property IDs", () => {
           const props = XORMPKFieldMetadataProvider.GetAllPropertyIDs();
           props.forEach(p => {
               const val = XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, p);
               expect(val).toBeDefined();
               expect(provider.GetPropertyName(p)).toBeDefined();
           });
           expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "Unknown")).toBeUndefined();
           expect(provider.GetPropertyName("Unknown")).toBe("Unknown");
        });

        it("should cover all GetPKFieldPropertyValue switch cases", () => {
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "IsPrimaryKey")).toBe(true);
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "IsNullable")).toBeDefined();
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "IsAutoIncrement")).toBeDefined();
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "IsRequired")).toBeDefined();
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "DefaultValue")).toBeDefined();
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "IsDataTypeLocked")).toBeDefined();
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "Length")).toBeDefined();
            expect(XORMPKFieldMetadataProvider.GetPKFieldPropertyValue(pkField, "Scale")).toBeDefined();
        });

        it("should cover GetPropertyName for IsPrimaryKey", () => {
            expect(provider.GetPropertyName("IsPrimaryKey")).toBe("Is Primary Key");
        });

        it("should get metadata for IsPrimaryKey triggering hint provider", () => {
            const meta = provider.GetMetadata(pkField, "IsPrimaryKey");
            expect(meta.IsVisible).toBe(false);
            expect(meta.Hint).toBe("This is a primary key field");
        });
        
        it("should reset instance", () => {
            XORMPKFieldMetadataProvider.ResetInstance();
            const p1 = XORMPKFieldMetadataProvider.Instance;
            expect(p1).toBeDefined();
        });
    });

    describe("XORMTableMetadataProvider", () => {
        let table: XORMTable;
        const provider = XORMTableMetadataProvider.Instance;

        beforeEach(() => {
            table = new XORMTable();
            table.InitializeNew();
        });

        it("should return valid metadata for Name", () => {
            const meta = provider.GetMetadata(table, "Name");
            expect(meta).toBeDefined();
            expect(meta.IsRequired).toBe(true);
            expect(meta.Hint).toBeDefined();
        });

        it("should return read-only metadata for PKType", () => {
            const meta = provider.GetMetadata(table, "PKType");
            expect(meta.IsReadOnly).toBe(true);
            expect(meta.Hint).toBeDefined();
        });

        it("should validate table structure", () => {
            const meta = provider.GetMetadata(table, "_Structure");
            expect(meta.IsValid).toBe(false);
            expect(meta.ValidationMessages.length).toBeGreaterThan(0);
        });

        it("should apply UserFix", () => {
            expect(provider.ApplyUserFix(table, "InvalidFix")).toBe(false);
            const success = provider.ApplyUserFix(table, ORM_TABLE_USER_FIX_IDS.CREATE_PK_FIELD);
            expect(success).toBe(true);
        });

        it("should test UserFix Apply logic", () => {
            const meta = provider.GetMetadata(table, "_Structure");
            const validation = meta.ValidationMessages[0];
            const fix = validation.UserFixes[0];
            expect(fix.ID).toBe(ORM_TABLE_USER_FIX_IDS.CREATE_PK_FIELD);
            expect(fix.Label).toBeDefined();
            expect(fix.Description).toBeDefined();
            
            const mockTable = {
                EnsurePKField: vi.fn()
            };
            expect(fix.Apply(mockTable)).toBe(true);
            expect(mockTable.EnsurePKField).toHaveBeenCalled();

            expect(fix.Apply({})).toBe(false);
        });

        it("should cover property IDs", () => {
            const props = XORMTableMetadataProvider.GetAllPropertyIDs();
            props.forEach(p => {
                const val = XORMTableMetadataProvider.GetTablePropertyValue(table, p);
                expect(val).toBeDefined();
                expect(provider.GetPropertyName(p)).toBeDefined();
            });
            expect(XORMTableMetadataProvider.GetTablePropertyValue(table, "Unknown")).toBeUndefined();
            expect(provider.GetPropertyName("Unknown")).toBe("Unknown");
        });

        it("should cover remaining branches in XORMTableMetadataProvider", () => {
            // Test protected GetPropertyValue method directly (line 240)
            expect((provider as any).GetPropertyValue(table, "Name")).toBe(table.Name);
            
            // Let's test case "ID" (line 252)
            expect(XORMTableMetadataProvider.GetTablePropertyValue(table, "ID")).toBe(table.ID);
            
            // Let's test line 267 (GetPropertyName default)
            expect(provider.GetPropertyName("UnknownProperty")).toBe("UnknownProperty");
        });

        it("should cover _Structure property value", () => {
            expect(XORMTableMetadataProvider.GetTablePropertyValue(table, "_Structure")).toBe(false);
            table.EnsurePKField();
            expect(XORMTableMetadataProvider.GetTablePropertyValue(table, "_Structure")).toBe(true);
        });

        it("should cover GetPropertyName for _Structure", () => {
            expect(provider.GetPropertyName("_Structure")).toBe("Structure");
        });

        it("should cover ValidateStructure", () => {
            const result = provider.ValidateStructure(table);
            expect(result.IsValid).toBe(false);
            expect(result.UserFixes.length).toBeGreaterThan(0);
            
            table.EnsurePKField();
            const result2 = provider.ValidateStructure(table);
            expect(result2.IsValid).toBe(true);
            expect(result2.UserFixes.length).toBe(0);
        });

        it("should reset instance", () => {
            XORMTableMetadataProvider.ResetInstance();
            const p1 = XORMTableMetadataProvider.Instance;
            expect(p1).toBeDefined();
            // Access Instance again to cover the branch where _Instance already exists (line 74)
            const p2 = XORMTableMetadataProvider.Instance;
            expect(p2).toBe(p1);
        });

        it("should cover context GetPropertyValue method (line 57)", () => {
            // Access protected CreateContext method to get the internal context
            const ctx = (provider as any).CreateContext(table, "Name", "Name");
            // Call GetPropertyValue on the context (line 57)
            expect(ctx.GetPropertyValue("Name")).toBe(table.Name);
            expect(ctx.GetPropertyValue("ID")).toBe(table.ID);
            expect(ctx.GetPropertyValue("Unknown")).toBeUndefined();
        });
    });

    describe("XORMFieldMetadataProvider", () => {
        let field: XORMField;
        const provider = XORMFieldMetadataProvider.Instance;

        beforeEach(() => {
            field = new XORMField();
            field.InitializeNew();
        });

        it("should return metadata for all property IDs", () => {
            const properties = [
                "Name", "DataType", "Length", "Scale", 
                "IsNullable", "IsAutoIncrement", "IsRequired", 
                "DefaultValue", "IsForeignKey", "IsPrimaryKey",
                "Unknown"
            ];

            properties.forEach(prop => {
                const meta = provider.GetMetadata(field, prop);
                expect(meta).toBeDefined();
                expect(meta.PropertyID).toBe(prop);
            });
        });

        it("should cover property name switch", () => {
            expect(provider.GetPropertyName("Name")).toBe("Name");
            expect(provider.GetPropertyName("DataType")).toBe("Data Type");
            expect(provider.GetPropertyName("Length")).toBe("Length");
            expect(provider.GetPropertyName("Scale")).toBe("Scale");
            expect(provider.GetPropertyName("IsNullable")).toBe("Is Nullable");
            expect(provider.GetPropertyName("IsAutoIncrement")).toBe("Is Auto Increment");
            expect(provider.GetPropertyName("IsRequired")).toBe("Is Required");
            expect(provider.GetPropertyName("DefaultValue")).toBe("Default Value");
            expect(provider.GetPropertyName("IsForeignKey")).toBe("Is Foreign Key");
            expect(provider.GetPropertyName("Unknown")).toBe("Unknown");
        });

        it("should cover all GetFieldPropertyValue switch cases", () => {
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Name")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "DataType")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Length")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Scale")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsNullable")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsAutoIncrement")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsRequired")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "DefaultValue")).toBeDefined();
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsForeignKey")).toBe(false);
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsPrimaryKey")).toBe(false);
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Unknown")).toBeUndefined();
        });

        it("should cover protected GetPropertyValue method", () => {
            // Access protected method directly via type assertion
            expect((provider as any).GetPropertyValue(field, "Name")).toBe(field.Name);
        });
    });

    describe("Protected method coverage for PKField", () => {
        const pkProvider = XORMPKFieldMetadataProvider.Instance;
        
        it("should cover protected GetPropertyValue method", () => {
            const pkField = new XORMPKField();
            pkField.InitializeNew();
            // Access protected method directly via type assertion
            expect((pkProvider as any).GetPropertyValue(pkField, "Name")).toBe(pkField.Name);
        });
    });
});
