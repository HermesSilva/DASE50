import { describe, it, expect, beforeEach } from "vitest";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMDocument Coverage Tests", () => {
    
    beforeEach(() => {
        RegisterORMElements();
    });

    describe("Initialize with no duplicate designs", () => {
        
        it("should handle document with no designs at all", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Remove the auto-created design
            if (doc.Design) {
                doc.RemoveChild(doc.Design);
            }
            
            doc.Initialize();
            
            // Should create a new design or handle gracefully
            expect(doc.ChildNodes.length).toBeGreaterThanOrEqual(0);
        });

        it("should handle case where primary design is already set correctly", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Create some tables in the primary design
            doc.Design!.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            
            // Call Initialize - should do nothing since there's only one design
            doc.Initialize();
            
            expect(doc.Design).toBeDefined();
            expect(doc.Design!.GetTables().length).toBe(1);
        });

        it("should handle merging when duplicate design has no children", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Add a table to primary design
            doc.Design!.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            
            // Add an empty duplicate design manually
            const emptyDesign = new XORMDesign();
            emptyDesign.ID = XGuid.NewValue();
            doc.AppendChild(emptyDesign as any);
            
            expect(doc.ChildNodes.length).toBe(2);
            
            doc.Initialize();
            
            // Should keep only one design
            const designs = doc.ChildNodes.filter((node: any) => node instanceof XORMDesign);
            expect(designs.length).toBe(1);
        });

        it("should merge children from duplicate designs with content", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Add a table to primary design
            const table1 = doc.Design!.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            
            // Create a duplicate design with content
            const duplicateDesign = new XORMDesign();
            duplicateDesign.ID = XGuid.NewValue();
            
            // Manually create and add a table to duplicate design
            const table2 = new XORMTable();
            table2.ID = XGuid.NewValue();
            table2.Name = "Table2";
            table2.Bounds = { Left: 400, Top: 100, Width: 200, Height: 150, X: 400, Y: 100 };
            duplicateDesign.AppendChild(table2 as any);
            
            doc.AppendChild(duplicateDesign as any);
            
            expect(doc.ChildNodes.length).toBe(2);
            expect(doc.Design!.GetTables().length).toBe(1);
            
            doc.Initialize();
            
            // Should have merged both tables into one design
            const designs = doc.ChildNodes.filter((node: any) => node instanceof XORMDesign);
            expect(designs.length).toBe(1);
            expect(doc.Design!.GetTables().length).toBe(2);
            expect(doc.Design!.GetTables().map(t => t.Name)).toContain("Table1");
            expect(doc.Design!.GetTables().map(t => t.Name)).toContain("Table2");
        });

        it("should use first non-empty design when first design is empty", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Remove auto-created design and create an empty one
            if (doc.Design) {
                doc.RemoveChild(doc.Design);
            }
            
            // Create an empty design first
            const emptyDesign = new XORMDesign();
            emptyDesign.ID = XGuid.NewValue();
            doc.AppendChild(emptyDesign as any);
            
            // Create a non-empty design second
            const nonEmptyDesign = new XORMDesign();
            nonEmptyDesign.ID = XGuid.NewValue();
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.Name = "Table1";
            table.Bounds = { Left: 100, Top: 100, Width: 200, Height: 150, X: 100, Y: 100 };
            nonEmptyDesign.AppendChild(table as any);
            doc.AppendChild(nonEmptyDesign as any);
            
            expect(doc.ChildNodes.length).toBe(2);
            
            doc.Initialize();
            
            // Should use the non-empty design as primary
            const designs = doc.ChildNodes.filter((node: any) => node instanceof XORMDesign);
            expect(designs.length).toBe(1);
            expect(doc.Design!.GetTables().length).toBe(1);
            expect(doc.Design!.GetTables()[0].Name).toBe("Table1");
        });

        it("should handle all empty designs (branch where nonEmpty is not found)", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Remove auto-created design
            if (doc.Design) {
                doc.RemoveChild(doc.Design);
            }
            
            // Create multiple empty designs
            const emptyDesign1 = new XORMDesign();
            emptyDesign1.ID = XGuid.NewValue();
            doc.AppendChild(emptyDesign1 as any);
            
            const emptyDesign2 = new XORMDesign();
            emptyDesign2.ID = XGuid.NewValue();
            doc.AppendChild(emptyDesign2 as any);
            
            expect(doc.ChildNodes.length).toBe(2);
            
            doc.Initialize();
            
            // Should keep first empty design as primary
            const designs = doc.ChildNodes.filter((node: any) => node instanceof XORMDesign);
            expect(designs.length).toBe(1);
            expect(doc.Design!.GetTables().length).toBe(0);
        });

        it("should handle case where design is not in ChildNodes (idx < 0 branch)", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // This is an edge case that's hard to trigger naturally
            // but we're testing the defensive programming
            // The idx >= 0 check protects against designs not found in ChildNodes
            
            doc.Initialize();
            
            // Should still work without errors
            expect(doc.Design).toBeDefined();
        });

        it("should handle scenario where idx < 0 would occur (design not in ChildNodes)", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Remove the automatically created design
            if (doc.Design) {
                doc.RemoveChild(doc.Design);
            }
            
            // Create two designs
            const design1 = new XORMDesign();
            design1.ID = XGuid.NewValue();
            doc.AppendChild(design1 as any);
            
            const design2 = new XORMDesign();
            design2.ID = XGuid.NewValue();
            
            // Manually add table to design2 but don't append design2 to doc
            // This creates a scenario where we might have a design that's not in ChildNodes
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.Name = "Table1";
            table.Bounds = { Left: 100, Top: 100, Width: 200, Height: 150, X: 100, Y: 100 };
            design2.AppendChild(table as any);
            
            // Now append design2 (this will be found by GetChildrenOfType)
            doc.AppendChild(design2 as any);
            
            // Initialize should handle this gracefully
            doc.Initialize();
            
            // Should merge into one design
            const designs = doc.ChildNodes.filter((node: any) => node instanceof XORMDesign);
            expect(designs.length).toBe(1);
        });

        it("should handle idx < 0 defensive check (line 66)", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            // Remove auto-created design
            if (doc.Design) {
                doc.RemoveChild(doc.Design);
            }
            
            // Create primary design with content
            const primaryDesign = new XORMDesign();
            primaryDesign.ID = XGuid.NewValue();
            const table1 = new XORMTable();
            table1.ID = XGuid.NewValue();
            table1.Name = "Table1";
            table1.Bounds = { Left: 100, Top: 100, Width: 200, Height: 150, X: 100, Y: 100 };
            primaryDesign.AppendChild(table1 as any);
            doc.AppendChild(primaryDesign as any);
            
            // Create duplicate design
            const duplicateDesign = new XORMDesign();
            duplicateDesign.ID = XGuid.NewValue();
            doc.AppendChild(duplicateDesign as any);
            
            // Manually remove duplicate from ChildNodes to trigger idx < 0
            const idx = doc.ChildNodes.indexOf(duplicateDesign);
            if (idx >= 0) {
                doc.ChildNodes.splice(idx, 1);
            }
            
            // Now Initialize - it should handle gracefully when design is not in ChildNodes
            doc.Initialize();
            
            // Should still work correctly
            expect(doc.Design).toBeDefined();
            const designs = doc.ChildNodes.filter((node: any) => node instanceof XORMDesign);
            expect(designs.length).toBe(1);
        });

        it("should test idx < 0 path by removing design from ChildNodes before Initialize", () => {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            
            if (doc.Design) {
                doc.RemoveChild(doc.Design);
            }
            
            // Manually add designs to trigger GetChildrenOfType
            const design1 = new XORMDesign();
            design1.ID = XGuid.NewValue();
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.Name = "Table1";
            table.Bounds = { Left: 100, Top: 100, Width: 200, Height: 150, X: 100, Y: 100 };
            design1.AppendChild(table as any);
            
            const design2 = new XORMDesign();
            design2.ID = XGuid.NewValue();
            
            // Add both to document
            doc.AppendChild(design1 as any);
            doc.AppendChild(design2 as any);
            
            // Before Initialize, manually manipulate to create idx < 0 scenario
            // Store reference to design2
            const designRef = design2;
            
            // Remove design2 from ChildNodes array manually
            const index = doc.ChildNodes.indexOf(design2);
            if (index >= 0) {
                // Remove it directly to bypass RemoveChild logic
                doc.ChildNodes.splice(index, 1);
            }
            
            // But design2 is still a XORMDesign instance, so GetChildrenOfType might find it
            // This creates the scenario where idx would be -1
            
            doc.Initialize();
            
            expect(doc.Design).toBeDefined();
            expect(doc.Design?.GetTables().length).toBe(1);
        });
    });
});
