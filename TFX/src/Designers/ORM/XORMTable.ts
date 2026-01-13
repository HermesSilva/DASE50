import { XRectangle } from "../../Design/XRectangle.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XORMField } from "./XORMField.js";

export interface XICreateFieldOptions
{
    Name?: string;
    DataType?: string;
    Length?: number;
    IsPrimaryKey?: boolean;
    IsNullable?: boolean;
    IsAutoIncrement?: boolean;
    DefaultValue?: string;
}

export class XORMTable extends XRectangle
{
    public static readonly PKTypeProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.PKType,
        "00000001-0002-0003-0002-000000000001",
        "PKType",
        "Primary Key Type",
        "Int32"
    );

    public constructor()
    {
        super();
    }

    public get PKType(): string
    {
        return this.GetValue(XORMTable.PKTypeProp) as string;
    }

    public set PKType(pValue: string)
    {
        this.SetValue(XORMTable.PKTypeProp, pValue);
    }

    public CreateField(pOptions?: XICreateFieldOptions): XORMField
    {
        const field = new XORMField();
        field.ID = XGuid.NewValue();
        field.Name = pOptions?.Name ?? this.GenerateFieldName();
        field.DataType = pOptions?.DataType ?? "String";
        field.Length = pOptions?.Length ?? 0;
        field.IsPrimaryKey = pOptions?.IsPrimaryKey ?? false;
        field.IsNullable = pOptions?.IsNullable ?? true;
        field.IsAutoIncrement = pOptions?.IsAutoIncrement ?? false;
        field.DefaultValue = pOptions?.DefaultValue ?? "";

        this.AppendChild(field);
        return field;
    }

    public DeleteField(pField: XORMField): boolean
    {
        if (pField.ParentNode !== this)
            return false;

        if (!pField.CanDelete)
            return false;

        return this.RemoveChild(pField);
    }

    public GetFields(): XORMField[]
    {
        return this.GetChildrenOfType(XORMField);
    }

    public FindFieldByID(pID: string): XORMField | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMField && child.ID === pID)
                return child;
        }
        return null;
    }

    public FindFieldByName(pName: string): XORMField | null
    {
        const lowerName = pName.toLowerCase();
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMField && child.Name.toLowerCase() === lowerName)
                return child;
        }
        return null;
    }

    private GenerateFieldName(): string
    {
        const fields = this.GetFields();
        let idx = fields.length + 1;
        let name = `Field${idx}`;

        while (fields.some(f => f.Name.toLowerCase() === name.toLowerCase()))
        {
            idx++;
            name = `Field${idx}`;
        }

        return name;
    }
}
