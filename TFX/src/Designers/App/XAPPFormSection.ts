import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPField } from "./XAPPField.js";

/**
 * Seção do formulário (`XFormSection`, `aba.AddSection(...)` no back). Agrupa campos sob
 * um cabeçalho opcional — `ShowHeader = false` é o caso de uma grade editável ocupando a
 * aba inteira (ver `PessoasApp.MontarEnderecos`, `app-mestre-detalhe.md`).
 */
export class XAPPFormSection extends XDesignElement
{
    public static readonly TitleKeyProp = XProperty.Register<XAPPFormSection, string>(
        (p: XAPPFormSection) => p.TitleKey,
        "A9265BC7-AFBD-4EBD-B51C-2FDFDB38A36F",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly ShowHeaderProp = XProperty.Register<XAPPFormSection, boolean>(
        (p: XAPPFormSection) => p.ShowHeader,
        "42821CDA-565F-4E25-B810-91FB63035AE0",
        "ShowHeader",
        "Show Header",
        true
    );

    public constructor()
    {
        super();
    }

    public get TitleKey(): string { return this.GetValue(XAPPFormSection.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPFormSection.TitleKeyProp, pValue); }

    public get ShowHeader(): boolean { return this.GetValue(XAPPFormSection.ShowHeaderProp) as boolean; }
    public set ShowHeader(pValue: boolean) { this.SetValue(XAPPFormSection.ShowHeaderProp, pValue); }

    /** Espelha `XFormSection.AddField(editor, linha, colSpan)` — grid de 32 colunas (FE-2). */
    public AddField(pFieldName: string, pRow: number, pColSpan: number): XAPPField
    {
        const field = new XAPPField();
        field.ID = XGuid.NewValue();
        field.FieldName = pFieldName;
        field.Row = pRow;
        field.ColSpan = pColSpan;
        this.AppendChild(field);
        return field;
    }

    public GetFields(): XAPPField[]
    {
        return this.GetChildrenOfType(XAPPField);
    }
}
