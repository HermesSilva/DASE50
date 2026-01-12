import { describe, it, expect } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XGuid } from "../src/Core/XGuid.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

describe("XORMDocument Integration Tests", () => {
    it("should save and load document with tables preserving coordinates", () => {
        RegisterORMElements();
        
        // Create a new document
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();
        doc.Name = "Integration Test Model";

        // Add tables with specific coordinates
        const table1 = doc.Design!.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Users" });
        const table2 = doc.Design!.CreateTable({ X: 400, Y: 300, Width: 200, Height: 150, Name: "Orders" });

        // Verify coordinates before save
        expect(table1.Bounds.Left).toBe(100);
        expect(table1.Bounds.Top).toBe(200);
        expect(table2.Bounds.Left).toBe(400);
        expect(table2.Bounds.Top).toBe(300);

        // Serialize
        const engine = XSerializationEngine.Instance;
        const saveResult = engine.Serialize(doc);

        expect(saveResult.Success).toBe(true);
        expect(saveResult.XmlOutput).toBeDefined();

        // Verify XML doesn't contain undefined
        expect(saveResult.XmlOutput).not.toContain("undefined");
        expect(saveResult.XmlOutput).toContain("X=100");
        expect(saveResult.XmlOutput).toContain("Y=200");
        expect(saveResult.XmlOutput).toContain("X=400");
        expect(saveResult.XmlOutput).toContain("Y=300");

        // Deserialize
        const loadResult = engine.Deserialize<XORMDocument>(saveResult.XmlOutput!);

        expect(loadResult.Success).toBe(true);
        expect(loadResult.Data).toBeDefined();

        const loadedDoc = loadResult.Data!;
        loadedDoc.Initialize();

        // Verify document structure
        expect(loadedDoc.Design).toBeDefined();
        expect(loadedDoc.Name).toBe("Integration Test Model");

        // Get tables
        const loadedTables = loadedDoc.Design!.GetTables();
        expect(loadedTables.length).toBe(2);

        // Verify coordinates were preserved
        const loadedTable1 = loadedTables.find(t => t.Name === "Users");
        const loadedTable2 = loadedTables.find(t => t.Name === "Orders");

        expect(loadedTable1).toBeDefined();
        expect(loadedTable2).toBeDefined();

        expect(loadedTable1!.Bounds.Left).toBe(100);
        expect(loadedTable1!.Bounds.Top).toBe(200);
        expect(loadedTable2!.Bounds.Left).toBe(400);
        expect(loadedTable2!.Bounds.Top).toBe(300);
    });

    it("should save and load document with tables and fields", () => {
        RegisterORMElements();
        
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();
        doc.Name = "Test with Fields";

        const table = doc.Design!.CreateTable({ X: 150, Y: 250, Width: 200, Height: 150, Name: "Products" });
        const field1 = table.CreateField({ Name: "ProductID" });
        const field2 = table.CreateField({ Name: "ProductName" });

        // Serialize and deserialize
        const engine = XSerializationEngine.Instance;
        const xml = engine.Serialize(doc).XmlOutput!;
        
        expect(xml).not.toContain("undefined");

        const loadedDoc = engine.Deserialize<XORMDocument>(xml).Data!;
        loadedDoc.Initialize();

        const loadedTables = loadedDoc.Design!.GetTables();
        expect(loadedTables.length).toBe(1);

        const loadedTable = loadedTables[0];
        expect(loadedTable.Name).toBe("Products");
        expect(loadedTable.Bounds.Left).toBe(150);
        expect(loadedTable.Bounds.Top).toBe(250);

        const loadedFields = loadedTable.GetChildrenOfType(XORMField);
        expect(loadedFields.length).toBe(2);
        expect(loadedFields.map(f => f.Name)).toContain("ProductID");
        expect(loadedFields.map(f => f.Name)).toContain("ProductName");
    });

    it("should save and load document with references", () => {
        RegisterORMElements();
        
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();

        const table1 = doc.Design!.CreateTable({ X: 50, Y: 100, Width: 200, Height: 150, Name: "Customers" });
        const table2 = doc.Design!.CreateTable({ X: 250, Y: 150, Width: 200, Height: 150, Name: "Orders" });

        const ref = doc.Design!.CreateReference({ 
            SourceID: table1.ID, 
            TargetID: table2.ID, 
            Name: "FK_Orders_Customers" 
        });

        // Serialize and deserialize
        const engine = XSerializationEngine.Instance;
        const xml = engine.Serialize(doc).XmlOutput!;

        expect(xml).not.toContain("undefined");

        const loadedDoc = engine.Deserialize<XORMDocument>(xml).Data!;
        loadedDoc.Initialize();

        const loadedRefs = loadedDoc.Design!.GetChildrenOfType(XORMReference);
        expect(loadedRefs.length).toBe(1);
        expect(loadedRefs[0].Name).toBe("FK_Orders_Customers");
    });

    it("should handle document with only one XORMDesign after deserialization", () => {
        RegisterORMElements();
        
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();
        doc.Design!.CreateTable({ X: 75, Y: 125, Width: 200, Height: 150, Name: "TestTable" });

        const engine = XSerializationEngine.Instance;
        const xml = engine.Serialize(doc).XmlOutput!;

        const loadedDoc = engine.Deserialize<XORMDocument>(xml).Data!;
        loadedDoc.Initialize();

        // Should have only ONE XORMDesign after Initialize
        const designs = loadedDoc.ChildNodes.filter((node: any) => 
            node.constructor.name === "XORMDesign"
        );

        expect(designs.length).toBe(1);
        expect(loadedDoc.Design).toBeDefined();
        expect(loadedDoc.Design!.GetTables().length).toBe(1);
    });

    it("DEEP TEST: should load complete model with tables, fields and references from real XML", () => {
        RegisterORMElements();
        
        // Create a complex model
        const doc = new XORMDocument();
        doc.ID = "test-doc-123";
        doc.Name = "Complete Test Model";

        // Create 3 tables with different coordinates
        const customers = doc.Design!.CreateTable({ 
            X: 100, Y: 150, Width: 250, Height: 200, 
            Name: "Customers", Schema: "dbo" 
        });
        
        const orders = doc.Design!.CreateTable({ 
            X: 450, Y: 150, Width: 250, Height: 200, 
            Name: "Orders", Schema: "sales" 
        });
        
        const products = doc.Design!.CreateTable({ 
            X: 800, Y: 150, Width: 250, Height: 200, 
            Name: "Products", Schema: "catalog" 
        });

        // Add fields to customers
        customers.CreateField({ Name: "CustomerID", DataType: "Int32", IsPrimaryKey: true });
        customers.CreateField({ Name: "CustomerName", DataType: "String", IsNullable: false });
        customers.CreateField({ Name: "Email", DataType: "String", IsNullable: true });

        // Add fields to orders
        orders.CreateField({ Name: "OrderID", DataType: "Int32", IsPrimaryKey: true });
        orders.CreateField({ Name: "CustomerID", DataType: "Int32", IsNullable: false });
        orders.CreateField({ Name: "OrderDate", DataType: "DateTime", IsNullable: false });

        // Add fields to products
        products.CreateField({ Name: "ProductID", DataType: "Int32", IsPrimaryKey: true });
        products.CreateField({ Name: "ProductName", DataType: "String", IsNullable: false });
        products.CreateField({ Name: "Price", DataType: "Decimal", IsNullable: false });

        // Create references
        const fkOrderCustomer = doc.Design!.CreateReference({
            SourceID: orders.ID,
            TargetID: customers.ID,
            Name: "FK_Orders_Customers"
        });

        const fkOrderProduct = doc.Design!.CreateReference({
            SourceID: orders.ID,
            TargetID: products.ID,
            Name: "FK_Orders_Products"
        });

        console.log("\n=== AFTER CREATE REFERENCES ===");
        console.log("fkOrderCustomer.Source:", fkOrderCustomer.Source);
        console.log("fkOrderCustomer.Target:", fkOrderCustomer.Target);
        console.log("fkOrderProduct.Source:", fkOrderProduct.Source);
        console.log("fkOrderProduct.Target:", fkOrderProduct.Target);

        console.log("\n=== ORIGINAL MODEL ===");
        console.log("Tables:", doc.Design!.GetTables().length);
        console.log("References:", doc.Design!.GetReferences().length);

        // Serialize
        const engine = XSerializationEngine.Instance;
        const result = engine.Serialize(doc);
        
        expect(result.Success).toBe(true);
        expect(result.XmlOutput).toBeDefined();

        const xml = result.XmlOutput!;

        // CRITICAL: Verify XML has NO undefined values
        expect(xml).not.toContain("undefined");
        
        // Verify XML structure
        expect(xml).toContain("<XORMDocument");
        expect(xml).toContain("<XORMDesign>");
        expect(xml).toContain("<XORMTable");
        expect(xml).toContain("<XORMField");
        expect(xml).toContain("<XORMReference");
        
        // Verify specific coordinates in XML
        expect(xml).toContain("X=100");
        expect(xml).toContain("Y=150");
        expect(xml).toContain("X=450");
        expect(xml).toContain("X=800");

        console.log("\n=== XML OUTPUT ===");
        console.log("XML Length:", xml.length);
        console.log("Contains XORMDesign:", (xml.match(/<XORMDesign>/g) || []).length);
        console.log("Contains XORMTable:", (xml.match(/<XORMTable/g) || []).length);
        console.log("Contains XORMReference:", (xml.match(/<XORMReference/g) || []).length);
        
        // Save XML to project file for inspection
        const fs = require("fs");
        const tmpPath = "d:\\Tootega\\Source\\DASE50\\TFX\\temp-test-orm.xml";
        fs.writeFileSync(tmpPath, xml, "utf8");
        console.log(`XML saved to: ${tmpPath}`);

        // Deserialize
        const loadResult = engine.Deserialize<XORMDocument>(xml);
        
        expect(loadResult.Success).toBe(true);
        expect(loadResult.Data).toBeDefined();

        const loadedDoc = loadResult.Data!;
        
        console.log("\n=== BEFORE Initialize ===");
        console.log("ChildNodes:", loadedDoc.ChildNodes.length);
        console.log("Design?:", loadedDoc.Design ? "YES" : "NO");
        
        // Initialize to consolidate designs
        loadedDoc.Initialize();

        console.log("\n=== AFTER Initialize ===");
        console.log("ChildNodes:", loadedDoc.ChildNodes.length);
        console.log("Design?:", loadedDoc.Design ? "YES" : "NO");
        
        // DEEP VALIDATION
        
        // 1. Document level
        expect(loadedDoc.ID).toBe("test-doc-123");
        expect(loadedDoc.Name).toBe("Complete Test Model");
        expect(loadedDoc.Design).toBeDefined();

        // 2. Single design (no duplicates)
        const designs = loadedDoc.ChildNodes.filter((node: any) => 
            node.constructor.name === "XORMDesign"
        );
        expect(designs.length).toBe(1);

        // 3. Tables count and basic data
        const loadedTables = loadedDoc.Design!.GetTables();
        console.log("\n=== LOADED TABLES ===");
        console.log("Count:", loadedTables.length);
        loadedTables.forEach(t => {
            console.log(`- ${t.Name} (${t.Schema}): [${t.Bounds.Left}, ${t.Bounds.Top}] ${t.Bounds.Width}x${t.Bounds.Height}`);
        });
        
        expect(loadedTables.length).toBe(3);

        // 4. Verify each table in detail
        const loadedCustomers = loadedTables.find(t => t.Name === "Customers");
        const loadedOrders = loadedTables.find(t => t.Name === "Orders");
        const loadedProducts = loadedTables.find(t => t.Name === "Products");

        expect(loadedCustomers).toBeDefined();
        expect(loadedOrders).toBeDefined();
        expect(loadedProducts).toBeDefined();

        // 5. Verify coordinates are preserved exactly
        expect(loadedCustomers!.Bounds.Left).toBe(100);
        expect(loadedCustomers!.Bounds.Top).toBe(150);
        expect(loadedCustomers!.Schema).toBe("dbo");

        expect(loadedOrders!.Bounds.Left).toBe(450);
        expect(loadedOrders!.Bounds.Top).toBe(150);
        expect(loadedOrders!.Schema).toBe("sales");

        expect(loadedProducts!.Bounds.Left).toBe(800);
        expect(loadedProducts!.Bounds.Top).toBe(150);
        expect(loadedProducts!.Schema).toBe("catalog");

        // 6. Verify fields
        const customerFields = loadedCustomers!.GetFields();
        console.log("\n=== CUSTOMERS FIELDS ===");
        console.log("Count:", customerFields.length);
        customerFields.forEach(f => {
            console.log(`- ${f.Name}: ${f.DataType}, PK=${f.IsPrimaryKey}, Null=${f.IsNullable}`);
        });
        
        expect(customerFields.length).toBe(3);
        expect(customerFields.map(f => f.Name)).toContain("CustomerID");
        expect(customerFields.map(f => f.Name)).toContain("CustomerName");
        expect(customerFields.map(f => f.Name)).toContain("Email");

        const customerID = customerFields.find(f => f.Name === "CustomerID");
        expect(customerID!.IsPrimaryKey).toBe(true);
        expect(customerID!.DataType).toBe("Int32");

        // 7. CRITICAL: Verify references are loaded
        const loadedReferences = loadedDoc.Design!.GetReferences();
        console.log("\n=== LOADED REFERENCES ===");
        console.log("Count:", loadedReferences.length);
        loadedReferences.forEach(r => {
            console.log(`- ${r.Name}: Source=${r.Source}, Target=${r.Target}, Points=${r.Points?.length || 0}`);
        });

        expect(loadedReferences.length).toBe(2);

        // 8. Verify each reference in detail
        const loadedFkOrderCustomer = loadedReferences.find(r => r.Name === "FK_Orders_Customers");
        const loadedFkOrderProduct = loadedReferences.find(r => r.Name === "FK_Orders_Products");

        expect(loadedFkOrderCustomer).toBeDefined();
        expect(loadedFkOrderProduct).toBeDefined();

        // 9. Verify reference Source and Target are set
        expect(loadedFkOrderCustomer!.Source).toBeDefined();
        expect(loadedFkOrderCustomer!.Source).toBe(orders.ID);
        expect(loadedFkOrderCustomer!.Target).toBeDefined();
        expect(loadedFkOrderCustomer!.Target).toBe(customers.ID);

        expect(loadedFkOrderProduct!.Source).toBeDefined();
        expect(loadedFkOrderProduct!.Source).toBe(orders.ID);
        expect(loadedFkOrderProduct!.Target).toBeDefined();
        expect(loadedFkOrderProduct!.Target).toBe(products.ID);

        // 10. Verify reference Points are loaded
        expect(loadedFkOrderCustomer!.Points).toBeDefined();
        expect(loadedFkOrderCustomer!.Points!.length).toBeGreaterThan(0);

        console.log("\n=== TEST PASSED ===");
        console.log("✓ All tables loaded with correct coordinates");
        console.log("✓ All fields loaded with correct properties");
        console.log("✓ All references loaded with correct Source/Target");
        console.log("✓ No undefined values in serialized XML");
    });
});
