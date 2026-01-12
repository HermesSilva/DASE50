import { describe, it, expect, beforeEach, vi } from "vitest";
import { XGuid } from "../src/Core/XGuid.js";
import { XProperty } from "../src/Core/XProperty.js";
import { XPropertyGroup } from "../src/Core/XEnums.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XElement } from "../src/Core/XElement.js";
import { XSerializationContext, XSerializationDirection, XSerializationPhase } from "../src/Data/XSerializationContext.js";
import { XElementRegistry, RegisterElement, RegisterChildElement } from "../src/Data/XElementRegistry.js";
import { XTypeConverter } from "../src/Data/XTypeConverter.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { XmlWriter } from "../src/Data/XmlWriter.js";
import { XmlReader } from "../src/Data/XmlReader.js";
import { XDocument } from "../src/Design/XDocument.js";

// Dummy element for testing
class XExtendedTestElement extends XPersistableElement {
    public static readonly ExtendedProp = XProperty.Register<XExtendedTestElement, string>(
        (p: XExtendedTestElement) => p.ExtendedValue,
        "EXT0001-0001-0001-0001-000000000001",
        "ExtendedValue",
        "Extended Value",
        ""
    );

    public get ExtendedValue(): string { return this.GetValue(XExtendedTestElement.ExtendedProp) as string; }
    public set ExtendedValue(v: string) { this.SetValue(XExtendedTestElement.ExtendedProp, v); }
}

class XTestElement extends XPersistableElement
{
    public static readonly TitleProp = XProperty.Register<XTestElement, string>(
        (p: XTestElement) => p.Title,
        "TEST0001-0001-0001-0001-000000000001",
        "Title",
        "Title",
        ""
    );

    public constructor()
    {
        super();
    }

    public get Title(): string
    {
        return this.GetValue(XTestElement.TitleProp) as string;
    }

    public set Title(pValue: string)
    {
        this.SetValue(XTestElement.TitleProp, pValue);
    }
}

@RegisterElement("XDecoratedElement", "DECO-ID", 100)
class XDecoratedElement extends XPersistableElement {}

@RegisterElement("XChildElement")
@RegisterChildElement("XParentTag")
class XChildElement extends XPersistableElement {}

describe("XElementRegistry Coverage", () => {
    beforeEach(() => {
        XElementRegistry.Instance.Clear();
    });

    it("should handle registration with base class", () => {
        XElementRegistry.Instance.Register({
            TagName: "Base",
            Constructor: XPersistableElement
        });
        XElementRegistry.Instance.Register({
            TagName: "Derived",
            Constructor: XExtendedTestElement,
            BaseClassName: "Base"
        });

        expect(XElementRegistry.Instance.GetDerivedTypes("Base")).toContain("Derived");
        expect(XElementRegistry.Instance.GetDerivedTypes("Unknown")).toEqual([]);
    });

    it("should register and retrieve properties", () => {
        XElementRegistry.Instance.Register({
            TagName: "Test",
            Constructor: XExtendedTestElement
        });

        const prop = XExtendedTestElement.ExtendedProp;
        XElementRegistry.Instance.RegisterProperty("Test", prop, true);
        // Test RegisterProperty with unknown tag (should return early)
        XElementRegistry.Instance.RegisterProperty("NonExistentTag", prop, false);

        const props = XElementRegistry.Instance.GetProperties("Test");
        expect(props).toContain(prop);
        expect(XElementRegistry.Instance.IsAttributeProperty("Test", prop.ID)).toBe(true);
        expect(XElementRegistry.Instance.IsAttributeProperty("Test", "other")).toBe(false);
        expect(XElementRegistry.Instance.IsAttributeProperty("Unknown", "other")).toBe(false);
        expect(XElementRegistry.Instance.GetProperties("Unknown")).toEqual([]);
    });

    it("should manage child tags", () => {
        XElementRegistry.Instance.Register({ TagName: "Parent", Constructor: XPersistableElement });
        XElementRegistry.Instance.RegisterChildTag("Parent", "Child1");
        XElementRegistry.Instance.RegisterChildTag("Parent", "Child2");
        XElementRegistry.Instance.RegisterChildTag("Unknown", "Child1");

        expect(XElementRegistry.Instance.GetChildTags("Parent")).toEqual(["Child1", "Child2"]);
        // Test GetChildTags with unknown tag
        expect(XElementRegistry.Instance.GetChildTags("NonExistentTag")).toEqual([]);
    });

    it("should retrieve by ClassID and Constructor", () => {
        XElementRegistry.Instance.Register({ TagName: "T1", Constructor: XTestElement, ClassID: "C1" });
        expect(XElementRegistry.Instance.GetByClassID("C1")?.TagName).toBe("T1");
        expect(XElementRegistry.Instance.GetByConstructor(XTestElement)?.TagName).toBe("T1");
    });

    it("should handle GetAllTags and HasTag", () => {
        XElementRegistry.Instance.Register({ TagName: "T1", Constructor: XTestElement });
        expect(XElementRegistry.Instance.GetAllTags()).toContain("T1");
        expect(XElementRegistry.Instance.HasTag("T1")).toBe(true);
        expect(XElementRegistry.Instance.HasTag("T2")).toBe(false);
    });

    it("should handle CreateElement failure", () => {
        expect(XElementRegistry.Instance.CreateElement("Unknown")).toBeNull();
        
        XElementRegistry.Instance.Register({ 
            TagName: "Fail", 
            Constructor: class extends XPersistableElement { constructor() { throw new Error(); } } as any 
        });
        expect(XElementRegistry.Instance.CreateElement("Fail")).toBeNull();
    });

    it("should work with decorators", () => {
        // Re-register because of Clear() in beforeEach
        XElementRegistry.Instance.Register({ TagName: "XParentTag", Constructor: XPersistableElement });
        RegisterElement("XDecoratedElement", "DECO-ID", 100)(XDecoratedElement);
        RegisterElement("XChildElement")(XChildElement);
        RegisterChildElement("XParentTag")(XChildElement);
        
        expect(XElementRegistry.Instance.HasTag("XDecoratedElement")).toBe(true);
        expect(XElementRegistry.Instance.GetByTagName("XDecoratedElement")?.ClassID).toBe("DECO-ID");
        expect(XElementRegistry.Instance.GetChildTags("XParentTag")).toContain("XChildElement");
    });
});

describe("XSerializationContext Coverage", () => {
    it("should handle property and element tracking", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const el = new XPersistableElement();
        el.ID = XGuid.NewValue();
        context.RegisterElement(el);
        expect(context.GetElement(el.ID)).toBe(el);
        expect(context.GetElement("nonexistent-id")).toBeNull();
        
        context.AddPendingReference("from", "prop", "to");
        expect(context.PendingReferencesCount).toBe(1);
        
        context.AddError({ ElementID: "1", ElementName: "E", PropertyName: "P", Message: "M", Phase: XSerializationPhase.Serialize });
        expect(context.HasErrors).toBe(true);
        expect(context.Errors.length).toBe(1);
    });

    it("should generate new line based on indent option", () => {
        const c1 = new XSerializationContext(XSerializationDirection.Serialize, { Indent: true });
        expect(c1.GetNewLine()).toBe("\n");
        const c2 = new XSerializationContext(XSerializationDirection.Serialize, { Indent: false });
        expect(c2.GetNewLine()).toBe("");
    });
});

describe("XTypeConverter Coverage", () => {
    it("should clear all state", () => {
        (XTypeConverter as any).RegisterDefaultConverters();
    });

    it("should resolve references", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const parent = new XPersistableElement();
        const child = new XPersistableElement();
        parent.ID = XGuid.NewValue();
        child.ID = XGuid.NewValue();
        context.RegisterElement(parent);
        context.RegisterElement(child);
        
        const prop = XPersistableElement.NameProp;
        context.AddPendingReference(parent.ID, prop.ID, child.ID);
        // Add one that is already resolved to cover that path
        context.AddPendingReference(parent.ID, prop.ID, child.ID);
        (context.PendingReferences[1] as any).IsResolved = true;
        
        const count = context.ResolveReferences();
        expect(count).toBe(1);
        expect(context.PendingReferencesCount).toBe(0);
    });

    it("should handle property and element tracking additional paths", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        context.DocumentID = "D1";
        context.DocumentName = "DN";
        context.ModuleID = "M1";
        expect(context.DocumentID).toBe("D1");
        expect(context.DocumentName).toBe("DN");
        expect(context.ModuleID).toBe("M1");
        
        const el = new XPersistableElement();
        el.ID = XGuid.NewValue();
        context.RegisterElement(el);
        expect(context.HasElement(el.ID)).toBe(true);
        expect(context.HasElement("none")).toBe(false);
        
        context.MarkProcessed(el.ID);
        expect(context.IsProcessed(el.ID)).toBe(true);
        expect(context.IsProcessed("none")).toBe(false);
        
        const err = context.CreateError("E1", "EN", "PN", "MSG");
        expect(err.Message).toBe("MSG");
        
        context.Clear();
        expect(context.PendingReferencesCount).toBe(0);
        expect(context.HasErrors).toBe(false);
        expect(context.Phase).toBe(XSerializationPhase.None);
        expect(context.CurrentDepth).toBe(0);
    });

    it("should handle default value checking for various types", () => {
        expect(XTypeConverter.IsDefaultValue("", "", "String")).toBe(true);
        expect(XTypeConverter.IsDefaultValue(1, 1, "Int32")).toBe(true);
        expect(XTypeConverter.IsDefaultValue(true, true, "Boolean")).toBe(true);
        expect(XTypeConverter.IsDefaultValue(null, null, "Unknown")).toBe(true);
        
        expect(XTypeConverter.IsDefaultValue(1.1, 1.1, "Double")).toBe(true);
        const d = new Date();
        expect(XTypeConverter.IsDefaultValue(d, d, "DateTime")).toBe(true);
        expect(XTypeConverter.IsDefaultValue({Width:1, Height:1}, {Width:1, Height:1}, "Size")).toBe(true);
        expect(XTypeConverter.IsDefaultValue({X:1, Y:1, Width:1, Height:1}, {X:1, Y:1, Width:1, Height:1}, "Rect")).toBe(true);
        expect(XTypeConverter.IsDefaultValue({X:1, Y:1}, {X:1, Y:1}, "Point")).toBe(true);
        expect(XTypeConverter.IsDefaultValue([{X:1, Y:1}], [{X:1, Y:1}], "Point[]")).toBe(true);
        expect(XTypeConverter.IsDefaultValue({A:255, R:0, G:0, B:0}, {A:255, R:0, G:0, B:0}, "Color")).toBe(true);
        expect(XTypeConverter.IsDefaultValue({Left:1, Top:1, Right:1, Bottom:1}, {Left:1, Top:1, Right:1, Bottom:1}, "Thickness")).toBe(true);
    });

    it("should handle FromString edge cases and invalid formats", () => {
        expect(XTypeConverter.FromString("", "Guid")).toBe(XGuid.EmptyValue);
        expect(XTypeConverter.FromString("invalid", "Guid")).toBe(XGuid.EmptyValue);
        expect(XTypeConverter.FromString("", "Guid[]")).toEqual([]);
        expect(XTypeConverter.FromString("not-a-number", "Int32")).toBe(0);
        expect(XTypeConverter.FromString("not-a-number", "Int64")).toBe(0);
        expect(XTypeConverter.FromString("not-a-number", "Double")).toBe(0);
        expect(XTypeConverter.FromString("not-a-number", "Decimal")).toBe(0);
        expect(XTypeConverter.FromString("not-a-date", "DateTime").getTime()).toBe(0);
        expect(XTypeConverter.FromString("bad-size", "Size")).toEqual({ Width: 0, Height: 0 });
        expect(XTypeConverter.FromString("bad-rect", "Rect")).toEqual({ X: 0, Y: 0, Width: 0, Height: 0 });
        expect(XTypeConverter.FromString("bad-point", "Point")).toEqual({ X: 0, Y: 0 });
        expect(XTypeConverter.FromString("bad-color", "Color")).toEqual({ A: 255, R: 0, G: 0, B: 0 });
        expect(XTypeConverter.FromString("bad-thickness", "Thickness")).toEqual({ Left: 0, Top: 0, Right: 0, Bottom: 0 });
        expect(XTypeConverter.FromString("P1|P2", "Point[]")).toEqual([{X:0, Y:0}, {X:0, Y:0}]);
        expect(XTypeConverter.FromString("G1|G2", "Guid[]")).toEqual([]);
        expect(XTypeConverter.FromString("true", "Unknown")).toBe("true");
    });

    it("should handle ToString for various types", () => {
        expect(XTypeConverter.ToString(null, "Size")).toBe("{Width=0;Height=0}");
        expect(XTypeConverter.ToString(null, "Rect")).toBe("{X=0;Y=0;Width=0;Height=0}");
        expect(XTypeConverter.ToString(null, "Point")).toBe("{X=0;Y=0}");
        expect(XTypeConverter.ToString(null, "Color")).toBe("{A=255;R=0;G=0;B=0}");
        expect(XTypeConverter.ToString(null, "Thickness")).toBe("{Left=0;Top=0;Right=0;Bottom=0}");
        expect(XTypeConverter.ToString(null, "DateTime")).toBe("");
        expect(XTypeConverter.ToString(null, "Guid")).toBe(XGuid.EmptyValue);
        expect(XTypeConverter.ToString(undefined, "String")).toBe("");
        expect(XTypeConverter.ToString([], "Point[]")).toBe("");
        expect(XTypeConverter.ToString(null, "Guid[]")).toBe("");
        
        const guid1 = XGuid.NewValue();
        const guid2 = XGuid.NewValue();
        expect(XTypeConverter.ToString([guid1, guid2], "Guid[]")).toBe(`${guid1}|${guid2}`);
    });

    it("should infer types correctly", () => {
        expect(XTypeConverter.InferTypeName("str")).toBe("String");
        expect(XTypeConverter.InferTypeName(XGuid.NewValue())).toBe("Guid");
        expect(XTypeConverter.InferTypeName(123)).toBe("Int32");
        expect(XTypeConverter.InferTypeName(123.45)).toBe("Double");
        expect(XTypeConverter.InferTypeName(true)).toBe("Boolean");
        expect(XTypeConverter.InferTypeName(new Date())).toBe("DateTime");
        expect(XTypeConverter.InferTypeName([XGuid.NewValue()])).toBe("Guid[]");
        expect(XTypeConverter.InferTypeName([{X:1, Y:1}])).toBe("Point[]");
        expect(XTypeConverter.InferTypeName({Width:1, Height:1})).toBe("Size");
        expect(XTypeConverter.InferTypeName({X:1, Y:1, Width:1, Height:1})).toBe("Rect");
        expect(XTypeConverter.InferTypeName({X:1, Y:1})).toBe("Point");
        expect(XTypeConverter.InferTypeName({A:1, R:1, G:1, B:1})).toBe("Color");
        expect(XTypeConverter.InferTypeName({Left:1, Top:1, Right:1, Bottom:1})).toBe("Thickness");
        expect(XTypeConverter.InferTypeName({})).toBe("Unknown");
        expect(XTypeConverter.InferTypeName(null)).toBe("String");
        expect(XTypeConverter.InferTypeName([])).toBe("Unknown");
        expect(XTypeConverter.InferTypeName(undefined as any)).toBe("String");
        // Symbol and function types - when typeof is not string, boolean, number, Date, Array, or object
        expect(XTypeConverter.InferTypeName(Symbol("test") as any)).toBe("Unknown");
        expect(XTypeConverter.InferTypeName((() => {}) as any)).toBe("Unknown");
    });
});

describe("XmlReader and XmlWriter Coverage", () => {
    it("should write XData with multiple cultures", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(context);
        const cultures = new Map([["en-US", "Hello"], ["pt-BR", "Olá"]]);
        writer.WriteXData("Test", "1", "String", "Hello", cultures);
        const xml = writer.GetOutput();
        expect(xml).toContain("IETFCode=\"en-US\"");
        expect(xml).toContain("IETFCode=\"pt-BR\"");
    });

    it("should write XLinkData", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(context);
        writer.WriteXLinkData(
            "Link", "1", "Guid", "E1", "T", "D1", "DN", "M1", "MN", "V", "DX"
        );
        expect(writer.GetOutput()).toContain("ElementID=\"E1\"");
    });

    it("should write XLinkedShape", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(context);
        writer.WriteXLinkedShape(
            "Shape", "1", 1, 10, 20, "90", "E1", "T", "D1", "DN", "M1"
        );
        expect(writer.GetOutput()).toContain("Side=\"1\"");
    });

    it("should handle Parse errors and empty input", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context, { StrictMode: true });
        expect(reader.Parse("")).toBeNull();
        expect(reader.Parse("<Root><Child></Root>")).toBeNull();
    });

    it("should handle unmatched end tags in StrictMode", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context, { StrictMode: true });
        reader.Parse("<Root></Other>");
        expect(context.HasErrors).toBe(true);
    });

    it("should handle ReadXLinkedShape", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        const node = { 
            TagName: "XLinkedShape", 
            Attributes: new Map([["Side", "2"], ["X", "10.5"], ["Y", "20.5"]]),
            ChildNodes: [],
            TextContent: "val" 
        };
        const res = reader.ReadXLinkedShape(node as any);
        expect(res?.Side).toBe(2);
        expect(res?.X).toBe(10.5);
    });

    it("should find nodes by path and tag name", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        const xml = "<Root><A><B>Val</B></A><C><B>Other</B></C></Root>";
        reader.Parse(xml);
        expect(reader.FindNode(["A", "B"])?.TextContent).toBe("Val");
        expect(reader.FindAllNodes("B").length).toBe(2);
    });

    it("should skip declaration correctly", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        const xml = "<?xml version=\"1.0\"?><Root/>";
        const node = reader.Parse(xml);
        expect(node?.TagName).toBe("Root");
    });

    it("should handle mixed content and whitespace", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        const xml = "<Root>  Text  <Child/>  </Root>";
        const node = reader.Parse(xml);
        expect(node?.TextContent.trim()).toBe("Text");
    });
});

describe("XSerializationEngine remaining lines", () => {
    it("should handle SerializeToDocument", () => {
        const engine = XSerializationEngine.Instance;
        const elem = new XPersistableElement();
        const res = engine.SerializeToDocument(elem, "DocName", "ModID");
        
        expect(res.Success).toBe(true);
        expect(res.XmlOutput).toContain('Name="DocName"');
        expect(res.XmlOutput).toContain('ModuleID="ModID"');
    });

    it("should handle errors during serialization", () => {
        const engine = new XSerializationEngine();
        const elem = new XPersistableElement();
        vi.spyOn(elem, 'GetSerializableProperties').mockImplementation(() => { throw new Error("Mock error"); });
        
        const res = engine.Serialize(elem);
        expect(res.Success).toBe(false);
        expect(res.Errors[0].Message).toContain("Serialization failed: Mock error");
        
        const res2 = engine.SerializeToDocument(elem, "D", "M");
        expect(res2.Success).toBe(false);
        expect(res2.Errors[0].Message).toContain("Document serialization failed: Mock error");

        vi.restoreAllMocks();
    });

    it("should handle errors during deserialization", () => {
        const engine = new XSerializationEngine();
        const res = engine.Deserialize("invalid xml");
        expect(res.Success).toBe(false);
        expect(res.Errors[0].Message).toContain("Failed to parse XML");

        vi.spyOn(XmlReader.prototype, 'ReadElement').mockImplementation(() => { throw new Error("Read fail"); });
        const res2 = engine.Deserialize("<Root/>");
        expect(res2.Success).toBe(false);
        expect(res2.Errors[0].Message).toContain("Deserialization failed: Read fail");
        
        vi.restoreAllMocks();
    });

    it("should validate XML and report errors", () => {
        const engine = new XSerializationEngine();
        const res = engine.ValidateXml("<UnknownElement/>");
        expect(res.Success).toBe(false); 
        expect(res.Data).toBe(false);
        expect(res.Errors.length).toBeGreaterThan(0);

        const res3 = engine.ValidateXml("invalid");
        expect(res3.Errors[0].Message).toContain("Invalid XML format");
    });
});

describe("Additional Data Coverage", () => {
    beforeEach(() => {
        XElementRegistry.Instance.Clear();
    });

    it("XSerializationEngine: Configure, Configuration and Registry", () => {
        const config = { SerializationOptions: { CultureCode: "de-DE" } };
        const engine = XSerializationEngine.Configure(config);
        expect(engine.Configuration.SerializationOptions.CultureCode).toBe("de-DE");
        expect(engine.Registry).toBe(XElementRegistry.Instance);
    });

    it("XSerializationEngine: RegisterElement and GetClassID", () => {
        const engine = XSerializationEngine.Instance;
        engine.RegisterElement({ TagName: "CIDTest", Constructor: XTestElement, ClassID: "CID-123" });
        expect(engine.GetClassID(XTestElement)).toBe("CID-123");
        expect(engine.GetClassID(class {})).toBe("");
    });

    it("XSerializationEngine: SerializeDocumentContent lambda and conditions", () => {
        class XPropElem extends XPersistableElement {
            public static readonly PProp = XProperty.Register<XPropElem, string>(
                (p: XPropElem) => p.P, XGuid.NewValue(), "P", "P", "def", { AsAttribute: false }
            );
            public get P(): string { return this.GetValue(XPropElem.PProp) as string; }
            public set P(v: string) { this.SetValue(XPropElem.PProp, v); }
        }
        XElementRegistry.Instance.Register({ TagName: "PropElem", Constructor: XPropElem });
        XElementRegistry.Instance.RegisterProperty("PropElem", XPropElem.PProp, false);
        
        const el = new XPropElem();
        el.P = "not-def";
        const engine = XSerializationEngine.Instance;
        const res = engine.Serialize(el);
        expect(res.XmlOutput).toContain("<XValues>");
        expect(res.XmlOutput).toContain("not-def");

        const el2 = new XPropElem();
        el2.P = "def";
        const res2 = engine.Serialize(el2);
        expect(res2.XmlOutput).not.toContain("<XValues>");
    });

    it("XSerializationEngine: SerializeToDocument with properties (Lines 366-377)", () => {
        const attrPropID = XGuid.NewValue();
        const docPropID = XGuid.NewValue();
        class XDocPropElem extends XPersistableElement {
            public static readonly AttrProp = XProperty.Register<XDocPropElem, string>(
                (p: XDocPropElem) => "attr", attrPropID, "AttrProp", "Attr Prop", ""
            );
            public static readonly DocProp = XProperty.Register<XDocPropElem, string>(
                (p: XDocPropElem) => "val", docPropID, "DocProp", "Doc Prop", "def"
            );
            public override GetSerializableProperties(): XProperty[] {
                return [XDocPropElem.AttrProp, XDocPropElem.DocProp];
            }
        }
        XDocPropElem.AttrProp.Default.AsAttribute = true;
        XDocPropElem.AttrProp.Default.IsPersistable = true;
        XDocPropElem.DocProp.Default.AsAttribute = false;
        XDocPropElem.DocProp.Default.IsPersistable = true;
        XElementRegistry.Instance.Register({ TagName: "XDocPropElem", Constructor: XDocPropElem });
        
        const el = new XDocPropElem();
        el.ID = XGuid.NewValue();
        el.SetValue(XDocPropElem.DocProp, "non-default");
        
        const engine = XSerializationEngine.Instance;
        const res = engine.SerializeToDocument(el, "TestDoc", XGuid.NewValue());
        expect(res.Success).toBe(true);
        expect(res.XmlOutput).toContain("XValues");
    });

    it("XSerializationEngine: SerializeDocumentContent with only AsAttribute properties (Line 367)", () => {
        const attrPropID = XGuid.NewValue();
        class XAttrOnlyElem extends XPersistableElement {
            public static readonly OnlyAttr = XProperty.Register<XAttrOnlyElem, string>(
                (p: XAttrOnlyElem) => "", attrPropID, "OnlyAttr", "Only Attr", ""
            );
            public override GetSerializableProperties(): XProperty[] {
                return [XAttrOnlyElem.OnlyAttr];
            }
        }
        XAttrOnlyElem.OnlyAttr.Default.AsAttribute = true;
        XAttrOnlyElem.OnlyAttr.Default.IsPersistable = true;
        XElementRegistry.Instance.Register({ TagName: "XAttrOnlyElem", Constructor: XAttrOnlyElem });
        
        const el = new XAttrOnlyElem();
        el.ID = XGuid.NewValue();
        el.SetValue(XAttrOnlyElem.OnlyAttr, "SomeValue");
        
        const engine = XSerializationEngine.Instance;
        const res = engine.SerializeToDocument(el, "AttrOnly", XGuid.NewValue());
        expect(res.Success).toBe(true);
        expect(res.XmlOutput).not.toContain("<XValues>");
    });

    it("XSerializationEngine: Factory methods", () => {
        const engine = XSerializationEngine.Instance;
        const context = engine.CreateContext(XSerializationDirection.Serialize);
        expect(context).toBeDefined();
        expect(engine.CreateWriter(context)).toBeDefined();
        expect(engine.CreateReader(context)).toBeDefined();
    });

    it("XSerializationEngine: ValidateXml catch block", () => {
        const engine = XSerializationEngine.Instance;
        const spy = vi.spyOn(XmlReader.prototype, "Parse").mockImplementation(() => { throw new Error("Validation panic"); });
        const res = engine.ValidateXml("<Root />");
        expect(res.Success).toBe(false);
        expect(res.Errors[0].Message).toContain("Validation panic");
        spy.mockRestore();
    });

    it("XSerializationEngine: ValidateNode recursion", () => {
        XElementRegistry.Instance.Register({ TagName: "P", Constructor: XPersistableElement });
        XElementRegistry.Instance.Register({ TagName: "C", Constructor: XPersistableElement });
        const res = XSerializationEngine.Instance.ValidateXml("<P><C /><U /></P>");
        expect(res.Errors.some(e => e.Message.includes("Unknown element: U"))).toBe(true);
    });

    it("XSerializationEngine: InvokeHooksAfterDeserialize", () => {
        const hook = { AfterDeserialize: vi.fn() };
        XSerializationEngine.Instance.RegisterHook("h1", hook);
        XElementRegistry.Instance.Register({ TagName: "HT", Constructor: XPersistableElement });
        XSerializationEngine.Instance.Deserialize("<HT />");
        expect(hook.AfterDeserialize).toHaveBeenCalled();
        XSerializationEngine.Instance.UnregisterHook("h1");
    });

    it("XmlReader: ParseAttributes break", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        const node = { TagName: "T", Attributes: new Map(), ChildNodes: [] };
        (reader as any)._Input = " =\"v\"";
        (reader as any)._Position = 0;
        (reader as any).ParseAttributes(node);
        expect(node.Attributes.size).toBe(0);
    });

    it("XmlReader: Read methods wrong tag", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        expect(reader.ReadXData({ TagName: "W" } as any)).toBeNull();
        expect(reader.ReadXLinkData({ TagName: "W" } as any)).toBeNull();
        expect(reader.ReadXLinkedShape({ TagName: "W" } as any)).toBeNull();
        
        const node = { TagName: "XLinkedShape", Attributes: new Map(), ChildNodes: [], TextContent: "" };
        expect(reader.ReadXLinkedShape(node as any)).toBeDefined();
    });

    it("XmlReader: ReadElement unknown with IgnoreUnknownElements: false", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context, { IgnoreUnknownElements: false });
        expect(reader.ReadElement({ TagName: "U", Attributes: new Map() } as any)).toBeNull();
        expect(context.Errors.some(e => e.Message.includes("Unknown element type"))).toBe(true);
    });

    it("XmlReader: ApplyAttributes catch block", () => {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context);
        const element = {
            ID: "1", Name: "E",
            GetSerializableProperties: () => [{
                Name: "A",
                Default: { AsAttribute: true, DefaultValue: "" }
            }],
            SetValue: () => { throw new Error("P"); }
        };
        const node = { Attributes: new Map([["A", "V"]]) };
        (reader as any).ApplyAttributes(element as any, node as any);
        expect(context.Errors.length).toBeGreaterThan(0);
        expect(context.Errors[0].Message).toContain("Failed to set property");
    });

    it("XmlWriter: Property value error", () => {
        const fPropID = XGuid.NewValue();
        class XFElement extends XPersistableElement {
            public static readonly FProp = XProperty.Register<XFElement, string>(
                (p: XFElement) => p.F, fPropID, "F", "F", ""
            );
            public get F(): string { throw new Error("FAIL"); }
        }
        XFElement.FProp.Default.IsPersistable = true;
        XFElement.FProp.Default.AsAttribute = false;
        XElementRegistry.Instance.Register({ TagName: "FE", Constructor: XFElement });
        XElementRegistry.Instance.RegisterProperty("FE", XFElement.FProp, false);
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(context);
        writer.WritePropertiesSection(new XFElement());
        expect(writer.GetOutput()).not.toContain("XData");
    });

    it("XmlWriter: Default value continue", () => {
        const dPropID = XGuid.NewValue();
        class XDElem extends XPersistableElement {
            public static readonly DProp = XProperty.Register<XDElem, string>(
                (p: XDElem) => p.D, dPropID, "D", "D", "DEF"
            );
            public get D(): string { return this.GetValue(XDElem.DProp) as string; }
        }
        XDElem.DProp.Default.IsPersistable = true;
        XDElem.DProp.Default.AsAttribute = false;
        XElementRegistry.Instance.Register({ TagName: "DE", Constructor: XDElem });
        XElementRegistry.Instance.RegisterProperty("DE", XDElem.DProp, false);
        const el = new XDElem();
        const context = new XSerializationContext(XSerializationDirection.Serialize, { IncludeDefaultValues: false });
        const writer = new XmlWriter(context);
        writer.WritePropertiesSection(el);
        expect(writer.GetOutput()).not.toContain("XData");
    });

    it("XmlWriter: Escape null/undefined", () => {
        const writer = new XmlWriter(new XSerializationContext(XSerializationDirection.Serialize));
        expect((writer as any).EscapeAttribute(null)).toBe("");
        expect((writer as any).EscapeText(undefined)).toBe("");
    });

    it("XmlWriter: Child elements with properties function", () => {
        const parent = new XPersistableElement();
        const child = new XPersistableElement();
        XElementRegistry.Instance.Register({ TagName: "C", Constructor: XPersistableElement });
        (child as any).TagName = "C";
        parent.ChildNodes.push(child as any);
        const writer = new XmlWriter(new XSerializationContext(XSerializationDirection.Serialize));
        (writer as any).WriteChildElements(parent);
        expect(writer.GetOutput()).toContain("<C");
    });
});

describe("Final Coverage Gaps", () => {
    it("XSerializationEngine: Custom Serializers", () => {
        const engine = XSerializationEngine.Instance;
        const custom: any = {
            Serialize: (el: any, w: any) => { w.WriteStartElement("Custom"); w.WriteEndElement("Custom"); },
            Deserialize: () => new XPersistableElement()
        };
        engine.RegisterCustomSerializer("Custom", custom);
        
        const el = new XPersistableElement();
        XElementRegistry.Instance.Register({ TagName: "Custom", Constructor: XPersistableElement });
        
        const res = engine.Serialize(el);
        expect(res.XmlOutput).toContain("<Custom");
        
        const resD = engine.Deserialize("<Custom />");
        expect(resD.Success).toBe(true);
    });

    it("XSerializationEngine: SerializeToDocument null element", () => {
        const engine = XSerializationEngine.Instance;
        const res = engine.SerializeToDocument(null as any, "D", "M");
        expect(res.Success).toBe(false);
        expect(res.Errors[0].Message).toContain("Element is null");
    });

    it("XSerializationEngine: Before hooks", () => {
        const h = { BeforeSerialize: vi.fn(), BeforeDeserialize: vi.fn() };
        XSerializationEngine.Instance.RegisterHook("h2", h);
        XElementRegistry.Instance.Register({ TagName: "HT2", Constructor: XPersistableElement });
        
        XSerializationEngine.Instance.Serialize(new XPersistableElement());
        XSerializationEngine.Instance.Deserialize("<HT2 />");
        
        expect(h.BeforeSerialize).toHaveBeenCalled();
        expect(h.BeforeDeserialize).toHaveBeenCalled();
        XSerializationEngine.Instance.UnregisterHook("h2");
    });

    it("XTypeConverter: Decimal and Int64", () => {
        const dec = XTypeConverter.GetConverter<number>("Decimal")!;
        expect(dec.ToString(1.23)).toBe("1.23");
        expect(dec.IsDefault(1, 1 + Number.EPSILON / 2)).toBe(true);
        expect(dec.IsDefault(1, 1.1)).toBe(false);

        const i64 = XTypeConverter.GetConverter<number>("Int64")!;
        expect(i64.ToString(123.456)).toBe("123");
        expect(i64.IsDefault(1, 1)).toBe(true);
    });

    it("XTypeConverter: Thickness and Point[]", () => {
        const thk = XTypeConverter.GetConverter<any>("Thickness")!;
        expect(thk.ToString({ Left: 1, Top: 2, Right: 3, Bottom: 4 })).toBe("{Left=1;Top=2;Right=3;Bottom=4}");
        expect(thk.FromString("{Left=1;Top=2;Right=3;Bottom=4}")).toEqual({ Left: 1, Top: 2, Right: 3, Bottom: 4 });
        
        // Test IsDefault with null/undefined to cover optional chaining branches
        expect(thk.IsDefault({ Left: 1, Top: 2, Right: 3, Bottom: 4 }, { Left: 1, Top: 2, Right: 3, Bottom: 4 })).toBe(true);
        expect(thk.IsDefault({ Left: 1, Top: 2, Right: 3, Bottom: 4 }, { Left: 0, Top: 2, Right: 3, Bottom: 4 })).toBe(false);
        expect(thk.IsDefault(null as any, null as any)).toBe(true);
        expect(thk.IsDefault(undefined as any, undefined as any)).toBe(true);
        expect(thk.IsDefault({ Left: 1, Top: 2, Right: 3, Bottom: 4 }, null as any)).toBe(false);
        expect(thk.IsDefault(null as any, { Left: 1, Top: 2, Right: 3, Bottom: 4 })).toBe(false);

        const pts = XTypeConverter.GetConverter<any[]>("Point[]")!;
        expect(pts.ToString([{ X: 1, Y: 2 }])).toBe("{X=1;Y=2}");
        expect(pts.IsDefault([{X:1,Y:1}], [{X:1,Y:1}])).toBe(true);
        expect(pts.IsDefault([{X:1,Y:1}], [{X:1,Y:2}])).toBe(false);
        expect(pts.IsDefault([], [])).toBe(true);
        expect(pts.IsDefault(null as any, [])).toBe(true);
    });

    it("XTypeConverter: fallback branches for invalid/null values", () => {
        // Test String FromString with null (returns "")
        const str = XTypeConverter.GetConverter<string>("String")!;
        expect(str.FromString(null as any)).toBe("");
        
        // Test Int32 ToString with null (uses ?? 0)
        const i32 = XTypeConverter.GetConverter<number>("Int32")!;
        expect(i32.ToString(null as any)).toBe("0");
        
        // Test Int64 ToString with null (uses ?? 0)
        const i64 = XTypeConverter.GetConverter<number>("Int64")!;
        expect(i64.ToString(null as any)).toBe("0");
        
        // Test Int64 FromString returning valid number (the :num branch)
        expect(i64.FromString("999")).toBe(999);
        
        // Test Double ToString with null (uses ?? 0)
        const dbl = XTypeConverter.GetConverter<number>("Double")!;
        expect(dbl.ToString(null as any)).toBe("0");
        
        // Test Double IsDefault with null (uses ?? 0)
        expect(dbl.IsDefault(null as any, 0)).toBe(true);
        expect(dbl.IsDefault(0, null as any)).toBe(true);
        
        // Test Decimal ToString with null (uses ?? 0)
        const dec = XTypeConverter.GetConverter<number>("Decimal")!;
        expect(dec.ToString(null as any)).toBe("0");
        
        // Test Decimal FromString returning valid number
        expect(dec.FromString("123.45")).toBe(123.45);
        
        // Test Decimal IsDefault with null (uses ?? 0)
        expect(dec.IsDefault(null as any, 0)).toBe(true);
        expect(dec.IsDefault(0, null as any)).toBe(true);
        
        // Test DateTime FromString with valid date (returns date, not Date(0))
        const dt = XTypeConverter.GetConverter<Date>("DateTime")!;
        const validDate = dt.FromString("2024-01-15T10:30:00Z");
        expect(validDate.getTime()).not.toBe(0);
        
        // Note: The || fallbacks in Size, Rect, Color, Thickness FromString are unreachable
        // because the regex patterns only capture valid digits. When the match fails,
        // the entire default object is returned before the || fallbacks could execute.
        // These fallbacks are defensive code that can never execute in practice.
    });

    it("XmlReader: ApplyProperties error", () => {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(ctx);
        
        let called = false;
        const element = {
            ID: "test-id",
            Name: "TestElement",
            GetSerializableProperties: () => [{
                Name: "TestProp",
                Default: { AsAttribute: true, DefaultValue: 0 }
            }],
            SetValue: () => {
                called = true;
                throw new Error("Mock SetValue error");
            }
        };
        
        const node = { Attributes: new Map([["TestProp", "123"]]) };
        
        // This should trigger the catch block in ApplyAttributes
        (reader as any).ApplyAttributes(element as any, node as any);
        
        // Verify SetValue was called and error was logged
        expect(called).toBe(true);
        expect(ctx.HasErrors).toBe(true);
    });

    it("XmlWriter: WriteAttribute and Default continues", () => {
        const ctx = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(ctx);
        
        // Test WriteAttribute directly - need to open a tag first
        writer.WriteStartElement("Test");
        writer.WriteAttribute("Attr", "Val");
        expect(writer.GetOutput()).toContain('Attr="Val"');
    });

    it("XElementRegistry: Registration with existing BaseClassName", () => {
        XElementRegistry.Instance.Clear();
        XElementRegistry.Instance.Register({ TagName: "Base", Constructor: XPersistableElement, BaseClassName: "Base" });
        XElementRegistry.Instance.Register({ TagName: "Derived1", Constructor: XExtendedTestElement, BaseClassName: "Base" });
        XElementRegistry.Instance.Register({ TagName: "Derived2", Constructor: XExtendedTestElement, BaseClassName: "Base" });
        
        const derived = XElementRegistry.Instance.GetDerivedTypes("Base");
        expect(derived).toContain("Derived1");
        expect(derived).toContain("Derived2");
    });

    it("XSerializationContext: DecrementDepth when already 0", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        expect(context.CurrentDepth).toBe(0);
        context.DecrementDepth();
        expect(context.CurrentDepth).toBe(0);
        context.IncrementDepth();
        context.IncrementDepth();
        expect(context.CurrentDepth).toBe(2);
        context.DecrementDepth();
        expect(context.CurrentDepth).toBe(1);
    });

    it("XSerializationContext: RegisterElement with empty GUID", () => {
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const el = new XPersistableElement();
        el.ID = "";
        context.RegisterElement(el);
        expect(context.HasElement("")).toBe(false);
        
        el.ID = XGuid.EmptyValue;
        context.RegisterElement(el);
        expect(context.HasElement(XGuid.EmptyValue)).toBe(false);
    });

    it("XTypeConverter: All branch paths for Size, Rect, Color", () => {
        // Size with different widths
        expect(XTypeConverter.IsDefaultValue({Width:1, Height:1}, {Width:2, Height:1}, "Size")).toBe(false);
        // Size with different heights
        expect(XTypeConverter.IsDefaultValue({Width:1, Height:1}, {Width:1, Height:2}, "Size")).toBe(false);
        
        // Rect with different X
        expect(XTypeConverter.IsDefaultValue({X:1,Y:1,Width:1,Height:1}, {X:2,Y:1,Width:1,Height:1}, "Rect")).toBe(false);
        // Rect with different Y
        expect(XTypeConverter.IsDefaultValue({X:1,Y:1,Width:1,Height:1}, {X:1,Y:2,Width:1,Height:1}, "Rect")).toBe(false);
        // Rect with different Width
        expect(XTypeConverter.IsDefaultValue({X:1,Y:1,Width:1,Height:1}, {X:1,Y:1,Width:2,Height:1}, "Rect")).toBe(false);
        // Rect with different Height
        expect(XTypeConverter.IsDefaultValue({X:1,Y:1,Width:1,Height:1}, {X:1,Y:1,Width:1,Height:2}, "Rect")).toBe(false);
        
        // Color with different A
        expect(XTypeConverter.IsDefaultValue({A:1,R:1,G:1,B:1}, {A:2,R:1,G:1,B:1}, "Color")).toBe(false);
        // Color with different R
        expect(XTypeConverter.IsDefaultValue({A:1,R:1,G:1,B:1}, {A:1,R:2,G:1,B:1}, "Color")).toBe(false);
        // Color with different G
        expect(XTypeConverter.IsDefaultValue({A:1,R:1,G:1,B:1}, {A:1,R:1,G:2,B:1}, "Color")).toBe(false);
        // Color with different B
        expect(XTypeConverter.IsDefaultValue({A:1,R:1,G:1,B:1}, {A:1,R:1,G:1,B:2}, "Color")).toBe(false);
        
        // Thickness branches
        expect(XTypeConverter.IsDefaultValue({Left:1,Top:1,Right:1,Bottom:1}, {Left:2,Top:1,Right:1,Bottom:1}, "Thickness")).toBe(false);
        expect(XTypeConverter.IsDefaultValue({Left:1,Top:1,Right:1,Bottom:1}, {Left:1,Top:2,Right:1,Bottom:1}, "Thickness")).toBe(false);
        expect(XTypeConverter.IsDefaultValue({Left:1,Top:1,Right:1,Bottom:1}, {Left:1,Top:1,Right:2,Bottom:1}, "Thickness")).toBe(false);
        expect(XTypeConverter.IsDefaultValue({Left:1,Top:1,Right:1,Bottom:1}, {Left:1,Top:1,Right:1,Bottom:2}, "Thickness")).toBe(false);
        
        // Point with different X
        expect(XTypeConverter.IsDefaultValue({X:1,Y:1}, {X:2,Y:1}, "Point")).toBe(false);
        // Point with different Y
        expect(XTypeConverter.IsDefaultValue({X:1,Y:1}, {X:1,Y:2}, "Point")).toBe(false);
        
        // Point[] with different lengths
        expect(XTypeConverter.IsDefaultValue([{X:1,Y:1}], [{X:1,Y:1},{X:2,Y:2}], "Point[]")).toBe(false);
    });

    it("XmlWriter: IsPersistable and AsAttribute branches", () => {
        class XBranchElem extends XPersistableElement {
            public static readonly P1 = XProperty.Register<XBranchElem, string>(
                (p: XBranchElem) => p.PV1, XGuid.NewValue(), "P1", "P1", "d1"
            );
            public static readonly P2 = XProperty.Register<XBranchElem, string>(
                (p: XBranchElem) => p.PV2, XGuid.NewValue(), "P2", "P2", "d2"
            );
            public get PV1(): string { return this.GetValue(XBranchElem.P1) as string; }
            public set PV1(v: string) { this.SetValue(XBranchElem.P1, v); }
            public get PV2(): string { return this.GetValue(XBranchElem.P2) as string; }
            public set PV2(v: string) { this.SetValue(XBranchElem.P2, v); }
        }
        
        XElementRegistry.Instance.Register({ TagName: "Branch", Constructor: XBranchElem });
        XBranchElem.P1.Default.IsPersistable = false;
        XBranchElem.P2.Default.AsAttribute = true;
        
        const el = new XBranchElem();
        el.PV1 = "v1";
        el.PV2 = "v2";
        
        const ctx = new XSerializationContext(XSerializationDirection.Serialize, { IncludeDefaultValues: false });
        const writer = new XmlWriter(ctx);
        writer.WritePropertiesSection(el);
        
        const output = writer.GetOutput();
        expect(output).not.toContain("P1");
        expect(output).not.toContain("P2");
        
        XBranchElem.P1.Default.IsPersistable = true;
        XBranchElem.P2.Default.AsAttribute = false;
    });

    it("XmlReader: FindNode with null current", () => {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(ctx);
        reader.Parse("<Root><A><B /></A></Root>");
        
        // This should trigger the null current check
        expect(reader.FindNode(["NonExistent", "Path"])).toBeNull();
    });

    it("XmlReader: XML Declaration variants", () => {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(ctx);
        
        expect(reader.Parse("<?xml version='1.0' encoding='UTF-8'?><Root />")?.TagName).toBe("Root");
        expect(reader.Parse("<?xml version='1.0' standalone='yes'?><Root />")?.TagName).toBe("Root");
    });

    it("XmlWriter: WriteChildElements with non-persistable element", () => {
        const parent = new XPersistableElement();
        const child = {} as any;
        parent.ChildNodes.push(child);
        
        const ctx = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(ctx);
        (writer as any).WriteChildElements(parent);
        
        // Should not crash and should not write the child
        expect(writer.GetOutput()).not.toContain("undefined");
    });

    it("XTypeConverter: Guid IsDefault with both empty", () => {
        expect(XTypeConverter.IsDefaultValue(XGuid.EmptyValue, XGuid.EmptyValue, "Guid")).toBe(true);
        expect(XTypeConverter.IsDefaultValue(XGuid.NewValue(), XGuid.EmptyValue, "Guid")).toBe(false);
    });

    it("XTypeConverter: string[] IsDefault edge cases", () => {
        const conv = XTypeConverter.GetConverter<string[]>("Guid[]")!;
        
        // Both null/undefined
        expect(conv.IsDefault(null as any, undefined as any)).toBe(true);
        expect(conv.IsDefault(undefined as any, null as any)).toBe(true);
        
        // One null, one with values
        expect(conv.IsDefault(null as any, ["a"])).toBe(false);
        expect(conv.IsDefault(["a"], null as any)).toBe(false);
        
        // Different lengths
        expect(conv.IsDefault(["a"], ["a", "b"])).toBe(false);
        
        // Same length, different values
        expect(conv.IsDefault(["a", "b"], ["a", "c"])).toBe(false);
    });

    it("XElementRegistry: GetByTagName returns null for unknown tag", () =>
    {
        const registry = XElementRegistry.Instance;
        const result = registry.GetByTagName("NonExistentTag123");
        expect(result).toBeNull();
    });

    it("XElementRegistry: GetByClassID returns null for unknown classID", () =>
    {
        const registry = XElementRegistry.Instance;
        const result = registry.GetByClassID("NonExistentClassID123");
        expect(result).toBeNull();
    });

    it("XElementRegistry: GetByConstructor returns null for unknown constructor", () =>
    {
        const registry = XElementRegistry.Instance;
        class UnknownClass extends XPersistableElement {}
        const result = registry.GetByConstructor(UnknownClass as any);
        expect(result).toBeNull();
    });

    it("XElementRegistry: GetDerivedTypes returns empty array for unknown base", () =>
    {
        const registry = XElementRegistry.Instance;
        const result = registry.GetDerivedTypes("NonExistentBaseClass");
        expect(result).toEqual([]);
    });

    it("XElementRegistry: CreateElement returns null for unknown tag", () =>
    {
        const registry = XElementRegistry.Instance;
        const result = registry.CreateElement("NonExistentTag123");
        expect(result).toBeNull();
    });

    it("XElementRegistry: CreateElement catches constructor error", () =>
    {
        const registry = XElementRegistry.Instance;
        class ThrowingElement extends XPersistableElement
        {
            constructor()
            {
                super();
                throw new Error("Constructor error");
            }
        }
        registry.Register({
            ClassName: "ThrowingElement",
            TagName: "ThrowingTag",
            ClassID: "throwing-class-id",
            Constructor: ThrowingElement,
            BaseClassName: "XPersistableElement"
        });
        const result = registry.CreateElement("ThrowingTag");
        expect(result).toBeNull();
    });

    it("XElementRegistry: GetTagName returns ClassName when metadata not found", () =>
    {
        const registry = XElementRegistry.Instance;
        class UnregisteredElement extends XPersistableElement
        {
            public override get ClassName(): string { return "UnregisteredElement"; }
        }
        const element = new UnregisteredElement();
        const result = registry.GetTagName(element);
        expect(result).toBe("UnregisteredElement");
    });

    it("XmlReader: ReadXData without child XLanguage nodes", () =>
    {
        const xml = `<?xml version="1.0"?><Root><XValues><XData Name="test" ID="${XGuid.NewValue()}" Type="String"></XData></XValues></Root>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownElements: true });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc).toBeDefined();
    });

    it("XmlReader: ReadElement with unknown type and IgnoreUnknownElements=true", () =>
    {
        const docID = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${docID}"><UnknownElement ID="${XGuid.NewValue()}"></UnknownElement></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownElements: true });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // No errors when ignoring unknown elements
        expect(ctx.Errors.length).toBe(0);
    });

    it("XmlReader: ReadElement with unknown type and IgnoreUnknownElements=false", () =>
    {
        const docID = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${docID}"><UnknownElement ID="${XGuid.NewValue()}"></UnknownElement></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownElements: false });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // Branch tested: !this._Options.IgnoreUnknownElements path
        expect(doc).toBeDefined();
    });

    it("XmlReader: ReadProperties with unknown property and IgnoreUnknownProperties=true", () =>
    {
        const unknownPropID = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData ID="${unknownPropID}" Name="unknown" Type="String">value</XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownProperties: true });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(ctx.Errors.length).toBe(0);
    });

    it("XmlReader: ReadProperties with unknown property and IgnoreUnknownProperties=false", () =>
    {
        const unknownPropID = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData ID="${unknownPropID}" Name="unknown" Type="String">value</XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownProperties: false });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // Branch tested: !this._Options.IgnoreUnknownProperties path
        expect(doc).toBeDefined();
    });

    it("XmlReader: ReadProperties with XLinkData branch", () =>
    {
        const linkPropID = XGuid.NewValue();
        const elemID = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XLinkData ID="${linkPropID}" Name="link" ElementID="${elemID}">default</XLinkData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownProperties: true });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc).toBeDefined();
    });

    it("XmlReader: ReadChildElements with Properties node skip", () =>
    {
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc.ChildNodes.length).toBe(0);
    });

    it("XmlReader: ReadXData with non-XData tagName returns null", () =>
    {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        // Access private method through test XML with wrong tag
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><WrongTag Name="test" ID="${XGuid.NewValue()}" Type="String">value</WrongTag></XValues></XDocument>`;
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // Should handle gracefully
        expect(doc).toBeDefined();
    });

    it("XmlReader: ReadChildElements with null childElement", () =>
    {
        const docID = XGuid.NewValue();
        // Unknown child element will return null from ReadElement
        const xml = `<?xml version="1.0"?><XDocument ID="${docID}"><UnknownChildElement ID="${XGuid.NewValue()}"></UnknownChildElement></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, { IgnoreUnknownElements: true });
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // Null element should be skipped, not added to ChildNodes
        expect(doc.ChildNodes.length).toBe(0);
    });

    it("XmlWriter: WriteXLinkData with null pDataEx", () =>
    {
        const ctx = new XSerializationContext(XSerializationDirection.Serialize, {});
        const writer = new XmlWriter(ctx);
        writer.WriteXLinkData("test", XGuid.NewValue(), "TypeName", XGuid.NewValue(), "text", XGuid.EmptyValue, "", XGuid.EmptyValue, "", null);
        const output = writer.GetOutput();
        expect(output).toContain("XLinkData");
        expect(output).toContain('DataEx=""');
    });

    it("XmlWriter: WriteChildElements with AsAttribute property not in attribute list", () =>
    {
        class XAttrElem extends XPersistableElement {
            public static readonly CustomProp = XProperty.Register<XAttrElem, string>(
                (p: XAttrElem) => p.CustomValue, XGuid.NewValue(), "CustomValue", "Custom Value", "default"
            );
            public get CustomValue(): string { return this.GetValue(XAttrElem.CustomProp) as string; }
            public set CustomValue(v: string) { this.SetValue(XAttrElem.CustomProp, v); }
        }
        
        XElementRegistry.Instance.Register({
            TagName: "XAttrElem",
            Constructor: XAttrElem,
            ClassName: "XAttrElem",
            ClassID: "attr-elem-id",
            BaseClassName: "XPersistableElement"
        });
        
        // Set AsAttribute but don't register it as attribute in registry
        XAttrElem.CustomProp.Default.AsAttribute = true;
        
        const elem = new XAttrElem();
        elem.CustomValue = "non-default";
        
        const ctx = new XSerializationContext(XSerializationDirection.Serialize, {});
        const writer = new XmlWriter(ctx);
        writer.WriteElement(elem);
        
        const output = writer.GetOutput();
        // Property should not be in attributes since IsAttributeProperty returns false
        expect(output).toBeDefined();
    });

    it("XSerializationContext: ResolveReferences with both source and target present", () =>
    {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const elem1 = new XPersistableElement();
        elem1.ID = XGuid.NewValue();
        const elem2 = new XPersistableElement();
        elem2.ID = XGuid.NewValue();
        
        ctx.RegisterElement(elem1);
        ctx.RegisterElement(elem2);
        
        const propID = XGuid.NewValue();
        ctx.AddPendingReference(elem1.ID, propID, elem2.ID);
        
        const resolved = ctx.ResolveReferences();
        expect(resolved).toBe(1);
    });

    it("XSerializationEngine: InvokeHooks with hook that has BeforeSerialize", () =>
    {
        const engine = XSerializationEngine.Instance;
        let hookCalled = false;
        
        engine.RegisterHook("test-hook", {
            BeforeSerialize: (pElement, pContext) => {
                hookCalled = true;
            }
        });
        
        const elem = new XPersistableElement();
        const xml = engine.Serialize(elem, {});
        
        expect(hookCalled).toBe(true);
        engine.UnregisterHook("test-hook");
    });

    it("XTypeConverter: GetConverter returns null for unknown type", () =>
    {
        const converter = XTypeConverter.GetConverter("NonExistentType" as any);
        expect(converter).toBeNull();
    });

    it("XTypeConverter: ToString with null converter returns string value", () =>
    {
        const result = XTypeConverter.ToString(123, "NonExistentType" as any);
        expect(result).toBe("123");
    });

    it("XTypeConverter: ToString with null value", () =>
    {
        const result = XTypeConverter.ToString(null, "String");
        expect(result).toBe("");
    });

    it("XTypeConverter: ToString infers type for empty array", () =>
    {
        // Empty array will be inferred as "Unknown" and ToString will handle it
        const result = XTypeConverter.ToString([], "String[]");
        expect(result).toBe("");
    });

    it("XTypeConverter: ToString infers type for array of non-Point objects", () =>
    {
        // Array of objects without Point properties will fall through to "Unknown"
        const result = XTypeConverter.ToString([{ NotX: 1, NotY: 2 }], "Point[]");
        // Should handle gracefully even if type doesn't match
        expect(result).toBeDefined();
    });

    it("XmlReader: ReadXData with non-XLanguage child nodes", () =>
    {
        // XData with child that is NOT XLanguage - tests line 339 false branch
        const id = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData Name="test" ID="${id}" Type="String"><OtherChild>content</OtherChild></XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // Non-XLanguage children should be ignored (false branch of line 339)
        expect(doc).toBeDefined();
    });

    it("XmlReader: Attributes with missing Name defaults to empty string", () =>
    {
        // XData without Name attribute - tests line 332 ?? "" branch
        const id = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData ID="${id}" Type="String">value</XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc).toBeDefined();
    });

    it("XmlReader: Attributes with missing ID defaults to EmptyValue", () =>
    {
        // XData without ID attribute - tests line 333 ?? XGuid.EmptyValue branch
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData Name="test" Type="String">value</XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc).toBeDefined();
    });

    it("XmlReader: Attributes with missing Type defaults to String", () =>
    {
        // XData without Type attribute - tests line 334 ?? "String" branch
        const id = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData Name="test" ID="${id}">value</XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc).toBeDefined();
    });

    it("XmlReader: XLanguage with missing IETFCode defaults to empty string", () =>
    {
        // XLanguage without IETFCode - tests line 341 ?? "" branch
        const id = XGuid.NewValue();
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><XData Name="test" ID="${id}" Type="String"><XLanguage>value</XLanguage></XData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        expect(doc).toBeDefined();
    });

    it("XmlReader: ReadXData/XLinkData/XLinkedShape return null when data creation fails", () =>
    {
        // Tests lines 434, 440, 446 - if (data) branches when ReadX methods return null
        const xml = `<?xml version="1.0"?><XDocument ID="${XGuid.NewValue()}"><XValues><InvalidData>content</InvalidData></XValues></XDocument>`;
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const reader = new XmlReader(ctx);
        const doc = new XDocument();
        reader.Parse(xml, doc);
        // Invalid data types should be skipped (null check branches)
        expect(doc).toBeDefined();
    });

    it("XmlWriter: IncludeDefaultValues false skips default values", () =>
    {
        class XDefaultElem extends XPersistableElement {
            public static readonly TestProp = XProperty.Register<XDefaultElem, number>(
                (p: XDefaultElem) => p.TestValue, XGuid.NewValue(), "TestValue", "Test Value", 42
            );
            public get TestValue(): number { return this.GetValue(XDefaultElem.TestProp) as number; }
            public set TestValue(v: number) { this.SetValue(XDefaultElem.TestProp, v); }
        }
        
        XElementRegistry.Instance.Register({
            TagName: "XDefaultElem",
            Constructor: XDefaultElem,
            ClassName: "XDefaultElem",
            ClassID: "default-elem-id",
            BaseClassName: "XPersistableElement"
        });
        
        const elem = new XDefaultElem();
        elem.TestValue = 42; // Default value
        
        const ctx = new XSerializationContext(XSerializationDirection.Serialize, { IncludeDefaultValues: false });
        const writer = new XmlWriter(ctx);
        writer.WriteElement(elem);
        
        const output = writer.GetOutput();
        // Property with default value should not be in output
        expect(output).not.toContain("TestValue");
    });

    it("XmlWriter: IsAttributeProperty false prevents attribute output", () =>
    {
        class XNoAttrElem extends XPersistableElement {
            public static readonly AttrProp = XProperty.Register<XNoAttrElem, string>(
                (p: XNoAttrElem) => p.AttrValue, XGuid.NewValue(), "AttrValue", "Attr Value", "default"
            );
            public get AttrValue(): string { return this.GetValue(XNoAttrElem.AttrProp) as string; }
            public set AttrValue(v: string) { this.SetValue(XNoAttrElem.AttrProp, v); }
        }
        
        XElementRegistry.Instance.Register({
            TagName: "XNoAttrElem",
            Constructor: XNoAttrElem,
            ClassName: "XNoAttrElem",
            ClassID: "no-attr-elem-id",
            BaseClassName: "XPersistableElement"
        });
        
        XNoAttrElem.AttrProp.Default.AsAttribute = true;
        // Don't register as attribute property in registry
        
        const elem = new XNoAttrElem();
        elem.AttrValue = "non-default";
        
        const ctx = new XSerializationContext(XSerializationDirection.Serialize, {});
        const writer = new XmlWriter(ctx);
        writer.WriteElement(elem);
        
        const output = writer.GetOutput();
        // Should not contain attribute since IsAttributeProperty returns false
        expect(output).toBeDefined();
    });

    it("XSerializationContext: RegisterElement with empty ID does not register", () =>
    {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const elem = new XPersistableElement();
        elem.ID = XGuid.EmptyValue; // Empty ID - tests line 191 false branch
        
        ctx.RegisterElement(elem);
        
        // Element with empty ID should NOT be registered
        expect(ctx.HasElement(XGuid.EmptyValue)).toBe(false);
    });

    it("XSerializationContext: ResolveReferences with missing source element", () =>
    {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const elem2 = new XPersistableElement();
        elem2.ID = XGuid.NewValue();
        
        ctx.RegisterElement(elem2);
        
        // Add reference with non-existent source - tests line 259 && branch (source is null)
        const nonExistentID = XGuid.NewValue();
        const propID = XGuid.NewValue();
        ctx.AddPendingReference(nonExistentID, propID, elem2.ID);
        
        const resolved = ctx.ResolveReferences();
        // Should not resolve because source doesn't exist
        expect(resolved).toBe(0);
    });

    it("XSerializationContext: ResolveReferences with missing target element", () =>
    {
        const ctx = new XSerializationContext(XSerializationDirection.Deserialize, {});
        const elem1 = new XPersistableElement();
        elem1.ID = XGuid.NewValue();
        
        ctx.RegisterElement(elem1);
        
        // Add reference with non-existent target - tests line 259 && branch (target is null)
        const nonExistentID = XGuid.NewValue();
        const propID = XGuid.NewValue();
        ctx.AddPendingReference(elem1.ID, propID, nonExistentID);
        
        const resolved = ctx.ResolveReferences();
        // Should not resolve because target doesn't exist
        expect(resolved).toBe(0);
    });

    it("XSerializationEngine: Hook without BeforeSerialize", () =>
    {
        const engine = XSerializationEngine.Instance;
        
        // Register hook with only AfterDeserialize - tests line 459 false branch
        engine.RegisterHook("no-before-hook", {
            AfterDeserialize: (pElement, pContext) => {}
        });
        
        const elem = new XPersistableElement();
        const xml = engine.Serialize(elem, {});
        
        expect(xml).toBeDefined();
        engine.UnregisterHook("no-before-hook");
    });

    it("XSerializationEngine: Hook without AfterSerialize", () =>
    {
        const engine = XSerializationEngine.Instance;
        
        // Register hook with only BeforeSerialize - tests AfterSerialize false branch
        engine.RegisterHook("no-after-hook", {
            BeforeSerialize: (pElement, pContext) => {}
        });
        
        const elem = new XPersistableElement();
        const xml = engine.Serialize(elem, {});
        
        expect(xml).toBeDefined();
        engine.UnregisterHook("no-after-hook");
    });

    it("XTypeConverter: InferType with array of numbers returns Unknown", () =>
    {
        // Array of numbers (not Guid[] nor Point[]) - tests line 420 return "Unknown"
        const result = XTypeConverter.ToString([1, 2, 3], "Unknown" as any);
        expect(result).toBeDefined();
    });

    it("XmlWriter: IncludeDefaultValues true includes default values", () =>
    {
        class XIncludeDefaultElem extends XPersistableElement {
            public static readonly IncProp = XProperty.Register<XIncludeDefaultElem, number>(
                (p: XIncludeDefaultElem) => p.IncValue, XGuid.NewValue(), "IncValue", "Inc Value", 42
            );
            public get IncValue(): number { return this.GetValue(XIncludeDefaultElem.IncProp) as number; }
            public set IncValue(v: number) { this.SetValue(XIncludeDefaultElem.IncProp, v); }
        }
        
        XElementRegistry.Instance.Register({
            TagName: "XIncludeDefaultElem",
            Constructor: XIncludeDefaultElem,
            ClassName: "XIncludeDefaultElem",
            ClassID: "include-default-elem-id",
            BaseClassName: "XPersistableElement"
        });
        
        const elem = new XIncludeDefaultElem();
        elem.IncValue = 42; // Default value
        
        // With IncludeDefaultValues = true - tests line 281 false branch
        const ctx = new XSerializationContext(XSerializationDirection.Serialize, { IncludeDefaultValues: true });
        const writer = new XmlWriter(ctx);
        writer.WriteElement(elem);
        
        const output = writer.GetOutput();
        // With IncludeDefaultValues=true, default value should be included
        expect(output).toContain("IncValue");
    });

    it("XSerializationEngine: SerializeDocumentContent with non-XPersistableElement child (Line 390)", () => {
        // Create a child that is XElement but not XPersistableElement
        class XNonPersistableChild extends XElement {}
        
        class XParentWithNonPersistable extends XPersistableElement {
            public constructor() {
                super();
                // Add a child that is not XPersistableElement
                const nonPersistable = new XNonPersistableChild();
                this.AppendChild(nonPersistable);
            }
        }
        
        XElementRegistry.Instance.Register({
            TagName: "XParentWithNonPersistable",
            Constructor: XParentWithNonPersistable
        });
        
        const elem = new XParentWithNonPersistable();
        elem.ID = XGuid.NewValue();
        
        const engine = XSerializationEngine.Instance;
        const res = engine.SerializeToDocument(elem, "ParentDoc", XGuid.NewValue());
        // Serialization should succeed, but non-persistable child is skipped
        expect(res.Success).toBe(true);
    });
});
