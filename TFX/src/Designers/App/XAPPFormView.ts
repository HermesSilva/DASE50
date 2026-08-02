import { XGuid } from "../../Core/XGuid.js";
import { XAPPFormViewBase } from "./XAPPFormViewBase.js";
import { XAPPFormSection } from "./XAPPFormSection.js";

/**
 * Espelha `XFormView` (seções simples, sem abas) — o caso comum de CRUD
 * (`app-crud.md` §3). Mutuamente exclusivo com `XAPPTabbedFormView`: uma
 * `XAPPApplication` tem UM dos dois, nunca os dois.
 */
export class XAPPFormView extends XAPPFormViewBase
{
    public constructor()
    {
        super();
    }

    public AddSection(pTitleKey: string = ""): XAPPFormSection
    {
        const section = new XAPPFormSection();
        section.ID = XGuid.NewValue();
        section.TitleKey = pTitleKey;
        this.AppendChild(section);
        return section;
    }

    public GetSections(): XAPPFormSection[]
    {
        return this.GetChildrenOfType(XAPPFormSection);
    }
}
