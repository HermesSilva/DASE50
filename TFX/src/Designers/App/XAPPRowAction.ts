import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XAPPButtonType } from "./XAPPEnums.js";

/**
 * Ação sobre a linha (`XApplication.DataView.RowActions`, `XRowAction`). Espelha
 * `app-acoes-de-linha.md` §2: POST em `Endpoint` com `{id}` trocado pela chave da linha.
 * `VisibleWhenValues` é pipe-separated (mesma convenção de `AllowedValues` em `XORMField`).
 */
export class XAPPRowAction extends XDesignElement
{
    public static readonly TitleKeyProp = XProperty.Register<XAPPRowAction, string>(
        (p: XAPPRowAction) => p.TitleKey,
        "5954494E-C28E-4C4B-B334-B308CE3B0D50",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly IconProp = XProperty.Register<XAPPRowAction, string>(
        (p: XAPPRowAction) => p.Icon,
        "1B7D6690-E6EF-450E-A745-0AB5D37438E7",
        "Icon",
        "Icon (lucide)",
        ""
    );

    public static readonly EndpointProp = XProperty.Register<XAPPRowAction, string>(
        (p: XAPPRowAction) => p.Endpoint,
        "98B2848E-7501-4DF5-9F16-0F22301BE9B4",
        "Endpoint",
        "Endpoint ({id} placeholder)",
        ""
    );

    public static readonly ButtonTypeProp = XProperty.Register<XAPPRowAction, XAPPButtonType>(
        (p: XAPPRowAction) => p.ButtonType,
        "99EADB1F-A83A-4095-A1A1-092FA69D13FA",
        "ButtonType",
        "Button Type",
        XAPPButtonType.Secondary
    );

    public static readonly VisibleWhenFieldProp = XProperty.Register<XAPPRowAction, string>(
        (p: XAPPRowAction) => p.VisibleWhenField,
        "B198705A-489B-4654-B1F6-F6E28A217469",
        "VisibleWhenField",
        "Visible When Field",
        ""
    );

    public static readonly VisibleWhenValuesProp = XProperty.Register<XAPPRowAction, string>(
        (p: XAPPRowAction) => p.VisibleWhenValues,
        "437D15E8-A11B-466C-BB14-069629F3831A",
        "VisibleWhenValues",
        "Visible When Values (pipe-separated)",
        ""
    );

    public static readonly ReturnsFileProp = XProperty.Register<XAPPRowAction, boolean>(
        (p: XAPPRowAction) => p.ReturnsFile,
        "D9B95B1A-BBDB-4032-AD41-C82720E8DB29",
        "ReturnsFile",
        "Returns File",
        false
    );

    public static readonly RequiresConfirmationProp = XProperty.Register<XAPPRowAction, boolean>(
        (p: XAPPRowAction) => p.RequiresConfirmation,
        "611D60EE-9FB0-4BEF-B74A-4AE597A2C61A",
        "RequiresConfirmation",
        "Requires Confirmation",
        false
    );

    public static readonly ConfirmMessageKeyProp = XProperty.Register<XAPPRowAction, string>(
        (p: XAPPRowAction) => p.ConfirmMessageKey,
        "7168423A-E52D-40B1-8324-9D2311BB9F74",
        "ConfirmMessageKey",
        "Confirm Message Key (i18n)",
        ""
    );

    public static readonly RequiresCompanyProp = XProperty.Register<XAPPRowAction, boolean>(
        (p: XAPPRowAction) => p.RequiresCompany,
        "9E4D9F44-78A8-455A-B6DD-5F5799355BD8",
        "RequiresCompany",
        "Requires Company",
        false
    );

    public constructor()
    {
        super();
    }

    public get TitleKey(): string { return this.GetValue(XAPPRowAction.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPRowAction.TitleKeyProp, pValue); }

    public get Icon(): string { return this.GetValue(XAPPRowAction.IconProp) as string; }
    public set Icon(pValue: string) { this.SetValue(XAPPRowAction.IconProp, pValue); }

    public get Endpoint(): string { return this.GetValue(XAPPRowAction.EndpointProp) as string; }
    public set Endpoint(pValue: string) { this.SetValue(XAPPRowAction.EndpointProp, pValue); }

    public get ButtonType(): XAPPButtonType { return this.GetValue(XAPPRowAction.ButtonTypeProp) as XAPPButtonType; }
    public set ButtonType(pValue: XAPPButtonType) { this.SetValue(XAPPRowAction.ButtonTypeProp, pValue); }

    public get VisibleWhenField(): string { return this.GetValue(XAPPRowAction.VisibleWhenFieldProp) as string; }
    public set VisibleWhenField(pValue: string) { this.SetValue(XAPPRowAction.VisibleWhenFieldProp, pValue); }

    public get VisibleWhenValues(): string { return this.GetValue(XAPPRowAction.VisibleWhenValuesProp) as string; }
    public set VisibleWhenValues(pValue: string) { this.SetValue(XAPPRowAction.VisibleWhenValuesProp, pValue); }

    public get ReturnsFile(): boolean { return this.GetValue(XAPPRowAction.ReturnsFileProp) as boolean; }
    public set ReturnsFile(pValue: boolean) { this.SetValue(XAPPRowAction.ReturnsFileProp, pValue); }

    public get RequiresConfirmation(): boolean { return this.GetValue(XAPPRowAction.RequiresConfirmationProp) as boolean; }
    public set RequiresConfirmation(pValue: boolean) { this.SetValue(XAPPRowAction.RequiresConfirmationProp, pValue); }

    public get ConfirmMessageKey(): string { return this.GetValue(XAPPRowAction.ConfirmMessageKeyProp) as string; }
    public set ConfirmMessageKey(pValue: string) { this.SetValue(XAPPRowAction.ConfirmMessageKeyProp, pValue); }

    public get RequiresCompany(): boolean { return this.GetValue(XAPPRowAction.RequiresCompanyProp) as boolean; }
    public set RequiresCompany(pValue: boolean) { this.SetValue(XAPPRowAction.RequiresCompanyProp, pValue); }
}
