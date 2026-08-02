import { XPersistableElement } from "../../Core/XPersistableElement.js";
import { XProperty } from "../../Core/XProperty.js";

/**
 * XORMIndexField — A field entry inside an XORMIndex.
 *
 * References a specific ORM field that participates in the parent index,
 * with optional ordering and duplicate-null semantics.
 * The referenced field is resolved via the inherited ParentID property.
 *
 * ClassID matches C# XORMIndexField: 72DF7447-295F-4906-A53B-B4BE42DC794B
 */
export class XORMIndexField extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    /**
     * Whether the index column is sorted in descending order.
     * Matches C# XORMIndexField.IsDescending (GUID: 2FDDA839-...).
     */
    public static readonly IsDescendingProp = XProperty.Register<XORMIndexField, boolean>(
        (p: XORMIndexField) => p.IsDescending,
        "2FDDA839-31AD-4EC6-B2D7-F3D0EB94BC81",
        "IsDescending",
        "Is Descending",
        false
    );

    /**
     * Whether duplicate NULL values are allowed in this index column.
     * Matches C# XORMIndexField.AllowDuplicate (GUID: B2A239B4-...).
     */
    public static readonly AllowDuplicateProp = XProperty.Register<XORMIndexField, boolean>(
        (p: XORMIndexField) => p.AllowDuplicate,
        "B2A239B4-6DEC-4AC9-98E5-4E60152CCD6A",
        "AllowDuplicate",
        "Allow Duplicate Null",
        false
    );

    /**
     * Whether this is a covering (INCLUDE) column — carried by the index for
     * read performance, but not part of the key used for ordering/uniqueness.
     */
    public static readonly IsIncludedProp = XProperty.Register<XORMIndexField, boolean>(
        (p: XORMIndexField) => p.IsIncluded,
        "6E2D6A2E-6C0B-4F97-9C1D-6A4E7B2F0B34",
        "IsIncluded",
        "Included Column",
        false
    );

    public get IsDescending(): boolean
    {
        return this.GetValue(XORMIndexField.IsDescendingProp) as boolean;
    }

    public set IsDescending(pValue: boolean)
    {
        this.SetValue(XORMIndexField.IsDescendingProp, pValue);
    }

    public get AllowDuplicate(): boolean
    {
        return this.GetValue(XORMIndexField.AllowDuplicateProp) as boolean;
    }

    public set AllowDuplicate(pValue: boolean)
    {
        this.SetValue(XORMIndexField.AllowDuplicateProp, pValue);
    }

    public get IsIncluded(): boolean
    {
        return this.GetValue(XORMIndexField.IsIncludedProp) as boolean;
    }

    public set IsIncluded(pValue: boolean)
    {
        this.SetValue(XORMIndexField.IsIncludedProp, pValue);
    }
}
