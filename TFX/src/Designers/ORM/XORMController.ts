import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XElement } from "../../Core/XElement.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";
import type { XPersistableElement } from "../../Core/XPersistableElement.js";

export interface XIORMOperation
{
    readonly Type: XORMOperationType;
    readonly ElementID?: string;
    readonly Data?: unknown;
}

export enum XORMOperationType
{
    AddTable = "AddTable",
    RemoveTable = "RemoveTable",
    AddReference = "AddReference",
    RemoveReference = "RemoveReference",
    AddField = "AddField",
    RemoveField = "RemoveField",
    UpdateProperty = "UpdateProperty",
    MoveElement = "MoveElement",
    RenameElement = "RenameElement"
}

export interface XIAddTableData
{
    X: number;
    Y: number;
    Name?: string;
    Schema?: string;
}

export interface XIAddReferenceData
{
    SourceID: string;
    TargetID: string;
    Name?: string;
}

export interface XIAddFieldData
{
    TableID: string;
    Name?: string;
}

export interface XIUpdatePropertyData
{
    ElementID: string;
    PropertyKey: string;
    Value: unknown;
}

export interface XIMoveElementData
{
    ElementID: string;
    X: number;
    Y: number;
}

export interface XIRenameElementData
{
    ElementID: string;
    NewName: string;
}

export interface XIOperationResult
{
    Success: boolean;
    ElementID?: string;
    Message?: string;
}

export class XORMController
{
    private _Document: XORMDocument | null = null;

    public get Document(): XORMDocument | null
    {
        return this._Document;
    }

    public set Document(pValue: XORMDocument | null)
    {
        this._Document = pValue;
    }

    public get Design(): XORMDesign | null
    {
        return this._Document?.Design ?? null;
    }

    public ApplyOperation(pOperation: XIORMOperation): XIOperationResult
    {
        if (this._Document === null || this.Design === null)
            return { Success: false, Message: "No document loaded." };

        switch (pOperation.Type)
        {
            case XORMOperationType.AddTable:
                return this.AddTable(pOperation.Data as XIAddTableData);

            case XORMOperationType.RemoveTable:
                return this.RemoveElement(pOperation.ElementID!);

            case XORMOperationType.AddReference:
                return this.AddReference(pOperation.Data as XIAddReferenceData);

            case XORMOperationType.RemoveReference:
                return this.RemoveElement(pOperation.ElementID!);

            case XORMOperationType.AddField:
                return this.AddField(pOperation.Data as XIAddFieldData);

            case XORMOperationType.RemoveField:
                return this.RemoveElement(pOperation.ElementID!);

            case XORMOperationType.UpdateProperty:
                return this.UpdateProperty(pOperation.Data as XIUpdatePropertyData);

            case XORMOperationType.MoveElement:
                return this.MoveElement(pOperation.Data as XIMoveElementData);

            case XORMOperationType.RenameElement:
                return this.RenameElement(pOperation.Data as XIRenameElementData);

            default:
                return { Success: false, Message: `Unknown operation type: ${pOperation.Type}` };
        }
    }

    public AddTable(pData: XIAddTableData): XIOperationResult
    {
        if (this.Design === null)
            return { Success: false, Message: "No design loaded." };

        const table = this.Design.CreateTable({
            X: pData.X,
            Y: pData.Y,
            Name: pData.Name,
            Schema: pData.Schema
        });

        return { Success: true, ElementID: table.ID };
    }

    public AddReference(pData: XIAddReferenceData): XIOperationResult
    {
        if (this.Design === null)
            return { Success: false, Message: "No design loaded." };

        try
        {
            const reference = this.Design.CreateReference({
                SourceID: pData.SourceID,
                TargetID: pData.TargetID,
                Name: pData.Name
            });

            return { Success: true, ElementID: reference.ID };
        }
        catch (error)
        {
            const message = error instanceof Error ? error.message : "Failed to create reference.";
            return { Success: false, Message: message };
        }
    }

    public AddField(pData: XIAddFieldData): XIOperationResult
    {
        const table = this.GetTableByID(pData.TableID);
        if (table === null)
            return { Success: false, Message: "Table not found." };

        const field = table.CreateField({
            Name: pData.Name
        });

        return { Success: true, ElementID: field.ID };
    }

    public RemoveElement(pElementID: string): XIOperationResult
    {
        if (this.Design === null)
            return { Success: false, Message: "No design loaded." };

        const element = this.GetElementByID(pElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        if (!element.CanDelete)
            return { Success: false, Message: "Element cannot be deleted." };

        if (element instanceof XORMTable)
        {
            const deleted = this.Design.DeleteTable(element);
            if (!deleted)
                return { Success: false, Message: "Failed to delete table." };
            return { Success: true, ElementID: pElementID };
        }

        if (element instanceof XORMReference)
        {
            const deleted = this.Design.DeleteReference(element);
            if (!deleted)
                return { Success: false, Message: "Failed to delete reference." };
            return { Success: true, ElementID: pElementID };
        }

        if (element instanceof XORMField)
        {
            const table = element.ParentNode;
            if (table instanceof XORMTable)
            {
                const deleted = table.DeleteField(element);
                if (!deleted)
                    return { Success: false, Message: "Failed to delete field." };
                return { Success: true, ElementID: pElementID };
            }
        }

        return { Success: false, Message: "Unknown element type." };
    }

    public UpdateProperty(pData: XIUpdatePropertyData): XIOperationResult
    {
        const element = this.GetElementByID(pData.ElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        element.SetValueByKey(pData.PropertyKey, pData.Value);

        return { Success: true, ElementID: pData.ElementID };
    }

    public MoveElement(pData: XIMoveElementData): XIOperationResult
    {
        const element = this.GetElementByID(pData.ElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        if (element instanceof XORMTable)
        {
            const bounds = element.Bounds;
            element.Bounds = new XRect(pData.X, pData.Y, bounds.Width, bounds.Height);
            this.UpdateReferencesForTable(element);
        }

        return { Success: true, ElementID: pData.ElementID };
    }

    public RenameElement(pData: XIRenameElementData): XIOperationResult
    {
        const element = this.GetElementByID(pData.ElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        element.Name = pData.NewName;

        return { Success: true, ElementID: pData.ElementID };
    }

    public GetElementByID(pID: string): XPersistableElement | null
    {
        if (this._Document === null)
            return null;

        return this.FindElementRecursive(this._Document, pID);
    }

    public GetTableByID(pID: string): XORMTable | null
    {
        const element = this.GetElementByID(pID);
        if (element instanceof XORMTable)
            return element;
        return null;
    }

    public GetTables(): XORMTable[]
    {
        if (this.Design === null)
            return [];
        return this.Design.GetTables();
    }

    public GetReferences(): XORMReference[]
    {
        if (this.Design === null)
            return [];
        return this.Design.GetReferences();
    }

    public RouteAllLines(): boolean
    {
        if (this.Design === null)
            return false;

        this.Design.RouteAllLines();
        return true;
    }

    private FindElementRecursive(pElement: XPersistableElement, pID: string): XPersistableElement | null
    {
        if (pElement.ID === pID)
            return pElement;

        for (const child of pElement.ChildNodes)
        {
            const found = this.FindElementRecursive(child as XPersistableElement, pID);
            if (found !== null)
                return found;
        }

        return null;
    }

    private UpdateReferencesForTable(pTable: XORMTable): void
    {
        if (this.Design === null)
            return;

        const references = this.GetReferences();
        const tableBounds = pTable.Bounds;

        for (const ref of references)
        {
            if (ref.Source === pTable.ID)
            {
                const points = [...ref.Points];
                if (points.length > 0)
                {
                    points[0] = new XPoint(
                        tableBounds.Left + tableBounds.Width,
                        tableBounds.Top + tableBounds.Height / 2
                    );
                    ref.Points = points;
                }
            }

            if (ref.Target === pTable.ID)
            {
                const points = [...ref.Points];
                if (points.length > 1)
                {
                    points[points.length - 1] = new XPoint(
                        tableBounds.Left,
                        tableBounds.Top + tableBounds.Height / 2
                    );
                    ref.Points = points;
                }
            }
        }
    }
}
