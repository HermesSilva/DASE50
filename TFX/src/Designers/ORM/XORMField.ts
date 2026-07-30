import { XField } from "../../Design/XField.js";
import { XProperty } from "../../Core/XProperty.js";
import type { XORMDesign } from "./XORMDesign.js";
import type { XORMTable } from "./XORMTable.js";

/** Separator used to store the allowed-values list as a single serialisable string. */
const ALLOWED_VALUES_SEPARATOR = "|";

export class XORMField extends XField
{
    public static readonly IsAutoIncrementProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsAutoIncrement,
        "00000001-0002-0003-0001-000000000006",
        "IsAutoIncrement",
        "Is Auto Increment",
        false
    );

    /**
     * Explicit FK flag — matches C# XORMField.IsFK (GUID: 7CBD471F-...).
     * Set to true when the field is a foreign key stored/loaded from C# files.
     * For TS-native files, use IsForeignKey which is computed from XORMReference.
     */
    public static readonly IsFKProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsFK,
        "7CBD471F-E1F2-4A36-B0FC-A962000DF07F",
        "IsFK",
        "Is Foreign Key",
        false
    );

    /**
     * Pipe-separated list of allowed values for this field.
     *
     * Models enum-like constraints (MySQL ENUM/SET, CHECK constraints, domain types).
     * Each entry is a non-empty trimmed string.  The separator is '|'.
     *
     * Examples:
     *   "Active|Inactive|Pending"
     *   "1|2|3"
     *   "Male|Female|Other"
     *
     * When non-empty:
     *   - DefaultValue (if set) should belong to this list.
     *   - IsAutoIncrement conflicts with AllowedValues and triggers a warning.
     *
     * TS-native GUID — no C# equivalent.
     */
    public static readonly AllowedValuesProp = XProperty.Register<XORMField, string>(
        (p: XORMField) => p.AllowedValues,
        "E7B3A1C5-D2F4-4E68-9A0B-1C2D3E4F5A6B",
        "AllowedValues",
        "Allowed Values",
        ""
    );

    /**
     * O valor desta coluna NUNCA é gerado pelo banco — chega pronto da aplicação.
     *
     * Casos típicos: identificador declarado em código, e chave compartilhada com outra
     * tabela (1:1), em que o valor vem da tabela apontada.
     *
     * Existe como propriedade própria, e não derivada de `IsAutoIncrement` do PK, porque
     * aquele campo não sobrevive ao round-trip: a desserialização não passa pelos setters
     * e todo PK relido volta como auto-increment. Aqui o default é `false`, então `true`
     * difere do default e é efetivamente gravado no arquivo.
     */
    public static readonly ValueGeneratedNeverProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.ValueGeneratedNever,
        "9F2C6D48-1B7E-4A35-8C90-5E3B7D1F2A64",
        "ValueGeneratedNever",
        "Value Generated Never",
        false
    );

    /**
     * Returns whether this field is a primary key.
     * Always false for regular fields.
     * XORMPKField overrides this getter to return true.
     */
    public get IsPrimaryKey(): boolean
    {
        return false;
    }

    public get IsAutoIncrement(): boolean
    {
        return this.GetValue(XORMField.IsAutoIncrementProp) as boolean;
    }

    public set IsAutoIncrement(pValue: boolean)
    {
        this.SetValue(XORMField.IsAutoIncrementProp, pValue);
    }

    public get IsFK(): boolean
    {
        return this.GetValue(XORMField.IsFKProp) as boolean;
    }

    public set IsFK(pValue: boolean)
    {
        this.SetValue(XORMField.IsFKProp, pValue);
    }

    /**
     * Raw pipe-separated string of allowed values.
     * Set to "" to clear the constraint.
     * Use AllowedValuesList for a parsed array, HasAllowedValues for a quick check.
     */
    public get AllowedValues(): string
    {
        return this.GetValue(XORMField.AllowedValuesProp) as string;
    }

    public set AllowedValues(pValue: string)
    {
        this.SetValue(XORMField.AllowedValuesProp, pValue.trim());
    }

    /** Se o valor desta coluna nunca é gerado pelo banco. */
    public get ValueGeneratedNever(): boolean
    {
        return this.GetValue(XORMField.ValueGeneratedNeverProp) as boolean;
    }

    public set ValueGeneratedNever(pValue: boolean)
    {
        this.SetValue(XORMField.ValueGeneratedNeverProp, pValue);
    }

    /** Parsed list of allowed values, trimmed and with empty strings removed. */
    public get AllowedValuesList(): string[]
    {
        const raw = this.AllowedValues;
        if (!raw)
            return [];
        const result: string[] = [];
        for (const entry of raw.split(ALLOWED_VALUES_SEPARATOR))
        {
            const trimmed = entry.trim();
            if (trimmed)
                result.push(trimmed);
        }
        return result;
    }

    /** True when at least one allowed value is defined. */
    public get HasAllowedValues(): boolean
    {
        return this.AllowedValuesList.length > 0;
    }

    /**
     * Returns true when the given value is in the AllowedValues list.
     * Comparison is case-sensitive.
     * Always returns true when HasAllowedValues is false (no constraint).
     */
    public IsAllowedValue(pValue: string): boolean
    {
        if (!this.HasAllowedValues)
            return true;
        const list = this.AllowedValuesList;
        for (const entry of list)
            if (entry === pValue)
                return true;
        return false;
    }

    /**
     * Replaces the allowed values list from an array.
     * Duplicate and empty entries are removed before storing.
     */
    public SetAllowedValuesList(pValues: string[]): void
    {
        const seen = new Set<string>();
        const clean: string[] = [];
        for (const v of pValues)
        {
            const trimmed = v.trim();
            if (trimmed && !seen.has(trimmed))
            {
                seen.add(trimmed);
                clean.push(trimmed);
            }
        }
        this.AllowedValues = clean.join(ALLOWED_VALUES_SEPARATOR);
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
     * Returns true when the explicit IsFK flag is set (C# file compatibility)
     * OR when a XORMReference in the design uses this field as its source (TS native).
     */
    public get IsForeignKey(): boolean
    {
        return this.IsFK || this.GetReference() !== null;
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