import { XField } from "../../Design/XField.js";
import { XProperty } from "../../Core/XProperty.js";

export class XORMField extends XField
{
    public static readonly IsPrimaryKeyProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsPrimaryKey,
        "00000001-0002-0003-0001-000000000004",
        "IsPrimaryKey",
        "Is Primary Key",
        false
    );

    public static readonly IsNullableProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsNullable,
        "00000001-0002-0003-0001-000000000005",
        "IsNullable",
        "Is Nullable",
        true
    );

    public static readonly IsAutoIncrementProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsAutoIncrement,
        "00000001-0002-0003-0001-000000000006",
        "IsAutoIncrement",
        "Is Auto Increment",
        false
    );

    public constructor()
    {
        super();
    }

    public get IsPrimaryKey(): boolean
    {
        return this.GetValue(XORMField.IsPrimaryKeyProp) as boolean;
    }

    public set IsPrimaryKey(pValue: boolean)
    {
        this.SetValue(XORMField.IsPrimaryKeyProp, pValue);
    }

    public get IsNullable(): boolean
    {
        return this.GetValue(XORMField.IsNullableProp) as boolean;
    }

    public set IsNullable(pValue: boolean)
    {
        this.SetValue(XORMField.IsNullableProp, pValue);
    }

    public get IsAutoIncrement(): boolean
    {
        return this.GetValue(XORMField.IsAutoIncrementProp) as boolean;
    }

    public set IsAutoIncrement(pValue: boolean)
    {
        this.SetValue(XORMField.IsAutoIncrementProp, pValue);
    }
}
