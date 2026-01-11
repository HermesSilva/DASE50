import { XDesignElement } from "./XDesignElement.js";
import { XProperty } from "../Core/XProperty.js";
import { XColor, XPoint } from "../Core/XGeometry.js";

export class XLine extends XDesignElement
{
    public static readonly PointsProp = XProperty.Register<XLine, XPoint[]>(
        (p: XLine) => p.Points,
        "00000001-0001-0001-0004-000000000001",
        "Points",
        "Points List",
        []
    );

    public static readonly StrokeProp = XProperty.Register<XLine, XColor>(
        (p: XLine) => p.Stroke,
        "00000001-0001-0001-0004-000000000005",
        "Stroke",
        "Stroke Color",
        XColor.Black
    );

    public static readonly StrokeThicknessProp = XProperty.Register<XLine, number>(
        (p: XLine) => p.StrokeThickness,
        "00000001-0001-0001-0004-000000000006",
        "StrokeThickness",
        "Stroke Thickness",
        1
    );

    public constructor()
    {
        super();
    }

    public get Points(): XPoint[]
    {
        return this.GetValue(XLine.PointsProp) as XPoint[];
    }

    public set Points(pValue: XPoint[])
    {
        this.SetValue(XLine.PointsProp, pValue);
    }

    public get Stroke(): XColor
    {
        return this.GetValue(XLine.StrokeProp) as XColor;
    }

    public set Stroke(pValue: XColor)
    {
        this.SetValue(XLine.StrokeProp, pValue);
    }

    public get StrokeThickness(): number
    {
        return this.GetValue(XLine.StrokeThicknessProp) as number;
    }

    public set StrokeThickness(pValue: number)
    {
        this.SetValue(XLine.StrokeThicknessProp, pValue);
    }
}