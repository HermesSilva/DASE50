import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPScope, XAPPViewTemplate } from "./XAPPEnums.js";
import { XAPPColumn } from "./XAPPColumn.js";
import { XAPPFilterField } from "./XAPPFilterField.js";
import { XAPPButton } from "./XAPPButton.js";
import { XAPPRowAction } from "./XAPPRowAction.js";
import { XAPPApplicationViewer } from "./XAPPApplicationViewer.js";
import { XAPPFormView } from "./XAPPFormView.js";
import { XAPPTabbedFormView } from "./XAPPTabbedFormView.js";

/**
 * Raiz do modelo de App — espelha `XApplication` (`Tootega.Core.Model`). Uma
 * `XAPPApplication` é uma `NovaApp(...)` inteira: grade (`Columns`/`Filters`), barra de
 * botões, ações de linha, N visualizadores, e um formulário (`XAPPFormView` OU
 * `XAPPTabbedFormView`, nunca os dois — `GetFormView`/`GetTabbedFormView`).
 *
 * O vocabulário e as decisões binárias por trás de cada propriedade estão catalogados em
 * `TootegaERP/.claude/skills/tootega-front/references/` (`catalogo-de-design.md` e os guias
 * por padrão) — este arquivo só estrutura o mesmo vocabulário como modelo editável.
 */
export class XAPPApplication extends XDesignElement
{
    public static readonly TitleKeyProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.TitleKey,
        "95A2EE2F-7AF8-4E4E-ADBA-093FFA31E96B",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly DescriptionKeyProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.DescriptionKey,
        "036EEE04-ABD1-4124-81DA-7B32365CE7FA",
        "DescriptionKey",
        "Description Key (i18n)",
        ""
    );

    public static readonly IconProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.Icon,
        "6B771D56-4209-4F65-9287-F67B05889875",
        "Icon",
        "Icon (lucide)",
        ""
    );

    public static readonly RouteProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.Route,
        "4AE882FB-B3B7-4AB5-9607-BCC13197F63B",
        "Route",
        "Route (front)",
        ""
    );

    public static readonly DataEndpointProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.DataEndpoint,
        "B1F1DEB8-E150-41E5-933D-1B03ACDD9CAE",
        "DataEndpoint",
        "Data Endpoint (query da grade)",
        ""
    );

    public static readonly KeyFieldProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.KeyField,
        "554244A0-3A8B-41CE-80B5-070778EDF513",
        "KeyField",
        "Key Field",
        ""
    );

    public static readonly OrderProp = XProperty.Register<XAPPApplication, number>(
        (p: XAPPApplication) => p.Order,
        "ADCB083F-F8B3-4B7D-BB91-BB9FD6FAB10C",
        "Order",
        "Order (no menu)",
        0
    );

    public static readonly ScopeProp = XProperty.Register<XAPPApplication, XAPPScope>(
        (p: XAPPApplication) => p.Scope,
        "44BE1C5E-4CD9-43E7-8BEF-6E7B216BCF48",
        "Scope",
        "Scope (D31 — TenantAdmin | TenantUse)",
        XAPPScope.TenantUse
    );

    public static readonly ViewTemplateProp = XProperty.Register<XAPPApplication, XAPPViewTemplate>(
        (p: XAPPApplication) => p.ViewTemplate,
        "035C1531-1245-42D5-9D57-8AE92F5C5382",
        "ViewTemplate",
        "View Template",
        XAPPViewTemplate.DataGrid
    );

    public static readonly CustomComponentNameProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.CustomComponentName,
        "0743F554-8CEB-453D-8A37-73402EA20DFC",
        "CustomComponentName",
        "Custom Component Name (XCustomComponentRegistry — Custom/Dashboard)",
        ""
    );

    public static readonly APIBaseURLProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.APIBaseURL,
        "D322F36A-95AA-4D30-AD10-1FCDA344D7BA",
        "APIBaseURL",
        "API Base URL (toggle/batch de estado)",
        ""
    );

    public static readonly ImportEndpointProp = XProperty.Register<XAPPApplication, string>(
        (p: XAPPApplication) => p.ImportEndpoint,
        "0D9870F5-F1FA-48BE-B201-7B3C7F41A1B2",
        "ImportEndpoint",
        "Import Endpoint",
        ""
    );

    public static readonly CanCreateProp = XProperty.Register<XAPPApplication, boolean>(
        (p: XAPPApplication) => p.CanCreate,
        "9B3FC047-3613-4327-8BE0-97441B61C171",
        "CanCreate",
        "Can Create",
        true
    );

    public static readonly CanEditProp = XProperty.Register<XAPPApplication, boolean>(
        (p: XAPPApplication) => p.CanEdit,
        "DFB297AA-DB73-453C-B5C6-E34B59E3BAB2",
        "CanEdit",
        "Can Edit",
        true
    );

    public static readonly CanDeleteProp = XProperty.Register<XAPPApplication, boolean>(
        (p: XAPPApplication) => p.CanDelete,
        "3A6F6610-7A19-47F5-A5CD-D5931F745786",
        "CanDelete",
        "Can Delete",
        true
    );

    public static readonly CanExportProp = XProperty.Register<XAPPApplication, boolean>(
        (p: XAPPApplication) => p.CanExport,
        "2456DF7B-B70D-4A2F-B481-233D872FB087",
        "CanExport",
        "Can Export",
        true
    );

    public static readonly CanPrintProp = XProperty.Register<XAPPApplication, boolean>(
        (p: XAPPApplication) => p.CanPrint,
        "9121ACAB-CA33-4D20-A30C-7FDE221F923B",
        "CanPrint",
        "Can Print",
        true
    );

    public static readonly HasStateControlProp = XProperty.Register<XAPPApplication, boolean>(
        (p: XAPPApplication) => p.HasStateControl,
        "27F43012-D9C4-4BC6-8754-9727F3612D8C",
        "HasStateControl",
        "Has State Control (ativar/desativar em lote)",
        false
    );

    public constructor()
    {
        super();
    }

    public get TitleKey(): string { return this.GetValue(XAPPApplication.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPApplication.TitleKeyProp, pValue); }

    public get DescriptionKey(): string { return this.GetValue(XAPPApplication.DescriptionKeyProp) as string; }
    public set DescriptionKey(pValue: string) { this.SetValue(XAPPApplication.DescriptionKeyProp, pValue); }

    public get Icon(): string { return this.GetValue(XAPPApplication.IconProp) as string; }
    public set Icon(pValue: string) { this.SetValue(XAPPApplication.IconProp, pValue); }

    public get Route(): string { return this.GetValue(XAPPApplication.RouteProp) as string; }
    public set Route(pValue: string) { this.SetValue(XAPPApplication.RouteProp, pValue); }

    public get DataEndpoint(): string { return this.GetValue(XAPPApplication.DataEndpointProp) as string; }
    public set DataEndpoint(pValue: string) { this.SetValue(XAPPApplication.DataEndpointProp, pValue); }

    public get KeyField(): string { return this.GetValue(XAPPApplication.KeyFieldProp) as string; }
    public set KeyField(pValue: string) { this.SetValue(XAPPApplication.KeyFieldProp, pValue); }

    public get Order(): number { return this.GetValue(XAPPApplication.OrderProp) as number; }
    public set Order(pValue: number) { this.SetValue(XAPPApplication.OrderProp, pValue); }

    public get Scope(): XAPPScope { return this.GetValue(XAPPApplication.ScopeProp) as XAPPScope; }
    public set Scope(pValue: XAPPScope) { this.SetValue(XAPPApplication.ScopeProp, pValue); }

    public get ViewTemplate(): XAPPViewTemplate { return this.GetValue(XAPPApplication.ViewTemplateProp) as XAPPViewTemplate; }
    public set ViewTemplate(pValue: XAPPViewTemplate) { this.SetValue(XAPPApplication.ViewTemplateProp, pValue); }

    public get CustomComponentName(): string { return this.GetValue(XAPPApplication.CustomComponentNameProp) as string; }
    public set CustomComponentName(pValue: string) { this.SetValue(XAPPApplication.CustomComponentNameProp, pValue); }

    public get APIBaseURL(): string { return this.GetValue(XAPPApplication.APIBaseURLProp) as string; }
    public set APIBaseURL(pValue: string) { this.SetValue(XAPPApplication.APIBaseURLProp, pValue); }

    public get ImportEndpoint(): string { return this.GetValue(XAPPApplication.ImportEndpointProp) as string; }
    public set ImportEndpoint(pValue: string) { this.SetValue(XAPPApplication.ImportEndpointProp, pValue); }

    public get CanCreate(): boolean { return this.GetValue(XAPPApplication.CanCreateProp) as boolean; }
    public set CanCreate(pValue: boolean) { this.SetValue(XAPPApplication.CanCreateProp, pValue); }

    public get CanEdit(): boolean { return this.GetValue(XAPPApplication.CanEditProp) as boolean; }
    public set CanEdit(pValue: boolean) { this.SetValue(XAPPApplication.CanEditProp, pValue); }

    public get CanDelete(): boolean { return this.GetValue(XAPPApplication.CanDeleteProp) as boolean; }
    public set CanDelete(pValue: boolean) { this.SetValue(XAPPApplication.CanDeleteProp, pValue); }

    public get CanExport(): boolean { return this.GetValue(XAPPApplication.CanExportProp) as boolean; }
    public set CanExport(pValue: boolean) { this.SetValue(XAPPApplication.CanExportProp, pValue); }

    public get CanPrint(): boolean { return this.GetValue(XAPPApplication.CanPrintProp) as boolean; }
    public set CanPrint(pValue: boolean) { this.SetValue(XAPPApplication.CanPrintProp, pValue); }

    public get HasStateControl(): boolean { return this.GetValue(XAPPApplication.HasStateControlProp) as boolean; }
    public set HasStateControl(pValue: boolean) { this.SetValue(XAPPApplication.HasStateControlProp, pValue); }

    // --- Grade (DataView) -----------------------------------------------------------------

    public AddColumn(pFieldName: string): XAPPColumn
    {
        const column = new XAPPColumn();
        column.ID = XGuid.NewValue();
        column.FieldName = pFieldName;
        this.AppendChild(column);
        return column;
    }

    public GetColumns(): XAPPColumn[]
    {
        return this.GetChildrenOfType(XAPPColumn);
    }

    public AddFilter(pFieldName: string): XAPPFilterField
    {
        const filter = new XAPPFilterField();
        filter.ID = XGuid.NewValue();
        filter.FieldName = pFieldName;
        this.AppendChild(filter);
        return filter;
    }

    public GetFilters(): XAPPFilterField[]
    {
        return this.GetChildrenOfType(XAPPFilterField);
    }

    // --- Barra de botões e ações de linha ---------------------------------------------------

    public AddButton(pTitleKey: string = ""): XAPPButton
    {
        const button = new XAPPButton();
        button.ID = XGuid.NewValue();
        button.TitleKey = pTitleKey;
        this.AppendChild(button);
        return button;
    }

    public GetButtons(): XAPPButton[]
    {
        return this.GetChildrenOfType(XAPPButton);
    }

    public AddRowAction(pTitleKey: string = ""): XAPPRowAction
    {
        const action = new XAPPRowAction();
        action.ID = XGuid.NewValue();
        action.TitleKey = pTitleKey;
        this.AppendChild(action);
        return action;
    }

    public GetRowActions(): XAPPRowAction[]
    {
        return this.GetChildrenOfType(XAPPRowAction);
    }

    // --- Visualizadores (app-consulta.md) ---------------------------------------------------

    public AddViewer(pKey: string): XAPPApplicationViewer
    {
        const viewer = new XAPPApplicationViewer();
        viewer.ID = XGuid.NewValue();
        viewer.Key = pKey;
        this.AppendChild(viewer);
        return viewer;
    }

    public GetViewers(): XAPPApplicationViewer[]
    {
        return this.GetChildrenOfType(XAPPApplicationViewer);
    }

    // --- Formulário: XAPPFormView OU XAPPTabbedFormView, nunca os dois --------------------

    public SetFormView(): XAPPFormView
    {
        const existing = this.GetFormView();
        if (existing !== null)
            return existing;

        this.RemoveTabbedFormViewIfAny();
        const form = new XAPPFormView();
        form.ID = XGuid.NewValue();
        this.AppendChild(form);
        return form;
    }

    public SetTabbedFormView(): XAPPTabbedFormView
    {
        const existing = this.GetTabbedFormView();
        if (existing !== null)
            return existing;

        this.RemoveFormViewIfAny();
        const form = new XAPPTabbedFormView();
        form.ID = XGuid.NewValue();
        this.AppendChild(form);
        return form;
    }

    public GetFormView(): XAPPFormView | null
    {
        return this.GetChild<XAPPFormView>(c => c instanceof XAPPFormView);
    }

    public GetTabbedFormView(): XAPPTabbedFormView | null
    {
        return this.GetChild<XAPPTabbedFormView>(c => c instanceof XAPPTabbedFormView);
    }

    private RemoveFormViewIfAny(): void
    {
        const existing = this.GetFormView();
        if (existing !== null)
            this.RemoveChild(existing);
    }

    private RemoveTabbedFormViewIfAny(): void
    {
        const existing = this.GetTabbedFormView();
        if (existing !== null)
            this.RemoveChild(existing);
    }
}
