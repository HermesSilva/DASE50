import { describe, it, expect, beforeEach } from "vitest";
import { XmlWriter } from "../src/Data/XmlWriter.js";
import { XSerializationContext, XSerializationDirection } from "../src/Data/XSerializationContext.js";
import { XElementRegistry } from "../src/Data/XElementRegistry.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XProperty } from "../src/Core/XProperty.js";
import { XPropertyGroup } from "../src/Core/XEnums.js";
import { XGuid } from "../src/Core/XGuid.js";

class XWriterTestElement extends XPersistableElement {
    public static readonly AttrProp = XProperty.Register<XWriterTestElement, string>(p => "", XGuid.NewValue(), "AttrProp", "Attr Prop", "");
    public static readonly DesignProp = XProperty.Register<XWriterTestElement, string>(p => "", XGuid.NewValue(), "DesignProp", "Design Prop", "");
    public static readonly CultureProp = XProperty.Register<XWriterTestElement, string>(p => "", XGuid.NewValue(), "CultureProp", "Culture Prop", "");
    public static readonly LinkProp = XProperty.Register<XWriterTestElement, string>(p => XGuid.EmptyValue, XGuid.NewValue(), "LinkProp", "Link Prop", XGuid.EmptyValue);
    public static readonly ThrowProp = XProperty.Register<XWriterTestElement, string>(p => "", XGuid.NewValue(), "ThrowProp", "Throw Prop", "");
    public static readonly AttrNotRegistered = XProperty.Register<XWriterTestElement, string>(p => "", XGuid.NewValue(), "AttrNotRegistered", "Attr Not Registered", "");
    
    public override GetSerializableProperties(): XProperty[] {
        return [
            XWriterTestElement.AttrProp,
            XWriterTestElement.DesignProp,
            XWriterTestElement.CultureProp,
            XWriterTestElement.LinkProp,
            XWriterTestElement.ThrowProp,
            XWriterTestElement.AttrNotRegistered
        ];
    }

    public override GetValue(pProperty: XProperty): unknown {
        if (pProperty === XWriterTestElement.ThrowProp)
            throw new Error("GetValue error");
        return super.GetValue(pProperty);
    }
}
XWriterTestElement.AttrProp.Default.AsAttribute = true;
XWriterTestElement.DesignProp.Default.Group = XPropertyGroup.Design;
XWriterTestElement.CultureProp.Default.CultureSensitive = true;
XWriterTestElement.LinkProp.Default.IsLinked = true;
XWriterTestElement.AttrNotRegistered.Default.AsAttribute = true; // AsAttribute but NOT registered

describe("XmlWriter", () => {
    let context: XSerializationContext;
    let writer: XmlWriter;

    beforeEach(() => {
        context = new XSerializationContext(XSerializationDirection.Serialize);
        writer = new XmlWriter(context);
        XElementRegistry.Instance.Register({ TagName: "XWriterTestElement", Constructor: XWriterTestElement });
        XElementRegistry.Instance.RegisterProperty("XWriterTestElement", XWriterTestElement.AttrProp, true);
    });

    it("should access Context getter (Line 43)", () => {
        expect(writer.Context).toBe(context);
    });

    it("should skip declaration if option is false (Line 49)", () => {
        const writerNoDecl = new XmlWriter(context, { WriteDeclaration: false });
        writerNoDecl.WriteDeclaration();
        expect(writerNoDecl.GetOutput()).toBe("");
    });

    it("should ignore WriteAttribute if no tag is open (Line 76)", () => {
        writer.WriteAttribute("Some", "Value");
        expect(writer.GetOutput()).toBe("");
    });

    it("should handle property serialization exclusions (Lines 257-272)", () => {
        const el = new XWriterTestElement();
        el.SetValue(XWriterTestElement.DesignProp, "DesignValue");
        
        writer.WriteElement(el);
        const output = writer.GetOutput();
        expect(output).not.toContain("DesignProp");
    });

    it("should handle linked property serialization (Lines 325-330)", () => {
        const el = new XWriterTestElement();
        const targetID = XGuid.NewValue();
        el.SetValue(XWriterTestElement.LinkProp, targetID);
        
        writer.WriteElement(el);
        // Linked properties are tracked in context and not written as XData
        expect(writer.GetOutput()).not.toContain("LinkProp");
    });

    it("should handle culture sensitive property serialization (Lines 336-337)", () => {
        const el = new XWriterTestElement();
        el.SetValue(XWriterTestElement.CultureProp, "LocalizedValue");
        
        writer.WriteElement(el);
        const output = writer.GetOutput();
        expect(output).toContain("LocalizedValue");
        expect(output).toContain("XLanguage");
    });

    it("should handle attribute property serialization (Lines 376-385)", () => {
        const el = new XWriterTestElement();
        el.SetValue(XWriterTestElement.AttrProp, "AttrValue");
        
        writer.WriteElement(el);
        const output = writer.GetOutput();
        expect(output).toContain('AttrProp="AttrValue"');
    });

    it("should handle child element serialization safety check (Lines 396-398)", () => {
        const el = new XWriterTestElement();
        el.ChildNodes.push({} as any); // Not a XPersistableElement
        
        expect(() => writer.WriteElement(el)).not.toThrow();
    });

    it("should handle CloseOpenTag without newline (Line 418)", () => {
        writer.WriteStartElement("Tag");
        (writer as any).CloseOpenTag(false);
        expect(writer.GetOutput()).toBe("<Tag>");
    });

    it("should escape single quotes in attributes (Line 433)", () => {
        writer.WriteStartElement("Tag", [{ Name: "A", Value: "Quote's" }]);
        expect(writer.GetOutput()).toContain("A=\"Quote&apos;s\"");
    });

    it("should Clear the buffer (Lines 450-452)", () => {
        writer.WriteStartElement("Tag");
        writer.Clear();
        expect(writer.GetOutput()).toBe("");
    });

    it("should handle GetValue throwing exception (Line 272)", () => {
        const el = new XWriterTestElement();
        // ThrowProp will throw when GetValue is called, but should be caught and continue
        expect(() => writer.WriteElement(el)).not.toThrow();
    });
});