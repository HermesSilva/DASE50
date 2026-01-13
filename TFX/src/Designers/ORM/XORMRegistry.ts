import { XElementRegistry } from "../../Data/XElementRegistry.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMField } from "./XORMField.js";
import { XORMPKField } from "./XORMPKField.js";
import { XORMReference } from "./XORMReference.js";

let _Registered = false;

export function RegisterORMElements(): void
{
    if (_Registered)
        return;

    const registry = XElementRegistry.Instance;

    registry.Register({
        TagName: "XORMDocument",
        Constructor: XORMDocument,
        ClassID: "XORM-DOC-001"
    });

    registry.Register({
        TagName: "XORMDesign",
        Constructor: XORMDesign,
        ClassID: "XORM-DES-001"
    });

    registry.Register({
        TagName: "XORMTable",
        Constructor: XORMTable,
        ClassID: "XORM-TBL-001"
    });

    registry.Register({
        TagName: "XORMField",
        Constructor: XORMField,
        ClassID: "XORM-FLD-001"
    });

    registry.Register({
        TagName: "XORMPKField",
        Constructor: XORMPKField,
        ClassID: "XORM-PKF-001"
    });

    registry.Register({
        TagName: "XORMReference",
        Constructor: XORMReference,
        ClassID: "XORM-REF-001"
    });

    registry.RegisterChildTag("XORMDocument", "XORMDesign");
    registry.RegisterChildTag("XORMDesign", "XORMTable");
    registry.RegisterChildTag("XORMDesign", "XORMReference");
    registry.RegisterChildTag("XORMTable", "XORMField");
    registry.RegisterChildTag("XORMTable", "XORMPKField");

    _Registered = true;
}
