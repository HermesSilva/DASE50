import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XAPPVisibilityOperator } from "./XAPPEnums.js";

/**
 * Espelha `XVisibilityRule` — campo/aba/linha condicional. `Values` é pipe-separated;
 * `Negate` inverte o veredito de qualquer forma. Regras múltiplas no mesmo pai são
 * CONJUNÇÃO (todas precisam valer) — ver `app-acoes-de-linha.md` §3.
 */
export class XAPPVisibilityRule extends XDesignElement
{
    public static readonly FieldProp = XProperty.Register<XAPPVisibilityRule, string>(
        (p: XAPPVisibilityRule) => p.Field,
        "2BA4592A-CC9D-4D3A-820D-5F3FE7CD3F20",
        "Field",
        "Field",
        ""
    );

    public static readonly OperatorProp = XProperty.Register<XAPPVisibilityRule, XAPPVisibilityOperator>(
        (p: XAPPVisibilityRule) => p.Operator,
        "56DB0B43-4BCA-4462-9E3B-653DBDD54438",
        "Operator",
        "Operator",
        XAPPVisibilityOperator.Igual
    );

    // Identificador do getter/setter é "MatchValues", não "Values": `XPersistableElement`
    // já declara um `Values` protegido (o contêiner interno de dados) e colidiria.
    public static readonly ValuesProp = XProperty.Register<XAPPVisibilityRule, string>(
        (p: XAPPVisibilityRule) => p.MatchValues,
        "41A5073F-D3D4-462D-8B31-61DAA03C037A",
        "Values",
        "Values (pipe-separated)",
        ""
    );

    public static readonly NegateProp = XProperty.Register<XAPPVisibilityRule, boolean>(
        (p: XAPPVisibilityRule) => p.Negate,
        "C3D902B3-EB5B-4D01-A0BB-4CCACC799073",
        "Negate",
        "Negate",
        false
    );

    public constructor()
    {
        super();
    }

    public get Field(): string { return this.GetValue(XAPPVisibilityRule.FieldProp) as string; }
    public set Field(pValue: string) { this.SetValue(XAPPVisibilityRule.FieldProp, pValue); }

    public get Operator(): XAPPVisibilityOperator { return this.GetValue(XAPPVisibilityRule.OperatorProp) as XAPPVisibilityOperator; }
    public set Operator(pValue: XAPPVisibilityOperator) { this.SetValue(XAPPVisibilityRule.OperatorProp, pValue); }

    public get MatchValues(): string { return this.GetValue(XAPPVisibilityRule.ValuesProp) as string; }
    public set MatchValues(pValue: string) { this.SetValue(XAPPVisibilityRule.ValuesProp, pValue); }

    public get Negate(): boolean { return this.GetValue(XAPPVisibilityRule.NegateProp) as boolean; }
    public set Negate(pValue: boolean) { this.SetValue(XAPPVisibilityRule.NegateProp, pValue); }
}
