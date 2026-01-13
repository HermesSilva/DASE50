import { XGuid } from "../../Core/XGuid.js";
import { XValidator } from "../../Core/XValidation.js";
import type { XIValidationIssue } from "../../Core/XValidation.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";
import { XORMPKField } from "./XORMPKField.js";

export type XIORMValidationIssue = XIValidationIssue;

export class XORMValidator extends XValidator<XORMDocument, XORMDesign>
{
    /** 
     * Tipos de dados válidos para campos de chave primária.
     * Deve ser preenchido a partir do ORM.Types.json.
     */
    public ValidPKTypes: string[] = [];

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
        this.ValidateReferences(pDesign);
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

            const lowerName = table.Name.toLowerCase();
            if (names.has(lowerName))
                this.AddError(table.ID, table.Name, `Duplicate table name: ${table.Name}`);
            else
                names.add(lowerName);

            // Validate that table has a primary key field
            if (!table.HasPKField())
                this.AddError(table.ID, table.Name, `Table "${table.Name}" must have a primary key field.`);

            this.ValidateTableFields(table, pDesign);
        }

        if (tables.length === 0)
            this.AddWarning(pDesign.ID, pDesign.Name, "Design has no tables.");
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

            // Validate FK field DataType matches target table PKType
            const ref = pDesign.FindReferenceBySourceFieldID(field.ID);
            if (ref !== null)
            {
                const targetTable = pDesign.FindTableByID(ref.Target);
                if (targetTable !== null && field.DataType !== targetTable.PKType)
                    this.AddError(field.ID, field.Name, `FK field DataType must match target table PKType (${targetTable.PKType}).`);
            }

            // Validate field name format (no spaces at start/end, no special chars)
            if (field.Name !== field.Name.trim())
                this.AddWarning(field.ID, field.Name, "Field name has leading or trailing spaces.");

            // Validate Length for string types
            if (field.DataType === "String" && field.Length === 0)
                this.AddWarning(field.ID, field.Name, "String field has no length defined.");

            // Validate Scale only for Decimal types
            if (field.DataType !== "Decimal" && field.Scale > 0)
                this.AddWarning(field.ID, field.Name, "Scale is only applicable for Decimal fields.");
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
                this.AddError(ref.ID, ref.Name, "Reference source field not found.");

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
