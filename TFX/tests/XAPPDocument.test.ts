import { describe, it, expect } from "vitest";
import { XAPPDocument } from "../src/Designers/App/XAPPDocument.js";
import { XAPPDesign } from "../src/Designers/App/XAPPDesign.js";
import { XAPPScope, XAPPEditorType } from "../src/Designers/App/XAPPEnums.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterAppElements } from "../src/Designers/App/XAPPRegistry.js";

describe("XAPPDocument", () => {
    it("should be instantiable and initialize PDesign", () => {
        const doc = new XAPPDocument();
        expect(doc).toBeInstanceOf(XAPPDocument);
        expect(doc.Design).toBeInstanceOf(XAPPDesign);
        expect(doc.ChildNodes.includes(doc.Design)).toBe(true);
    });

    it("should round-trip a full App (CRUD com abas) through XML", () => {
        RegisterAppElements();

        const doc = new XAPPDocument();
        doc.ID = "doc-1";
        doc.Name = "PessoasApp";

        const app = doc.Design.CreateApplication("CRMxPessoas");
        app.TitleKey = "crm.people.title";
        app.Route = "/crm/pessoas";
        app.DataEndpoint = "/crm/people/query";
        app.KeyField = "CRMxPessoaID";
        app.Scope = XAPPScope.TenantUse;
        app.CanDelete = false;

        app.AddColumn("Nome").TitleKey = "crm.people.name";
        app.AddButton("crm.people.new");

        const form = app.SetTabbedFormView();
        form.ModalWidth = 56;
        const tab = form.AddFormTab("crm.people.tab.identification", "contact");
        const section = tab.AddSection("crm.people.section.identification");
        const field = section.AddField("Nome", 0, 32);
        field.TitleKey = "crm.people.name";
        field.EditorType = XAPPEditorType.Text;
        field.IsRequired = true;

        const engine = XSerializationEngine.Instance;
        const serialized = engine.Serialize(doc);
        expect(serialized.Success).toBe(true);

        const result = engine.Deserialize<XAPPDocument>(serialized.XmlOutput!);
        expect(result.Success).toBe(true);

        const loaded = result.Data!;
        const loadedApp = loaded.Design.GetApplication()!;
        expect(loadedApp.Name).toBe("CRMxPessoas");
        expect(loadedApp.TitleKey).toBe("crm.people.title");
        expect(loadedApp.CanDelete).toBe(false);
        expect(loadedApp.GetColumns()).toHaveLength(1);
        expect(loadedApp.GetColumns()[0].FieldName).toBe("Nome");

        const loadedForm = loadedApp.GetTabbedFormView()!;
        expect(loadedForm.ModalWidth).toBe(56);
        expect(loadedForm.GetTabs()).toHaveLength(1);

        const loadedField = loadedForm.GetTabs()[0].GetSections()[0].GetFields()[0];
        expect(loadedField.FieldName).toBe("Nome");
        expect(loadedField.ColSpan).toBe(32);
        expect(loadedField.EditorType).toBe(XAPPEditorType.Text);
        expect(loadedField.IsRequired).toBe(true);
    });

    it("should consolidate duplicate XAPPDesign nodes on Initialize (mirrors XORMDocument)", () => {
        const doc = new XAPPDocument();
        const extra = new XAPPDesign();
        extra.ID = "extra-design";
        const app = extra.CreateApplication("Extra");
        doc.AppendChild(extra);

        expect(doc.ChildNodes.filter(c => c instanceof XAPPDesign)).toHaveLength(2);

        doc.Initialize();

        const designs = doc.ChildNodes.filter(c => c instanceof XAPPDesign);
        expect(designs).toHaveLength(1);
        expect(doc.Design.GetApplication()?.ID).toBe(app.ID);
    });
});
