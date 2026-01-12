
import { XGuid } from "./XGuid.js";

export abstract class XDocumentBase
{
    public abstract GetTree(pTree: XElement[]): void;
}

export function IsXDocumentBase(pValue: unknown): pValue is XDocumentBase
{
    return pValue instanceof XDocumentBase;
}

export type XElementPredicate<T extends XElement> = (pItem: T) => boolean;

export function IsXElement(pValue: unknown): pValue is XElement
{
    return pValue instanceof XElement;
}

export abstract class XElement
{
    protected _ParentNode: XElement | XDocumentBase | null = null;
    protected _ID: string = XGuid.EmptyValue;
    protected _Name: string = "";
    public readonly ChildNodes: XElement[] = [];

    public get ID(): string
    {
        return this._ID;
    }

    public set ID(pValue: string)
    {
        this._ID = pValue;
    }

    public get Name(): string
    {
        return this._Name;
    }

    public set Name(pValue: string)
    {
        this._Name = pValue;
    }

    public get ClassName(): string
    {
        return this.constructor.name;
    }

    public get ParentNode(): XElement | XDocumentBase | null
    {
        return this._ParentNode;
    }

    public get CanDuplicate(): boolean
    {
        return true;
    }

    public get IsInheritable(): boolean
    {
        return true;
    }

    public get IsCacheable(): boolean
    {
        return true;
    }

    public get FullNameSpace(): string
    {
        return "";
    }

    public get DisplayText(): string
    {
        return this._Name;
    }

    public get DisplayCode(): string
    {
        return this._Name;
    }

    public get TreeText(): string
    {
        return this.DisplayText;
    }

    public get Folder(): string
    {
        return "None";
    }

    public get Tree(): XElement[]
    {
        const tree: XElement[] = [];
        this.GetTree(tree);
        return tree;
    }

    public GetTree(pTree: XElement[]): void
    {
        let current: XElement | null = IsXElement(this._ParentNode) ? this._ParentNode : null;

        if (this._ParentNode && IsXDocumentBase(this._ParentNode))
            this._ParentNode.GetTree(pTree);

        while (current)
        {
            pTree.unshift(current);

            const parent: XElement | XDocumentBase | null = current._ParentNode;
            if (parent && IsXDocumentBase(parent))
            {
                parent.GetTree(pTree);
                return;
            }

            if (IsXElement(parent))
            {
                current = parent;
                continue;
            }

            current = null;
        }
    }

    public GetChild<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): T | null
    {
        for (const node of this.ChildNodes)
        {
            if (!pPredicate || pPredicate(<T>node))
                return <T>node;
        }

        return null;
    }

    public GetChildDeep<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): T | null
    {
        for (const node of this.ChildNodes)
        {
            if (!pPredicate || pPredicate(<T>node))
                return <T>node;

            const found = node.GetChildDeep(pPredicate);
            if (found)
                return found;
        }

        return null;
    }

    public *GetChildren<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): IterableIterator<T>
    {
        for (const node of this.ChildNodes)
        {
            if (!pPredicate || pPredicate(<T>node))
                yield <T>node;
        }
    }

    public *GetChildrenDeep<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): IterableIterator<T>
    {
        for (const node of this.ChildNodes)
        {
            if (!pPredicate || pPredicate(<T>node))
                yield <T>node;

            yield* node.GetChildrenDeep(pPredicate);
        }
    }

    public HasChild<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): boolean
    {
        for (const node of this.ChildNodes)
        {
            if (!pPredicate || pPredicate(<T>node))
                return true;
        }

        return false;
    }

    public HasChildDeep<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): boolean
    {
        for (const node of this.ChildNodes)
        {
            if (!pPredicate || pPredicate(<T>node))
                return true;

            if (node.HasChildDeep(pPredicate))
                return true;
        }

        return false;
    }

    public GetOwner<T extends XElement>(pPredicate  : XElementPredicate<T> | null = null): T | null
    {
        const parent = this._ParentNode;

        if (parent instanceof XElement && (!pPredicate || pPredicate(<T>parent)))
            return <T>parent;

        if (parent instanceof XElement)
            return parent.GetOwner(pPredicate);
        return null;
    }

    public HasOwner<T extends XElement>(pPredicate: XElementPredicate<T> | null = null): boolean
    {
        const parent = this._ParentNode;

        if (parent instanceof XElement && (!pPredicate || pPredicate(<T>parent)))
            return true;

        if (parent instanceof XElement)
            return parent.HasOwner(pPredicate);
        return false;
    }

    public AppendChild(pChild: XElement): void
    {
        if (pChild._ParentNode === this)
            return;

        pChild.RemoveFromParent();
        pChild._ParentNode = this;
        this.ChildNodes.push(pChild);
    }

    public RemoveChild(pChild: XElement): boolean
    {
        const idx = this.ChildNodes.indexOf(pChild);
        if (idx < 0)
            return false;

        this.ChildNodes.splice(idx, 1);
        pChild._ParentNode = null;
        return true;
    }

    public RemoveFromParent(): boolean
    {
        if (!this._ParentNode || !(this._ParentNode instanceof XElement))
            return false;

        return this._ParentNode.RemoveChild(this);
    }

    public RefreshView(): void
    {
    }

    public SendAddItem(_pElement: XElement): void
    {
    }

    public Copy(): void
    {
    }

    public Cut(): void
    {
    }

    public Paste(): XElement[]
    {
        return [];
    }
}
