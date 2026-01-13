import { describe, it, expect, beforeEach, vi } from "vitest";
import { XORMController, XORMOperationType } from "../src/Designers/ORM/XORMController.js";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XRect, XPoint } from "../src/Core/XGeometry.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";

describe("XORMController", () => {
    let controller: XORMController;
    let doc: XORMDocument;

    beforeEach(() => {
        controller = new XORMController();
        doc = new XORMDocument();
        controller.Document = doc;
    });

    it("should have a document and design", () => {
        expect(controller.Document).toBe(doc);
        expect(controller.Design).toBe(doc.Design);
    });

    it("should handle null document in operations", () => {
        controller.Document = null;
        const result = controller.ApplyOperation({ Type: XORMOperationType.AddTable, Data: { X: 0, Y: 0 } });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("No document loaded.");
    });

    it("should handle unknown operation type", () => {
        const result = controller.ApplyOperation({ Type: "Unknown" as any });
        expect(result.Success).toBe(false);
        expect(result.Message).toContain("Unknown operation type");
    });

    it("should add a table", () => {
        const result = controller.ApplyOperation({
            Type: XORMOperationType.AddTable,
            Data: { X: 100, Y: 200, Name: "TestTable" }
        });
        expect(result.Success).toBe(true);
        expect(result.ElementID).toBeDefined();
        
        const table = controller.GetTableByID(result.ElementID!);
        expect(table).toBeInstanceOf(XORMTable);
        expect(table?.Name).toBe("TestTable");
        expect(table?.Bounds.X).toBe(100);
        expect(table?.Bounds.Y).toBe(200);
    });

    it("should add a field", () => {
        const tableRes = controller.ApplyOperation({
            Type: XORMOperationType.AddTable,
            Data: { X: 100, Y: 200, Name: "Table1" }
        });
        
        const fieldRes = controller.ApplyOperation({
            Type: XORMOperationType.AddField,
            Data: { TableID: tableRes.ElementID!, Name: "Field1" }
        });
        
        expect(fieldRes.Success).toBe(true);
        const field = controller.GetElementByID(fieldRes.ElementID!) as XORMField;
        expect(field).toBeInstanceOf(XORMField);
        expect(field.Name).toBe("Field1");
    });

    it("should handle adding field to non-existent table", () => {
        const result = controller.ApplyOperation({
            Type: XORMOperationType.AddField,
            Data: { TableID: "non-existent", Name: "Field1" }
        });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Table not found.");
    });

    it("should add a reference", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });

        const result = controller.ApplyOperation({
            Type: XORMOperationType.AddReference,
            Data: { SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID!, Name: "Ref1" }
        });

        expect(result.Success).toBe(true);
        const ref = controller.GetElementByID(result.ElementID!) as XORMReference;
        expect(ref).toBeInstanceOf(XORMReference);
        expect(ref.Source).toBe(f1.ElementID);
        expect(ref.Target).toBe(t2.ElementID);
    });

    it("should handle reference creation failure", () => {
        const result = controller.AddReference({
            SourceFieldID: "invalid",
            TargetTableID: "invalid"
        });
        expect(result.Success).toBe(false);
    });

    it("should handle reference creation throwing non-Error object (line 167 branch)", () => {
        // Mock CreateReference to throw a non-Error object
        vi.spyOn(doc.Design, "CreateReference").mockImplementation(() => {
            throw "string error"; // Not an Error instance
        });
        
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        
        const result = controller.AddReference({
            SourceFieldID: f1.ElementID!,
            TargetTableID: t2.ElementID!
        });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Failed to create reference.");
    });

    it("should move an element", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const result = controller.ApplyOperation({
            Type: XORMOperationType.MoveElement,
            Data: { ElementID: t1.ElementID!, X: 500, Y: 600 }
        });

        expect(result.Success).toBe(true);
        const table = controller.GetTableByID(t1.ElementID!);
        expect(table?.Bounds.X).toBe(500);
        expect(table?.Bounds.Y).toBe(600);
    });

    it("should update references when moving a table", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 500, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        const reference = controller.GetElementByID(ref.ElementID!) as XORMReference;
        // Ensure points are set
        reference.Points = [new XPoint(0, 0), new XPoint(0, 0)];

        controller.MoveElement({ ElementID: t1.ElementID!, X: 200, Y: 200 });
        // Table at (200, 200), width 200. Right side is at 400.
        expect(reference.Points[0].X).toBe(400);
    });

    it("should update reference source points when ref.Source equals table ID", () => {
        // Create scenario to cover line 331: ref.Source === pTable.ID
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 500, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        const reference = controller.GetElementByID(ref.ElementID!) as XORMReference;
        // Set Source to be the table ID to trigger the branch
        reference.Source = t1.ElementID!;
        reference.Points = [new XPoint(0, 0), new XPoint(0, 0)];

        controller.MoveElement({ ElementID: t1.ElementID!, X: 300, Y: 300 });
        
        // After move, the first point should be updated
        const table = controller.GetTableByID(t1.ElementID!);
        expect(reference.Points[0].X).toBe(table!.Bounds.Left + table!.Bounds.Width);
    });

    it("should update references when moving target table", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 500, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        const reference = controller.GetElementByID(ref.ElementID!) as XORMReference;
        // Ensure points are set with at least 2 points
        reference.Points = [new XPoint(0, 0), new XPoint(0, 0)];

        controller.MoveElement({ ElementID: t2.ElementID!, X: 600, Y: 200 });
        // Target is t2, so last index of points should be updated.
        // t2 is at (600, 200), left side is at 600.
        expect(reference.Points[reference.Points.length - 1].X).toBe(600);
    });

    it("should update property using property key", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const result = controller.ApplyOperation({
            Type: XORMOperationType.UpdateProperty,
            Data: { ElementID: t1.ElementID!, PropertyKey: XPersistableElement.NameProp.PropertyKey!, Value: "NewName" }
        });

        expect(result.Success).toBe(true);
        const table = controller.GetTableByID(t1.ElementID!);
        expect(table?.Name).toBe("NewName");
    });

    it("should rename an element", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const result = controller.ApplyOperation({
            Type: XORMOperationType.RenameElement,
            Data: { ElementID: t1.ElementID!, NewName: "Renamed" }
        });

        expect(result.Success).toBe(true);
        const table = controller.GetTableByID(t1.ElementID!);
        expect(table?.Name).toBe("Renamed");
    });

    it("should remove elements", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });

        // Remove reference
        expect(controller.ApplyOperation({ Type: XORMOperationType.RemoveReference, ElementID: ref.ElementID }).Success).toBe(true);
        expect(controller.GetElementByID(ref.ElementID!)).toBeNull();

        // Remove field
        expect(controller.ApplyOperation({ Type: XORMOperationType.RemoveField, ElementID: f1.ElementID }).Success).toBe(true);
        expect(controller.GetElementByID(f1.ElementID!)).toBeNull();

        // Remove table
        expect(controller.ApplyOperation({ Type: XORMOperationType.RemoveTable, ElementID: t1.ElementID }).Success).toBe(true);
        expect(controller.GetElementByID(t1.ElementID!)).toBeNull();
    });

    it("should handle failures in remove", () => {
        expect(controller.RemoveElement("non-existent").Success).toBe(false);
        
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const table = controller.GetTableByID(t1.ElementID!)!;
        
        // Mock CanDelete to false
        Object.defineProperty(table, "CanDelete", { get: () => false });
        expect(controller.RemoveElement(t1.ElementID!).Success).toBe(false);

        // Fallback case in RemoveElement
        expect(controller.RemoveElement(doc.ID).Success).toBe(false);
    });

    it("should handle DeleteTable returning false when table has wrong parent", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const table = controller.GetTableByID(t1.ElementID!)!;
        
        // Mock DeleteTable to return false
        vi.spyOn(doc.Design, "DeleteTable").mockReturnValueOnce(false);
        
        const result = controller.RemoveElement(t1.ElementID!);
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Failed to delete table.");
    });

    it("should handle DeleteReference returning false when ref has wrong parent", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        // Mock DeleteReference to return false
        vi.spyOn(doc.Design, "DeleteReference").mockReturnValueOnce(false);
        
        const result = controller.RemoveElement(ref.ElementID!);
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Failed to delete reference.");
    });

    it("should handle DeleteField returning false when field has wrong parent", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const table = controller.GetTableByID(t1.ElementID!)!;
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        
        // Mock DeleteField to return false
        vi.spyOn(table, "DeleteField").mockReturnValueOnce(false);
        
        const result = controller.RemoveElement(f1.ElementID!);
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Failed to delete field.");
    });

    it("should get tables and references", () => {
        controller.AddTable({ X: 100, Y: 100 });
        controller.AddTable({ X: 100, Y: 100 });
        expect(controller.GetTables().length).toBe(2);
        expect(controller.GetReferences().length).toBe(0);
    });

    it("should RouteAllLines", () => {
        expect(controller.RouteAllLines()).toBe(true);
        controller.Document = null;
        expect(controller.RouteAllLines()).toBe(false);
    });

    it("should return null for GetElementByID when document is null", () => {
        controller.Document = null;
        expect(controller.GetElementByID("any-id")).toBeNull();
    });

    it("should return empty arrays for GetTables and GetReferences when Design is null", () => {
        controller.Document = null;
        expect(controller.GetTables()).toEqual([]);
        expect(controller.GetReferences()).toEqual([]);
    });

    it("should handle AddTable when Design is null", () => {
        controller.Document = null;
        const result = controller.AddTable({ X: 0, Y: 0, Name: "Test" });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("No design loaded.");
    });

    it("should handle AddReference when Design is null", () => {
        controller.Document = null;
        const result = controller.AddReference({ SourceFieldID: "a", TargetTableID: "b" });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("No design loaded.");
    });

    it("should handle RemoveElement when Design is null", () => {
        controller.Document = null;
        const result = controller.RemoveElement("any-id");
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("No design loaded.");
    });

    it("should handle UpdateProperty when element not found", () => {
        const result = controller.UpdateProperty({ ElementID: "non-existent", PropertyKey: "Name", Value: "test" });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Element not found.");
    });

    it("should handle MoveElement when element not found", () => {
        const result = controller.MoveElement({ ElementID: "non-existent", X: 0, Y: 0 });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Element not found.");
    });

    it("should handle RenameElement when element not found", () => {
        const result = controller.RenameElement({ ElementID: "non-existent", NewName: "test" });
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Element not found.");
    });

    it("should handle UpdateReferencesForTable when Design is null (defensive)", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const table = controller.GetTableByID(t1.ElementID!)!;
        
        // Clear document to make Design null
        controller.Document = null;
        
        // Call the private method directly - it should return early without error
        (controller as any).UpdateReferencesForTable(table);
        
        // No crash means success
        expect(true).toBe(true);
    });

    it("should handle MoveElement for non-table elements (line 245 branch)", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        // MoveElement on a field (not a table) - does not update references
        const fieldResult = controller.MoveElement({ ElementID: f1.ElementID!, X: 150, Y: 150 });
        expect(fieldResult.Success).toBe(true);
        
        // MoveElement on a reference (not a table) - does not update references
        const refResult = controller.MoveElement({ ElementID: ref.ElementID!, X: 200, Y: 200 });
        expect(refResult.Success).toBe(true);
    });

    it("should handle UpdateReferencesForTable with empty Points array (lines 333-346)", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        const reference = controller.GetElementByID(ref.ElementID!) as XORMReference;
        
        // Mock RouteAllLines to prevent automatic re-routing when Bounds change
        vi.spyOn(doc.Design, "RouteAllLines").mockImplementation(() => {});
        
        // Set Source to table ID to trigger branch at 331
        reference.Source = t1.ElementID!;
        // Set Points to empty array - branch at 333 (points.length > 0) becomes false
        reference.Points = [];
        
        // MoveElement should not crash when Points is empty
        const result = controller.MoveElement({ ElementID: t1.ElementID!, X: 300, Y: 300 });
        expect(result.Success).toBe(true);
        // Points should still be empty (no update occurred)
        expect(reference.Points.length).toBe(0);
    });

    it("should handle UpdateReferencesForTable with single Point for target (line 346 branch)", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const t2 = controller.AddTable({ X: 400, Y: 100, Name: "T2" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        const ref = controller.AddReference({ SourceFieldID: f1.ElementID!, TargetTableID: t2.ElementID! });
        
        const reference = controller.GetElementByID(ref.ElementID!) as XORMReference;
        
        // Mock RouteAllLines to prevent automatic re-routing when Bounds change
        vi.spyOn(doc.Design, "RouteAllLines").mockImplementation(() => {});
        
        // Move target table (t2) - this will trigger the ref.Target === pTable.ID branch
        // Before move, set Points to single element to skip the update (points.length > 1 is false)
        reference.Points = [new XPoint(100, 100)];
        const originalPoint = reference.Points[0];
        
        const result = controller.MoveElement({ ElementID: t2.ElementID!, X: 600, Y: 200 });
        expect(result.Success).toBe(true);
        // Since points.length is 1, the condition "points.length > 1" is false
        // and the last point should NOT be updated
        expect(reference.Points.length).toBe(1);
        // The point should remain unchanged since we skipped the update
        expect(reference.Points[0].X).toBe(originalPoint.X);
        expect(reference.Points[0].Y).toBe(originalPoint.Y);
    });

    it("should handle field removal when parent is not XORMTable (line 216 defensive branch)", () => {
        const t1 = controller.AddTable({ X: 100, Y: 100, Name: "T1" });
        const f1 = controller.AddField({ TableID: t1.ElementID!, Name: "F1" });
        
        const field = controller.GetElementByID(f1.ElementID!) as XORMField;
        // Mock ParentNode to return something that's not XORMTable
        vi.spyOn(field, "ParentNode", "get").mockReturnValueOnce(null);
        
        // Should fall through to "Unknown element type" because parent is not XORMTable
        const result = controller.RemoveElement(f1.ElementID!);
        expect(result.Success).toBe(false);
        expect(result.Message).toBe("Unknown element type.");
    });
});
