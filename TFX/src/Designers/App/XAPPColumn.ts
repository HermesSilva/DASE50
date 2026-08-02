import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XAPPDataType } from "./XAPPEnums.js";

/**
 * Coluna da grade (`XApplication.DataView.Header.Columns`, `Coluna(...)` no back).
 * `FieldName` casa 1:1 com a propriedade do DTO (o `XQueryEngine` resolve por reflexão),
 * não com a coluna do banco — ver `app-crud.md` §3.
 */
export class XAPPColumn extends XDesignElement
{
    public static readonly FieldNameProp = XProperty.Register<XAPPColumn, string>(
        (p: XAPPColumn) => p.FieldName,
        "6120E327-695F-4E7C-A849-6B9DC600E8D5",
        "FieldName",
        "Field Name",
        ""
    );

    public static readonly TitleKeyProp = XProperty.Register<XAPPColumn, string>(
        (p: XAPPColumn) => p.TitleKey,
        "7F4506A7-D6FA-4FB2-8D62-910DAB6C06D4",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly DataTypeProp = XProperty.Register<XAPPColumn, XAPPDataType>(
        (p: XAPPColumn) => p.DataType,
        "24E6B87B-DAF1-4BF0-A2A2-AD76910A91CD",
        "DataType",
        "Data Type",
        XAPPDataType.String
    );

    public static readonly WidthProp = XProperty.Register<XAPPColumn, number>(
        (p: XAPPColumn) => p.Width,
        "0508335A-5DF6-476C-B899-D6C5C65109E3",
        "Width",
        "Width (px)",
        160
    );

    public static readonly IsTranslatableProp = XProperty.Register<XAPPColumn, boolean>(
        (p: XAPPColumn) => p.IsTranslatable,
        "FDBD810F-C1CF-49B6-951A-E663EB7360BC",
        "IsTranslatable",
        "Is Translatable (pTraduzivel)",
        false
    );

    public static readonly OrderProp = XProperty.Register<XAPPColumn, number>(
        (p: XAPPColumn) => p.Order,
        "E1DC9477-FBBC-40C6-81AB-4954E0EA01A7",
        "Order",
        "Order",
        0
    );

    public constructor()
    {
        super();
    }

    public get FieldName(): string { return this.GetValue(XAPPColumn.FieldNameProp) as string; }
    public set FieldName(pValue: string) { this.SetValue(XAPPColumn.FieldNameProp, pValue); }

    public get TitleKey(): string { return this.GetValue(XAPPColumn.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPColumn.TitleKeyProp, pValue); }

    public get DataType(): XAPPDataType { return this.GetValue(XAPPColumn.DataTypeProp) as XAPPDataType; }
    public set DataType(pValue: XAPPDataType) { this.SetValue(XAPPColumn.DataTypeProp, pValue); }

    public get Width(): number { return this.GetValue(XAPPColumn.WidthProp) as number; }
    public set Width(pValue: number) { this.SetValue(XAPPColumn.WidthProp, pValue); }

    public get IsTranslatable(): boolean { return this.GetValue(XAPPColumn.IsTranslatableProp) as boolean; }
    public set IsTranslatable(pValue: boolean) { this.SetValue(XAPPColumn.IsTranslatableProp, pValue); }

    public get Order(): number { return this.GetValue(XAPPColumn.OrderProp) as number; }
    public set Order(pValue: number) { this.SetValue(XAPPColumn.OrderProp, pValue); }
}
