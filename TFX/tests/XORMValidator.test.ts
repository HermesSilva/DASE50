import { describe, it, expect } from "vitest";
import { XORMValidator } from "../src/Designers/ORM/XORMValidator.js";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMIndex } from "../src/Designers/ORM/XORMIndex.js";
import { XORMIndexField } from "../src/Designers/ORM/XORMIndexField.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XDesignerErrorSeverity } from "../src/Core/XValidation.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMValidator", () =>
{
    describe("Basic validation", () =>
    {
        it("should validate empty document", () =>
        {
            const doc = new XORMDocument();
            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            expect(issues.length).toBeGreaterThan(0);
        });

        it("should call GetDocumentID and GetDocumentName when validating", () =>
        {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "TestDoc";
            doc.Design.Name = "TestDesign";

            const table = new XORMTable();
            table.Name = "";
            doc.Design.AppendChild(table);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Table name is required"));
            expect(error).toBeDefined();
        });

        it("should not warn when design has a proper name", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "MyDatabase";
            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const nameWarning = issues.find(i => i.Message.includes("Design name is not defined"));
            expect(nameWarning).toBeUndefined();
        });
    });

    describe("Table validation", () =>
    {
        it("should error when table has empty name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "";
            doc.Design.AppendChild(table);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Table name is required"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(table.ID);
        });

        it("should pass when table has proper name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.ElementID === table.ID && i.Severity === XDesignerErrorSeverity.Error);
            expect(error).toBeUndefined();
        });

        it("should error on duplicate table names (case insensitive)", () =>
        {
            const doc = new XORMDocument();
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);
            table1.CreatePKField();

            const table2 = new XORMTable();
            table2.Name = "users";
            doc.Design.AppendChild(table2);
            table2.CreatePKField();

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate table name"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(table2.ID);
        });

        it("should allow different table names", () =>
        {
            const doc = new XORMDocument();
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);
            table1.CreatePKField();

            const table2 = new XORMTable();
            table2.Name = "Products";
            doc.Design.AppendChild(table2);
            table2.CreatePKField();

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate table name"));
            expect(error).toBeUndefined();
        });

        it("should not error on duplicate name when one table is a shadow table", () =>
        {
            const doc = new XORMDocument();
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);
            table1.CreatePKField();

            const shadow = new XORMTable();
            shadow.Name = "Users";
            shadow.IsShadow = true;
            doc.Design.AppendChild(shadow);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate table name"));
            expect(error).toBeUndefined();
        });

        it("should not auto-create PK field for shadow tables during validation", () =>
        {
            const doc = new XORMDocument();
            const shadow = new XORMTable();
            shadow.Name = "ExternalUsers";
            shadow.IsShadow = true;
            doc.Design.AppendChild(shadow);

            // Add a real table so there is no "no tables" warning masking the issue
            const table = doc.Design.CreateTable({ Name: "LocalTable" });
            table.CreatePKField();

            const validator = new XORMValidator();
            validator.Validate(doc);

            // Shadow table must remain PK-less
            expect(shadow.HasPKField()).toBe(false);
        });
    });

    describe("Field validation", () =>
    {
        it("should error when field has empty name", () =>
        {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "Users" });
            table.CreatePKField();

            const field = table.CreateField({ Name: "" });

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const error = issues.find(i => i.ElementID === field.ID && i.Message === "Field name is required.");

            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should validate PK DataType against ValidPKTypes list", () =>
        {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "TestTable" });
            const pkField = table.CreatePKField();
            
            // Force a DataType that would be invalid according to our list
            const pkFieldInternal = pkField as any;
            pkFieldInternal._DataTypeLocked = false; 
            pkField.DataType = "String";

            const validator = new XORMValidator();
            validator.ValidPKTypes = ["Int32", "Int64", "Guid"];
            
            const issues = validator.Validate(doc);
            const error = issues.find(i => i.Message.includes("Invalid DataType \"String\" for Primary Key"));
            
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should not error if ValidPKTypes is empty (skips validation)", () =>
        {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "TestTableNoTypes" });
            const pkField = table.CreatePKField();
            
            const pkFieldInternal = pkField as any;
            pkFieldInternal._DataTypeLocked = false;
            pkField.DataType = "String";

            const validator = new XORMValidator();
            validator.ValidPKTypes = []; 
            
            const issues = validator.Validate(doc);
            const error = issues.find(i => i.Message.includes("Invalid DataType \"String\" for Primary Key"));
            
            expect(error).toBeUndefined();
        });

        it("should pass when field has proper name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field = new XORMField();
            field.Name = "Email";
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.ElementID === field.ID && i.Severity === XDesignerErrorSeverity.Error);
            expect(error).toBeUndefined();
        });

        it("should error on duplicate field names in same table (case insensitive)", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field1 = new XORMField();
            field1.Name = "Email";
            table.AppendChild(field1);

            const field2 = new XORMField();
            field2.Name = "email";
            table.AppendChild(field2);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate field name"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(field2.ID);
            expect(error?.Message).toContain("Users");
        });

        it("should allow same field name in different tables", () =>
        {
            const doc = new XORMDocument();
            
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);
            table1.CreatePKField();

            const field1 = new XORMField();
            field1.Name = "Email";
            table1.AppendChild(field1);

            const table2 = new XORMTable();
            table2.Name = "Products";
            doc.Design.AppendChild(table2);
            table2.CreatePKField();

            const field2 = new XORMField();
            field2.Name = "Email";
            table2.AppendChild(field2);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const errors = issues.filter(i => i.Message.includes("Duplicate field name"));
            expect(errors.length).toBe(0);
        });

        it("should warn when field name has leading or trailing spaces", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field = new XORMField();
            field.Name = "Email ";
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const warning = issues.find(i => i.Message.includes("leading or trailing spaces"));
            expect(warning).toBeDefined();
        });

        it("should error when Decimal field has no length defined", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field = new XORMField();
            field.Name = "Amount";
            field.DataType = "Decimal";
            field.Length = 0;
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Decimal field must have a Length"));
            expect(error).toBeDefined();
            expect(error!.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should not error when Decimal field has length defined", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field = new XORMField();
            field.Name = "Amount";
            field.DataType = "Decimal";
            field.Length = 18;
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Decimal field must have a Length"));
            expect(error).toBeUndefined();
        });

        it("should warn when Scale is set on non-Decimal field", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field = new XORMField();
            field.Name = "Age";
            field.DataType = "Int32";
            field.Scale = 2;
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const warning = issues.find(i => i.Message.includes("Scale is only applicable"));
            expect(warning).toBeDefined();
        });

        it("should not warn when Scale is set on Decimal field", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Products";
            doc.Design.AppendChild(table);
            table.CreatePKField();

            const field = new XORMField();
            field.Name = "Price";
            field.DataType = "Decimal";
            field.Scale = 2;
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const warning = issues.find(i => i.Message.includes("Scale is only applicable"));
            expect(warning).toBeUndefined();
        });

        it("should auto-create primary key field when table has none", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            expect(table.HasPKField()).toBe(false);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // Should not have error - PK field auto-created
            const error = issues.find(i => i.Message.includes("must have a primary key field"));
            expect(error).toBeUndefined();

            // PK field should now exist
            expect(table.HasPKField()).toBe(true);
            const pkField = table.GetPKField();
            expect(pkField).not.toBeNull();
            expect(pkField!.DataType).toBe(table.PKType);
        });

        it("should auto-correct FK field DataType when it does not match target table PKType", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "TestDB";
            
            const usersTable = new XORMTable();
            usersTable.InitializeNew();
            usersTable.Name = "Users";
            doc.Design.AppendChild(usersTable);
            usersTable.CreatePKField({ DataType: "Guid" });

            const ordersTable = new XORMTable();
            ordersTable.InitializeNew();
            ordersTable.Name = "Orders";
            doc.Design.AppendChild(ordersTable);
            ordersTable.CreatePKField();

            const fkField = new XORMField();
            fkField.InitializeNew();
            fkField.Name = "UserID";
            fkField.DataType = "Int32"; // Wrong! Should be Guid
            ordersTable.AppendChild(fkField);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "FK_Orders_Users";
            ref.Source = fkField.ID;
            ref.Target = usersTable.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // Should not have error - DataType auto-corrected
            const error = issues.find(i => i.Message.includes("FK field DataType must match target table PKType"));
            expect(error).toBeUndefined();

            // FK field DataType should now match target PKType
            expect(fkField.DataType).toBe("Guid");
        });

        it("should not error when FK field DataType matches target table PKType", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "TestDB";
            
            const usersTable = new XORMTable();
            usersTable.InitializeNew();
            usersTable.Name = "Users";
            doc.Design.AppendChild(usersTable);
            usersTable.CreatePKField({ DataType: "Guid" });

            const ordersTable = new XORMTable();
            ordersTable.InitializeNew();
            ordersTable.Name = "Orders";
            doc.Design.AppendChild(ordersTable);
            ordersTable.CreatePKField();

            const fkField = new XORMField();
            fkField.InitializeNew();
            fkField.Name = "UserID";
            fkField.DataType = "Guid"; // Correct!
            ordersTable.AppendChild(fkField);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "FK_Orders_Users";
            ref.Source = fkField.ID;
            ref.Target = usersTable.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("FK field DataType must match"));
            expect(error).toBeUndefined();
        });
    });

    describe("Reference validation", () =>
    {
        it("should error when reference has no source field", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference source field is not defined"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should error when reference has no target table", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            const field = new XORMField();
            field.Name = "FK";
            table.AppendChild(field);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Source = field.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference target table is not defined"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should error when reference source field does not exist", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Source = XGuid.NewValue();
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference source field not found"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should auto-correct 1:1 reference where Source is a table ID (legacy C# pattern)", () =>
        {
            const doc = new XORMDocument();

            const sourceTable = new XORMTable();
            sourceTable.InitializeNew();
            sourceTable.Name = "UserProfile";
            doc.Design.AppendChild(sourceTable);
            const pkField = sourceTable.CreatePKField({ Name: "ID", DataType: "Int32" });

            const targetTable = new XORMTable();
            targetTable.InitializeNew();
            targetTable.Name = "Users";
            doc.Design.AppendChild(targetTable);

            // Legacy 1:1: Source points to the source TABLE id, not a field id
            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "OneToOne";
            ref.Source = sourceTable.ID;  // table ID, not field ID
            ref.Target = targetTable.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // No "source field not found" error — it was auto-corrected to the PK field
            const error = issues.find(i => i.Message.includes("Reference source field not found"));
            expect(error).toBeUndefined();
            // The reference Source should now point to the PK field
            expect(ref.Source).toBe(pkField.ID);
        });

        it("should auto-correct 1:1 reference when source table initially had no PK field (EnsurePKField creates it)", () =>
        {
            const doc = new XORMDocument();

            const sourceTable = new XORMTable();
            sourceTable.InitializeNew();
            sourceTable.Name = "UserProfile";
            doc.Design.AppendChild(sourceTable);
            // No PK field created initially

            const targetTable = new XORMTable();
            targetTable.InitializeNew();
            targetTable.Name = "Users";
            doc.Design.AppendChild(targetTable);

            // Legacy 1:1: Source points to the source TABLE id, no PK exists yet
            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "OneToOne";
            ref.Source = sourceTable.ID;
            ref.Target = targetTable.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            validator.Validate(doc);

            // ValidateTables runs EnsurePKField before ValidateReferences,
            // so the auto-correction finds the newly created PK field and updates ref.Source.
            const updatedPK = sourceTable.GetPKField();
            expect(updatedPK).toBeDefined();
            expect(ref.Source).toBe(updatedPK!.ID);
        });

        it("should error when reference target table does not exist", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            const field = new XORMField();
            field.Name = "FK";
            table.AppendChild(field);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Source = field.ID;
            ref.Target = XGuid.NewValue();
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference target table not found"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should warn when reference is self-referencing", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.InitializeNew();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            const field = new XORMField();
            field.InitializeNew();
            field.Name = "ParentID";
            table.AppendChild(field);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "SelfRef";
            ref.Source = field.ID;
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const warning = issues.find(i => i.Message.includes("Self-referencing relation"));
            expect(warning).toBeDefined();
            expect(warning?.Severity).toBe(XDesignerErrorSeverity.Warning);
            expect(warning?.ElementID).toBe(ref.ID);
        });

        it("should pass when reference has valid source field and target table", () =>
        {
            const doc = new XORMDocument();
            
            const table1 = new XORMTable();
            table1.InitializeNew();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);

            const table2 = new XORMTable();
            table2.InitializeNew();
            table2.Name = "Orders";
            doc.Design.AppendChild(table2);
            
            const fkField = new XORMField();
            fkField.InitializeNew();
            fkField.Name = "UserID";
            table2.AppendChild(fkField);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "UserOrders";
            ref.Source = fkField.ID;
            ref.Target = table1.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.ElementID === ref.ID && i.Severity === XDesignerErrorSeverity.Error);
            expect(error).toBeUndefined();
        });

        it("should handle when sourceField has no ParentNode (orphan field)", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.InitializeNew();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            // Create orphan field (not attached to any table)
            const field = new XORMField();
            field.InitializeNew();
            field.Name = "OrphanField";

            // Create reference using the orphan field
            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "TestRef";
            ref.Source = field.ID;
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            // Mock FindFieldByID to return the orphan field
            const originalFindFieldByID = doc.Design.FindFieldByID;
            doc.Design.FindFieldByID = (pID: string) => pID === field.ID ? field : originalFindFieldByID.call(doc.Design, pID);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // Should not warn about self-referencing because ParentNode is null/not XORMTable
            const warning = issues.find(i => i.Message.includes("Self-referencing relation"));
            expect(warning).toBeUndefined();

            // Restore
            doc.Design.FindFieldByID = originalFindFieldByID;
        });

        it("should handle when FindFieldByID returns null (line 118 else branch)", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.InitializeNew();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            // Create reference with source field ID that doesn't exist
            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "TestRef";
            ref.Source = XGuid.NewValue(); // Non-existent field
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // Should not warn about self-referencing because sourceField is null
            const warning = issues.find(i => i.Message.includes("Self-referencing relation"));
            expect(warning).toBeUndefined();

            // But should have error about source field not found
            const error = issues.find(i => i.Message.includes("Reference source field not found"));
            expect(error).toBeDefined();
        });
    });

    describe("Complete scenario", () =>
    {
        it("should validate complete document with multiple tables, fields and references", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "ECommerce";
            
            const usersTable = new XORMTable();
            usersTable.InitializeNew();
            usersTable.Name = "Users";
            doc.Design.AppendChild(usersTable);

            usersTable.CreatePKField({ Name: "ID", DataType: "Int32" });

            const emailField = new XORMField();
            emailField.InitializeNew();
            emailField.Name = "Email";
            usersTable.AppendChild(emailField);

            const ordersTable = new XORMTable();
            ordersTable.InitializeNew();
            ordersTable.Name = "Orders";
            doc.Design.AppendChild(ordersTable);

            ordersTable.CreatePKField({ Name: "ID", DataType: "Int32" });

            const userIDField = new XORMField();
            userIDField.InitializeNew();
            userIDField.Name = "UserID";
            userIDField.DataType = "Int32"; // Must match target table PKType
            ordersTable.AppendChild(userIDField);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "UserOrders";
            ref.Source = userIDField.ID;
            ref.Target = usersTable.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const errors = issues.filter(i => i.Severity === XDesignerErrorSeverity.Error);
            expect(errors.length).toBe(0);
        });
    });

    describe("AllowedValues validation", () =>
    {
        it("should warn when DefaultValue is not in AllowedValues list", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";
            const table = doc.Design.CreateTable({ Name: "Order" });
            const field = table.CreateField({ Name: "Status" });
            field.AllowedValues = "Open|Closed|Pending";
            field.DefaultValue = "Unknown"; // not in list

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const warning = issues.find(i => i.Message.includes("not in the AllowedValues list"));
            expect(warning).toBeDefined();
            expect(warning!.Severity).toBe(XDesignerErrorSeverity.Warning);
        });

        it("should not warn when DefaultValue is in the AllowedValues list", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";
            const table = doc.Design.CreateTable({ Name: "Order" });
            const field = table.CreateField({ Name: "Status" });
            field.AllowedValues = "Open|Closed|Pending";
            field.DefaultValue = "Open";

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const warning = issues.find(i => i.Message.includes("not in the AllowedValues list"));
            expect(warning).toBeUndefined();
        });

        it("should not warn when DefaultValue is empty even if AllowedValues is set", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";
            const table = doc.Design.CreateTable({ Name: "Order" });
            const field = table.CreateField({ Name: "Status" });
            field.AllowedValues = "Open|Closed";
            field.DefaultValue = ""; // empty — no constraint violation

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const warning = issues.find(i => i.Message.includes("not in the AllowedValues list"));
            expect(warning).toBeUndefined();
        });

        it("should warn when both AllowedValues and IsAutoIncrement are set", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";
            const table = doc.Design.CreateTable({ Name: "T" });
            const field = table.CreateField({ Name: "F", DataType: "Int32" });
            field.AllowedValues = "1|2|3";
            field.IsAutoIncrement = true;

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const warning = issues.find(i => i.Message.includes("mutually exclusive"));
            expect(warning).toBeDefined();
            expect(warning!.Severity).toBe(XDesignerErrorSeverity.Warning);
        });

        it("should not warn when AllowedValues is empty even if IsAutoIncrement is set", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";
            const table = doc.Design.CreateTable({ Name: "T" });
            const field = table.CreateField({ Name: "F", DataType: "Int32" });
            field.IsAutoIncrement = true;
            // AllowedValues empty — no conflict

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const warning = issues.find(i => i.Message.includes("mutually exclusive"));
            expect(warning).toBeUndefined();
        });

        it("should issue no AllowedValues warnings for a clean field", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";
            const table = doc.Design.CreateTable({ Name: "T" });
            table.CreateField({ Name: "F" }); // no AllowedValues set

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);
            const avIssues = issues.filter(i =>
                i.Message.includes("AllowedValues") || i.Message.includes("mutually exclusive")
            );
            expect(avIssues.length).toBe(0);
        });
    });

    /**
     * O XORMIndexField guarda o campo por ID. Campo apagado e desenhado de novo deixa o índice
     * apontando para um ID morto — coluna que some da tela do índice e só existe no arquivo, sem
     * lugar onde consertar. A geração escrevia `HasIndex(e => e.)`, C# que não compila; validar
     * tem de deixar o modelo íntegro, não só reclamar dele.
     */
    describe("Index validation", () =>
    {
        /** Coluna `Orfa` nasce apontando para um ID morto; a íntegra aponta para o campo real. */
        function Montar(pColunas: Array<{ Name: string; Orfa: boolean }>)
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";

            const table = doc.Design.CreateTable({ Name: "VNDxNumeracao" });
            // PK explícita: sem ela o validador cria uma e a mutação do índice não se distinguiria.
            table.CreatePKField({ Name: "VNDxNumeracaoID", DataType: "Int32" });
            const inquilino = table.CreateField({ Name: "SYSxInquilinoID", DataType: "Guid" });
            const pessoa = table.CreateField({ Name: "SYSxPessoaID", DataType: "Int64" });

            const index = new XORMIndex();
            index.ID = XGuid.NewValue();
            index.Name = "IX_VNDxNumeracao_SYSxInquilinoID_SYSxPessoaID";
            index.IsUnique = true;
            table.AppendChild(index);

            for (const c of pColunas)
            {
                const coluna = new XORMIndexField();
                coluna.ID = XGuid.NewValue();
                coluna.Name = c.Name;
                coluna.ParentID = c.Orfa
                    ? XGuid.NewValue()
                    : table.GetFields().find(f => f.Name === c.Name)!.ID;
                index.AppendChild(coluna);
            }

            return { doc, table, index, inquilino, pessoa };
        }

        it("religa pelo nome a coluna que aponta para campo inexistente", () =>
        {
            const { doc, index, inquilino, pessoa } = Montar([
                { Name: "SYSxInquilinoID", Orfa: true },
                { Name: "SYSxPessoaID", Orfa: true }
            ]);

            const issues = new XORMValidator().Validate(doc);

            expect(index.GetIndexFields().map(f => f.ParentID)).toEqual([inquilino.ID, pessoa.ID]);
            expect(issues.filter(i => i.Message.includes("was relinked")).length).toBe(2);
        });

        it("remove a coluna que não tem campo de mesmo nome, e acusa", () =>
        {
            const { doc, index, inquilino } = Montar([
                { Name: "SYSxInquilinoID", Orfa: false },
                { Name: "ColunaQueSumiu", Orfa: true }
            ]);

            const issues = new XORMValidator().Validate(doc);

            expect(index.GetIndexFields().map(f => f.Name)).toEqual(["SYSxInquilinoID"]);
            expect(index.GetIndexFields()[0].ParentID).toBe(inquilino.ID);

            const erro = issues.find(i => i.Message.includes("ColunaQueSumiu"));
            expect(erro?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("remove o índice que ficou sem coluna nenhuma", () =>
        {
            const { doc, table } = Montar([{ Name: "ColunaQueSumiu", Orfa: true }]);

            const issues = new XORMValidator().Validate(doc);

            expect(table.GetChildrenOfType(XORMIndex).length).toBe(0);

            const erro = issues.find(i => i.Message.includes("has no column left"));
            expect(erro?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("acusa mutação quando conserta, para o conserto chegar ao arquivo", () =>
        {
            const { doc } = Montar([{ Name: "SYSxInquilinoID", Orfa: true }]);
            const validator = new XORMValidator();

            validator.Validate(doc);

            expect(validator.Mutated).toBe(true);
        });

        it("não mexe no índice íntegro", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "Test";

            const table = doc.Design.CreateTable({ Name: "VNDxPedido" });
            table.CreatePKField({ Name: "VNDxPedidoID", DataType: "Int32" });
            const numero = table.CreateField({ Name: "Numero", DataType: "Int64" });

            const index = new XORMIndex();
            index.ID = XGuid.NewValue();
            index.Name = "IX_VNDxPedido_Numero";
            table.AppendChild(index);

            const coluna = new XORMIndexField();
            coluna.ID = XGuid.NewValue();
            coluna.Name = "Numero";
            coluna.ParentID = numero.ID;
            index.AppendChild(coluna);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            expect(index.GetIndexFields().length).toBe(1);
            expect(issues.filter(i => i.Message.includes("Index ")).length).toBe(0);
            expect(validator.Mutated).toBe(false);
        });
    });
});
