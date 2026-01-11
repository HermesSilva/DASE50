import { XGuid } from "../../Core/XGuid.js";
import { XValidator } from "../../Core/XValidation.js";
import type { XIValidationIssue } from "../../Core/XValidation.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";

export type XIORMValidationIssue = XIValidationIssue;

export class XORMValidator extends XValidator<XORMDocument, XORMDesign>
{
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

            this.ValidateTableFields(table);
        }

        if (tables.length === 0)
            this.AddWarning(pDesign.ID, pDesign.Name, "Design has no tables.");
    }

    private ValidateTableFields(pTable: XORMTable): void
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
        }
    }

    private ValidateReferences(pDesign: XORMDesign): void
    {
        const references = pDesign.GetChildrenOfType(XORMReference);
        const tables = pDesign.GetChildrenOfType(XORMTable);
        const tableIDs = new Set(tables.map(t => t.ID));

        for (const ref of references)
        {
            const srcID = ref.SourceID;
            const tgtID = ref.TargetID;

            if (!XGuid.IsFullValue(srcID))
                this.AddError(ref.ID, ref.Name, "Reference source table is not defined.");
            else if (!tableIDs.has(srcID))
                this.AddError(ref.ID, ref.Name, "Reference source table not found.");

            if (!XGuid.IsFullValue(tgtID))
                this.AddError(ref.ID, ref.Name, "Reference target table is not defined.");
            else if (!tableIDs.has(tgtID))
                this.AddError(ref.ID, ref.Name, "Reference target table not found.");

            if (srcID === tgtID && XGuid.IsFullValue(srcID))
                this.AddWarning(ref.ID, ref.Name, "Self-referencing relation.");
        }
    }
}
