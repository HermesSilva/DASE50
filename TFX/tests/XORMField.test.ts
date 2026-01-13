import { describe, it, expect } from "vitest";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XField } from "../src/Design/XField.js";

describe("XORMField", () => {
    it("should be instantiable", () => {
        const field = new XORMField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XORMField);
        expect(field).toBeInstanceOf(XField);
    });

    it("should have default property values", () => {
        const field = new XORMField();
        expect(field.DataType).toBe("String");
        expect(field.Length).toBe(0);
        expect(field.IsPrimaryKey).toBe(false);
        expect(field.IsNullable).toBe(true);
        expect(field.IsAutoIncrement).toBe(false);
        expect(field.DefaultValue).toBe("");
    });

    it("should allow getting and setting DataType", () => {
        const field = new XORMField();
        field.DataType = "Int32";
        expect(field.DataType).toBe("Int32");
        
        field.DataType = "DateTime";
        expect(field.DataType).toBe("DateTime");
    });

    it("should allow getting and setting Length", () => {
        const field = new XORMField();
        field.Length = 255;
        expect(field.Length).toBe(255);
        
        field.Length = 50;
        expect(field.Length).toBe(50);
    });

    it("should allow getting and setting IsPrimaryKey", () => {
        const field = new XORMField();
        field.IsPrimaryKey = true;
        expect(field.IsPrimaryKey).toBe(true);
        
        field.IsPrimaryKey = false;
        expect(field.IsPrimaryKey).toBe(false);
    });

    it("should allow getting and setting IsNullable", () => {
        const field = new XORMField();
        field.IsNullable = false;
        expect(field.IsNullable).toBe(false);
        
        field.IsNullable = true;
        expect(field.IsNullable).toBe(true);
    });

    it("should allow getting and setting IsAutoIncrement", () => {
        const field = new XORMField();
        field.IsAutoIncrement = true;
        expect(field.IsAutoIncrement).toBe(true);
        
        field.IsAutoIncrement = false;
        expect(field.IsAutoIncrement).toBe(false);
    });

    it("should allow getting and setting DefaultValue", () => {
        const field = new XORMField();
        field.DefaultValue = "test";
        expect(field.DefaultValue).toBe("test");
        
        field.DefaultValue = "another value";
        expect(field.DefaultValue).toBe("another value");
    });

    describe("DataType property", () => {
        it("should accept all common data type names", () => {
            const field = new XORMField();
            
            field.DataType = "String";
            expect(field.DataType).toBe("String");
            
            field.DataType = "Int32";
            expect(field.DataType).toBe("Int32");
            
            field.DataType = "Int64";
            expect(field.DataType).toBe("Int64");
            
            field.DataType = "Numeric";
            expect(field.DataType).toBe("Numeric");
            
            field.DataType = "Boolean";
            expect(field.DataType).toBe("Boolean");
            
            field.DataType = "DateTime";
            expect(field.DataType).toBe("DateTime");
            
            field.DataType = "Guid";
            expect(field.DataType).toBe("Guid");
            
            field.DataType = "Binary";
            expect(field.DataType).toBe("Binary");
            
            field.DataType = "Text";
            expect(field.DataType).toBe("Text");
        });
    });
});
