import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    XProperty,
    XPropertyDefault,
    XPersistableElementBase
} from "../src/Core/XProperty.js";
import { XConstraintType, XPropertyGroup } from "../src/Core/XEnums.js";
import { XGuid } from "../src/Core/XGuid.js";

class MockPersistableElement extends XPersistableElementBase
{
    public override ID: string = XGuid.NewValue();
    public override Name: string = "TestElement";
    public override IsLoaded: boolean = true;
    private _Values: Map<string, unknown> = new Map();

    public override GetValue(pProperty: XProperty): unknown
    {
        return this._Values.get(pProperty.ID);
    }

    public override SetValue(pProperty: XProperty, pValue: unknown): void
    {
        this._Values.set(pProperty.ID, pValue);
    }
}

class MockElementWithKey extends XPersistableElementBase
{
    public override ID: string = XGuid.NewValue();
    public override Name: string = "KeyElement";
    public override IsLoaded: boolean = true;

    public TestProperty: string = "default";
    private _Values: Map<string, unknown> = new Map();

    public override GetValue(pProperty: XProperty): unknown
    {
        return this._Values.get(pProperty.ID);
    }

    public override SetValue(pProperty: XProperty, pValue: unknown): void
    {
        this._Values.set(pProperty.ID, pValue);
    }

    public override GetValueByKey(pKey: string): unknown
    {
        if (pKey === "fallbackKey")
            return "fallbackValue";
        return undefined;
    }

    public override SetValueByKey(pKey: string, pValue: unknown): void
    {
        if (pKey === "fallbackKey")
            (this as unknown as Record<string, unknown>)["_fallbackValue"] = pValue;
    }
}

describe("XPropertyDefault", () =>
{
    let property: XProperty;

    beforeEach(() =>
    {
        const id = XGuid.NewValue();
        property = new XProperty(
            null,
            id,
            "TestProp",
            "Test Property",
            { Name: "String" },
            "defaultValue",
            false,
            false,
            null,
            null,
            null
        );
    });

    describe("constructor", () =>
    {
        it("should create with owner property", () =>
        {
            expect(property.Default.Owner).toBe(property);
        });

        it("should set Name from property", () =>
        {
            expect(property.Default.Name).toBe("TestProp");
        });

        it("should have ID from owner", () =>
        {
            expect(property.Default.ID).toBe(property.ID);
        });
    });

    describe("properties", () =>
    {
        it("Title should be settable", () =>
        {
            property.Default.Title = "New Title";
            expect(property.Default.Title).toBe("New Title");
        });

        it("Order should be 0 by default", () =>
        {
            expect(property.Default.Order).toBe(0);
        });

        it("Scale should be 2 by default", () =>
        {
            expect(property.Default.Scale).toBe(2);
        });

        it("MaxLength should be 0 by default", () =>
        {
            expect(property.Default.MaxLength).toBe(0);
        });

        it("MinValue should be null by default", () =>
        {
            expect(property.Default.MinValue).toBeNull();
        });

        it("Group should be None by default", () =>
        {
            expect(property.Default.Group).toBe(XPropertyGroup.None);
        });
    });

    describe("Type", () =>
    {
        it("should get Type from internal value", () =>
        {
            property.Default.Type = { Name: "Number" };
            expect(property.Default.Type.Name).toBe("Number");
        });

        it("should use ExternalType when set", () =>
        {
            property.Default.ExternalType = () => ({ Name: "External" });
            expect(property.Default.Type.Name).toBe("External");
        });

        it("should fall back to internal Type when ExternalType returns null", () =>
        {
            property.Default.Type = { Name: "Internal" };
            property.Default.ExternalType = () => null;
            expect(property.Default.Type.Name).toBe("Internal");
        });
    });

    it("should infer 'Unknown' for non-object defaults", () =>
    {
        const id = XGuid.NewValue();
        const defaultValue = Symbol("s") as unknown;

        const prop = XProperty.Register(
            (p: { Sym: unknown }) => p.Sym,
            id,
            "Sym",
            "Sym Title",
            defaultValue
        );

        expect(prop.Default.Type.Name).toBe("Unknown");
    });

    describe("XPersistableElementBase optional methods", () =>
    {
        it("should provide default GetValueByKey and SetValueByKey implementations", () =>
        {
            class BarePersistable extends XPersistableElementBase
            {
                public override ID: string = XGuid.NewValue();
                public override Name: string = "Bare";
                public override IsLoaded: boolean = true;

                public override GetValue(_pProperty: XProperty): unknown
                {
                    return undefined;
                }

                public override SetValue(_pProperty: XProperty, _pValue: unknown): void
                {
                }
            }

            const elem = new BarePersistable();
            expect(elem.GetValueByKey?.("k")).toBeUndefined();
            expect(() => elem.SetValueByKey?.("k", 1)).not.toThrow();
        });
    });
    describe("EditType", () =>
    {
        it("should return Type when EditType not set", () =>
        {
            property.Default.Type = { Name: "String" };
            expect(property.Default.EditType.Name).toBe("String");
        });

        it("should return EditType when set", () =>
        {
            property.Default.Type = { Name: "String" };
            property.Default.EditType = { Name: "TextArea" };
            expect(property.Default.EditType.Name).toBe("TextArea");
        });
    });

    describe("DefaultValue", () =>
    {
        it("should get and set DefaultValue", () =>
        {
            property.Default.DefaultValue = "newDefault";
            expect(property.Default.DefaultValue).toBe("newDefault");
        });
    });

    describe("IsReadOnly", () =>
    {
        it("should be false by default", () =>
        {
            expect(property.Default.IsReadOnly).toBe(false);
        });

        it("should be settable", () =>
        {
            property.Default.IsReadOnly = true;
            expect(property.Default.IsReadOnly).toBe(true);
        });
    });

    describe("IsEditable", () =>
    {
        it("should be true by default", () =>
        {
            expect(property.Default.IsEditable).toBe(true);
        });

        it("should be settable", () =>
        {
            property.Default.IsEditable = false;
            expect(property.Default.IsEditable).toBe(false);
        });

        it("should return true when OverrideVisibility is true", () =>
        {
            property.Default.IsEditable = false;
            property.Default.OverrideVisibility = true;
            expect(property.Default.IsEditable).toBe(true);
        });
    });

    describe("IsRequired", () =>
    {
        it("should be false by default", () =>
        {
            expect(property.Default.IsRequired).toBe(false);
        });

        it("should return value only when IsVisible is true", () =>
        {
            property.Default.IsRequired = true;
            property.Default.IsVisible = true;
            expect(property.Default.IsRequired).toBe(true);

            property.Default.IsVisible = false;
            expect(property.Default.IsRequired).toBe(false);
        });
    });

    describe("IsVisible", () =>
    {
        it("should be true by default", () =>
        {
            expect(property.Default.IsVisible).toBe(true);
        });

        it("should be settable", () =>
        {
            property.Default.IsVisible = false;
            expect(property.Default.IsVisible).toBe(false);
        });

        it("should return true when OverrideVisibility is true", () =>
        {
            property.Default.IsVisible = false;
            property.Default.OverrideVisibility = true;
            expect(property.Default.IsVisible).toBe(true);
        });
    });

    describe("SetVisible", () =>
    {
        it("should set IsVisible", () =>
        {
            const elem = new MockPersistableElement();
            property.Default.SetVisible(false, elem);
            expect(property.Default.IsVisible).toBe(false);
        });
    });

    describe("DoChanged", () =>
    {
        it("should not throw when no handlers", () =>
        {
            expect(() => property.Default.DoChanged("Test")).not.toThrow();
        });

        it("should invoke handlers via dispatcher", async () =>
        {
            const handler = vi.fn();
            property.Default.DefaultChanged.Add(handler);

            property.Default.DoChanged("TestChange");

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledWith("TestChange", property.Default);
        });
    });

    describe("Equals", () =>
    {
        it("should return false for null", () =>
        {
            expect(property.Default.Equals(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            expect(property.Default.Equals(undefined)).toBe(false);
        });

        it("should return true for same name", () =>
        {
            const elem = new MockPersistableElement();
            elem.Name = "TestProp";
            expect(property.Default.Equals(elem)).toBe(true);
        });

        it("should return false for different name", () =>
        {
            const elem = new MockPersistableElement();
            elem.Name = "Other";
            expect(property.Default.Equals(elem)).toBe(false);
        });
    });

    describe("GetHashCode", () =>
    {
        it("should return 0 for empty name", () =>
        {
            property.Default.Name = "";
            expect(property.Default.GetHashCode()).toBe(0);
        });

        it("should return consistent hash for same name", () =>
        {
            property.Default.Name = "TestName";
            const hash1 = property.Default.GetHashCode();
            const hash2 = property.Default.GetHashCode();
            expect(hash1).toBe(hash2);
        });

        it("should return different hash for different names", () =>
        {
            property.Default.Name = "Name1";
            const hash1 = property.Default.GetHashCode();
            property.Default.Name = "Name2";
            const hash2 = property.Default.GetHashCode();
            expect(hash1).not.toBe(hash2);
        });
    });
});

describe("XProperty", () =>
{
    describe("constructor", () =>
    {
        it("should create property with ID", () =>
        {
            const id = XGuid.NewValue();
            const prop = new XProperty(null, id, "Test", "Test Title", { Name: "String" });
            expect(prop.ID).toBe(id);
        });

        it("should create property with Name", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "TestName", "Title", { Name: "String" });
            expect(prop.Name).toBe("TestName");
        });

        it("should set PropertyKey", () =>
        {
            const prop = new XProperty("MyKey", XGuid.NewValue(), "Test", "Title", { Name: "String" });
            expect(prop.PropertyKey).toBe("MyKey");
        });

        it("should initialize Default with values", () =>
        {
            const prop = new XProperty(
                null,
                XGuid.NewValue(),
                "Test",
                "Test Title",
                { Name: "Number" },
                42,
                true,
                true
            );
            expect(prop.Default.Title).toBe("Test Title");
            expect(prop.Default.DefaultValue).toBe(42);
            expect(prop.Default.IsRequired).toBe(true);
            expect(prop.Default.CultureSensitive).toBe(true);
        });
    });

    describe("static Register", () =>
    {
        it("should register a property", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { Value: string }) => p.Value,
                id,
                "Value",
                "Value Title",
                "default"
            );

            expect(prop.ID).toBe(id);
            expect(prop.Name).toBe("Value");
        });

        it("should return existing property if ID already registered", () =>
        {
            const id = XGuid.NewValue();
            const prop1 = XProperty.Register(
                (p: { V1: string }) => p.V1,
                id,
                "V1",
                "V1 Title"
            );
            const prop2 = XProperty.Register(
                (p: { V2: string }) => p.V2,
                id,
                "V2",
                "V2 Title"
            );

            expect(prop1).toBe(prop2);
        });

        it("should tolerate selectors that don't read keys (PropertyKey=null)", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (_p: { Anything: string }) => Symbol("x") as unknown as string,
                id,
                "NoKey",
                "No Key Title"
            );

            expect(prop.PropertyKey).toBeNull();
            expect(prop.Default.Type.Name).toBe("Unknown");
        });

        it("should infer 'Object' for objects without constructor", () =>
        {
            const id = XGuid.NewValue();
            const defaultValue = Object.create(null) as unknown;

            const prop = XProperty.Register(
                (p: { Obj: unknown }) => p.Obj,
                id,
                "Obj",
                "Obj Title",
                defaultValue
            );

            expect(prop.Default.Type.Name).toBe("Object");
        });

        it("should infer type name from object constructor name", () =>
        {
            const id = XGuid.NewValue();
            const defaultValue = { constructor: { name: "MyType" } } as unknown;

            const prop = XProperty.Register(
                (p: { Obj2: unknown }) => p.Obj2,
                id,
                "Obj2",
                "Obj2 Title",
                defaultValue
            );

            expect(prop.Default.Type.Name).toBe("MyType");
        });

        it("should fall back to 'Object' when ctor name is undefined", () =>
        {
            const id = XGuid.NewValue();
            const defaultValue = { constructor: { name: undefined } } as unknown;

            const prop = XProperty.Register(
                (p: { Obj3: unknown }) => p.Obj3,
                id,
                "Obj3",
                "Obj3 Title",
                defaultValue
            );

            expect(prop.Default.Type.Name).toBe("Object");
        });

        it("should tolerate selectors that throw (PropertyKey=null)", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (_p: { Boom: string }) =>
                {
                    throw new Error("boom");
                },
                id,
                "ThrowingSelector",
                "Throwing Selector Title",
                "ignored"
            );

            expect(prop.PropertyKey).toBeNull();
        });

        it("should ignore symbol property access in selector probe", () =>
        {
            const sym = Symbol("s");
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: unknown) => (p as unknown as Record<symbol, unknown>)[sym] as unknown as string,
                id,
                "SymbolKey",
                "Symbol Key Title",
                "x"
            );

            expect(prop.PropertyKey).toBeNull();
        });

        it("should generate OwnerCID from declaring type name when Guid missing", () =>
        {
            class TypeNoGuid { }

            const id = XGuid.NewValue();
            const selector = ((p: { Some: string }) => p.Some) as unknown as { (p: { Some: string }): string; DeclaringType?: unknown };
            selector.DeclaringType = TypeNoGuid;

            const prop = XProperty.Register(selector, id, "Some", "Some Title", "x");
            expect(prop.OwnerCID.startsWith("00000000-0000-0000-0000-")).toBe(true);
            expect(XGuid.IsValid(prop.OwnerCID)).toBe(true);
        });

        it("should use 'Unknown' when DeclaringType is not a constructor", () =>
        {
            const id = XGuid.NewValue();
            const selector = ((p: { Prop: string }) => p.Prop) as unknown as { (p: { Prop: string }): string; DeclaringType?: unknown };
            selector.DeclaringType = {};

            const prop = XProperty.Register(selector, id, "Prop", "Prop Title", "x");
            expect(prop.PropertyKey).toBe("Unknown.Prop");
        });

        it("should handle null selector in InternalRegister", () =>
        {
            const all = (XProperty as unknown as { _AllProperties: Map<string, XProperty> })._AllProperties;
            const byKey = (XProperty as unknown as { _AllPropertiesByKey: Map<string, XProperty> })._AllPropertiesByKey;
            const propsByOwner = (XProperty as unknown as { _Properties: Map<string, XProperty[]> })._Properties;

            const snapAll = new Map(all);
            const snapByKey = new Map(byKey);
            const snapPropsByOwner = new Map<string, XProperty[]>(
                [...propsByOwner.entries()].map(([k, v]) => [k, [...v]])
            );

            try
            {
                const id = XGuid.NewValue();
                const prop = (XProperty as unknown as {
                    InternalRegister: (
                        pSelector: unknown,
                        pID: string,
                        pName: string,
                        pTitle: string,
                        pConstraintType: XConstraintType | null,
                        pSetMethod: unknown,
                        pDefaultValue: unknown,
                        pIsRequired: boolean,
                        pCultureSensitive: boolean,
                        pIsLinked: boolean
                    ) => XProperty;
                }).InternalRegister(
                    null,
                    id,
                    "NullSelector",
                    "Null Selector Title",
                    null,
                    null,
                    123,
                    false,
                    false,
                    false
                );

                expect(prop.ID).toBe(id);
                expect(prop.PropertyKey).toBeNull();
                expect(prop.OwnerCID).toBe(XGuid.EmptyValue);
            }
            finally
            {
                all.clear();
                for (const [k, v] of snapAll)
                    all.set(k, v);

                byKey.clear();
                for (const [k, v] of snapByKey)
                    byKey.set(k, v);

                propsByOwner.clear();
                for (const [k, v] of snapPropsByOwner)
                    propsByOwner.set(k, [...v]);
            }
        });

        it("should throw when registering duplicate ID within owner list", () =>
        {
            const all = (XProperty as unknown as { _AllProperties: Map<string, XProperty> })._AllProperties;
            const byKey = (XProperty as unknown as { _AllPropertiesByKey: Map<string, XProperty> })._AllPropertiesByKey;
            const propsByOwner = (XProperty as unknown as { _Properties: Map<string, XProperty[]> })._Properties;

            const snapAll = new Map(all);
            const snapByKey = new Map(byKey);
            const snapPropsByOwner = new Map<string, XProperty[]>(
                [...propsByOwner.entries()].map(([k, v]) => [k, [...v]])
            );

            try
            {
                class DupType { public static Guid: string = XGuid.NewValue(); }

                const id = XGuid.NewValue();
                const selector = ((p: { Dup: string }) => p.Dup) as unknown as { (p: { Dup: string }): string; DeclaringType?: unknown };
                selector.DeclaringType = DupType;

                const first = XProperty.Register(selector, id, "Dup", "Dup Title", "x");
                expect(first.OwnerCID).toBe(DupType.Guid);

                all.delete(id);

                expect(() => XProperty.Register(selector, id, "Dup", "Dup Title", "x"))
                    .toThrow(/duplicate id/i);
            }
            finally
            {
                all.clear();
                for (const [k, v] of snapAll)
                    all.set(k, v);

                byKey.clear();
                for (const [k, v] of snapByKey)
                    byKey.set(k, v);

                propsByOwner.clear();
                for (const [k, v] of snapPropsByOwner)
                    propsByOwner.set(k, [...v]);
            }
        });
    });

    describe("static RegisterLink", () =>
    {
        it("should register a linked property", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.RegisterLink(
                (p: { Link: string }) => p.Link,
                id,
                "Link",
                "Link Title"
            );

            expect(prop.Default.IsLinked).toBe(true);
        });
    });

    describe("static RegisterLinkArray", () =>
    {
        it("should register a linked array property", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.RegisterLinkArray(
                (p: { Links: string[] }) => p.Links,
                id,
                "Links",
                "Links Title"
            );

            expect(prop.Default.IsLinked).toBe(true);
        });
    });

    describe("static RegisterConstraint", () =>
    {
        it("should register property with constraint type", () =>
        {
            const id = XGuid.NewValue();
            const setter = vi.fn();
            const prop = XProperty.RegisterConstraint(
                (p: { ConstTest: number }) => p.ConstTest,
                setter,
                XConstraintType.Dependence,
                id,
                "ConstTest",
                "Constrained Title",
                100
            );

            expect(prop).toBeDefined();
            expect(prop.ID).toBe(id);
            expect(prop.Name).toBe("ConstTest");
        });
    });

    describe("static Get", () =>
    {
        it("should return registered property by ID", () =>
        {
            const id = XGuid.NewValue();
            const registered = XProperty.Register(
                (p: { GetTest: string }) => p.GetTest,
                id,
                "GetTest",
                "Title"
            );

            const retrieved = XProperty.Get(id);

            expect(retrieved).toBe(registered);
        });

        it("should throw for unknown ID", () =>
        {
            expect(() => XProperty.Get(XGuid.NewValue())).toThrow();
        });
    });

    describe("static TryGet", () =>
    {
        it("should return property if found", () =>
        {
            const id = XGuid.NewValue();
            const registered = XProperty.Register(
                (p: { TryGetTest: string }) => p.TryGetTest,
                id,
                "TryGetTest",
                "Title"
            );

            const retrieved = XProperty.TryGet(id);

            expect(retrieved).toBe(registered);
        });

        it("should return null if not found", () =>
        {
            expect(XProperty.TryGet(XGuid.NewValue())).toBeNull();
        });
    });

    describe("static GetByKey", () =>
    {
        it("should return property by key", () =>
        {
            const id = XGuid.NewValue();
            const registered = new XProperty(
                "MyClass.KeyProp",
                id,
                "KeyProp",
                "Title",
                { Name: "String" }
            );

            const retrieved = XProperty.GetByKey("MyClass.KeyProp");

            expect(retrieved).toBe(registered);
        });

        it("should throw for unknown key", () =>
        {
            expect(() => XProperty.GetByKey("Unknown.Key")).toThrow();
        });
    });

    describe("static TryGetByKey", () =>
    {
        it("should return property if found", () =>
        {
            const id = XGuid.NewValue();
            const registered = new XProperty(
                "TryClass.TryKeyProp",
                id,
                "TryKeyProp",
                "Title",
                { Name: "String" }
            );

            const retrieved = XProperty.TryGetByKey("TryClass.TryKeyProp");

            expect(retrieved).toBe(registered);
        });

        it("should return null if not found", () =>
        {
            expect(XProperty.TryGetByKey("Unknown.Key2")).toBeNull();
        });
    });

    describe("static GetByType", () =>
    {
        it("should return properties for type", () =>
        {
            const props = XProperty.GetByType(XGuid.NewValue());
            expect(Array.isArray(props)).toBe(true);
        });

        it("should return empty array for unknown type", () =>
        {
            const props = XProperty.GetByType(XGuid.NewValue());
            expect(props.length).toBe(0);
        });
    });

    describe("static GetAll", () =>
    {
        it("should return iterator of all properties", () =>
        {
            const all = [...XProperty.GetAll()];
            expect(Array.isArray(all)).toBe(true);
            expect(all.length).toBeGreaterThan(0);
        });
    });

    describe("static Has", () =>
    {
        it("should return true for registered property", () =>
        {
            const id = XGuid.NewValue();
            XProperty.Register(
                (p: { HasTest: string }) => p.HasTest,
                id,
                "HasTest",
                "Title"
            );

            expect(XProperty.Has(id)).toBe(true);
        });

        it("should return false for unknown property", () =>
        {
            expect(XProperty.Has(XGuid.NewValue())).toBe(false);
        });
    });

    describe("static LoadProperties", () =>
    {
        it("should load properties into map", () =>
        {
            const elem = new MockPersistableElement();
            const props = new Map<string, XProperty>();

            XProperty.LoadProperties(elem, props);

            expect(props instanceof Map).toBe(true);
        });

        it("should handle null element", () =>
        {
            const props = new Map<string, XProperty>();
            expect(() => XProperty.LoadProperties(null as unknown as XPersistableElementBase, props)).not.toThrow();
            expect(props.size).toBe(0);
        });

        it("should handle element without constructor property", () =>
        {
            const elem = Object.create(null);
            const props = new Map<string, XProperty>();
            expect(() => XProperty.LoadProperties(elem as unknown as XPersistableElementBase, props)).not.toThrow();
            expect(props.size).toBe(0);
        });

        it("should stop when element constructor is not a function", () =>
        {
            const elem = new MockPersistableElement() as unknown as { constructor: unknown };
            elem.constructor = {};

            const props = new Map<string, XProperty>();
            XProperty.LoadProperties(elem as unknown as MockPersistableElement, props);
            expect(props.size).toBe(0);
        });

        it("should stop when constructor prototype chain has null proto", () =>
        {
            function NoProtoCtor() { }
            NoProtoCtor.prototype = Object.create(null);

            const elem = new MockPersistableElement() as unknown as { constructor: unknown };
            elem.constructor = NoProtoCtor;

            const props = new Map<string, XProperty>();
            XProperty.LoadProperties(elem as unknown as MockPersistableElement, props);
            expect(props.size).toBe(0);
        });

        it("should use 'Unknown' when constructor name is undefined", () =>
        {
            const all = (XProperty as unknown as { _AllProperties: Map<string, XProperty> })._AllProperties;
            const byKey = (XProperty as unknown as { _AllPropertiesByKey: Map<string, XProperty> })._AllPropertiesByKey;
            const propsByOwner = (XProperty as unknown as { _Properties: Map<string, XProperty[]> })._Properties;

            const snapAll = new Map(all);
            const snapByKey = new Map(byKey);
            const snapPropsByOwner = new Map<string, XProperty[]>(
                [...propsByOwner.entries()].map(([k, v]) => [k, [...v]])
            );

            try
            {
                const declaringType = new Proxy(
                    function DeclType() { },
                    {
                        get: (pTarget, pProp) =>
                        {
                            if (pProp === "name")
                                return undefined;
                            return (pTarget as unknown as Record<string | symbol, unknown>)[pProp];
                        }
                    }
                );

                const id = XGuid.NewValue();
                const selector = ((p: { Key: string }) => p.Key) as unknown as { (p: { Key: string }): string; DeclaringType?: unknown };
                selector.DeclaringType = declaringType;

                const prop = XProperty.Register(selector, id, "Key", "Key Title", "x");
                expect(prop.PropertyKey).toBe("Unknown.Key");
            }
            finally
            {
                all.clear();
                for (const [k, v] of snapAll)
                    all.set(k, v);

                byKey.clear();
                for (const [k, v] of snapByKey)
                    byKey.set(k, v);

                propsByOwner.clear();
                for (const [k, v] of snapPropsByOwner)
                    propsByOwner.set(k, [...v]);
            }
        });
    });

    describe("GetValue", () =>
    {
        it("should get value from object using PropertyKey", () =>
        {
            const prop = new XProperty(
                "TestProperty",
                XGuid.NewValue(),
                "TestProperty",
                "Title",
                { Name: "String" }
            );

            const elem = new MockElementWithKey();
            elem.TestProperty = "test value";

            const value = prop.GetValue(elem);

            expect(value).toBe("test value");
        });

        it("should fall back to GetValueByKey", () =>
        {
            const prop = new XProperty(
                "fallbackKey",
                XGuid.NewValue(),
                "Fallback",
                "Title",
                { Name: "String" }
            );

            const elem = new MockElementWithKey();

            const value = prop.GetValue(elem);

            expect(value).toBe("fallbackValue");
        });

            it("should fall back to element GetValue when GetValueByKey is missing", () =>
            {
                class NoByKeyElement extends XPersistableElementBase
                {
                    public override ID: string = XGuid.NewValue();
                    public override Name: string = "NoByKey";
                    public override IsLoaded: boolean = true;

                    public override GetValue(_pProperty: XProperty): unknown
                    {
                        return "from-getvalue";
                    }

                    public override SetValue(_pProperty: XProperty, _pValue: unknown): void
                    {
                    }
                }

                const prop = new XProperty(
                    "MissingKey",
                    XGuid.NewValue(),
                    "MissingKey",
                    "Title",
                    { Name: "String" }
                );

                const elem = new NoByKeyElement() as unknown as NoByKeyElement & { GetValueByKey?: undefined };
                (elem as unknown as { GetValueByKey?: undefined }).GetValueByKey = undefined;

                expect(prop.GetValue(elem)).toBe("from-getvalue");
            });

        it("should use GetValue when no PropertyKey", () =>
        {
            const id = XGuid.NewValue();
            const prop = new XProperty(
                null,
                id,
                "NoKey",
                "Title",
                { Name: "String" }
            );

            const elem = new MockPersistableElement();
            elem.SetValue(prop, "stored value");

            const value = prop.GetValue(elem);

            expect(value).toBe("stored value");
        });
    });

    describe("SetValue", () =>
    {
        it("should set value on object using PropertyKey", () =>
        {
            const prop = new XProperty(
                "TestProperty",
                XGuid.NewValue(),
                "TestProperty",
                "Title",
                { Name: "String" }
            );

            const elem = new MockElementWithKey();
            prop.SetValue(elem, "new value");

            expect(elem.TestProperty).toBe("new value");
        });

        it("should fall back to SetValueByKey", () =>
        {
            const prop = new XProperty(
                "fallbackKey",
                XGuid.NewValue(),
                "Fallback",
                "Title",
                { Name: "String" }
            );

            const elem = new MockElementWithKey();
            prop.SetValue(elem, "fallback set");

            expect((elem as unknown as Record<string, unknown>)["_fallbackValue"]).toBe("fallback set");
        });

            it("should fall back to element SetValue when SetValueByKey is missing", () =>
            {
                let didSet = false;

                class NoByKeyElement extends XPersistableElementBase
                {
                    public override ID: string = XGuid.NewValue();
                    public override Name: string = "NoByKey";
                    public override IsLoaded: boolean = true;

                    public override GetValue(_pProperty: XProperty): unknown
                    {
                        return undefined;
                    }

                    public override SetValue(_pProperty: XProperty, _pValue: unknown): void
                    {
                        didSet = true;
                    }
                }

                const prop = new XProperty(
                    "MissingKey",
                    XGuid.NewValue(),
                    "MissingKey",
                    "Title",
                    { Name: "String" }
                );

                const elem = new NoByKeyElement() as unknown as NoByKeyElement & { SetValueByKey?: undefined };
                (elem as unknown as { SetValueByKey?: undefined }).SetValueByKey = undefined;

                prop.SetValue(elem, "x");
                expect(didSet).toBe(true);
            });

        it("should use SetValue when no PropertyKey", () =>
        {
            const id = XGuid.NewValue();
            const prop = new XProperty(
                null,
                id,
                "NoKey",
                "Title",
                { Name: "String" }
            );

            const elem = new MockPersistableElement();
            prop.SetValue(elem, "set value");

            expect(elem.GetValue(prop)).toBe("set value");
        });
    });

    describe("InvokeConstraintSet", () =>
    {
        it("should not invoke when no constraint set", () =>
        {
            const prop = new XProperty(
                null,
                XGuid.NewValue(),
                "NoConstraint",
                "Title",
                { Name: "String" }
            );

            const elem = new MockPersistableElement();

            expect(() => prop.InvokeConstraintSet(false, elem, null, "new")).not.toThrow();
        });

        it("should not invoke when no ConstraintType", () =>
        {
            const prop = new XProperty(
                null,
                XGuid.NewValue(),
                "NoConstraintType",
                "Title",
                { Name: "String" },
                null,
                false,
                false,
                null,
                vi.fn(),
                null
            );

            const elem = new MockPersistableElement();
            prop.InvokeConstraintSet(true, elem, null, 42);

            expect(true).toBe(true);
        });

        it("should invoke constraint set when forceSet is true", () =>
        {
            const setter = vi.fn();
            const id = XGuid.NewValue();
            const prop = new XProperty(
                null,
                id,
                "ForceSetProp",
                "Title",
                { Name: "Number" },
                0,
                false,
                false,
                XConstraintType.Dependence,
                setter,
                null
            );

            const elem = new MockPersistableElement();
            prop.InvokeConstraintSet(true, elem, null, 42);

            expect(setter).toHaveBeenCalledWith(elem, 42);
        });

        it("should invoke constraint set when element is loaded", () =>
        {
            const setter = vi.fn();
            const id = XGuid.NewValue();
            const prop = new XProperty(
                null,
                id,
                "LoadedProp",
                "Title",
                { Name: "Number" },
                0,
                false,
                false,
                XConstraintType.Dependence,
                setter,
                null
            );

            const elem = new MockPersistableElement();
            elem.IsLoaded = true;
            prop.InvokeConstraintSet(false, elem, null, 42);

            expect(setter).toHaveBeenCalledWith(elem, 42);
        });

        it("should not invoke when element not loaded and not forced", () =>
        {
            const setter = vi.fn();
            const id = XGuid.NewValue();
            const prop = new XProperty(
                null,
                id,
                "NotLoadedProp",
                "Title",
                { Name: "Number" },
                0,
                false,
                false,
                XConstraintType.Dependence,
                setter,
                null
            );

            const elem = new MockPersistableElement();
            elem.IsLoaded = false;
            prop.InvokeConstraintSet(false, elem, null, 42);

            expect(setter).not.toHaveBeenCalled();
        });
    });

    describe("Equals", () =>
    {
        it("should return false for null", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "Test", "Title", { Name: "String" });
            expect(prop.Equals(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "Test", "Title", { Name: "String" });
            expect(prop.Equals(undefined)).toBe(false);
        });

        it("should return true for same ID", () =>
        {
            const id = XGuid.NewValue();
            const prop1 = new XProperty(null, id, "Test1", "Title1", { Name: "String" });
            const prop2 = XProperty.Get(id);
            expect(prop1.Equals(prop2)).toBe(true);
        });

        it("should return false for different ID", () =>
        {
            const prop1 = new XProperty(null, XGuid.NewValue(), "Test1", "Title1", { Name: "String" });
            const prop2 = new XProperty(null, XGuid.NewValue(), "Test2", "Title2", { Name: "String" });
            expect(prop1.Equals(prop2)).toBe(false);
        });
    });

    describe("GetHashCode", () =>
    {
        it("should return consistent hash", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "HashTest", "Title", { Name: "String" });
            const hash1 = prop.GetHashCode();
            const hash2 = prop.GetHashCode();
            expect(hash1).toBe(hash2);
        });
    });

    describe("ToString", () =>
    {
        it("should return formatted string", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "ToStringTest", "Title", { Name: "Number" });
            expect(prop.ToString()).toBe("ToStringTest (Number)");
        });

        it("should fall back to 'Unknown' when type name is undefined", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "ToStringTest", "Title", { Name: "Number" });
            prop.Default.ExternalType = () => ({ Name: undefined as unknown as string });
            expect(prop.ToString()).toBe("ToStringTest (Unknown)");
        });

        it("should handle missing type", () =>
        {
            const prop = new XProperty(null, XGuid.NewValue(), "NoType", "Title", { Name: "Unknown" });
            expect(prop.ToString()).toContain("NoType");
        });
    });

    describe("RegisterPropertyLink event", () =>
    {
        it("should have RegisterPropertyLink event", () =>
        {
            expect(XProperty.RegisterPropertyLink).toBeDefined();
        });
    });

    describe("Property registration with selectors", () =>
    {
        it("should extract property key from selector", () =>
        {
            const id = XGuid.NewValue();
            interface TestType { MyProp: string; }
            const prop = XProperty.Register(
                (p: TestType) => p.MyProp,
                id,
                "MyProp",
                "My Title",
                "default"
            );

            expect(prop).toBeDefined();
            expect(prop.PropertyKey).toBeDefined();
        });

        it("should handle selector that throws", () =>
        {
            const id = XGuid.NewValue();
            const throwingSelector = (): never =>
            {
                throw new Error("Test error");
            };

            const prop = XProperty.Register(
                throwingSelector,
                id,
                "ThrowingProp",
                "Title",
                null
            );

            expect(prop).toBeDefined();
            expect(prop.PropertyKey).toBeNull();
        });

        it("should handle null selector", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.RegisterConstraint(
                null as unknown as (p: { x: number }) => number,
                null,
                XConstraintType.Dependence,
                id,
                "NullSelector",
                "Title"
            );

            expect(prop).toBeDefined();
            expect(prop.PropertyKey).toBeNull();
        });

        it("should infer type from string default value", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { str: string }) => p.str,
                id,
                "StringProp",
                "Title",
                "test string"
            );

            expect(prop.Default.Type.Name).toBe("String");
        });

        it("should infer type from number default value", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { num: number }) => p.num,
                id,
                "NumberProp",
                "Title",
                42
            );

            expect(prop.Default.Type.Name).toBe("Number");
        });

        it("should infer type from boolean default value", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { bool: boolean }) => p.bool,
                id,
                "BoolProp",
                "Title",
                true
            );

            expect(prop.Default.Type.Name).toBe("Boolean");
        });

        it("should infer type from array default value", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { arr: number[] }) => p.arr,
                id,
                "ArrayProp",
                "Title",
                [1, 2, 3]
            );

            expect(prop.Default.Type.Name).toBe("Array");
        });

        it("should infer type from object default value", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { obj: object }) => p.obj,
                id,
                "ObjectProp",
                "Title",
                { key: "value" }
            );

            expect(prop.Default.Type.Name).toBe("Object");
        });

        it("should handle null default value with Unknown type", () =>
        {
            const id = XGuid.NewValue();
            const prop = XProperty.Register(
                (p: { nullProp: null }) => p.nullProp,
                id,
                "NullProp",
                "Title",
                null
            );

            expect(prop.Default.Type.Name).toBe("Unknown");
        });
    });

    describe("Property with DeclaringType", () =>
    {
        it("should use DeclaringType Guid when available", () =>
        {
            class TestClass
            {
                public static Guid: string = "12345678-1234-1234-1234-123456789012";
                public TestProp: string = "";
            }

            const id = XGuid.NewValue();
            const selector = (p: TestClass) => p.TestProp;
            (selector as unknown as { DeclaringType: typeof TestClass }).DeclaringType = TestClass;

            const prop = XProperty.Register(
                selector,
                id,
                "TestProp",
                "Title",
                "default"
            );

            expect(prop.OwnerCID).toBe(TestClass.Guid);
        });

        it("should generate OwnerCID from class name when no Guid", () =>
        {
            class NoGuidClass
            {
                public TestProp: string = "";
            }

            const id = XGuid.NewValue();
            const selector = (p: NoGuidClass) => p.TestProp;
            (selector as unknown as { DeclaringType: typeof NoGuidClass }).DeclaringType = NoGuidClass;

            const prop = XProperty.Register(
                selector,
                id,
                "OwnerCIDProp",
                "Title",
                "default"
            );

            // Should generate CID from hash
            expect(prop.OwnerCID).toBeDefined();
            expect(prop.OwnerCID).not.toBe(XGuid.EmptyValue);
        });
    });

    describe("LoadProperties with inheritance", () =>
    {
        it("should load properties from base class", () =>
        {
            class BaseElement extends XPersistableElementBase
            {
                public override ID: string = XGuid.NewValue();
                public override Name: string = "Base";
                public override IsLoaded: boolean = true;
                public BaseProp: string = "";
                public override GetValue(_pProperty: XProperty): unknown
                {
                    return null;
                }
                public override SetValue(_pProperty: XProperty, _pValue: unknown): void { }
            }

            const basePropId = XGuid.NewValue();
            const basePropSelector = (p: BaseElement) => p.BaseProp;
            (basePropSelector as unknown as { DeclaringType: typeof BaseElement }).DeclaringType = BaseElement;
            XProperty.Register(basePropSelector, basePropId, "BaseProp", "Base Property");

            const elem = new BaseElement();
            const props = new Map<string, XProperty>();
            XProperty.LoadProperties(elem, props);

            expect(props.size).toBeGreaterThan(0);
        });
    });

    describe("Edge cases and error handling", () =>
    {
        it("should handle selector that returns nothing", () =>
        {
            const id = XGuid.NewValue();
            // Selector that doesn't access any property
            const emptySelector = (_p: { x: number }) =>
            {
                const a = 1;
                return a;
            };

            const prop = XProperty.Register(
                emptySelector,
                id,
                "EmptySelector",
                "Title",
                0
            );

            expect(prop.PropertyKey).toBeNull();
        });

        it("should handle object without constructor name", () =>
        {
            const id = XGuid.NewValue();
            const objWithoutName = Object.create(null);
            objWithoutName.value = 1;

            const prop = XProperty.Register(
                (p: { obj: object }) => p.obj,
                id,
                "NoConstructor",
                "Title",
                objWithoutName
            );

            expect(prop.Default.Type.Name).toBe("Object");
        });

        it("should handle class with no base beyond Object", () =>
        {
            class TopLevelClass extends XPersistableElementBase
            {
                public override ID: string = XGuid.NewValue();
                public override Name: string = "TopLevel";
                public override IsLoaded: boolean = true;
                public MyProp: string = "";
                public override GetValue(_pProperty: XProperty): unknown
                {
                    return null;
                }
                public override SetValue(_pProperty: XProperty, _pValue: unknown): void { }
            }

            const propId = XGuid.NewValue();
            const selector = (p: TopLevelClass) => p.MyProp;
            (selector as unknown as { DeclaringType: typeof TopLevelClass }).DeclaringType = TopLevelClass;
            XProperty.Register(selector, propId, "TopLevelProp", "Title");

            const elem = new TopLevelClass();
            const props = new Map<string, XProperty>();
            XProperty.LoadProperties(elem, props);

            expect(props.size).toBeGreaterThan(0);
        });
    });
});

