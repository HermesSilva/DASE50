import { describe, it, expect, beforeEach } from "vitest";
import { XGuid } from "../src/Core/XGuid.js";
import { XProperty } from "../src/Core/XProperty.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import {
    XSerializationContext,
    XSerializationDirection,
    XSerializationPhase,
    XDefaultSerializationOptions
} from "../src/Data/XSerializationContext.js";
import {
    XElementRegistry,
    RegisterElement
} from "../src/Data/XElementRegistry.js";
import {
    XTypeConverter,
    type XISize,
    type XIRect,
    type XIPoint,
    type XIColor
} from "../src/Data/XTypeConverter.js";
import { XmlWriter } from "../src/Data/XmlWriter.js";
import { XmlReader, type XIXmlNode } from "../src/Data/XmlReader.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";

class XTestElement extends XPersistableElement
{
    public static readonly TitleProp = XProperty.Register<XTestElement, string>(
        (p: XTestElement) => p.Title,
        "TEST0001-0001-0001-0001-000000000001",
        "Title",
        "Title",
        ""
    );

    public static readonly CountProp = XProperty.Register<XTestElement, number>(
        (p: XTestElement) => p.Count,
        "TEST0001-0001-0001-0001-000000000002",
        "Count",
        "Count",
        0
    );

    public static readonly IsActiveProp = XProperty.Register<XTestElement, boolean>(
        (p: XTestElement) => p.IsActive,
        "TEST0001-0001-0001-0001-000000000003",
        "IsActive",
        "Is Active",
        false
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

    public get Count(): number
    {
        return this.GetValue(XTestElement.CountProp) as number;
    }

    public set Count(pValue: number)
    {
        this.SetValue(XTestElement.CountProp, pValue);
    }

    public get IsActive(): boolean
    {
        return this.GetValue(XTestElement.IsActiveProp) as boolean;
    }

    public set IsActive(pValue: boolean)
    {
        this.SetValue(XTestElement.IsActiveProp, pValue);
    }
}

describe("XSerializationContext", () =>
{
    let context: XSerializationContext;

    beforeEach(() =>
    {
        context = new XSerializationContext(XSerializationDirection.Serialize);
    });

    it("should create context with default options", () =>
    {
        expect(context.Direction).toBe(XSerializationDirection.Serialize);
        expect(context.Options.Encoding).toBe("utf-8");
        expect(context.Options.Indent).toBe(true);
    });

    it("should track depth correctly", () =>
    {
        expect(context.CurrentDepth).toBe(0);
        context.IncrementDepth();
        expect(context.CurrentDepth).toBe(1);
        context.IncrementDepth();
        expect(context.CurrentDepth).toBe(2);
        context.DecrementDepth();
        expect(context.CurrentDepth).toBe(1);
    });

    it("should generate correct indent", () =>
    {
        expect(context.GetIndent()).toBe("");
        context.IncrementDepth();
        expect(context.GetIndent()).toBe("  ");
        context.IncrementDepth();
        expect(context.GetIndent()).toBe("    ");
    });

    it("should track pending references", () =>
    {
        context.AddPendingReference("source1", "prop1", "target1");
        expect(context.PendingReferences.length).toBe(1);
        expect(context.PendingReferences[0].SourceElementID).toBe("source1");
    });

    it("should track errors", () =>
    {
        expect(context.HasErrors).toBe(false);
        context.AddError(context.CreateError("elem1", "ElemName", "PropName", "Test error"));
        expect(context.HasErrors).toBe(true);
        expect(context.Errors.length).toBe(1);
    });
});

describe("XElementRegistry", () =>
{
    beforeEach(() =>
    {
        XElementRegistry.Instance.Clear();
    });

    it("should register and retrieve element metadata", () =>
    {
        XElementRegistry.Instance.Register({
            TagName: "XTestElement",
            Constructor: XTestElement,
            ClassID: "TEST-CLASS-ID"
        });

        const meta = XElementRegistry.Instance.GetByTagName("XTestElement");
        expect(meta).not.toBeNull();
        expect(meta?.TagName).toBe("XTestElement");
        expect(meta?.ClassID).toBe("TEST-CLASS-ID");
    });

    it("should create element instance", () =>
    {
        XElementRegistry.Instance.Register({
            TagName: "XTestElement",
            Constructor: XTestElement
        });

        const elem = XElementRegistry.Instance.CreateElement<XTestElement>("XTestElement");
        expect(elem).not.toBeNull();
        expect(elem).toBeInstanceOf(XTestElement);
    });

    it("should get tag name from element", () =>
    {
        XElementRegistry.Instance.Register({
            TagName: "XTestElement",
            Constructor: XTestElement
        });

        const elem = new XTestElement();
        const tagName = XElementRegistry.Instance.GetTagName(elem);
        expect(tagName).toBe("XTestElement");
    });
});

describe("XTypeConverter", () =>
{
    describe("String conversion", () =>
    {
        it("should convert string values", () =>
        {
            expect(XTypeConverter.ToString("hello", "String")).toBe("hello");
            expect(XTypeConverter.FromString<string>("world", "String")).toBe("world");
        });
    });

    describe("Guid conversion", () =>
    {
        it("should convert valid guid", () =>
        {
            const guid = "12345678-1234-1234-1234-123456789012";
            expect(XTypeConverter.FromString<string>(guid, "Guid")).toBe(guid.toUpperCase());
        });

        it("should return empty guid for invalid input", () =>
        {
            expect(XTypeConverter.FromString<string>("invalid", "Guid")).toBe(XGuid.EmptyValue);
        });
    });

    describe("Boolean conversion", () =>
    {
        it("should convert boolean values", () =>
        {
            expect(XTypeConverter.ToString(true, "Boolean")).toBe("true");
            expect(XTypeConverter.ToString(false, "Boolean")).toBe("false");
            expect(XTypeConverter.FromString<boolean>("true", "Boolean")).toBe(true);
            expect(XTypeConverter.FromString<boolean>("1", "Boolean")).toBe(true);
            expect(XTypeConverter.FromString<boolean>("false", "Boolean")).toBe(false);
        });
    });

    describe("Int32 conversion", () =>
    {
        it("should convert integer values", () =>
        {
            expect(XTypeConverter.ToString(42, "Int32")).toBe("42");
            expect(XTypeConverter.FromString<number>("42", "Int32")).toBe(42);
        });

        it("should truncate decimals", () =>
        {
            expect(XTypeConverter.ToString(42.9, "Int32")).toBe("42");
        });
    });

    describe("Size conversion", () =>
    {
        it("should convert size values", () =>
        {
            const size: XISize = { Width: 100, Height: 50 };
            const str = XTypeConverter.ToString(size, "Size");
            expect(str).toBe("{Width=100;Height=50}");

            const parsed = XTypeConverter.FromString<XISize>("{Width=100;Height=50}", "Size");
            expect(parsed.Width).toBe(100);
            expect(parsed.Height).toBe(50);
        });
    });

    describe("Rect conversion", () =>
    {
        it("should convert rect values", () =>
        {
            const rect: XIRect = { X: 10, Y: 20, Width: 100, Height: 50 };
            const str = XTypeConverter.ToString(rect, "Rect");
            expect(str).toBe("{X=10;Y=20;Width=100;Height=50}");

            const parsed = XTypeConverter.FromString<XIRect>("{X=10;Y=20;Width=100;Height=50}", "Rect");
            expect(parsed.X).toBe(10);
            expect(parsed.Y).toBe(20);
            expect(parsed.Width).toBe(100);
            expect(parsed.Height).toBe(50);
        });
    });

    describe("Color conversion", () =>
    {
        it("should convert color values", () =>
        {
            const color: XIColor = { A: 255, R: 128, G: 64, B: 32 };
            const str = XTypeConverter.ToString(color, "Color");
            expect(str).toBe("{A=255;R=128;G=64;B=32}");

            const parsed = XTypeConverter.FromString<XIColor>("{A=255;R=128;G=64;B=32}", "Color");
            expect(parsed.A).toBe(255);
            expect(parsed.R).toBe(128);
            expect(parsed.G).toBe(64);
            expect(parsed.B).toBe(32);
        });
    });

    describe("Point array conversion", () =>
    {
        it("should convert point array values", () =>
        {
            const points: XIPoint[] = [{ X: 10, Y: 20 }, { X: 30, Y: 40 }];
            const str = XTypeConverter.ToString(points, "Point[]");
            expect(str).toBe("{X=10;Y=20}|{X=30;Y=40}");

            const parsed = XTypeConverter.FromString<XIPoint[]>("{X=10;Y=20}|{X=30;Y=40}", "Point[]");
            expect(parsed.length).toBe(2);
            expect(parsed[0].X).toBe(10);
            expect(parsed[1].Y).toBe(40);
        });
    });

    describe("Type inference", () =>
    {
        it("should infer type from value", () =>
        {
            expect(XTypeConverter.InferTypeName("hello")).toBe("String");
            expect(XTypeConverter.InferTypeName(XGuid.NewValue())).toBe("Guid");
            expect(XTypeConverter.InferTypeName(true)).toBe("Boolean");
            expect(XTypeConverter.InferTypeName(42)).toBe("Int32");
            expect(XTypeConverter.InferTypeName(42.5)).toBe("Double");
            expect(XTypeConverter.InferTypeName({ Width: 10, Height: 20 })).toBe("Size");
            expect(XTypeConverter.InferTypeName({ X: 10, Y: 20, Width: 30, Height: 40 })).toBe("Rect");
            expect(XTypeConverter.InferTypeName({ A: 255, R: 0, G: 0, B: 0 })).toBe("Color");
        });
    });
});

describe("XmlWriter", () =>
{
    let context: XSerializationContext;
    let writer: XmlWriter;

    beforeEach(() =>
    {
        context = new XSerializationContext(XSerializationDirection.Serialize);
        writer = new XmlWriter(context);
    });

    it("should write XML declaration", () =>
    {
        writer.WriteDeclaration();
        const output = writer.GetOutput();
        expect(output).toContain('<?xml version="1.0" encoding="utf-8"?>');
    });

    it("should write simple element", () =>
    {
        writer.WriteElementWithText("Test", "Hello");
        const output = writer.GetOutput();
        expect(output).toContain("<Test>Hello</Test>");
    });

    it("should write element with attributes", () =>
    {
        writer.WriteElementWithText("Test", "Hello", [
            { Name: "ID", Value: "123" },
            { Name: "Name", Value: "Test Name" }
        ]);
        const output = writer.GetOutput();
        expect(output).toContain('ID="123"');
        expect(output).toContain('Name="Test Name"');
    });

    it("should write XData element", () =>
    {
        writer.WriteXData("Title", "PROP-ID", "String", "Test Value");
        const output = writer.GetOutput();
        expect(output).toContain('Name="Title"');
        expect(output).toContain('ID="PROP-ID"');
        expect(output).toContain('Type="String"');
        expect(output).toContain(">Test Value</XData>");
    });

    it("should escape special characters", () =>
    {
        writer.WriteElementWithText("Test", "<>&\"'");
        const output = writer.GetOutput();
        expect(output).toContain("&lt;&gt;&amp;");
    });

    it("should write nested elements", () =>
    {
        writer.WriteStartElement("Parent");
        writer.WriteElementWithText("Child", "Value");
        writer.WriteEndElement("Parent");
        const output = writer.GetOutput();
        expect(output).toContain("<Parent>");
        expect(output).toContain("<Child>Value</Child>");
        expect(output).toContain("</Parent>");
    });

    it("should write self-closing element", () =>
    {
        writer.WriteStartElement("Empty", [{ Name: "ID", Value: "test" }]);
        writer.WriteEndElement("Empty");
        const output = writer.GetOutput();
        expect(output).toContain('ID="test"');
        expect(output).toContain("/>");
    });
});

describe("XmlReader", () =>
{
    let context: XSerializationContext;
    let reader: XmlReader;

    beforeEach(() =>
    {
        context = new XSerializationContext(XSerializationDirection.Deserialize);
        reader = new XmlReader(context);
    });

    it("should parse simple XML", () =>
    {
        const xml = '<Test ID="123">Hello</Test>';
        const node = reader.Parse(xml);

        expect(node).not.toBeNull();
        expect(node?.TagName).toBe("Test");
        expect(node?.Attributes.get("ID")).toBe("123");
        expect(node?.TextContent).toBe("Hello");
    });

    it("should parse XML with declaration", () =>
    {
        const xml = '<?xml version="1.0" encoding="utf-8"?><Root></Root>';
        const node = reader.Parse(xml);

        expect(node).not.toBeNull();
        expect(node?.TagName).toBe("Root");
    });

    it("should parse nested elements", () =>
    {
        const xml = '<Parent><Child1>A</Child1><Child2>B</Child2></Parent>';
        const node = reader.Parse(xml);

        expect(node?.ChildNodes.length).toBe(2);
        expect(node?.ChildNodes[0].TagName).toBe("Child1");
        expect(node?.ChildNodes[0].TextContent).toBe("A");
        expect(node?.ChildNodes[1].TagName).toBe("Child2");
    });

    it("should parse self-closing elements", () =>
    {
        const xml = '<Parent><Empty ID="1" /><Empty ID="2" /></Parent>';
        const node = reader.Parse(xml);

        expect(node?.ChildNodes.length).toBe(2);
        expect(node?.ChildNodes[0].Attributes.get("ID")).toBe("1");
        expect(node?.ChildNodes[1].Attributes.get("ID")).toBe("2");
    });

    it("should unescape special characters", () =>
    {
        const xml = "<Test>&lt;&gt;&amp;&quot;&apos;</Test>";
        const node = reader.Parse(xml);

        expect(node?.TextContent).toBe("<>&\"'");
    });

    it("should read XData node", () =>
    {
        const xml = '<XData Name="Title" ID="PROP-ID" Type="String">Test Value</XData>';
        const node = reader.Parse(xml);
        const data = reader.ReadXData(node!);

        expect(data).not.toBeNull();
        expect(data?.Name).toBe("Title");
        expect(data?.ID).toBe("PROP-ID");
        expect(data?.TypeName).toBe("String");
        expect(data?.Value).toBe("Test Value");
    });

    it("should read XData with language content", () =>
    {
        const xml = `
            <XData Name="Title" ID="PROP-ID" Type="String">
                <XLanguage IETFCode="pt-br" IsDefault="true">Título em Português</XLanguage>
                <XLanguage IETFCode="en-us" IsDefault="false">Title in English</XLanguage>
            </XData>
        `;
        const node = reader.Parse(xml);
        const data = reader.ReadXData(node!);

        expect(data?.CultureValues.size).toBe(2);
        expect(data?.CultureValues.get("pt-br")).toBe("Título em Português");
        expect(data?.CultureValues.get("en-us")).toBe("Title in English");
    });

    it("should find nodes by path", () =>
    {
        const xml = '<Root><Level1><Level2><Target>Found</Target></Level2></Level1></Root>';
        reader.Parse(xml);
        const node = reader.FindNode(["Level1", "Level2", "Target"]);

        expect(node?.TextContent).toBe("Found");
    });

    it("should find all nodes by tag name", () =>
    {
        const xml = '<Root><Item ID="1"/><Group><Item ID="2"/></Group><Item ID="3"/></Root>';
        reader.Parse(xml);
        const nodes = reader.FindAllNodes("Item");

        expect(nodes.length).toBe(3);
    });
});

describe("XSerializationEngine", () =>
{
    beforeEach(() =>
    {
        XElementRegistry.Instance.Clear();
        XElementRegistry.Instance.Register({
            TagName: "XTestElement",
            Constructor: XTestElement
        });
    });

    it("should serialize element to XML", () =>
    {
        const elem = new XTestElement();
        elem.ID = XGuid.NewValue();
        elem.Name = "TestName";
        elem.Title = "Test Title";
        elem.Count = 42;
        elem.IsActive = true;

        const result = XSerializationEngine.Instance.Serialize(elem);

        expect(result.Success).toBe(true);
        expect(result.Data).not.toBeNull();
        expect(result.XmlOutput).toContain('<?xml version="1.0"');
        expect(result.XmlOutput).toContain("XTestElement");
        expect(result.XmlOutput).toContain('Name="TestName"');
    });

    it("should deserialize XML to element", () =>
    {
        const xml = `
            <?xml version="1.0" encoding="utf-8"?>
            <XTestElement ID="12345678-1234-1234-1234-123456789012" Name="TestName">
                <Properties>
                    <XData Name="Title" ID="TEST0001-0001-0001-0001-000000000001" Type="String">Deserialized Title</XData>
                    <XData Name="Count" ID="TEST0001-0001-0001-0001-000000000002" Type="Int32">99</XData>
                    <XData Name="IsActive" ID="TEST0001-0001-0001-0001-000000000003" Type="Boolean">true</XData>
                </Properties>
            </XTestElement>
        `;

        const result = XSerializationEngine.Instance.Deserialize<XTestElement>(xml);

        expect(result.Success).toBe(true);
        expect(result.Data).not.toBeNull();
        expect(result.Data?.Name).toBe("TestName");
        expect(result.Data?.Title).toBe("Deserialized Title");
        expect(result.Data?.Count).toBe(99);
        expect(result.Data?.IsActive).toBe(true);
    });

    it("should validate XML", () =>
    {
        const validXml = '<XTestElement ID="123" Name="Test"></XTestElement>';
        const result = XSerializationEngine.Instance.ValidateXml(validXml);

        expect(result.Success).toBe(true);
        expect(result.Data).toBe(true);
    });

    it("should report validation errors for unknown elements", () =>
    {
        XElementRegistry.Instance.Clear();
        const xml = '<UnknownElement ID="123"></UnknownElement>';
        const result = XSerializationEngine.Instance.ValidateXml(xml);

        expect(result.Errors.length).toBeGreaterThan(0);
    });

    it("should handle hooks", () =>
    {
        let beforeCalled = false;
        let afterCalled = false;

        XSerializationEngine.Instance.RegisterHook("test", {
            BeforeSerialize: () => { beforeCalled = true; },
            AfterSerialize: () => { afterCalled = true; }
        });

        const elem = new XTestElement();
        elem.ID = XGuid.NewValue();
        elem.Name = "Test";

        XSerializationEngine.Instance.Serialize(elem);

        expect(beforeCalled).toBe(true);
        expect(afterCalled).toBe(true);

        XSerializationEngine.Instance.UnregisterHook("test");
    });

    it("should serialize document with module info", () =>
    {
        const elem = new XTestElement();
        elem.ID = XGuid.NewValue();
        elem.Name = "DocumentElement";
        elem.Title = "Doc Title";

        const moduleID = XGuid.NewValue();
        const result = XSerializationEngine.Instance.SerializeToDocument(elem, "TestDocument", moduleID);

        expect(result.Success).toBe(true);
        expect(result.XmlOutput).toContain('Name="TestDocument"');
        expect(result.XmlOutput).toContain(`ModuleID="${moduleID}"`);
    });
});

describe("Integration: Full Round-Trip", () =>
{
    beforeEach(() =>
    {
        XElementRegistry.Instance.Clear();
        XElementRegistry.Instance.Register({
            TagName: "XTestElement",
            Constructor: XTestElement
        });
    });

    it("should serialize and deserialize element maintaining data integrity", () =>
    {
        const original = new XTestElement();
        original.ID = "11111111-2222-3333-4444-555555555555";
        original.Name = "OriginalElement";
        original.Title = "Original Title Value";
        original.Count = 12345;
        original.IsActive = true;

        const serialized = XSerializationEngine.Instance.Serialize(original);
        expect(serialized.Success).toBe(true);

        const deserialized = XSerializationEngine.Instance.Deserialize<XTestElement>(serialized.XmlOutput!);
        expect(deserialized.Success).toBe(true);

        expect(deserialized.Data?.ID).toBe(original.ID);
        expect(deserialized.Data?.Name).toBe(original.Name);
        expect(deserialized.Data?.Title).toBe(original.Title);
        expect(deserialized.Data?.Count).toBe(original.Count);
        expect(deserialized.Data?.IsActive).toBe(original.IsActive);
    });
});
