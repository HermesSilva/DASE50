import { XGuid } from "../../Core/XGuid.js";
import { XValidator } from "../../Core/XValidation.js";
import type { XIValidationIssue } from "../../Core/XValidation.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";
import { XORMPKField } from "./XORMPKField.js";
import { XORMIndex } from "./XORMIndex.js";
import { ResolveInheritance } from "./XORMInheritance.js";

export type XIORMValidationIssue = XIValidationIssue;

export class XORMValidator extends XValidator<XORMDocument, XORMDesign>
{
    /**
     * Tipos de dados válidos para campos de chave primária.
     * Deve ser preenchido a partir do ORM.Types.json.
     */
    public ValidPKTypes: string[] = [];

    private _Mutated: boolean = false;

    /**
     * A última validação ALTEROU o modelo. Validar aqui não é só olhar: chave que falta é criada,
     * tipo de FK que divergiu é acertado, coluna de índice órfã é religada ou removida. Quem chama
     * precisa saber disso para redesenhar a tela e marcar o documento como sujo — conserto que não
     * chega ao arquivo se perde no próximo reload, e o defeito volta na geração seguinte.
     */
    public get Mutated(): boolean
    {
        return this._Mutated;
    }

    public override Validate(pDocument: XORMDocument): XIValidationIssue[]
    {
        this._Mutated = false;
        return super.Validate(pDocument);
    }

    protected override GetDesign(pDocument: XORMDocument): XORMDesign | null
    {
        return pDocument.Design;
    }

    /* v8 ignore start */
    protected override GetDocumentID(pDocument: XORMDocument): string
    {
        return pDocument.ID;
    }

    protected override GetDocumentName(pDocument: XORMDocument): string
    {
        return pDocument.Name;
    }
    /* v8 ignore stop */

    protected override ValidateDesign(pDesign: XORMDesign): void
    {
        if (!XGuid.IsFullValue(pDesign.Name))
            this.AddWarning(pDesign.ID, pDesign.Name, "Design name is not defined.");
    }

    protected override ValidateElements(pDesign: XORMDesign): void
    {
        this.ValidateTables(pDesign);
        this.ValidateInheritance(pDesign);
        this.ValidateReferences(pDesign);
    }

    /**
     * Herança entre tabelas do MESMO modelo.
     *
     * Base que não existe aqui não é erro: ela pode morar num modelo pai ou importado, e
     * quem enxerga esses arquivos é a extensão, não o TFX. O que este validador acusa é o
     * que se resolve dentro do documento — ciclo, espelho e colisão de nome de campo.
     */
    private ValidateInheritance(pDesign: XORMDesign): void
    {
        for (const table of pDesign.GetChildrenOfType(XORMTable))
        {
            const base = (table.Inheritance ?? "").trim();
            if (base.length === 0)
                continue;

            // Espelho não tem campos: é a marca de que a original mora em outro módulo.
            // Herdar dele seria herdar de um cabeçalho vazio.
            if (table.IsShadow)
            {
                this.AddError(
                    table.ID, table.Name,
                    `Shadow table ${table.Name} cannot inherit from ${base}: a shadow has no fields of its own.`,
                    "Inheritance"
                );
                continue;
            }

            const resultado = ResolveInheritance(table, pDesign);

            if (resultado.Cycle !== "")
            {
                const caminho = [table.Name, ...resultado.Chain, resultado.Cycle].join(" -> ");
                this.AddError(
                    table.ID, table.Name,
                    `Inheritance cycle: ${caminho}.`,
                    "Inheritance"
                );
                continue;
            }

            const herdados = new Map<string, string>();
            for (const campo of resultado.Fields)
                herdados.set(campo.Name.toLowerCase(), campo.Name);

            for (const campo of table.GetFields())
            {
                const herdado = herdados.get(campo.Name.toLowerCase());
                if (herdado === undefined)
                    continue;

                this.AddError(
                    campo.ID, campo.Name,
                    `Field ${campo.Name} in table ${table.Name} collides with the field inherited from ${resultado.Chain.join(" -> ")}.`,
                    "Name"
                );
            }
        }
    }

    private ValidateTables(pDesign: XORMDesign): void
    {
        const tables = pDesign.GetChildrenOfType(XORMTable);
        const names = new Set<string>();

        for (const table of tables)
        {
            if (!XGuid.IsFullValue(table.Name) || table.Name.trim() === "")
            {
                this.AddError(table.ID, table.Name, "Table name is required.");
                continue;
            }

            // Shadow tables are external references: skip duplicate-name tracking and PK management
            if (table.IsShadow)
            {
                this.ValidateTableFields(table, pDesign);
                this.ValidateTableIndexes(table);
                continue;
            }

            const lowerName = table.Name.toLowerCase();
            if (names.has(lowerName))
                this.AddError(table.ID, table.Name, `Duplicate table name: ${table.Name}`);
            else
                names.add(lowerName);

            // Auto-create PK field if missing
            if (!table.HasPKField())
            {
                table.EnsurePKField();
                this._Mutated = true;
            }

            // Ensure PK field DataType matches table PKType
            const pkField = table.GetPKField();
            if (pkField && pkField.DataType !== table.PKType)
            {
                table.PKType = pkField.DataType;
                this._Mutated = true;
            }

            this.ValidateTableFields(table, pDesign);
            this.ValidateTableIndexes(table);
        }

        if (tables.length === 0)
            this.AddWarning(pDesign.ID, pDesign.Name, "Design has no tables.");
    }

    /**
     * Índice cujas colunas perderam o campo. O XORMIndexField guarda o campo por ID (ParentID),
     * e um campo recriado — apagado e desenhado de novo — deixa o índice apontando para um ID
     * que não existe mais. Não há tela onde consertar isso: a coluna some da lista do índice e o
     * lixo fica só no arquivo. A geração então escrevia `HasIndex(e => e.)`, C# que não compila.
     *
     * Por isso aqui não se limita a acusar: religa pelo NOME, que é o que o índice de fato quis
     * dizer, e remove o que não tem para onde religar. Índice que ficou sem coluna nenhuma sai —
     * não existe índice de nada —, e essa perda é erro, não aviso: alguém precisa redesenhá-lo.
     */
    private ValidateTableIndexes(pTable: XORMTable): void
    {
        const fields = pTable.GetChildrenOfType(XORMField);
        const porID = new Set(fields.map(f => f.ID));
        const porNome = new Map(fields.map(f => [f.Name.toLowerCase(), f]));

        for (const index of pTable.GetChildrenOfType(XORMIndex))
        {
            for (const coluna of index.GetIndexFields())
            {
                if (porID.has(coluna.ParentID))
                    continue;

                const mesmoNome = porNome.get((coluna.Name ?? "").toLowerCase());

                this._Mutated = true;

                if (mesmoNome)
                {
                    coluna.ParentID = mesmoNome.ID;
                    this.AddWarning(
                        index.ID, index.Name,
                        `Index ${index.Name} column ${coluna.Name} pointed to a field that no longer exists and was relinked to ${pTable.Name}.${mesmoNome.Name}.`
                    );
                }
                else
                {
                    index.RemoveChild(coluna);
                    this.AddError(
                        index.ID, index.Name,
                        `Index ${index.Name} column ${coluna.Name} does not exist in table ${pTable.Name} and was removed.`
                    );
                }
            }

            if (index.GetIndexFields().length === 0)
            {
                pTable.RemoveChild(index);
                this._Mutated = true;
                this.AddError(index.ID, index.Name, `Index ${index.Name} has no column left and was removed from table ${pTable.Name}.`);
            }
        }
    }

    private ValidateTableFields(pTable: XORMTable, pDesign: XORMDesign): void
    {
        const fields = pTable.GetChildrenOfType(XORMField);
        const names = new Set<string>();

        for (const field of fields)
        {
            if (!XGuid.IsFullValue(field.Name) || field.Name.trim() === "")
            {
                this.AddError(field.ID, field.Name, "Field name is required.");
                continue;
            }

            const lowerName = field.Name.toLowerCase();
            if (names.has(lowerName))
                this.AddError(field.ID, field.Name, `Duplicate field name in table ${pTable.Name}: ${field.Name}`);
            else
                names.add(lowerName);

            // Validate PKField DataType against configured valid types
            if (field instanceof XORMPKField)
            {
                if (this.ValidPKTypes.length > 0 && !this.ValidPKTypes.includes(field.DataType))
                    this.AddError(field.ID, field.Name, `Invalid DataType "${field.DataType}" for Primary Key. Valid types are: ${this.ValidPKTypes.join(", ")}`);
                
                continue;
            }

            // Validate FK field DataType matches target table PKType - auto-correct if different
            const ref = pDesign.FindReferenceBySourceFieldID(field.ID);
            if (ref !== null)
            {
                const targetTable = pDesign.FindTableByID(ref.Target);
                if (targetTable !== null && field.DataType !== targetTable.PKType)
                {
                    field.DataType = targetTable.PKType;
                    this._Mutated = true;
                }
            }

            // Validate field name format (no spaces at start/end, no special chars)
            if (field.Name !== field.Name.trim())
                this.AddWarning(field.ID, field.Name, "Field name has leading or trailing spaces.");

            // Validate Length for Decimal types - must be greater than 0
            if (field.DataType === "Decimal" && field.Length === 0)
                this.AddError(field.ID, field.Name, "Decimal field must have a Length (precision) greater than 0.");

            // Validate Scale only for Decimal types
            if (field.DataType !== "Decimal" && field.Scale > 0)
                this.AddWarning(field.ID, field.Name, "Scale is only applicable for Decimal fields.");

            // AllowedValues consistency checks
            if (field.HasAllowedValues)
            {
                if (field.DefaultValue && !field.IsAllowedValue(field.DefaultValue))
                    this.AddWarning(
                        field.ID, field.Name,
                        `Default value "${field.DefaultValue}" is not in the AllowedValues list for field ${field.Name}.`
                    );

                if (field.IsAutoIncrement)
                    this.AddWarning(
                        field.ID, field.Name,
                        `Field ${field.Name} has both AllowedValues and IsAutoIncrement set. These are mutually exclusive.`
                    );
            }
        }
    }

    private ValidateReferences(pDesign: XORMDesign): void
    {
        const references = pDesign.GetChildrenOfType(XORMReference);
        const tables = pDesign.GetChildrenOfType(XORMTable);
        const tableIDs = new Set(tables.map(t => t.ID));
        const fieldIDs = new Set<string>();
        for (const table of tables)
            for (const field of table.GetFields())
                fieldIDs.add(field.ID);

        for (const ref of references)
        {
            const srcID = ref.SourceID;
            const tgtID = ref.TargetID;

            if (!XGuid.IsFullValue(srcID))
                this.AddError(ref.ID, ref.Name, "Reference source field is not defined.");
            else if (!fieldIDs.has(srcID))
            {
                // Legacy 1:1 pattern: Source may point to a source table (not a field).
                // Auto-correct by resolving to the table's PK field ID.
                // ValidateTables (called before this) guarantees every table has a PK field.
                if (tableIDs.has(srcID))
                {
                    const sourceTable = tables.find(t => t.ID === srcID)!;
                    ref.Source = sourceTable.GetPKField()!.ID;
                    this._Mutated = true;
                }
                else
                    this.AddError(ref.ID, ref.Name, "Reference source field not found.");
            }

            if (!XGuid.IsFullValue(tgtID))
                this.AddError(ref.ID, ref.Name, "Reference target table is not defined.");
            else if (!tableIDs.has(tgtID))
                this.AddError(ref.ID, ref.Name, "Reference target table not found.");

            if (XGuid.IsFullValue(srcID) && XGuid.IsFullValue(tgtID))
            {
                const sourceField = pDesign.FindFieldByID(srcID);
                if (sourceField !== null)
                {
                    const sourceTable = sourceField.ParentNode as XORMTable;
                    if (sourceTable instanceof XORMTable && sourceTable.ID === tgtID)
                        this.AddWarning(ref.ID, ref.Name, "Self-referencing relation.");
                }
            }
        }
    }
}
