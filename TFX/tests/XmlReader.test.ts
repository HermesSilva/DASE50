import { describe, it, expect, beforeEach } from "vitest";
import { XmlReader } from "../src/Data/XmlReader.js";
import { XSerializationContext, XSerializationDirection } from "../src/Data/XSerializationContext.js";
import { XElementRegistry } from "../src/Data/XElementRegistry.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XProperty } from "../src/Core/XProperty.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XTypeConverter } from "../src/Data/XTypeConverter.js";

class XTestReaderElement extends XPersistableElement {
    public static readonly PropA = XProperty.Register<XTestReaderElement, string>(p => "", XGuid.NewValue(), "PropA", "Prop A", "");
    public static readonly PropAtat = XProperty.Register<XTestReaderElement, number>(p => 0, XGuid.NewValue(), "PropAtat", "Prop Atat", 0);
    
    public override GetSerializableProperties(): XProperty[] {
        return [XTestReaderElement.PropA, XTestReaderElement.PropAtat];
    }
}
XTestReaderElement.PropAtat.Default.AsAttribute = true;

// Custom type that throws on conversion for coverage of catch blocks
XTypeConverter.Register<any>({
    TypeName: "ThrowType",
    ToString: (v) => "",
    FromString: (v) => { throw new Error("Conversion failed"); },
    IsDefault: (v, d) => false
});

class XThrowElement extends XPersistableElement {
    public static readonly PropError = XProperty.Register<XThrowElement, any>(p => null, XGuid.NewValue(), "PropError", "Prop Error", { _isThrow: true } as any);
    
    public override GetSerializableProperties(): XProperty[] {
        return [XThrowElement.PropError];
    }
}
XThrowElement.PropError.Default.AsAttribute = true;

// We need to make sure InferTypeName returns "ThrowType" for { _isThrow: true }
const originalInfer = XTypeConverter.InferTypeName;
XTypeConverter.InferTypeName = (val: any) => {
    if (val && val._isThrow) return "ThrowType";
    return originalInfer(val);
};

describe("XmlReader", () => {
    let context: XSerializationContext;
    let reader: XmlReader;

    beforeEach(() => {
        context = new XSerializationContext(XSerializationDirection.Deserialize);
        reader = new XmlReader(context);
        XElementRegistry.Instance.Register({ TagName: "XTestReaderElement", Constructor: XTestReaderElement });
        XElementRegistry.Instance.Register({ TagName: "XThrowElement", Constructor: XThrowElement });
    });

    it("should access Context and Root getters (Lines 76-81)", () => {
        expect(reader.Context).toBe(context);
        reader.Parse("<Root />");
        expect(reader.Root).not.toBeNull();
        expect(reader.Root?.TagName).toBe("Root");
    });

    it("should handle end tag at start (Line 124)", () => {
        expect(reader.Parse("</Tag>")).toBeNull();
    });

    it("should handle empty tag name (Line 130)", () => {
        expect(reader.Parse("<>")).toBeNull();
    });

    it("should handle attribute without value (Line 186-190)", () => {
        const node = reader.Parse("<Tag Attr >");
        expect(node?.Attributes.has("Attr")).toBe(false);
    });

    it("should handle attribute value without quotes (Line 218)", () => {
        const node = reader.Parse("<Tag Attr=Value />");
        expect(node?.Attributes.get("Attr")).toBe("");
    });

    it("should handle end tag matching with whitespace (Line 282)", () => {
        const node = reader.Parse("<Tag></Tag >");
        expect(node).not.toBeNull();
    });

    it("should handle XLanguage without IETFCode (Line 316)", () => {
        const xml = `<XData Name="p" ID="${XGuid.NewValue()}"><XLanguage>DefaultValue</XLanguage></XData>`;
        const node = reader.Parse(xml);
        const data = reader.ReadXData(node!);
        expect(data?.CultureValues.get("")).toBe("DefaultValue");
    });

    it("should handle ReadXLinkData text content (Line 355)", () => {
        const xml = `<XLinkData>LinkContent</XLinkData>`;
        const node = reader.Parse(xml);
        const data = reader.ReadXLinkData(node!);
        expect(data?.StringValue).toBe("LinkContent");
    });

    it("should handle ReadXLinkedShape failure and success (Lines 391-395)", () => {
        const nodeNotXLink = reader.Parse("<NotX />");
        expect(reader.ReadXLinkedShape(nodeNotXLink!)).toBeNull();

        const xml = `<XLinkedShape Side="2" X="10" Y="20">ShapeData</XLinkedShape>`;
        const node = reader.Parse(xml);
        const data = reader.ReadXLinkedShape(node!);
        expect(data?.Side).toBe(2);
        expect(data?.X).toBe(10);
    });

    it("should handle ReadProperties loop (Lines 421-432)", () => {
        const xml = `
            <Root>
                <Properties>
                    <XData Name="d1" ID="${XGuid.NewValue()}">v1</XData>
                    <XLinkData Name="l1" ID="${XGuid.NewValue()}" ElementID="${XGuid.NewValue()}">v2</XLinkData>
                    <XLinkedShape Name="s1" ID="${XGuid.NewValue()}">v3</XLinkedShape>
                </Properties>
            </Root>
        `;
        const node = reader.Parse(xml);
        const props = reader.ReadProperties(node!);
        expect(props.size).toBe(3);
    });

    it("should handle ReadElement unknown type (Line 450)", () => {
        const readerError = new XmlReader(context, { IgnoreUnknownElements: false });
        const node = readerError.Parse("<Unknown />");
        expect(readerError.ReadElement(node!)).toBeNull();
        expect(context.Errors.some(e => e.Message.includes("Unknown element type"))).toBe(true);
    });

    it("should handle ApplyAttributes conversion error (Lines 486-501, 541)", () => {
        const xml = `<XThrowElement PropError="SomeValue" />`;
        const node = reader.Parse(xml);
        reader.ReadElement(node!);
        expect(context.Errors.some(e => e.PropertyName === "PropError")).toBe(true);
    });

    it("should handle ApplyProperties unknown property (Lines 515-525)", () => {
        const readerNoIgnore = new XmlReader(context, { IgnoreUnknownProperties: false });
        const xml = `
            <XThrowElement>
                <Properties>
                    <XData ID="UnknownPropID">Value</XData>
                </Properties>
            </XThrowElement>
        `;
        const node = readerNoIgnore.Parse(xml);
        readerNoIgnore.ReadElement(node!);
        expect(context.Errors.some(e => e.PropertyName === "UnknownPropID")).toBe(true);
    });

    it("should handle ApplyProperties link data (Lines 532-534)", () => {
        const linkID = XGuid.NewValue();
        const xml = `
            <XTestReaderElement>
                <Properties>
                    <XLinkData ID="${XTestReaderElement.PropA.ID}" ElementID="${linkID}">Link</XLinkData>
                </Properties>
            </XTestReaderElement>
        `;
        const node = reader.Parse(xml);
        const el = reader.ReadElement<XTestReaderElement>(node!);
        expect(el).not.toBeNull();
    });

    it("should handle ReadChildElements (Lines 553-561)", () => {
        const xml = `
            <XTestReaderElement>
                <XTestReaderElement Name="Child" />
            </XTestReaderElement>
        `;
        const node = reader.Parse(xml);
        const el = reader.ReadElement<XTestReaderElement>(node!);
        expect(el?.ChildNodes.length).toBe(1);
    });

    it("should return null in FindNode if segment not found (Line 578)", () => {
        reader.Parse("<Root><Child /></Root>");
        expect(reader.FindNode(["Root", "Missing"])).toBeNull();
    });

    it("should handle FindAllNodesRecursive with null node (Line 600)", () => {
        expect(reader.FindAllNodes("Tag", null as any)).toEqual([]);
    });

    it("should handle Clear (Lines 611-613)", () => {
        reader.Parse("<Root />");
        reader.Clear();
        expect(reader.Root).toBeNull();
    });
});