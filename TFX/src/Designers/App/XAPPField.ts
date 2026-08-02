import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPEditorType } from "./XAPPEnums.js";
import { XAPPFieldBinding } from "./XAPPFieldBinding.js";
import { XAPPVisibilityRule } from "./XAPPVisibilityRule.js";

/**
 * Campo do formulário (`XFormSection.AddField(editor, linha, colSpan, regras?)`). Espelha
 * `XUIEditorModel` achatado no próprio campo (sem aninhar um "editor" à parte — mesma
 * economia que `XField` já faz para `DataType`/`Length`/`Scale` no domínio ORM).
 *
 * `Row`/`ColSpan` são a unidade lógica do grid de **32 colunas** (FE-2) — nunca medida de
 * largura em pixels (FE-3 é do `XAPPFormView.ModalWidth`, percentual da área do App).
 */
export class XAPPField extends XDesignElement
{
    public static readonly FieldNameProp = XProperty.Register<XAPPField, string>(
        (p: XAPPField) => p.FieldName,
        "878B19BD-CB26-4AB0-AA00-68635E44A74F",
        "FieldName",
        "Field Name",
        ""
    );

    public static readonly TitleKeyProp = XProperty.Register<XAPPField, string>(
        (p: XAPPField) => p.TitleKey,
        "8C11DF55-01AC-455E-9776-7265761CD8B6",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly EditorTypeProp = XProperty.Register<XAPPField, XAPPEditorType>(
        (p: XAPPField) => p.EditorType,
        "A96617B8-FBF6-41EE-B5ED-C0F92C97271D",
        "EditorType",
        "Editor Type",
        XAPPEditorType.Text
    );

    public static readonly CustomEditorNameProp = XProperty.Register<XAPPField, string>(
        (p: XAPPField) => p.CustomEditorName,
        "E783571C-40BD-4F51-A5A1-1DDE17AC7AFB",
        "CustomEditorName",
        "Custom Editor Name (XFieldEditorRegistry)",
        ""
    );

    public static readonly IsReadOnlyProp = XProperty.Register<XAPPField, boolean>(
        (p: XAPPField) => p.IsReadOnly,
        "9E385A15-2701-4009-B9D6-6DDF0B373E22",
        "IsReadOnly",
        "Is Read Only",
        false
    );

    public static readonly IsRequiredProp = XProperty.Register<XAPPField, boolean>(
        (p: XAPPField) => p.IsRequired,
        "E5B018FE-2FC5-47DC-9BA9-A93E317D20EC",
        "IsRequired",
        "Is Required",
        false
    );

    public static readonly DefaultValueProp = XProperty.Register<XAPPField, string>(
        (p: XAPPField) => p.DefaultValue,
        "E497AB95-867A-4CE4-8361-5D6A6B6C6FED",
        "DefaultValue",
        "Default Value",
        ""
    );

    public static readonly HintTextProp = XProperty.Register<XAPPField, string>(
        (p: XAPPField) => p.HintText,
        "7AEC45B6-A9DF-40B2-81A1-9DA84C6D05AB",
        "HintText",
        "Hint Text (i18n key)",
        ""
    );

    public static readonly MaxLengthProp = XProperty.Register<XAPPField, number>(
        (p: XAPPField) => p.MaxLength,
        "8ADCBD55-E0DC-4295-B410-7193301DB738",
        "MaxLength",
        "Max Length",
        0
    );

    public static readonly LookupEndpointProp = XProperty.Register<XAPPField, string>(
        (p: XAPPField) => p.LookupEndpoint,
        "2DD905AB-B750-4D60-9151-0661B937FEEE",
        "LookupEndpoint",
        "Lookup Endpoint",
        ""
    );

    public static readonly RowProp = XProperty.Register<XAPPField, number>(
        (p: XAPPField) => p.Row,
        "98C41EA5-F898-4375-A7EB-B0A752F2FE15",
        "Row",
        "Row (grid de 32 colunas — FE-2)",
        0
    );

    public static readonly ColSpanProp = XProperty.Register<XAPPField, number>(
        (p: XAPPField) => p.ColSpan,
        "29CF9C76-7F94-406C-BF7A-6C2232D4BF75",
        "ColSpan",
        "Col Span (1-32 — FE-2)",
        32
    );

    public constructor()
    {
        super();
    }

    public get FieldName(): string { return this.GetValue(XAPPField.FieldNameProp) as string; }
    public set FieldName(pValue: string) { this.SetValue(XAPPField.FieldNameProp, pValue); }

    public get TitleKey(): string { return this.GetValue(XAPPField.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPField.TitleKeyProp, pValue); }

    public get EditorType(): XAPPEditorType { return this.GetValue(XAPPField.EditorTypeProp) as XAPPEditorType; }
    public set EditorType(pValue: XAPPEditorType) { this.SetValue(XAPPField.EditorTypeProp, pValue); }

    public get CustomEditorName(): string { return this.GetValue(XAPPField.CustomEditorNameProp) as string; }
    public set CustomEditorName(pValue: string) { this.SetValue(XAPPField.CustomEditorNameProp, pValue); }

    public get IsReadOnly(): boolean { return this.GetValue(XAPPField.IsReadOnlyProp) as boolean; }
    public set IsReadOnly(pValue: boolean) { this.SetValue(XAPPField.IsReadOnlyProp, pValue); }

    public get IsRequired(): boolean { return this.GetValue(XAPPField.IsRequiredProp) as boolean; }
    public set IsRequired(pValue: boolean) { this.SetValue(XAPPField.IsRequiredProp, pValue); }

    public get DefaultValue(): string { return this.GetValue(XAPPField.DefaultValueProp) as string; }
    public set DefaultValue(pValue: string) { this.SetValue(XAPPField.DefaultValueProp, pValue); }

    public get HintText(): string { return this.GetValue(XAPPField.HintTextProp) as string; }
    public set HintText(pValue: string) { this.SetValue(XAPPField.HintTextProp, pValue); }

    public get MaxLength(): number { return this.GetValue(XAPPField.MaxLengthProp) as number; }
    public set MaxLength(pValue: number) { this.SetValue(XAPPField.MaxLengthProp, pValue); }

    public get LookupEndpoint(): string { return this.GetValue(XAPPField.LookupEndpointProp) as string; }
    public set LookupEndpoint(pValue: string) { this.SetValue(XAPPField.LookupEndpointProp, pValue); }

    public get Row(): number { return this.GetValue(XAPPField.RowProp) as number; }
    public set Row(pValue: number) { this.SetValue(XAPPField.RowProp, pValue); }

    public get ColSpan(): number { return this.GetValue(XAPPField.ColSpanProp) as number; }
    public set ColSpan(pValue: number) { this.SetValue(XAPPField.ColSpanProp, pValue); }

    // --- Cascata (XFieldBinding) ---------------------------------------------------------

    public CreateFieldBinding(pSourceField: string, pTargetField: string): XAPPFieldBinding
    {
        const binding = new XAPPFieldBinding();
        binding.ID = XGuid.NewValue();
        binding.SourceField = pSourceField;
        binding.TargetField = pTargetField;
        this.AppendChild(binding);
        return binding;
    }

    public GetFieldBindings(): XAPPFieldBinding[]
    {
        return this.GetChildrenOfType(XAPPFieldBinding);
    }

    // --- Visibilidade condicional (XVisibilityRule) --------------------------------------

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
}
