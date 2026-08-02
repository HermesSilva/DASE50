import { XElementRegistry } from "../../Data/XElementRegistry.js";
import { XAPPDocument } from "./XAPPDocument.js";
import { XAPPDesign } from "./XAPPDesign.js";
import { XAPPApplication } from "./XAPPApplication.js";
import { XAPPColumn } from "./XAPPColumn.js";
import { XAPPFilterField } from "./XAPPFilterField.js";
import { XAPPButton } from "./XAPPButton.js";
import { XAPPRowAction } from "./XAPPRowAction.js";
import { XAPPVisibilityRule } from "./XAPPVisibilityRule.js";
import { XAPPFieldBinding } from "./XAPPFieldBinding.js";
import { XAPPField } from "./XAPPField.js";
import { XAPPFormSection } from "./XAPPFormSection.js";
import { XAPPDetailGrid, XAPPDetailField } from "./XAPPDetailGrid.js";
import { XAPPFormTab } from "./XAPPFormTab.js";
import { XAPPApplicationViewer } from "./XAPPApplicationViewer.js";
import { XAPPFormView } from "./XAPPFormView.js";
import { XAPPTabbedFormView } from "./XAPPTabbedFormView.js";

let _Registered = false;

/**
 * Registro central de serialização do domínio de App — mirror de `RegisterORMElements`
 * (`XORMRegistry.ts`). Sem par em C#: é vocabulário novo, então os `ClassID` abaixo não
 * precisam casar com nada existente (ao contrário dos comentários do registro ORM, que
 * preservam CIDs de um `TFX.DASE.Designer.Core.ORM` legado).
 */
export function RegisterAppElements(): void
{
    if (_Registered)
        return;

    const registry = XElementRegistry.Instance;

    registry.Register({ TagName: "XAPPDocument", Constructor: XAPPDocument, ClassID: "CE7FAFBC-3DBA-4409-9D52-97000209DC7E" });
    registry.Register({ TagName: "XAPPDesign", Constructor: XAPPDesign, ClassID: "B5DE0846-1279-4A24-98E6-41C0AA9CA5C2" });
    registry.Register({ TagName: "XAPPApplication", Constructor: XAPPApplication, ClassID: "1E4859C2-7CE3-45EB-AEF6-5312DAEA6E30" });
    registry.Register({ TagName: "XAPPColumn", Constructor: XAPPColumn, ClassID: "96CDDC3F-B566-4148-B887-0FDFFDA376DE" });
    registry.Register({ TagName: "XAPPFilterField", Constructor: XAPPFilterField, ClassID: "2ECDC5CA-74B9-444E-8AC4-C6422CF432DF" });
    registry.Register({ TagName: "XAPPButton", Constructor: XAPPButton, ClassID: "8811DABD-980F-4C3F-81CF-4E63F6333262" });
    registry.Register({ TagName: "XAPPRowAction", Constructor: XAPPRowAction, ClassID: "56D39059-4CDB-4FB6-80B6-EFFEA1848560" });
    registry.Register({ TagName: "XAPPVisibilityRule", Constructor: XAPPVisibilityRule, ClassID: "A67D7EFD-0290-43F5-ACC5-69163E8CD2B9" });
    registry.Register({ TagName: "XAPPFieldBinding", Constructor: XAPPFieldBinding, ClassID: "2669501C-13FA-4692-96CE-39E6BFFA090E" });
    registry.Register({ TagName: "XAPPField", Constructor: XAPPField, ClassID: "BB549D43-CADF-4B00-8AC4-9DC20C88AF56" });
    registry.Register({ TagName: "XAPPFormSection", Constructor: XAPPFormSection, ClassID: "C8253CDC-8281-4C17-92CB-3B1F4D13BD20" });
    registry.Register({ TagName: "XAPPDetailGrid", Constructor: XAPPDetailGrid, ClassID: "BE3C96B2-8146-4128-BEE5-BCFC49952D4A" });
    registry.Register({ TagName: "XAPPDetailField", Constructor: XAPPDetailField, ClassID: "58917227-12F6-4B6A-A732-476B481C4A18" });
    registry.Register({ TagName: "XAPPFormTab", Constructor: XAPPFormTab, ClassID: "B2379663-8CFC-48E6-9EFA-51BC31D5839C" });
    registry.Register({ TagName: "XAPPApplicationViewer", Constructor: XAPPApplicationViewer, ClassID: "92CA73EF-8219-469F-B9CD-4A3BD3F1D05A" });
    registry.Register({ TagName: "XAPPFormView", Constructor: XAPPFormView, ClassID: "45189925-92C0-408C-8D86-67CB990FC0E6" });
    registry.Register({ TagName: "XAPPTabbedFormView", Constructor: XAPPTabbedFormView, ClassID: "362E7C82-436A-436A-BEAD-7C2D72AD373C" });

    registry.RegisterChildTag("XAPPDocument", "XAPPDesign");
    registry.RegisterChildTag("XAPPDesign", "XAPPApplication");

    registry.RegisterChildTag("XAPPApplication", "XAPPColumn");
    registry.RegisterChildTag("XAPPApplication", "XAPPFilterField");
    registry.RegisterChildTag("XAPPApplication", "XAPPButton");
    registry.RegisterChildTag("XAPPApplication", "XAPPRowAction");
    registry.RegisterChildTag("XAPPApplication", "XAPPApplicationViewer");
    registry.RegisterChildTag("XAPPApplication", "XAPPFormView");
    registry.RegisterChildTag("XAPPApplication", "XAPPTabbedFormView");

    registry.RegisterChildTag("XAPPApplicationViewer", "XAPPFormSection");
    registry.RegisterChildTag("XAPPFormView", "XAPPFormSection");
    registry.RegisterChildTag("XAPPTabbedFormView", "XAPPFormTab");

    registry.RegisterChildTag("XAPPFormTab", "XAPPFormSection");
    registry.RegisterChildTag("XAPPFormTab", "XAPPVisibilityRule");
    registry.RegisterChildTag("XAPPFormTab", "XAPPDetailGrid");

    registry.RegisterChildTag("XAPPFormSection", "XAPPField");

    registry.RegisterChildTag("XAPPField", "XAPPFieldBinding");
    registry.RegisterChildTag("XAPPField", "XAPPVisibilityRule");

    registry.RegisterChildTag("XAPPDetailGrid", "XAPPColumn");
    registry.RegisterChildTag("XAPPDetailGrid", "XAPPDetailField");
    registry.RegisterChildTag("XAPPDetailGrid", "XAPPDetailGrid");

    _Registered = true;
}
