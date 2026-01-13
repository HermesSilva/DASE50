/**
 * XORMFieldMetadataProvider Tests
 * Testes para o provider de metadados de XORMField
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XGuid } from "../src/Core/XGuid.js";
import {
    XORMFieldMetadataProvider,
    ORM_VALID_DATA_TYPES,
    ORM_LENGTH_DATA_TYPES,
    ORM_LENGTH_REQUIRED_DATA_TYPES,
    ORM_SCALE_DATA_TYPES,
    ORM_INTEGER_DATA_TYPES
} from "../src/Designers/ORM/XORMFieldMetadataProvider.js";

describe("XORMFieldMetadataProvider", () =>
{
    let document: XORMDocument;
    let design: XORMDesign;
    let table: XORMTable;
    let field: XORMField;
    let provider: XORMFieldMetadataProvider;

    beforeEach(() =>
    {
        // Reset singleton for test isolation
        XORMFieldMetadataProvider.ResetInstance();
        provider = XORMFieldMetadataProvider.Instance;

        document = new XORMDocument();
        design = document.Design;
        table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = "TestTable";
        design.AppendChild(table);

        field = new XORMField();
        field.ID = XGuid.NewValue();
        field.Name = "TestField";
        field.DataType = "String";
        field.Length = 50;
        table.AppendChild(field);
    });

    afterEach(() =>
    {
        XORMFieldMetadataProvider.ResetInstance();
    });

    describe("Singleton pattern", () =>
    {
        it("should return same instance", () =>
        {
            const instance1 = XORMFieldMetadataProvider.Instance;
            const instance2 = XORMFieldMetadataProvider.Instance;
            expect(instance1).toBe(instance2);
        });

        it("should return new instance after reset", () =>
        {
            const instance1 = XORMFieldMetadataProvider.Instance;
            XORMFieldMetadataProvider.ResetInstance();
            const instance2 = XORMFieldMetadataProvider.Instance;
            expect(instance1).not.toBe(instance2);
        });
    });

    describe("Constants", () =>
    {
        it("should export valid data types", () =>
        {
            expect(ORM_VALID_DATA_TYPES).toContain("String");
            expect(ORM_VALID_DATA_TYPES).toContain("Int32");
            expect(ORM_VALID_DATA_TYPES).toContain("Int64");
            expect(ORM_VALID_DATA_TYPES).toContain("Decimal");
            expect(ORM_VALID_DATA_TYPES).toContain("Numeric");
            expect(ORM_VALID_DATA_TYPES).toContain("Boolean");
            expect(ORM_VALID_DATA_TYPES).toContain("DateTime");
        });

        it("should export length data types", () =>
        {
            expect(ORM_LENGTH_DATA_TYPES).toContain("String");
            expect(ORM_LENGTH_DATA_TYPES).toContain("Numeric");
            expect(ORM_LENGTH_DATA_TYPES).toContain("Decimal");
            expect(ORM_LENGTH_DATA_TYPES).not.toContain("Int32");
        });

        it("should export length required data types", () =>
        {
            expect(ORM_LENGTH_REQUIRED_DATA_TYPES).toContain("String");
            expect(ORM_LENGTH_REQUIRED_DATA_TYPES).toContain("Numeric");
            expect(ORM_LENGTH_REQUIRED_DATA_TYPES).not.toContain("Decimal");
        });

        it("should export scale data types", () =>
        {
            expect(ORM_SCALE_DATA_TYPES).toContain("Numeric");
            expect(ORM_SCALE_DATA_TYPES).toContain("Decimal");
            expect(ORM_SCALE_DATA_TYPES).not.toContain("String");
        });

        it("should export integer data types", () =>
        {
            expect(ORM_INTEGER_DATA_TYPES).toContain("Int32");
            expect(ORM_INTEGER_DATA_TYPES).toContain("Int64");
            expect(ORM_INTEGER_DATA_TYPES).not.toContain("String");
        });
    });

    describe("GetAllPropertyIDs", () =>
    {
        it("should return all property IDs", () =>
        {
            const ids = XORMFieldMetadataProvider.GetAllPropertyIDs();
            expect(ids).toContain("Name");
            expect(ids).toContain("DataType");
            expect(ids).toContain("Length");
            expect(ids).toContain("Scale");
            expect(ids).toContain("IsNullable");
            expect(ids).toContain("IsAutoIncrement");
        });
    });

    describe("DataType rules", () =>
    {
        it("should be visible by default", () =>
        {
            const metadata = provider.GetMetadata(field, "DataType");
            expect(metadata.IsVisible).toBe(true);
        });

        it("should not be read-only for normal field", () =>
        {
            const metadata = provider.GetMetadata(field, "DataType");
            expect(metadata.IsReadOnly).toBe(false);
        });

        it("should be read-only for FK field", () =>
        {
            const targetTable = new XORMTable();
            targetTable.ID = XGuid.NewValue();
            targetTable.Name = "TargetTable";
            design.AppendChild(targetTable);

            const reference = new XORMReference();
            reference.ID = XGuid.NewValue();
            reference.Source = field.ID;
            reference.Target = targetTable.ID;
            design.AppendChild(reference);

            const metadata = provider.GetMetadata(field, "DataType");
            expect(metadata.IsReadOnly).toBe(true);
        });

        it("should provide hint for FK field", () =>
        {
            const targetTable = new XORMTable();
            targetTable.ID = XGuid.NewValue();
            targetTable.Name = "TargetTable";
            design.AppendChild(targetTable);

            const reference = new XORMReference();
            reference.ID = XGuid.NewValue();
            reference.Source = field.ID;
            reference.Target = targetTable.ID;
            design.AppendChild(reference);

            const metadata = provider.GetMetadata(field, "DataType");
            expect(metadata.Hint).toContain("Foreign Key");
        });

        it("should validate invalid data type", () =>
        {
            field.DataType = "InvalidType";
            const metadata = provider.GetMetadata(field, "DataType");
            expect(metadata.IsValid).toBe(false);
            expect(metadata.ValidationMessages.length).toBeGreaterThan(0);
        });

        it("should accept valid data types", () =>
        {
            for (const dataType of ORM_VALID_DATA_TYPES)
            {
                field.DataType = dataType;
                field.Length = dataType === "String" || dataType === "Numeric" ? 10 : 0;
                const metadata = provider.GetMetadata(field, "DataType");
                expect(metadata.IsValid).toBe(true);
            }
        });
    });

    describe("Length rules", () =>
    {
        it("should be visible for String", () =>
        {
            field.DataType = "String";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(true);
        });

        it("should be visible for Numeric", () =>
        {
            field.DataType = "Numeric";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(true);
        });

        it("should be visible for Decimal", () =>
        {
            field.DataType = "Decimal";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(true);
        });

        it("should NOT be visible for Int32", () =>
        {
            field.DataType = "Int32";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(false);
        });

        it("should NOT be visible for Int64", () =>
        {
            field.DataType = "Int64";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(false);
        });

        it("should NOT be visible for Boolean", () =>
        {
            field.DataType = "Boolean";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(false);
        });

        it("should NOT be visible for DateTime", () =>
        {
            field.DataType = "DateTime";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(false);
        });

        it("should NOT be visible for Guid", () =>
        {
            field.DataType = "Guid";
            expect(provider.IsPropertyVisible(field, "Length")).toBe(false);
        });

        it("should be required for String", () =>
        {
            field.DataType = "String";
            expect(provider.IsPropertyRequired(field, "Length")).toBe(true);
        });

        it("should be required for Numeric", () =>
        {
            field.DataType = "Numeric";
            expect(provider.IsPropertyRequired(field, "Length")).toBe(true);
        });

        it("should NOT be required for Decimal", () =>
        {
            field.DataType = "Decimal";
            expect(provider.IsPropertyRequired(field, "Length")).toBe(false);
        });

        it("should validate Length > 0 for String", () =>
        {
            field.DataType = "String";
            field.Length = 0;
            const metadata = provider.GetMetadata(field, "Length");
            expect(metadata.IsValid).toBe(false);
        });

        it("should validate Length > 0 for Numeric", () =>
        {
            field.DataType = "Numeric";
            field.Length = 0;
            const metadata = provider.GetMetadata(field, "Length");
            expect(metadata.IsValid).toBe(false);
        });

        it("should accept Length > 0 for String", () =>
        {
            field.DataType = "String";
            field.Length = 100;
            const metadata = provider.GetMetadata(field, "Length");
            expect(metadata.IsValid).toBe(true);
        });

        it("should provide different hints based on DataType", () =>
        {
            field.DataType = "String";
            const stringHint = provider.GetMetadata(field, "Length").Hint;
            expect(stringHint).toContain("character");

            field.DataType = "Numeric";
            const numericHint = provider.GetMetadata(field, "Length").Hint;
            expect(numericHint).toContain("digit");
        });
    });

    describe("Scale rules", () =>
    {
        it("should be visible for Numeric", () =>
        {
            field.DataType = "Numeric";
            expect(provider.IsPropertyVisible(field, "Scale")).toBe(true);
        });

        it("should be visible for Decimal", () =>
        {
            field.DataType = "Decimal";
            expect(provider.IsPropertyVisible(field, "Scale")).toBe(true);
        });

        it("should NOT be visible for String", () =>
        {
            field.DataType = "String";
            expect(provider.IsPropertyVisible(field, "Scale")).toBe(false);
        });

        it("should NOT be visible for Int32", () =>
        {
            field.DataType = "Int32";
            expect(provider.IsPropertyVisible(field, "Scale")).toBe(false);
        });

        it("should validate Scale <= Length", () =>
        {
            field.DataType = "Numeric";
            field.Length = 10;
            field.Scale = 15;
            const metadata = provider.GetMetadata(field, "Scale");
            expect(metadata.IsValid).toBe(false);
            expect(metadata.ValidationMessages[0].Message).toContain("exceed");
        });

        it("should accept Scale <= Length", () =>
        {
            field.DataType = "Numeric";
            field.Length = 10;
            field.Scale = 2;
            const metadata = provider.GetMetadata(field, "Scale");
            expect(metadata.IsValid).toBe(true);
        });

        it("should accept Scale = Length", () =>
        {
            field.DataType = "Decimal";
            field.Length = 5;
            field.Scale = 5;
            const metadata = provider.GetMetadata(field, "Scale");
            expect(metadata.IsValid).toBe(true);
        });
    });

    describe("IsNullable rules", () =>
    {
        it("should not be read-only for normal field", () =>
        {
            const metadata = provider.GetMetadata(field, "IsNullable");
            expect(metadata.IsReadOnly).toBe(false);
        });

        it("should provide a nullable hint", () =>
        {
            const hint = provider.GetMetadata(field, "IsNullable").Hint;
            expect(hint.length).toBeGreaterThan(0);
        });
    });

    describe("IsAutoIncrement rules", () =>
    {
        it("should be visible for Int32", () =>
        {
            field.DataType = "Int32";
            expect(provider.IsPropertyVisible(field, "IsAutoIncrement")).toBe(true);
        });

        it("should be visible for Int64", () =>
        {
            field.DataType = "Int64";
            expect(provider.IsPropertyVisible(field, "IsAutoIncrement")).toBe(true);
        });

        it("should NOT be visible for String", () =>
        {
            field.DataType = "String";
            expect(provider.IsPropertyVisible(field, "IsAutoIncrement")).toBe(false);
        });

        it("should NOT be visible for Decimal", () =>
        {
            field.DataType = "Decimal";
            expect(provider.IsPropertyVisible(field, "IsAutoIncrement")).toBe(false);
        });

        it("should NOT be visible for Boolean", () =>
        {
            field.DataType = "Boolean";
            expect(provider.IsPropertyVisible(field, "IsAutoIncrement")).toBe(false);
        });
    });

    describe("Name rules", () =>
    {
        it("should be required", () =>
        {
            expect(provider.IsPropertyRequired(field, "Name")).toBe(true);
        });

        it("should validate empty name", () =>
        {
            field.Name = "";
            const metadata = provider.GetMetadata(field, "Name");
            expect(metadata.IsValid).toBe(false);
        });

        it("should validate whitespace-only name", () =>
        {
            field.Name = "   ";
            const metadata = provider.GetMetadata(field, "Name");
            expect(metadata.IsValid).toBe(false);
        });

        it("should warn about spaces in name", () =>
        {
            field.Name = "Test Field";
            const metadata = provider.GetMetadata(field, "Name");
            expect(metadata.ValidationMessages.some(m => m.Message.includes("space"))).toBe(true);
        });

        it("should warn about invalid characters", () =>
        {
            field.Name = "123Field";
            const metadata = provider.GetMetadata(field, "Name");
            expect(metadata.ValidationMessages.some(m => m.Message.includes("start with"))).toBe(true);
        });

        it("should accept valid name", () =>
        {
            field.Name = "ValidFieldName";
            const metadata = provider.GetMetadata(field, "Name");
            expect(metadata.IsValid).toBe(true);
        });

        it("should accept underscore prefix", () =>
        {
            field.Name = "_PrivateField";
            const metadata = provider.GetMetadata(field, "Name");
            expect(metadata.IsValid).toBe(true);
        });
    });

    describe("GetAllMetadata", () =>
    {
        it("should return metadata for all registered properties", () =>
        {
            const allMetadata = provider.GetAllMetadata(field);
            expect(allMetadata.has("Name")).toBe(true);
            expect(allMetadata.has("DataType")).toBe(true);
            expect(allMetadata.has("Length")).toBe(true);
            expect(allMetadata.has("Scale")).toBe(true);
            expect(allMetadata.has("IsNullable")).toBe(true);
            expect(allMetadata.has("IsAutoIncrement")).toBe(true);
        });

        it("should reflect current element state", () =>
        {
            field.DataType = "Int32";
            const allMetadata = provider.GetAllMetadata(field);

            expect(allMetadata.get("Length")?.IsVisible).toBe(false);
            expect(allMetadata.get("Scale")?.IsVisible).toBe(false);
            expect(allMetadata.get("IsAutoIncrement")?.IsVisible).toBe(true);
        });
    });

    describe("ValidateAll", () =>
    {
        it("should collect all validation errors", () =>
        {
            field.Name = "";
            field.DataType = "InvalidType";
            field.Length = 0;

            const results = provider.ValidateAll(field);
            expect(results.length).toBeGreaterThan(0);
        });

        it("should return empty for valid field", () =>
        {
            field.Name = "ValidName";
            field.DataType = "Int32";

            const results = provider.ValidateAll(field);
            expect(results).toHaveLength(0);
        });
    });

    describe("GetFieldPropertyValue static method", () =>
    {
        it("should return correct values for all properties", () =>
        {
            field.Name = "TestName";
            field.DataType = "String";
            field.Length = 100;
            field.Scale = 2;
            field.IsNullable = false;
            field.IsAutoIncrement = false;

            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Name")).toBe("TestName");
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "DataType")).toBe("String");
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Length")).toBe(100);
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Scale")).toBe(2);
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsNullable")).toBe(false);
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsAutoIncrement")).toBe(false);
        });

        it("should return undefined for unknown property", () =>
        {
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "Unknown")).toBeUndefined();
        });

        it("should return IsForeignKey correctly", () =>
        {
            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsForeignKey")).toBe(false);

            const targetTable = new XORMTable();
            targetTable.ID = XGuid.NewValue();
            targetTable.Name = "TargetTable";
            design.AppendChild(targetTable);

            const reference = new XORMReference();
            reference.ID = XGuid.NewValue();
            reference.Source = field.ID;
            reference.Target = targetTable.ID;
            design.AppendChild(reference);

            expect(XORMFieldMetadataProvider.GetFieldPropertyValue(field, "IsForeignKey")).toBe(true);
        });
    });

    describe("Integration with FK fields", () =>
    {
        let targetTable: XORMTable;
        let reference: XORMReference;

        beforeEach(() =>
        {
            targetTable = new XORMTable();
            targetTable.ID = XGuid.NewValue();
            targetTable.Name = "TargetTable";
            targetTable.PKType = "Int64";
            design.AppendChild(targetTable);

            reference = new XORMReference();
            reference.ID = XGuid.NewValue();
            reference.Source = field.ID;
            reference.Target = targetTable.ID;
            design.AppendChild(reference);
        });

        it("should make DataType read-only for FK", () =>
        {
            expect(provider.IsPropertyReadOnly(field, "DataType")).toBe(true);
        });

        it("should include expected type in hint", () =>
        {
            // Verify that targetTable has the expected PKType
            expect(targetTable.PKType).toBe("Int64");
            
            // The reference should point to our target table
            expect(reference.Target).toBe(targetTable.ID);
            
            // Field's GetReference should return the reference
            const ref = field.GetReference();
            expect(ref).toBe(reference);
            expect(ref?.Target).toBe(targetTable.ID);
            
            // Find by target ID should return our table
            const foundTable = design.FindTableByID(reference.Target);
            expect(foundTable?.Name).toBe("TargetTable");
            expect(foundTable?.PKType).toBe("Int64");
            
            // Now check GetExpectedDataType
            const expectedDataType = field.GetExpectedDataType();
            expect(expectedDataType).toBe("Int64");
            
            const metadata = provider.GetMetadata(field, "DataType");
            expect(metadata.Hint).toContain("Int64");
        });

        it("should show all visibility states correctly for FK Int64 field", () =>
        {
            field.DataType = "Int64";
            const allMetadata = provider.GetAllMetadata(field);

            // DataType should be read-only but visible
            expect(allMetadata.get("DataType")?.IsVisible).toBe(true);
            expect(allMetadata.get("DataType")?.IsReadOnly).toBe(true);

            // Length should be hidden for Int64
            expect(allMetadata.get("Length")?.IsVisible).toBe(false);

            // Scale should be hidden for Int64
            expect(allMetadata.get("Scale")?.IsVisible).toBe(false);

            // IsAutoIncrement should be visible for Int64
            expect(allMetadata.get("IsAutoIncrement")?.IsVisible).toBe(true);
        });
    });

    describe("HasRule", () =>
    {
        it("should return true for registered properties", () =>
        {
            expect(provider.HasRule("Name")).toBe(true);
            expect(provider.HasRule("DataType")).toBe(true);
            expect(provider.HasRule("Length")).toBe(true);
            expect(provider.HasRule("Scale")).toBe(true);
            expect(provider.HasRule("IsNullable")).toBe(true);
            expect(provider.HasRule("IsAutoIncrement")).toBe(true);
        });

        it("should return false for unregistered properties", () =>
        {
            expect(provider.HasRule("Unknown")).toBe(false);
            expect(provider.HasRule("NotExists")).toBe(false);
        });
    });

    describe("GetRegisteredPropertyIDs", () =>
    {
        it("should return all registered IDs", () =>
        {
            const ids = provider.GetRegisteredPropertyIDs();
            expect(ids).toContain("Name");
            expect(ids).toContain("DataType");
            expect(ids).toContain("Length");
            expect(ids).toContain("Scale");
            expect(ids).toContain("IsNullable");
            expect(ids).toContain("IsAutoIncrement");
        });
    });
});
