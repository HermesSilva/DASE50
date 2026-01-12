import { XDesignElement } from "./XDesignElement.js";
import { XProperty } from "../Core/XProperty.js";
import { XColor, XPoint } from "../Core/XGeometry.js";
import { XGuid } from "../Core/XGuid.js";
import { XLinkData } from "../Core/XData.js";

export abstract class XLine extends XDesignElement
{
    public static readonly SourceProp = XProperty.RegisterLink<XLine>(
        (p: XLine) => p.Source,
        "00000001-0001-0001-0004-000000000010",
        "Source",
        "Source Element ID",
        XGuid.EmptyValue
    );

    public static readonly TargetProp = XProperty.RegisterLink<XLine>(
        (p: XLine) => p.Target,
        "00000001-0001-0001-0004-000000000011",
        "Target",
        "Target Element ID",
        XGuid.EmptyValue
    );

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

    public get Source(): string
    {
        // For Link properties, we need to read from XLinkData
        const linkData = this.Values.GetChildById<XLinkData>(XLine.SourceProp.ID);
        if (linkData === null)
            return XGuid.EmptyValue;
        return (linkData.Data as string) || XGuid.EmptyValue;
    }

    public set Source(pValue: string)
    {
        // For Link properties, we need to create XLinkData manually
        if (!pValue)
            pValue = XGuid.EmptyValue;

        const old = this.Source; // Use the getter
        if (old === pValue)
            return;

        let linkData = this.Values.GetChildById<XLinkData>(XLine.SourceProp.ID);
        if (linkData === null)
        {
            linkData = new XLinkData();
            linkData.ID = XLine.SourceProp.ID;
            linkData.Name = XLine.SourceProp.Name;
            linkData.Data = pValue;
            this.Values.AppendChild(linkData as any);
        }
        else
            linkData.Data = pValue;

        this.TrackChange(XLine.SourceProp, old, pValue);
        this.RaisePropertyChanged(XLine.SourceProp, pValue);
    }

    public get SourceID(): string
    {
        return this.Source;
    }

    public GetSourceElement<T extends XDesignElement>(): T | null
    {
        return this.GetLinkedElement<T>(XLine.SourceProp);
    }

    public get Target(): string
    {
        // For Link properties, we need to read from XLinkData
        const linkData = this.Values.GetChildById<XLinkData>(XLine.TargetProp.ID);
        if (linkData === null)
            return XGuid.EmptyValue;
        return (linkData.Data as string) || XGuid.EmptyValue;
    }

    public set Target(pValue: string)
    {
        // For Link properties, we need to create XLinkData manually
        if (!pValue)
            pValue = XGuid.EmptyValue;

        const old = this.Target; // Use the getter
        if (old === pValue)
            return;

        let linkData = this.Values.GetChildById<XLinkData>(XLine.TargetProp.ID);
        if (linkData === null)
        {
            linkData = new XLinkData();
            linkData.ID = XLine.TargetProp.ID;
            linkData.Name = XLine.TargetProp.Name;
            linkData.Data = pValue;
            this.Values.AppendChild(linkData as any);
        }
        else
            linkData.Data = pValue;

        this.TrackChange(XLine.TargetProp, old, pValue);
        this.RaisePropertyChanged(XLine.TargetProp, pValue);
    }

    public get TargetID(): string
    {
        return this.Target;
    }

    public GetTargetElement<T extends XDesignElement>(): T | null
    {
        return this.GetLinkedElement<T>(XLine.TargetProp);
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