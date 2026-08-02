import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPColumn } from "./XAPPColumn.js";

/**
 * Campo do painel de leitura por extenso (`DetailFields`, §4 de `app-mestre-detalhe.md`).
 * Classe própria — não subclasse de `XAPPColumn` — porque `GetChildrenOfType` decide por
 * `instanceof`, e colunas e campos de detalhe convivem como filhos do mesmo `XAPPDetailGrid`;
 * precisam de tags/tipos distintos para `GetColumns()`/`GetDetailFields()` não se misturarem.
 */
export class XAPPDetailField extends XDesignElement
{
    public static readonly FieldNameProp = XProperty.Register<XAPPDetailField, string>(
        (p: XAPPDetailField) => p.FieldName,
        "B77DA379-4A45-417E-A878-D9F95CCCDADF",
        "FieldName",
        "Field Name",
        ""
    );

    public static readonly TitleKeyProp = XProperty.Register<XAPPDetailField, string>(
        (p: XAPPDetailField) => p.TitleKey,
        "D842DE1E-DB37-4934-98F8-1AC62CED48D3",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public constructor()
    {
        super();
    }

    public get FieldName(): string { return this.GetValue(XAPPDetailField.FieldNameProp) as string; }
    public set FieldName(pValue: string) { this.SetValue(XAPPDetailField.FieldNameProp, pValue); }

    public get TitleKey(): string { return this.GetValue(XAPPDetailField.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPDetailField.TitleKeyProp, pValue); }
}

/**
 * Espelha `XDetailGrid` — mestre-detalhe remoto, carregado à parte do formulário (ver
 * `app-mestre-detalhe.md`). `Columns` é a grade; `DetailFields` (mesma classe `XAPPColumn`,
 * reaproveitada) é o painel de leitura por extenso da linha selecionada; `ChildGrid` aninha
 * OUTRA `XAPPDetailGrid` para o caso de dois níveis (tributos de um item de nota).
 */
export class XAPPDetailGrid extends XDesignElement
{
    public static readonly DataEndpointProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.DataEndpoint,
        "78B564D0-8CC6-470C-8CEE-52EC89B48C0C",
        "DataEndpoint",
        "Data Endpoint ({id}/{rowId})",
        ""
    );

    public static readonly AddEndpointProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.AddEndpoint,
        "29864175-162B-4661-9A93-A6D0EE5505F7",
        "AddEndpoint",
        "Add Endpoint",
        ""
    );

    public static readonly RemoveEndpointProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.RemoveEndpoint,
        "0BB46223-B753-4306-99CD-7918933142E9",
        "RemoveEndpoint",
        "Remove Endpoint",
        ""
    );

    public static readonly LookupEndpointProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.LookupEndpoint,
        "F64C1BE4-A597-45E8-BD87-13C3ED21383A",
        "LookupEndpoint",
        "Lookup Endpoint (catálogo disponível)",
        ""
    );

    public static readonly KeyFieldProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.KeyField,
        "AAA8C6E6-E187-45A9-8A27-F52522747316",
        "KeyField",
        "Key Field",
        "id"
    );

    public static readonly EmptyMessageKeyProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.EmptyMessageKey,
        "1E6CED3F-56EB-4157-A271-5476170094D0",
        "EmptyMessageKey",
        "Empty Message Key (i18n)",
        ""
    );

    public static readonly RemoveConfirmMessageKeyProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.RemoveConfirmMessageKey,
        "46474194-E06D-451D-9212-66007FA89C69",
        "RemoveConfirmMessageKey",
        "Remove Confirm Message Key (i18n)",
        ""
    );

    public static readonly CanAddProp = XProperty.Register<XAPPDetailGrid, boolean>(
        (p: XAPPDetailGrid) => p.CanAdd,
        "D3D17725-055A-4629-BBE8-8F1798E58E75",
        "CanAdd",
        "Can Add",
        true
    );

    public static readonly CanRemoveProp = XProperty.Register<XAPPDetailGrid, boolean>(
        (p: XAPPDetailGrid) => p.CanRemove,
        "7E658C6E-64D7-4E70-8422-21942D1C1FFF",
        "CanRemove",
        "Can Remove",
        true
    );

    public static readonly DetailTitleKeyProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.DetailTitleKey,
        "C8852B4C-7876-4D5F-B9D2-E78F3DE71A4B",
        "DetailTitleKey",
        "Detail Panel Title Key (i18n)",
        ""
    );

    public static readonly ChildTitleKeyProp = XProperty.Register<XAPPDetailGrid, string>(
        (p: XAPPDetailGrid) => p.ChildTitleKey,
        "B47D29AB-FD43-4F6B-BDA9-7FE654FBA37B",
        "ChildTitleKey",
        "Child Grid Title Key (i18n)",
        ""
    );

    public constructor()
    {
        super();
    }

    public get DataEndpoint(): string { return this.GetValue(XAPPDetailGrid.DataEndpointProp) as string; }
    public set DataEndpoint(pValue: string) { this.SetValue(XAPPDetailGrid.DataEndpointProp, pValue); }

    public get AddEndpoint(): string { return this.GetValue(XAPPDetailGrid.AddEndpointProp) as string; }
    public set AddEndpoint(pValue: string) { this.SetValue(XAPPDetailGrid.AddEndpointProp, pValue); }

    public get RemoveEndpoint(): string { return this.GetValue(XAPPDetailGrid.RemoveEndpointProp) as string; }
    public set RemoveEndpoint(pValue: string) { this.SetValue(XAPPDetailGrid.RemoveEndpointProp, pValue); }

    public get LookupEndpoint(): string { return this.GetValue(XAPPDetailGrid.LookupEndpointProp) as string; }
    public set LookupEndpoint(pValue: string) { this.SetValue(XAPPDetailGrid.LookupEndpointProp, pValue); }

    public get KeyField(): string { return this.GetValue(XAPPDetailGrid.KeyFieldProp) as string; }
    public set KeyField(pValue: string) { this.SetValue(XAPPDetailGrid.KeyFieldProp, pValue); }

    public get EmptyMessageKey(): string { return this.GetValue(XAPPDetailGrid.EmptyMessageKeyProp) as string; }
    public set EmptyMessageKey(pValue: string) { this.SetValue(XAPPDetailGrid.EmptyMessageKeyProp, pValue); }

    public get RemoveConfirmMessageKey(): string { return this.GetValue(XAPPDetailGrid.RemoveConfirmMessageKeyProp) as string; }
    public set RemoveConfirmMessageKey(pValue: string) { this.SetValue(XAPPDetailGrid.RemoveConfirmMessageKeyProp, pValue); }

    public get CanAdd(): boolean { return this.GetValue(XAPPDetailGrid.CanAddProp) as boolean; }
    public set CanAdd(pValue: boolean) { this.SetValue(XAPPDetailGrid.CanAddProp, pValue); }

    public get CanRemove(): boolean { return this.GetValue(XAPPDetailGrid.CanRemoveProp) as boolean; }
    public set CanRemove(pValue: boolean) { this.SetValue(XAPPDetailGrid.CanRemoveProp, pValue); }

    public get DetailTitleKey(): string { return this.GetValue(XAPPDetailGrid.DetailTitleKeyProp) as string; }
    public set DetailTitleKey(pValue: string) { this.SetValue(XAPPDetailGrid.DetailTitleKeyProp, pValue); }

    public get ChildTitleKey(): string { return this.GetValue(XAPPDetailGrid.ChildTitleKeyProp) as string; }
    public set ChildTitleKey(pValue: string) { this.SetValue(XAPPDetailGrid.ChildTitleKeyProp, pValue); }

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

    /** Painel de leitura por extenso da linha selecionada (§4 de `app-mestre-detalhe.md`). */
    public AddDetailField(pFieldName: string): XAPPDetailField
    {
        const field = new XAPPDetailField();
        field.ID = XGuid.NewValue();
        field.FieldName = pFieldName;
        this.AppendChild(field);
        return field;
    }

    public GetDetailFields(): XAPPDetailField[]
    {
        return this.GetChildrenOfType(XAPPDetailField);
    }

    /** Único nível de aninhamento suportado — `ChildGrid.ChildGrid` não é lido pelo motor. */
    public CreateChildGrid(): XAPPDetailGrid
    {
        const child = new XAPPDetailGrid();
        child.ID = XGuid.NewValue();
        this.AppendChild(child);
        return child;
    }

    public GetChildGrid(): XAPPDetailGrid | null
    {
        return this.GetChild<XAPPDetailGrid>(c => c instanceof XAPPDetailGrid);
    }
}
