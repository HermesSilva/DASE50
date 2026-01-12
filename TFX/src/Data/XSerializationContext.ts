import { XGuid } from "../Core/XGuid.js";
import type { XPersistableElement } from "../Core/XPersistableElement.js";

export interface XISerializationOptions
{
    Encoding: string;
    Indent: boolean;
    IndentChars: string;
    NewLineChars: string;
    OmitXmlDeclaration: boolean;
    PreserveWhitespace: boolean;
    IncludeDefaultValues: boolean;
    CultureCode: string;
}

export const XDefaultSerializationOptions: XISerializationOptions =
{
    Encoding: "utf-8",
    Indent: true,
    IndentChars: "  ",
    NewLineChars: "\n",
    OmitXmlDeclaration: false,
    PreserveWhitespace: false,
    IncludeDefaultValues: false,
    CultureCode: "pt-br"
};

export enum XSerializationDirection
{
    Serialize = 0,
    Deserialize = 1
}

export enum XSerializationPhase
{
    None = 0,
    BeforeSerialize = 1,
    AfterSerialize = 2,
    BeforeDeserialize = 3,
    AfterDeserialize = 4,
    ResolvingReferences = 5,
    Completed = 6
}

export interface XISerializationError
{
    ElementID: string;
    ElementName: string;
    PropertyName: string;
    Message: string;
    Phase: XSerializationPhase;
    InnerError?: Error;
}

export interface XISerializationReference
{
    SourceElementID: string;
    PropertyID: string;
    TargetElementID: string;
    IsResolved: boolean;
}

export class XSerializationContext
{
    private readonly _Options: XISerializationOptions;
    private readonly _Direction: XSerializationDirection;
    private readonly _Elements: Map<string, XPersistableElement> = new Map();
    private readonly _PendingReferences: XISerializationReference[] = [];
    private readonly _Errors: XISerializationError[] = [];
    private readonly _ProcessedIDs: Set<string> = new Set();
    private _Phase: XSerializationPhase = XSerializationPhase.None;
    private _CurrentDepth: number = 0;
    private _DocumentID: string = XGuid.EmptyValue;
    private _DocumentName: string = "";
    private _ModuleID: string = XGuid.EmptyValue;

    public constructor(pDirection: XSerializationDirection, pOptions?: Partial<XISerializationOptions>)
    {
        this._Direction = pDirection;
        this._Options = { ...XDefaultSerializationOptions, ...pOptions };
    }

    public get Options(): XISerializationOptions
    {
        return this._Options;
    }

    public get Direction(): XSerializationDirection
    {
        return this._Direction;
    }

    public get Phase(): XSerializationPhase
    {
        return this._Phase;
    }

    public set Phase(pValue: XSerializationPhase)
    {
        this._Phase = pValue;
    }

    public get CurrentDepth(): number
    {
        return this._CurrentDepth;
    }

    public get DocumentID(): string
    {
        return this._DocumentID;
    }

    public set DocumentID(pValue: string)
    {
        this._DocumentID = pValue;
    }

    public get DocumentName(): string
    {
        return this._DocumentName;
    }

    public set DocumentName(pValue: string)
    {
        this._DocumentName = pValue;
    }

    public get ModuleID(): string
    {
        return this._ModuleID;
    }

    public set ModuleID(pValue: string)
    {
        this._ModuleID = pValue;
    }

    public get Errors(): readonly XISerializationError[]
    {
        return this._Errors;
    }

    public get HasErrors(): boolean
    {
        return this._Errors.length > 0;
    }

    public get PendingReferences(): readonly XISerializationReference[]
    {
        return this._PendingReferences;
    }

    public get PendingReferencesCount(): number
    {
        return this._PendingReferences.length;
    }

    public IncrementDepth(): void
    {
        this._CurrentDepth++;
    }

    public DecrementDepth(): void
    {
        if (this._CurrentDepth > 0)
            this._CurrentDepth--;
    }

    public GetIndent(): string
    {
        if (!this._Options.Indent)
            return "";
        return this._Options.IndentChars.repeat(this._CurrentDepth);
    }

    public GetNewLine(): string
    {
        return this._Options.Indent ? this._Options.NewLineChars : "";
    }

    public RegisterElement(pElement: XPersistableElement): void
    {
        if (XGuid.IsFullValue(pElement.ID))
            this._Elements.set(pElement.ID, pElement);
    }

    public GetElement<T extends XPersistableElement>(pID: string): T | null
    {
        return (this._Elements.get(pID) as T) ?? null;
    }

    public HasElement(pID: string): boolean
    {
        return this._Elements.has(pID);
    }

    public MarkProcessed(pID: string): void
    {
        this._ProcessedIDs.add(pID);
    }

    public IsProcessed(pID: string): boolean
    {
        return this._ProcessedIDs.has(pID);
    }

    public AddPendingReference(pSourceID: string, pPropertyID: string, pTargetID: string): void
    {
        this._PendingReferences.push({
            SourceElementID: pSourceID,
            PropertyID: pPropertyID,
            TargetElementID: pTargetID,
            IsResolved: false
        });
    }

    public AddError(pError: XISerializationError): void
    {
        this._Errors.push(pError);
    }

    public CreateError(
        pElementID: string,
        pElementName: string,
        pPropertyName: string,
        pMessage: string,
        pInnerError?: Error
    ): XISerializationError
    {
        return {
            ElementID: pElementID,
            ElementName: pElementName,
            PropertyName: pPropertyName,
            Message: pMessage,
            Phase: this._Phase,
            InnerError: pInnerError
        };
    }

    public ResolveReferences(): number
    {
        this._Phase = XSerializationPhase.ResolvingReferences;
        let resolved = 0;

        console.log(`[ResolveReferences] Starting. Pending references: ${this._PendingReferences.length}`);

        for (let i = this._PendingReferences.length - 1; i >= 0; i--)
        {
            const ref = this._PendingReferences[i];
            if (ref.IsResolved)
            {
                this._PendingReferences.splice(i, 1);
                continue;
            }

            const source = this._Elements.get(ref.SourceElementID);
            const target = this._Elements.get(ref.TargetElementID);

            if (source && target)
            {
                // Marca como resolvido - GetLinkedElement resolverá automaticamente quando chamado
                ref.IsResolved = true;
                resolved++;
                this._PendingReferences.splice(i, 1);
            }
        }

        console.log(`[ResolveReferences] Completed. Resolved: ${resolved}`);
        return resolved;
    }

    public Clear(): void
    {
        this._Elements.clear();
        this._PendingReferences.length = 0;
        this._Errors.length = 0;
        this._ProcessedIDs.clear();
        this._Phase = XSerializationPhase.None;
        this._CurrentDepth = 0;
    }
}
