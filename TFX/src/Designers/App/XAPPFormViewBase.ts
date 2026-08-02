import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";

/**
 * Cabeçalho comum a `XAPPFormView` e `XAPPTabbedFormView` — espelha os campos que
 * `XFormView`/`XTabbedFormView` compartilham no back. As dimensões são as regras
 * **FE-3/FE-4** (`dimensoes-de-modal.md`): `ModalWidth` é SEMPRE percentual da área do App,
 * nunca pixel; `ModalRows` é altura em linhas de campo.
 */
export abstract class XAPPFormViewBase extends XDesignElement
{
    public static readonly ModalWidthProp = XProperty.Register<XAPPFormViewBase, number>(
        (p: XAPPFormViewBase) => p.ModalWidth,
        "B18BBE28-4031-45A5-BB45-59422EF6DD88",
        "ModalWidth",
        "Modal Width (% da área do App, 1-90 — FE-3)",
        0
    );

    public static readonly ModalRowsProp = XProperty.Register<XAPPFormViewBase, number>(
        (p: XAPPFormViewBase) => p.ModalRows,
        "C7479DA1-9C7F-4F14-A939-3C0EB9B4D783",
        "ModalRows",
        "Modal Rows (altura em linhas — FE-4)",
        0
    );

    public static readonly SaveEndpointProp = XProperty.Register<XAPPFormViewBase, string>(
        (p: XAPPFormViewBase) => p.SaveEndpoint,
        "594A9D51-E73D-41C6-B9E9-BC9E0861684A",
        "SaveEndpoint",
        "Save Endpoint",
        ""
    );

    public static readonly LoadEndpointProp = XProperty.Register<XAPPFormViewBase, string>(
        (p: XAPPFormViewBase) => p.LoadEndpoint,
        "6C8142BE-4141-44A9-B3E3-E03E77007BDB",
        "LoadEndpoint",
        "Load Endpoint ({id})",
        ""
    );

    public static readonly CreateTitleKeyProp = XProperty.Register<XAPPFormViewBase, string>(
        (p: XAPPFormViewBase) => p.CreateTitleKey,
        "E2A592EE-BEE1-4E3A-A006-B5187755A0F6",
        "CreateTitleKey",
        "Create Title Key (i18n)",
        ""
    );

    public static readonly EditTitleKeyProp = XProperty.Register<XAPPFormViewBase, string>(
        (p: XAPPFormViewBase) => p.EditTitleKey,
        "AB9C0844-A4AF-40E8-BC1C-3C206E8608BC",
        "EditTitleKey",
        "Edit Title Key (i18n)",
        ""
    );

    public static readonly ViewTitleKeyProp = XProperty.Register<XAPPFormViewBase, string>(
        (p: XAPPFormViewBase) => p.ViewTitleKey,
        "17E1B81E-A105-46A0-91D7-6D2FB6188D7C",
        "ViewTitleKey",
        "View Title Key (i18n)",
        ""
    );

    protected constructor()
    {
        super();
    }

    public get ModalWidth(): number { return this.GetValue(XAPPFormViewBase.ModalWidthProp) as number; }
    public set ModalWidth(pValue: number) { this.SetValue(XAPPFormViewBase.ModalWidthProp, pValue); }

    public get ModalRows(): number { return this.GetValue(XAPPFormViewBase.ModalRowsProp) as number; }
    public set ModalRows(pValue: number) { this.SetValue(XAPPFormViewBase.ModalRowsProp, pValue); }

    public get SaveEndpoint(): string { return this.GetValue(XAPPFormViewBase.SaveEndpointProp) as string; }
    public set SaveEndpoint(pValue: string) { this.SetValue(XAPPFormViewBase.SaveEndpointProp, pValue); }

    public get LoadEndpoint(): string { return this.GetValue(XAPPFormViewBase.LoadEndpointProp) as string; }
    public set LoadEndpoint(pValue: string) { this.SetValue(XAPPFormViewBase.LoadEndpointProp, pValue); }

    public get CreateTitleKey(): string { return this.GetValue(XAPPFormViewBase.CreateTitleKeyProp) as string; }
    public set CreateTitleKey(pValue: string) { this.SetValue(XAPPFormViewBase.CreateTitleKeyProp, pValue); }

    public get EditTitleKey(): string { return this.GetValue(XAPPFormViewBase.EditTitleKeyProp) as string; }
    public set EditTitleKey(pValue: string) { this.SetValue(XAPPFormViewBase.EditTitleKeyProp, pValue); }

    public get ViewTitleKey(): string { return this.GetValue(XAPPFormViewBase.ViewTitleKeyProp) as string; }
    public set ViewTitleKey(pValue: string) { this.SetValue(XAPPFormViewBase.ViewTitleKeyProp, pValue); }
}
