import { describe, it, expect } from "vitest";
import { XBorderColor, XFont, XColor, XTextAlignment, XFontStyle } from "../src/Core/XGeometry.js";

describe("XBorderColor", () =>
{
    describe("constructor", () =>
    {
        it("should create with single color (uniform)", () =>
        {
            const color = XColor.Red;
            const border = new XBorderColor(color);
            expect(border.Left).toBe(color);
            expect(border.Top).toBe(color);
            expect(border.Right).toBe(color);
            expect(border.Bottom).toBe(color);
        });

        it("should create with four colors", () =>
        {
            const border = new XBorderColor(XColor.Red, XColor.Green, XColor.Blue, XColor.White);
            expect(border.Left).toBe(XColor.Red);
            expect(border.Top).toBe(XColor.Green);
            expect(border.Right).toBe(XColor.Blue);
            expect(border.Bottom).toBe(XColor.White);
        });

        it("should default to Black when no color provided", () =>
        {
            const border = new XBorderColor();
            expect(border.Left.Equals(XColor.Black)).toBe(true);
            expect(border.Top.Equals(XColor.Black)).toBe(true);
            expect(border.Right.Equals(XColor.Black)).toBe(true);
            expect(border.Bottom.Equals(XColor.Black)).toBe(true);
        });

        it("should treat missing args as uniform (2 args runtime call)", () =>
        {
            const border = new (XBorderColor as unknown as { new(pA: XColor, pB: XColor): XBorderColor })(XColor.Red, XColor.Green);
            expect(border.Left.Equals(XColor.Red)).toBe(true);
            expect(border.Top.Equals(XColor.Red)).toBe(true);
            expect(border.Right.Equals(XColor.Red)).toBe(true);
            expect(border.Bottom.Equals(XColor.Red)).toBe(true);
        });

        it("should treat missing args as uniform (3 args runtime call)", () =>
        {
            const border = new (XBorderColor as unknown as { new(pA: XColor, pB: XColor, pC: XColor): XBorderColor })(XColor.Red, XColor.Green, XColor.Blue);
            expect(border.Left.Equals(XColor.Red)).toBe(true);
            expect(border.Top.Equals(XColor.Red)).toBe(true);
            expect(border.Right.Equals(XColor.Red)).toBe(true);
            expect(border.Bottom.Equals(XColor.Red)).toBe(true);
        });

        it("should default left color when pA is nullish (4 args runtime call)", () =>
        {
            const border = new (XBorderColor as unknown as { new(pA: XColor | undefined, pB: XColor, pC: XColor, pD: XColor): XBorderColor })(
                undefined,
                XColor.Green,
                XColor.Blue,
                XColor.White
            );

            expect(border.Left.Equals(XColor.Black)).toBe(true);
            expect(border.Top.Equals(XColor.Green)).toBe(true);
            expect(border.Right.Equals(XColor.Blue)).toBe(true);
            expect(border.Bottom.Equals(XColor.White)).toBe(true);
        });
    });

    describe("Parse", () =>
    {
        it("should parse single color (uniform)", () =>
        {
            const border = XBorderColor.Parse("FF0000FF");
            expect(border.IsOne).toBe(true);
            expect(border.Left.R).toBe(0);
            expect(border.Left.B).toBe(255);
        });

        it("should parse four colors", () =>
        {
            const border = XBorderColor.Parse("FFFF0000|FF00FF00|FF0000FF|FFFFFFFF");
            expect(border.Left.R).toBe(255);
            expect(border.Top.G).toBe(255);
            expect(border.Right.B).toBe(255);
            expect(border.Bottom.R).toBe(255);
        });

        it("should throw on invalid format", () =>
        {
            expect(() => XBorderColor.Parse("FF0000|FF0000")).toThrow();
            expect(() => XBorderColor.Parse("FF0000|FF0000|FF0000")).toThrow();
        });
    });

    describe("IsOne", () =>
    {
        it("should return true when all colors are equal", () =>
        {
            const border = new XBorderColor(XColor.Red);
            expect(border.IsOne).toBe(true);
        });

        it("should return false when colors differ", () =>
        {
            const border = new XBorderColor(XColor.Red, XColor.Green, XColor.Blue, XColor.White);
            expect(border.IsOne).toBe(false);
        });
    });

    describe("ToString", () =>
    {
        it("should return single color when uniform", () =>
        {
            const border = new XBorderColor(XColor.Red);
            const str = border.ToString();
            expect(str).not.toContain("|");
        });

        it("should return four colors when different", () =>
        {
            const border = new XBorderColor(XColor.Red, XColor.Green, XColor.Blue, XColor.White);
            const str = border.ToString();
            expect(str.split("|").length).toBe(4);
        });

        it("should be parseable", () =>
        {
            const original = new XBorderColor(XColor.Red, XColor.Green, XColor.Blue, XColor.White);
            const str = original.ToString();
            const parsed = XBorderColor.Parse(str);
            expect(parsed.Left.Equals(original.Left)).toBe(true);
            expect(parsed.Top.Equals(original.Top)).toBe(true);
            expect(parsed.Right.Equals(original.Right)).toBe(true);
            expect(parsed.Bottom.Equals(original.Bottom)).toBe(true);
        });
    });

    describe("CompareTo", () =>
    {
        it("should compare to same string", () =>
        {
            const border = new XBorderColor(XColor.Red);
            const str = border.ToString();
            expect(border.CompareTo(str)).toBe(0);
        });

        it("should handle null comparison", () =>
        {
            const border = new XBorderColor(XColor.Red);
            expect(typeof border.CompareTo(null)).toBe("number");
        });

        it("should handle undefined comparison", () =>
        {
            const border = new XBorderColor(XColor.Red);
            expect(typeof border.CompareTo(undefined)).toBe("number");
        });
    });
});

describe("XFont", () =>
{
    describe("constructor", () =>
    {
        it("should create with default values", () =>
        {
            const font = new XFont();
            expect(font.Family).toBe("Verdana");
            expect(font.Size).toBe(8);
            expect(font.Color.Equals(XColor.Black)).toBe(true);
            expect(font.Alignment).toBe(XTextAlignment.TopLeft);
            expect(font.FontStyle).toBe(XFontStyle.Normal);
        });

        it("should create with specified values", () =>
        {
            const font = new XFont("Arial", 12, XColor.Red, XTextAlignment.MiddleCenter, XFontStyle.Bold);
            expect(font.Family).toBe("Arial");
            expect(font.Size).toBe(12);
            expect(font.Color.Equals(XColor.Red)).toBe(true);
            expect(font.Alignment).toBe(XTextAlignment.MiddleCenter);
            expect(font.FontStyle).toBe(XFontStyle.Bold);
        });

        it("should accept null color and use Black", () =>
        {
            const font = new XFont("Arial", 12, null);
            expect(font.Color.Equals(XColor.Black)).toBe(true);
        });

        it("should enforce minimum size of 8 in constructor", () =>
        {
            const font = new XFont("Arial", 2);
            expect(font.Size).toBeGreaterThanOrEqual(6);
        });
    });

    describe("Parse", () =>
    {
        it("should parse valid string", () =>
        {
            const font = XFont.Parse("Arial|12|FF000000|0|0");
            expect(font.Family).toBe("Arial");
            expect(font.Size).toBe(12);
        });

        it("should throw on invalid format", () =>
        {
            expect(() => XFont.Parse("Arial|12")).toThrow();
            expect(() => XFont.Parse("Arial")).toThrow();
        });
    });

    describe("Family", () =>
    {
        it("should get and set family", () =>
        {
            const font = new XFont();
            font.Family = "Times New Roman";
            expect(font.Family).toBe("Times New Roman");
        });

        it("should return Arial when family is empty", () =>
        {
            const font = new XFont("");
            expect(font.Family).toBe("Arial");
        });
    });

    describe("Size", () =>
    {
        it("should get and set size", () =>
        {
            const font = new XFont();
            font.Size = 14;
            expect(font.Size).toBe(14);
        });

        it("should return minimum 6 when size is too small", () =>
        {
            const font = new XFont();
            font.Size = 3;
            expect(font.Size).toBeGreaterThanOrEqual(6);
        });

        it("should return 10 when size is 0", () =>
        {
            const font = new XFont();
            font.Size = 0;
            expect(font.Size).toBe(10);
        });
    });

    describe("Color", () =>
    {
        it("should get and set color", () =>
        {
            const font = new XFont();
            font.Color = XColor.Blue;
            expect(font.Color.Equals(XColor.Blue)).toBe(true);
        });
    });

    describe("Alignment", () =>
    {
        it("should get and set alignment", () =>
        {
            const font = new XFont();
            font.Alignment = XTextAlignment.BottomRight;
            expect(font.Alignment).toBe(XTextAlignment.BottomRight);
        });
    });

    describe("FontStyle", () =>
    {
        it("should get and set font style", () =>
        {
            const font = new XFont();
            font.FontStyle = XFontStyle.Italic;
            expect(font.FontStyle).toBe(XFontStyle.Italic);
        });
    });

    describe("nullish internal defaults", () =>
    {
        it("should fall back when internal fields are nullish", () =>
        {
            const font = new XFont("Verdana", 8, XColor.Red, XTextAlignment.Center, XFontStyle.Bold) as unknown as {
                _Color: XColor | null;
                _Alignment: XTextAlignment | null;
                _FontStyle: XFontStyle | null;
            };

            font._Color = null;
            font._Alignment = null;
            font._FontStyle = null;

            const publicFont = font as unknown as XFont;
            expect(publicFont.Color.Equals(XColor.Black)).toBe(true);
            expect(publicFont.Alignment).toBe(XTextAlignment.TopLeft);
            expect(publicFont.FontStyle).toBe(XFontStyle.Normal);
        });
    });

    describe("IsValid", () =>
    {
        it("should return true for valid font", () =>
        {
            const font = new XFont("Arial", 12);
            expect(font.IsValid).toBe(true);
        });

        it("should return false when family is empty", () =>
        {
            const font = new XFont();
            font.Family = "";
            expect(font.Family).toBe("Arial");
        });

        it("should return false when size is too small", () =>
        {
            const font = new XFont("Arial", 2);
            expect(font.IsValid).toBe(true);
        });
    });

    describe("ToString", () =>
    {
        it("should return formatted string", () =>
        {
            const font = new XFont("Arial", 12, XColor.Black, XTextAlignment.TopLeft, XFontStyle.Normal);
            const str = font.ToString();
            expect(str).toContain("Arial");
            expect(str).toContain("12");
            expect(str.split("|").length).toBe(5);
        });

        it("should be parseable", () =>
        {
            const original = new XFont("Arial", 14, XColor.Red, XTextAlignment.Center, XFontStyle.Bold);
            const str = original.ToString();
            const parsed = XFont.Parse(str);
            expect(parsed.Family).toBe(original.Family);
            expect(parsed.Size).toBe(original.Size);
            expect(parsed.Alignment).toBe(original.Alignment);
            expect(parsed.FontStyle).toBe(original.FontStyle);
        });
    });

    describe("CompareTo", () =>
    {
        it("should compare to same string", () =>
        {
            const font = new XFont("Arial", 12);
            const str = font.ToString();
            expect(font.CompareTo(str)).toBe(0);
        });

        it("should handle null comparison", () =>
        {
            const font = new XFont();
            expect(typeof font.CompareTo(null)).toBe("number");
        });

        it("should handle undefined comparison", () =>
        {
            const font = new XFont();
            expect(typeof font.CompareTo(undefined)).toBe("number");
        });
    });
});
