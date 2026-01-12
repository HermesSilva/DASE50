import { describe, it, expect, beforeEach } from "vitest";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMDesign Coverage Tests", () => {
    
    beforeEach(() => {
        RegisterORMElements();
    });

    describe("DeleteTable", () => {
        
        it("should return false when table parent is not the design", () => {
            const design = new XORMDesign();
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            // Don't append to design, so parent is different
            
            const result = design.DeleteTable(table);
            
            expect(result).toBe(false);
        });

        it("should return false when table CanDelete is false", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "TestTable" });
            table.CanDelete = false;
            
            const result = design.DeleteTable(table);
            
            expect(result).toBe(false);
            expect(design.GetTables()).toContain(table);
        });

        it("should delete table and remove related references", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences().length).toBe(1);
            
            const result = design.DeleteTable(table1);
            
            expect(result).toBe(true);
            expect(design.GetTables()).not.toContain(table1);
            expect(design.GetReferences().length).toBe(0); // Reference should be removed
        });
    });

    describe("DeleteReference", () => {
        
        it("should return false when reference parent is not the design", () => {
            const design = new XORMDesign();
            const ref = new XORMReference();
            ref.ID = XGuid.NewValue();
            // Don't append to design
            
            const result = design.DeleteReference(ref);
            
            expect(result).toBe(false);
        });

        it("should return false when reference CanDelete is false", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            ref.CanDelete = false;
            
            const result = design.DeleteReference(ref);
            
            expect(result).toBe(false);
            expect(design.GetReferences()).toContain(ref);
        });

        it("should delete reference successfully", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            const result = design.DeleteReference(ref);
            
            expect(result).toBe(true);
            expect(design.GetReferences()).not.toContain(ref);
        });
    });

    describe("FindTableByID", () => {
        
        it("should find table by ID", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "TestTable" });
            
            const found = design.FindTableByID(table.ID);
            
            expect(found).toBe(table);
        });

        it("should return null when table not found", () => {
            const design = new XORMDesign();
            const fakeID = XGuid.NewValue();
            
            const found = design.FindTableByID(fakeID);
            
            expect(found).toBeNull();
        });
    });

    describe("FindReferenceByID", () => {
        
        it("should find reference by ID", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            
            const found = design.FindReferenceByID(ref.ID);
            
            expect(found).toBe(ref);
        });

        it("should return null when reference not found", () => {
            const design = new XORMDesign();
            const fakeID = XGuid.NewValue();
            
            const found = design.FindReferenceByID(fakeID);
            
            expect(found).toBeNull();
        });
    });

    describe("GenerateTableName", () => {
        
        it("should generate Table1 when no tables exist", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150 });
            
            expect(table.Name).toBe("Table1");
        });

        it("should generate Table2 when Table1 exists", () => {
            const design = new XORMDesign();
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150 });
            
            expect(table2.Name).toBe("Table2");
        });

        it("should skip existing names and find next available", () => {
            const design = new XORMDesign();
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const table3 = design.CreateTable({ X: 700, Y: 100, Width: 200, Height: 150 });
            
            expect(table3.Name).toBe("Table3");
        });

        it("should handle multiple iterations in GenerateTableName loop", () => {
            const design = new XORMDesign();
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            design.CreateTable({ X: 700, Y: 100, Width: 200, Height: 150, Name: "Table3" });
            design.CreateTable({ X: 1000, Y: 100, Width: 200, Height: 150, Name: "Table4" });
            
            // This should generate Table5, testing multiple iterations
            const table5 = design.CreateTable({ X: 1300, Y: 100, Width: 200, Height: 150 });
            expect(table5.Name).toBe("Table5");
        });
    });

    describe("RemoveReferencesForTable", () => {
        
        it("should remove references where table is Target", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            design.DeleteTable(table2);
            
            expect(design.GetReferences()).not.toContain(ref);
        });
    });

    describe("CreateReference validation", () => {
        
        it("should throw error when source table not found", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const fakeID = XGuid.NewValue();
            
            expect(() => {
                design.CreateReference({ SourceID: fakeID, TargetID: table.ID, Name: "FK_Invalid" });
            }).toThrow("Source table not found.");
        });

        it("should throw error when target table not found", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const fakeID = XGuid.NewValue();
            
            expect(() => {
                design.CreateReference({ SourceID: table.ID, TargetID: fakeID, Name: "FK_Invalid" });
            }).toThrow("Target table not found.");
        });
    });

    describe("GenerateReferenceName", () => {
        
        it("should use generated name when Name option not provided", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Orders" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Customers" });
            
            // Create reference without explicit Name
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID });
            
            expect(ref.Name).toBe("Orders_Customers");
        });
    });

    describe("GenerateTableName while loop (lines 147-148)", () => {
        
        it("should loop multiple times when many consecutive names exist", () => {
            const design = new XORMDesign();
            
            // Create tables 1-10 to ensure loop executes multiple times
            for (let i = 1; i <= 10; i++) {
                design.CreateTable({ X: i * 100, Y: 100, Width: 200, Height: 150, Name: `Table${i}` });
            }
            
            // This should generate Table11, forcing loop to iterate
            const table11 = design.CreateTable({ X: 1100, Y: 100, Width: 200, Height: 150 });
            expect(table11.Name).toBe("Table11");
        });

        it("should handle gap in table naming", () => {
            const design = new XORMDesign();
            
            // Create Table1 and Table3, leaving Table2 available
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 300, Y: 100, Width: 200, Height: 150, Name: "Table3" });
            
            // Length is 2, so idx starts at 3, loop finds Table3 exists, increments to Table4
            const newTable = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150 });
            expect(newTable.Name).toBe("Table4");
        });
    });

    describe("CreateTable default values (lines 38-41)", () => {
        
        it("should use default X when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ Y: 100, Width: 200, Height: 150, Name: "Test" });
            
            expect(table.Bounds.Left).toBe(0);
        });

        it("should use default Y when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Width: 200, Height: 150, Name: "Test" });
            
            expect(table.Bounds.Top).toBe(0);
        });

        it("should use default Width when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Height: 150, Name: "Test" });
            
            expect(table.Bounds.Width).toBe(200);
        });

        it("should use default Height when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Name: "Test" });
            
            expect(table.Bounds.Height).toBe(150);
        });
    });

    describe("RemoveReferencesForTable (line 134)", () => {
        
        it("should remove reference when table is Source", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            // Delete table1 (Source) should remove reference
            design.DeleteTable(table1);
            
            expect(design.GetReferences()).not.toContain(ref);
        });

        it("should NOT remove references when table is neither Source nor Target", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const table3 = design.CreateTable({ X: 700, Y: 100, Width: 200, Height: 150, Name: "Table3" });
            const ref = design.CreateReference({ SourceID: table1.ID, TargetID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            // Delete table3 (unrelated) should NOT remove reference
            design.DeleteTable(table3);
            
            expect(design.GetReferences()).toContain(ref);
        });
    });
});
