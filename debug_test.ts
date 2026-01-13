
import { XORMValidator } from "./TFX/src/Designers/ORM/XORMValidator.js";
import { XORMDocument } from "./TFX/src/Designers/ORM/XORMDocument.js";
import { XORMTable } from "./TFX/src/Designers/ORM/XORMTable.js";
import { XORMField } from "./TFX/src/Designers/ORM/XORMField.js";
import { XDesignerErrorSeverity } from "./TFX/src/Core/XValidation.js";

const doc = new XORMDocument();
const table = new XORMTable();
table.Name = "Users";
doc.Design.AppendChild(table);
table.CreatePKField();

const field = new XORMField();
field.Name = "";
table.AppendChild(field);

const validator = new XORMValidator();
const issues = validator.Validate(doc);

console.log("Issues found:", issues.length);
for (const issue of issues) {
    console.log(`- ElementID: ${issue.ElementID}, Name: ${issue.ElementName}, Severity: ${issue.Severity}, Message: ${issue.Message}`);
}

const error = issues.find(i => i.ElementID === field.ID);
console.log("Found error for field:", error ? "YES" : "NO");
if (error) {
    console.log("Error details:", JSON.stringify(error, null, 2));
}
