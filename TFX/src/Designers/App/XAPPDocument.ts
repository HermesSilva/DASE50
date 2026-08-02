import { XDesignElement } from "../../Design/XDesignElement.js";
import { XAPPDesign } from "./XAPPDesign.js";

/**
 * Raiz do arquivo `.dsapp`. Não estende `XDocument<T extends XDesign>` (o genérico do ORM,
 * que pressupõe canvas espacial com roteamento de linhas — `XDesign extends XRectangle`);
 * aqui o documento é árvore pura, então a base é `XDesignElement` diretamente.
 *
 * `Initialize()` consolida múltiplos `XAPPDesign` após desserialização — mesma defesa que
 * `XORMDocument.Initialize` aplica (o construtor cria um `XAPPDesign` vazio; o texto
 * desserializado traz o real; sem consolidar, o vazio venceria e o conteúdo lido se perderia).
 */
export class XAPPDocument extends XDesignElement
{
    protected PDesign: XAPPDesign;

    public constructor()
    {
        super();
        this.PDesign = new XAPPDesign();
        this.AppendChild(this.PDesign);
    }

    public get Design(): XAPPDesign
    {
        return this.PDesign;
    }

    public override Initialize(): void
    {
        super.Initialize();

        const allDesigns = this.ChildNodes.filter(
            child => child instanceof XAPPDesign
        ) as XAPPDesign[];

        if (allDesigns.length <= 1)
        {
            if (allDesigns.length === 1)
                this.PDesign = allDesigns[0];
            return;
        }

        let primaryDesign = allDesigns[0];
        if (primaryDesign.ChildNodes.length === 0)
        {
            const nonEmpty = allDesigns.find(d => d.ChildNodes.length > 0);
            if (nonEmpty)
                primaryDesign = nonEmpty;
            else
            {
                const comValores = allDesigns.find(d => d.HasStoredValues());
                if (comValores)
                    primaryDesign = comValores;
            }
        }

        for (const design of allDesigns)
        {
            if (design !== primaryDesign && design.ChildNodes.length > 0)
            {
                const children = [...design.ChildNodes];
                for (const child of children)
                {
                    design.RemoveChild(child);
                    primaryDesign.AppendChild(child);
                }
            }
        }

        for (const design of allDesigns)
        {
            if (design !== primaryDesign)
            {
                const idx = this.ChildNodes.indexOf(design);
                this.ChildNodes.splice(idx, 1);
            }
        }

        this.PDesign = primaryDesign;
    }
}
