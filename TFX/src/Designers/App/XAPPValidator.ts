import { XValidator } from "../../Core/XValidation.js";
import type { XIValidationIssue } from "../../Core/XValidation.js";
import { XAPPDocument } from "./XAPPDocument.js";
import { XAPPDesign } from "./XAPPDesign.js";
import { XAPPApplication } from "./XAPPApplication.js";
import { XAPPFormSection } from "./XAPPFormSection.js";
import { XAPPFormTab } from "./XAPPFormTab.js";
import { XAPPField } from "./XAPPField.js";
import { XAPPEditorType } from "./XAPPEnums.js";

export type XIAppValidationIssue = XIValidationIssue;

const GRID_COLUMNS = 32;

/**
 * Regras cobradas nesta fase (Fase 1 do plano — camada de modelo, sem UI):
 * - toda label é chave i18n, nunca literal (CE-18) — heurística: `TitleKey` vazio é erro;
 *   `TitleKey` com espaço é aviso (parece frase, não chave);
 * - `ModalWidth` fora de 1-90 é erro quando declarado (0 = usa o preset — FE-3/FE-5);
 * - soma de `ColSpan` por linha não pode passar de 32 (FE-2);
 * - `DataLookup`/`AutoComplete` exigem `LookupEndpoint` (senão o editor abre e nunca busca nada).
 */
export class XAPPValidator extends XValidator<XAPPDocument, XAPPDesign>
{
    protected override GetDesign(pDocument: XAPPDocument): XAPPDesign | null
    {
        return pDocument.Design;
    }

    protected override GetDocumentID(pDocument: XAPPDocument): string
    {
        return pDocument.ID;
    }

    protected override GetDocumentName(pDocument: XAPPDocument): string
    {
        return pDocument.Name;
    }

    protected override ValidateDesign(pDesign: XAPPDesign): void
    {
        const app = pDesign.GetApplication();
        if (app === null)
            return;

        this.ValidateApplication(app);
    }

    private ValidateApplication(pApp: XAPPApplication): void
    {
        if (!pApp.TitleKey)
            this.AddError(pApp.ID, pApp.Name, "TitleKey is required.", XAPPApplication.TitleKeyProp.ID);
        else if (pApp.TitleKey.includes(" "))
            this.AddWarning(pApp.ID, pApp.Name, "TitleKey looks like a literal sentence, not an i18n key (CE-18).", XAPPApplication.TitleKeyProp.ID);

        const formView = pApp.GetFormView();
        const tabbedFormView = pApp.GetTabbedFormView();

        if (formView !== null && tabbedFormView !== null)
            this.AddError(pApp.ID, pApp.Name, "An application has EITHER FormView OR TabbedFormView, never both.");

        if (formView !== null)
        {
            this.ValidateModalDimensions(formView.ID, formView.Name || "FormView", formView.ModalWidth);
            for (const section of formView.GetSections())
                this.ValidateSection(section);
        }

        if (tabbedFormView !== null)
        {
            this.ValidateModalDimensions(tabbedFormView.ID, tabbedFormView.Name || "TabbedFormView", tabbedFormView.ModalWidth);
            for (const tab of tabbedFormView.GetTabs())
                this.ValidateTab(tab);
        }
    }

    private ValidateModalDimensions(pElementID: string, pElementName: string, pModalWidth: number): void
    {
        if (pModalWidth === 0)
            return; // 0 = preset padrão (FE-3)

        if (pModalWidth < 1 || pModalWidth > 90)
            this.AddError(pElementID, pElementName, `ModalWidth must be 0 (preset) or between 1 and 90 (% of the App area — FE-3/FE-5); got ${pModalWidth}.`);
    }

    private ValidateTab(pTab: XAPPFormTab): void
    {
        if (!pTab.TitleKey)
            this.AddError(pTab.ID, pTab.Name, "TitleKey is required.", XAPPFormTab.TitleKeyProp.ID);

        for (const section of pTab.GetSections())
            this.ValidateSection(section);
    }

    private ValidateSection(pSection: XAPPFormSection): void
    {
        const byRow = new Map<number, XAPPField[]>();
        for (const field of pSection.GetFields())
        {
            const list = byRow.get(field.Row) ?? [];
            list.push(field);
            byRow.set(field.Row, list);

            this.ValidateField(field);
        }

        for (const [row, fields] of byRow)
        {
            const sum = fields.reduce((acc, f) => acc + f.ColSpan, 0);
            if (sum > GRID_COLUMNS)
            {
                this.AddError(
                    pSection.ID,
                    pSection.Name || pSection.TitleKey,
                    `Row ${row}: fields sum ${sum} columns, exceeding the 32-column grid (FE-2).`
                );
            }
        }
    }

    private ValidateField(pField: XAPPField): void
    {
        if (!pField.FieldName)
            this.AddError(pField.ID, pField.Name, "FieldName is required.", XAPPField.FieldNameProp.ID);

        if (pField.EditorType !== XAPPEditorType.Hidden && !pField.TitleKey)
            this.AddError(pField.ID, pField.FieldName, "TitleKey is required.", XAPPField.TitleKeyProp.ID);
        else if (pField.TitleKey && pField.TitleKey.includes(" "))
            this.AddWarning(pField.ID, pField.FieldName, "TitleKey looks like a literal sentence, not an i18n key (CE-18).", XAPPField.TitleKeyProp.ID);

        const needsLookup = pField.EditorType === XAPPEditorType.DataLookup || pField.EditorType === XAPPEditorType.AutoComplete;
        if (needsLookup && !pField.LookupEndpoint)
            this.AddError(pField.ID, pField.FieldName, "DataLookup/AutoComplete editors require LookupEndpoint.", XAPPField.LookupEndpointProp.ID);

        if (pField.ColSpan < 1 || pField.ColSpan > GRID_COLUMNS)
            this.AddError(pField.ID, pField.FieldName, `ColSpan must be between 1 and ${GRID_COLUMNS} (FE-2); got ${pField.ColSpan}.`, XAPPField.ColSpanProp.ID);
    }
}
