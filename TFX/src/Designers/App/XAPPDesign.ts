import { XDesignElement } from "../../Design/XDesignElement.js";
import { XGuid } from "../../Core/XGuid.js";
import { XAPPApplication } from "./XAPPApplication.js";

/**
 * Contêiner do documento — mirror não-espacial de `XORMDesign` (aqui não há canvas ERD:
 * um `.dsapp` guarda EXATAMENTE uma `XAPPApplication`, não uma coleção posicionada).
 */
export class XAPPDesign extends XDesignElement
{
    public constructor()
    {
        super();
    }

    public CreateApplication(pName: string = ""): XAPPApplication
    {
        const existing = this.GetApplication();
        if (existing !== null)
            return existing;

        const app = new XAPPApplication();
        app.ID = XGuid.NewValue();
        app.Name = pName;
        this.AppendChild(app);
        return app;
    }

    public GetApplication(): XAPPApplication | null
    {
        return this.GetChild<XAPPApplication>(c => c instanceof XAPPApplication);
    }
}
