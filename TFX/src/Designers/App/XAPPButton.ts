import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XAPPButtonAction, XAPPButtonType } from "./XAPPEnums.js";

/**
 * Botão da barra (`XApplication.ButtonBar.Buttons`, `Botao(...)` no back). `Action = Custom`
 * dispensa `ActionCommand`, resolvido no front por `XButtonActionRegistry` — ver
 * `extensao-do-motor.md`.
 */
export class XAPPButton extends XDesignElement
{
    public static readonly TitleKeyProp = XProperty.Register<XAPPButton, string>(
        (p: XAPPButton) => p.TitleKey,
        "4314D198-0978-4F60-BDB9-FC54BF4D7184",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly IconProp = XProperty.Register<XAPPButton, string>(
        (p: XAPPButton) => p.Icon,
        "79989E17-C37B-4407-A472-49EC82968306",
        "Icon",
        "Icon (lucide)",
        ""
    );

    public static readonly ButtonTypeProp = XProperty.Register<XAPPButton, XAPPButtonType>(
        (p: XAPPButton) => p.ButtonType,
        "4DB63023-E07F-4BB2-BEFB-4057BC1EB9A6",
        "ButtonType",
        "Button Type",
        XAPPButtonType.Secondary
    );

    public static readonly ActionProp = XProperty.Register<XAPPButton, XAPPButtonAction>(
        (p: XAPPButton) => p.Action,
        "E92F497E-8EA4-4438-8998-5D19913DE014",
        "Action",
        "Action",
        XAPPButtonAction.Custom
    );

    public static readonly ActionCommandProp = XProperty.Register<XAPPButton, string>(
        (p: XAPPButton) => p.ActionCommand,
        "206163E7-3792-4578-A991-092FA1E8FECD",
        "ActionCommand",
        "Action Command (custom, front registry)",
        ""
    );

    public static readonly OrderProp = XProperty.Register<XAPPButton, number>(
        (p: XAPPButton) => p.Order,
        "2F08EB58-E711-47F4-8570-8A521371E554",
        "Order",
        "Order",
        0
    );

    public static readonly RequiresSelectionProp = XProperty.Register<XAPPButton, boolean>(
        (p: XAPPButton) => p.RequiresSelection,
        "0AE976FE-9441-4056-BB8F-6EFAD05A2326",
        "RequiresSelection",
        "Requires Selection",
        false
    );

    public static readonly RequiresConfirmationProp = XProperty.Register<XAPPButton, boolean>(
        (p: XAPPButton) => p.RequiresConfirmation,
        "756237CC-E242-43BE-A118-2F229EC94BE0",
        "RequiresConfirmation",
        "Requires Confirmation",
        false
    );

    public static readonly ConfirmMessageKeyProp = XProperty.Register<XAPPButton, string>(
        (p: XAPPButton) => p.ConfirmMessageKey,
        "FB71FE4F-8BAF-4AB4-B0CD-D953C389D532",
        "ConfirmMessageKey",
        "Confirm Message Key (i18n)",
        ""
    );

    public constructor()
    {
        super();
    }

    public get TitleKey(): string { return this.GetValue(XAPPButton.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPButton.TitleKeyProp, pValue); }

    public get Icon(): string { return this.GetValue(XAPPButton.IconProp) as string; }
    public set Icon(pValue: string) { this.SetValue(XAPPButton.IconProp, pValue); }

    public get ButtonType(): XAPPButtonType { return this.GetValue(XAPPButton.ButtonTypeProp) as XAPPButtonType; }
    public set ButtonType(pValue: XAPPButtonType) { this.SetValue(XAPPButton.ButtonTypeProp, pValue); }

    public get Action(): XAPPButtonAction { return this.GetValue(XAPPButton.ActionProp) as XAPPButtonAction; }
    public set Action(pValue: XAPPButtonAction) { this.SetValue(XAPPButton.ActionProp, pValue); }

    public get ActionCommand(): string { return this.GetValue(XAPPButton.ActionCommandProp) as string; }
    public set ActionCommand(pValue: string) { this.SetValue(XAPPButton.ActionCommandProp, pValue); }

    public get Order(): number { return this.GetValue(XAPPButton.OrderProp) as number; }
    public set Order(pValue: number) { this.SetValue(XAPPButton.OrderProp, pValue); }

    public get RequiresSelection(): boolean { return this.GetValue(XAPPButton.RequiresSelectionProp) as boolean; }
    public set RequiresSelection(pValue: boolean) { this.SetValue(XAPPButton.RequiresSelectionProp, pValue); }

    public get RequiresConfirmation(): boolean { return this.GetValue(XAPPButton.RequiresConfirmationProp) as boolean; }
    public set RequiresConfirmation(pValue: boolean) { this.SetValue(XAPPButton.RequiresConfirmationProp, pValue); }

    public get ConfirmMessageKey(): string { return this.GetValue(XAPPButton.ConfirmMessageKeyProp) as string; }
    public set ConfirmMessageKey(pValue: string) { this.SetValue(XAPPButton.ConfirmMessageKeyProp, pValue); }
}
