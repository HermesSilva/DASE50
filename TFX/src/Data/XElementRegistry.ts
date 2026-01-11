import type { XPersistableElement } from "../Core/XPersistableElement.js";
import { XProperty } from "../Core/XProperty.js";
import { XGuid } from "../Core/XGuid.js";

export type XElementConstructor<T extends XPersistableElement = XPersistableElement> = new () => T;

export interface XIElementMetadata
{
    TagName: string;
    Constructor: XElementConstructor;
    ClassID: string;
    BaseClassName: string | null;
    Properties: Map<string, XProperty>;
    ChildTags: Set<string>;
    AttributeProperties: Set<string>;
    Order: number;
}

export interface XIElementRegistration
{
    TagName: string;
    Constructor: XElementConstructor;
    ClassID?: string;
    BaseClassName?: string;
    Order?: number;
}

export class XElementRegistry
{
    private static _Instance: XElementRegistry | null = null;

    private readonly _ByTagName: Map<string, XIElementMetadata> = new Map();
    private readonly _ByClassID: Map<string, XIElementMetadata> = new Map();
    private readonly _ByConstructor: Map<XElementConstructor, XIElementMetadata> = new Map();
    private readonly _Inheritance: Map<string, Set<string>> = new Map();

    public static get Instance(): XElementRegistry
    {
        if (XElementRegistry._Instance === null)
            XElementRegistry._Instance = new XElementRegistry();
        return XElementRegistry._Instance;
    }

    public Register(pRegistration: XIElementRegistration): XIElementMetadata
    {
        const classID = pRegistration.ClassID ?? XGuid.NewValue();
        const metadata: XIElementMetadata = {
            TagName: pRegistration.TagName,
            Constructor: pRegistration.Constructor,
            ClassID: classID,
            BaseClassName: pRegistration.BaseClassName ?? null,
            Properties: new Map(),
            ChildTags: new Set(),
            AttributeProperties: new Set(),
            Order: pRegistration.Order ?? 0
        };

        this._ByTagName.set(pRegistration.TagName, metadata);
        this._ByClassID.set(classID, metadata);
        this._ByConstructor.set(pRegistration.Constructor, metadata);

        if (pRegistration.BaseClassName)
        {
            let derived = this._Inheritance.get(pRegistration.BaseClassName);
            if (!derived)
            {
                derived = new Set();
                this._Inheritance.set(pRegistration.BaseClassName, derived);
            }
            derived.add(pRegistration.TagName);
        }

        return metadata;
    }

    public RegisterProperty(pTagName: string, pProperty: XProperty, pAsAttribute: boolean = false): void
    {
        const metadata = this._ByTagName.get(pTagName);
        if (!metadata)
            return;

        metadata.Properties.set(pProperty.ID, pProperty);

        if (pAsAttribute)
            metadata.AttributeProperties.add(pProperty.ID);
    }

    public RegisterChildTag(pParentTag: string, pChildTag: string): void
    {
        const metadata = this._ByTagName.get(pParentTag);
        if (!metadata)
            return;

        metadata.ChildTags.add(pChildTag);
    }

    public GetByTagName(pTagName: string): XIElementMetadata | null
    {
        return this._ByTagName.get(pTagName) ?? null;
    }

    public GetByClassID(pClassID: string): XIElementMetadata | null
    {
        return this._ByClassID.get(pClassID) ?? null;
    }

    public GetByConstructor(pCtor: XElementConstructor): XIElementMetadata | null
    {
        return this._ByConstructor.get(pCtor) ?? null;
    }

    public GetDerivedTypes(pBaseClassName: string): string[]
    {
        return Array.from(this._Inheritance.get(pBaseClassName) ?? []);
    }

    public CreateElement<T extends XPersistableElement>(pTagName: string): T | null
    {
        const metadata = this._ByTagName.get(pTagName);
        if (!metadata)
            return null;

        try
        {
            return new metadata.Constructor() as T;
        }
        catch
        {
            return null;
        }
    }

    public GetTagName(pElement: XPersistableElement): string
    {
        const ctor = pElement.constructor as XElementConstructor;
        const metadata = this._ByConstructor.get(ctor);
        return metadata?.TagName ?? pElement.ClassName;
    }

    public GetProperties(pTagName: string): XProperty[]
    {
        const metadata = this._ByTagName.get(pTagName);
        if (!metadata)
            return [];
        return Array.from(metadata.Properties.values());
    }

    public IsAttributeProperty(pTagName: string, pPropertyID: string): boolean
    {
        const metadata = this._ByTagName.get(pTagName);
        if (!metadata)
            return false;
        return metadata.AttributeProperties.has(pPropertyID);
    }

    public GetChildTags(pTagName: string): string[]
    {
        const metadata = this._ByTagName.get(pTagName);
        if (!metadata)
            return [];
        return Array.from(metadata.ChildTags);
    }

    public HasTag(pTagName: string): boolean
    {
        return this._ByTagName.has(pTagName);
    }

    public GetAllTags(): string[]
    {
        return Array.from(this._ByTagName.keys());
    }

    public Clear(): void
    {
        this._ByTagName.clear();
        this._ByClassID.clear();
        this._ByConstructor.clear();
        this._Inheritance.clear();
    }
}

export function RegisterElement(pTagName: string, pClassID?: string, pOrder?: number): ClassDecorator
{
    return function <TFunction extends Function>(pTarget: TFunction): TFunction
    {
        XElementRegistry.Instance.Register({
            TagName: pTagName,
            Constructor: pTarget as unknown as XElementConstructor,
            ClassID: pClassID,
            Order: pOrder
        });
        return pTarget;
    };
}

export function RegisterChildElement(pParentTag: string): ClassDecorator
{
    return function <TFunction extends Function>(pTarget: TFunction): TFunction
    {
        const meta = XElementRegistry.Instance.GetByConstructor(pTarget as unknown as XElementConstructor);
        if (meta)
            XElementRegistry.Instance.RegisterChildTag(pParentTag, meta.TagName);
        return pTarget;
    };
}
