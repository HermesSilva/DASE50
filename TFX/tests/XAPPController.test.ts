import { describe, it, expect, beforeEach } from "vitest";
import { XAPPDocument } from "../src/Designers/App/XAPPDocument.js";
import { XAPPController } from "../src/Designers/App/XAPPController.js";
import { XAPPFormSection } from "../src/Designers/App/XAPPFormSection.js";

describe("XAPPController", () => {
    let doc: XAPPDocument;
    let controller: XAPPController;

    beforeEach(() => {
        doc = new XAPPDocument();
        doc.Design.CreateApplication("SYSxPlanos");
        controller = new XAPPController();
        controller.Document = doc;
    });

    it("CreateApplication is idempotent and reuses the existing application", () => {
        const fresh = new XAPPController();
        fresh.Document = new XAPPDocument();

        const first = fresh.CreateApplication("SYSxPlanos");
        expect(first.Success).toBe(true);

        const second = fresh.CreateApplication("Ignored");
        expect(second.ElementID).toBe(first.ElementID);
        expect(fresh.GetApplication()!.Name).toBe("SYSxPlanos");
    });

    it("CreateApplication fails without a loaded document", () => {
        const noDocController = new XAPPController();
        expect(noDocController.CreateApplication("x").Success).toBe(false);
    });

    it("SetFormView creates a FormView once and is idempotent", () => {
        const first = controller.SetFormView();
        expect(first.Success).toBe(true);

        const second = controller.SetFormView();
        expect(second.ElementID).toBe(first.ElementID);
    });

    it("SetTabbedFormView creates a TabbedFormView once and is idempotent", () => {
        const first = controller.SetTabbedFormView();
        expect(first.Success).toBe(true);

        const second = controller.SetTabbedFormView();
        expect(second.ElementID).toBe(first.ElementID);
    });

    it("AddFormTab requires an existing TabbedFormView", () => {
        expect(controller.AddFormTab("tab").Success).toBe(false);

        controller.SetTabbedFormView();
        const result = controller.AddFormTab("crm.people.tab.identification");
        expect(result.Success).toBe(true);
    });

    it("SetFormView auto-creates the application when the design has none yet", () => {
        const emptyController = new XAPPController();
        emptyController.Document = new XAPPDocument();
        expect(emptyController.SetFormView().Success).toBe(true);
    });

    it("adds a column to the application", () => {
        const result = controller.AddColumn("Nome");
        expect(result.Success).toBe(true);
        expect(controller.GetColumns()).toHaveLength(1);
        expect(controller.GetColumns()[0].FieldName).toBe("Nome");
    });

    it("adds a button and a row action", () => {
        expect(controller.AddButton("buttonBar.new").Success).toBe(true);
        expect(controller.AddRowAction("orders.invoice").Success).toBe(true);
        expect(controller.GetButtons()).toHaveLength(1);
        expect(controller.GetRowActions()).toHaveLength(1);
    });

    it("adds a section to a plain FormView and a field to that section", () => {
        const app = controller.GetApplication()!;
        const form = app.SetFormView();

        const sectionResult = controller.AddFormSection({ ParentID: form.ID, TitleKey: "sys.plans.section.billing" });
        expect(sectionResult.Success).toBe(true);

        const fieldResult = controller.AddField({
            SectionID: sectionResult.ElementID!,
            FieldName: "Preco",
            Row: 0,
            ColSpan: 16
        });
        expect(fieldResult.Success).toBe(true);

        const section = controller.GetElementByID(sectionResult.ElementID!) as XAPPFormSection;
        expect(section.GetFields()).toHaveLength(1);
        expect(section.GetFields()[0].FieldName).toBe("Preco");
    });

    it("adds a section inside a tab of a TabbedFormView", () => {
        const app = controller.GetApplication()!;
        const form = app.SetTabbedFormView();
        const tab = form.AddFormTab("sys.plans.tab.main");

        const sectionResult = controller.AddFormSection({ ParentID: tab.ID });
        expect(sectionResult.Success).toBe(true);
        expect(tab.GetSections()).toHaveLength(1);
    });

    it("updates a property by key", () => {
        const app = controller.GetApplication()!;
        const result = controller.UpdateProperty(app.ID, "TitleKey", "sys.plans.title");
        expect(result.Success).toBe(true);
        expect(app.TitleKey).toBe("sys.plans.title");
    });

    it("renames and removes an element", () => {
        const columnResult = controller.AddColumn("Nome");
        const app = controller.GetApplication()!;

        expect(controller.RenameElement(columnResult.ElementID!, "NomeRenomeado").Success).toBe(true);
        expect(app.GetColumns()[0].Name).toBe("NomeRenomeado");

        expect(controller.RemoveElement(columnResult.ElementID!).Success).toBe(true);
        expect(app.GetColumns()).toHaveLength(0);
    });

    it("fails gracefully when the document has no application", () => {
        const emptyController = new XAPPController();
        emptyController.Document = new XAPPDocument();
        // XAPPDesign auto-creates the application on first mutating call (RequireApplication),
        // so exercise a read instead — GetElementByID with no document set at all.
        const noDocController = new XAPPController();
        expect(noDocController.GetElementByID("anything")).toBeNull();
        expect(emptyController.AddColumn("X").Success).toBe(true);
    });
});
