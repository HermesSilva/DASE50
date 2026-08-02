import { XDesignElement } from "../../Design/XDesignElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPFormSection } from "./XAPPFormSection.js";

/**
 * Espelha `XApplicationViewer` (`app-consulta.md` §2) — um dos N visualizadores
 * somente-leitura de uma App. `Key` casa com `XAPPButton.Name` do botão que o abre
 * (`Botao("resumo", …, View, …)` ↔ `Viewer.Key = "resumo"`).
 */
export class XAPPApplicationViewer extends XDesignElement
{
    public static readonly KeyProp = XProperty.Register<XAPPApplicationViewer, string>(
        (p: XAPPApplicationViewer) => p.Key,
        "C55EC56C-AAC2-4712-9AEF-DEB36704F8CA",
        "Key",
        "Key (casa com o Name do botão)",
        ""
    );

    public static readonly TitleKeyProp = XProperty.Register<XAPPApplicationViewer, string>(
        (p: XAPPApplicationViewer) => p.TitleKey,
        "00D268A3-53E5-458D-A16D-7B61C96C5176",
        "TitleKey",
        "Title Key (i18n)",
        ""
    );

    public static readonly LoadEndpointProp = XProperty.Register<XAPPApplicationViewer, string>(
        (p: XAPPApplicationViewer) => p.LoadEndpoint,
        "294DA057-4677-4E3A-BA36-5647FC8E6BA9",
        "LoadEndpoint",
        "Load Endpoint",
        ""
    );

    public constructor()
    {
        super();
    }

    public get Key(): string { return this.GetValue(XAPPApplicationViewer.KeyProp) as string; }
    public set Key(pValue: string) { this.SetValue(XAPPApplicationViewer.KeyProp, pValue); }

    public get TitleKey(): string { return this.GetValue(XAPPApplicationViewer.TitleKeyProp) as string; }
    public set TitleKey(pValue: string) { this.SetValue(XAPPApplicationViewer.TitleKeyProp, pValue); }

    public get LoadEndpoint(): string { return this.GetValue(XAPPApplicationViewer.LoadEndpointProp) as string; }
    public set LoadEndpoint(pValue: string) { this.SetValue(XAPPApplicationViewer.LoadEndpointProp, pValue); }

    /** O visualizador carrega o seu próprio recorte: seções simples, como um `XAPPFormView`. */
    public AddSection(pTitleKey: string = ""): XAPPFormSection
    {
        const section = new XAPPFormSection();
        section.ID = XGuid.NewValue();
        section.TitleKey = pTitleKey;
        this.AppendChild(section);
        return section;
    }

    public GetSections(): XAPPFormSection[]
    {
        return this.GetChildrenOfType(XAPPFormSection);
    }
}
