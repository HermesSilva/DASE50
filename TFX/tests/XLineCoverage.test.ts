import { describe, it, expect } from "vitest";
import { XLine } from "../src/Design/XLine.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XPoint } from "../src/Core/XGeometry.js";

class TestLine extends XLine
{
    public constructor()
    {
        super();
    }
}

describe("XLine Coverage Tests", () => {

    it("should handle Source setter with empty string", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        
        line.Source = "";
        
        expect(line.Source).toBe(XGuid.EmptyValue);
    });

    it("should handle Source setter with same value (no change)", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        const id = XGuid.NewValue();
        
        line.Source = id;
        line.Source = id; // Set same value again
        
        expect(line.Source).toBe(id);
    });

    it("should handle Source setter updating existing XLinkData", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        const id1 = XGuid.NewValue();
        const id2 = XGuid.NewValue();
        
        line.Source = id1;
        line.Source = id2; // Update existing
        
        expect(line.Source).toBe(id2);
    });

    it("should handle Target setter with empty string", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        
        line.Target = "";
        
        expect(line.Target).toBe(XGuid.EmptyValue);
    });

    it("should handle Target setter with same value (no change)", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        const id = XGuid.NewValue();
        
        line.Target = id;
        line.Target = id; // Set same value again
        
        expect(line.Target).toBe(id);
    });

    it("should handle Target setter updating existing XLinkData", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        const id1 = XGuid.NewValue();
        const id2 = XGuid.NewValue();
        
        line.Target = id1;
        line.Target = id2; // Update existing
        
        expect(line.Target).toBe(id2);
    });

    it("should return empty GUID when Source XLinkData returns empty string", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        
        // Don't set Source, or set it to empty
        const source = line.Source;
        
        expect(source).toBe(XGuid.EmptyValue);
    });

    it("should return empty GUID when Target XLinkData returns empty string", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        
        // Don't set Target, or set it to empty
        const target = line.Target;
        
        expect(target).toBe(XGuid.EmptyValue);
    });

    it("should handle getter when XLinkData.Data is empty string for Source", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        
        // Set Source to a valid ID first
        const id = XGuid.NewValue();
        line.Source = id;
        
        // Now manually set the Data to empty string to test the || branch
        const linkData = line.Values.GetChildById<any>(XLine.SourceProp.ID);
        if (linkData) {
            linkData.Data = "";
            const result = line.Source;
            expect(result).toBe(XGuid.EmptyValue);
        }
    });

    it("should handle getter when XLinkData.Data is empty string for Target", () => {
        const line = new TestLine();
        line.ID = XGuid.NewValue();
        
        // Set Target to a valid ID first
        const id = XGuid.NewValue();
        line.Target = id;
        
        // Now manually set the Data to empty string to test the || branch
        const linkData = line.Values.GetChildById<any>(XLine.TargetProp.ID);
        if (linkData) {
            linkData.Data = "";
            const result = line.Target;
            expect(result).toBe(XGuid.EmptyValue);
        }
    });
});
