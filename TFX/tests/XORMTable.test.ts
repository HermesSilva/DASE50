import { describe, it, expect } from "vitest";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMPKField } from "../src/Designers/ORM/XORMPKField.js";
import { XRectangle } from "../src/Design/XRectangle.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMTable", () =>
{
    it("should be instantiable", () =>
    {
        const table = new XORMTable();
        expect(table).toBeDefined();
        expect(table).toBeInstanceOf(XORMTable);
        expect(table).toBeInstanceOf(XRectangle);
    });

    describe("PKType property", () =>
    {
        it("should have default value Int32", () =>
        {
            const table = new XORMTable();
            expect(table.PKType).toBe("Int32");
        });

        it("should get and set PKType", () =>
        {
            const table = new XORMTable();
            table.PKType = "Int64";
            expect(table.PKType).toBe("Int64");
        });
    });

    describe("CreateField", () =>
    {
        it("should create field with default options", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField();

            expect(field).toBeInstanceOf(XORMField);
            expect(field.Name).toMatch(/^Field\d+$/);
            expect(field.DataType).toBe("String");
            expect(field.Length).toBe(0);
            expect(field.IsPrimaryKey).toBe(false); // Regular fields are never PKs
            expect(field.IsNullable).toBe(true);
            expect(field.IsAutoIncrement).toBe(false);
            expect(field.DefaultValue).toBe("");
        });

        it("should create field with custom options", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField({
                Name: "CustomField",
                DataType: "Int32",
                Length: 100,
                IsNullable: false,
                IsAutoIncrement: true,
                DefaultValue: "0"
            });

            expect(field.Name).toBe("CustomField");
            expect(field.DataType).toBe("Int32");
            expect(field.Length).toBe(100);
            expect(field.IsPrimaryKey).toBe(false); // Only XORMPKField can be PK
            expect(field.IsNullable).toBe(false);
            expect(field.IsAutoIncrement).toBe(true);
            expect(field.DefaultValue).toBe("0");
        });

        it("should append field as child", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField({ Name: "TestField" });

            expect(field.ParentNode).toBe(table);
            expect(table.ChildNodes).toContain(field);
        });

        it("should generate unique field names", () =>
        {
            const table = new XORMTable();
            const field1 = table.CreateField();
            const field2 = table.CreateField();
            const field3 = table.CreateField();

            expect(field1.Name).not.toBe(field2.Name);
            expect(field2.Name).not.toBe(field3.Name);
            expect(field1.Name).not.toBe(field3.Name);
        });
    });

    describe("PKField management", () =>
    {
        it("should initially have no PKField", () =>
        {
            const table = new XORMTable();
            expect(table.HasPKField()).toBe(false);
            expect(table.GetPKField()).toBeNull();
        });

        it("should create PKField with default values", () =>
        {
            const table = new XORMTable();
            const pkField = table.CreatePKField();

            expect(pkField).toBeInstanceOf(XORMPKField);
            expect(pkField.Name).toBe("ID");
            expect(pkField.DataType).toBe("Int32");
            expect(pkField.IsPrimaryKey).toBe(true);
            expect(pkField.IsNullable).toBe(false);
        });

        it("should create PKField with custom options", () =>
        {
            const table = new XORMTable();
            const pkField = table.CreatePKField({
                Name: "UserID",
                DataType: "Int64",
                IsAutoIncrement: false
            });

            expect(pkField.Name).toBe("UserID");
            expect(pkField.DataType).toBe("Int64");
            expect(pkField.IsAutoIncrement).toBe(false);
        });

        it("should return existing PKField instead of creating new one", () =>
        {
            const table = new XORMTable();
            const pkField1 = table.CreatePKField({ Name: "ID1" });
            const pkField2 = table.CreatePKField({ Name: "ID2" });

            expect(pkField1).toBe(pkField2);
            expect(pkField1.Name).toBe("ID1"); // Original name preserved
        });

        it("should lock DataType after creation", () =>
        {
            const table = new XORMTable();
            const pkField = table.CreatePKField({ DataType: "Int64" });

            expect(pkField.IsDataTypeLocked).toBe(true);
            pkField.DataType = "Guid"; // Should be ignored
            expect(pkField.DataType).toBe("Int64");
        });

        it("should sync table PKType with PKField DataType", () =>
        {
            const table = new XORMTable();
            table.CreatePKField({ DataType: "Guid" });

            expect(table.PKType).toBe("Guid");
        });

        it("should insert PKField as first child", () =>
        {
            const table = new XORMTable();
            const field1 = table.CreateField({ Name: "Field1" });
            const field2 = table.CreateField({ Name: "Field2" });
            const pkField = table.CreatePKField();

            expect(table.ChildNodes[0]).toBe(pkField);
            expect(table.ChildNodes.length).toBe(3);
        });

        it("should correctly identify table as having PK", () =>
        {
            const table = new XORMTable();
            expect(table.HasPKField()).toBe(false);
            
            table.CreatePKField();
            expect(table.HasPKField()).toBe(true);
        });

        it("should EnsurePKField create PK if not exists", () =>
        {
            const table = new XORMTable();
            const pkField = table.EnsurePKField();

            expect(pkField).toBeDefined();
            expect(pkField).toBeInstanceOf(XORMPKField);
            expect(table.HasPKField()).toBe(true);
        });

        it("should EnsurePKField return existing PK if exists", () =>
        {
            const table = new XORMTable();
            const existing = table.CreatePKField();
            const ensured = table.EnsurePKField();

            expect(ensured).toBe(existing);
        });
    });

    describe("DeleteField", () =>
    {
        it("should delete field from table", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField({ Name: "ToDelete" });

            const result = table.DeleteField(field);

            expect(result).toBe(true);
            expect(table.ChildNodes).not.toContain(field);
        });

        it("should return false for field not in table", () =>
        {
            const table1 = new XORMTable();
            const table2 = new XORMTable();
            const field = table1.CreateField({ Name: "Field1" });

            const result = table2.DeleteField(field);

            expect(result).toBe(false);
        });

        it("should return false when field cannot be deleted", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField({ Name: "Protected" });
            
            // Mock CanDelete to return false
            Object.defineProperty(field, "CanDelete", {
                get: () => false
            });

            const result = table.DeleteField(field);

            expect(result).toBe(false);
            expect(table.ChildNodes).toContain(field);
        });
    });

    describe("GetFields", () =>
    {
        it("should return empty array when no fields", () =>
        {
            const table = new XORMTable();
            const fields = table.GetFields();

            expect(fields).toEqual([]);
        });

        it("should return all fields", () =>
        {
            const table = new XORMTable();
            const field1 = table.CreateField({ Name: "Field1" });
            const field2 = table.CreateField({ Name: "Field2" });

            const fields = table.GetFields();

            expect(fields.length).toBe(2);
            expect(fields).toContain(field1);
            expect(fields).toContain(field2);
        });
    });

    describe("FindFieldByID", () =>
    {
        it("should find field by ID", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField({ Name: "FindMe" });

            const found = table.FindFieldByID(field.ID);

            expect(found).toBe(field);
        });

        it("should return null for non-existent ID", () =>
        {
            const table = new XORMTable();
            table.CreateField({ Name: "Other" });

            const found = table.FindFieldByID("nonexistent-id");

            expect(found).toBeNull();
        });
    });

    describe("FindFieldByName", () =>
    {
        it("should find field by name (case-insensitive)", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField({ Name: "MyField" });

            const found = table.FindFieldByName("myfield");

            expect(found).toBe(field);
        });

        it("should return null for non-existent name", () =>
        {
            const table = new XORMTable();
            table.CreateField({ Name: "Other" });

            const found = table.FindFieldByName("NonExistent");

            expect(found).toBeNull();
        });
    });

    describe("GenerateFieldName (via CreateField)", () =>
    {
        it("should generate Field1 for first field", () =>
        {
            const table = new XORMTable();
            const field = table.CreateField();

            expect(field.Name).toBe("Field1");
        });

        it("should skip existing names when generating", () =>
        {
            const table = new XORMTable();
            const field1 = table.CreateField({ Name: "Field1" });
            const field2 = table.CreateField(); // Should be Field2

            expect(field2.Name).toBe("Field2");
        });

        it("should find next available number", () =>
        {
            const table = new XORMTable();
            table.CreateField({ Name: "Field1" });
            table.CreateField({ Name: "Field2" });
            table.CreateField({ Name: "Field3" });
            
            // Delete Field2
            const fields = table.GetFields();
            const field2 = fields.find(f => f.Name === "Field2");
            if (field2)
                table.DeleteField(field2);

            // Next generated should be Field4 (since count is 3)
            const newField = table.CreateField();
            expect(newField.Name).toBe("Field4"); // Uses count + 1
        });
    });
});
