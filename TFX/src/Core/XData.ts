
import { XGuid } from "./XGuid.js";
import type { XProperty } from "./XProperty.js";
import { XElement } from "./XElement.js";

export class XLanguage
{
    public InnerText: string = "";

    public Delete(_pDeep: boolean): void
    {
    }
}

export class XData
{
    public ID: string = XGuid.EmptyValue;
    public Name: string = "";
    public Data: unknown = null;
    public InnerText: string = "";
    public ChildNodes: XData[] = [];

    public Delete(_pDeep: boolean): void
    {
    }

    public RemoveFromParent(): void
    {
    }

    public GetLanguage(_pCulture: string): XLanguage | null
    {
        return null;
    }

    public AddLanguage(_pCulture: string): XLanguage
    {
        return new XLanguage();
    }
}

export abstract class XLinkableElement
{
    public abstract ID: string;
}

export class XBaseLinkData extends XData
{
    public Element: XLinkableElement | null = null;
}

export class XLinkData extends XBaseLinkData
{
    public Order: number = 0;

    public SetElement(pElement: XLinkableElement): void
    {
        this.Element = pElement;
        this.Data = pElement.ID;
    }

    public LoadElement(_pRefresh: boolean): { Element: XLinkableElement | null; IsDocumentOk: boolean; IsElementOk: boolean }
    {
        return {
            Element: this.Element,
            IsDocumentOk: true,
            IsElementOk: !!this.Element
        };
    }
}

export class XLinkArrayData extends XData
{
    public override ChildNodes: XLinkData[] = [];

    public SetElement(pElements: XLinkableElement[]): void
    {
        this.ChildNodes = pElements.map((e, i) =>
        {
            const ld = new XLinkData();
            ld.Order = i;
            ld.SetElement(e);
            return ld;
        });
        this.Data = pElements.map(e => e.ID);
    }

    public LoadElement(_pRefresh: boolean): { IsDocumentOk: boolean; IsElementOk: boolean }
    {
        const ok = this.ChildNodes.every(c => !!c.Element);
        return { IsDocumentOk: true, IsElementOk: ok };
    }

    public Where(): XLinkData[]
    {
        return this.ChildNodes.slice();
    }
}

export class XParentData extends XBaseLinkData
{
    public IsDocumentOk: boolean = true;
    public IsElementOk: boolean = true;

    public Refresh(_pUserCheck: boolean): void
    {
        this.IsDocumentOk = true;
        this.IsElementOk = !!this.Element;
    }

    public SetElement(pElement: XLinkableElement): void
    {
        this.Element = pElement;
        this.Data = pElement.ID;
    }
}

export class XValues extends XElement
{
    public AddValue(pProperty: XProperty, _pType: unknown): XData
    {
        const isLinked = pProperty.Default.IsLinked;
        const typeName = (pProperty.Default as unknown as { TypeName?: string }).TypeName;
        const isArray = typeName === "Guid[]";

        let data: XData;
        if (isLinked)
            data = isArray ? new XLinkArrayData() : new XLinkData();
        else
            data = new XData();

        data.ID = pProperty.ID;
        data.Name = pProperty.Name;
        this.AppendChild(data as unknown as XElement);
        return data;
    }

    // @ts-expect-error - Overload signature differs from base class by design
    public override GetChild<T>(
        pCtorOrProperty: (new (...pArgs: unknown[]) => T) | XProperty,
        pPredicateOrType?: ((pItem: T) => boolean) | unknown | null
    ): T | null
    {
        if (typeof pCtorOrProperty === "function")
        {
            const ctor = pCtorOrProperty as unknown as Function;
            const predicate = typeof pPredicateOrType === "function"
                ? pPredicateOrType as (pItem: T) => boolean
                : null;

            for (const node of this.ChildNodes)
            {
                if (!(node instanceof (ctor as unknown as new (...pArgs: unknown[]) => unknown)))
                    continue;

                const item = node as unknown as T;
                if (!predicate || predicate(item))
                    return item;
            }

            return null;
        }

        const prop = pCtorOrProperty as XProperty;
        for (const node of this.ChildNodes)
        {
            const data = node as unknown as XData;
            if (data && data.ID === prop.ID)
                return data as unknown as T;
        }
        return null;
    }

    public GetChildById<T extends XData>(pPropertyId: string): T | null
    {
        for (const node of this.ChildNodes)
        {
            const data = node as unknown as XData;
            if (data && data.ID === pPropertyId)
                return data as T;
        }
        return null;
    }

    public CreateChild<T extends XData>(pPropertyId: string, pName?: string): T
    {
        const data = new XData();
        data.ID = pPropertyId;
        data.Name = pName ?? "";
        this.AppendChild(data as unknown as XElement);
        return data as T;
    }

    public GetChildData<T extends XData>(): T | null
    {
        for (const node of this.ChildNodes)
        {
            const data = node as unknown as XData;
            if (data instanceof XData)
                return data as T;
        }
        return null;
    }
}
