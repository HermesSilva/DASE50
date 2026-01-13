/* eslint-disable @typescript-eslint/no-explicit-any */
import { XPropertyItem, XPropertyType } from "../Models/PropertyItem";
import { XIssueItem, XIssueSeverity, TIssueSeverity } from "../Models/IssueItem";
import { GetLogService } from "./LogService";
import { XVsCodeFileSystemAdapter } from "./VsCodeFileSystemAdapter";

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
    XORMDesign,
    XORMTable,
    XORMField,
    XORMPKField,
    XORMReference,
    XORMController,
    XORMValidator,
    XPoint,
    XRect,
    XGuid,
    XSerializationEngine,
    RegisterORMElements,
    XColor,
    XConfigurationManager,
    XConfigTarget,
    XConfigGroup
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
    Description?: string;
    FillProp?: string;
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
    DesignID?: string;
    Schema?: string;
    Tables: ITableData[];
    References: IReferenceData[];
}

interface IJsonData
{
    Name?: string;
    Schema?: string;
    Tables?: ITableData[];
    References?: ILegacyReferenceData[];
}

export class XTFXBridge
{
    private _Controller: XORMController;
    private _Validator: XORMValidator;
    private _Engine: XSerializationEngine;
    private _Initialized: boolean;
    private _ContextPath: string;
    private _AllDataTypes: string[];
    private _PKDataTypes: string[];
    private _TypesLoaded: boolean;

    constructor()
    {
        this._Controller = null!;
        this._Validator = null!;
        this._Engine = null!;
        this._Initialized = false;
        this._ContextPath = "";
        this._AllDataTypes = [];
        this._PKDataTypes = [];
        this._TypesLoaded = false;
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

    /**
     * Set the context path for configuration file lookup
     * This should be the path to the current design file
     */
    SetContextPath(pPath: string): void
    {
        if (this._ContextPath !== pPath)
        {
            this._ContextPath = pPath;
            this._TypesLoaded = false;
        }
    }

    /**
     * Get the current context path
     */
    get ContextPath(): string
    {
        return this._ContextPath;
    }

    /**
     * Load data types from configuration file
     * Must be called before GetProperties if types are needed
     */
    async LoadDataTypes(): Promise<void>
    {
        if (this._TypesLoaded && this._AllDataTypes.length > 0)
            return;

        const manager = XConfigurationManager.GetInstance();
        manager.SetFileSystem(new XVsCodeFileSystemAdapter());

        try
        {
            const contextPath = this._ContextPath || process.cwd();
            
            const allTypes = await manager.GetORMDataTypes(contextPath);
            this._AllDataTypes = allTypes.map(t => t.TypeName).sort((a, b) => a.localeCompare(b));
            
            const pkTypes = await manager.GetORMPrimaryKeyTypes(contextPath);
            this._PKDataTypes = pkTypes.map(t => t.TypeName).sort((a, b) => a.localeCompare(b));

            this._TypesLoaded = true;

            GetLogService().Info(`Loaded ${this._AllDataTypes.length} data types, ${this._PKDataTypes.length} PK types from configuration`);
        }
        catch (error)
        {
            GetLogService().Error(`Failed to load data types: ${error}`);
            this._AllDataTypes = ["Boolean", "DateTime", "Guid", "Int32", "String"];
            this._PKDataTypes = ["Guid", "Int32", "Int64"];
            this._TypesLoaded = true;
        }
    }

    /**
     * Force reload of data types from configuration
     * Use when configuration file has changed
     */
    async ReloadDataTypes(): Promise<void>
    {
        this._TypesLoaded = false;
        
        const manager = XConfigurationManager.GetInstance();
        manager.ClearCache();
        
        await this.LoadDataTypes();
    }

    /**
     * Get all available data types
     */
    GetAllDataTypes(): string[]
    {
        return [...this._AllDataTypes];
    }

    /**
     * Get data types that can be used in primary keys
     */
    GetPKDataTypes(): string[]
    {
        return [...this._PKDataTypes];
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

            const tryExtractReferencePointsFromXml = (xmlText: string): Map<string, XPoint[]> =>
            {
                const pointsByRefId = new Map<string, XPoint[]>();
                // Minimal extraction of per-reference Points; this is used only as a fallback when
                // the underlying XML deserializer produces invalid point values (e.g., NaN).
                const refBlockRegex = /<XORMReference\b[^>]*\bID="([^"]+)"[^>]*>([\s\S]*?)<\/XORMReference>/g;
                let refMatch: RegExpExecArray | null;
                while ((refMatch = refBlockRegex.exec(xmlText)) !== null)
                {
                    const refId = refMatch[1];
                    const refBlock = refMatch[2];

                    const pointsDataMatch = /<XData\b[^>]*\bName="Points"[^>]*>([\s\S]*?)<\/XData>/m.exec(refBlock);
                    if (!pointsDataMatch)
                        continue;

                    const rawPoints = (pointsDataMatch[1] || "").trim();
                    if (!rawPoints)
                        continue;

                    const points: XPoint[] = [];
                    const pointRegex = /\{X=([^;]+);Y=([^}]+)\}/g;
                    let pointMatch: RegExpExecArray | null;
                    while ((pointMatch = pointRegex.exec(rawPoints)) !== null)
                    {
                        const x = Number.parseFloat(pointMatch[1]);
                        const y = Number.parseFloat(pointMatch[2]);
                        if (Number.isFinite(x) && Number.isFinite(y))
                            points.push(new XPoint(x, y));
                    }

                    if (points.length > 0)
                        pointsByRefId.set(refId, points);
                }

                return pointsByRefId;
            };

            if (pText && pText.trim().length > 0)
            {
                const trimmedText = pText.trim();
                if (trimmedText.startsWith("<?xml") || trimmedText.startsWith("<"))
                {
                    const result = this._Engine.Deserialize<XORMDocument>(pText);
                    if (result.Success && result.Data)
                    {
                        // Initialize the document to consolidate multiple XORMDesign instances
                        result.Data.Initialize();
                        this._Controller.Document = result.Data;
                        
                        // Route all lines after document is fully loaded and relationships established
                        const references = result.Data.Design?.GetReferences?.();

                        // If points were defined in the XML but deserialized into invalid values (e.g., NaN),
                        // recover them from the original XML.
                        const pointsByRefId = tryExtractReferencePointsFromXml(pText);
                        if (references && pointsByRefId.size > 0)
                        {
                            for (const ref of references)
                            {
                                const refId = String(ref?.ID);
                                const fallbackPoints = pointsByRefId.get(refId);
                                if (!fallbackPoints || fallbackPoints.length === 0)
                                    continue;

                                const hasInvalidPoint = Array.isArray(ref.Points)
                                    ? ref.Points.some((p: any) => !Number.isFinite(p?.X) || !Number.isFinite(p?.Y))
                                    : true;

                                if (hasInvalidPoint)
                                    ref.Points = fallbackPoints;
                            }
                        }

                        // Only route when there are missing/invalid points.
                        const shouldRoute = references?.some((ref: any) => {
                            const pts = ref?.Points;
                            if (!Array.isArray(pts) || pts.length === 0)
                                return true;
                            return pts.some((p: any) => !Number.isFinite(p?.X) || !Number.isFinite(p?.Y));
                        });
                        
                        if (shouldRoute)
                            result.Data.Design?.RouteAllLines?.();
                        
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

        // Update validator with types from configuration (or defaults if not loaded)
        this._Validator.ValidPKTypes = this._PKDataTypes.length > 0 ? this._PKDataTypes : ["Guid", "Int32", "Int64"];
        
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
        // Get the target table to build the FK field name
        const targetTable = this._Controller?.GetElementByID(pTargetTableID) as XORMTable | null;
        const targetName = targetTable?.Name || "Target";
        
        // First create the FK field in the source table
        const fkFieldName = `${targetName}ID`;
        
        const addFieldData: XIAddFieldData = {
            TableID: pSourceTableID,
            Name: fkFieldName
        };
        const fieldResult = this._Controller?.AddField(addFieldData);
        
        if (!fieldResult?.Success || !fieldResult?.ElementID)
            return { Success: false, Message: "Failed to create FK field." };
        
        // Now create the reference using the field ID as source
        const addRefData: XIAddReferenceData = {
            SourceFieldID: fieldResult.ElementID,
            TargetTableID: pTargetTableID,
            Name: pName || `FK_${targetName}`
        };
        return this._Controller?.AddReference(addRefData) || { Success: false };
    }

    AddField(pTableID: string, pName: string, _pDataType: string): XIOperationResult
    {
        const addFieldData: XIAddFieldData = {
            TableID: pTableID,
            Name: pName
        };
        return this._Controller?.AddField(addFieldData) || { Success: false };
    }

    AlignLines(): boolean
    {
        return this._Controller?.RouteAllLines?.() ?? false;
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
        this.Initialize();

        const element = this._Controller?.GetElementByID(pElementID);
        if (!element)
            return { Success: false, Message: "Element not found." };

        // Directly set known properties instead of using SetValueByKey
        // This avoids key mismatch issues with the property registry
        if (pPropertyKey === "Name")
            element.Name = pValue as string;
        else if (element instanceof XORMTable)
        {
            switch (pPropertyKey)
            {
                case "PKType":
                    element.PKType = pValue as string;
                    break;
                case "Description":
                    element.Description = pValue as string;
                    break;
                case "Fill":
                    if (typeof pValue === "string")
                        element.Fill = XColor.Parse(pValue);
                    else if (pValue instanceof XColor)
                        element.Fill = pValue;
                    break;
                case "X":
                case "Y":
                case "Width":
                case "Height":
                    const bounds = element.Bounds;
                    const newBounds = new XRect(
                        pPropertyKey === "X" ? (pValue as number) : bounds.Left,
                        pPropertyKey === "Y" ? (pValue as number) : bounds.Top,
                        pPropertyKey === "Width" ? (pValue as number) : bounds.Width,
                        pPropertyKey === "Height" ? (pValue as number) : bounds.Height
                    );
                    element.Bounds = newBounds;
                    break;
                default:
                    return { Success: false, Message: `Unknown property: ${pPropertyKey}` };
            }
        }
        else if (element instanceof XORMReference)
        {
            switch (pPropertyKey)
            {
                case "Description":
                    element.Description = pValue as string;
                    break;
                default:
                    return { Success: false, Message: `Unknown property: ${pPropertyKey}` };
            }
        }
        else if (element instanceof XORMField)
        {
            switch (pPropertyKey)
            {
                case "DataType":
                    // Block DataType changes on FK fields
                    if (element.IsForeignKey)
                        return { Success: false, Message: "Cannot change DataType of a foreign key field." };
                    element.DataType = pValue as string;
                    break;
                case "Length":
                    element.Length = pValue as number;
                    break;
                case "Scale":
                    element.Scale = pValue as number;
                    break;
                case "IsRequired":
                    element.IsRequired = pValue as boolean;
                    break;
                case "IsPrimaryKey":
                    return { Success: false, Message: "Primary key is structural (XORMPKField) and cannot be edited." };
                case "IsNullable":
                    element.IsNullable = pValue as boolean;
                    break;
                case "IsAutoIncrement":
                    element.IsAutoIncrement = pValue as boolean;
                    break;
                case "DefaultValue":
                    element.DefaultValue = pValue as string;
                    break;
                case "Description":
                    element.Description = pValue as string;
                    break;
                default:
                    return { Success: false, Message: `Unknown property: ${pPropertyKey}` };
            }
        }
        else if (element instanceof XORMDesign)
        {
            switch (pPropertyKey)
            {
                case "Schema":
                    element.Schema = pValue as string;
                    break;
                default:
                    return { Success: false, Message: `Unknown property: ${pPropertyKey}` };
            }
        }

        return { Success: true, ElementID: pElementID };
    }

    private static readonly _GroupOrder: Record<string, number> =
    {
        "Tenanttity": 1,
        "Data": 2,
        "Behaviour": 3,
        "Appearance": 4,
        "Design": 5,
        "Control": 6,
        "Test": 7,
        "General": 99
    };

    private GetGroupOrder(pGroup: string | undefined): number
    {
        const groupName = pGroup ?? "General";
        const order = XTFXBridge._GroupOrder[groupName];
        if (order === undefined)
            return 99;
        return order;
    }

    private SortProperties(pProps: XPropertyItem[]): XPropertyItem[]
    {
        return pProps.sort((a, b) =>
        {
            const grpA = this.GetGroupOrder(a.Group);
            const grpB = this.GetGroupOrder(b.Group);
            if (grpA !== grpB)
                return grpA - grpB;
            return a.Name.localeCompare(b.Name);
        });
    }

    GetProperties(pElementID: string): XPropertyItem[]
    {
        this.Initialize();

        const element = this._Controller?.GetElementByID(pElementID);
        if (!element)
            return [];

        const props: XPropertyItem[] = [];

        props.push(new XPropertyItem("ID", "ID", element.ID, XPropertyType.String, undefined, "Tenanttity"));
        props.push(new XPropertyItem("Name", "Name", element.Name, XPropertyType.String, undefined, "Tenanttity"));

        if (element instanceof XORMTable)
        {
            const pkTypes = this._PKDataTypes.length > 0 ? this._PKDataTypes : ["Guid", "Int32", "Int64"];
            props.push(new XPropertyItem("PKType", "PK Type", element.PKType, XPropertyType.Enum, pkTypes, "Data"));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data"));
            
            const fillColor = element.Fill;
            const colorStr = typeof fillColor.ToString === 'function' 
                ? fillColor.ToString() 
                : String(fillColor);
            props.push(new XPropertyItem("Fill", "Fill", colorStr, XPropertyType.Color, undefined, "Appearance"));

            const bounds = element.Bounds;
            props.push(new XPropertyItem("X", "X", bounds.Left, XPropertyType.Number, undefined, "Design"));
            props.push(new XPropertyItem("Y", "Y", bounds.Top, XPropertyType.Number, undefined, "Design"));
            props.push(new XPropertyItem("Width", "Width", bounds.Width, XPropertyType.Number, undefined, "Design"));
            props.push(new XPropertyItem("Height", "Height", bounds.Height, XPropertyType.Number, undefined, "Design"));
        }
        else if (element instanceof XORMReference)
        {
            props.push(new XPropertyItem("Source", "Source", element.Source, XPropertyType.String, undefined, "Data"));
            props.push(new XPropertyItem("Target", "Target", element.Target, XPropertyType.String, undefined, "Data"));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data"));
        }
        else if (element instanceof XORMField)
        {
            const allTypes = this._AllDataTypes.length > 0 ? this._AllDataTypes : ["Boolean", "DateTime", "Guid", "Int32", "String"];
            
            // Check if this field is an FK field and get expected DataType from target table
            const isForeignKey = element.IsForeignKey;
            const expectedDataType = element.GetExpectedDataType();
            const dataTypeValue = isForeignKey && expectedDataType ? expectedDataType : element.DataType;
            
            const dataTypeProp = new XPropertyItem("DataType", "Data Type", dataTypeValue, XPropertyType.Enum, allTypes, "Data");
            dataTypeProp.IsReadOnly = isForeignKey;
            props.push(dataTypeProp);
            
            props.push(new XPropertyItem("Length", "Length", element.Length, XPropertyType.Number, undefined, "Data"));
            props.push(new XPropertyItem("Scale", "Scale", element.Scale, XPropertyType.Number, undefined, "Data"));
            props.push(new XPropertyItem("IsRequired", "Required", element.IsRequired, XPropertyType.Boolean, undefined, "Behaviour"));
            const pkProp = new XPropertyItem("IsPrimaryKey", "Primary Key", element.IsPrimaryKey, XPropertyType.Boolean, undefined, "Data");
            pkProp.IsReadOnly = true;
            props.push(pkProp);
            props.push(new XPropertyItem("IsNullable", "Nullable", element.IsNullable, XPropertyType.Boolean, undefined, "Behaviour"));
            props.push(new XPropertyItem("IsAutoIncrement", "Auto Increment", element.IsAutoIncrement, XPropertyType.Boolean, undefined, "Behaviour"));
            props.push(new XPropertyItem("DefaultValue", "Default Value", element.DefaultValue, XPropertyType.String, undefined, "Data"));
            props.push(new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data"));
        }
        else if (element instanceof XORMDesign)
        {
            props.push(new XPropertyItem("Schema", "Schema", element.Schema, XPropertyType.String, undefined, "Data"));
        }

        return this.SortProperties(props);
    }

    GetElementInfo(pElementID: string): { ID: string; Name: string; Type: string } | null
    {
        this.Initialize();

        const element = this._Controller?.GetElementByID(pElementID);
        if (!element)
            return null;

        let typeName = "Unknown";
        if (element instanceof XORMDesign)
            typeName = "XORMDesign";
        else if (element instanceof XORMTable)
            typeName = "XORMTable";
        else if (element instanceof XORMReference)
            typeName = "XORMReference";
        else if (element instanceof XORMPKField)
            typeName = "XORMPKField";
        else if (element instanceof XORMField)
            typeName = "XORMField";

        return {
            ID: element.ID,
            Name: element.Name,
            Type: typeName
        };
    }

    GetModelData(): IModelData
    {
        this.Initialize();

        const doc = this._Controller?.Document;
        if (!doc || !doc.Design)
            return { Tables: [], References: [] };

        const design = doc.Design;
        const tables = this._Controller.GetTables();
        const references = this._Controller.GetReferences();

        const tablesData: ITableData[] = tables.map((t: any) => {
            // Get fields using GetChildrenOfType or directly from Fields array
            const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];
            
            // Get fill color as HTML hex string - handle both XColor objects and strings
            let fillColor: string | undefined;
            if (t.Fill)
            {
                if (typeof t.Fill.ToString === 'function')
                    fillColor = `#${t.Fill.ToString().substring(2)}`;
                else if (typeof t.Fill === 'string')
                    fillColor = t.Fill.startsWith('#') ? t.Fill : `#${t.Fill.substring(2)}`;
            }
            
            return {
                ID: t.ID,
                Name: t.Name,
                X: t.Bounds.Left,
                Y: t.Bounds.Top,
                Width: t.Bounds.Width,
                Height: t.Bounds.Height,
                FillProp: fillColor,
                Fields: fields.map((f: any) => ({
                    ID: f.ID,
                    Name: f.Name,
                    DataType: f.DataType,
                    IsPrimaryKey: f.IsPrimaryKey,
                    IsNullable: f.IsNullable
                }))
            };
        });

        // Helper para limpar pontos de roteamento (não modifica a rota, apenas limpa)
        // O roteamento correto é feito pelo XORMDesign.ts que segue as regras definidas
        const simplifyRoutePoints = (points: Array<{X: number, Y: number}>, sourceTable: any, targetTable: any): Array<{X: number, Y: number}> =>
        {
            // Retornar pontos se não houver suficientes
            if (points.length < 2) return points;

            // 1) Filtrar pontos inválidos
            const valid = points.filter(p => p && Number.isFinite(p.X) && Number.isFinite(p.Y));
            if (valid.length < 2)
                return [];

            // 2) Remover duplicados consecutivos (tolerância de 1px)
            const unique: Array<{X: number, Y: number}> = [valid[0]];
            for (let i = 1; i < valid.length; i++)
            {
                const prev = unique[unique.length - 1];
                if (Math.abs(valid[i].X - prev.X) > 1 || Math.abs(valid[i].Y - prev.Y) > 1)
                    unique.push({ X: valid[i].X, Y: valid[i].Y });
            }

            if (unique.length < 2)
                return [];

            // 3) Remover pontos colineares intermediários
            const simplified: Array<{X: number, Y: number}> = [unique[0]];
            for (let i = 1; i < unique.length - 1; i++)
            {
                const a = simplified[simplified.length - 1];
                const b = unique[i];
                const c = unique[i + 1];

                // Tolerância de 2px para considerar colinear
                const sameX = Math.abs(a.X - b.X) < 2 && Math.abs(b.X - c.X) < 2;
                const sameY = Math.abs(a.Y - b.Y) < 2 && Math.abs(b.Y - c.Y) < 2;

                if (!sameX && !sameY)
                    simplified.push(b);
            }
            simplified.push(unique[unique.length - 1]);

            return simplified;
        };

        const refsData: IReferenceData[] = references.map((r: any) => {
            // Encontrar tabelas source e target para simplificação
            const sourceTable = tables.find((t: any) => {
                const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];
                return fields.some((f: any) => f.ID === r.Source);
            });
            const targetTable = tables.find((t: any) => t.ID === r.Target);
            
            const rawPoints = r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || [];
            const simplifiedPoints = simplifyRoutePoints(rawPoints, sourceTable, targetTable);
            
            return {
                ID: r.ID,
                Name: r.Name,
                SourceFieldID: r.Source,
                TargetTableID: r.Target,
                Points: simplifiedPoints
            };
        });

        return { DesignID: design.ID, Tables: tablesData, References: refsData };
    }

    LoadFromJson(pDoc: any, pData: IJsonData): void
    {
        if (!pData || !pDoc.Design)
            return;

        const design = pDoc.Design;

        if (pData.Name)
            pDoc.Name = pData.Name;

        if (pData.Schema)
            design.Schema = pData.Schema;

        if (pData.Tables && Array.isArray(pData.Tables))
        {
            for (const tData of pData.Tables)
            {
                const table = design.CreateTable({
                    X: tData.X || 0,
                    Y: tData.Y || 0,
                    Width: tData.Width || 200,
                    Height: tData.Height || 150,
                    Name: tData.Name || ""
                });

                if (tData.ID)
                    table.ID = tData.ID;
                if (tData.Description)
                    table.Description = tData.Description;

                if (tData.Fields && Array.isArray(tData.Fields))
                {
                    const pkData = tData.Fields.find(f => f.IsPrimaryKey);
                    if (pkData)
                    {
                        let pkField = table.GetPKField();
                        if (!pkField)
                            pkField = table.CreatePKField();

                        if (pkData.Name)
                            pkField.Name = pkData.Name;

                        if (pkData.DataType)
                        {
                            let normalizedPKType: string = pkData.DataType;
                            switch (normalizedPKType)
                            {
                                case "Integer":
                                    normalizedPKType = "Int32";
                                    break;
                                case "Long":
                                    normalizedPKType = "Int64";
                                    break;
                            }

                            if (normalizedPKType === "Int32" || normalizedPKType === "Int64" || normalizedPKType === "Guid")
                                pkField.DataType = normalizedPKType;
                        }

                        if (pkData.IsAutoIncrement !== undefined)
                            pkField.IsAutoIncrement = pkData.IsAutoIncrement;

                        if (pkData.ID)
                            pkField.ID = pkData.ID;
                        if (pkData.Description)
                            pkField.Description = pkData.Description;
                    }

                    for (const fData of tData.Fields)
                    {
                        if (fData.IsPrimaryKey)
                            continue;

                        const field = table.CreateField({
                            Name: fData.Name || "",
                            DataType: (fData.DataType as string) || "String",
                            Length: fData.Length || 0,
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
            Schema: pDoc.Design.Schema,
            Tables: tables.map((t: any) => {
                // Get fields using GetChildrenOfType or directly from Fields array
                const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];
                
                return {
                    ID: t.ID,
                    Name: t.Name,
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
