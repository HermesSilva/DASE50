import { XDesignElement } from "./XDesignElement.js";
import { XProperty } from "../Core/XProperty.js";
import { XColor, XThickness, XBorderColor, XAlignment, XRect, XPoint } from "../Core/XGeometry.js";

export enum XLineCap
{
    Flat = 0,
    Round = 1,
    Square = 2
}

export enum XLineJoin
{
    Miter = 0,
    Bevel = 1,
    Round = 2
}

export enum XCursor
{
    Default = 0,
    Pointer = 1,
    Crosshair = 2,
    Move = 3,
    Text = 4,
    Wait = 5,
    Help = 6,
    NotAllowed = 7,
    ResizeNS = 8,
    ResizeEW = 9,
    ResizeNESW = 10,
    ResizeNWSE = 11,
    Grab = 12,
    Grabbing = 13
}

export class XRectangle extends XDesignElement
{
    public static readonly BoundsProp = XProperty.Register<XRectangle, XRect>(
        (p: XRectangle) => p.Bounds,
        "00000001-0001-0001-0003-000000000001",
        "Bounds",
        "Bounds",
        new XRect(0, 0, 0, 0)
    );

    public static readonly MinWidthProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.MinWidth,
        "00000001-0001-0001-0003-000000000011",
        "MinWidth",
        "Minimum Width",
        0
    );

    public static readonly MinHeightProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.MinHeight,
        "00000001-0001-0001-0003-000000000012",
        "MinHeight",
        "Minimum Height",
        0
    );

    public static readonly MaxWidthProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.MaxWidth,
        "00000001-0001-0001-0003-000000000013",
        "MaxWidth",
        "Maximum Width",
        Number.MAX_SAFE_INTEGER
    );

    public static readonly MaxHeightProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.MaxHeight,
        "00000001-0001-0001-0003-000000000014",
        "MaxHeight",
        "Maximum Height",
        Number.MAX_SAFE_INTEGER
    );

    public static readonly RadiusXProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.RadiusX,
        "00000001-0001-0001-0003-000000000005",
        "RadiusX",
        "Radius X",
        0
    );

    public static readonly RadiusYProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.RadiusY,
        "00000001-0001-0001-0003-000000000006",
        "RadiusY",
        "Radius Y",
        0
    );

    public static readonly FillProp = XProperty.Register<XRectangle, XColor>(
        (p: XRectangle) => p.Fill,
        "00000001-0001-0001-0003-000000000007",
        "Fill",
        "Fill Color",
        XColor.Transparent
    );

    public static readonly StrokeProp = XProperty.Register<XRectangle, XColor>(
        (p: XRectangle) => p.Stroke,
        "00000001-0001-0001-0003-000000000008",
        "Stroke",
        "Stroke Color",
        XColor.Black
    );

    public static readonly StrokeThicknessProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.StrokeThickness,
        "00000001-0001-0001-0003-000000000009",
        "StrokeThickness",
        "Stroke Thickness",
        1
    );

    public static readonly StrokeDashArrayProp = XProperty.Register<XRectangle, number[]>(
        (p: XRectangle) => p.StrokeDashArray,
        "00000001-0001-0001-0003-000000000015",
        "StrokeDashArray",
        "Stroke Dash Pattern",
        []
    );

    public static readonly StrokeDashOffsetProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.StrokeDashOffset,
        "00000001-0001-0001-0003-000000000016",
        "StrokeDashOffset",
        "Stroke Dash Offset",
        0
    );

    public static readonly StrokeLineCapProp = XProperty.Register<XRectangle, XLineCap>(
        (p: XRectangle) => p.StrokeLineCap,
        "00000001-0001-0001-0003-000000000017",
        "StrokeLineCap",
        "Stroke Line Cap",
        XLineCap.Flat
    );

    public static readonly StrokeLineJoinProp = XProperty.Register<XRectangle, XLineJoin>(
        (p: XRectangle) => p.StrokeLineJoin,
        "00000001-0001-0001-0003-000000000018",
        "StrokeLineJoin",
        "Stroke Line Join",
        XLineJoin.Miter
    );

    public static readonly MarginProp = XProperty.Register<XRectangle, XThickness>(
        (p: XRectangle) => p.Margin,
        "00000001-0001-0001-0003-00000000000A",
        "Margin",
        "Margin",
        new XThickness(0)
    );

    public static readonly PaddingProp = XProperty.Register<XRectangle, XThickness>(
        (p: XRectangle) => p.Padding,
        "00000001-0001-0001-0003-00000000000B",
        "Padding",
        "Padding",
        new XThickness(0)
    );

    public static readonly OpacityProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.Opacity,
        "00000001-0001-0001-0003-00000000000C",
        "Opacity",
        "Opacity",
        1
    );

    public static readonly VisibleProp = XProperty.Register<XRectangle, boolean>(
        (p: XRectangle) => p.Visible,
        "00000001-0001-0001-0003-000000000019",
        "Visible",
        "Visible",
        true
    );

    public static readonly EnabledProp = XProperty.Register<XRectangle, boolean>(
        (p: XRectangle) => p.Enabled,
        "00000001-0001-0001-0003-00000000001A",
        "Enabled",
        "Enabled",
        true
    );

    public static readonly IsHitTestVisibleProp = XProperty.Register<XRectangle, boolean>(
        (p: XRectangle) => p.IsHitTestVisible,
        "00000001-0001-0001-0003-00000000001B",
        "IsHitTestVisible",
        "Is Hit Test Visible",
        true
    );

    public static readonly BorderColorProp = XProperty.Register<XRectangle, XBorderColor>(
        (p: XRectangle) => p.BorderColor,
        "00000001-0001-0001-0003-00000000000D",
        "BorderColor",
        "Border Color",
        new XBorderColor(XColor.Black)
    );

    public static readonly BorderThicknessProp = XProperty.Register<XRectangle, XThickness>(
        (p: XRectangle) => p.BorderThickness,
        "00000001-0001-0001-0003-00000000000E",
        "BorderThickness",
        "Border Thickness",
        new XThickness(0)
    );

    public static readonly HorizontalAlignmentProp = XProperty.Register<XRectangle, XAlignment>(
        (p: XRectangle) => p.HorizontalAlignment,
        "00000001-0001-0001-0003-00000000000F",
        "HorizontalAlignment",
        "Horizontal Alignment",
        XAlignment.None
    );

    public static readonly VerticalAlignmentProp = XProperty.Register<XRectangle, XAlignment>(
        (p: XRectangle) => p.VerticalAlignment,
        "00000001-0001-0001-0003-000000000010",
        "VerticalAlignment",
        "Vertical Alignment",
        XAlignment.None
    );

    public static readonly ZIndexProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ZIndex,
        "00000001-0001-0001-0003-00000000001C",
        "ZIndex",
        "Z-Index",
        0
    );

    public static readonly CursorProp = XProperty.Register<XRectangle, XCursor>(
        (p: XRectangle) => p.Cursor,
        "00000001-0001-0001-0003-00000000001D",
        "Cursor",
        "Cursor",
        XCursor.Default
    );

    public static readonly ClipToBoundsProp = XProperty.Register<XRectangle, boolean>(
        (p: XRectangle) => p.ClipToBounds,
        "00000001-0001-0001-0003-00000000001E",
        "ClipToBounds",
        "Clip To Bounds",
        false
    );

    public static readonly RotationProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.Rotation,
        "00000001-0001-0001-0003-00000000001F",
        "Rotation",
        "Rotation Angle",
        0
    );

    public static readonly ScaleXProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ScaleX,
        "00000001-0001-0001-0003-000000000020",
        "ScaleX",
        "Scale X",
        1
    );

    public static readonly ScaleYProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ScaleY,
        "00000001-0001-0001-0003-000000000021",
        "ScaleY",
        "Scale Y",
        1
    );

    public static readonly SkewXProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.SkewX,
        "00000001-0001-0001-0003-000000000022",
        "SkewX",
        "Skew X",
        0
    );

    public static readonly SkewYProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.SkewY,
        "00000001-0001-0001-0003-000000000023",
        "SkewY",
        "Skew Y",
        0
    );

    public static readonly TransformOriginXProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.TransformOriginX,
        "00000001-0001-0001-0003-000000000024",
        "TransformOriginX",
        "Transform Origin X",
        0.5
    );

    public static readonly TransformOriginYProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.TransformOriginY,
        "00000001-0001-0001-0003-000000000025",
        "TransformOriginY",
        "Transform Origin Y",
        0.5
    );

    public static readonly ShadowColorProp = XProperty.Register<XRectangle, XColor>(
        (p: XRectangle) => p.ShadowColor,
        "00000001-0001-0001-0003-000000000026",
        "ShadowColor",
        "Shadow Color",
        XColor.Transparent
    );

    public static readonly ShadowOffsetXProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ShadowOffsetX,
        "00000001-0001-0001-0003-000000000027",
        "ShadowOffsetX",
        "Shadow Offset X",
        0
    );

    public static readonly ShadowOffsetYProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ShadowOffsetY,
        "00000001-0001-0001-0003-000000000028",
        "ShadowOffsetY",
        "Shadow Offset Y",
        0
    );

    public static readonly ShadowBlurProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ShadowBlur,
        "00000001-0001-0001-0003-000000000029",
        "ShadowBlur",
        "Shadow Blur Radius",
        0
    );

    public static readonly ShadowSpreadProp = XProperty.Register<XRectangle, number>(
        (p: XRectangle) => p.ShadowSpread,
        "00000001-0001-0001-0003-00000000002A",
        "ShadowSpread",
        "Shadow Spread",
        0
    );

    public static readonly TagProp = XProperty.Register<XRectangle, string>(
        (p: XRectangle) => p.Tag,
        "00000001-0001-0001-0003-00000000002B",
        "Tag",
        "Tag",
        ""
    );

    public static readonly TooltipProp = XProperty.Register<XRectangle, string>(
        (p: XRectangle) => p.Tooltip,
        "00000001-0001-0001-0003-00000000002C",
        "Tooltip",
        "Tooltip",
        ""
    );

    public constructor()
    {
        super();
    }

    public get Bounds(): XRect
    {
        return this.GetValue(XRectangle.BoundsProp) as XRect;
    }

    public set Bounds(pValue: XRect)
    {
        this.SetValue(XRectangle.BoundsProp, pValue);
    }

    public get Left(): number
    {
        return this.Bounds.Left;
    }

    public get Top(): number
    {
        return this.Bounds.Top;
    }

    public get Width(): number
    {
        return this.Bounds.Width;
    }

    public get Height(): number
    {
        return this.Bounds.Height;
    }

    public get MinWidth(): number
    {
        return this.GetValue(XRectangle.MinWidthProp) as number;
    }

    public set MinWidth(pValue: number)
    {
        this.SetValue(XRectangle.MinWidthProp, pValue);
    }

    public get MinHeight(): number
    {
        return this.GetValue(XRectangle.MinHeightProp) as number;
    }

    public set MinHeight(pValue: number)
    {
        this.SetValue(XRectangle.MinHeightProp, pValue);
    }

    public get MaxWidth(): number
    {
        return this.GetValue(XRectangle.MaxWidthProp) as number;
    }

    public set MaxWidth(pValue: number)
    {
        this.SetValue(XRectangle.MaxWidthProp, pValue);
    }

    public get MaxHeight(): number
    {
        return this.GetValue(XRectangle.MaxHeightProp) as number;
    }

    public set MaxHeight(pValue: number)
    {
        this.SetValue(XRectangle.MaxHeightProp, pValue);
    }

    public get RadiusX(): number
    {
        return this.GetValue(XRectangle.RadiusXProp) as number;
    }

    public set RadiusX(pValue: number)
    {
        this.SetValue(XRectangle.RadiusXProp, pValue);
    }

    public get RadiusY(): number
    {
        return this.GetValue(XRectangle.RadiusYProp) as number;
    }

    public set RadiusY(pValue: number)
    {
        this.SetValue(XRectangle.RadiusYProp, pValue);
    }

    public get Fill(): XColor
    {
        return this.GetValue(XRectangle.FillProp) as XColor;
    }

    public set Fill(pValue: XColor)
    {
        this.SetValue(XRectangle.FillProp, pValue);
    }

    public get Stroke(): XColor
    {
        return this.GetValue(XRectangle.StrokeProp) as XColor;
    }

    public set Stroke(pValue: XColor)
    {
        this.SetValue(XRectangle.StrokeProp, pValue);
    }

    public get StrokeThickness(): number
    {
        return this.GetValue(XRectangle.StrokeThicknessProp) as number;
    }

    public set StrokeThickness(pValue: number)
    {
        this.SetValue(XRectangle.StrokeThicknessProp, pValue);
    }

    public get StrokeDashArray(): number[]
    {
        return this.GetValue(XRectangle.StrokeDashArrayProp) as number[];
    }

    public set StrokeDashArray(pValue: number[])
    {
        this.SetValue(XRectangle.StrokeDashArrayProp, pValue);
    }

    public get StrokeDashOffset(): number
    {
        return this.GetValue(XRectangle.StrokeDashOffsetProp) as number;
    }

    public set StrokeDashOffset(pValue: number)
    {
        this.SetValue(XRectangle.StrokeDashOffsetProp, pValue);
    }

    public get StrokeLineCap(): XLineCap
    {
        return this.GetValue(XRectangle.StrokeLineCapProp) as XLineCap;
    }

    public set StrokeLineCap(pValue: XLineCap)
    {
        this.SetValue(XRectangle.StrokeLineCapProp, pValue);
    }

    public get StrokeLineJoin(): XLineJoin
    {
        return this.GetValue(XRectangle.StrokeLineJoinProp) as XLineJoin;
    }

    public set StrokeLineJoin(pValue: XLineJoin)
    {
        this.SetValue(XRectangle.StrokeLineJoinProp, pValue);
    }

    public get Margin(): XThickness
    {
        return this.GetValue(XRectangle.MarginProp) as XThickness;
    }

    public set Margin(pValue: XThickness)
    {
        this.SetValue(XRectangle.MarginProp, pValue);
    }

    public get Padding(): XThickness
    {
        return this.GetValue(XRectangle.PaddingProp) as XThickness;
    }

    public set Padding(pValue: XThickness)
    {
        this.SetValue(XRectangle.PaddingProp, pValue);
    }

    public get Opacity(): number
    {
        return this.GetValue(XRectangle.OpacityProp) as number;
    }

    public set Opacity(pValue: number)
    {
        this.SetValue(XRectangle.OpacityProp, pValue);
    }

    public get Visible(): boolean
    {
        return this.GetValue(XRectangle.VisibleProp) as boolean;
    }

    public set Visible(pValue: boolean)
    {
        this.SetValue(XRectangle.VisibleProp, pValue);
    }

    public get Enabled(): boolean
    {
        return this.GetValue(XRectangle.EnabledProp) as boolean;
    }

    public set Enabled(pValue: boolean)
    {
        this.SetValue(XRectangle.EnabledProp, pValue);
    }

    public get IsHitTestVisible(): boolean
    {
        return this.GetValue(XRectangle.IsHitTestVisibleProp) as boolean;
    }

    public set IsHitTestVisible(pValue: boolean)
    {
        this.SetValue(XRectangle.IsHitTestVisibleProp, pValue);
    }

    public get BorderColor(): XBorderColor
    {
        return this.GetValue(XRectangle.BorderColorProp) as XBorderColor;
    }

    public set BorderColor(pValue: XBorderColor)
    {
        this.SetValue(XRectangle.BorderColorProp, pValue);
    }

    public get BorderThickness(): XThickness
    {
        return this.GetValue(XRectangle.BorderThicknessProp) as XThickness;
    }

    public set BorderThickness(pValue: XThickness)
    {
        this.SetValue(XRectangle.BorderThicknessProp, pValue);
    }

    public get HorizontalAlignment(): XAlignment
    {
        return this.GetValue(XRectangle.HorizontalAlignmentProp) as XAlignment;
    }

    public set HorizontalAlignment(pValue: XAlignment)
    {
        this.SetValue(XRectangle.HorizontalAlignmentProp, pValue);
    }

    public get VerticalAlignment(): XAlignment
    {
        return this.GetValue(XRectangle.VerticalAlignmentProp) as XAlignment;
    }

    public set VerticalAlignment(pValue: XAlignment)
    {
        this.SetValue(XRectangle.VerticalAlignmentProp, pValue);
    }

    public get ZIndex(): number
    {
        return this.GetValue(XRectangle.ZIndexProp) as number;
    }

    public set ZIndex(pValue: number)
    {
        this.SetValue(XRectangle.ZIndexProp, pValue);
    }

    public get Cursor(): XCursor
    {
        return this.GetValue(XRectangle.CursorProp) as XCursor;
    }

    public set Cursor(pValue: XCursor)
    {
        this.SetValue(XRectangle.CursorProp, pValue);
    }

    public get ClipToBounds(): boolean
    {
        return this.GetValue(XRectangle.ClipToBoundsProp) as boolean;
    }

    public set ClipToBounds(pValue: boolean)
    {
        this.SetValue(XRectangle.ClipToBoundsProp, pValue);
    }

    public get Rotation(): number
    {
        return this.GetValue(XRectangle.RotationProp) as number;
    }

    public set Rotation(pValue: number)
    {
        this.SetValue(XRectangle.RotationProp, pValue);
    }

    public get ScaleX(): number
    {
        return this.GetValue(XRectangle.ScaleXProp) as number;
    }

    public set ScaleX(pValue: number)
    {
        this.SetValue(XRectangle.ScaleXProp, pValue);
    }

    public get ScaleY(): number
    {
        return this.GetValue(XRectangle.ScaleYProp) as number;
    }

    public set ScaleY(pValue: number)
    {
        this.SetValue(XRectangle.ScaleYProp, pValue);
    }

    public get SkewX(): number
    {
        return this.GetValue(XRectangle.SkewXProp) as number;
    }

    public set SkewX(pValue: number)
    {
        this.SetValue(XRectangle.SkewXProp, pValue);
    }

    public get SkewY(): number
    {
        return this.GetValue(XRectangle.SkewYProp) as number;
    }

    public set SkewY(pValue: number)
    {
        this.SetValue(XRectangle.SkewYProp, pValue);
    }

    public get TransformOriginX(): number
    {
        return this.GetValue(XRectangle.TransformOriginXProp) as number;
    }

    public set TransformOriginX(pValue: number)
    {
        this.SetValue(XRectangle.TransformOriginXProp, pValue);
    }

    public get TransformOriginY(): number
    {
        return this.GetValue(XRectangle.TransformOriginYProp) as number;
    }

    public set TransformOriginY(pValue: number)
    {
        this.SetValue(XRectangle.TransformOriginYProp, pValue);
    }

    public get ShadowColor(): XColor
    {
        return this.GetValue(XRectangle.ShadowColorProp) as XColor;
    }

    public set ShadowColor(pValue: XColor)
    {
        this.SetValue(XRectangle.ShadowColorProp, pValue);
    }

    public get ShadowOffsetX(): number
    {
        return this.GetValue(XRectangle.ShadowOffsetXProp) as number;
    }

    public set ShadowOffsetX(pValue: number)
    {
        this.SetValue(XRectangle.ShadowOffsetXProp, pValue);
    }

    public get ShadowOffsetY(): number
    {
        return this.GetValue(XRectangle.ShadowOffsetYProp) as number;
    }

    public set ShadowOffsetY(pValue: number)
    {
        this.SetValue(XRectangle.ShadowOffsetYProp, pValue);
    }

    public get ShadowBlur(): number
    {
        return this.GetValue(XRectangle.ShadowBlurProp) as number;
    }

    public set ShadowBlur(pValue: number)
    {
        this.SetValue(XRectangle.ShadowBlurProp, pValue);
    }

    public get ShadowSpread(): number
    {
        return this.GetValue(XRectangle.ShadowSpreadProp) as number;
    }

    public set ShadowSpread(pValue: number)
    {
        this.SetValue(XRectangle.ShadowSpreadProp, pValue);
    }

    public get Tag(): string
    {
        return this.GetValue(XRectangle.TagProp) as string;
    }

    public set Tag(pValue: string)
    {
        this.SetValue(XRectangle.TagProp, pValue);
    }

    public get Tooltip(): string
    {
        return this.GetValue(XRectangle.TooltipProp) as string;
    }

    public set Tooltip(pValue: string)
    {
        this.SetValue(XRectangle.TooltipProp, pValue);
    }

    public get Right(): number
    {
        return this.Bounds.Right;
    }

    public get Bottom(): number
    {
        return this.Bounds.Bottom;
    }

    public get Center(): XPoint
    {
        return new XPoint(this.Left + this.Width / 2, this.Top + this.Height / 2);
    }

    public get HasShadow(): boolean
    {
        return !this.ShadowColor.IsTransparent && (this.ShadowBlur > 0 || this.ShadowSpread > 0);
    }

    public get HasTransform(): boolean
    {
        return this.Rotation !== 0 || this.ScaleX !== 1 || this.ScaleY !== 1 || this.SkewX !== 0 || this.SkewY !== 0;
    }

    public get IsVisible(): boolean
    {
        return this.Visible && this.Opacity > 0;
    }

    public ContainsPoint(pPoint: XPoint): boolean
    {
        return pPoint.X >= this.Left && pPoint.X <= this.Right && pPoint.Y >= this.Top && pPoint.Y <= this.Bottom;
    }

    public IntersectsWith(pRect: XRect): boolean
    {
        return this.Left < pRect.Right && this.Right > pRect.Left && this.Top < pRect.Bottom && this.Bottom > pRect.Top;
    }

    public MoveTo(pLeft: number, pTop: number): void
    {
        const b = this.Bounds;
        this.Bounds = new XRect(pLeft, pTop, b.Width, b.Height);
    }

    public MoveBy(pDeltaX: number, pDeltaY: number): void
    {
        const b = this.Bounds;
        this.Bounds = new XRect(b.Left + pDeltaX, b.Top + pDeltaY, b.Width, b.Height);
    }

    public ResizeTo(pWidth: number, pHeight: number): void
    {
        const b = this.Bounds;
        const w = Math.max(this.MinWidth, Math.min(pWidth, this.MaxWidth));
        const h = Math.max(this.MinHeight, Math.min(pHeight, this.MaxHeight));
        this.Bounds = new XRect(b.Left, b.Top, w, h);
    }

    public SetUniformRadius(pRadius: number): void
    {
        this.RadiusX = pRadius;
        this.RadiusY = pRadius;
    }

    public SetUniformScale(pScale: number): void
    {
        this.ScaleX = pScale;
        this.ScaleY = pScale;
    }
}
