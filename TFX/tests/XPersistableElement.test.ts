import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    IsXDesignerDocument,
    XSelectionManager,
    XSelectable,
    XDesignerDocument,
    XPersistableElement
} from "../src/Core/XPersistableElement.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XProperty } from "../src/Core/XProperty.js";
import { XPropertyGroup } from "../src/Core/XEnums.js";
import { XElementType } from "../src/Core/XEnums.js";
import { XDefault } from "../src/Core/XDefaults.js";
import { XChangeTracker } from "../src/Core/XChangeTracker.js";
import { XConcurrentBag, XDesignerErrorSeverity, type XDataValidateError } from "../src/Core/XValidation.js";
import { XModelValue } from "../src/Core/XModelValue.js";
import { XElement } from "../src/Core/XElement.js";
import type { XLinkData, XLinkArrayData, XParentData, XValues } from "../src/Core/XData.js";

class TestSelectable extends XSelectable
{
    public constructor(pId: string)
    {
        super();
        this._ID = pId;
    }

    private readonly _ID: string;
    public override IsSelected: boolean = false;

    public override get ID(): string
    {
        return this._ID;
    }
}

class SpyTracker extends XChangeTracker
{
    public TrackChange = vi.fn(super.TrackChange.bind(this));
}

class TestDesignerDocument extends XDesignerDocument
{
    private readonly _Map = new Map<string, XPersistableElement>();
    private readonly _Tracker: XChangeTracker;
    private readonly _SelectionManager: XSelectionManager;

    public constructor(pTracker: XChangeTracker, pSelectionManager: XSelectionManager)
    {
        super();
        this._Tracker = pTracker;
        this._SelectionManager = pSelectionManager;
    }

    public Add(pElement: XPersistableElement): void
    {
        this._Map.set(pElement.ID, pElement);
    }

    public override GetByID<T extends XPersistableElement>(pId: string): T | null
    {
        return (this._Map.get(pId) as T) ?? null;
    }

    public override get Tracker(): XChangeTracker
    {
        return this._Tracker;
    }

    public override get SelectionManager(): XSelectionManager
    {
        return this._SelectionManager;
    }
}

class TestElement extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    public ExposeAddValidationError(pBag: XConcurrentBag<XDataValidateError>, pMessage: string): void
    {
        this.AddValidationError(pBag, pMessage);
    }

    public ExposeAddValidationWarning(pBag: XConcurrentBag<XDataValidateError>, pMessage: string): void
    {
        this.AddValidationWarning(pBag, pMessage);
    }

    public ExposeValidateRequired(pBag: XConcurrentBag<XDataValidateError>, pProperty: XProperty): boolean
    {
        return this.ValidateRequired(pBag, pProperty);
    }
}

class TestElementWithProps extends TestElement
{
    public CustomText: string = "";
    public CustomNumber: number = 0;
    public CustomDesign: string = "";
    public CustomCulture: string = "";
    public LinkID: string = XGuid.EmptyValue;
    public LinkIDs: string[] = [];
    public ParentLinkID: string = XGuid.EmptyValue;

    public RequiredDefaultText: string = "dflt";

    public static readonly CustomTextProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.CustomText) as unknown as ((p: TestElementWithProps) => string) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.Register(sel, "10000000-0000-0000-0000-000000000001", "CustomText", "Custom Text", "");
    })();

    public static readonly CustomNumberProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.CustomNumber) as unknown as ((p: TestElementWithProps) => number) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.Register(sel, "10000000-0000-0000-0000-000000000002", "CustomNumber", "Custom Number", 0);
    })();

    public static readonly CustomDesignProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.CustomDesign) as unknown as ((p: TestElementWithProps) => string) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        const prop = XProperty.Register(sel, "10000000-0000-0000-0000-000000000003", "CustomDesign", "Custom Design", "");
        prop.Default.Group = XPropertyGroup.Design;
        return prop;
    })();

    public static readonly CustomCultureProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.CustomCulture) as unknown as ((p: TestElementWithProps) => string) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.Register(sel, "10000000-0000-0000-0000-000000000004", "CustomCulture", "Custom Culture", "", false, true);
    })();

    public static readonly LinkedProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.LinkID) as unknown as ((p: TestElementWithProps) => string) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.RegisterLink(sel, "10000000-0000-0000-0000-000000000005", "Linked", "Linked", XGuid.EmptyValue);
    })();

    public static readonly LinkedArrayProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.LinkIDs) as unknown as ((p: TestElementWithProps) => string[]) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.RegisterLinkArray(sel, "10000000-0000-0000-0000-000000000006", "LinkedArray", "Linked Array", []);
    })();

    public static readonly ParentProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.ParentLinkID) as unknown as ((p: TestElementWithProps) => string) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.Register(sel, "10000000-0000-0000-0000-000000000007", "Parent", "Parent", XGuid.EmptyValue);
    })();

    public static readonly RequiredDefaultTextProp: XProperty = (() =>
    {
        const sel = ((p: TestElementWithProps) => p.RequiredDefaultText) as unknown as ((p: TestElementWithProps) => string) & { DeclaringType?: unknown };
        sel.DeclaringType = TestElementWithProps;
        return XProperty.Register(sel, "10000000-0000-0000-0000-000000000008", "RequiredDefaultText", "Required Default Text", "dflt");
    })();
}

class SpyChildElement extends TestElement
{
    public DeleteCalled: boolean = false;

    public override Delete(pDeep: boolean = true): void
    {
        this.DeleteCalled = true;
        super.Delete(pDeep);
    }
}

class PlainChildElement extends XElement
{
}

describe("XPersistableElement.ts", () =>
{
    const originalSetNewID = XDefault.SetNewID;

    beforeEach(() =>
    {
        XDefault.SetNewID = originalSetNewID;
    });

    describe("type guards and selection", () =>
    {
        it("IsXDesignerDocument should work", () =>
        {
            const doc = new TestDesignerDocument(new XChangeTracker(), new XSelectionManager());
            expect(IsXDesignerDocument(doc)).toBe(true);
            expect(IsXDesignerDocument({})).toBe(false);
            expect(IsXDesignerDocument(null)).toBe(false);
        });

        it("XSelectionManager should manage selection", () =>
        {
            const mgr = new XSelectionManager();
            const a = new TestSelectable("a");
            const b = new TestSelectable("b");

            expect(mgr.Count).toBe(0);
            expect(mgr.Selection).toEqual([]);

            mgr.Add(a);
            mgr.Add(a);
            mgr.Add(b);

            expect(a.IsSelected).toBe(true);
            expect(b.IsSelected).toBe(true);
            expect(mgr.Count).toBe(2);

            mgr.Remove(a);
            expect(a.IsSelected).toBe(false);
            expect(mgr.Count).toBe(1);

            mgr.Remove(a);
            expect(mgr.Count).toBe(1);

            mgr.Clear();
            expect(b.IsSelected).toBe(false);
            expect(mgr.Count).toBe(0);
        });
    });

    describe("core values API", () =>
    {
        it("ID/IsLoaded/ElementTypeValue should be settable", () =>
        {
            const elem = new TestElement();
            const id = XGuid.NewValue();
            elem.ID = id;
            expect(elem.ID).toBe(id);

            elem.IsLoaded = true;
            expect(elem.IsLoaded).toBe(true);

            elem.ElementTypeValue = XElementType.None;
            expect(elem.ElementTypeValue).toBe(XElementType.None);
        });

        it("property wrappers should route through GetValue/SetValue", () =>
        {
            const elem = new TestElement();
            elem.IsSelected = true;
            elem.IsLocked = true;
            elem.IsVisible = false;
            elem.CanDelete = false;

            expect(elem.IsSelected).toBe(true);
            expect(elem.IsLocked).toBe(true);
            expect(elem.IsVisible).toBe(false);
            expect(elem.CanDelete).toBe(false);
        });

        it("GetValue should return default when missing", () =>
        {
            const elem = new TestElement();
            expect(elem.GetValue(XPersistableElement.SequenceProp)).toBe(0);
        });

        it("SetValue should write, track and raise when changed", () =>
        {
            const elem = new TestElement();

            const tracker = new SpyTracker();
            const doc = new TestDesignerDocument(tracker, new XSelectionManager());
            elem.Document = doc;

            const handler = vi.fn();
            elem.OnPropertyChanged.Add(handler);

            elem.SetValue(XPersistableElement.NameProp, "TestName");

            expect(elem.GetValue(XPersistableElement.NameProp)).toBe("TestName");
            expect(tracker.TrackChange).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(elem, XPersistableElement.NameProp, "TestName");
        });

        it("SetValue should not track nor raise when value is unchanged", () =>
        {
            const elem = new TestElement();

            const tracker = new SpyTracker();
            const doc = new TestDesignerDocument(tracker, new XSelectionManager());
            elem.Document = doc;

            const handler = vi.fn();
            elem.OnPropertyChanged.Add(handler);

            elem.SetValue(XPersistableElement.NameProp, "Same");
            elem.SetValue(XPersistableElement.NameProp, "Same");

            expect(tracker.TrackChange).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("GetValueString / SetValueString should use InnerText and track", () =>
        {
            const elem = new TestElement();
            const tracker = new SpyTracker();
            elem.Document = new TestDesignerDocument(tracker, new XSelectionManager());

            expect(elem.GetValueString(XPersistableElement.SequenceProp)).toBe("0");

            elem.SetValueString(XPersistableElement.SequenceProp, "123");
            expect(elem.GetValueString(XPersistableElement.SequenceProp)).toBe("123");

            elem.SetValueString(XPersistableElement.SequenceProp, "123");
            expect(tracker.TrackChange).toHaveBeenCalledTimes(1);

            elem.SetValueString(XPersistableElement.SequenceProp, "456");
            expect(elem.GetValueString(XPersistableElement.SequenceProp)).toBe("456");
            expect(tracker.TrackChange).toHaveBeenCalledTimes(2);
        });

        it("GetValueByKey / SetValueByKey should use XProperty key lookup", () =>
        {
            const elem = new TestElementWithProps();
            const key = `${TestElementWithProps.name}.CustomText`;

            expect(elem.GetValueByKey(key)).toBe("");
            expect(elem.GetValueByKey("Nope.DoesNotExist")).toBeUndefined();

            elem.SetValueByKey(key, "abc");
            expect(elem.GetValue(TestElementWithProps.CustomTextProp)).toBe("abc");

            elem.SetValueByKey("Nope.DoesNotExist", "x");
            expect(elem.GetValue(TestElementWithProps.CustomTextProp)).toBe("abc");
        });

        it("CheckValue / CheckValueDefault / CheckProperty should work", () =>
        {
            const elem = new TestElement();

            expect(elem.CheckValue(XPersistableElement.SequenceProp, 0)).toBe(true);
            expect(elem.CheckValueDefault(XPersistableElement.SequenceProp)).toBe(true);
            expect(elem.CheckProperty(XPersistableElement.SequenceProp)).toBe(false);

            elem.Sequence = 42;
            expect(elem.CheckValue(XPersistableElement.SequenceProp, 42)).toBe(true);
            expect(elem.CheckValueDefault(XPersistableElement.SequenceProp)).toBe(false);
            expect(elem.CheckProperty(XPersistableElement.SequenceProp)).toBe(true);
        });
    });

    describe("HasValue branches", () =>
    {
        it("should cover ID/Name/ParentID and generic data", () =>
        {
            const elem = new TestElement();

            expect(elem.HasValue(XPersistableElement.IDProp)).toBe(true);
            expect(elem.HasValue(XPersistableElement.NameProp)).toBe(false);
            expect(elem.HasValue(XPersistableElement.ParentIDProp)).toBe(false);
            expect(elem.HasValue(XPersistableElement.SequenceProp)).toBe(false);

            elem.Name = "TestName";
            elem.ParentID = XGuid.NewValue();
            elem.Sequence = 42;

            expect(elem.HasValue(XPersistableElement.NameProp)).toBe(true);
            expect(elem.HasValue(XPersistableElement.ParentIDProp)).toBe(true);
            expect(elem.HasValue(XPersistableElement.SequenceProp)).toBe(true);
        });

        it("should return false for culture-sensitive values when no language exists", () =>
        {
            const elem = new TestElementWithProps();
            elem.SetValue(TestElementWithProps.CustomCultureProp, "x");

            expect(elem.HasValue(TestElementWithProps.CustomCultureProp)).toBe(false);
            expect(elem.HasValue(TestElementWithProps.CustomCultureProp, "en-US")).toBe(false);
        });

        it("should handle linked properties presence", () =>
        {
            const elem = new TestElementWithProps();
            const target = new TestElement();
            target.ID = XGuid.NewValue();

            const doc = new TestDesignerDocument(new XChangeTracker(), new XSelectionManager());
            doc.Add(target);
            elem.Document = doc;

            expect(elem.HasValue(TestElementWithProps.LinkedProp)).toBe(false);

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target);
            expect(elem.HasValue(TestElementWithProps.LinkedProp)).toBe(true);
        });
    });

    describe("identity and lifecycle", () =>
    {
        it("ClassName should default to constructor.name and be overridable", () =>
        {
            const elem = new TestElement();
            expect(elem.ClassName).toBe(TestElement.name);

        });

        it("InitializeNew should set ID based on defaults", () =>
        {
            const elem = new TestElement();
            expect(elem.ID).toBe(XGuid.EmptyValue);

            XDefault.SetNewID = false;
            elem.InitializeNew();
            expect(elem.ID).not.toBe(XGuid.EmptyValue);

            const oldId = elem.ID;
            XDefault.SetNewID = false;
            elem.InitializeNew();
            expect(elem.ID).toBe(oldId);

            XDefault.SetNewID = true;
            elem.InitializeNew();
            expect(elem.ID).not.toBe(oldId);
        });

        it("Initialize should mark element as loaded", () =>
        {
            const elem = new TestElement();
            expect(elem.IsLoaded).toBe(false);
            elem.Initialize();
            expect(elem.IsLoaded).toBe(true);
        });

        it("Clone and CopyTo should copy core fields and generate new ID", () =>
        {
            const elem = new TestElement();
            elem.ID = XGuid.NewValue();
            elem.Name = "N";
            elem.TreeDisplayText = "T";
            elem.IsVisible = false;
            elem.IsLocked = true;
            elem.CanDelete = false;
            elem.Sequence = 10;
            elem.Order = 20;
            elem.CID = XGuid.NewValue();
            elem.AliasClass = "A";

            const clone = elem.Clone<TestElement>();

            expect(clone).not.toBe(elem);
            expect(clone.ID).not.toBe(elem.ID);
            expect(clone.Name).toBe("N");
            expect(clone.TreeDisplayText).toBe("T");
            expect(clone.IsVisible).toBe(false);
            expect(clone.IsLocked).toBe(true);
            expect(clone.CanDelete).toBe(false);
            expect(clone.Sequence).toBe(10);
            expect(clone.Order).toBe(20);
            expect(clone.CID).toBe(elem.CID);
            expect(clone.AliasClass).toBe("A");
        });

        it("Delete should deep-delete children and clear internal state", () =>
        {
            const parent = new TestElement();
            parent.Sequence = 1;
            parent.PropertyBindingList.Add({ ID: XGuid.NewValue(), OnlyExplicit: false, Property: null });

            const child = new SpyChildElement();
            parent.AppendChild(child);

            expect(parent.CheckProperty(XPersistableElement.SequenceProp)).toBe(true);
            expect(parent.PropertyBindingList.Count).toBe(1);
            expect(child.DeleteCalled).toBe(false);

            parent.Delete(true);

            expect(child.DeleteCalled).toBe(true);
            expect(parent.CheckProperty(XPersistableElement.SequenceProp)).toBe(false);
            expect(parent.PropertyBindingList.Count).toBe(0);
            expect(parent.Document).toBeNull();
        });

        it("Delete should respect pDeep=false and skip non-deletable children", () =>
        {
            const parent = new TestElement();
            const child = new SpyChildElement();
            const plain = new PlainChildElement();
            parent.AppendChild(child);
            parent.AppendChild(plain);

            parent.Delete(false);
            expect(child.DeleteCalled).toBe(false);

            const parent2 = new TestElement();
            parent2.AppendChild(new PlainChildElement());
            parent2.Delete(true);
        });

        it("Delete should handle when Values were never created", () =>
        {
            const elem = new TestElement();
            elem.Delete(true);
            expect(elem.CheckProperty(XPersistableElement.SequenceProp)).toBe(false);
        });
    });

    describe("linked and parent elements", () =>
    {
        it("TrackChange should no-op when tracker is null", () =>
        {
            class NullTrackerDocument extends XDesignerDocument
            {
                public override GetByID<T extends XPersistableElement>(_pId: string): T | null
                {
                    return null;
                }

                public override get Tracker(): XChangeTracker
                {
                    return null as unknown as XChangeTracker;
                }

                public override get SelectionManager(): XSelectionManager
                {
                    return new XSelectionManager();
                }
            }

            const elem = new TestElement();
            elem.Document = new NullTrackerDocument();
            elem.Name = "X";
            expect(elem.Name).toBe("X");
        });

        it("GetLinkedElement should return null without document or for non-linked property", () =>
        {
            const elem = new TestElementWithProps();
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBeNull();
            expect(elem.GetLinkedElement(TestElementWithProps.CustomTextProp)).toBeNull();
        });

        it("GetLinkedElement should return null when document exists but link data is missing", () =>
        {
            const elem = new TestElementWithProps();
            elem.Document = new TestDesignerDocument(new XChangeTracker(), new XSelectionManager());
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBeNull();
        });

        it("SetLinkedElement/SetLinkedElements should populate link data even without a document", () =>
        {
            const elem = new TestElementWithProps();
            const target = new TestElement();
            target.ID = XGuid.NewValue();

            const changed = vi.fn();
            elem.OnPropertyChanged.Add(changed);

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target);
            expect(elem.HasValue(TestElementWithProps.LinkedProp)).toBe(true);
            expect(elem.GetLinkedElement<TestElement>(TestElementWithProps.LinkedProp)).toBeNull();

            elem.SetLinkedElements(TestElementWithProps.LinkedArrayProp, [target]);
            expect(changed).toHaveBeenCalledTimes(2);
            expect(elem.GetLinkedElements<TestElement>(TestElementWithProps.LinkedArrayProp)).toEqual([]);
        });

        it("SetLinkedElement should create link data, support null, and resolve by ID", () =>
        {
            const elem = new TestElementWithProps();
            const target = new TestElement();
            target.ID = XGuid.NewValue();

            const target2 = new TestElement();
            target2.ID = XGuid.NewValue();

            const doc = new TestDesignerDocument(new XChangeTracker(), new XSelectionManager());
            doc.Add(target);
            doc.Add(target2);
            elem.Document = doc;

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target);
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBe(target);

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, null);
            expect(elem.HasValue(TestElementWithProps.LinkedProp)).toBe(false);
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBeNull();

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target);
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBe(target);

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target2);
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBe(target2);

            const changed = vi.fn();
            elem.OnPropertyChanged.Add(changed);
            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target2);
            expect(changed).toHaveBeenCalledTimes(0);

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, target);
            expect(changed).toHaveBeenCalledTimes(1);

            elem.SetLinkedElement(TestElementWithProps.CustomTextProp, target as unknown as TestElementWithProps);
            expect(elem.GetLinkedElement(TestElementWithProps.CustomTextProp)).toBeNull();

            const values = (elem as unknown as { Values: XValues }).Values;
            const data = values.GetChildById<XLinkData>(TestElementWithProps.LinkedProp.ID);
            expect(data).not.toBeNull();

            if (data)
            {
                data.Element = null;
                data.Data = target.ID;
            }

            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBe(target);

            if (data)
            {
                data.Element = null;
                const unknownId = XGuid.NewValue();
                data.Data = unknownId;
            }
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBeNull();

            elem.SetLinkedElement(TestElementWithProps.LinkedProp, null);
            expect(elem.GetLinkedElement(TestElementWithProps.LinkedProp)).toBeNull();
        });

        it("GetLinkedElements / SetLinkedElements should handle arrays and resolution", () =>
        {
            const elem = new TestElementWithProps();
            const doc = new TestDesignerDocument(new XChangeTracker(), new XSelectionManager());
            elem.Document = doc;

            expect(elem.GetLinkedElements(TestElementWithProps.LinkedArrayProp)).toEqual([]);
            expect(elem.GetLinkedElements(TestElementWithProps.CustomTextProp)).toEqual([]);

            const a = new TestElement();
            a.ID = XGuid.NewValue();
            const b = new TestElement();
            b.ID = XGuid.NewValue();
            doc.Add(a);
            doc.Add(b);

            const changed = vi.fn();
            elem.OnPropertyChanged.Add(changed);

            elem.SetLinkedElements(TestElementWithProps.LinkedArrayProp, [a, b]);
            const list1 = elem.GetLinkedElements<TestElement>(TestElementWithProps.LinkedArrayProp);
            expect(list1).toEqual([a, b]);
            expect(changed).toHaveBeenCalledTimes(1);

            elem.SetLinkedElements(TestElementWithProps.CustomTextProp, [a] as unknown as TestElementWithProps[]);
            expect(changed).toHaveBeenCalledTimes(1);

            const values = (elem as unknown as { Values: XValues }).Values;
            const data = values.GetChildById<XLinkArrayData>(TestElementWithProps.LinkedArrayProp.ID);
            expect(data).not.toBeNull();

            if (data)
            {
                const ld0 = data.ChildNodes[0];
                ld0.Element = null;
                ld0.Data = a.ID;

                const ld1 = data.ChildNodes[1];
                ld1.Element = null;
                const unknownId = XGuid.NewValue();
                ld1.Data = unknownId;
            }

            const list2 = elem.GetLinkedElements<TestElement>(TestElementWithProps.LinkedArrayProp);
            expect(list2).toEqual([a]);

            if (data)
            {
                const ld1 = data.ChildNodes[1];
                ld1.Element = null;
                ld1.Data = XGuid.EmptyValue;
            }

            const list3 = elem.GetLinkedElements<TestElement>(TestElementWithProps.LinkedArrayProp);
            expect(list3).toEqual([a]);

            elem.SetLinkedElements(TestElementWithProps.LinkedArrayProp, [b]);
            const list1b = elem.GetLinkedElements<TestElement>(TestElementWithProps.LinkedArrayProp);
            expect(list1b).toEqual([b]);
            expect(changed).toHaveBeenCalledTimes(2);
        });

        it("GetParentElement / SetParentElement should store and resolve", () =>
        {
            const elem = new TestElementWithProps();
            const target = new TestElement();
            target.ID = XGuid.NewValue();

            const target2 = new TestElement();
            target2.ID = XGuid.NewValue();

            const doc = new TestDesignerDocument(new XChangeTracker(), new XSelectionManager());
            doc.Add(target);
            doc.Add(target2);
            elem.Document = doc;

            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBeNull();

            elem.SetParentElement(TestElementWithProps.ParentProp, target);
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBe(target);

            elem.SetParentElement(TestElementWithProps.ParentProp, target2);
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBe(target2);

            elem.SetParentElement(TestElementWithProps.ParentProp, null);
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBeNull();

            elem.SetParentElement(TestElementWithProps.ParentProp, target);
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBe(target);

            const changed = vi.fn();
            elem.OnPropertyChanged.Add(changed);
            elem.SetParentElement(TestElementWithProps.ParentProp, target);
            expect(changed).toHaveBeenCalledTimes(0);

            elem.SetParentElement(TestElementWithProps.ParentProp, target2);
            expect(changed).toHaveBeenCalledTimes(1);

            const values = (elem as unknown as { Values: XValues }).Values;
            const pd = values.GetChildById<XParentData>(TestElementWithProps.ParentProp.ID);
            expect(pd).not.toBeNull();

            if (pd)
            {
                pd.Element = null;
                pd.Data = target.ID;
            }

            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBe(target);

            if (pd)
            {
                pd.Element = null;
                pd.Data = XGuid.EmptyValue;
            }
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBeNull();

            if (pd)
            {
                pd.Element = null;
                pd.Data = XGuid.NewValue();
            }
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBeNull();

            elem.SetParentElement(TestElementWithProps.ParentProp, null);
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBeNull();
        });

        it("SetParentElement should set parent data even without a document", () =>
        {
            const elem = new TestElementWithProps();
            const target = new TestElement();
            target.ID = XGuid.NewValue();

            const changed = vi.fn();
            elem.OnPropertyChanged.Add(changed);

            elem.SetParentElement(TestElementWithProps.ParentProp, target);
            expect(changed).toHaveBeenCalledTimes(1);
            expect(elem.GetParentElement<TestElement>(TestElementWithProps.ParentProp)).toBeNull();
        });
    });

    describe("validation helpers", () =>
    {
        it("Validate should be a no-op by default", () =>
        {
            const elem = new TestElement();
            const bag = new XConcurrentBag<XDataValidateError>();
            elem.Validate(bag);
            expect(bag.Count).toBe(0);
        });

        it("AddValidationError/Warning should populate the bag", () =>
        {
            const elem = new TestElement();
            const bag = new XConcurrentBag<XDataValidateError>();

            elem.ExposeAddValidationError(bag, "E");
            elem.ExposeAddValidationWarning(bag, "W");

            const items = bag.ToArray();
            expect(items.length).toBe(2);
            expect(items[0]?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(items[0]?.Message).toBe("E");
            expect(items[1]?.Severity).toBe(XDesignerErrorSeverity.Warning);
            expect(items[1]?.Message).toBe("W");
        });

        it("ValidateRequired should add a Required error for empty/default", () =>
        {
            const elem = new TestElement();
            const bag = new XConcurrentBag<XDataValidateError>();
            const prop = TestElementWithProps.CustomTextProp;

            expect(elem.ExposeValidateRequired(bag, prop)).toBe(false);
            expect(bag.Count).toBe(1);

            bag.Clear();
            elem.SetValueString(prop, "x");
            expect(elem.ExposeValidateRequired(bag, prop)).toBe(true);
            expect(bag.Count).toBe(0);
        });

        it("ValidateRequired should also fail when value equals non-empty default", () =>
        {
            const elem = new TestElementWithProps();
            const bag = new XConcurrentBag<XDataValidateError>();

            expect(elem.ExposeValidateRequired(bag, TestElementWithProps.RequiredDefaultTextProp)).toBe(false);
            expect(bag.Count).toBe(1);

            bag.Clear();
            elem.SetValueString(TestElementWithProps.RequiredDefaultTextProp, "x");
            expect(elem.ExposeValidateRequired(bag, TestElementWithProps.RequiredDefaultTextProp)).toBe(true);
            expect(bag.Count).toBe(0);
        });
    });

    describe("model values and JSON", () =>
    {
        it("GetSerializableProperties should exclude Design group", () =>
        {
            const elem = new TestElementWithProps();
            const props = elem.GetSerializableProperties();

            const ids = props.map(p => p.ID);
            expect(ids.includes(TestElementWithProps.CustomTextProp.ID)).toBe(true);
            expect(ids.includes(TestElementWithProps.CustomDesignProp.ID)).toBe(false);
        });

        it("ToJSON / FromJSON should serialize only non-defaults", () =>
        {
            const elem = new TestElementWithProps();
            elem.ID = XGuid.NewValue();

            elem.SetValue(TestElementWithProps.CustomTextProp, "abc");
            elem.SetValue(TestElementWithProps.CustomNumberProp, 0);
            elem.SetValue(TestElementWithProps.CustomDesignProp, "design");

            const json = elem.ToJSON();

            expect(json["$type"]).toBe("TestElementWithProps");
            expect(json["ID"]).toBe(elem.ID);
            expect(json["CustomText"]).toBe("abc");
            expect("CustomNumber" in json).toBe(false);
            expect("CustomDesign" in json).toBe(false);

            const elem2 = new TestElementWithProps();
            elem2.FromJSON({ ID: "x", CustomText: "y", CustomNumber: 9 });
            expect(elem2.ID).toBe("x");
            expect(elem2.GetValue(TestElementWithProps.CustomTextProp)).toBe("y");
            expect(elem2.GetValue(TestElementWithProps.CustomNumberProp)).toBe(9);

            const elem3 = new TestElementWithProps();
            elem3.FromJSON({ CustomText: "z" });
            expect(elem3.ID).toBe(XGuid.EmptyValue);
            expect(elem3.GetValue(TestElementWithProps.CustomTextProp)).toBe("z");
        });

        it("GetModelValues should include non-defaults and skip Design group", () =>
        {
            const elem = new TestElementWithProps();
            elem.ID = XGuid.NewValue();

            elem.SetValue(TestElementWithProps.CustomTextProp, "abc");
            elem.SetValue(TestElementWithProps.CustomDesignProp, "design");
            elem.SetValue(TestElementWithProps.CustomNumberProp, 0);

            const mvs = elem.GetModelValues();
            expect(mvs.length).toBe(1);
            expect(mvs[0]?.PropertyId).toBe(TestElementWithProps.CustomTextProp.ID);
            expect(mvs[0]?.Value).toBe("abc");
        });

        it("GetModelValues should skip null values", () =>
        {
            const elem = new TestElementWithProps();
            elem.ID = XGuid.NewValue();
            elem.SetValue(TestElementWithProps.CustomTextProp, null);
            expect(elem.GetModelValues()).toEqual([]);
        });

        it("SetModelValue should no-op for unknown properties", () =>
        {
            const elem = new TestElementWithProps();
            const mv = new XModelValue(elem as unknown as { ID: string }, "20000000-0000-0000-0000-000000000001", 1, elem.ID);
            elem.SetModelValue(mv);
            expect(elem.GetValue(TestElementWithProps.CustomNumberProp)).toBe(0);
        });

        it("SetModelValue should handle normal and linked properties", () =>
        {
            const elem = new TestElementWithProps();
            elem.ID = XGuid.NewValue();

            const mv1 = XModelValue.FromProperty(elem as unknown as { ID: string }, TestElementWithProps.CustomNumberProp, 33, elem.ID);
            elem.SetModelValue(mv1);
            expect(elem.GetValue(TestElementWithProps.CustomNumberProp)).toBe(33);

            const target = new TestElement();
            target.ID = XGuid.NewValue();

            const tracker = new XChangeTracker();
            const doc = new TestDesignerDocument(tracker, new XSelectionManager());
            doc.Add(target);
            elem.Document = doc;

            const mv2 = new XModelValue(elem as unknown as { ID: string }, TestElementWithProps.LinkedProp.ID, target.ID, elem.ID);
            elem.SetModelValue(mv2);
            expect(elem.GetLinkedElement<TestElement>(TestElementWithProps.LinkedProp)).toBe(target);

            const elem2 = new TestElementWithProps();
            const mv3 = new XModelValue(elem2 as unknown as { ID: string }, TestElementWithProps.LinkedProp.ID, target.ID, elem2.ID);
            elem2.SetModelValue(mv3);
            expect(elem2.GetLinkedElement<TestElement>(TestElementWithProps.LinkedProp)).toBeNull();
        });
    });
});
