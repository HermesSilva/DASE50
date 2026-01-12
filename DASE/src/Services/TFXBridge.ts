/* eslint-disable @typescript-eslint/no-explicit-any */
import { XPropertyItem, XPropertyType } from "../Models/PropertyItem";
import { XIssueItem, XIssueSeverity, TIssueSeverity } from "../Models/IssueItem";
import { GetLogService } from "./LogService";

// TFX imports - direct CommonJS import
import * as tfx from "@tootega/tfx";
import {
    XIAddTableData,
    XIAddReferenceData,
    XIAddFieldData,
    XIMoveElementData,
    XIUpdatePropertyData,
    XIRenameElementData,
    XIOperationResult,
    XORMDocument,
    XORMTable,
    XORMField,
    XORMFieldDataType,
    XORMReference,
    XORMController,
    XORMValidator,
    XPoint,
    XRect,
    XGuid,
    XSerializationEngine,
    RegisterORMElements
} from "@tootega/tfx";

// Data interfaces for webview communication (JSON-serializable)
// These mirror TFX types but are plain objects for webview transfer

interface IFieldData
{
    ID: string;
    Name: string;
    DataType: string;
    IsPrimaryKey: boolean;
    IsNullable: boolean;
    Length?: number;
    IsAutoIncrement?: boolean;
    DefaultValue?: string;
    Description?: string;
}

interface ITableData
{
    ID: string;
    Name: string;
    X: number;
    Y: number;
    Width: number;
    Height: number;
    Schema?: string;
    Description?: string;
    Fields: IFieldData[];
}

interface IReferenceData
{
    ID: string;
    Name: string;
    SourceFieldID: string;
    TargetTableID: string;
    Description?: string;
    Points: Array<{ X: number; Y: number }>;
}

// Legacy interface for loading old JSON files (supports both old and new field names)
interface ILegacyReferenceData
{
    ID?: string;
    Name?: string;
    SourceID?: string;
    TargetID?: string;
    SourceFieldID?: string;
    TargetTableID?: string;
    Description?: string;
    Points?: Array<{ X: number; Y: number }>;
}

interface IModelData
{
    Tables: ITableData[];
    References: IReferenceData[];
}

interface IJsonData
{
    Name?: string;
    Tables?: ITableData[];
    References?: ILegacyReferenceData[];
}

export class XTFXBridge
{
    private _Controller: XORMController;
    private _Validator: XORMValidator;
    private _Engine: XSerializationEngine;
    private _Initialized: boolean;

    constructor()
    {
        this._Controller = null!;
        this._Validator = null!;
        this._Engine = null!;
        this._Initialized = false;
    }

    Initialize(): void
    {
        if (this._Initialized)
            return;
        
        RegisterORMElements();
        this._Controller = new XORMController();
        this._Validator = new XORMValidator();
        this._Engine = XSerializationEngine.Instance;
        this._Initialized = true;
    }

    get Controller(): any
    {
        return this._Controller;
    }

    get Document(): any
    {
        return this._Controller?.Document;
    }

    LoadOrmModelFromText(pText: string): XORMDocument
    {
        this.Initialize();

        try
        {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "ORM Model";

            if (pText && pText.trim().length > 0)
            {
                const trimmedText = pText.trim();
                if (trimmedText.startsWith("<?xml") || trimmedText.startsWith("<"))
                {
                    const result = this._Engine.Deserialize<XORMDocument>(pText);
                    if (result.Success && result.Data)
                    {
                        // Initialize the document to consolidate multiple XORMDesign instances
                        GetLogService().Info('[TFXBridge] Before Initialize: ChildNodes count = ' + result.Data.ChildNodes?.length);
                        result.Data.Initialize();
                        GetLogService().Info('[TFXBridge] After Initialize: ChildNodes count = ' + result.Data.ChildNodes?.length);
                        GetLogService().Info('[TFXBridge] Design children count = ' + result.Data.Design?.ChildNodes?.length);
                        this._Controller.Document = result.Data;
                        
                        // Route all lines after document is fully loaded and relationships established
                        GetLogService().Info('[TFXBridge] Routing lines after load...');
                        const references = result.Data.Design?.GetReferences();
                        GetLogService().Info(`[TFXBridge] Found ${references?.length || 0} references before routing`);
                        references?.forEach((ref: any, i: number) => {
                            GetLogService().Info(`  Ref ${i}: Points before = ${ref.Points?.length || 0}, Points = ${JSON.stringify(ref.Points)}`);
                        });
                        
                        result.Data.Design?.RouteAllLines();
                        
                        GetLogService().Info(`[TFXBridge] Found ${references?.length || 0} references after routing`);
                        references?.forEach((ref: any, i: number) => {
                            GetLogService().Info(`  Ref ${i}: Points after = ${ref.Points?.length || 0}, Points = ${JSON.stringify(ref.Points)}`);
                        });
                        GetLogService().Info('[TFXBridge] Lines routed');
                        
                        return result.Data;
                    }
                }
                else
                {
                    const data = JSON.parse(pText) as IJsonData;
                    this.LoadFromJson(doc, data);
                }
            }

            this._Controller.Document = doc;
            return doc;
        }
        catch (err)
        {
            console.error("LoadOrmModelFromText error:", err);
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "ORM Model";
            this._Controller.Document = doc;
            return doc;
        }
    }

    SaveOrmModelToText(): string
    {
        try
        {
            const doc = this._Controller?.Document;
            if (!doc)
                return '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';

            const result = this._Engine.Serialize(doc);
            if (result.Success && result.XmlOutput)
                return result.XmlOutput;

            return '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';
        }
        catch (err)
        {
            console.error("SaveOrmModelToText error:", err);
            return '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';
        }
    }

    ValidateOrmModel(): XIssueItem[]
    {
        this.Initialize();

        const doc = this._Controller?.Document;
        if (!doc)
            return [];

        const tfxIssues = this._Validator.Validate(doc);
        const issues: XIssueItem[] = [];

        for (const issue of tfxIssues)
        {
            const severity: TIssueSeverity = issue.Severity === tfx.XDesignerErrorSeverity?.Error 
                ? XIssueSeverity.Error 
                : XIssueSeverity.Warning;
            issues.push(new XIssueItem(
                issue.ElementID,
                issue.ElementName,
                severity,
                issue.Message,
                issue.PropertyID
            ));
        }

        return issues;
    }

    ApplyOperation(pOperation: any): any
    {
        return this._Controller?.ApplyOperation(pOperation);
    }

    AddTable(pX: number, pY: number, pName: string): XIOperationResult
    {
        this.Initialize();
        
        const addTableData: XIAddTableData = { X: pX, Y: pY, Name: pName };
        const result = this._Controller?.AddTable(addTableData);
        
        return result || { Success: false, Message: "Failed to add table." };
    }

    AddReference(pSourceTableID: string, pTargetTableID: string, pName: string): XIOperationResult
    {
        GetLogService().Info(`TFXBridge.AddReference: SourceTable=${pSourceTableID}, TargetTable=${pTargetTableID}, Name=${pName}`);
        
        // Get the target table to build the FK field name
        const targetTable = this._Controller?.GetElementByID(pTargetTableID) as XORMTable | null;
        const targetName = targetTable?.Name || "Target";
        
        // First create the FK field in the source table
        const fkFieldName = `${targetName}ID`;
        GetLogService().Info(`Creating FK field: ${fkFieldName} in table ${pSourceTableID}`);
        
        const addFieldData: XIAddFieldData = {
            TableID: pSourceTableID,
            Name: fkFieldName
        };
        const fieldResult = this._Controller?.AddField(addFieldData);
        GetLogService().Info(`FK field creation result: ${JSON.stringify(fieldResult)}`);
        
        if (!fieldResult?.Success || !fieldResult?.ElementID)
            return { Success: false, Message: "Failed to create FK field." };
        
        // Now create the reference using the field ID as source
        const addRefData: XIAddReferenceData = {
            SourceFieldID: fieldResult.ElementID,
            TargetTableID: pTargetTableID,
            Name: pName || `FK_${targetName}`
        };
        const result: XIOperationResult = this._Controller?.AddReference(addRefData) || { Success: false };
        GetLogService().Info(`Controller.AddReference result: ${JSON.stringify(result)}`);
        
        return result;
    }

    AddField(pTableID: string, pName: string, _pDataType: string): XIOperationResult
    {
        GetLogService().Info(`TFXBridge.AddField: TableID=${pTableID}, Name=${pName}`);
        const addFieldData: XIAddFieldData = {
            TableID: pTableID,
            Name: pName
        };
        const result: XIOperationResult = this._Controller?.AddField(addFieldData) || { Success: false };
        GetLogService().Info(`Controller.AddField result: ${JSON.stringify(result)}`);
        return result;
    }

    AlignLines(): boolean
    {
        GetLogService().Info('TFXBridge.AlignLines called');
        const result = this._Controller?.RouteAllLines?.();
        GetLogService().Info(`Controller.RouteAllLines result: ${result}`);
        return result ?? false;
    }

    DeleteElement(pElementID: string): XIOperationResult
    {
        return this._Controller?.RemoveElement(pElementID) || { Success: false };
    }

    RenameElement(pElementID: string, pNewName: string): XIOperationResult
    {
        const renameData: XIRenameElementData = {
            ElementID: pElementID,
            NewName: pNewName
        };
        return this._Controller?.RenameElement(renameData) || { Success: false };
    }

    MoveElement(pElementID: string, pX: number, pY: number): XIOperationResult
    {
        const moveData: XIMoveElementData = {
            ElementID: pElementID,
            X: pX,
            Y: pY
        };
        return this._Controller?.MoveElement(moveData) || { Success: false };
    }

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): XIOperationResult
    {
        const updateData: XIUpdatePropertyData = {
            ElementID: pElementID,
            PropertyKey: pPropertyKey,
            Value: pValue
        };
        return this._Controller?.UpdateProperty(updateData) || { Success: false };
    }

    GetProperties(pElementID: string): XPropertyItem[]
    {
        this.Initialize();

        const element = this._Controller?.GetElementByID(pElementID);
        if (!element)
            return [];

        const props: XPropertyItem[] = [];

        props.push(new XPropertyItem("ID", "ID", element.ID, XPropertyType.String));
        props.push(new XPropertyItem("Name", "Name", element.Name, XPropertyType.String));

        if (element instanceof XORMTable)
        {
            props.push(new XPropertyItem("Schema", "Schema", element.Schema, XPropertyType.String));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String));

            const bounds = element.Bounds;
            props.push(new XPropertyItem("X", "X", bounds.Left, XPropertyType.Number));
            props.push(new XPropertyItem("Y", "Y", bounds.Top, XPropertyType.Number));
            props.push(new XPropertyItem("Width", "Width", bounds.Width, XPropertyType.Number));
            props.push(new XPropertyItem("Height", "Height", bounds.Height, XPropertyType.Number));
        }
        else if (element instanceof XORMReference)
        {
            props.push(new XPropertyItem("Source", "Source", element.Source, XPropertyType.String));
            props.push(new XPropertyItem("Target", "Target", element.Target, XPropertyType.String));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String));
        }
        else if (element instanceof XORMField)
        {
            props.push(new XPropertyItem("DataType", "Data Type", element.DataType, XPropertyType.Enum, ["String", "Integer", "Long", "Decimal", "Boolean", "DateTime", "Guid", "Binary", "Text"]));
            props.push(new XPropertyItem("Length", "Length", element.Length, XPropertyType.Number));
            props.push(new XPropertyItem("IsPrimaryKey", "Primary Key", element.IsPrimaryKey, XPropertyType.Boolean));
            props.push(new XPropertyItem("IsNullable", "Nullable", element.IsNullable, XPropertyType.Boolean));
            props.push(new XPropertyItem("IsAutoIncrement", "Auto Increment", element.IsAutoIncrement, XPropertyType.Boolean));
            props.push(new XPropertyItem("DefaultValue", "Default Value", element.DefaultValue, XPropertyType.String));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String));
        }

        return props;
    }

    GetModelData(): IModelData
    {
        this.Initialize();

        const doc = this._Controller?.Document;
        if (!doc || !doc.Design)
            return { Tables: [], References: [] };

        const tables = this._Controller.GetTables();
        const references = this._Controller.GetReferences();

        GetLogService().Debug(`GetModelData: Found ${tables?.length || 0} tables, ${references?.length || 0} references`);

        const tablesData: ITableData[] = tables.map((t: any) => {
            // Get fields using GetChildrenOfType or directly from Fields array
            const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];
            
            return {
                ID: t.ID,
                Name: t.Name,
                X: t.Bounds.Left,
                Y: t.Bounds.Top,
                Width: t.Bounds.Width,
                Height: t.Bounds.Height,
                Fields: fields.map((f: any) => ({
                    ID: f.ID,
                    Name: f.Name,
                    DataType: f.DataType,
                    IsPrimaryKey: f.IsPrimaryKey,
                    IsNullable: f.IsNullable
                }))
            };
        });

        const refsData: IReferenceData[] = references.map((r: any) => {
            GetLogService().Debug(`Reference: ID=${r.ID}, Name=${r.Name}, Source=${r.Source}, Target=${r.Target}`);
            GetLogService().Debug(`Reference Points raw: ${JSON.stringify(r.Points)}`);
            GetLogService().Debug(`Reference Points length: ${r.Points?.length || 0}`);
            const mappedPoints = r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || [];
            GetLogService().Debug(`Reference Points mapped: ${JSON.stringify(mappedPoints)}`);
            return {
                ID: r.ID,
                Name: r.Name,
                SourceFieldID: r.Source,
                TargetTableID: r.Target,
                Points: mappedPoints
            };
        });

        return { Tables: tablesData, References: refsData };
    }

    LoadFromJson(pDoc: any, pData: IJsonData): void
    {
        if (!pData || !pDoc.Design)
            return;

        const design = pDoc.Design;

        if (pData.Name)
            pDoc.Name = pData.Name;

        if (pData.Tables && Array.isArray(pData.Tables))
        {
            for (const tData of pData.Tables)
            {
                const table = design.CreateTable({
                    X: tData.X || 0,
                    Y: tData.Y || 0,
                    Width: tData.Width || 200,
                    Height: tData.Height || 150,
                    Name: tData.Name || "",
                    Schema: tData.Schema || "dbo"
                });

                if (tData.ID)
                    table.ID = tData.ID;
                if (tData.Description)
                    table.Description = tData.Description;

                if (tData.Fields && Array.isArray(tData.Fields))
                {
                    for (const fData of tData.Fields)
                    {
                        const field = table.CreateField({
                            Name: fData.Name || "",
                            DataType: (fData.DataType as XORMFieldDataType) || XORMFieldDataType.String,
                            Length: fData.Length || 0,
                            IsPrimaryKey: fData.IsPrimaryKey || false,
                            IsNullable: fData.IsNullable !== false,
                            IsAutoIncrement: fData.IsAutoIncrement || false,
                            DefaultValue: fData.DefaultValue || ""
                        });

                        if (fData.ID)
                            field.ID = fData.ID;
                        if (fData.Description)
                            field.Description = fData.Description;
                    }
                }
            }
        }

        if (pData.References && Array.isArray(pData.References))
        {
            for (const rData of pData.References)
            {
                try
                {
                    const ref = design.CreateReference({
                        SourceFieldID: rData.SourceFieldID || rData.SourceID || "",
                        TargetTableID: rData.TargetTableID || rData.TargetID || "",
                        Name: rData.Name || ""
                    });

                    if (rData.ID)
                        ref.ID = rData.ID;
                    if (rData.Description)
                        ref.Description = rData.Description;

                    if (rData.Points && Array.isArray(rData.Points))
                        ref.Points = rData.Points.map((p: any) => new XPoint(p.X, p.Y));
                }
                catch (error)
                {
                    GetLogService().Warn(`Failed to create reference: ${rData.Name} - ${error}`);
                }
            }
        }
    }

    SaveToJson(pDoc: any): IJsonData
    {
        if (!pDoc || !pDoc.Design)
            return {};

        const tables = this._Controller?.GetTables() || [];
        const references = this._Controller?.GetReferences() || [];

        return {
            Name: pDoc.Name,
            Tables: tables.map((t: any) => {
                // Get fields using GetChildrenOfType or directly from Fields array
                const fields = t.GetChildrenOfType?.(null) ?? t.Fields ?? [];
                
                return {
                    ID: t.ID,
                    Name: t.Name,
                    Schema: t.Schema,
                    Description: t.Description,
                    X: t.Bounds.Left,
                    Y: t.Bounds.Top,
                    Width: t.Bounds.Width,
                    Height: t.Bounds.Height,
                    Fields: fields.map((f: any) => ({
                        ID: f.ID,
                        Name: f.Name,
                        DataType: f.DataType,
                        Length: f.Length,
                        IsPrimaryKey: f.IsPrimaryKey,
                        IsNullable: f.IsNullable,
                        IsAutoIncrement: f.IsAutoIncrement,
                        DefaultValue: f.DefaultValue,
                        Description: f.Description
                    }))
                };
            }),
            References: references.map((r: any) => ({
                ID: r.ID,
                Name: r.Name,
                SourceFieldID: r.SourceID || r.Source,
                TargetTableID: r.TargetID || r.Target,
                Description: r.Description,
                Points: r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || []
            }))
        };
    }
}
