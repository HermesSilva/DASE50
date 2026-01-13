import { XRectangle } from "./XRectangle.js";
import { XProperty } from "../Core/XProperty.js";

export abstract class XField extends XRectangle
{
    public static readonly DataTypeProp = XProperty.Register<XField, string>(
        (p: XField) => p.DataType,
        "00000001-0001-0001-0004-000000000001",
        "DataType",
        "Data Type",
        "String"
    );

    public static readonly IsRequiredProp = XProperty.Register<XField, boolean>(
        (p: XField) => p.IsRequired,
        "00000001-0001-0001-0004-000000000002",
        "IsRequired",
        "Is Required",
        false
    );

    public static readonly DefaultValueProp = XProperty.Register<XField, string>(
        (p: XField) => p.DefaultValue,
        "00000001-0001-0001-0004-000000000003",
        "DefaultValue",
        "Default Value",
        ""
    );

    public static readonly LengthProp = XProperty.Register<XField, number>(
        (p: XField) => p.Length,
        "00000001-0001-0001-0004-000000000004",
        "Length",
        "Length",
        0
    );

    public static readonly ScaleProp = XProperty.Register<XField, number>(
        (p: XField) => p.Scale,
        "00000001-0001-0001-0004-000000000005",
        "Scale",
        "Scale",
        0
    );

    public constructor()
    {
        super();
    }

    public get DataType(): string
    {
        return this.GetValue(XField.DataTypeProp) as string;
    }

    public set DataType(pValue: string)
    {
        this.SetValue(XField.DataTypeProp, pValue);
    }

    public get IsRequired(): boolean
    {
        return this.GetValue(XField.IsRequiredProp) as boolean;
    }

    public set IsRequired(pValue: boolean)
    {
        this.SetValue(XField.IsRequiredProp, pValue);
    }

    public get DefaultValue(): string
    {
        return this.GetValue(XField.DefaultValueProp) as string;
    }

    public set DefaultValue(pValue: string)
    {
        this.SetValue(XField.DefaultValueProp, pValue);
    }

    public get Length(): number
    {
        return this.GetValue(XField.LengthProp) as number;
    }

    public set Length(pValue: number)
    {
        this.SetValue(XField.LengthProp, pValue);
    }

    public get Scale(): number
    {
        return this.GetValue(XField.ScaleProp) as number;
    }

    public set Scale(pValue: number)
    {
        this.SetValue(XField.ScaleProp, pValue);
    }
}