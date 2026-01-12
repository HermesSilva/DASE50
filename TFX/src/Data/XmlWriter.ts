import { XGuid } from "../Core/XGuid.js";
import { XProperty } from "../Core/XProperty.js";
import { XPropertyGroup } from "../Core/XEnums.js";
import type { XPersistableElement } from "../Core/XPersistableElement.js";
import { XSerializationContext, XSerializationPhase } from "./XSerializationContext.js";
import { XElementRegistry } from "./XElementRegistry.js";
import { XTypeConverter, type XDataTypeName } from "./XTypeConverter.js";

export interface XIXmlAttribute
{
    Name: string;
    Value: string;
}

export interface XIXmlWriterOptions
{
    WriteDeclaration: boolean;
    XmlVersion: string;
}

export const XDefaultXmlWriterOptions: XIXmlWriterOptions =
{
    WriteDeclaration: true,
    XmlVersion: "1.0"
};

export class XmlWriter
{
    private readonly _Context: XSerializationContext;
    private readonly _Options: XIXmlWriterOptions;
    private readonly _Buffer: string[] = [];
    private _HasOpenTag: boolean = false;
    private _CurrentTagName: string = "";

    public constructor(pContext: XSerializationContext, pOptions?: Partial<XIXmlWriterOptions>)
    {
        this._Context = pContext;
        this._Options = { ...XDefaultXmlWriterOptions, ...pOptions };
    }

    public get Context(): XSerializationContext
    {
        return this._Context;
    }

    public WriteDeclaration(): void
    {
        if (!this._Options.WriteDeclaration)
            return;

        this._Buffer.push(`<?xml version="${this._Options.XmlVersion}" encoding="${this._Context.Options.Encoding}"?>`);
        this._Buffer.push(this._Context.GetNewLine());
    }

    public WriteStartElement(pTagName: string, pAttributes?: XIXmlAttribute[]): void
    {
        this.CloseOpenTag(false);

        this._Buffer.push(this._Context.GetIndent());
        this._Buffer.push(`<${pTagName}`);

        if (pAttributes)
        {
            for (const attr of pAttributes)
                this._Buffer.push(` ${attr.Name}="${this.EscapeAttribute(attr.Value)}"`);
        }

        this._HasOpenTag = true;
        this._CurrentTagName = pTagName;
        this._Context.IncrementDepth();
    }

    public WriteAttribute(pName: string, pValue: string): void
    {
        if (!this._HasOpenTag)
            return;

        this._Buffer.push(` ${pName}="${this.EscapeAttribute(pValue)}"`);
    }

    public WriteEndElement(pTagName: string): void
    {
        this._Context.DecrementDepth();

        if (this._HasOpenTag && this._CurrentTagName === pTagName)
        {
            this._Buffer.push(" />");
            this._Buffer.push(this._Context.GetNewLine());
            this._HasOpenTag = false;
            this._CurrentTagName = "";
            return;
        }

        this.CloseOpenTag(true);
        this._Buffer.push(this._Context.GetIndent());
        this._Buffer.push(`</${pTagName}>`);
        this._Buffer.push(this._Context.GetNewLine());
    }

    public WriteElementWithText(pTagName: string, pText: string, pAttributes?: XIXmlAttribute[]): void
    {
        this.CloseOpenTag(false);

        this._Buffer.push(this._Context.GetIndent());
        this._Buffer.push(`<${pTagName}`);

        if (pAttributes)
        {
            for (const attr of pAttributes)
                this._Buffer.push(` ${attr.Name}="${this.EscapeAttribute(attr.Value)}"`);
        }

        this._Buffer.push(">");
        this._Buffer.push(this.EscapeText(pText));
        this._Buffer.push(`</${pTagName}>`);
        this._Buffer.push(this._Context.GetNewLine());
    }

    public WriteXData(
        pName: string,
        pID: string,
        pTypeName: XDataTypeName,
        pValue: unknown,
        pCultureContent?: Map<string, string>
    ): void
    {
        const valueStr = XTypeConverter.ToString(pValue, pTypeName);

        const attrs: XIXmlAttribute[] = [
            { Name: "Name", Value: pName },
            { Name: "ID", Value: pID },
            { Name: "Type", Value: pTypeName }
        ];

        if (pCultureContent && pCultureContent.size > 0)
        {
            this.WriteStartElement("XData", attrs);
            this.CloseOpenTag(true);

            for (const [culture, text] of pCultureContent)
            {
                const isDefault = culture === this._Context.Options.CultureCode;
                const textStr = XTypeConverter.ToString(text, "String");
                
                this.WriteElementWithText("XLanguage", textStr, [
                    { Name: "IETFCode", Value: culture },
                    { Name: "IsDefault", Value: isDefault.toString() }
                ]);
            }

            this.WriteEndElement("XData");
        }
        else
            this.WriteElementWithText("XData", valueStr, attrs);
    }

    public WriteXLinkData(
        pName: string,
        pID: string,
        pTypeName: XDataTypeName,
        pElementID: string,
        pText: string,
        pDocumentID: string,
        pDocumentName: string,
        pModuleID: string,
        pModuleName: string,
        pValue: unknown,
        pDataEx?: string
    ): void
    {
        const valueStr = XTypeConverter.ToString(pValue, pTypeName);

        const attrs: XIXmlAttribute[] = [
            { Name: "Name", Value: pName },
            { Name: "ID", Value: pID },
            { Name: "Type", Value: pTypeName },
            { Name: "ElementID", Value: pElementID },
            { Name: "Text", Value: pText },
            { Name: "DocumentID", Value: pDocumentID },
            { Name: "DocumentName", Value: pDocumentName },
            { Name: "ModuleID", Value: pModuleID },
            { Name: "ModuleName", Value: pModuleName },
            { Name: "DataEx", Value: pDataEx ?? "" }
        ];

        this.WriteElementWithText("XLinkData", valueStr, attrs);
    }

    public WriteXLinkedShape(
        pName: string,
        pID: string,
        pSide: number,
        pX: number,
        pY: number,
        pDesiredDegree: string,
        pElementID: string,
        pText: string,
        pDocumentID: string,
        pDocumentName: string,
        pModuleID: string,
        pModuleName: string,
        pTypeName: XDataTypeName,
        pValue: unknown,
        pDataEx?: string
    ): void
    {
        const valueStr = XTypeConverter.ToString(pValue, pTypeName);

        const attrs: XIXmlAttribute[] = [
            { Name: "Name", Value: pName },
            { Name: "ID", Value: pID },
            { Name: "Side", Value: pSide.toString() },
            { Name: "X", Value: pX.toString() },
            { Name: "Y", Value: pY.toString() },
            { Name: "DesiredDegree", Value: pDesiredDegree },
            { Name: "ElementID", Value: pElementID },
            { Name: "Text", Value: pText },
            { Name: "DocumentID", Value: pDocumentID },
            { Name: "DocumentName", Value: pDocumentName },
            { Name: "ModuleID", Value: pModuleID },
            { Name: "ModuleName", Value: pModuleName },
            { Name: "DataEx", Value: pDataEx ?? "" },
            { Name: "Type", Value: pTypeName }
        ];

        this.WriteElementWithText("XLinkedShape", valueStr, attrs);
    }

    public WritePropertiesSection(pElement: XPersistableElement): void
    {
        const props = this.CollectSerializableProperties(pElement);
        if (props.length === 0)
            return;

        this.WriteStartElement("XValues");
        this.CloseOpenTag(true);

        for (const propData of props)
            this.WritePropertyData(propData);

        this.WriteEndElement("XValues");
    }

    private CollectSerializableProperties(pElement: XPersistableElement): XIPropertySerializationData[]
    {
        const result: XIPropertySerializationData[] = [];
        let props = pElement.GetSerializableProperties();

        if (props.length === 0)
            props = Array.from(XProperty.GetAll());

        for (const prop of props)
        {
            const pd = prop.Default;

            if (!pd.IsPersistable)
                continue;

            if (pd.AsAttribute)
                continue;

            if (pd.Group === XPropertyGroup.Design)
                continue;

            let value: unknown;
            try
            {
                value = pElement.GetValue(prop);
            }
            catch
            {
                continue;
            }

            const typeName = this.InferPropertyTypeName(prop, value);

            if (!this._Context.Options.IncludeDefaultValues)
            {
                if (XTypeConverter.IsDefaultValue(value, pd.DefaultValue, typeName))
                    continue;
            }

            result.push({
                Property: prop,
                Value: value,
                TypeName: typeName,
                IsLinked: pd.IsLinked,
                CultureSensitive: pd.CultureSensitive
            });
        }

        return result;
    }

    private InferPropertyTypeName(pProperty: XProperty, pValue: unknown): XDataTypeName
    {
        const typeName = pProperty.Default.Type.Name;

        const mapping: Record<string, XDataTypeName> = {
            "String": "String",
            "Number": "Double",
            "Boolean": "Boolean",
            "XGuid": "Guid",
            "XSize": "Size",
            "XRect": "Rect",
            "XPoint": "Point",
            "XColor": "Color",
            "XThickness": "Thickness",
            "Date": "DateTime"
        };

        if (mapping[typeName])
            return mapping[typeName];

        return XTypeConverter.InferTypeName(pValue);
    }

    private WritePropertyData(pData: XIPropertySerializationData): void
    {
        const prop = pData.Property;
        const pd = prop.Default;

        if (pData.IsLinked)
        {
            this._Context.AddPendingReference(
                this._Context.DocumentID,
                prop.ID,
                pData.Value as string
            );
            return;
        }

        let cultures: Map<string, string> | undefined;
        if (pData.CultureSensitive)
        {
            cultures = new Map<string, string>();
            cultures.set(this._Context.Options.CultureCode, XTypeConverter.ToString(pData.Value, pData.TypeName));
        }

        this.WriteXData(pd.Name, prop.ID, pData.TypeName, pData.Value, cultures);
    }

    public WriteElement(pElement: XPersistableElement): void
    {
        this._Context.Phase = XSerializationPhase.BeforeSerialize;
        this._Context.RegisterElement(pElement);

        const tagName = XElementRegistry.Instance.GetTagName(pElement);
        const attrs = this.CollectElementAttributes(pElement);

        this.WriteStartElement(tagName, attrs);
        this.CloseOpenTag(true);

        this.WritePropertiesSection(pElement);
        this.WriteChildElements(pElement);

        this.WriteEndElement(tagName);
        this._Context.Phase = XSerializationPhase.AfterSerialize;
    }

    private CollectElementAttributes(pElement: XPersistableElement): XIXmlAttribute[]
    {
        const attrs: XIXmlAttribute[] = [];

        if (XGuid.IsFullValue(pElement.ID))
            attrs.push({ Name: "ID", Value: pElement.ID });

        if (pElement.Name)
            attrs.push({ Name: "Name", Value: pElement.Name });

        const tagName = XElementRegistry.Instance.GetTagName(pElement);
        const props = pElement.GetSerializableProperties();

        for (const prop of props)
        {
            if (!prop.Default.AsAttribute)
                continue;

            if (XElementRegistry.Instance.IsAttributeProperty(tagName, prop.ID))
            {
                const value = pElement.GetValue(prop);
                const typeName = this.InferPropertyTypeName(prop, value);

                if (!XTypeConverter.IsDefaultValue(value, prop.Default.DefaultValue, typeName))
                    attrs.push({ Name: prop.Name, Value: XTypeConverter.ToString(value, typeName) });
            }
        }

        return attrs;
    }

    private WriteChildElements(pElement: XPersistableElement): void
    {
        for (const child of pElement.ChildNodes)
        {
            const pe = child as unknown as XPersistableElement;
            if (pe && typeof pe.GetSerializableProperties === "function")
                this.WriteElement(pe);
        }
    }

    private CloseOpenTag(pAddNewLine: boolean): void
    {
        if (!this._HasOpenTag)
            return;

        this._Buffer.push(">");
        if (pAddNewLine)
            this._Buffer.push(this._Context.GetNewLine());

        this._HasOpenTag = false;
        this._CurrentTagName = "";
    }

    private EscapeAttribute(pValue: string): string
    {
        if (pValue === null || pValue === undefined)
            return "";

        const str = String(pValue);

        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    private EscapeText(pValue: string): string
    {
        if (pValue === null || pValue === undefined)
            return "";

        const str = String(pValue);

        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    public GetOutput(): string
    {
        return this._Buffer.join("");
    }

    public Clear(): void
    {
        this._Buffer.length = 0;
        this._HasOpenTag = false;
        this._CurrentTagName = "";
    }
}

interface XIPropertySerializationData
{
    Property: XProperty;
    Value: unknown;
    TypeName: XDataTypeName;
    IsLinked: boolean;
    CultureSensitive: boolean;
}
