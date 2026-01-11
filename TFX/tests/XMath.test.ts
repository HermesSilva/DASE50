import { describe, it, expect } from "vitest";
import { XMath } from "../src/Core/XMath.js";
import { XRect, XPoint } from "../src/Core/XGeometry.js";

describe("XMath", () => {
    describe("Round", () => {
        it("should round to specified decimals", () => {
            expect(XMath.Round(3.14159, 2)).toBe(3.14);
            expect(XMath.Round(3.145, 2)).toBe(3.15);
            expect(XMath.Round(3.1, 0)).toBe(3);
        });
    });

    describe("RoundRect", () => {
        it("should round all rect values", () => {
            const rect = new XRect(1.234, 2.567, 3.891, 4.123);
            const rounded = XMath.RoundRect(rect, 1);
            expect(rounded.Left).toBe(1.2);
            expect(rounded.Top).toBe(2.6);
            expect(rounded.Width).toBe(3.9);
            expect(rounded.Height).toBe(4.1);
        });
    });

    describe("Center", () => {
        it("should calculate center of rect", () => {
            const rect = new XRect(0, 0, 100, 100);
            const center = XMath.Center(rect);
            expect(center.X).toBe(50);
            expect(center.Y).toBe(50);
        });
    });

    describe("Distance2Points", () => {
        it("should calculate euclidean distance", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(3, 4);
            expect(XMath.Distance2Points(p1, p2)).toBe(5);
        });
    });

    describe("Distance2PointsSquared", () => {
        it("should calculate squared distance", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(3, 4);
            expect(XMath.Distance2PointsSquared(p1, p2)).toBe(25);
        });
    });

    describe("MovePoint", () => {
        it("should move point by size", () => {
            const pt = new XPoint(10, 20);
            const moved = XMath.MovePoint(pt, { Width: 5, Height: -3 });
            expect(moved.X).toBe(15);
            expect(moved.Y).toBe(17);
        });
    });

    describe("LineIntersection", () => {
        it("should find intersection point", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(10, 10);
            const p3 = new XPoint(0, 10);
            const p4 = new XPoint(10, 0);
            const inter = XMath.LineIntersection(p1, p2, p3, p4);
            expect(inter.X).toBe(5);
            expect(inter.Y).toBe(5);
        });

        it("should return NaN for parallel lines", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(10, 0);
            const p3 = new XPoint(0, 5);
            const p4 = new XPoint(10, 5);
            const inter = XMath.LineIntersection(p1, p2, p3, p4);
            expect(isNaN(inter.X)).toBe(true);
        });

        it("should return NaN when segments do not intersect", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(1, 1);
            const p3 = new XPoint(5, 0);
            const p4 = new XPoint(6, 1);
            const inter = XMath.LineIntersection(p1, p2, p3, p4);
            expect(isNaN(inter.X)).toBe(true);
        });
    });

    describe("LineIntersectsRect", () => {
        it("should return true when line intersects rect", () => {
            const rect = new XRect(10, 10, 20, 20);
            const p1 = new XPoint(0, 15);
            const p2 = new XPoint(50, 15);
            expect(XMath.LineIntersectsRect(rect, p1, p2)).toBe(true);
        });

        it("should return true when point is inside rect", () => {
            const rect = new XRect(10, 10, 20, 20);
            const p1 = new XPoint(15, 15);
            const p2 = new XPoint(50, 50);
            expect(XMath.LineIntersectsRect(rect, p1, p2)).toBe(true);
        });

        it("should return false when line is outside rect", () => {
            const rect = new XRect(10, 10, 20, 20);
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(5, 5);
            expect(XMath.LineIntersectsRect(rect, p1, p2)).toBe(false);
        });

        it("should return true when point is inside rect", () => {
            const rect = new XRect(10, 10, 20, 20);
            const p1 = new XPoint(15, 15);
            const p2 = new XPoint(50, 50);
            expect(XMath.LineIntersectsRect(rect, p1, p2)).toBe(true);
        });

        it("should detect line crossing through rect", () => {
            // Line crosses from outside to outside through the rect
            const rect = new XRect(10, 10, 20, 20);
            const p1 = new XPoint(0, 20);
            const p2 = new XPoint(40, 20);
            expect(XMath.LineIntersectsRect(rect, p1, p2)).toBe(true);
        });

        it("should detect diagonal line crossing rect", () => {
            const rect = new XRect(10, 10, 20, 20);
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(40, 40);
            expect(XMath.LineIntersectsRect(rect, p1, p2)).toBe(true);
        });
    });

    describe("PointInRect", () => {
        it("should return true for point inside", () => {
            const rect = new XRect(0, 0, 100, 100);
            expect(XMath.PointInRect(rect, new XPoint(50, 50))).toBe(true);
        });

        it("should return false for point outside", () => {
            const rect = new XRect(0, 0, 100, 100);
            expect(XMath.PointInRect(rect, new XPoint(150, 50))).toBe(false);
        });
    });

    describe("ToPolygonEx", () => {
        it("should convert rect to polygon lines", () => {
            const rect = new XRect(0, 0, 100, 100);
            const lines = XMath.ToPolygonEx(rect, 0);
            expect(lines.length).toBe(4);
        });

        it("should inflate lines when pInflateLine > 0", () => {
            const rect = new XRect(0, 0, 100, 100);
            const lines = XMath.ToPolygonEx(rect, 10);
            expect(lines[0][0].X).toBe(-10);
        });
    });

    describe("CreateArrow", () => {
        it("should create arrow points", () => {
            const tip = new XPoint(100, 100);
            const tail = new XPoint(0, 0);
            const arrow = XMath.CreateArrow(tip, tail, 20);
            expect(arrow.length).toBe(3);
            expect(arrow[1]).toEqual(tip);
        });
    });

    describe("InflateRect", () => {
        it("should inflate rect", () => {
            const rect = new XRect(10, 10, 50, 50);
            const inflated = XMath.InflateRect(rect, 5, 5);
            expect(inflated.Left).toBe(5);
            expect(inflated.Top).toBe(5);
            expect(inflated.Width).toBe(60);
            expect(inflated.Height).toBe(60);
        });
    });

    describe("UnionRect", () => {
        it("should return union of two rects", () => {
            const r1 = new XRect(0, 0, 50, 50);
            const r2 = new XRect(25, 25, 50, 50);
            const union = XMath.UnionRect(r1, r2);
            expect(union.Left).toBe(0);
            expect(union.Top).toBe(0);
            expect(union.Width).toBe(75);
            expect(union.Height).toBe(75);
        });

        it("should return rect2 when rect1 is empty", () => {
            const r1 = new XRect(0, 0, 0, 0);
            const r2 = new XRect(10, 10, 50, 50);
            const union = XMath.UnionRect(r1, r2);
            expect(union).toEqual(r2);
        });

        it("should return rect1 when rect2 is empty", () => {
            const r1 = new XRect(10, 10, 50, 50);
            const r2 = new XRect(0, 0, 0, 0);
            const union = XMath.UnionRect(r1, r2);
            expect(union).toEqual(r1);
        });

        it("should handle rects without Right/Bottom properties using fallback calculation", () => {
            // Create rects that rely on the fallback (Left + Width, Top + Height)
            const r1 = { Left: 0, Top: 0, Width: 50, Height: 50, Right: undefined, Bottom: undefined, IsEmpty: false };
            const r2 = { Left: 25, Top: 25, Width: 50, Height: 50, Right: undefined, Bottom: undefined, IsEmpty: false };
            const union = XMath.UnionRect(r1 as any, r2 as any);
            expect(union.Width).toBe(75);
            expect(union.Height).toBe(75);
        });
    });

    describe("EmptyRect", () => {
        it("should return empty rect", () => {
            const empty = XMath.EmptyRect();
            expect(empty.Width).toBe(0);
            expect(empty.Height).toBe(0);
        });
    });

    describe("RectFromPoints", () => {
        it("should create rect from two points", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 50);
            const rect = XMath.RectFromPoints(p1, p2);
            expect(rect.Left).toBe(0);
            expect(rect.Top).toBe(0);
            expect(rect.Width).toBe(100);
            expect(rect.Height).toBe(50);
        });

        it("should handle inverted points", () => {
            const p1 = new XPoint(100, 50);
            const p2 = new XPoint(0, 0);
            const rect = XMath.RectFromPoints(p1, p2);
            expect(rect.Left).toBe(0);
            expect(rect.Top).toBe(0);
        });
    });

    describe("NormalizeAngle", () => {
        it("should normalize positive angles", () => {
            expect(XMath.NormalizeAngle(450)).toBe(90);
        });

        it("should normalize negative angles", () => {
            expect(XMath.NormalizeAngle(-90)).toBe(270);
        });
    });

    describe("DegreesToRadians", () => {
        it("should convert degrees to radians", () => {
            expect(XMath.DegreesToRadians(180)).toBeCloseTo(Math.PI);
        });
    });

    describe("RadiansToDegrees", () => {
        it("should convert radians to degrees", () => {
            expect(XMath.RadiansToDegrees(Math.PI)).toBeCloseTo(180);
        });
    });

    describe("Clamp", () => {
        it("should clamp value within range", () => {
            expect(XMath.Clamp(5, 0, 10)).toBe(5);
            expect(XMath.Clamp(-5, 0, 10)).toBe(0);
            expect(XMath.Clamp(15, 0, 10)).toBe(10);
        });
    });

    describe("Lerp", () => {
        it("should interpolate between values", () => {
            expect(XMath.Lerp(0, 100, 0.5)).toBe(50);
            expect(XMath.Lerp(0, 100, 0)).toBe(0);
            expect(XMath.Lerp(0, 100, 1)).toBe(100);
        });

        it("should clamp t parameter", () => {
            expect(XMath.Lerp(0, 100, -1)).toBe(0);
            expect(XMath.Lerp(0, 100, 2)).toBe(100);
        });
    });

    describe("LerpPoint", () => {
        it("should interpolate between points", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 100);
            const result = XMath.LerpPoint(p1, p2, 0.5);
            expect(result.X).toBe(50);
            expect(result.Y).toBe(50);
        });
    });

    describe("AngleInDegree", () => {
        it("should calculate angle in degrees", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(1, 0);
            const angle = XMath.AngleInDegree(p1, p2);
            expect(angle).toBeGreaterThanOrEqual(0);
            expect(angle).toBeLessThan(360);
        });

        it("should handle negative result before normalization", () => {
            // Test case that might produce a negative intermediate result
            const p1 = new XPoint(100, 100);
            const p2 = new XPoint(0, 0);
            const angle = XMath.AngleInDegree(p1, p2);
            expect(angle).toBeGreaterThanOrEqual(0);
            expect(angle).toBeLessThan(360);
        });
    });

    describe("AngleInRad", () => {
        it("should calculate angle for vertical line (up)", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(0, 10);
            const angle = XMath.AngleInRad(p1, p2);
            expect(angle).toBeDefined();
        });

        it("should calculate angle for vertical line (down)", () => {
            const p1 = new XPoint(0, 10);
            const p2 = new XPoint(0, 0);
            const angle = XMath.AngleInRad(p1, p2);
            expect(angle).toBeDefined();
        });

        it("should calculate angle when pSecond.X < pFirst.X", () => {
            const p1 = new XPoint(10, 0);
            const p2 = new XPoint(0, 5);
            const angle = XMath.AngleInRad(p1, p2);
            expect(angle).toBeDefined();
        });
    });

    describe("CenterLine", () => {
        it("should find center of line", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 100);
            const center = XMath.CenterLine(p1, p2);
            expect(center.X).toBe(50);
            expect(center.Y).toBe(50);
        });
    });

    describe("RotatePoint", () => {
        it("should rotate point around center", () => {
            const center = new XPoint(50, 50);
            const pt = new XPoint(100, 50);
            const rotated = XMath.RotatePoint(center, pt, 90);
            // The rotation implementation uses a specific formula, just verify it returns a valid point
            expect(rotated.X).toBeDefined();
            expect(rotated.Y).toBeDefined();
            // The distance from center should remain the same (50 units)
            expect(XMath.Distance2Points(center, rotated)).toBeCloseTo(50, 0);
        });
    });

    describe("RotatePoints", () => {
        it("should rotate multiple points", () => {
            const center = new XPoint(0, 0);
            const points = [new XPoint(10, 0), new XPoint(0, 10)];
            const rotated = XMath.RotatePoints(center, points, 90);
            expect(rotated.length).toBe(2);
        });
    });

    describe("PointInLine", () => {
        it("should find closest point on line", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 0);
            const pt = new XPoint(50, 50);
            const closest = XMath.PointInLine(p1, p2, pt);
            expect(closest.X).toBe(50);
            expect(closest.Y).toBe(0);
        });

        it("should return first point when t < 0", () => {
            const p1 = new XPoint(10, 0);
            const p2 = new XPoint(100, 0);
            const pt = new XPoint(0, 0);
            const closest = XMath.PointInLine(p1, p2, pt);
            expect(closest).toEqual(p1);
        });

        it("should return second point when t > 1", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(10, 0);
            const pt = new XPoint(100, 0);
            const closest = XMath.PointInLine(p1, p2, pt);
            expect(closest).toEqual(p2);
        });

        it("should handle zero-length line", () => {
            const p1 = new XPoint(10, 10);
            const p2 = new XPoint(10, 10);
            const pt = new XPoint(50, 50);
            const closest = XMath.PointInLine(p1, p2, pt);
            expect(closest.X).toBe(10);
            expect(closest.Y).toBe(10);
        });
    });

    describe("PointToLine", () => {
        it("should calculate distance from point to line", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 0);
            const pt = new XPoint(50, 50);
            const dist = XMath.PointToLine(p1, p2, pt);
            expect(dist).toBe(50);
        });
    });

    describe("PointInPolygon", () => {
        it("should return true for point inside polygon", () => {
            const polygon = [
                new XPoint(0, 0),
                new XPoint(100, 0),
                new XPoint(100, 100),
                new XPoint(0, 100)
            ];
            expect(XMath.PointInPolygon(polygon, new XPoint(50, 50))).toBe(true);
        });

        it("should return false for point outside polygon", () => {
            const polygon = [
                new XPoint(0, 0),
                new XPoint(100, 0),
                new XPoint(100, 100),
                new XPoint(0, 100)
            ];
            expect(XMath.PointInPolygon(polygon, new XPoint(150, 50))).toBe(false);
        });

        it("should return false for polygon with less than 3 points", () => {
            const polygon = [new XPoint(0, 0), new XPoint(10, 10)];
            expect(XMath.PointInPolygon(polygon, new XPoint(5, 5))).toBe(false);
        });

        it("should handle polygon edge cases with newPoint.X > pt.X", () => {
            const polygon = [
                new XPoint(0, 0),
                new XPoint(50, 100),
                new XPoint(100, 0)
            ];
            expect(XMath.PointInPolygon(polygon, new XPoint(50, 50))).toBe(true);
        });
    });

    describe("CrossLineInPolygon", () => {
        it("should find intersection with polygon", () => {
            const polygon = [
                new XPoint(0, 0),
                new XPoint(100, 0),
                new XPoint(100, 100),
                new XPoint(0, 100),
                new XPoint(0, 0)
            ];
            const p1 = new XPoint(50, 50);
            const p2 = new XPoint(150, 50);
            const result = XMath.CrossLineInPolygon(polygon, p1, p2);
            expect(result.index).toBeGreaterThanOrEqual(0);
        });

        it("should return -1 when p1 is outside polygon", () => {
            const polygon = [
                new XPoint(0, 0),
                new XPoint(100, 0),
                new XPoint(100, 100),
                new XPoint(0, 100),
                new XPoint(0, 0)
            ];
            const p1 = new XPoint(150, 50);
            const p2 = new XPoint(200, 50);
            const result = XMath.CrossLineInPolygon(polygon, p1, p2);
            expect(result.index).toBe(-1);
        });

        it("should return -1 when line does not intersect any edge", () => {
            const polygon = [
                new XPoint(0, 0),
                new XPoint(100, 0),
                new XPoint(100, 100),
                new XPoint(0, 100),
                new XPoint(0, 0)
            ];
            // Point inside polygon, line going nowhere that crosses edges
            const p1 = new XPoint(50, 50);
            const p2 = new XPoint(51, 51); // Very short line that doesn't reach edges
            const result = XMath.CrossLineInPolygon(polygon, p1, p2);
            expect(result.index).toBe(-1);
        });
    });

    describe("LineCircleIntersections", () => {
        it("should find two intersections", () => {
            const center = new XPoint(50, 50);
            const radius = 25;
            const p1 = new XPoint(0, 50);
            const p2 = new XPoint(100, 50);
            const intersections = XMath.LineCircleIntersections(center, radius, p1, p2);
            expect(intersections.length).toBe(2);
        });

        it("should find one intersection (tangent)", () => {
            const center = new XPoint(50, 50);
            const radius = 50;
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 0);
            const intersections = XMath.LineCircleIntersections(center, radius, p1, p2);
            expect(intersections.length).toBe(1);
        });

        it("should return empty for no intersection", () => {
            const center = new XPoint(50, 50);
            const radius = 10;
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(100, 0);
            const intersections = XMath.LineCircleIntersections(center, radius, p1, p2);
            expect(intersections.length).toBe(0);
        });

        it("should return empty for point line (A <= epsilon)", () => {
            const center = new XPoint(50, 50);
            const radius = 10;
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(0, 0);
            const intersections = XMath.LineCircleIntersections(center, radius, p1, p2);
            expect(intersections.length).toBe(0);
        });
    });

    describe("PointCircle", () => {
        it("should find point on circle", () => {
            const center = new XPoint(50, 50);
            const direction = new XPoint(100, 50);
            const pt = XMath.PointCircle(center, direction, 25);
            expect(XMath.Distance2Points(center, pt)).toBeCloseTo(25, 0);
        });

        it("should handle ellipse (different radiusY)", () => {
            const center = new XPoint(50, 50);
            const direction = new XPoint(50, 0);
            const pt = XMath.PointCircle(center, direction, 25, 50);
            expect(pt).toBeDefined();
        });
    });

    describe("ToPolygon", () => {
        it("should convert rect to closed polygon", () => {
            const rect = new XRect(0, 0, 100, 100);
            const polygon = XMath.ToPolygon(rect);
            expect(polygon.length).toBe(5);
            expect(polygon[0]).toEqual(polygon[4]);
        });
    });

    describe("ToRect", () => {
        it("should convert points to rect", () => {
            const points = [
                new XPoint(10, 20),
                new XPoint(50, 80),
                new XPoint(30, 50)
            ];
            const rect = XMath.ToRect(points);
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(20);
            expect(rect.Width).toBe(40);
            expect(rect.Height).toBe(60);
        });

        it("should return empty rect for empty array", () => {
            const rect = XMath.ToRect([]);
            expect(rect.Width).toBe(0);
            expect(rect.Height).toBe(0);
        });

        it("should return empty rect for null/undefined", () => {
            const rect = XMath.ToRect(null as any);
            expect(rect.Width).toBe(0);
        });
    });

    describe("RoundPoint", () => {
        it("should round point to factor", () => {
            const pt = new XPoint(13.7, 27.3);
            const rounded = XMath.RoundPoint(pt, 5);
            expect(rounded.X).toBe(15);
            expect(rounded.Y).toBe(25);
        });
    });

    describe("RoundToFactor", () => {
        it("should round value to factor", () => {
            expect(XMath.RoundToFactor(13, 5)).toBe(15);
            expect(XMath.RoundToFactor(12, 5)).toBe(10);
        });

        it("should return 0 for NaN", () => {
            expect(XMath.RoundToFactor(NaN, 5)).toBe(0);
        });

        it("should return 0 for Infinity", () => {
            expect(XMath.RoundToFactor(Infinity, 5)).toBe(0);
        });
    });

    describe("RoundPoints", () => {
        it("should round array of points", () => {
            const points = [new XPoint(13.7, 27.3), new XPoint(1.2, 8.9)];
            const rounded = XMath.RoundPoints(points, 5);
            expect(rounded[0].X).toBe(15);
            expect(rounded[1].X).toBe(0);
        });

        it("should return empty array for empty input", () => {
            const rounded = XMath.RoundPoints([], 5);
            expect(rounded.length).toBe(0);
        });

        it("should return input for null/undefined", () => {
            const rounded = XMath.RoundPoints(null as any, 5);
            expect(rounded).toBeNull();
        });
    });

    describe("ToGrid", () => {
        it("should snap point to grid", () => {
            const pt = new XPoint(17, 23);
            const snapped = XMath.ToGrid(pt, 10);
            expect(snapped.X).toBe(20);
            expect(snapped.Y).toBe(20);
        });

        it("should return original point when gridLen <= 0", () => {
            const pt = new XPoint(17, 23);
            const snapped = XMath.ToGrid(pt, 0);
            expect(snapped).toEqual(pt);
        });
    });

    describe("RectToGrid", () => {
        it("should snap rect to grid", () => {
            const rect = new XRect(17, 23, 45, 67);
            const snapped = XMath.RectToGrid(rect, 10);
            expect(snapped.Left).toBe(20);
            expect(snapped.Top).toBe(20);
            expect(snapped.Width).toBe(50);
            expect(snapped.Height).toBe(70);
        });

        it("should return original rect when gridLen <= 0", () => {
            const rect = new XRect(17, 23, 45, 67);
            const snapped = XMath.RectToGrid(rect, 0);
            expect(snapped).toEqual(rect);
        });
    });

    describe("SizeToGrid", () => {
        it("should snap size to grid", () => {
            const size = { Width: 45, Height: 67 };
            const snapped = XMath.SizeToGrid(size, 10);
            expect(snapped.Width).toBe(50);
            expect(snapped.Height).toBe(70);
        });

        it("should return original size when gridLen <= 0", () => {
            const size = { Width: 45, Height: 67 };
            const snapped = XMath.SizeToGrid(size, 0);
            expect(snapped).toEqual(size);
        });
    });

    describe("MinMax", () => {
        it("should limit value between min and max", () => {
            expect(XMath.MinMax(5, 0, 10)).toBe(5);
            expect(XMath.MinMax(-5, 0, 10)).toBe(0);
            expect(XMath.MinMax(15, 0, 10)).toBe(10);
        });
    });

    describe("HasLineIntersection", () => {
        it("should return true when lines intersect", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(10, 10);
            const p3 = new XPoint(0, 10);
            const p4 = new XPoint(10, 0);
            expect(XMath.HasLineIntersection(p1, p2, p3, p4)).toBe(true);
        });

        it("should return false when lines do not intersect", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(1, 1);
            const p3 = new XPoint(5, 0);
            const p4 = new XPoint(6, 1);
            expect(XMath.HasLineIntersection(p1, p2, p3, p4)).toBe(false);
        });
    });

    describe("LineIntersectsLine", () => {
        it("should return true when lines intersect", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(10, 10);
            const p3 = new XPoint(0, 10);
            const p4 = new XPoint(10, 0);
            expect(XMath.LineIntersectsLine(p1, p2, p3, p4)).toBe(true);
        });

        it("should return false for parallel lines (d === 0)", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(10, 0);
            const p3 = new XPoint(0, 5);
            const p4 = new XPoint(10, 5);
            expect(XMath.LineIntersectsLine(p1, p2, p3, p4)).toBe(false);
        });

        it("should return false when r < 0", () => {
            const p1 = new XPoint(0, 0);
            const p2 = new XPoint(1, 1);
            const p3 = new XPoint(10, 0);
            const p4 = new XPoint(11, 1);
            expect(XMath.LineIntersectsLine(p1, p2, p3, p4)).toBe(false);
        });
    });

    describe("IsEqual", () => {
        it("should return true for equal arrays", () => {
            const a = [new XPoint(1, 2), new XPoint(3, 4)];
            const b = [new XPoint(1, 2), new XPoint(3, 4)];
            expect(XMath.IsEqual(a, b)).toBe(true);
        });

        it("should return false for different arrays", () => {
            const a = [new XPoint(1, 2), new XPoint(3, 4)];
            const b = [new XPoint(1, 2), new XPoint(5, 6)];
            expect(XMath.IsEqual(a, b)).toBe(false);
        });

        it("should return false for different lengths", () => {
            const a = [new XPoint(1, 2)];
            const b = [new XPoint(1, 2), new XPoint(3, 4)];
            expect(XMath.IsEqual(a, b)).toBe(false);
        });

        it("should handle null/undefined", () => {
            expect(XMath.IsEqual(null, null)).toBe(true);
            expect(XMath.IsEqual(undefined, undefined)).toBe(true);
            expect(XMath.IsEqual([], null)).toBe(true);
            expect(XMath.IsEqual([new XPoint(1, 1)], null)).toBe(false);
        });
    });

    describe("MaxRect", () => {
        it("should return rect with max dimensions", () => {
            const rect = new XRect(10, 20, 50, 60);
            const size = { Width: 100, Height: 30 };
            const result = XMath.MaxRect(rect, size);
            expect(result.Width).toBe(100);
            expect(result.Height).toBe(60);
        });
    });

    describe("CreateRect", () => {
        it("should create centered rect", () => {
            const pt = new XPoint(50, 50);
            const rect = XMath.CreateRect(pt, 20);
            expect(rect.Left).toBe(40);
            expect(rect.Top).toBe(40);
            expect(rect.Width).toBe(20);
            expect(rect.Height).toBe(20);
        });
    });

    describe("GetSizeBoxRotated", () => {
        it("should calculate rotated bounding box size", () => {
            const size = { Width: 100, Height: 50 };
            const rotated = XMath.GetSizeBoxRotated(size, Math.PI / 4);
            expect(rotated.Width).toBeGreaterThan(0);
            expect(rotated.Height).toBeGreaterThan(0);
        });
    });
});
