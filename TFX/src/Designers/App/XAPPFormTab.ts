import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPFormSection } from "./XAPPFormSection.js";
import { XAPPVisibilityRule } from "./XAPPVisibilityRule.js";
import { XAPPDetailGrid } from "./XAPPDetailGrid.js";

/**
 * Aba do formulário (`XFormTab`, `pForm.AddFormTab(...)` no back). Três formas mutuamente
 * exclusivas de conteúdo — a mesma aba nunca combina duas:
 * - `Sections` (a comum): seções com campos, grid de 32 colunas;
 * - `CustomComponentName`: componente inteiro (`XFormTabComponentRegistry`, ver
 *   `extensao-do-motor.md` §2 — não confundir com `XAPPApplication.CustomComponentName`);
 * - `SetAsDetailGrid(...)`: mestre-detalhe (`app-mestre-detalhe.md`).
 */
export class XAPPFormTab extends XDesignElement
{
    public static readonly TitleKeyProp = XProperty.Register<XAPPFormTab, string>(
        (p: XAPPFormTab) => p.TitleKey,
        "FCF1145C-81C7-4613-83D1-B7E3D18335B0",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly IconProp = XProperty.Register<XAPPFormTab, string>(
        (p: XAPPFormTab) => p.Icon,
        "A826F7CE-BEAD-4C11-9178-D8C10BE02B40",
        "Icon",
        "Icon (lucide)",
        ""
    );

    public static readonly CustomComponentNameProp = XProperty.Register<XAPPFormTab, string>(
        (p: XAPPFormTab) => p.CustomComponentName,
        "BDF8834E-78EE-49C5-B71D-C4FC712871AD",
        "CustomComponentName",
        "Custom Component Name (XFormTabComponentRegistry)",
        ""
    );

    public static readonly DataEndpointProp = XProperty.Register<XAPPFormTab, string>(
        (p: XAPPFormTab) => p.DataEndpoint,
        "EF9E5E5B-CF9D-4143-B1EE-4BEDE0858034",
        "DataEndpoint",
        "Data Endpoint (aba custom)",
        ""
    );

    public static readonly LookupEndpointProp = XProperty.Register<XAPPFormTab, string>(
        (p: XAPPFormTab) => p.LookupEndpoint,
        "41E356C0-FFFA-4CA3-8A47-36A5330054C4",
        "LookupEndpoint",
        "Lookup Endpoint (aba custom)",
        ""
    );

    public static readonly VisibleWhenFieldProp = XProperty.Register<XAPPFormTab, string>(
        (p: XAPPFormTab) => p.VisibleWhenField,
        "0E879885-8C12-4A9C-9656-30E46C237F98",
        "VisibleWhenField",
        "Visible When Field",
        ""
    );

    public constructor()
    {
        super();
    }

    public get TitleKey(): string { return this.GetValue(XAPPFormTab.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPFormTab.TitleKeyProp, pValue); }

    public get Icon(): string { return this.GetValue(XAPPFormTab.IconProp) as string; }
    public set Icon(pValue: string) { this.SetValue(XAPPFormTab.IconProp, pValue); }

    public get CustomComponentName(): string { return this.GetValue(XAPPFormTab.CustomComponentNameProp) as string; }
    public set CustomComponentName(pValue: string) { this.SetValue(XAPPFormTab.CustomComponentNameProp, pValue); }

    public get DataEndpoint(): string { return this.GetValue(XAPPFormTab.DataEndpointProp) as string; }
    public set DataEndpoint(pValue: string) { this.SetValue(XAPPFormTab.DataEndpointProp, pValue); }

    public get LookupEndpoint(): string { return this.GetValue(XAPPFormTab.LookupEndpointProp) as string; }
    public set LookupEndpoint(pValue: string) { this.SetValue(XAPPFormTab.LookupEndpointProp, pValue); }

    public get VisibleWhenField(): string { return this.GetValue(XAPPFormTab.VisibleWhenFieldProp) as string; }
    public set VisibleWhenField(pValue: string) { this.SetValue(XAPPFormTab.VisibleWhenFieldProp, pValue); }

    public AddSection(pTitleKey: string = "", pShowHeader: boolean = true): XAPPFormSection
    {
        const section = new XAPPFormSection();
        section.ID = XGuid.NewValue();
        section.TitleKey = pTitleKey;
        section.ShowHeader = pShowHeader;
        this.AppendChild(section);
        return section;
    }

    public GetSections(): XAPPFormSection[]
    {
        return this.GetChildrenOfType(XAPPFormSection);
    }

    public CreateVisibilityRule(): XAPPVisibilityRule
    {
        const rule = new XAPPVisibilityRule();
        rule.ID = XGuid.NewValue();
        this.AppendChild(rule);
        return rule;
    }

    public GetVisibilityRules(): XAPPVisibilityRule[]
    {
        return this.GetChildrenOfType(XAPPVisibilityRule);
    }

    /** Espelha `pForm.AddDetailGridTab(...)` + `aba.SetAsDetailGrid(...)` — ver `app-mestre-detalhe.md`. */
    public SetAsDetailGrid(): XAPPDetailGrid
    {
        const existing = this.GetDetailGrid();
        if (existing !== null)
            return existing;

        const grid = new XAPPDetailGrid();
        grid.ID = XGuid.NewValue();
        this.AppendChild(grid);
        return grid;
    }

    public GetDetailGrid(): XAPPDetailGrid | null
    {
        return this.GetChild<XAPPDetailGrid>(c => c instanceof XAPPDetailGrid);
    }
}
