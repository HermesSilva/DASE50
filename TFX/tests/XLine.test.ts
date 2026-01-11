import { describe, it, expect } from "vitest";
import { XLine } from "../src/Design/XLine.js";
import { XPoint, XColor } from "../src/Core/XGeometry.js";

describe("XLine", () => {
    it("should have default property values", () => {
        const line = new XLine();
        expect(line.Points).toEqual([]);
        expect(line.Stroke).toEqual(XColor.Black);
        expect(line.StrokeThickness).toBe(1);
    });

    it("should allow getting and setting Points", () => {
        const line = new XLine();
        const pts = [new XPoint(0, 0), new XPoint(10, 10)];
        line.Points = pts;
        expect(line.Points).toEqual(pts);
    });

    it("should allow getting and setting Stroke", () => {
        const line = new XLine();
        line.Stroke = XColor.Red;
        expect(line.Stroke).toEqual(XColor.Red);
    });

    it("should allow getting and setting StrokeThickness", () => {
        const line = new XLine();
        line.StrokeThickness = 5;
        expect(line.StrokeThickness).toBe(5);
    });
});
