import { describe, it, expect } from "vitest";
import { XDesignerErrorSeverity } from "../src/Core/XValidation.js";
import { XAPPDocument } from "../src/Designers/App/XAPPDocument.js";
import { XAPPValidator } from "../src/Designers/App/XAPPValidator.js";
import { XAPPEditorType } from "../src/Designers/App/XAPPEnums.js";
import { XAPPTabbedFormView } from "../src/Designers/App/XAPPTabbedFormView.js";
import { XGuid } from "../src/Core/XGuid.js";

function NewDocumentWithApp() {
    const doc = new XAPPDocument();
    const app = doc.Design.CreateApplication("SYSxPlanos");
    app.TitleKey = "sys.plans.title";
    return { doc, app };
}

describe("XAPPValidator", () => {
    it("passes on a minimal, well-formed application", () => {
        const { doc } = NewDocumentWithApp();
        const validator = new XAPPValidator();
        const issues = validator.Validate(doc);
        expect(issues).toHaveLength(0);
    });

    it("errors when the application has no TitleKey", () => {
        const doc = new XAPPDocument();
        doc.Design.CreateApplication("SYSxPlanos");

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("TitleKey") && i.Severity === XDesignerErrorSeverity.Error)).toBe(true);
    });

    it("warns when TitleKey looks like a literal sentence, not an i18n key", () => {
        const { doc, app } = NewDocumentWithApp();
        app.TitleKey = "Planos de assinatura";

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Severity === XDesignerErrorSeverity.Warning && i.Message.includes("CE-18"))).toBe(true);
    });

    it("errors when a row's ColSpan sum exceeds the 32-column grid (FE-2)", () => {
        const { doc, app } = NewDocumentWithApp();
        const form = app.SetFormView();
        const section = form.AddSection("sys.plans.section.billing");
        const a = section.AddField("Ciclo", 0, 20);
        a.TitleKey = "sys.plans.field.ciclo";
        const b = section.AddField("Preco", 0, 20);
        b.TitleKey = "sys.plans.field.preco";

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("32-column grid"))).toBe(true);
    });

    it("errors when ModalWidth is declared outside 1-90 (FE-3/FE-5)", () => {
        const { doc, app } = NewDocumentWithApp();
        const form = app.SetFormView();
        form.ModalWidth = 95;

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("ModalWidth"))).toBe(true);
    });

    it("accepts ModalWidth = 0 as the preset default", () => {
        const { doc, app } = NewDocumentWithApp();
        app.SetFormView().ModalWidth = 0;

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("ModalWidth"))).toBe(false);
    });

    it("errors when a DataLookup field has no LookupEndpoint", () => {
        const { doc, app } = NewDocumentWithApp();
        const section = app.SetFormView().AddSection("sys.plans.section.billing");
        const field = section.AddField("CRMxPessoaID", 0, 32);
        field.TitleKey = "sys.plans.field.empresa";
        field.EditorType = XAPPEditorType.DataLookup;

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("LookupEndpoint"))).toBe(true);

        field.LookupEndpoint = "/nfe/series/companies/lookup";
        const issuesAfterFix = new XAPPValidator().Validate(doc);
        expect(issuesAfterFix.some(i => i.Message.includes("LookupEndpoint"))).toBe(false);
    });

    it("does not flag a well-formed app with only FormView as having both forms", () => {
        const { doc, app } = NewDocumentWithApp();
        app.SetFormView();

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("never both"))).toBe(false);
    });

    it("errors when both FormView and TabbedFormView end up attached (defensive branch)", () => {
        const { doc, app } = NewDocumentWithApp();
        app.SetFormView();

        // SetFormView/SetTabbedFormView já impedem a convivência pela API pública; aqui a
        // árvore é montada diretamente para exercitar a defesa do VALIDADOR como camada
        // independente — ele não deve confiar apenas na disciplina dos helpers.
        const tabbed = new XAPPTabbedFormView();
        tabbed.ID = XGuid.NewValue();
        app.AppendChild(tabbed);

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.some(i => i.Message.includes("never both"))).toBe(true);
    });

    it("validates a full tabbed form with a detail grid without false positives", () => {
        const { doc, app } = NewDocumentWithApp();
        const form = app.SetTabbedFormView();
        const tab = form.AddDetailGridTab("crm.people.tab.services", "receipt");
        const grid = tab.SetAsDetailGrid();
        grid.DataEndpoint = "/nfe/services/people/{id}/services";
        grid.AddColumn("codigo");

        const issues = new XAPPValidator().Validate(doc);
        expect(issues.filter(i => i.Severity === XDesignerErrorSeverity.Error)).toHaveLength(0);
    });
});
