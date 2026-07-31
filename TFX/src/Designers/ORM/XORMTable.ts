import { XRectangle } from "../../Design/XRectangle.js";
import { XRect } from "../../Core/XGeometry.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XORMField } from "./XORMField.js";
import { XORMPKField } from "./XORMPKField.js";
import { XORMStateField } from "./XORMStateField.js";
import type { XORMDesign } from "./XORMDesign.js";
import type { XORMReference } from "./XORMReference.js";

export interface XICreateFieldOptions
{
    Name?: string;
    DataType?: string;
    Length?: number;
    IsRequired?: boolean;
    IsAutoIncrement?: boolean;
    DefaultValue?: string;
    /** Pipe-separated list of allowed values (enum constraint). */
    AllowedValues?: string;
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
        "8F3E9777-A802-4A9F-B5B5-0D5D568E0365",
        "PKType",
        "Primary Key Type",
        "Int32"
    );

    public static readonly IsShadowProp = XProperty.Register<XORMTable, boolean>(
        (p: XORMTable) => p.IsShadow,
        "7E3F9A2C-D1B8-4E6F-A3C5-2D9F7B1E4A6C",
        "IsShadow",
        "Is Shadow Table",
        false
    );

    public static readonly ShadowDocumentIDProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.ShadowDocumentID,
        "B4A7D3F1-8C2E-4A9B-D6F4-3E1C8B5D2A7F",
        "ShadowDocumentID",
        "Shadow Document ID",
        ""
    );

    public static readonly ShadowDocumentNameProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.ShadowDocumentName,
        "C9E2B6A4-F3D7-4C1E-B8A3-5D2F9C7E1B4A",
        "ShadowDocumentName",
        "Shadow Document Name",
        ""
    );

    public static readonly ShadowTableIDProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.ShadowTableID,
        "D6F4C1B8-A2E9-4F3B-C7D1-8E5B4A9F6C2D",
        "ShadowTableID",
        "Shadow Table ID",
        ""
    );

    public static readonly ShadowTableNameProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.ShadowTableName,
        "E1A8F5C3-B7D4-4A2C-E9B6-4F1D8A3C7E5B",
        "ShadowTableName",
        "Shadow Table Name",
        ""
    );

    public static readonly ShadowModuleIDProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.ShadowModuleID,
        "F3D2A7E6-C8B1-4D5A-F2C9-7B4E1A6D3F8C",
        "ShadowModuleID",
        "Shadow Module ID",
        ""
    );

    public static readonly ShadowModuleNameProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.ShadowModuleName,
        "A7C5E1F4-D9B2-4B8A-E5D3-1C6F9A4E7B2D",
        "ShadowModuleName",
        "Shadow Module Name",
        ""
    );

    /** Whether this table participates in the design's state-control pattern. Persisted; GUID matches C# UseState. */
    public static readonly UseStateControlProp = XProperty.Register<XORMTable, boolean>(
        (p: XORMTable) => p.UseStateControl,
        "04C4A96C-B8C1-4EB3-8F56-72766FCE1823",
        "UseStateControl",
        "Use State Control",
        false
    );

    /**
     * Esta tabela participa da geração de código. Default TRUE.
     * Desmarcar exclui a tabela da geração sem removê-la do modelo — útil para
     * tabela de terceiros ou ainda em estudo, que deve aparecer no diagrama mas
     * não virar arquivo.
     */
    public static readonly GenerateCodeProp = XProperty.Register<XORMTable, boolean>(
        (p: XORMTable) => p.GenerateCode,
        "B7D3E8A1-4C56-4F29-9B7E-3A5D8C2F6E14",
        "GenerateCode",
        "Generate Code",
        true
    );

    /**
     * Papel da tabela na geração: `Entity` ou `Lookup`. Vazio (o default) deixa o gerador
     * deduzir pela forma da tabela.
     *
     * O override existe porque a forma não basta: uma tabela-lookup e um catálogo pequeno
     * são estruturalmente idênticos — chave inteira e colunas de texto —, mas geram código
     * completamente diferente (enum + classe + config, contra entidade + config).
     * Espelho não entra aqui: `IsShadow` já o determina.
     */
    public static readonly StereotypeProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.Stereotype,
        "6E4A9C21-8D37-4B5F-A2E8-9C1B4D7F3A56",
        "Stereotype",
        "Stereotype",
        ""
    );

    /**
     * Tabela-modelo: existe para ser herdada, e não para virar tabela.
     *
     * Marcada, a tabela sai INTEIRA da geração — nenhum arquivo nasce dela, e nem
     * migração —, e seus campos só aparecem achatados dentro de quem a declara em
     * {@link Inheritance}. É o que separa a base comum (auditoria, posse, versionamento)
     * de uma entidade real que por acaso também é herdada.
     *
     * Distinta de `GenerateCode = false`, que é a tabela ainda em estudo: aquela não gera
     * nem cede nada; esta não gera, mas é a origem dos campos de outras.
     */
    public static readonly IsModelProp = XProperty.Register<XORMTable, boolean>(
        (p: XORMTable) => p.IsModel,
        "5C1D8A34-9F62-4E7B-B03A-6D2F91C4E87A",
        "IsModel",
        "Is Model Table",
        false
    );

    /**
     * Nome da tabela cujos campos esta também gera. Vazio (o default) é o normal.
     *
     * Guarda NOME, e não ID, porque a base pode morar em outro modelo — pai ou importado —,
     * exatamente como `StateControlTable` no design. Quem resolve procura primeiro no
     * próprio modelo e depois nos modelos declarados; não achando em lugar nenhum, a
     * validação acusa em vez de gerar uma tabela com colunas faltando.
     */
    public static readonly InheritanceProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.Inheritance,
        "2B9F4E17-6A3C-4D58-9E12-7C4A0B8D5F3E",
        "Inheritance",
        "Inheritance",
        ""
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
        // PKType é a fonte da verdade: propaga para o campo PK e para todas as
        // FKs que dependem desta tabela.
        this.PropagatePKType(pValue);
    }

    /**
     * Empurra o PKType da tabela para baixo:
     *   - campo PK (XORMPKField) — único caminho que altera seu DataType travado;
     *   - todas as FKs (em qualquer tabela do design) que referenciam esta tabela.
     */
    private PropagatePKType(pType: string): void
    {
        const pkField = this.GetPKField();
        if (pkField !== null)
            pkField.SetDataTypeFromTable(pType, this);

        const design = this.ParentNode as XORMDesign | null;
        if (!design || typeof design.GetReferences !== "function" || typeof design.FindFieldByID !== "function")
            return;

        for (const ref of design.GetReferences() as XORMReference[])
        {
            if (ref.Target !== this.ID)
                continue;

            const fkField = design.FindFieldByID(ref.Source);
            if (fkField !== null && fkField.DataType !== pType)
                fkField.DataType = pType;
        }
    }

    public get IsShadow(): boolean
    {
        return this.GetValue(XORMTable.IsShadowProp) as boolean;
    }

    public set IsShadow(pValue: boolean)
    {
        this.SetValue(XORMTable.IsShadowProp, pValue);
    }

    public get ShadowDocumentID(): string
    {
        return this.GetValue(XORMTable.ShadowDocumentIDProp) as string;
    }

    public set ShadowDocumentID(pValue: string)
    {
        this.SetValue(XORMTable.ShadowDocumentIDProp, pValue);
    }

    public get ShadowDocumentName(): string
    {
        return this.GetValue(XORMTable.ShadowDocumentNameProp) as string;
    }

    public set ShadowDocumentName(pValue: string)
    {
        this.SetValue(XORMTable.ShadowDocumentNameProp, pValue);
    }

    public get ShadowTableID(): string
    {
        return this.GetValue(XORMTable.ShadowTableIDProp) as string;
    }

    public set ShadowTableID(pValue: string)
    {
        this.SetValue(XORMTable.ShadowTableIDProp, pValue);
    }

    public get ShadowTableName(): string
    {
        return this.GetValue(XORMTable.ShadowTableNameProp) as string;
    }

    public set ShadowTableName(pValue: string)
    {
        this.SetValue(XORMTable.ShadowTableNameProp, pValue);
    }

    public get ShadowModuleID(): string
    {
        return this.GetValue(XORMTable.ShadowModuleIDProp) as string;
    }

    public set ShadowModuleID(pValue: string)
    {
        this.SetValue(XORMTable.ShadowModuleIDProp, pValue);
    }

    public get ShadowModuleName(): string
    {
        return this.GetValue(XORMTable.ShadowModuleNameProp) as string;
    }

    public set ShadowModuleName(pValue: string)
    {
        this.SetValue(XORMTable.ShadowModuleNameProp, pValue);
    }

    public get UseStateControl(): boolean
    {
        return this.GetValue(XORMTable.UseStateControlProp) as boolean;
    }

    public set UseStateControl(pValue: boolean)
    {
        this.SetValue(XORMTable.UseStateControlProp, pValue);
    }

    /** Se esta tabela participa da geração de código. Default true. */
    public get GenerateCode(): boolean
    {
        return this.GetValue(XORMTable.GenerateCodeProp) as boolean;
    }

    public set GenerateCode(pValue: boolean)
    {
        this.SetValue(XORMTable.GenerateCodeProp, pValue);
    }

    /** Papel na geração: "Entity", "Lookup" ou vazio para deduzir pela forma. */
    public get Stereotype(): string
    {
        return this.GetValue(XORMTable.StereotypeProp) as string;
    }

    public set Stereotype(pValue: string)
    {
        this.SetValue(XORMTable.StereotypeProp, pValue);
    }

    /** Tabela-modelo: não gera nada; só cede campos a quem a herda. Default false. */
    public get IsModel(): boolean
    {
        return this.GetValue(XORMTable.IsModelProp) as boolean;
    }

    public set IsModel(pValue: boolean)
    {
        this.SetValue(XORMTable.IsModelProp, pValue);
    }

    /** Nome da tabela-base cujos campos esta também gera, ou vazio. */
    public get Inheritance(): string
    {
        return this.GetValue(XORMTable.InheritanceProp) as string;
    }

    public set Inheritance(pValue: string)
    {
        this.SetValue(XORMTable.InheritanceProp, pValue);
    }

    /** Returns the XORMStateField child of this table, or null if none exists. */
    public GetStateField(): XORMStateField | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMStateField)
                return child;
        }
        return null;
    }

    /**
     * Creates an XORMStateField child and appends it to this table.
     * @param pDataType DataType to assign (should match the target state table's PKType).
     * @param pFieldName Name of the field (convention: `${stateTableName}ID`).
     */
    public CreateStateField(pDataType: string, pFieldName: string): XORMStateField
    {
        const stateField = new XORMStateField();
        stateField.ID = XGuid.NewValue();
        stateField.Name = pFieldName;
        stateField.DataType = pDataType;
        stateField.IsRequired = true;
        this.AppendChild(stateField);
        this.UpdateFieldIndexes();
        this.UpdateHeightForFields();
        return stateField;
    }

    /**
     * Removes the XORMStateField from this table.
     * @returns true if a state field was found and removed; false if none existed.
     */
    public DeleteStateField(): boolean
    {
        const stateField = this.GetStateField();
        if (stateField === null)
            return false;
        this.RemoveChild(stateField);
        this.UpdateFieldIndexes();
        this.UpdateHeightForFields();
        return true;
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

        if (pOptions?.Name)
            pkField.Name = pOptions.Name;

        // Insere o PKField como primeiro filho ANTES de travar/definir o tipo,
        // para que GetPKField() o reconheça e a propagação de PKType funcione.
        this.InsertChildAt(pkField, 0);

        // Trava o DataType: a partir daqui só a tabela (via PKType) altera o tipo.
        pkField.LockDataType();

        // PKType é a fonte da verdade. Define o tipo desejado (opção ou default
        // atual da tabela) e propaga para o campo PK travado.
        this.PKType = pOptions?.DataType ?? this.PKType;

        // Override explícito de auto-increment vence o default derivado do tipo.
        if (pOptions?.IsAutoIncrement !== undefined)
            pkField.IsAutoIncrement = pOptions.IsAutoIncrement;

        this.UpdateFieldIndexes();
        this.UpdateHeightForFields();
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

        field.IsRequired = pOptions?.IsRequired ?? true;

        field.IsAutoIncrement = pOptions?.IsAutoIncrement ?? false;
        field.DefaultValue = pOptions?.DefaultValue ?? "";
        if (pOptions?.AllowedValues)
            field.AllowedValues = pOptions.AllowedValues;

        this.AppendChild(field);
        this.UpdateFieldIndexes();
        this.UpdateHeightForFields();
        return field;
    }

    public DeleteField(pField: XORMField): boolean
    {
        if (pField.ParentNode !== this)
            return false;

        if (!pField.CanDelete)
            return false;

        // A linha da chave estrangeira sai deste campo: sem ele, ela não representa mais
        // nada e ficaria solta no diagrama, apontando para o nada e voltando como erro a
        // cada validação. Some junto com a coluna que a originou.
        const design = this.ParentNode as XORMDesign | null;
        const removeuReferencia = (design?.RemoveReferencesForField?.(pField.ID) ?? 0) > 0;

        this.RemoveChild(pField);
        this.UpdateFieldIndexes();
        this.UpdateHeightForFields();

        // Tirar uma linha muda o traçado das que sobraram.
        if (removeuReferencia)
            design?.RouteAllLines?.();

        return true;
    }

    /**
     * Moves a field to a new index position within the table.
     * PKFields cannot be moved (they are always at index 0).
     * @param pField The field to move
     * @param pNewIndex The target index (0-based, but PKField always occupies 0)
     * @returns true if move was successful
     */
    public MoveFieldToIndex(pField: XORMField, pNewIndex: number): boolean
    {
        if (pField.ParentNode !== this)
            return false;

        // PKField cannot be moved - it's always first
        if (pField instanceof XORMPKField)
            return false;

        const fields = this.GetFields();
        const currentIndex = fields.indexOf(pField);
        if (currentIndex < 0)
            return false;

        // PKField is always at index 0 in children, so adjust target
        const hasPK = this.HasPKField();
        const minIndex = hasPK ? 1 : 0;
        const maxIndex = fields.length - 1;

        // Clamp to valid range
        const targetIndex = Math.max(minIndex, Math.min(pNewIndex, maxIndex));
        if (targetIndex === currentIndex)
            return false;

        // Calculate actual child index (PKField shifts everything by 1)
        const childIndex = hasPK ? targetIndex : targetIndex;
        this.InsertChildAt(pField, childIndex);
        this.UpdateFieldIndexes();

        return true;
    }

    /**
     * Updates the Index property of all fields to match their position
     */
    public UpdateFieldIndexes(): void
    {
        const fields = this.GetFields();
        for (let i = 0; i < fields.length; i++)
            fields[i].Index = i;
    }

    /**
     * Updates the table height based on the number of fields
     * headerHeight=28, fieldHeight=16, minBodyHeight=40
     */
    private UpdateHeightForFields(): void
    {
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;
        
        // Empty table = only header height
        // Table with fields = header + (fieldCount * fieldHeight) + padding
        const fieldCount = this.GetFields().length;
        const bodyHeight = fieldCount > 0 ? fieldCount * fieldHeight + padding : 0;
        const newHeight = headerHeight + bodyHeight;
        
        const bounds = this.Bounds;
        if (bounds.Height !== newHeight)
            this.Bounds = new XRect(bounds.Left, bounds.Top, bounds.Width, newHeight);
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
