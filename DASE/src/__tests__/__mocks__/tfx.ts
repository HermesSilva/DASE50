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
    Design: any;

    constructor() {
        // Bind AppendChild to this instance
        this.Design = {
            AppendChild: (child: any) => {
                // Check by property existence instead of instanceof
                if (child && child.Bounds !== undefined && child.Fields !== undefined) {
                    this.Tables.push(child);
                } else if (child && (child.Source !== undefined || child.SourceID !== undefined)) {
                    this.References.push(child);
                }
            }
        };
    }

    GetTableByID(id: string): XORMTable | undefined {
        return this.Tables.find(t => t.ID === id);
    }

    GetReferenceByID(id: string): XORMReference | undefined {
        return this.References.find(r => r.ID === id);
    }
}

export class XORMTable {
    ID: string = '';
    Name: string = '';
    Bounds: XRect = new XRect(0, 0, 150, 100);
    Schema: string = '';
    Description: string = '';
    Fields: XORMField[] = [];

    get X(): number { return this.Bounds.Left; }
    set X(value: number) { this.Bounds.Left = value; }
    get Y(): number { return this.Bounds.Top; }
    set Y(value: number) { this.Bounds.Top = value; }
    get Width(): number { return this.Bounds.Width; }
    set Width(value: number) { this.Bounds.Width = value; }
    get Height(): number { return this.Bounds.Height; }
    set Height(value: number) { this.Bounds.Height = value; }

    GetChildrenOfType(_type: any): XORMField[] {
        return this.Fields;
    }

    AppendChild(child: XORMField): void {
        this.Fields.push(child);
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
}

export class XORMController {
    Document: XORMDocument | null = null;

    AddTable(_params: any): { Success: boolean } {
        return { Success: true };
    }

    AddReference(_params: any): { Success: boolean } {
        return { Success: true };
    }

    RemoveElement(_id: string): boolean {
        return true;
    }

    RenameElement(_params: any): boolean {
        return true;
    }

    MoveElement(_params: any): boolean {
        return true;
    }

    UpdateProperty(_params: any): boolean {
        return true;
    }

    GetElementByID(_id: string): XORMTable | XORMReference | null {
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
}
