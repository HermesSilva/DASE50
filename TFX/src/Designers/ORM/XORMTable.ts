import { XRectangle } from "../../Design/XRectangle.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XORMField } from "./XORMField.js";
import { XORMPKField } from "./XORMPKField.js";

export interface XICreateFieldOptions
{
    Name?: string;
    DataType?: string;
    Length?: number;
    IsNullable?: boolean;
    IsAutoIncrement?: boolean;
    DefaultValue?: string;
}

export interface XICreatePKFieldOptions
{
    Name?: string;
    DataType?: "Int32" | "Int64" | "Guid";
    IsAutoIncrement?: boolean;
}

export class XORMTable extends XRectangle
{
    public static readonly PKTypeProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.PKType,
        "00000001-0002-0003-0002-000000000001",
        "PKType",
        "Primary Key Type",
        "Int32"
    );

    public constructor()
    {
        super();
    }

    public get PKType(): string
    {
        return this.GetValue(XORMTable.PKTypeProp) as string;
    }

    public set PKType(pValue: string)
    {
        this.SetValue(XORMTable.PKTypeProp, pValue);
    }

    /**
     * Obtém o campo de chave primária da tabela
     * Retorna null se a tabela não tiver um campo PK
     */
    public GetPKField(): XORMPKField | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMPKField)
                return child;
        }
        return null;
    }

    /**
     * Verifica se a tabela tem um campo de chave primária
     */
    public HasPKField(): boolean
    {
        return this.GetPKField() !== null;
    }

    /**
     * Cria o campo de chave primária para a tabela
     * Se já existir um PKField, retorna o existente
     */
    public CreatePKField(pOptions?: XICreatePKFieldOptions): XORMPKField
    {
        // Se já tem PKField, retorna o existente
        const existing = this.GetPKField();
        if (existing !== null)
            return existing;

        const pkField = new XORMPKField();
        pkField.ID = XGuid.NewValue();

        // Aplica opções se fornecidas
        if (pOptions?.Name)
            pkField.Name = pOptions.Name;
        if (pOptions?.DataType)
            pkField.DataType = pOptions.DataType;
        if (pOptions?.IsAutoIncrement !== undefined)
            pkField.IsAutoIncrement = pOptions.IsAutoIncrement;

        // Trava o DataType após configuração inicial
        pkField.LockDataType();

        // Sincroniza o PKType da tabela com o DataType do campo
        this.PKType = pkField.DataType;

        // Insere o PKField como primeiro filho
        this.InsertChildAt(pkField, 0);
        return pkField;
    }

    /**
     * Garante que a tabela tenha um campo PK
     * Cria um se não existir (usado para UserFix)
     */
    public EnsurePKField(): XORMPKField
    {
        return this.CreatePKField();
    }

    public CreateField(pOptions?: XICreateFieldOptions): XORMField
    {
        const field = new XORMField();
        field.ID = XGuid.NewValue();
        field.Name = pOptions?.Name ?? this.GenerateFieldName();
        field.DataType = pOptions?.DataType ?? "String";
        field.Length = pOptions?.Length ?? 0;
        field.IsNullable = pOptions?.IsNullable ?? true;
        field.IsAutoIncrement = pOptions?.IsAutoIncrement ?? false;
        field.DefaultValue = pOptions?.DefaultValue ?? "";

        this.AppendChild(field);
        return field;
    }

    public DeleteField(pField: XORMField): boolean
    {
        if (pField.ParentNode !== this)
            return false;

        if (!pField.CanDelete)
            return false;

        return this.RemoveChild(pField);
    }

    public GetFields(): XORMField[]
    {
        return this.GetChildrenOfType(XORMField);
    }

    public FindFieldByID(pID: string): XORMField | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMField && child.ID === pID)
                return child;
        }
        return null;
    }

    public FindFieldByName(pName: string): XORMField | null
    {
        const lowerName = pName.toLowerCase();
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMField && child.Name.toLowerCase() === lowerName)
                return child;
        }
        return null;
    }

    private GenerateFieldName(): string
    {
        const fields = this.GetFields();
        let idx = fields.length + 1;
        let name = `Field${idx}`;

        while (fields.some(f => f.Name.toLowerCase() === name.toLowerCase()))
        {
            idx++;
            name = `Field${idx}`;
        }

        return name;
    }
}
