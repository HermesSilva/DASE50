/* eslint-disable @typescript-eslint/no-explicit-any */
import { XPropertyItem, XPropertyType } from "../Models/PropertyItem";
import { XIssueItem, XIssueSeverity, TIssueSeverity } from "../Models/IssueItem";
import { GetLogService } from "./LogService";

// TFX is an ESM module, dynamically imported
let tfx: any = null;

async function LoadTFX(): Promise<any>
{
    if (tfx === null)
        tfx = await import("@tootega/tfx");
    return tfx;
}

interface IAddTableParams
{
    X: number;
    Y: number;
    Name: string;
}

interface IAddReferenceParams
{
    SourceID: string;
    TargetID: string;
    Name: string;
}

interface IRenameParams
{
    ElementID: string;
    NewName: string;
}

interface IMoveParams
{
    ElementID: string;
    X: number;
    Y: number;
}

interface IUpdatePropertyParams
{
    ElementID: string;
    PropertyKey: string;
    Value: any;
}

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
    SourceID: string;
    TargetID: string;
    Description?: string;
    Points: Array<{ X: number; Y: number }>;
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
    References?: IReferenceData[];
}

export class XTFXBridge
{
    private _Controller: any;
    private _Validator: any;
    private _Engine: any;
    private _Initialized: boolean;

    constructor()
    {
        this._Controller = null;
        this._Validator = null;
        this._Engine = null;
        this._Initialized = false;
    }

    async Initialize(): Promise<void>
    {
        if (this._Initialized)
            return;
        
        const tfxMod = await LoadTFX();
        this._Controller = new tfxMod.XORMController();
        this._Validator = new tfxMod.XORMValidator();
        this._Engine = tfxMod.XSerializationEngine.Instance;
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

    async LoadOrmModelFromText(pJsonText: string): Promise<any>
    {
        await this.Initialize();
        const tfxMod = await LoadTFX();

        try
        {
            const doc = new tfxMod.XORMDocument();
            doc.ID = tfxMod.XGuid.NewValue();
            doc.Name = "ORM Model";

            if (pJsonText && pJsonText.trim().length > 0)
            {
                const data = JSON.parse(pJsonText) as IJsonData;
                await this.LoadFromJson(doc, data);
            }

            this._Controller.Document = doc;
            return doc;
        }
        catch (err)
        {
            console.error("LoadOrmModelFromText error:", err);
            const doc = new tfxMod.XORMDocument();
            doc.ID = tfxMod.XGuid.NewValue();
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
            if (doc === null)
                return "{}";

            const data = this.SaveToJson(doc);
            return JSON.stringify(data, null, 2);
        }
        catch (err)
        {
            console.error("SaveOrmModelToText error:", err);
            return "{}";
        }
    }

    async ValidateOrmModel(): Promise<XIssueItem[]>
    {
        await this.Initialize();
        const tfxMod = await LoadTFX();

        const doc = this._Controller?.Document;
        if (doc === null)
            return [];

        const tfxIssues = this._Validator.Validate(doc);
        const issues: XIssueItem[] = [];

        for (const issue of tfxIssues)
        {
            const severity: TIssueSeverity = issue.Severity === tfxMod.XDesignerErrorSeverity?.Error 
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

    AddTable(pX: number, pY: number, pName: string): any
    {
        const params: IAddTableParams = { X: pX, Y: pY, Name: pName };
        return this._Controller?.AddTable(params);
    }

    AddReference(pSourceID: string, pTargetID: string, pName: string): any
    {
        GetLogService().Info(`TFXBridge.AddReference: Source=${pSourceID}, Target=${pTargetID}, Name=${pName}`);
        const params: IAddReferenceParams = {
            SourceID: pSourceID,
            TargetID: pTargetID,
            Name: pName
        };
        const result = this._Controller?.AddReference(params);
        GetLogService().Info(`Controller.AddReference result: ${JSON.stringify(result)}`);
        return result;
    }

    DeleteElement(pElementID: string): boolean
    {
        return this._Controller?.RemoveElement(pElementID);
    }

    RenameElement(pElementID: string, pNewName: string): boolean
    {
        const params: IRenameParams = {
            ElementID: pElementID,
            NewName: pNewName
        };
        return this._Controller?.RenameElement(params);
    }

    MoveElement(pElementID: string, pX: number, pY: number): boolean
    {
        const params: IMoveParams = {
            ElementID: pElementID,
            X: pX,
            Y: pY
        };
        return this._Controller?.MoveElement(params);
    }

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: any): boolean
    {
        const params: IUpdatePropertyParams = {
            ElementID: pElementID,
            PropertyKey: pPropertyKey,
            Value: pValue
        };
        return this._Controller?.UpdateProperty(params);
    }

    async GetProperties(pElementID: string): Promise<XPropertyItem[]>
    {
        await this.Initialize();
        const tfxMod = await LoadTFX();

        const element = this._Controller?.GetElementByID(pElementID);
        if (element === null)
            return [];

        const props: XPropertyItem[] = [];

        props.push(new XPropertyItem("ID", "ID", element.ID, XPropertyType.String));
        props.push(new XPropertyItem("Name", "Name", element.Name, XPropertyType.String));

        if (element instanceof tfxMod.XORMTable)
        {
            props.push(new XPropertyItem("Schema", "Schema", element.Schema, XPropertyType.String));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String));

            const bounds = element.Bounds;
            props.push(new XPropertyItem("X", "X", bounds.Left, XPropertyType.Number));
            props.push(new XPropertyItem("Y", "Y", bounds.Top, XPropertyType.Number));
            props.push(new XPropertyItem("Width", "Width", bounds.Width, XPropertyType.Number));
            props.push(new XPropertyItem("Height", "Height", bounds.Height, XPropertyType.Number));
        }
        else if (element instanceof tfxMod.XORMReference)
        {
            props.push(new XPropertyItem("Source", "Source", element.Source, XPropertyType.String));
            props.push(new XPropertyItem("Target", "Target", element.Target, XPropertyType.String));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String));
        }
        else if (element instanceof tfxMod.XORMField)
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

    async GetModelData(): Promise<IModelData>
    {
        await this.Initialize();
        const tfxMod = await LoadTFX();

        const doc = this._Controller?.Document;
        if (doc === null || doc.Design === null)
            return { Tables: [], References: [] };

        const tables = this._Controller.GetTables();
        const references = this._Controller.GetReferences();

        GetLogService().Debug(`GetModelData: Found ${tables?.length || 0} tables, ${references?.length || 0} references`);

        const tablesData: ITableData[] = tables.map((t: any) => ({
            ID: t.ID,
            Name: t.Name,
            X: t.Bounds.Left,
            Y: t.Bounds.Top,
            Width: t.Bounds.Width,
            Height: t.Bounds.Height,
            Fields: t.GetChildrenOfType(tfxMod.XORMField).map((f: any) => ({
                ID: f.ID,
                Name: f.Name,
                DataType: f.DataType,
                IsPrimaryKey: f.IsPrimaryKey,
                IsNullable: f.IsNullable
            }))
        }));

        const refsData: IReferenceData[] = references.map((r: any) => {
            GetLogService().Debug(`Reference: ID=${r.ID}, Name=${r.Name}, SourceID=${r.SourceID}, TargetID=${r.TargetID}, Source=${r.Source}, Target=${r.Target}`);
            return {
                ID: r.ID,
                Name: r.Name,
                SourceID: r.SourceID || r.Source,
                TargetID: r.TargetID || r.Target,
                Points: r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || []
            };
        });

        return { Tables: tablesData, References: refsData };
    }

    async LoadFromJson(pDoc: any, pData: IJsonData): Promise<void>
    {
        const tfxMod = await LoadTFX();

        if (!pData || !pDoc.Design)
            return;

        const design = pDoc.Design;

        if (pData.Name)
            pDoc.Name = pData.Name;

        if (pData.Tables && Array.isArray(pData.Tables))
        {
            for (const tData of pData.Tables)
            {
                const table = new tfxMod.XORMTable();
                table.ID = tData.ID || tfxMod.XGuid.NewValue();
                table.Name = tData.Name || "";
                table.Schema = tData.Schema || "dbo";
                table.Description = tData.Description || "";
                table.Bounds = new tfxMod.XRect(
                    tData.X || 0,
                    tData.Y || 0,
                    tData.Width || 200,
                    tData.Height || 150
                );

                if (tData.Fields && Array.isArray(tData.Fields))
                {
                    for (const fData of tData.Fields)
                    {
                        const field = new tfxMod.XORMField();
                        field.ID = fData.ID || tfxMod.XGuid.NewValue();
                        field.Name = fData.Name || "";
                        field.DataType = fData.DataType || "String";
                        field.Length = fData.Length || 0;
                        field.IsPrimaryKey = fData.IsPrimaryKey || false;
                        field.IsNullable = fData.IsNullable !== false;
                        field.IsAutoIncrement = fData.IsAutoIncrement || false;
                        field.DefaultValue = fData.DefaultValue || "";
                        field.Description = fData.Description || "";
                        table.AppendChild(field);
                    }
                }

                design.AppendChild(table);
            }
        }

        if (pData.References && Array.isArray(pData.References))
        {
            for (const rData of pData.References)
            {
                const ref = new tfxMod.XORMReference();
                ref.ID = rData.ID || tfxMod.XGuid.NewValue();
                ref.Name = rData.Name || "";
                ref.Source = rData.SourceID || "";
                ref.Target = rData.TargetID || "";
                ref.Description = rData.Description || "";

                if (rData.Points && Array.isArray(rData.Points))
                    ref.Points = rData.Points.map((p: any) => new tfxMod.XPoint(p.X, p.Y));

                design.AppendChild(ref);
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
            Tables: tables.map((t: any) => ({
                ID: t.ID,
                Name: t.Name,
                Schema: t.Schema,
                Description: t.Description,
                X: t.Bounds.Left,
                Y: t.Bounds.Top,
                Width: t.Bounds.Width,
                Height: t.Bounds.Height,
                Fields: t.GetChildrenOfType?.(null)?.map((f: any) => ({
                    ID: f.ID,
                    Name: f.Name,
                    DataType: f.DataType,
                    Length: f.Length,
                    IsPrimaryKey: f.IsPrimaryKey,
                    IsNullable: f.IsNullable,
                    IsAutoIncrement: f.IsAutoIncrement,
                    DefaultValue: f.DefaultValue,
                    Description: f.Description
                })) || []
            })),
            References: references.map((r: any) => ({
                ID: r.ID,
                Name: r.Name,
                SourceID: r.SourceID,
                TargetID: r.TargetID,
                Description: r.Description,
                Points: r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || []
            }))
        };
    }
}
