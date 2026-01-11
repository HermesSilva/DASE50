import { describe, it, expect, beforeEach, vi } from "vitest";
import { XGuid } from "../src/Core/XGuid.js";
import { XProperty } from "../src/Core/XProperty.js";
import { XPropertyGroup } from "../src/Core/XEnums.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XSerializationContext, XSerializationDirection, XSerializationPhase } from "../src/Data/XSerializationContext.js";
import { XElementRegistry, RegisterElement, RegisterChildElement } from "../src/Data/XElementRegistry.js";
import { XTypeConverter } from "../src/Data/XTypeConverter.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { XmlWriter } from "../src/Data/XmlWriter.js";
import { XmlReader } from "../src/Data/XmlReader.js";

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
        expect(res.XmlOutput).toContain("<Properties>");
        expect(res.XmlOutput).toContain("not-def");

        const el2 = new XPropElem();
        el2.P = "def";
        const res2 = engine.Serialize(el2);
        expect(res2.XmlOutput).not.toContain("<Properties>");
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
        class XFElement extends XPersistableElement {
            public static readonly FProp = XProperty.Register<XFElement, string>(
                (p: XFElement) => p.F, XGuid.NewValue(), "F", "F", "", { AsAttribute: false }
            );
            public get F(): string { throw new Error("FAIL"); }
        }
        XElementRegistry.Instance.Register({ TagName: "FE", Constructor: XFElement });
        XElementRegistry.Instance.RegisterProperty("FE", XFElement.FProp, false);
        const context = new XSerializationContext(XSerializationDirection.Serialize);
        const writer = new XmlWriter(context);
        writer.WritePropertiesSection(new XFElement());
        expect(writer.GetOutput()).not.toContain("XData");
    });

    it("XmlWriter: Default value continue", () => {
        class XDElem extends XPersistableElement {
            public static readonly DProp = XProperty.Register<XDElem, string>(
                (p: XDElem) => p.D, XGuid.NewValue(), "D", "D", "DEF", { AsAttribute: false }
            );
            public get D(): string { return this.GetValue(XDElem.DProp) as string; }
        }
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

        const pts = XTypeConverter.GetConverter<any[]>("Point[]")!;
        expect(pts.ToString([{ X: 1, Y: 2 }])).toBe("{X=1;Y=2}");
        expect(pts.IsDefault([{X:1,Y:1}], [{X:1,Y:1}])).toBe(true);
        expect(pts.IsDefault([{X:1,Y:1}], [{X:1,Y:2}])).toBe(false);
        expect(pts.IsDefault([], [])).toBe(true);
        expect(pts.IsDefault(null as any, [])).toBe(true);
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
});
