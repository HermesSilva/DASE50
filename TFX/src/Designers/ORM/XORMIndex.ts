import { XPersistableElement } from "../../Core/XPersistableElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XORMIndexField } from "./XORMIndexField.js";

/**
 * XORMIndex — A database index definition on an ORM table.
 *
 * Holds the index metadata (name, uniqueness constraint) and references the
 * specific fields that compose the index via XORMIndexField children.
 *
 * ClassID matches C# XORMIndex: 22F0A974-7CE7-41E5-AE23-3EE6B49FC848
 */
export class XORMIndex extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    /**
     * Whether this index enforces a UNIQUE constraint.
     * Matches C# XORMIndex.IsUnique (GUID: 93ADA328-...).
     */
    public static readonly IsUniqueProp = XProperty.Register<XORMIndex, boolean>(
        (p: XORMIndex) => p.IsUnique,
        "93ADA328-E1D2-4B42-A86B-A3C442070D3E",
        "IsUnique",
        "Is Unique",
        false
    );

    /**
     * Condição de índice PARCIAL — o `WHERE` do CREATE INDEX.
     *
     * Guarda a expressão como o modelo a entende (`CodigoIBGE <> ''`); traduzir para a
     * sintaxe de cada banco é papel do template, que tem acesso aos helpers do projeto
     * (no Tootega, `FiltroColunaNaoVazia`, que cita a coluna conforme o provider).
     * Vazio significa índice completo.
     */
    public static readonly FilterProp = XProperty.Register<XORMIndex, string>(
        (p: XORMIndex) => p.Filter,
        "5C8E2B71-9A4D-4E36-8F2B-1D7A6C3E95B8",
        "Filter",
        "Filter",
        ""
    );

    public get IsUnique(): boolean
    {
        return this.GetValue(XORMIndex.IsUniqueProp) as boolean;
    }

    public set IsUnique(pValue: boolean)
    {
        this.SetValue(XORMIndex.IsUniqueProp, pValue);
    }

    public get Filter(): string
    {
        return this.GetValue(XORMIndex.FilterProp) as string;
    }

    public set Filter(pValue: string)
    {
        this.SetValue(XORMIndex.FilterProp, pValue);
    }

    /**
     * Returns all XORMIndexField children for this index.
     */
    public GetIndexFields(): XORMIndexField[]
    {
        return this.GetChildrenOfType(XORMIndexField);
    }
}
