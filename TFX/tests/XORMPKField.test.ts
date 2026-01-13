import { describe, it, expect, beforeEach } from "vitest";
import { XORMPKField } from "../src/Designers/ORM/XORMPKField.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMPKField", () => {
    describe("Instantiation and inheritance", () => {
        it("should be instantiable", () => {
            const pkField = new XORMPKField();
            expect(pkField).toBeDefined();
            expect(pkField).toBeInstanceOf(XORMPKField);
        });

        it("should inherit from XORMField", () => {
            const pkField = new XORMPKField();
            expect(pkField).toBeInstanceOf(XORMField);
        });
    });

    describe("Default values", () => {
        it("should have default DataType of Int32", () => {
            const pkField = new XORMPKField();
            expect(pkField.DataType).toBe("Int32");
        });

        it("should have default Name of ID", () => {
            const pkField = new XORMPKField();
            expect(pkField.Name).toBe("ID");
        });

        it("should have IsNullable always false", () => {
            const pkField = new XORMPKField();
            expect(pkField.IsNullable).toBe(false);
        });

        it("should have IsPrimaryKey always true", () => {
            const pkField = new XORMPKField();
            expect(pkField.IsPrimaryKey).toBe(true);
        });

        it("should have IsAutoIncrement true for Int32", () => {
            const pkField = new XORMPKField();
            expect(pkField.IsAutoIncrement).toBe(true);
        });
    });

    describe("DataType restrictions", () => {
        it("should allow setting DataType to Int32", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Int32";
            expect(pkField.DataType).toBe("Int32");
        });

        it("should allow setting DataType to Int64", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Int64";
            expect(pkField.DataType).toBe("Int64");
        });

        it("should allow setting DataType to Guid", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Guid";
            expect(pkField.DataType).toBe("Guid");
        });

        it("should allow any DataType values at model level (validation happens in validator/metadata)", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "String";
            expect(pkField.DataType).toBe("String");
        });
    });

    describe("DataType locking", () => {
        it("should not be locked by default", () => {
            const pkField = new XORMPKField();
            expect(pkField.IsDataTypeLocked).toBe(false);
        });

        it("should allow setting DataType before locking", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Int64";
            expect(pkField.DataType).toBe("Int64");
        });

        it("should lock DataType after LockDataType is called", () => {
            const pkField = new XORMPKField();
            pkField.LockDataType();
            expect(pkField.IsDataTypeLocked).toBe(true);
        });

        it("should ignore DataType changes after locking", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Int64";
            pkField.LockDataType();
            pkField.DataType = "Guid"; // Should be ignored
            expect(pkField.DataType).toBe("Int64");
        });
    });

    describe("IsNullable immutability", () => {
        it("should always be false regardless of setter call", () => {
            const pkField = new XORMPKField();
            pkField.IsNullable = true; // Should be ignored
            expect(pkField.IsNullable).toBe(false);
        });
    });

    describe("IsPrimaryKey immutability", () => {
        it("should always be true", () => {
            const pkField = new XORMPKField();
            expect(pkField.IsPrimaryKey).toBe(true);
        });
    });

    describe("IsAutoIncrement based on DataType", () => {
        it("should be true for Int32", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Int32";
            expect(pkField.IsAutoIncrement).toBe(true);
        });

        it("should be true for Int64", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Int64";
            expect(pkField.IsAutoIncrement).toBe(true);
        });

        it("should be false for Guid", () => {
            const pkField = new XORMPKField();
            pkField.DataType = "Guid";
            expect(pkField.IsAutoIncrement).toBe(false);
        });
    });

    describe("Static constants", () => {
        it("should have DEFAULT_PK_DATA_TYPE constant", () => {
            expect(XORMPKField.DEFAULT_PK_DATA_TYPE).toBe("Int32");
        });

        it("should have DEFAULT_PK_NAME constant", () => {
            expect(XORMPKField.DEFAULT_PK_NAME).toBe("ID");
        });
    });

    describe("Integration with XORMTable", () => {
        let table: XORMTable;

        beforeEach(() => {
            table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.Name = "TestTable";
        });

        it("should be addable to a table", () => {
            const pkField = new XORMPKField();
            pkField.ID = XGuid.NewValue();
            table.AppendChild(pkField);
            expect(pkField.ParentNode).toBe(table);
        });

        it("should be recognized as PK by table.HasPKField()", () => {
            const pkField = new XORMPKField();
            pkField.ID = XGuid.NewValue();
            table.AppendChild(pkField);
            expect(table.HasPKField()).toBe(true);
        });

        it("should be retrievable via table.GetPKField()", () => {
            const pkField = new XORMPKField();
            pkField.ID = XGuid.NewValue();
            table.AppendChild(pkField);
            expect(table.GetPKField()).toBe(pkField);
        });

        it("should be included in GetFields()", () => {
            const pkField = new XORMPKField();
            pkField.ID = XGuid.NewValue();
            table.AppendChild(pkField);
            
            const regularField = new XORMField();
            regularField.ID = XGuid.NewValue();
            regularField.Name = "RegularField";
            table.AppendChild(regularField);

            const fields = table.GetFields();
            expect(fields.length).toBe(2);
            expect(fields).toContain(pkField);
            expect(fields).toContain(regularField);
        });
    });

    describe("Name property", () => {
        it("should allow setting Name to custom value", () => {
            const pkField = new XORMPKField();
            pkField.Name = "CustomID";
            expect(pkField.Name).toBe("CustomID");
        });

        it("should allow setting Name to table-specific ID", () => {
            const pkField = new XORMPKField();
            pkField.Name = "UserID";
            expect(pkField.Name).toBe("UserID");
        });
    });
});
