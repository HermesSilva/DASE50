import { describe, it, expect } from "vitest";
import { XColor, XHSLColor } from "../src/Core/XGeometry.js";

describe("XColor", () =>
{
    describe("constructor", () =>
    {
        it("should create with RGB values (3 params)", () =>
        {
            const color = new XColor(255, 128, 64);
            expect(color.A).toBe(255);
            expect(color.R).toBe(255);
            expect(color.G).toBe(128);
            expect(color.B).toBe(64);
        });

        it("should create with ARGB values (4 params)", () =>
        {
            const color = new XColor(128, 255, 128, 64);
            expect(color.A).toBe(128);
            expect(color.R).toBe(255);
            expect(color.G).toBe(128);
            expect(color.B).toBe(64);
        });

        it("should default missing channels when called with fewer args", () =>
        {
            const color = new (XColor as unknown as { new(pA: number, pR: number): XColor })(1, 2);
            expect(color.A).toBe(255);
            expect(color.R).toBe(1);
            expect(color.G).toBe(2);
            expect(color.B).toBe(0);
        });
    });

    describe("static colors", () =>
    {
        it("Transparent should have A=0", () =>
        {
            expect(XColor.Transparent.A).toBe(0);
        });

        it("Black should be 0,0,0", () =>
        {
            expect(XColor.Black.R).toBe(0);
            expect(XColor.Black.G).toBe(0);
            expect(XColor.Black.B).toBe(0);
        });

        it("White should be 255,255,255", () =>
        {
            expect(XColor.White.R).toBe(255);
            expect(XColor.White.G).toBe(255);
            expect(XColor.White.B).toBe(255);
        });

        it("Red should be 255,0,0", () =>
        {
            expect(XColor.Red.R).toBe(255);
            expect(XColor.Red.G).toBe(0);
            expect(XColor.Red.B).toBe(0);
        });

        it("Green should be 0,255,0", () =>
        {
            expect(XColor.Green.R).toBe(0);
            expect(XColor.Green.G).toBe(255);
            expect(XColor.Green.B).toBe(0);
        });

        it("Blue should be 0,0,255", () =>
        {
            expect(XColor.Blue.R).toBe(0);
            expect(XColor.Blue.G).toBe(0);
            expect(XColor.Blue.B).toBe(255);
        });
    });

    describe("Parse", () =>
    {
        it("should parse valid hex string", () =>
        {
            const color = XColor.Parse("FF102030");
            expect(color.A).toBe(255);
            expect(color.R).toBe(16);
            expect(color.G).toBe(32);
            expect(color.B).toBe(48);
        });

        it("should throw on invalid length", () =>
        {
            expect(() => XColor.Parse("FF1020")).toThrow();
            expect(() => XColor.Parse("FF10203040")).toThrow();
        });

        it("should throw on odd-length hex inside decoder", () =>
        {
            expect(() => (XColor as unknown as { DecodeHex(pValue: string): number }).DecodeHex("ABC")).toThrow(/Invalid hex/i);
        });
    });



    describe("normalized values", () =>
    {
        it("Ri should return R/255", () =>
        {
            const color = new XColor(255, 127, 0);
            expect(color.Ri).toBeCloseTo(1, 2);
        });

        it("Gi should return G/255", () =>
        {
            const color = new XColor(0, 255, 0);
            expect(color.Gi).toBeCloseTo(1, 2);
        });

        it("Bi should return B/255", () =>
        {
            const color = new XColor(0, 0, 255);
            expect(color.Bi).toBeCloseTo(1, 2);
        });
    });

    describe("IsTransparent", () =>
    {
        it("should return true when A=0", () =>
        {
            const color = new XColor(0, 255, 255, 255);
            expect(color.IsTransparent).toBe(true);
        });

        it("should return false when A>0", () =>
        {
            const color = new XColor(1, 255, 255, 255);
            expect(color.IsTransparent).toBe(false);
        });
    });

    describe("Darkness", () =>
    {
        it("should return low value for dark colors", () =>
        {
            expect(XColor.Black.Darkness).toBeLessThan(0.1);
        });

        it("should return high value for light colors", () =>
        {
            expect(XColor.White.Darkness).toBeGreaterThan(0.9);
        });
    });

    describe("Inverse", () =>
    {
        it("should return light color for dark input", () =>
        {
            const inverse = XColor.Black.Inverse;
            expect(inverse.Darkness).toBeGreaterThan(0.9);
        });

        it("should return dark color for light input", () =>
        {
            const inverse = XColor.White.Inverse;
            expect(inverse.Darkness).toBeLessThan(0.1);
        });
    });

    describe("ToString", () =>
    {
        it("should return hex string", () =>
        {
            const color = new XColor(255, 16, 32, 48);
            expect(color.ToString()).toBe("FF102030");
        });
    });

    describe("Equals", () =>
    {
        it("should return true for equal colors", () =>
        {
            const a = new XColor(255, 100, 150, 200);
            const b = new XColor(255, 100, 150, 200);
            expect(a.Equals(b)).toBe(true);
        });

        it("should return false for different colors", () =>
        {
            const a = new XColor(255, 100, 150, 200);
            const b = new XColor(255, 100, 150, 201);
            expect(a.Equals(b)).toBe(false);
        });
    });

    describe("GetHashCode", () =>
    {
        it("should return consistent hash", () =>
        {
            const color = new XColor(255, 100, 150, 200);
            const hash1 = color.GetHashCode();
            const hash2 = color.GetHashCode();
            expect(hash1).toBe(hash2);
        });

        it("should return different hash for different colors", () =>
        {
            const a = new XColor(255, 100, 150, 200);
            const b = new XColor(255, 100, 150, 201);
            expect(a.GetHashCode()).not.toBe(b.GetHashCode());
        });
    });
});

describe("XHSLColor", () =>
{
    describe("constructor", () =>
    {
        it("should create with HSL values", () =>
        {
            const hsl = new XHSLColor(0.5, 0.6, 0.7);
            expect(hsl.H).toBe(0.5);
            expect(hsl.S).toBe(0.6);
            expect(hsl.L).toBe(0.7);
        });
    });

    describe("SetLuminance", () =>
    {
        it("should return new HSL with changed luminance", () =>
        {
            const hsl = new XHSLColor(0.5, 0.6, 0.3);
            const newHsl = hsl.SetLuminance(0.8);
            expect(newHsl.H).toBe(0.5);
            expect(newHsl.S).toBe(0.6);
            expect(newHsl.L).toBe(0.8);
        });

        it("should not modify original", () =>
        {
            const hsl = new XHSLColor(0.5, 0.6, 0.3);
            hsl.SetLuminance(0.8);
            expect(hsl.L).toBe(0.3);
        });
    });

    describe("FromRgb", () =>
    {
        it("should convert black to HSL", () =>
        {
            const hsl = XHSLColor.FromRgb(XColor.Black);
            expect(hsl.L).toBe(0);
        });

        it("should convert white to HSL", () =>
        {
            const hsl = XHSLColor.FromRgb(XColor.White);
            expect(hsl.L).toBe(1);
        });

        it("should convert red to HSL", () =>
        {
            const hsl = XHSLColor.FromRgb(XColor.Red);
            expect(hsl.H).toBeCloseTo(0, 1);
            expect(hsl.S).toBe(1);
            expect(hsl.L).toBe(0.5);
        });

        it("should convert green to HSL (max=g branch)", () =>
        {
            const hsl = XHSLColor.FromRgb(XColor.Green);
            expect(hsl.H).toBeCloseTo(1 / 3, 1);
            expect(hsl.S).toBe(1);
            expect(hsl.L).toBe(0.5);
        });

        it("should convert blue to HSL (max=b branch)", () =>
        {
            const hsl = XHSLColor.FromRgb(XColor.Blue);
            expect(hsl.H).toBeCloseTo(2 / 3, 1);
            expect(hsl.S).toBe(1);
            expect(hsl.L).toBe(0.5);
        });

        it("should handle gray (max=min branch)", () =>
        {
            const gray = new XColor(128, 128, 128);
            const hsl = XHSLColor.FromRgb(gray);
            expect(hsl.S).toBe(0);
        });

        it("should handle red with g<b (wrap around)", () =>
        {
            const color = new XColor(255, 0, 128);
            const hsl = XHSLColor.FromRgb(color);
            expect(hsl.H).toBeGreaterThan(0.8);
        });
    });

    describe("ToRgb", () =>
    {
        it("should convert HSL to RGB", () =>
        {
            const rgb = XHSLColor.ToRgb(0, 1, 0.5);
            expect(rgb.R).toBe(255);
            expect(rgb.G).toBe(0);
            expect(rgb.B).toBe(0);
        });

        it("should handle grayscale (S=0)", () =>
        {
            const rgb = XHSLColor.ToRgb(0, 0, 0.5);
            expect(rgb.R).toBe(rgb.G);
            expect(rgb.G).toBe(rgb.B);
        });

        it("should wrap hue below 0 (internal t<0 path)", () =>
        {
            const rgb = XHSLColor.ToRgb(0.1, 1, 0.5);
            expect(rgb.R).toBeGreaterThanOrEqual(0);
            expect(rgb.R).toBeLessThanOrEqual(255);
            expect(rgb.G).toBeGreaterThanOrEqual(0);
            expect(rgb.G).toBeLessThanOrEqual(255);
            expect(rgb.B).toBeGreaterThanOrEqual(0);
            expect(rgb.B).toBeLessThanOrEqual(255);
        });

        it("should wrap hue above 1 (internal t>1 path)", () =>
        {
            const rgb = XHSLColor.ToRgb(0.9, 1, 0.5);
            expect(rgb.R).toBeGreaterThanOrEqual(0);
            expect(rgb.R).toBeLessThanOrEqual(255);
            expect(rgb.G).toBeGreaterThanOrEqual(0);
            expect(rgb.G).toBeLessThanOrEqual(255);
            expect(rgb.B).toBeGreaterThanOrEqual(0);
            expect(rgb.B).toBeLessThanOrEqual(255);
        });

        it("should use the pL<0.5 q-branch", () =>
        {
            const rgb = XHSLColor.ToRgb(0.25, 1, 0.25);
            expect(rgb.R).toBeGreaterThanOrEqual(0);
            expect(rgb.R).toBeLessThanOrEqual(255);
        });
    });

    describe("roundtrip conversion", () =>
    {
        it("should preserve color through RGB->HSL->RGB", () =>
        {
            const original = new XColor(255, 100, 150, 200);
            const hsl = XHSLColor.FromRgb(original);
            const converted = XHSLColor.ToRgb(hsl.H, hsl.S, hsl.L);

            expect(converted.R).toBeCloseTo(original.R, 0);
            expect(converted.G).toBeCloseTo(original.G, 0);
            expect(converted.B).toBeCloseTo(original.B, 0);
        });
    });
});
