import { XGuid } from "../Core/XGuid.js";
import type { XPersistableElement } from "../Core/XPersistableElement.js";
import {
    XSerializationContext,
    XSerializationDirection,
    XSerializationPhase,
    type XISerializationOptions,
    type XISerializationError
} from "./XSerializationContext.js";
import { XElementRegistry, type XIElementRegistration } from "./XElementRegistry.js";
import { XmlWriter, type XIXmlWriterOptions } from "./XmlWriter.js";
import { XmlReader, type XIXmlReaderOptions, type XIXmlNode } from "./XmlReader.js";

export interface XISerializationResult<T>
{
    Success: boolean;
    Data: T | null;
    Errors: XISerializationError[];
    XmlOutput?: string;
    ResolvedReferences: number;
}

export interface XIEngineConfiguration
{
    SerializationOptions: Partial<XISerializationOptions>;
    WriterOptions: Partial<XIXmlWriterOptions>;
    ReaderOptions: Partial<XIXmlReaderOptions>;
}

export const XDefaultEngineConfiguration: XIEngineConfiguration =
{
    SerializationOptions: {},
    WriterOptions: {},
    ReaderOptions: {}
};

export interface XISerializationHook
{
    BeforeSerialize?(pElement: XPersistableElement, pContext: XSerializationContext): void;
    AfterSerialize?(pElement: XPersistableElement, pContext: XSerializationContext, pXml: string): void;
    BeforeDeserialize?(pNode: XIXmlNode, pContext: XSerializationContext): void;
    AfterDeserialize?(pElement: XPersistableElement, pContext: XSerializationContext): void;
    OnError?(pError: XISerializationError, pContext: XSerializationContext): boolean;
}

export class XSerializationEngine
{
    private static _Instance: XSerializationEngine | null = null;

    private readonly _Configuration: XIEngineConfiguration;
    private readonly _Hooks: Map<string, XISerializationHook> = new Map();
    private readonly _CustomSerializers: Map<string, XICustomSerializer> = new Map();

    public constructor(pConfiguration?: Partial<XIEngineConfiguration>)
    {
        this._Configuration = {
            ...XDefaultEngineConfiguration,
            ...pConfiguration
        };
    }

    public static get Instance(): XSerializationEngine
    {
        if (XSerializationEngine._Instance === null)
            XSerializationEngine._Instance = new XSerializationEngine();
        return XSerializationEngine._Instance;
    }

    public static Configure(pConfiguration: Partial<XIEngineConfiguration>): XSerializationEngine
    {
        XSerializationEngine._Instance = new XSerializationEngine(pConfiguration);
        return XSerializationEngine._Instance;
    }

    public get Configuration(): XIEngineConfiguration
    {
        return this._Configuration;
    }

    public get Registry(): XElementRegistry
    {
        return XElementRegistry.Instance;
    }

    public GetClassID(pConstructor: Function): string
    {
        const meta = XElementRegistry.Instance.GetByConstructor(pConstructor as any);
        return meta?.ClassID ?? "";
    }

    public RegisterElement(pRegistration: XIElementRegistration): void
    {
        XElementRegistry.Instance.Register(pRegistration);
    }

    public RegisterHook(pName: string, pHook: XISerializationHook): void
    {
        this._Hooks.set(pName, pHook);
    }

    public UnregisterHook(pName: string): void
    {
        this._Hooks.delete(pName);
    }

    public RegisterCustomSerializer(pTagName: string, pSerializer: XICustomSerializer): void
    {
        this._CustomSerializers.set(pTagName, pSerializer);
    }

    public Serialize(pElement: XPersistableElement, pOptions?: Partial<XISerializationOptions>): XISerializationResult<string>
    {
        const context = new XSerializationContext(
            XSerializationDirection.Serialize,
            { ...this._Configuration.SerializationOptions, ...pOptions }
        );

        context.DocumentID = pElement.ID;
        context.DocumentName = pElement.Name;

        const writer = new XmlWriter(context, this._Configuration.WriterOptions);

        try
        {
            this.InvokeHooksBeforeSerialize(pElement, context);

            writer.WriteDeclaration();
            this.SerializeElement(pElement, writer, context);

            const output = writer.GetOutput();

            this.InvokeHooksAfterSerialize(pElement, context, output);

            context.Phase = XSerializationPhase.Completed;

            return {
                Success: !context.HasErrors,
                Data: output,
                Errors: [...context.Errors],
                XmlOutput: output,
                ResolvedReferences: 0
            };
        }
        catch (error)
        {
            const err = error as Error;
            context.AddError(context.CreateError(
                pElement.ID,
                pElement.Name,
                "",
                `Serialization failed: ${err.message}`,
                err
            ));

            return {
                Success: false,
                Data: null,
                Errors: [...context.Errors],
                ResolvedReferences: 0
            };
        }
    }

    private SerializeElement(pElement: XPersistableElement, pWriter: XmlWriter, pContext: XSerializationContext): void
    {
        const tagName = XElementRegistry.Instance.GetTagName(pElement);

        const customSerializer = this._CustomSerializers.get(tagName);
        if (customSerializer?.Serialize)
        {
            customSerializer.Serialize(pElement, pWriter, pContext);
            return;
        }

        pWriter.WriteElement(pElement);
    }

    public Deserialize<T extends XPersistableElement>(
        pXml: string,
        pOptions?: Partial<XISerializationOptions>
    ): XISerializationResult<T>
    {
        const context = new XSerializationContext(
            XSerializationDirection.Deserialize,
            { ...this._Configuration.SerializationOptions, ...pOptions }
        );

        const reader = new XmlReader(context, this._Configuration.ReaderOptions);

        try
        {
            const rootNode = reader.Parse(pXml);

            if (!rootNode)
            {
                context.AddError(context.CreateError(
                    "",
                    "",
                    "",
                    "Failed to parse XML: Invalid format or empty content"
                ));

                return {
                    Success: false,
                    Data: null,
                    Errors: [...context.Errors],
                    ResolvedReferences: 0
                };
            }

            this.InvokeHooksBeforeDeserialize(rootNode, context);

            const element = this.DeserializeElement<T>(rootNode, reader, context);

            if (element)
            {
                context.DocumentID = element.ID;
                context.DocumentName = element.Name;

                this.InvokeHooksAfterDeserialize(element, context);

                const resolved = context.ResolveReferences();
                context.Phase = XSerializationPhase.Completed;

                return {
                    Success: !context.HasErrors,
                    Data: element,
                    Errors: [...context.Errors],
                    ResolvedReferences: resolved
                };
            }

            return {
                Success: false,
                Data: null,
                Errors: [...context.Errors],
                ResolvedReferences: 0
            };
        }
        catch (error)
        {
            const err = error as Error;
            context.AddError(context.CreateError(
                "",
                "",
                "",
                `Deserialization failed: ${err.message}`,
                err
            ));

            return {
                Success: false,
                Data: null,
                Errors: [...context.Errors],
                ResolvedReferences: 0
            };
        }
    }

    private DeserializeElement<T extends XPersistableElement>(
        pNode: XIXmlNode,
        pReader: XmlReader,
        pContext: XSerializationContext
    ): T | null
    {
        const tagName = pNode.TagName;

        const customSerializer = this._CustomSerializers.get(tagName);
        if (customSerializer?.Deserialize)
            return customSerializer.Deserialize(pNode, pReader, pContext) as T;

        return pReader.ReadElement<T>(pNode);
    }

    public SerializeToDocument(
        pElement: XPersistableElement,
        pDocumentName: string,
        pModuleID: string,
        pOptions?: Partial<XISerializationOptions>
    ): XISerializationResult<string>
    {
        const opts = { ...this._Configuration.SerializationOptions, ...pOptions };
        const context = new XSerializationContext(XSerializationDirection.Serialize, opts);

        try
        {
            if (!pElement) throw new Error("Element is null");

            context.DocumentID = pElement.ID;
            context.DocumentName = pDocumentName;
            context.ModuleID = pModuleID;

            const writer = new XmlWriter(context, this._Configuration.WriterOptions);
            writer.WriteDeclaration();

            const tagName = XElementRegistry.Instance.GetTagName(pElement);
            const attrs = [
                { Name: "ID", Value: pElement.ID },
                { Name: "Name", Value: pDocumentName },
                { Name: "ModuleID", Value: pModuleID }
            ];

            writer.WriteStartElement(tagName, attrs);

            const hasContent = this.SerializeDocumentContent(pElement, writer, context);

            if (hasContent)
                writer.WriteEndElement(tagName);

            const output = writer.GetOutput();
            context.Phase = XSerializationPhase.Completed;

            return {
                Success: !context.HasErrors,
                Data: output,
                Errors: [...context.Errors],
                XmlOutput: output,
                ResolvedReferences: 0
            };
        }
        catch (error)
        {
            const err = error as Error;
            let elementID = XGuid.EmptyValue;
            try { elementID = (pElement as any)?.ID ?? XGuid.EmptyValue; } catch { /* ignore */ }
            
            context.AddError(context.CreateError(
                elementID,
                pDocumentName,
                "",
                `Document serialization failed: ${err.message}`,
                err
            ));

            return {
                Success: false,
                Data: null,
                Errors: [...context.Errors],
                ResolvedReferences: 0
            };
        }
    }

    private SerializeDocumentContent(
        pElement: XPersistableElement,
        pWriter: XmlWriter,
        pContext: XSerializationContext
    ): boolean
    {
        let hasContent = false;

        const props = pElement.GetSerializableProperties();
        const hasProperties = props.some(p =>
        {
            if (!p.Default.IsPersistable || p.Default.AsAttribute)
                return false;
            const val = pElement.GetValue(p);
            return val !== p.Default.DefaultValue;
        });

        if (hasProperties)
        {
            pWriter.WritePropertiesSection(pElement);
            hasContent = true;
        }

        for (const child of pElement.ChildNodes)
        {
            const pe = child as unknown as XPersistableElement;
            if (pe && typeof pe.GetSerializableProperties === "function")
            {
                this.SerializeElement(pe, pWriter, pContext);
                hasContent = true;
            }
        }

        return hasContent;
    }

    public ValidateXml(pXml: string): XISerializationResult<boolean>
    {
        const context = new XSerializationContext(XSerializationDirection.Deserialize);
        const reader = new XmlReader(context, { StrictMode: true, IgnoreUnknownElements: false, IgnoreUnknownAttributes: false });

        try
        {
            const root = reader.Parse(pXml);

            if (!root)
            {
                context.AddError(context.CreateError("", "", "", "Invalid XML format"));
                return {
                    Success: false,
                    Data: false,
                    Errors: [...context.Errors],
                    ResolvedReferences: 0
                };
            }

            this.ValidateNode(root, context);

            return {
                Success: !context.HasErrors,
                Data: !context.HasErrors,
                Errors: [...context.Errors],
                ResolvedReferences: 0
            };
        }
        catch (error)
        {
            const err = error as Error;
            context.AddError(context.CreateError("", "", "", `Validation failed: ${err.message}`, err));

            return {
                Success: false,
                Data: false,
                Errors: [...context.Errors],
                ResolvedReferences: 0
            };
        }
    }

    private ValidateNode(pNode: XIXmlNode, pContext: XSerializationContext): void
    {
        if (!XElementRegistry.Instance.HasTag(pNode.TagName) && pNode.TagName !== "Properties" && pNode.TagName !== "XData" && pNode.TagName !== "XLinkData" && pNode.TagName !== "XLinkedShape" && pNode.TagName !== "XLanguage")
        {
            pContext.AddError(pContext.CreateError(
                pNode.Attributes.get("ID") ?? "",
                pNode.TagName,
                "",
                `Unknown element: ${pNode.TagName}`
            ));
        }

        for (const child of pNode.ChildNodes)
            this.ValidateNode(child, pContext);
    }

    private InvokeHooksBeforeSerialize(pElement: XPersistableElement, pContext: XSerializationContext): void
    {
        for (const hook of this._Hooks.values())
        {
            if (hook.BeforeSerialize)
                hook.BeforeSerialize(pElement, pContext);
        }
    }

    private InvokeHooksAfterSerialize(pElement: XPersistableElement, pContext: XSerializationContext, pXml: string): void
    {
        for (const hook of this._Hooks.values())
        {
            if (hook.AfterSerialize)
                hook.AfterSerialize(pElement, pContext, pXml);
        }
    }

    private InvokeHooksBeforeDeserialize(pNode: XIXmlNode, pContext: XSerializationContext): void
    {
        for (const hook of this._Hooks.values())
        {
            if (hook.BeforeDeserialize)
                hook.BeforeDeserialize(pNode, pContext);
        }
    }

    private InvokeHooksAfterDeserialize(pElement: XPersistableElement, pContext: XSerializationContext): void
    {
        for (const hook of this._Hooks.values())
        {
            if (hook.AfterDeserialize)
                hook.AfterDeserialize(pElement, pContext);
        }
    }

    public CreateContext(
        pDirection: XSerializationDirection,
        pOptions?: Partial<XISerializationOptions>
    ): XSerializationContext
    {
        return new XSerializationContext(pDirection, { ...this._Configuration.SerializationOptions, ...pOptions });
    }

    public CreateWriter(pContext: XSerializationContext): XmlWriter
    {
        return new XmlWriter(pContext, this._Configuration.WriterOptions);
    }

    public CreateReader(pContext: XSerializationContext): XmlReader
    {
        return new XmlReader(pContext, this._Configuration.ReaderOptions);
    }
}

export interface XICustomSerializer
{
    Serialize?(pElement: XPersistableElement, pWriter: XmlWriter, pContext: XSerializationContext): void;
    Deserialize?(pNode: XIXmlNode, pReader: XmlReader, pContext: XSerializationContext): XPersistableElement | null;
}
