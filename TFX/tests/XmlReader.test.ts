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
    public static readonly PropThrowProp = XProperty.Register<XThrowElement, string>(p => "", XGuid.NewValue(), "PropThrowProp", "Prop Throw Prop", "");
    
    public override GetSerializableProperties(): XProperty[] {
        return [XThrowElement.PropError, XThrowElement.PropThrowProp];
    }
    
    public override SetValue(pProperty: XProperty, pValue: any): void {
        if (pProperty === XThrowElement.PropThrowProp && pValue === "ThrowOnSet") {
            throw new Error("SetValue intentional error");
        }
        super.SetValue(pProperty, pValue);
    }
}
XThrowElement.PropError.Default.AsAttribute = true;
// PropThrowProp is NOT AsAttribute, so it will go through Properties section

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

    it("should handle ApplyProperties with error in SetValue (Line 556)", () => {
        const xml = `
            <XThrowElement>
                <Properties>
                    <XData ID="${XThrowElement.PropThrowProp.ID}">ThrowOnSet</XData>
                </Properties>
            </XThrowElement>
        `;
        const node = reader.Parse(xml);
        reader.ReadElement(node!);
        expect(context.Errors.some(e => e.PropertyName === "PropThrowProp")).toBe(true);
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

    it("should handle malformed XML declaration without ending (Line 103-106)", () => {
        // When XML declaration lacks ?>, the parser doesn't skip it and parses from there
        const node = reader.Parse("<?xml version='1.0'<Root />");
        // Since there's no ?>, the declaration is NOT skipped and "?xml" becomes the tag
        expect(node?.TagName).toBe("?xml");
    });

    it("should handle missing > in element tag (Line 153-156)", () => {
        // The parser is lenient and parses "Root<End" as a single tag name
        const node = reader.Parse("<Root<End />");
        expect(node?.TagName).toBe("Root<End");
    });

    it("should handle StrictMode with mismatched end tag (Line 161-164)", () => {
        const strictReader = new XmlReader(context, { StrictMode: true });
        const node = strictReader.Parse("<Root></Wrong>");
        expect(node).toBeNull();
        expect(context.Errors.some(e => e.Message.includes("Mismatched end tag"))).toBe(true);
    });

    it("should handle StrictMode mismatch in ParseEndTag (Line 298-310)", () => {
        const strictReader = new XmlReader(context, { StrictMode: true });
        strictReader.Parse("<Root></Other>");
        expect(context.Errors.some(e => e.Message.includes("Mismatched end tag"))).toBe(true);
    });

    it("should handle mismatched end tag without StrictMode (Line 290-307)", () => {
        // When StrictMode is false (default), mismatched tags are tolerated
        const node = reader.Parse("<Root></Wrong>");
        expect(node).not.toBeNull();
        expect(node?.TagName).toBe("Root");
    });

    it("should handle end tag with trailing > (Line 306)", () => {
        // Normal case where end tag has >
        const node = reader.Parse("<Tag></Tag>");
        expect(node).not.toBeNull();
    });

    it("should handle end tag missing trailing > (Line 306 false branch)", () => {
        // End tag without >
        const node = reader.Parse("<Tag></Tag");
        expect(node).not.toBeNull();
    });

    it("should handle XData with default nullish values (Line 337-341)", () => {
        const xml = `<XData>SimpleValue</XData>`;
        const node = reader.Parse(xml);
        const data = reader.ReadXData(node!);
        expect(data?.Name).toBe("");
        expect(data?.TypeName).toBe("String");
    });

    it("should handle XLanguage children correctly (Line 347-353)", () => {
        const xml = `<XData Name="test" ID="${XGuid.NewValue()}">
            <XLanguage IETFCode="en">English</XLanguage>
            <XLanguage IETFCode="pt">Português</XLanguage>
            <Other>Ignored</Other>
        </XData>`;
        const node = reader.Parse(xml);
        const data = reader.ReadXData(node!);
        expect(data?.CultureValues.size).toBe(2);
    });

    it("should handle IgnoreUnknownElements=true (Line 477-488)", () => {
        const ignoreReader = new XmlReader(context, { IgnoreUnknownElements: true });
        const node = ignoreReader.Parse("<Unknown />");
        expect(ignoreReader.ReadElement(node!)).toBeNull();
        expect(context.Errors.length).toBe(0);
    });

    it("should handle IgnoreUnknownProperties=true (Line 546-557)", () => {
        const ignoreReader = new XmlReader(context, { IgnoreUnknownProperties: true });
        const xml = `
            <XTestReaderElement>
                <Properties>
                    <XData ID="UnknownPropID">Value</XData>
                </Properties>
            </XTestReaderElement>
        `;
        const node = ignoreReader.Parse(xml);
        ignoreReader.ReadElement(node!);
        expect(context.Errors.length).toBe(0);
    });

    it("should handle ReadChildElements with null child (Line 587-590)", () => {
        const ignoreReader = new XmlReader(context, { IgnoreUnknownElements: true });
        const xml = `
            <XTestReaderElement>
                <Properties />
                <UnknownChild />
            </XTestReaderElement>
        `;
        const node = ignoreReader.Parse(xml);
        const el = ignoreReader.ReadElement<XTestReaderElement>(node!);
        expect(el?.ChildNodes.length).toBe(0);
    });

    it("should handle FindNode with null current node (Line 612-621)", () => {
        const result = reader.FindNode(["Path"]);
        expect(result).toBeNull();
    });

    it("should handle XLinkedShape with all attributes (Line 405-409)", () => {
        const xml = `<XLinkedShape Side="1" X="5" Y="10" DesiredDegree="45">Value</XLinkedShape>`;
        const node = reader.Parse(xml);
        const result = reader.ReadXLinkedShape(node!);
        expect(result).not.toBeNull();
        expect(result?.Side).toBe(1);
        expect(result?.X).toBe(5);
        expect(result?.Y).toBe(10);
        expect(result?.DesiredDegree).toBe("45");
    });

    it("should handle ReadProperties with XData and XLinkData (Line 444-462)", () => {
        const xml = `
            <Root>
                <Properties>
                    <XData ID="${XGuid.NewValue()}">DataValue</XData>
                    <XLinkData ID="${XGuid.NewValue()}" ElementID="${XGuid.NewValue()}">LinkValue</XLinkData>
                    <Other>Ignored</Other>
                </Properties>
            </Root>
        `;
        const node = reader.Parse(xml);
        const props = reader.ReadProperties(node!);
        expect(props.size).toBe(2);
    });

    it("should return null when element tag lacks closing > (Line 152)", () => {
        // Element with attributes but missing > before end of input
        const node = reader.Parse("<Tag Attr='val'");
        expect(node).toBeNull();
    });
});