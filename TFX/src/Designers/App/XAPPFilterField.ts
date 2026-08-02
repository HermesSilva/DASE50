import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XAPPDataType, XAPPFilterOperator } from "./XAPPEnums.js";

/**
 * Filtro da grade (`XApplication.DataView.Filter.Editors`). Fixa seu operador e esconde
 * o seletor — ver `app-crud.md` §3 ("Filtros").
 */
export class XAPPFilterField extends XDesignElement
{
    public static readonly FieldNameProp = XProperty.Register<XAPPFilterField, string>(
        (p: XAPPFilterField) => p.FieldName,
        "1622ABEB-1867-4C8C-B2DA-2AA0470BD8ED",
        "FieldName",
        "Field Name",
        ""
    );

    public static readonly TitleKeyProp = XProperty.Register<XAPPFilterField, string>(
        (p: XAPPFilterField) => p.TitleKey,
        "91A98EB3-E9E8-4FCC-86E1-16F144A944CA",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly DataTypeProp = XProperty.Register<XAPPFilterField, XAPPDataType>(
        (p: XAPPFilterField) => p.DataType,
        "A91F4E81-227D-42AF-A581-313C09784F90",
        "DataType",
        "Data Type",
        XAPPDataType.String
    );

    public static readonly DefaultOperatorProp = XProperty.Register<XAPPFilterField, XAPPFilterOperator>(
        (p: XAPPFilterField) => p.DefaultOperator,
        "68378BBA-60B7-4697-AFF1-BB7295FE8222",
        "DefaultOperator",
        "Default Operator",
        XAPPFilterOperator.Contains
    );

    public static readonly ShowOperatorSelectorProp = XProperty.Register<XAPPFilterField, boolean>(
        (p: XAPPFilterField) => p.ShowOperatorSelector,
        "B2960389-30E7-4086-838B-8A1CA9971D77",
        "ShowOperatorSelector",
        "Show Operator Selector",
        false
    );

    public static readonly OrderProp = XProperty.Register<XAPPFilterField, number>(
        (p: XAPPFilterField) => p.Order,
        "0876FC93-5FFB-4081-A5FD-1B3BC64EBD09",
        "Order",
        "Order",
        0
    );

    public constructor()
    {
        super();
    }

    public get FieldName(): string { return this.GetValue(XAPPFilterField.FieldNameProp) as string; }
    public set FieldName(pValue: string) { this.SetValue(XAPPFilterField.FieldNameProp, pValue); }

    public get TitleKey(): string { return this.GetValue(XAPPFilterField.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPFilterField.TitleKeyProp, pValue); }

    public get DataType(): XAPPDataType { return this.GetValue(XAPPFilterField.DataTypeProp) as XAPPDataType; }
    public set DataType(pValue: XAPPDataType) { this.SetValue(XAPPFilterField.DataTypeProp, pValue); }

    public get DefaultOperator(): XAPPFilterOperator { return this.GetValue(XAPPFilterField.DefaultOperatorProp) as XAPPFilterOperator; }
    public set DefaultOperator(pValue: XAPPFilterOperator) { this.SetValue(XAPPFilterField.DefaultOperatorProp, pValue); }

    public get ShowOperatorSelector(): boolean { return this.GetValue(XAPPFilterField.ShowOperatorSelectorProp) as boolean; }
    public set ShowOperatorSelector(pValue: boolean) { this.SetValue(XAPPFilterField.ShowOperatorSelectorProp, pValue); }

    public get Order(): number { return this.GetValue(XAPPFilterField.OrderProp) as number; }
    public set Order(pValue: number) { this.SetValue(XAPPFilterField.OrderProp, pValue); }
}
