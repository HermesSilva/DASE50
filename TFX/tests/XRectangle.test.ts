import { describe, it, expect } from "vitest";
import { XRectangle, XLineCap, XLineJoin, XCursor } from "../src/Design/XRectangle.js";
import { XRect, XColor, XThickness, XBorderColor, XAlignment, XPoint } from "../src/Core/XGeometry.js";

describe("XRectangle", () => {
    it("should have default property values", () => {
        const rect = new XRectangle();
        expect(rect.Bounds).toEqual(new XRect(0, 0, 0, 0));
        expect(rect.MinWidth).toBe(0);
        expect(rect.MinHeight).toBe(0);
        expect(rect.MaxWidth).toBe(Number.MAX_SAFE_INTEGER);
        expect(rect.MaxHeight).toBe(Number.MAX_SAFE_INTEGER);
        expect(rect.RadiusX).toBe(0);
        expect(rect.RadiusY).toBe(0);
        expect(rect.Fill).toEqual(XColor.Transparent);
        expect(rect.Stroke).toEqual(XColor.Black);
        expect(rect.StrokeThickness).toBe(1);
        expect(rect.StrokeDashArray).toEqual([]);
        expect(rect.StrokeDashOffset).toBe(0);
        expect(rect.StrokeLineCap).toBe(XLineCap.Flat);
        expect(rect.StrokeLineJoin).toBe(XLineJoin.Miter);
        expect(rect.Margin).toEqual(new XThickness(0));
        expect(rect.Padding).toEqual(new XThickness(0));
        expect(rect.Opacity).toBe(1);
        expect(rect.Visible).toBe(true);
        expect(rect.Enabled).toBe(true);
        expect(rect.IsHitTestVisible).toBe(true);
        expect(rect.BorderColor).toEqual(new XBorderColor(XColor.Black));
        expect(rect.BorderThickness).toEqual(new XThickness(0));
        expect(rect.HorizontalAlignment).toBe(XAlignment.None);
        expect(rect.VerticalAlignment).toBe(XAlignment.None);
        expect(rect.ZIndex).toBe(0);
        expect(rect.Cursor).toBe(XCursor.Default);
        expect(rect.ClipToBounds).toBe(false);
        expect(rect.Rotation).toBe(0);
        expect(rect.ScaleX).toBe(1);
        expect(rect.ScaleY).toBe(1);
        expect(rect.SkewX).toBe(0);
        expect(rect.SkewY).toBe(0);
        expect(rect.TransformOriginX).toBe(0.5);
        expect(rect.TransformOriginY).toBe(0.5);
        expect(rect.ShadowColor).toEqual(XColor.Transparent);
        expect(rect.ShadowOffsetX).toBe(0);
        expect(rect.ShadowOffsetY).toBe(0);
        expect(rect.ShadowBlur).toBe(0);
        expect(rect.ShadowSpread).toBe(0);
        expect(rect.Tag).toBe("");
        expect(rect.Tooltip).toBe("");
    });

    it("should allow getting and setting all properties", () => {
        const rect = new XRectangle();
        
        rect.Bounds = new XRect(10, 20, 30, 40);
        expect(rect.Bounds).toEqual(new XRect(10, 20, 30, 40));
        expect(rect.Left).toBe(10);
        expect(rect.Top).toBe(20);
        expect(rect.Width).toBe(30);
        expect(rect.Height).toBe(40);
        expect(rect.Right).toBe(40);
        expect(rect.Bottom).toBe(60);

        rect.MinWidth = 5;
        expect(rect.MinWidth).toBe(5);

        rect.MinHeight = 6;
        expect(rect.MinHeight).toBe(6);

        rect.MaxWidth = 100;
        expect(rect.MaxWidth).toBe(100);

        rect.MaxHeight = 200;
        expect(rect.MaxHeight).toBe(200);

        rect.RadiusX = 2;
        expect(rect.RadiusX).toBe(2);

        rect.RadiusY = 3;
        expect(rect.RadiusY).toBe(3);

        rect.Fill = XColor.Red;
        expect(rect.Fill).toEqual(XColor.Red);

        rect.Stroke = XColor.Blue;
        expect(rect.Stroke).toEqual(XColor.Blue);

        rect.StrokeThickness = 2;
        expect(rect.StrokeThickness).toBe(2);

        rect.StrokeDashArray = [1, 2];
        expect(rect.StrokeDashArray).toEqual([1, 2]);

        rect.StrokeDashOffset = 1;
        expect(rect.StrokeDashOffset).toBe(1);

        rect.StrokeLineCap = XLineCap.Round;
        expect(rect.StrokeLineCap).toBe(XLineCap.Round);

        rect.StrokeLineJoin = XLineJoin.Bevel;
        expect(rect.StrokeLineJoin).toBe(XLineJoin.Bevel);

        rect.Margin = new XThickness(1, 2, 3, 4);
        expect(rect.Margin).toEqual(new XThickness(1, 2, 3, 4));

        rect.Padding = new XThickness(5, 6, 7, 8);
        expect(rect.Padding).toEqual(new XThickness(5, 6, 7, 8));

        rect.Opacity = 0.5;
        expect(rect.Opacity).toBe(0.5);

        rect.Visible = false;
        expect(rect.Visible).toBe(false);

        rect.Enabled = false;
        expect(rect.Enabled).toBe(false);

        rect.IsHitTestVisible = false;
        expect(rect.IsHitTestVisible).toBe(false);

        const bc = new XBorderColor(XColor.Red, XColor.Green, XColor.Blue, XColor.Yellow);
        rect.BorderColor = bc;
        expect(rect.BorderColor).toEqual(bc);

        rect.BorderThickness = new XThickness(1);
        expect(rect.BorderThickness).toEqual(new XThickness(1));

        rect.HorizontalAlignment = XAlignment.Center;
        expect(rect.HorizontalAlignment).toBe(XAlignment.Center);

        rect.VerticalAlignment = XAlignment.Stretch;
        expect(rect.VerticalAlignment).toBe(XAlignment.Stretch);

        rect.ZIndex = 10;
        expect(rect.ZIndex).toBe(10);

        rect.Cursor = XCursor.Hand ?? XCursor.Pointer; // XCursor.Pointer is in the enum
        rect.Cursor = XCursor.Pointer;
        expect(rect.Cursor).toBe(XCursor.Pointer);

        rect.ClipToBounds = true;
        expect(rect.ClipToBounds).toBe(true);

        rect.Rotation = 45;
        expect(rect.Rotation).toBe(45);

        rect.ScaleX = 2;
        expect(rect.ScaleX).toBe(2);

        rect.ScaleY = 3;
        expect(rect.ScaleY).toBe(3);

        rect.SkewX = 10;
        expect(rect.SkewX).toBe(10);

        rect.SkewY = 20;
        expect(rect.SkewY).toBe(20);

        rect.TransformOriginX = 0;
        expect(rect.TransformOriginX).toBe(0);

        rect.TransformOriginY = 1;
        expect(rect.TransformOriginY).toBe(1);

        rect.ShadowColor = XColor.Gray;
        expect(rect.ShadowColor).toEqual(XColor.Gray);

        rect.ShadowOffsetX = 5;
        expect(rect.ShadowOffsetX).toBe(5);

        rect.ShadowOffsetY = 10;
        expect(rect.ShadowOffsetY).toBe(10);

        rect.ShadowBlur = 15;
        expect(rect.ShadowBlur).toBe(15);

        rect.ShadowSpread = 5;
        expect(rect.ShadowSpread).toBe(5);

        rect.Tag = "test-tag";
        expect(rect.Tag).toBe("test-tag");

        rect.Tooltip = "test-tooltip";
        expect(rect.Tooltip).toBe("test-tooltip");
    });

    it("should calculate Center correctly", () => {
        const rect = new XRectangle();
        rect.Bounds = new XRect(10, 10, 100, 200);
        const center = rect.Center;
        expect(center.X).toBe(60);
        expect(center.Y).toBe(110);
    });

    it("should provide helper getters", () => {
        const rect = new XRectangle();
        rect.Bounds = new XRect(10, 20, 100, 50);
        
        // HasShadow cases
        expect(rect.HasShadow).toBe(false);
        
        rect.ShadowColor = XColor.Black;
        rect.ShadowBlur = 5;
        expect(rect.HasShadow).toBe(true);
        
        rect.ShadowBlur = 0;
        rect.ShadowSpread = 5;
        expect(rect.HasShadow).toBe(true);
        
        rect.ShadowSpread = 0;
        expect(rect.HasShadow).toBe(false);

        // HasTransform cases
        expect(rect.HasTransform).toBe(false);
        rect.Rotation = 10;
        expect(rect.HasTransform).toBe(true);
        rect.Rotation = 0;
        rect.ScaleX = 1.1;
        expect(rect.HasTransform).toBe(true);
        rect.ScaleX = 1;
        rect.ScaleY = 2;
        expect(rect.HasTransform).toBe(true);
        rect.ScaleY = 1;
        rect.SkewX = 1;
        expect(rect.HasTransform).toBe(true);
        rect.SkewX = 0;
        rect.SkewY = 1;
        expect(rect.HasTransform).toBe(true);

        expect(rect.IsVisible).toBe(true);
        rect.Visible = false;
        expect(rect.IsVisible).toBe(false);
        rect.Visible = true;
        rect.Opacity = 0;
        expect(rect.IsVisible).toBe(false);
    });

    it("should test ContainsPoint", () => {
        const rect = new XRectangle();
        rect.Bounds = new XRect(10, 10, 100, 100);
        expect(rect.ContainsPoint(new XPoint(50, 50))).toBe(true);
        expect(rect.ContainsPoint(new XPoint(10, 10))).toBe(true);
        expect(rect.ContainsPoint(new XPoint(110, 110))).toBe(true);
        expect(rect.ContainsPoint(new XPoint(5, 5))).toBe(false);
        expect(rect.ContainsPoint(new XPoint(115, 115))).toBe(false);
    });

    it("should test IntersectsWith", () => {
        const rect = new XRectangle();
        rect.Bounds = new XRect(10, 10, 100, 100);
        expect(rect.IntersectsWith(new XRect(50, 50, 100, 100))).toBe(true);
        expect(rect.IntersectsWith(new XRect(120, 120, 50, 50))).toBe(false);
    });

    it("should test MoveTo and MoveBy", () => {
        const rect = new XRectangle();
        rect.Bounds = new XRect(10, 10, 100, 100);
        rect.MoveTo(50, 60);
        expect(rect.Left).toBe(50);
        expect(rect.Top).toBe(60);
        expect(rect.Width).toBe(100);

        rect.MoveBy(10, -5);
        expect(rect.Left).toBe(60);
        expect(rect.Top).toBe(55);
    });

    it("should test ResizeTo and respect constraints", () => {
        const rect = new XRectangle();
        rect.Bounds = new XRect(0, 0, 100, 100);
        rect.MinWidth = 50;
        rect.MinHeight = 50;
        rect.MaxWidth = 150;
        rect.MaxHeight = 150;

        rect.ResizeTo(80, 80);
        expect(rect.Width).toBe(80);
        expect(rect.Height).toBe(80);

        rect.ResizeTo(40, 40);
        expect(rect.Width).toBe(50);
        expect(rect.Height).toBe(50);

        rect.ResizeTo(200, 200);
        expect(rect.Width).toBe(150);
        expect(rect.Height).toBe(150);
    });

    it("should test SetUniformRadius and SetUniformScale", () => {
        const rect = new XRectangle();
        rect.SetUniformRadius(10);
        expect(rect.RadiusX).toBe(10);
        expect(rect.RadiusY).toBe(10);

        rect.SetUniformScale(2.5);
        expect(rect.ScaleX).toBe(2.5);
        expect(rect.ScaleY).toBe(2.5);
    });
});
