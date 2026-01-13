import { XField } from "../../Design/XField.js";
import { XProperty } from "../../Core/XProperty.js";
import type { XORMDesign } from "./XORMDesign.js";
import type { XORMTable } from "./XORMTable.js";

export class XORMField extends XField
{
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

    /**
     * Indica se este campo é uma chave primária
     * Para campos regulares, sempre retorna false
     * XORMPKField sobrescreve este getter
     */
    public get IsPrimaryKey(): boolean
    {
        return false;
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

    /**
     * Gets the reference that uses this field as source (FK field)
     * Returns null if this field is not an FK field
     */
    public GetReference(): import("./XORMReference.js").XORMReference | null
    {
        const table = this.ParentNode as XORMTable | null;
        if (!table)
            return null;

        const design = table.ParentNode as XORMDesign | null;
        if (!design || typeof design.FindReferenceBySourceFieldID !== "function")
            return null;

        return design.FindReferenceBySourceFieldID(this.ID);
    }

    /**
     * Checks if this field is a foreign key field (used as source in a reference)
     */
    public get IsForeignKey(): boolean
    {
        return this.GetReference() !== null;
    }

    /**
     * Gets the expected DataType for this field if it's an FK field
     * Returns the PKType of the target table, or null if not an FK field
     */
    public GetExpectedDataType(): string | null
    {
        const ref = this.GetReference();
        if (!ref)
            return null;

        const table = this.ParentNode as XORMTable | null;
        if (!table)
            return null;

        const design = table.ParentNode as XORMDesign | null;
        if (!design || typeof design.FindTableByID !== "function")
            return null;

        const targetTable = design.FindTableByID(ref.Target);
        if (!targetTable)
            return null;

        return targetTable.PKType;
    }
}