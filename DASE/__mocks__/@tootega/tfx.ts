// Mock do módulo @tootega/tfx para testes unitários

export class XGuid {
    static NewValue(): string {
        return 'mock-guid-' + Math.random().toString(36).substring(2, 11);
    }
}

export class XRect {
    Left: number;
    Top: number;
    Width: number;
    Height: number;
    Bottom: number;
    Right: number;
    Size: { Width: number; Height: number };
    Location: { X: number; Y: number };

    constructor(left: number = 0, top: number = 0, width: number = 0, height: number = 0) {
        this.Left = left;
        this.Top = top;
        this.Width = width;
        this.Height = height;
        this.Bottom = top + height;
        this.Right = left + width;
        this.Size = { Width: width, Height: height };
        this.Location = { X: left, Y: top };
    }

    Contains(_x: number, _y: number): boolean { return false; }
    Intersects(_other: XRect): boolean { return false; }
    Union(_other: XRect): XRect { return this; }
    Inflate(_dx: number, _dy: number): void { }
    Offset(_dx: number, _dy: number): void { }
    Clone(): XRect { return new XRect(this.Left, this.Top, this.Width, this.Height); }
    Equals(_other: XRect): boolean { return false; }
    ToString(): string { return `${this.Left},${this.Top},${this.Width},${this.Height}`; }
    static Empty(): XRect { return new XRect(); }
    static FromLTRB(left: number, top: number, right: number, bottom: number): XRect {
        return new XRect(left, top, right - left, bottom - top);
    }
    get IsEmpty(): boolean { return this.Width === 0 && this.Height === 0; }
    get Center(): { X: number; Y: number } { return { X: this.Left + this.Width / 2, Y: this.Top + this.Height / 2 }; }
    get Area(): number { return this.Width * this.Height; }
}

export class XPoint {
    X: number;
    Y: number;

    constructor(x: number = 0, y: number = 0) {
        this.X = x;
        this.Y = y;
    }
}

export class XORMDocument {
    ID: string = '';
    Name: string = '';
    Tables: XORMTable[] = [];
    References: XORMReference[] = [];
    Design: XORMDesign;

    constructor() {
        this.Design = new XORMDesign(this);
    }

    GetTableByID(id: string): XORMTable | undefined {
        return this.Tables.find(t => t.ID === id);
    }

    GetReferenceByID(id: string): XORMReference | undefined {
        return this.References.find(r => r.ID === id);
    }
}

export class XORMDesign {
    private _Document: XORMDocument;

    constructor(pDocument: XORMDocument) {
        this._Document = pDocument;
    }

    CreateChild<T>(pType: new () => T, pOptions?: any): T {
        if ((pType as any) === XORMTable) {
            return this.CreateTable(pOptions) as unknown as T;
        }
        if ((pType as any) === XORMReference) {
            return this.CreateReference(pOptions) as unknown as T;
        }
        throw new Error(`Unsupported child type`);
    }

    DeleteChild<T extends XORMTable | XORMReference>(pChild: T): boolean {
        if (pChild instanceof XORMTable) {
            const idx = this._Document.Tables.indexOf(pChild);
            if (idx >= 0) {
                // Remove associated references
                this._Document.References = this._Document.References.filter(
                    r => r.Source !== pChild.ID && r.Target !== pChild.ID
                );
                this._Document.Tables.splice(idx, 1);
                return true;
            }
        }
        if (pChild instanceof XORMReference) {
            const idx = this._Document.References.indexOf(pChild as unknown as XORMReference);
            if (idx >= 0) {
                this._Document.References.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

    CreateTable(pOptions?: any): XORMTable {
        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = pOptions?.Name ?? this.GenerateTableName();
        table.Schema = pOptions?.Schema ?? "dbo";
        table.Bounds = new XRect(
            pOptions?.X ?? 0,
            pOptions?.Y ?? 0,
            pOptions?.Width ?? 200,
            pOptions?.Height ?? 150
        );
        this._Document.Tables.push(table);
        return table;
    }

    CreateReference(pOptions: any): XORMReference {
        const sourceTable = this._Document.Tables.find(t => t.ID === pOptions.SourceID);
        const targetTable = this._Document.Tables.find(t => t.ID === pOptions.TargetID);
        
        if (!sourceTable) throw new Error("Source table not found.");
        if (!targetTable) throw new Error("Target table not found.");

        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Name = pOptions.Name ?? `${sourceTable.Name}_${targetTable.Name}`;
        ref.Source = sourceTable.ID;
        ref.Target = targetTable.ID;
        ref.SourceID = sourceTable.ID;
        ref.TargetID = targetTable.ID;
        ref.Points = [
            new XPoint(sourceTable.X + sourceTable.Width, sourceTable.Y + sourceTable.Height / 2),
            new XPoint(targetTable.X, targetTable.Y + targetTable.Height / 2)
        ];
        this._Document.References.push(ref);
        return ref;
    }

    GetTables(): XORMTable[] {
        return this._Document.Tables;
    }

    GetReferences(): XORMReference[] {
        return this._Document.References;
    }

    FindTableByID(pID: string): XORMTable | null {
        return this._Document.Tables.find(t => t.ID === pID) ?? null;
    }

    FindReferenceByID(pID: string): XORMReference | null {
        return this._Document.References.find(r => r.ID === pID) ?? null;
    }

    GetChildrenOfType<T>(pType: new () => T): T[] {
        if ((pType as any) === XORMTable) {
            return this._Document.Tables as unknown as T[];
        }
        if ((pType as any) === XORMReference) {
            return this._Document.References as unknown as T[];
        }
        return [];
    }

    AppendChild(child: any): void {
        if (child instanceof XORMTable) {
            this._Document.Tables.push(child);
        } else if (child instanceof XORMReference) {
            this._Document.References.push(child);
        }
    }

    RemoveChild(child: any): boolean {
        if (child instanceof XORMTable) {
            const idx = this._Document.Tables.indexOf(child);
            if (idx >= 0) {
                this._Document.Tables.splice(idx, 1);
                return true;
            }
        }
        if (child instanceof XORMReference) {
            const idx = this._Document.References.indexOf(child);
            if (idx >= 0) {
                this._Document.References.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

    RouteAllLines(): void {
        // Route all references
        for (const ref of this._Document.References) {
            const sourceTable = this._Document.Tables.find(t => t.ID === ref.Source);
            const targetTable = this._Document.Tables.find(t => t.ID === ref.Target);
            if (sourceTable && targetTable) {
                ref.Points = [
                    new XPoint(sourceTable.X + sourceTable.Width, sourceTable.Y + sourceTable.Height / 2),
                    new XPoint(targetTable.X, targetTable.Y + targetTable.Height / 2)
                ];
            }
        }
    }

    private GenerateTableName(): string {
        let idx = this._Document.Tables.length + 1;
        let name = `Table${idx}`;
        while (this._Document.Tables.some(t => t.Name.toLowerCase() === name.toLowerCase())) {
            idx++;
            name = `Table${idx}`;
        }
        return name;
    }
}

export class XORMTable {
    ID: string = '';
    Name: string = '';
    Bounds: XRect = new XRect(0, 0, 150, 100);
    Schema: string = '';
    Description: string = '';
    Fields: XORMField[] = [];
    ParentNode: any = null;
    CanDelete: boolean = true;

    get X(): number { return this.Bounds.Left; }
    set X(value: number) { this.Bounds.Left = value; }
    get Y(): number { return this.Bounds.Top; }
    set Y(value: number) { this.Bounds.Top = value; }
    get Width(): number { return this.Bounds.Width; }
    set Width(value: number) { this.Bounds.Width = value; }
    get Height(): number { return this.Bounds.Height; }
    set Height(value: number) { this.Bounds.Height = value; }

    CreateChild<T extends XORMField>(_pType: new () => T, pOptions?: any): T {
        return this.CreateField(pOptions) as unknown as T;
    }

    DeleteChild<T extends XORMField>(pChild: T): boolean {
        const idx = this.Fields.indexOf(pChild as unknown as XORMField);
        if (idx >= 0 && pChild.CanDelete) {
            this.Fields.splice(idx, 1);
            return true;
        }
        return false;
    }

    CreateField(pOptions?: any): XORMField {
        const field = new XORMField();
        field.ID = XGuid.NewValue();
        field.Name = pOptions?.Name ?? this.GenerateFieldName();
        field.DataType = pOptions?.DataType ?? 'String';
        field.Length = pOptions?.Length ?? 0;
        field.IsPrimaryKey = pOptions?.IsPrimaryKey ?? false;
        field.IsNullable = pOptions?.IsNullable ?? true;
        field.IsAutoIncrement = pOptions?.IsAutoIncrement ?? false;
        field.DefaultValue = pOptions?.DefaultValue ?? '';
        field.ParentNode = this;
        this.Fields.push(field);
        return field;
    }

    GetFields(): XORMField[] {
        return this.Fields;
    }

    FindFieldByID(pID: string): XORMField | null {
        return this.Fields.find(f => f.ID === pID) ?? null;
    }

    FindFieldByName(pName: string): XORMField | null {
        const lowerName = pName.toLowerCase();
        return this.Fields.find(f => f.Name.toLowerCase() === lowerName) ?? null;
    }

    GetChildrenOfType(_type: any): XORMField[] {
        return this.Fields;
    }

    AppendChild(child: XORMField): void {
        child.ParentNode = this;
        this.Fields.push(child);
    }

    RemoveChild(child: XORMField): boolean {
        const idx = this.Fields.indexOf(child);
        if (idx >= 0) {
            this.Fields.splice(idx, 1);
            child.ParentNode = null;
            return true;
        }
        return false;
    }

    private GenerateFieldName(): string {
        let idx = this.Fields.length + 1;
        let name = `Field${idx}`;
        while (this.Fields.some(f => f.Name.toLowerCase() === name.toLowerCase())) {
            idx++;
            name = `Field${idx}`;
        }
        return name;
    }
}

export class XORMField {
    ID: string = '';
    Name: string = '';
    DataType: string = 'VARCHAR';
    IsPrimaryKey: boolean = false;
    IsNullable: boolean = true;
    Length: number = 255;
    IsAutoIncrement: boolean = false;
    DefaultValue: string = '';
    Description: string = '';
    ParentNode: any = null;
    CanDelete: boolean = true;
}

export class XORMReference {
    ID: string = '';
    Name: string = '';
    SourceID: string = '';
    TargetID: string = '';
    Source: string = '';
    Target: string = '';
    Description: string = '';
    Points: XPoint[] = [];
    ParentNode: any = null;
    CanDelete: boolean = true;
}

export class XORMController {
    Document: XORMDocument | null = null;

    get Design(): XORMDesign | null {
        return this.Document?.Design ?? null;
    }

    AddTable(params: any): { Success: boolean; ElementID?: string } {
        if (!this.Document || !this.Design) return { Success: false };
        
        const table = this.Design.CreateChild(XORMTable, {
            X: params.X,
            Y: params.Y,
            Name: params.Name,
            Schema: params.Schema
        });
        
        return { Success: true, ElementID: table.ID };
    }

    AddReference(params: any): { Success: boolean; ElementID?: string; Message?: string } {
        if (!this.Document || !this.Design) return { Success: false };
        
        try {
            const ref = this.Design.CreateChild(XORMReference, {
                SourceID: params.SourceID,
                TargetID: params.TargetID,
                Name: params.Name
            });
            return { Success: true, ElementID: ref.ID };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create reference.";
            return { Success: false, Message: message };
        }
    }

    AddField(params: any): { Success: boolean; ElementID?: string } {
        if (!this.Document) return { Success: false };
        
        const table = this.Document.Tables.find(t => t.ID === params.TableID);
        if (!table) return { Success: false };
        
        const field = table.CreateChild(XORMField, {
            Name: params.Name
        });
        
        return { Success: true, ElementID: field.ID };
    }

    RouteAllLines(): boolean {
        if (!this.Document || !this.Design) return false;
        this.Design.RouteAllLines();
        return true;
    }

    RemoveElement(_id: string): { Success: boolean; Message?: string } {
        if (!this.Document || !this.Design) return { Success: false };
        
        const element = this.GetElementByID(_id);
        if (!element) return { Success: false, Message: "Element not found." };
        if (!element.CanDelete) return { Success: false, Message: "Element cannot be deleted." };

        if (element instanceof XORMTable) {
            const deleted = this.Design.DeleteChild(element);
            return { Success: deleted };
        }
        
        if (element instanceof XORMReference) {
            const deleted = this.Design.DeleteChild(element as unknown as XORMReference);
            return { Success: deleted };
        }
        
        if (element instanceof XORMField) {
            const table = element.ParentNode;
            if (table instanceof XORMTable) {
                const deleted = table.DeleteChild(element);
                return { Success: deleted };
            }
        }
        
        return { Success: false, Message: "Unknown element type." };
    }

    RenameElement(params: any): { Success: boolean } {
        if (!this.Document) return { Success: false };
        
        const table = this.Document.Tables.find(t => t.ID === params.ElementID);
        if (table) {
            table.Name = params.NewName;
            return { Success: true };
        }
        
        const ref = this.Document.References.find(r => r.ID === params.ElementID);
        if (ref) {
            ref.Name = params.NewName;
            return { Success: true };
        }
        
        return { Success: false };
    }

    MoveElement(params: any): { Success: boolean } {
        if (!this.Document) return { Success: false };
        
        const table = this.Document.Tables.find(t => t.ID === params.ElementID);
        if (table) {
            table.Bounds.Left = params.X;
            table.Bounds.Top = params.Y;
            return { Success: true };
        }
        
        return { Success: false };
    }

    UpdateProperty(params: any): { Success: boolean } {
        const element = this.GetElementByID(params.ElementID);
        if (!element) return { Success: false };
        
        if (params.PropertyKey in element) {
            (element as any)[params.PropertyKey] = params.Value;
            return { Success: true };
        }
        
        return { Success: false };
    }

    GetElementByID(id: string): XORMTable | XORMReference | XORMField | null {
        if (!this.Document) return null;
        
        const table = this.Document.Tables.find(t => t.ID === id);
        if (table) return table;
        
        const ref = this.Document.References.find(r => r.ID === id);
        if (ref) return ref;
        
        // Also search in fields
        for (const t of this.Document.Tables) {
            const field = t.Fields.find(f => f.ID === id);
            if (field) return field as any;
        }
        
        return null;
    }

    GetTables(): XORMTable[] {
        return this.Document?.Tables || [];
    }

    GetReferences(): XORMReference[] {
        return this.Document?.References || [];
    }
}

export interface IValidationIssue {
    ElementID: string;
    ElementName: string;
    Severity: number;
    Message: string;
    PropertyID?: string;
}

export class XORMValidator {
    Validate(doc: XORMDocument): IValidationIssue[] {
        const issues: IValidationIssue[] = [];
        
        // Validação básica para testes
        for (const table of doc.Tables) {
            if (!table.Name || table.Name.trim() === '') {
                issues.push({
                    ElementID: table.ID,
                    ElementName: table.Name || 'Unknown',
                    Severity: XDesignerErrorSeverity.Error,
                    Message: 'Table name is required'
                });
            }
            
            if (table.Fields.length === 0) {
                issues.push({
                    ElementID: table.ID,
                    ElementName: table.Name,
                    Severity: XDesignerErrorSeverity.Warning,
                    Message: 'Table has no fields'
                });
            }
        }

        return issues;
    }
}

export const XDesignerErrorSeverity = {
    Error: 2,
    Warning: 1,
    Info: 0
} as const;

export const XORMFieldDataType = {
    String: 'String',
    Integer: 'Integer',
    Long: 'Long',
    Decimal: 'Decimal',
    Boolean: 'Boolean',
    DateTime: 'DateTime',
    Guid: 'Guid',
    Binary: 'Binary',
    Text: 'Text'
} as const;

export class XSerializationEngine {
    private static _instance: XSerializationEngine | null = null;

    static get Instance(): XSerializationEngine {
        if (!XSerializationEngine._instance) {
            XSerializationEngine._instance = new XSerializationEngine();
        }
        return XSerializationEngine._instance;
    }

    SaveToXml(doc: XORMDocument): string {
        let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
        xml += `<XORMDocument ID="${doc.ID}" Name="${this.escapeXml(doc.Name)}">\n`;
        xml += '  <Design>\n';
        
        // Tables
        for (const table of doc.Tables) {
            xml += `    <XORMTable ID="${table.ID}" Name="${this.escapeXml(table.Name)}" Schema="${this.escapeXml(table.Schema)}">\n`;
            xml += `      <Bounds Left="${table.Bounds.Left}" Top="${table.Bounds.Top}" Width="${table.Bounds.Width}" Height="${table.Bounds.Height}" />\n`;
            xml += '      <Fields>\n';
            for (const field of table.Fields) {
                xml += `        <XORMField ID="${field.ID}" Name="${this.escapeXml(field.Name)}" DataType="${field.DataType}" `;
                xml += `IsPrimaryKey="${field.IsPrimaryKey}" IsNullable="${field.IsNullable}" `;
                xml += `Length="${field.Length}" IsAutoIncrement="${field.IsAutoIncrement}" />\n`;
            }
            xml += '      </Fields>\n';
            xml += '    </XORMTable>\n';
        }
        
        // References
        for (const ref of doc.References) {
            xml += `    <XORMReference ID="${ref.ID}" Name="${this.escapeXml(ref.Name)}" `;
            xml += `SourceID="${ref.SourceID || ref.Source}" TargetID="${ref.TargetID || ref.Target}">\n`;
            xml += '      <Points>\n';
            for (const pt of ref.Points) {
                xml += `        <Point X="${pt.X}" Y="${pt.Y}" />\n`;
            }
            xml += '      </Points>\n';
            xml += '    </XORMReference>\n';
        }
        
        xml += '  </Design>\n';
        xml += '</XORMDocument>';
        return xml;
    }

    LoadFromXml(xml: string, _docType: any): XORMDocument | null {
        // Simple XML parser for the ORM document format
        try {
            const doc = new XORMDocument();
            
            // Parse Document attributes
            const docMatch = xml.match(/<XORMDocument[^>]*ID="([^"]*)"[^>]*Name="([^"]*)"/);
            if (docMatch) {
                doc.ID = docMatch[1];
                doc.Name = this.unescapeXml(docMatch[2]);
            }
            
            // Parse Tables
            const tableRegex = /<XORMTable[^>]*ID="([^"]*)"[^>]*Name="([^"]*)"[^>]*Schema="([^"]*)"[^>]*>([\s\S]*?)<\/XORMTable>/g;
            let tableMatch;
            while ((tableMatch = tableRegex.exec(xml)) !== null) {
                const table = new XORMTable();
                table.ID = tableMatch[1];
                table.Name = this.unescapeXml(tableMatch[2]);
                table.Schema = this.unescapeXml(tableMatch[3]);
                
                const tableContent = tableMatch[4];
                
                // Parse Bounds
                const boundsMatch = tableContent.match(/<Bounds[^>]*Left="(\d+)"[^>]*Top="(\d+)"[^>]*Width="(\d+)"[^>]*Height="(\d+)"/);
                if (boundsMatch) {
                    table.Bounds = new XRect(
                        parseInt(boundsMatch[1]),
                        parseInt(boundsMatch[2]),
                        parseInt(boundsMatch[3]),
                        parseInt(boundsMatch[4])
                    );
                }
                
                // Parse Fields
                const fieldRegex = /<XORMField[^>]*ID="([^"]*)"[^>]*Name="([^"]*)"[^>]*DataType="([^"]*)"[^>]*IsPrimaryKey="([^"]*)"[^>]*IsNullable="([^"]*)"[^>]*Length="([^"]*)"[^>]*IsAutoIncrement="([^"]*)"/g;
                let fieldMatch;
                while ((fieldMatch = fieldRegex.exec(tableContent)) !== null) {
                    const field = new XORMField();
                    field.ID = fieldMatch[1];
                    field.Name = this.unescapeXml(fieldMatch[2]);
                    field.DataType = fieldMatch[3];
                    field.IsPrimaryKey = fieldMatch[4] === 'true';
                    field.IsNullable = fieldMatch[5] === 'true';
                    field.Length = parseInt(fieldMatch[6]) || 0;
                    field.IsAutoIncrement = fieldMatch[7] === 'true';
                    table.Fields.push(field);
                }
                
                doc.Tables.push(table);
            }
            
            // Parse References
            const refRegex = /<XORMReference[^>]*ID="([^"]*)"[^>]*Name="([^"]*)"[^>]*SourceID="([^"]*)"[^>]*TargetID="([^"]*)"[^>]*>([\s\S]*?)<\/XORMReference>/g;
            let refMatch;
            while ((refMatch = refRegex.exec(xml)) !== null) {
                const ref = new XORMReference();
                ref.ID = refMatch[1];
                ref.Name = this.unescapeXml(refMatch[2]);
                ref.SourceID = refMatch[3];
                ref.TargetID = refMatch[4];
                ref.Source = refMatch[3];
                ref.Target = refMatch[4];
                
                const refContent = refMatch[5];
                
                // Parse Points
                const pointRegex = /<Point[^>]*X="([^"]*)"[^>]*Y="([^"]*)"/g;
                let pointMatch;
                while ((pointMatch = pointRegex.exec(refContent)) !== null) {
                    ref.Points.push(new XPoint(parseFloat(pointMatch[1]), parseFloat(pointMatch[2])));
                }
                
                doc.References.push(ref);
            }
            
            return doc;
        } catch (err) {
            console.error("LoadFromXml error:", err);
            return null;
        }
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private unescapeXml(str: string): string {
        return str
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&');
    }
}

export function RegisterORMElements(): void {
    // Mock implementation - no-op for tests
}
