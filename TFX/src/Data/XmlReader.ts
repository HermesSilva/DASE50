import { XGuid } from "../Core/XGuid.js";
import { XProperty } from "../Core/XProperty.js";
import type { XPersistableElement } from "../Core/XPersistableElement.js";
import { XSerializationContext, XSerializationPhase, type XISerializationError } from "./XSerializationContext.js";
import { XElementRegistry } from "./XElementRegistry.js";
import { XTypeConverter, type XDataTypeName } from "./XTypeConverter.js";

export interface XIXmlNode
{
    TagName: string;
    Attributes: Map<string, string>;
    ChildNodes: XIXmlNode[];
    TextContent: string;
    Parent: XIXmlNode | null;
}

export interface XIXmlReaderOptions
{
    StrictMode: boolean;
    IgnoreUnknownElements: boolean;
    IgnoreUnknownAttributes: boolean;
    IgnoreUnknownProperties: boolean;
}

export const XDefaultXmlReaderOptions: XIXmlReaderOptions =
{
    StrictMode: false,
    IgnoreUnknownElements: true,
    IgnoreUnknownAttributes: true,
    IgnoreUnknownProperties: true
};

export interface XIXDataValue
{
    Name: string;
    ID: string;
    TypeName: XDataTypeName;
    Value: unknown;
    StringValue: string;
    CultureValues: Map<string, string>;
}

export interface XIXLinkDataValue extends XIXDataValue
{
    ElementID: string;
    Text: string;
    DocumentID: string;
    DocumentName: string;
    ModuleID: string;
    ModuleName: string;
    DataEx: string;
}

export interface XIXLinkedShapeValue extends XIXLinkDataValue
{
    Side: number;
    X: number;
    Y: number;
    DesiredDegree: string;
}

export class XmlReader
{
    private readonly _Context: XSerializationContext;
    private readonly _Options: XIXmlReaderOptions;
    private _Root: XIXmlNode | null = null;
    private _Position: number = 0;
    private _Input: string = "";

    public constructor(pContext: XSerializationContext, pOptions?: Partial<XIXmlReaderOptions>)
    {
        this._Context = pContext;
        this._Options = { ...XDefaultXmlReaderOptions, ...pOptions };
    }

    public get Context(): XSerializationContext
    {
        return this._Context;
    }

    public get Root(): XIXmlNode | null
    {
        return this._Root;
    }

    public Parse(pXml: string): XIXmlNode | null
    {
        this._Input = pXml.trim();
        this._Position = 0;
        this._Root = null;

        this.SkipDeclaration();
        this._Root = this.ParseElement(null);
        return this._Root;
    }

    private SkipDeclaration(): void
    {
        this.SkipWhitespace();
        if (this._Input.substring(this._Position, this._Position + 5) === "<?xml")
        {
            const end = this._Input.indexOf("?>", this._Position);
            if (end !== -1)
                this._Position = end + 2;
        }
        this.SkipWhitespace();
    }

    private SkipWhitespace(): void
    {
        while (this._Position < this._Input.length && /\s/.test(this._Input[this._Position]))
            this._Position++;
    }

    private ParseElement(pParent: XIXmlNode | null): XIXmlNode | null
    {
        this.SkipWhitespace();

        if (this._Position >= this._Input.length)
            return null;

        if (this._Input[this._Position] !== "<")
            return null;

        if (this._Input[this._Position + 1] === "/")
            return null;

        this._Position++;

        const tagName = this.ParseTagName();
        if (!tagName)
            return null;

        const node: XIXmlNode = {
            TagName: tagName,
            Attributes: new Map(),
            ChildNodes: [],
            TextContent: "",
            Parent: pParent
        };

        this.ParseAttributes(node);
        this.SkipWhitespace();

        if (this._Input[this._Position] === "/" && this._Input[this._Position + 1] === ">")
        {
            this._Position += 2;
            return node;
        }

        if (this._Input[this._Position] !== ">")
            return null;

        this._Position++;

        this.ParseContent(node);
        if (!this.ParseEndTag(tagName) && this._Options.StrictMode)
            return null;

        return node;
    }

    private ParseTagName(): string
    {
        let name = "";
        while (this._Position < this._Input.length)
        {
            const ch = this._Input[this._Position];
            if (/[\s/>]/.test(ch))
                break;
            name += ch;
            this._Position++;
        }
        return name;
    }

    private ParseAttributes(pNode: XIXmlNode): void
    {
        while (this._Position < this._Input.length)
        {
            this.SkipWhitespace();

            const ch = this._Input[this._Position];
            if (ch === ">" || ch === "/")
                break;

            const attrName = this.ParseAttributeName();
            if (!attrName)
                break;

            this.SkipWhitespace();
            if (this._Input[this._Position] !== "=")
                continue;

            this._Position++;
            this.SkipWhitespace();

            const attrValue = this.ParseAttributeValue();
            pNode.Attributes.set(attrName, attrValue);
        }
    }

    private ParseAttributeName(): string
    {
        let name = "";
        while (this._Position < this._Input.length)
        {
            const ch = this._Input[this._Position];
            if (/[\s=/>]/.test(ch))
                break;
            name += ch;
            this._Position++;
        }
        return name;
    }

    private ParseAttributeValue(): string
    {
        const quote = this._Input[this._Position];
        if (quote !== '"' && quote !== "'")
            return "";

        this._Position++;
        let value = "";

        while (this._Position < this._Input.length)
        {
            const ch = this._Input[this._Position];
            if (ch === quote)
            {
                this._Position++;
                break;
            }
            value += ch;
            this._Position++;
        }

        return this.UnescapeText(value);
    }

    private ParseContent(pNode: XIXmlNode): void
    {
        let textContent = "";
        let hasChildElements = false;

        while (this._Position < this._Input.length)
        {
            if (this._Input[this._Position] === "<")
            {
                if (this._Input[this._Position + 1] === "/")
                    break;

                if (textContent && !hasChildElements)
                {
                    const trimmed = this.UnescapeText(textContent);
                    pNode.TextContent = trimmed;
                }

                textContent = "";
                hasChildElements = true;

                const child = this.ParseElement(pNode);
                if (child)
                    pNode.ChildNodes.push(child);
            }
            else
            {
                textContent += this._Input[this._Position];
                this._Position++;
            }
        }

        if (textContent && !hasChildElements)
        {
            const trimmed = this.UnescapeText(textContent.trim());
            pNode.TextContent = trimmed;
        }
    }

    private ParseEndTag(pExpectedTag: string): boolean
    {
        this.SkipWhitespace();

        if (this._Input.substring(this._Position, this._Position + 2) !== "</")
            return false;

        this._Position += 2;
        const tagName = this.ParseTagName();

        if (tagName !== pExpectedTag)
        {
            if (this._Options.StrictMode)
            {
                this._Context.AddError({
                    ElementID: "",
                    ElementName: pExpectedTag,
                    PropertyName: "",
                    Message: `Mismatched end tag: expected </${pExpectedTag}>, found </${tagName}>`,
                    Phase: this._Context.Phase
                });
                return false;
            }
        }

        this.SkipWhitespace();
        if (this._Input[this._Position] === ">")
            this._Position++;

        return true;
    }

    private UnescapeText(pValue: string): string
    {
        return pValue
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    }

    public ReadXData(pNode: XIXmlNode): XIXDataValue | null
    {
        if (pNode.TagName !== "XData")
            return null;

        const name = pNode.Attributes.get("Name") ?? "";
        const id = pNode.Attributes.get("ID") ?? XGuid.EmptyValue;
        const typeName = (pNode.Attributes.get("Type") ?? "String") as XDataTypeName;

        const cultures = new Map<string, string>();

        for (const child of pNode.ChildNodes)
        {
            if (child.TagName === "XLanguage")
            {
                const code = child.Attributes.get("IETFCode") ?? "";
                cultures.set(code, child.TextContent);
            }
        }

        let stringValue = pNode.TextContent;
        if (cultures.size > 0)
        {
            const defaultCulture = this._Context.Options.CultureCode;
            stringValue = cultures.get(defaultCulture) ?? stringValue;
        }

        const value = XTypeConverter.FromString(stringValue, typeName);

        return {
            Name: name,
            ID: id,
            TypeName: typeName,
            Value: value,
            StringValue: stringValue,
            CultureValues: cultures
        };
    }

    public ReadXLinkData(pNode: XIXmlNode): XIXLinkDataValue | null
    {
        if (pNode.TagName !== "XLinkData")
            return null;

        const name = pNode.Attributes.get("Name") ?? "";
        const id = pNode.Attributes.get("ID") ?? XGuid.EmptyValue;
        const typeName = (pNode.Attributes.get("Type") ?? "Guid") as XDataTypeName;
        const elementID = pNode.Attributes.get("ElementID") ?? XGuid.EmptyValue;
        const text = pNode.Attributes.get("Text") ?? "";
        const documentID = pNode.Attributes.get("DocumentID") ?? XGuid.EmptyValue;
        const documentName = pNode.Attributes.get("DocumentName") ?? "";
        const moduleID = pNode.Attributes.get("ModuleID") ?? XGuid.EmptyValue;
        const moduleName = pNode.Attributes.get("ModuleName") ?? "";
        const dataEx = pNode.Attributes.get("DataEx") ?? "";

        const stringValue = pNode.TextContent;
        const value = XTypeConverter.FromString(stringValue, typeName);

        return {
            Name: name,
            ID: id,
            TypeName: typeName,
            Value: value,
            StringValue: stringValue,
            CultureValues: new Map(),
            ElementID: elementID,
            Text: text,
            DocumentID: documentID,
            DocumentName: documentName,
            ModuleID: moduleID,
            ModuleName: moduleName,
            DataEx: dataEx
        };
    }

    public ReadXLinkedShape(pNode: XIXmlNode): XIXLinkedShapeValue | null
    {
        if (pNode.TagName !== "XLinkedShape")
            return null;

        const linkData = this.ReadXLinkData({ ...pNode, TagName: "XLinkData" } as XIXmlNode);
        if (!linkData)
            return null;

        return {
            ...linkData,
            Side: parseInt(pNode.Attributes.get("Side") ?? "0", 10),
            X: parseFloat(pNode.Attributes.get("X") ?? "0"),
            Y: parseFloat(pNode.Attributes.get("Y") ?? "0"),
            DesiredDegree: pNode.Attributes.get("DesiredDegree") ?? ""
        };
    }

    public ReadProperties(pNode: XIXmlNode): Map<string, XIXDataValue | XIXLinkDataValue>
    {
        const result = new Map<string, XIXDataValue | XIXLinkDataValue>();

        const propsNode = pNode.ChildNodes.find(n => n.TagName === "Properties");
        if (!propsNode)
            return result;

        for (const child of propsNode.ChildNodes)
        {
            if (child.TagName === "XData")
            {
                const data = this.ReadXData(child);
                if (data)
                    result.set(data.ID, data);
            }
            else if (child.TagName === "XLinkData")
            {
                const data = this.ReadXLinkData(child);
                if (data)
                    result.set(data.ID, data);
            }
            else if (child.TagName === "XLinkedShape")
            {
                const data = this.ReadXLinkedShape(child);
                if (data)
                    result.set(data.ID, data);
            }
        }

        return result;
    }

    public ReadElement<T extends XPersistableElement>(pNode: XIXmlNode): T | null
    {
        this._Context.Phase = XSerializationPhase.BeforeDeserialize;

        const tagName = pNode.TagName;
        const element = XElementRegistry.Instance.CreateElement<T>(tagName);

        if (!element)
        {
            if (!this._Options.IgnoreUnknownElements)
            {
                this._Context.AddError({
                    ElementID: pNode.Attributes.get("ID") ?? "",
                    ElementName: tagName,
                    PropertyName: "",
                    Message: `Unknown element type: ${tagName}`,
                    Phase: this._Context.Phase
                });
            }
            return null;
        }

        const id = pNode.Attributes.get("ID");
        if (id)
            element.ID = id;

        const name = pNode.Attributes.get("Name");
        if (name)
            element.Name = name;

        this.ApplyAttributes(element, pNode);
        this.ApplyProperties(element, pNode);
        this.ReadChildElements(element, pNode);

        this._Context.RegisterElement(element);
        element.Initialize();
        this._Context.Phase = XSerializationPhase.AfterDeserialize;

        return element;
    }

    private ApplyAttributes(pElement: XPersistableElement, pNode: XIXmlNode): void
    {
        const props = pElement.GetSerializableProperties();

        for (const prop of props)
        {
            if (!prop.Default.AsAttribute)
                continue;

            const attrValue = pNode.Attributes.get(prop.Name);
            if (attrValue === undefined)
                continue;

            try
            {
                const typeName = XTypeConverter.InferTypeName(prop.Default.DefaultValue);
                const value = XTypeConverter.FromString(attrValue, typeName);
                pElement.SetValue(prop, value);
            }
            catch (error)
            {
                this.AddPropertyError(pElement, prop, error as Error);
            }
        }
    }

    private ApplyProperties(pElement: XPersistableElement, pNode: XIXmlNode): void
    {
        const propsData = this.ReadProperties(pNode);

        for (const [propID, dataValue] of propsData)
        {
            const prop = XProperty.TryGet(propID);
            if (!prop)
            {
                if (!this._Options.IgnoreUnknownProperties)
                {
                    this._Context.AddError({
                        ElementID: pElement.ID,
                        ElementName: pElement.Name,
                        PropertyName: propID,
                        Message: `Unknown property ID: ${propID}`,
                        Phase: this._Context.Phase
                    });
                }
                continue;
            }

            try
            {
                if ("ElementID" in dataValue)
                {
                    const linkValue = dataValue as XIXLinkDataValue;
                    this._Context.AddPendingReference(pElement.ID, prop.ID, linkValue.ElementID);
                    pElement.SetValue(prop, linkValue.Value);
                }
                else
                    pElement.SetValue(prop, dataValue.Value);
            }
            catch (error)
            {
                this.AddPropertyError(pElement, prop, error as Error);
            }
        }
    }

    private ReadChildElements(pElement: XPersistableElement, pNode: XIXmlNode): void
    {
        for (const childNode of pNode.ChildNodes)
        {
            if (childNode.TagName === "Properties")
                continue;

            const childElement = this.ReadElement(childNode);
            if (childElement)
                pElement.ChildNodes.push(childElement as unknown as typeof pElement.ChildNodes[0]);
        }
    }

    private AddPropertyError(pElement: XPersistableElement, pProperty: XProperty, pError: Error): void
    {
        this._Context.AddError({
            ElementID: pElement.ID,
            ElementName: pElement.Name,
            PropertyName: pProperty.Name,
            Message: `Failed to set property: ${pError.message}`,
            Phase: this._Context.Phase,
            InnerError: pError
        });
    }

    public FindNode(pPath: string[], pStartNode?: XIXmlNode): XIXmlNode | null
    {
        let current = pStartNode ?? this._Root;

        for (const segment of pPath)
        {
            if (!current)
                return null;

            const child = current.ChildNodes.find(n => n.TagName === segment);
            if (!child)
                return null;

            current = child;
        }

        return current;
    }

    public FindAllNodes(pTagName: string, pStartNode?: XIXmlNode): XIXmlNode[]
    {
        const result: XIXmlNode[] = [];
        this.FindAllNodesRecursive(pTagName, pStartNode ?? this._Root, result);
        return result;
    }

    private FindAllNodesRecursive(pTagName: string, pNode: XIXmlNode | null, pResult: XIXmlNode[]): void
    {
        if (!pNode)
            return;

        if (pNode.TagName === pTagName)
            pResult.push(pNode);

        for (const child of pNode.ChildNodes)
            this.FindAllNodesRecursive(pTagName, child, pResult);
    }

    public Clear(): void
    {
        this._Root = null;
        this._Position = 0;
        this._Input = "";
    }
}
