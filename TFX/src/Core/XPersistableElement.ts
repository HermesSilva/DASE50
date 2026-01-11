import { XGuid } from "./XGuid.js";
import { XEvent } from "./XEvent.js";
import { XElement } from "./XElement.js";
import { XProperty } from "./XProperty.js";
import { XElementType, XPropertyGroup } from "./XEnums.js";
import type { XOnPropertyChanged } from "./XTypes.js";
import { XChangeTracker } from "./XChangeTracker.js";
import { XModelValue } from "./XModelValue.js";
import { XConcurrentBag, XDataValidateError, XDesignerErrorSeverity } from "./XValidation.js";
import { XConvert } from "./XConvert.js";
import { XDefault, XDesignerDefault, XPropertyBindingList } from "./XDefaults.js";
import { XData, XLinkData, XLinkArrayData, XParentData, XValues, XLinkableElement } from "./XData.js";

export abstract class XSelectable
{
    public abstract readonly ID: string;
    public abstract IsSelected: boolean;
}

export abstract class XDesignerDocument
{
    public abstract GetByID<T extends XPersistableElement>(pId: string): T | null;
    public abstract Tracker: XChangeTracker;
    public abstract SelectionManager: XSelectionManager;
}

export function IsXDesignerDocument(pValue: unknown): pValue is XDesignerDocument
{
    return pValue instanceof XDesignerDocument;
}

export class XSelectionManager
{
    private _Selection: XSelectable[] = [];

    public get Count(): number
    {
        return this._Selection.length;
    }

    public get Selection(): readonly XSelectable[]
    {
        return this._Selection;
    }

    public Clear(): void
    {
        for (const item of this._Selection)
            item.IsSelected = false;
        this._Selection = [];
    }

    public Add(pItem: XSelectable): void
    {
        if (this._Selection.indexOf(pItem) < 0)
        {
            pItem.IsSelected = true;
            this._Selection.push(pItem);
        }
    }

    public Remove(pItem: XSelectable): void
    {
        const idx = this._Selection.indexOf(pItem);
        if (idx >= 0)
        {
            pItem.IsSelected = false;
            this._Selection.splice(idx, 1);
        }
    }
}

export abstract class XPersistableElement extends XElement
{
    public static readonly IDProp = XProperty.Register<XPersistableElement, string>(
        (p: XPersistableElement) => p.ID,
        "00000001-0001-0001-0001-000000000000",
        "ID",
        "ID",
        XGuid.EmptyValue
    );

    public static readonly ElementTypeProp = XProperty.Register<XPersistableElement, XElementType>(
        (p: XPersistableElement) => p.ElementTypeValue,
        "00000001-0001-0001-0001-000000000001",
        "ElementType",
        "Element Type",
        XElementType.None
    );

    public static readonly IsSelectedProp = XProperty.Register<XPersistableElement, boolean>(
        (p: XPersistableElement) => p.IsSelected,
        "00000001-0001-0001-0001-000000000002",
        "IsSelected",
        "Is Selected",
        false
    );

    public static readonly IsLockedProp = XProperty.Register<XPersistableElement, boolean>(
        (p: XPersistableElement) => p.IsLocked,
        "00000001-0001-0001-0001-000000000003",
        "IsLocked",
        "Is Locked",
        false
    );

    public static readonly IsVisibleProp = XProperty.Register<XPersistableElement, boolean>(
        (p: XPersistableElement) => p.IsVisible,
        "00000001-0001-0001-0001-000000000004",
        "IsVisible",
        "Is Visible",
        true
    );

    public static readonly CanDeleteProp = XProperty.Register<XPersistableElement, boolean>(
        (p: XPersistableElement) => p.CanDelete,
        "00000001-0001-0001-0001-000000000005",
        "CanDelete",
        "Can Delete",
        true
    );

    public static readonly NameProp = XProperty.Register<XPersistableElement, string>(
        (p: XPersistableElement) => p.Name,
        "00000001-0001-0001-0001-000000000006",
        "Name",
        "Name",
        ""
    );

    public static readonly TreeDisplayTextProp = XProperty.Register<XPersistableElement, string | null>(
        (p: XPersistableElement) => p.TreeDisplayText,
        "00000001-0001-0001-0001-000000000007",
        "TreeDisplayText",
        "Tree Display Text",
        null
    );

    public static readonly SequenceProp = XProperty.Register<XPersistableElement, number>(
        (p: XPersistableElement) => p.Sequence,
        "00000001-0001-0001-0001-000000000008",
        "Sequence",
        "Sequence",
        0
    );

    public static readonly OrderProp = XProperty.Register<XPersistableElement, number>(
        (p: XPersistableElement) => p.Order,
        "00000001-0001-0001-0001-000000000009",
        "Order",
        "Order",
        0
    );

    public static readonly CIDProp = XProperty.Register<XPersistableElement, string>(
        (p: XPersistableElement) => p.CID,
        "00000001-0001-0001-0001-00000000000A",
        "CID",
        "Class ID",
        XGuid.EmptyValue
    );

    public static readonly AliasClassProp = XProperty.Register<XPersistableElement, string>(
        (p: XPersistableElement) => p.AliasClass,
        "00000001-0001-0001-0001-00000000000B",
        "AliasClass",
        "Alias Class",
        ""
    );

    public static readonly ParentIDProp = XProperty.Register<XPersistableElement, string>(
        (p: XPersistableElement) => p.ParentID,
        "00000001-0001-0001-0001-00000000000C",
        "ParentID",
        "Parent ID",
        XGuid.EmptyValue
    );

    private _Values: XValues | null = null;
    private _Document: XDesignerDocument | null = null;
    private _PropertyBindingList: XPropertyBindingList | null = null;
    private _IsLoaded: boolean = false;

    public readonly OnPropertyChanged: XEvent<XOnPropertyChanged> = new XEvent<XOnPropertyChanged>();

    protected constructor()
    {
        super();
    }


    public override get ID(): string
    {
        return this.GetValue(XPersistableElement.IDProp) as string;
    }

    public override set ID(pValue: string)
    {
        this.SetValue(XPersistableElement.IDProp, pValue);
    }

    public get IsLoaded(): boolean
    {
        return this._IsLoaded;
    }

    public set IsLoaded(pValue: boolean)
    {
        this._IsLoaded = pValue;
    }

    public get ElementTypeValue(): XElementType
    {
        return this.GetValue(XPersistableElement.ElementTypeProp) as XElementType;
    }

    public set ElementTypeValue(pValue: XElementType)
    {
        this.SetValue(XPersistableElement.ElementTypeProp, pValue);
    }

    public get IsSelected(): boolean
    {
        return this.GetValue(XPersistableElement.IsSelectedProp) as boolean;
    }

    public set IsSelected(pValue: boolean)
    {
        this.SetValue(XPersistableElement.IsSelectedProp, pValue);
    }

    public get IsVisible(): boolean
    {
        return this.GetValue(XPersistableElement.IsVisibleProp) as boolean;
    }

    public set IsVisible(pValue: boolean)
    {
        this.SetValue(XPersistableElement.IsVisibleProp, pValue);
    }

    public get IsLocked(): boolean
    {
        return this.GetValue(XPersistableElement.IsLockedProp) as boolean;
    }

    public set IsLocked(pValue: boolean)
    {
        this.SetValue(XPersistableElement.IsLockedProp, pValue);
    }

    public get CanDelete(): boolean
    {
        return this.GetValue(XPersistableElement.CanDeleteProp) as boolean;
    }

    public set CanDelete(pValue: boolean)
    {
        this.SetValue(XPersistableElement.CanDeleteProp, pValue);
    }

    public override get Name(): string
    {
        return this.GetValue(XPersistableElement.NameProp) as string;
    }

    public override set Name(pValue: string)
    {
        this.SetValue(XPersistableElement.NameProp, pValue);
    }

    public get TreeDisplayText(): string | null
    {
        return this.GetValue(XPersistableElement.TreeDisplayTextProp) as string | null;
    }

    public set TreeDisplayText(pValue: string | null)
    {
        this.SetValue(XPersistableElement.TreeDisplayTextProp, pValue);
    }

    public get Sequence(): number
    {
        return this.GetValue(XPersistableElement.SequenceProp) as number;
    }

    public set Sequence(pValue: number)
    {
        this.SetValue(XPersistableElement.SequenceProp, pValue);
    }

    public get Order(): number
    {
        return this.GetValue(XPersistableElement.OrderProp) as number;
    }

    public set Order(pValue: number)
    {
        this.SetValue(XPersistableElement.OrderProp, pValue);
    }

    public get CID(): string
    {
        return this.GetValue(XPersistableElement.CIDProp) as string;
    }

    public set CID(pValue: string)
    {
        this.SetValue(XPersistableElement.CIDProp, pValue);
    }

    public get AliasClass(): string
    {
        return this.GetValue(XPersistableElement.AliasClassProp) as string;
    }

    public set AliasClass(pValue: string)
    {
        this.SetValue(XPersistableElement.AliasClassProp, pValue);
    }

    public get ParentID(): string
    {
        return this.GetValue(XPersistableElement.ParentIDProp) as string;
    }

    public set ParentID(pValue: string)
    {
        this.SetValue(XPersistableElement.ParentIDProp, pValue);
    }

    public get Document(): XDesignerDocument | null
    {
        return this._Document;
    }

    public set Document(pValue: XDesignerDocument | null)
    {
        this._Document = pValue;
    }

    public get PropertyBindingList(): XPropertyBindingList
    {
        if (this._PropertyBindingList === null)
            this._PropertyBindingList = new XPropertyBindingList();
        return this._PropertyBindingList;
    }

    protected get Values(): XValues
    {
        if (this._Values === null)
            this._Values = new XValues();
        return this._Values;
    }

    public GetValue(pProperty: XProperty): unknown
    {
        const data = this.Values.GetChildById<XData>(pProperty.ID);
        if (data === null)
            return pProperty.Default.DefaultValue;
        return data.Data;
    }

    public SetValue(pProperty: XProperty, pValue: unknown): void
    {
        const old = this.GetValue(pProperty);
        if (old === pValue)
            return;

        let data = this.Values.GetChildById<XData>(pProperty.ID);
        if (data === null)
            data = this.Values.CreateChild<XData>(pProperty.ID, pProperty.Name);

        data.Data = pValue;
        this.TrackChange(pProperty, old, pValue);
        this.RaisePropertyChanged(pProperty, pValue);
    }

    public GetValueByKey(pKey: string): unknown
    {
        const prop = XProperty.TryGetByKey(pKey);
        if (prop === null)
            return undefined;
        return this.GetValue(prop);
    }

    public SetValueByKey(pKey: string, pValue: unknown): void
    {
        const prop = XProperty.TryGetByKey(pKey);
        if (prop === null)
            return;
        this.SetValue(prop, pValue);
    }

    public GetValueString(pProperty: XProperty): string
    {
        const data = this.Values.GetChildById<XData>(pProperty.ID);
        if (data === null)
            return XConvert.ToString(pProperty.Default.DefaultValue);
        return data.InnerText;
    }

    public SetValueString(pProperty: XProperty, pValue: string): void
    {
        const old = this.GetValueString(pProperty);
        if (old === pValue)
            return;

        let data = this.Values.GetChildById<XData>(pProperty.ID);
        if (data === null)
            data = this.Values.CreateChild<XData>(pProperty.ID, pProperty.Name);

        data.InnerText = pValue;
        this.TrackChange(pProperty, old, pValue);
        this.RaisePropertyChanged(pProperty, pValue);
    }

    public CheckValue<T>(pProperty: XProperty, pValue: T): boolean
    {
        const current = this.GetValue(pProperty);
        return current === pValue;
    }

    public CheckValueDefault(pProperty: XProperty): boolean
    {
        const data = this.Values.GetChildById<XData>(pProperty.ID);
        return data === null;
    }

    public CheckProperty(pProperty: XProperty): boolean
    {
        const data = this.Values.GetChildById<XData>(pProperty.ID);
        return data !== null;
    }

    public HasValue(pProperty: XProperty, pCulture?: string): boolean
    {
        if (pCulture !== undefined)
            return this.Values.GetChildById<XData>(pProperty.ID)?.GetLanguage(pCulture) !== null;

        if (pProperty.ID === XPersistableElement.IDProp.ID)
            return true;

        if (pProperty.ID === XPersistableElement.NameProp.ID)
            return XGuid.IsFullValue(this.Name);

        if (pProperty.ID === XPersistableElement.ParentIDProp.ID)
            return XGuid.IsFullValue(this.ParentID);

        const data = this.Values.GetChildById<XData>(pProperty.ID);
        const pd = pProperty.Default;

        if (pd.IsLinked)
        {
            const linkData = this.Values.GetChildById<XLinkData>(pProperty.ID);
            if (linkData === null || linkData.Element === null)
                return false;
        }

        if (data !== null && pd.CultureSensitive)
            return data.GetLanguage(XDesignerDefault.CurrentCulture) !== null;

        return data !== null;
    }

    public GetLinkedElement<T extends XPersistableElement>(pProperty: XProperty): T | null
    {
        if (this.Document === null)
            return null;

        if (!pProperty.Default.IsLinked)
            return null;

        const data = this.Values.GetChildById<XLinkData>(pProperty.ID);
        if (data === null)
            return null;

        const result = data.LoadElement(false);
        if (!result.IsElementOk || data.Element === null)
        {
            const id = data.Data as string;
            if (XGuid.IsFullValue(id))
            {
                const elem = this.Document.GetByID<T>(id);
                data.Element = elem as unknown as XLinkableElement;
                if (elem === null)
                    return null;
                return elem;
            }
            else
                return null;
        }

        return data.Element as unknown as T;
    }

    public SetLinkedElement<T extends XPersistableElement>(pProperty: XProperty, pValue: T | null): void
    {
        if (!pProperty.Default.IsLinked)
            return;

        const old = this.GetLinkedElement<T>(pProperty);
        if (old === pValue)
            return;

        let data = this.Values.GetChildById<XLinkData>(pProperty.ID);
        if (data === null)
        {
            const newData = new XLinkData();
            newData.ID = pProperty.ID;
            newData.Name = pProperty.Name;
            this.Values.AppendChild(newData as unknown as XElement);
            data = newData;
        }

        if (pValue === null)
        {
            data.Element = null;
            data.Data = XGuid.EmptyValue;
        }
        else
            data.SetElement(pValue as unknown as XLinkableElement);

        const oldId = old?.ID ?? XGuid.EmptyValue;
        const newId = pValue?.ID ?? XGuid.EmptyValue;
        this.TrackChange(pProperty, oldId, newId);
        this.RaisePropertyChanged(pProperty, pValue);
    }

    public GetLinkedElements<T extends XPersistableElement>(pProperty: XProperty): T[]
    {
        if (this.Document === null)
            return [];

        if (!pProperty.Default.IsLinked)
            return [];

        const data = this.Values.GetChildById<XLinkArrayData>(pProperty.ID);
        if (data === null)
            return [];

        const result: T[] = [];
        for (const ld of data.Where())
        {
            if (ld.Element !== null)
            {
                result.push(ld.Element as unknown as T);
                continue;
            }

            const id = ld.Data as string;
            if (XGuid.IsFullValue(id))
            {
                const elem = this.Document.GetByID<T>(id);
                if (elem !== null)
                {
                    ld.Element = elem as unknown as XLinkableElement;
                    result.push(elem);
                }
            }
        }

        return result;
    }

    public SetLinkedElements<T extends XPersistableElement>(pProperty: XProperty, pValues: T[]): void
    {
        if (!pProperty.Default.IsLinked)
            return;

        let data = this.Values.GetChildById<XLinkArrayData>(pProperty.ID);
        if (data === null)
        {
            const newData = new XLinkArrayData();
            newData.ID = pProperty.ID;
            newData.Name = pProperty.Name;
            this.Values.AppendChild(newData as unknown as XElement);
            data = newData;
        }

        data.SetElement(pValues as unknown as XLinkableElement[]);
        this.RaisePropertyChanged(pProperty, pValues);
    }

    public GetParentElement<T extends XPersistableElement>(pProperty: XProperty): T | null
    {
        if (this.Document === null)
            return null;

        const data = this.Values.GetChildById<XParentData>(pProperty.ID);
        if (data === null)
            return null;

        data.Refresh(false);
        if (!data.IsElementOk || data.Element === null)
        {
            const id = data.Data as string;
            if (XGuid.IsFullValue(id))
            {
                const elem = this.Document.GetByID<T>(id);
                data.Element = elem as unknown as XLinkableElement;
                if (elem === null)
                    return null;
            }
            else
                return null;
        }

        return data.Element as unknown as T;
    }

    public SetParentElement<T extends XPersistableElement>(pProperty: XProperty, pValue: T | null): void
    {
        const old = this.GetParentElement<T>(pProperty);
        if (old === pValue)
            return;

        let data = this.Values.GetChildById<XParentData>(pProperty.ID);
        if (data === null)
        {
            const newData = new XParentData();
            newData.ID = pProperty.ID;
            newData.Name = pProperty.Name;
            this.Values.AppendChild(newData as unknown as XElement);
            data = newData;
        }

        if (pValue === null)
        {
            data.Element = null;
            data.Data = XGuid.EmptyValue;
        }
        else
            data.SetElement(pValue as unknown as XLinkableElement);

        const oldId = old?.ID ?? XGuid.EmptyValue;
        const newId = pValue?.ID ?? XGuid.EmptyValue;
        this.TrackChange(pProperty, oldId, newId);
        this.RaisePropertyChanged(pProperty, pValue);
    }

    public Validate(_pBag: XConcurrentBag<XDataValidateError>): void
    {
    }

    protected AddValidationError(pBag: XConcurrentBag<XDataValidateError>, pMessage: string, pProperty?: XProperty): void
    {
        pBag.Add(new XDataValidateError(this, XDesignerErrorSeverity.Error, pMessage, pProperty));
    }

    protected AddValidationWarning(pBag: XConcurrentBag<XDataValidateError>, pMessage: string, pProperty?: XProperty): void
    {
        pBag.Add(new XDataValidateError(this, XDesignerErrorSeverity.Warning, pMessage, pProperty));
    }

    protected ValidateRequired(pBag: XConcurrentBag<XDataValidateError>, pProperty: XProperty): boolean
    {
        const val = this.GetValueString(pProperty);
        const dflt = XConvert.ToString(pProperty.Default.DefaultValue);
        if (val === "" || val === dflt)
        {
            pBag.Add(XDataValidateError.Required(this, pProperty));
            return false;
        }
        return true;
    }

    private TrackChange(pProperty: XProperty, pOldValue: unknown, pNewValue: unknown): void
    {
        if (this.Document === null)
            return;

        const tracker = this.Document.Tracker;
        if (tracker === null)
            return;

        const oldStr = XConvert.ToString(pOldValue);
        const newStr = XConvert.ToString(pNewValue);
        tracker.TrackChange(this, pProperty, pProperty.Default, oldStr, newStr);
    }

    protected RaisePropertyChanged(pProperty: XProperty, pValue: unknown): void
    {
        this.OnPropertyChanged.Raise(this, pProperty, pValue);
    }

    public InitializeNew(): void
    {
        if (XDefault.SetNewID || XGuid.IsEmptyValue(this.ID))
            this.ID = XGuid.NewValue();
    }

    public Initialize(): void
    {
        this._IsLoaded = true;
    }

    public Clone<T extends XPersistableElement>(): T
    {
        const ctor = this.constructor as new () => T;
        const clone = new ctor();
        clone.ID = XGuid.NewValue();
        this.CopyTo(clone);
        return clone;
    }

    public CopyTo(pTarget: XPersistableElement): void
    {
        pTarget.Name = this.Name;
        pTarget.TreeDisplayText = this.TreeDisplayText;
        pTarget.IsVisible = this.IsVisible;
        pTarget.IsLocked = this.IsLocked;
        pTarget.CanDelete = this.CanDelete;
        pTarget.Sequence = this.Sequence;
        pTarget.Order = this.Order;
        pTarget.CID = this.CID;
        pTarget.AliasClass = this.AliasClass;
    }

    public Delete(pDeep: boolean = true): void
    {
        if (pDeep)
        {
            for (const child of this.ChildNodes)
            {
                const pe = child as unknown as XPersistableElement;
                if (pe && typeof pe.Delete === "function")
                    pe.Delete(true);
            }
        }

        if (this._Values !== null)
            this._Values = null;

        this._Document = null;
        this._PropertyBindingList = null;
    }

    public GetModelValues(): XModelValue[]
    {
        const result: XModelValue[] = [];
        const props = new Map<string, XProperty>();
        XProperty.LoadProperties(this, props);

        for (const prop of props.values())
        {
            if (prop.Default.Group === XPropertyGroup.Design)
                continue;

            const val = this.GetValue(prop);
            if (val === null || val === prop.Default.DefaultValue)
                continue;

            const mv = XModelValue.FromProperty(this, prop, val, this.ID);
            result.push(mv);
        }

        return result;
    }

    public SetModelValue(pModelValue: XModelValue): void
    {
        const prop = XProperty.TryGet(pModelValue.PropertyId);
        if (prop === null)
            return;

        if (prop.Default.IsLinked)
        {
            if (this.Document === null)
                return;
            const elem = this.Document.GetByID(pModelValue.Value as string);
            this.SetLinkedElement(prop, elem);
        }
        else
            this.SetValue(prop, pModelValue.Value);
    }

    public GetSerializableProperties(): XProperty[]
    {
        const result: XProperty[] = [];
        const props = new Map<string, XProperty>();
        XProperty.LoadProperties(this, props);

        for (const prop of props.values())
        {
            if (prop.Default.Group !== XPropertyGroup.Design)
                result.push(prop);
        }

        return result;
    }

    public ToJSON(): Record<string, unknown>
    {
        const result: Record<string, unknown> = {};
        result["$type"] = this.ClassName;
        result["ID"] = this.ID;

        const props = this.GetSerializableProperties();
        for (const prop of props)
        {
            const val = this.GetValue(prop);
            if (val !== prop.Default.DefaultValue)
                result[prop.Name] = val;
        }

        return result;
    }

    public FromJSON(pData: Record<string, unknown>): void
    {
        if (pData["ID"])
            this.ID = pData["ID"] as string;

        const props = this.GetSerializableProperties();
        for (const prop of props)
        {
            if (prop.Name in pData)
                this.SetValue(prop, pData[prop.Name]);
        }
    }
}
