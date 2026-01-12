import { describe, it, expect } from "vitest";
import { XLine } from "../src/Design/XLine.js";
import { XPoint } from "../src/Core/XGeometry.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XElementRegistry } from "../src/Data/XElementRegistry.js";

// Create a concrete test line class since XLine is abstract
class XTestLine extends XLine {
    public constructor() {
        super();
    }
}

// Create a concrete test document class to hold the line
class XTestDocument extends XPersistableElement {
    public constructor() {
        super();
    }
}

describe("Point[] Serialization Test", () => {
    it("should serialize and deserialize Point[] property correctly", () => {
        // Register test elements
        XElementRegistry.Instance.Register({
            TagName: "XTestDocument",
            Constructor: XTestDocument
        });
        
        XElementRegistry.Instance.Register({
            TagName: "XTestLine",
            Constructor: XTestLine
        });
        
        // Create a line with points
        const line = new XTestLine();
        line.ID = "test-line-001";
        line.Name = "TestLine";
        
        const points = [
            new XPoint(100, 200),
            new XPoint(300, 400),
            new XPoint(500, 600)
        ];
        
        line.Points = points;
        
        console.log("BEFORE SERIALIZATION:");
        console.log("  Points:", JSON.stringify(line.Points));
        console.log("  Point[0].X:", line.Points[0]?.X);
        console.log("  Point[0] constructor:", line.Points[0]?.constructor.name);
        
        // Create document and add line
        const doc = new XTestDocument();
        doc.ID = "test-doc";
        doc.Name = "TestDoc";
        doc.AppendChild(line);
        
        // Serialize using correct API
        const engine = XSerializationEngine.Instance;
        const result = engine.Serialize(doc);
        
        expect(result.Success).toBe(true);
        expect(result.XmlOutput).toBeDefined();
        
        const xml = result.XmlOutput!;
        
        console.log("\nSERIALIZED XML:");
        console.log(xml);
        
        // Deserialize
        const loadResult = engine.Deserialize<XTestDocument>(xml);
        
        console.log("\nDESERIALIZATION RESULT:");
        console.log("  Success:", loadResult.Success);
        console.log("  Errors:", JSON.stringify(loadResult.Errors));
        
        expect(loadResult.Success).toBe(true);
        expect(loadResult.Data).toBeDefined();
        
        const deserializedDoc = loadResult.Data!;
        const deserializedLine = deserializedDoc.ChildNodes[0] as XLine;
        
        console.log("\nAFTER DESERIALIZATION:");
        console.log("  Points:", JSON.stringify(deserializedLine.Points));
        console.log("  Points length:", deserializedLine.Points?.length);
        console.log("  Point[0]:", deserializedLine.Points[0]);
        console.log("  Point[0].X:", deserializedLine.Points[0]?.X);
        console.log("  Point[0].Y:", deserializedLine.Points[0]?.Y);
        console.log("  Point[0] constructor:", deserializedLine.Points[0]?.constructor.name);
        console.log("  Point[1].X:", deserializedLine.Points[1]?.X);
        console.log("  Point[1].Y:", deserializedLine.Points[1]?.Y);
        
        // Verify
        expect(deserializedLine.Points).toBeDefined();
        expect(deserializedLine.Points.length).toBe(3);
        expect(deserializedLine.Points[0].X).toBe(100);
        expect(deserializedLine.Points[0].Y).toBe(200);
        expect(deserializedLine.Points[1].X).toBe(300);
        expect(deserializedLine.Points[1].Y).toBe(400);
        expect(deserializedLine.Points[2].X).toBe(500);
        expect(deserializedLine.Points[2].Y).toBe(600);
        
        // Verify they are XPoint instances
        expect(deserializedLine.Points[0]).toBeInstanceOf(XPoint);
        expect(deserializedLine.Points[1]).toBeInstanceOf(XPoint);
        expect(deserializedLine.Points[2]).toBeInstanceOf(XPoint);
    });
});
