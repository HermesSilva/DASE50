import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPFormViewBase } from "./XAPPFormViewBase.js";
import { XAPPFormTab } from "./XAPPFormTab.js";

/**
 * Espelha `XTabbedFormView` — CRUD com abas, o padrão mais rico (ver `PessoasApp.cs`).
 * `ShowTabs = false` é o caso de uma única aba usada só como moldura para um componente
 * custom (ver `AcessosUsuarioApp.cs`, `extensao-do-motor.md` §2). A fileira de abas também
 * dimensiona o modal — FE-10.
 */
export class XAPPTabbedFormView extends XAPPFormViewBase
{
    public static readonly ShowTabsProp = XProperty.Register<XAPPTabbedFormView, boolean>(
        (p: XAPPTabbedFormView) => p.ShowTabs,
        "0D4E336A-7960-4939-AC3D-74584CC83D4F",
        "ShowTabs",
        "Show Tabs",
        true
    );

    public constructor()
    {
        super();
    }

    public get ShowTabs(): boolean { return this.GetValue(XAPPTabbedFormView.ShowTabsProp) as boolean; }
    public set ShowTabs(pValue: boolean) { this.SetValue(XAPPTabbedFormView.ShowTabsProp, pValue); }

    public AddFormTab(pTitleKey: string = "", pIcon: string = ""): XAPPFormTab
    {
        const tab = new XAPPFormTab();
        tab.ID = XGuid.NewValue();
        tab.TitleKey = pTitleKey;
        tab.Icon = pIcon;
        this.AppendChild(tab);
        return tab;
    }

    /** Espelha `pForm.AddDetailGridTab(...)` — aba já preparada para `SetAsDetailGrid()`. */
    public AddDetailGridTab(pTitleKey: string = "", pIcon: string = ""): XAPPFormTab
    {
        return this.AddFormTab(pTitleKey, pIcon);
    }

    public GetTabs(): XAPPFormTab[]
    {
        return this.GetChildrenOfType(XAPPFormTab);
    }
}
