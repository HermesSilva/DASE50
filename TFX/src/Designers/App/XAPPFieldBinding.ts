import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";

/**
 * Espelha `XFieldBinding` — preenchimento em cascata (ex.: CNPJ → endereços/sócios).
 * Vive dentro de `XAPPField.FieldBindings`, ligado ao editor de ORIGEM (o campo com
 * `LookupEndpoint`) — ver `extensao-do-motor.md` §1.
 */
export class XAPPFieldBinding extends XDesignElement
{
    public static readonly SourceFieldProp = XProperty.Register<XAPPFieldBinding, string>(
        (p: XAPPFieldBinding) => p.SourceField,
        "E7BB2A0F-66F5-4B19-8B0B-A21491F78748",
        "SourceField",
        "Source Field (resposta do lookup)",
        ""
    );

    public static readonly TargetFieldProp = XProperty.Register<XAPPFieldBinding, string>(
        (p: XAPPFieldBinding) => p.TargetField,
        "E9491CEB-D7F7-4153-8744-2B0DED54DFBA",
        "TargetField",
        "Target Field (campo do formulário)",
        ""
    );

    public constructor()
    {
        super();
    }

    public get SourceField(): string { return this.GetValue(XAPPFieldBinding.SourceFieldProp) as string; }
    public set SourceField(pValue: string) { this.SetValue(XAPPFieldBinding.SourceFieldProp, pValue); }

    public get TargetField(): string { return this.GetValue(XAPPFieldBinding.TargetFieldProp) as string; }
    public set TargetField(pValue: string) { this.SetValue(XAPPFieldBinding.TargetFieldProp, pValue); }
}
