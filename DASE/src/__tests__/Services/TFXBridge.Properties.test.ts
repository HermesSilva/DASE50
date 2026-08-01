// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueItem } from '../../Models/IssueItem';
import { XPropertyItem, XPropertyType } from '../../Models/PropertyItem';

// Import real TFX library
import * as tfx from '@tootega/tfx';

describe('XTFXBridge', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    describe('UpdateProperty', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should update element property', async () => {
            // Load model with a table to update
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'Name', 'UpdatedName');

            expect(result.Success).toBe(true);
            const props = bridge.GetProperties('table-1');
            const nameProp = props.find(p => p.Key === 'Name');
            expect(nameProp?.Value).toBe('UpdatedName');
        });

        it('should convert Fill property string to XColor', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'Fill', 'FF00FF00');

            expect(result.Success).toBe(true);
            const props = bridge.GetProperties('table-1');
            const fillProp = props.find(p => p.Key === 'Fill');
            // Fill value should be ARGB string representation
            expect(fillProp?.Value).toBe('FF00FF00');
        });

        it('should return error for unknown property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'UnknownProperty', 'value');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Unknown property');
        });

        it('should update Description property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'Description', 'New description');

            expect(result.Success).toBe(true);
        });

        it('should update PKType property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'PKType', 'Guid');

            expect(result.Success).toBe(true);
        });

        it('should update Fill with XColor instance', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const color = tfx.XColor.Parse('FFFF0000');
            const result = bridge.UpdateProperty('table-1', 'Fill', color);

            expect(result.Success).toBe(true);
        });

        it('should update X property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'X', 250);

            expect(result.Success).toBe(true);
        });

        it('should update Y property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'Y', 350);

            expect(result.Success).toBe(true);
        });

        it('should update Width property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'Width', 300);

            expect(result.Success).toBe(true);
        });

        it('should update Height property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('table-1', 'Height', 400);

            expect(result.Success).toBe(true);
        });

        it('should update XORMReference Description property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [
                    { ID: "table-1", Name: "Users", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID" }] },
                    { ID: "table-2", Name: "Orders", X: 300, Y: 100, Fields: [{ ID: "field-2", Name: "UserID" }] }
                ],
                References: [{ ID: "ref-1", Name: "FK_Orders_Users", SourceFieldID: "field-2", TargetTableID: "table-1" }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('ref-1', 'Description', 'Reference description');

            expect(result.Success).toBe(true);
        });

        it('should return error for unknown XORMReference property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [
                    { ID: "table-1", Name: "Users", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID" }] },
                    { ID: "table-2", Name: "Orders", X: 300, Y: 100, Fields: [{ ID: "field-2", Name: "UserID" }] }
                ],
                References: [{ ID: "ref-1", Name: "FK_Orders_Users", SourceFieldID: "field-2", TargetTableID: "table-1" }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('ref-1', 'UnknownProperty', 'value');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Unknown property');
        });

        it('should update XORMField DataType property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'DataType', 'Integer');

            expect(result.Success).toBe(true);
        });

        it('should block DataType changes on FK fields', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [
                    { ID: "table-1", Name: "Users", X: 100, Y: 100, Fields: [] },
                    { ID: "table-2", Name: "Orders", X: 300, Y: 100, Fields: [{ ID: "field-1", Name: "UserID", DataType: "Int32" }] }
                ],
                References: [
                    { SourceFieldID: "field-1", TargetTableID: "table-1", Name: "FK_Orders_Users" }
                ]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'DataType', 'String');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Cannot change DataType of a foreign key field');
        });

        it('should update XORMField Length property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Name", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'Length', 100);

            expect(result.Success).toBe(true);
        });

        it('should update XORMField Scale property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Amount", DataType: "Decimal" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'Scale', 2);

            expect(result.Success).toBe(true);
        });

        it('should update XORMField IsRequired property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Name", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'IsRequired', true);

            expect(result.Success).toBe(true);
        });

        it('should update XORMField IsPrimaryKey property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID", DataType: "Integer" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'IsPrimaryKey', true);

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('structural');
        });

        it('should update XORMField IsRequired property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Name", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'IsRequired', true);

            expect(result.Success).toBe(true);
        });

        it('should update XORMField IsAutoIncrement property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID", DataType: "Integer" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'IsAutoIncrement', true);

            expect(result.Success).toBe(true);
        });

        it('should update XORMField DefaultValue property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Status", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'DefaultValue', 'Active');

            expect(result.Success).toBe(true);
        });

        it('should update XORMField AllowedValues property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Status", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'AllowedValues', 'Open|Closed|Pending');

            expect(result.Success).toBe(true);
        });

        it('should block AllowedValues update on an auto-increment field', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Counter", DataType: "Int32", IsAutoIncrement: true }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'AllowedValues', '1|2|3');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('auto-increment');
        });

        it('should update XORMField Description property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID", DataType: "Integer" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'Description', 'Primary key field');

            expect(result.Success).toBe(true);
        });

        it('should return error for unknown XORMField property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "ID", DataType: "Integer" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'UnknownProperty', 'value');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Unknown property');
        });

        it('should update XORMDesign Schema property', async () => {
            const json = JSON.stringify({
                Name: "TestModel"
            });
            await bridge.LoadOrmModelFromText(json);
            const designID = bridge.Document?.Design?.ID || '';

            const result = bridge.UpdateProperty(designID, 'Schema', 'production');

            expect(result.Success).toBe(true);
        });

        it('should return error for unknown XORMDesign property', async () => {
            const json = JSON.stringify({
                Name: "TestModel"
            });
            await bridge.LoadOrmModelFromText(json);
            const designID = bridge.Document?.Design?.ID || '';

            const result = bridge.UpdateProperty(designID, 'UnknownProperty', 'value');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Unknown property');
        });

        it('should handle Fill property with neither string nor XColor (edge case)', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            // Pass a number (invalid but tests the else branch)
            const result = bridge.UpdateProperty('table-1', 'Fill', 123 as any);

            expect(result.Success).toBe(true); // Should still succeed (no error thrown)
        });

        it('should handle UpdateProperty on element that is not XORMTable/Reference/Field/Design (edge case)', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100 }]
            });
            await bridge.LoadOrmModelFromText(json);

            // Mock GetElementByID to return an unknown element type
            const mockElement = { ID: 'unknown-1', Name: 'Unknown' } as any;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            const result = bridge.UpdateProperty('unknown-1', 'Name', 'NewName');

            expect(result.Success).toBe(true); // Basic property update should work
        });

        /**
         * Um elemento que não é modelo, tabela, campo nem referência não tem propriedade
         * alguma para receber o valor. Responder "feito" ali é o pior desfecho possível:
         * quem chamou registra a alteração e o valor não foi para lugar nenhum.
         */
        it('refuses the write when the element type has no editable properties', async () => {
            const json = JSON.stringify({
                Name: "TestModel"
            });
            await bridge.LoadOrmModelFromText(json);

            // Mock GetElementByID to return an unknown element type
            const mockElement = { ID: 'unknown-1', Name: 'Unknown', SomeProperty: 'value' } as any;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            // Use a property key that's NOT "Name" to go through all instanceof checks
            const result = bridge.UpdateProperty('unknown-1', 'SomeOtherProp', 'NewValue');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('does not accept property edits');
        });
    });

    describe('GetProperties', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return empty array for non-existent element', async () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);

            const props = await bridge.GetProperties('non-existent');

            expect(props).toEqual([]);
        });

        it('should return properties for table element', async () => {
            const mockTable = new tfx.XORMTable();
            mockTable.ID = 'table-1';
            mockTable.Name = 'Users';
            mockTable.Description = 'User table';
            mockTable.Bounds = new tfx.XRect(100, 200, 200, 150);

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTable);

            const props = await bridge.GetProperties('table-1');

            expect(Array.isArray(props)).toBe(true);
            // ID is never shown in the properties panel
            expect(props.some(p => p.Key === 'ID')).toBe(false);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
        });

        it('should return properties for table with Fill as string (edge case)', async () => {
            const mockTable = new tfx.XORMTable();
            mockTable.ID = 'table-1';
            mockTable.Name = 'Users';
            mockTable.Bounds = new tfx.XRect(100, 200, 200, 150);
            // Create object with valueOf but without ToString to test String() branch
            const fillObj = {
                valueOf: () => 'FFFF0000'
            };
            (mockTable as any).Fill = fillObj;

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTable);

            const props = await bridge.GetProperties('table-1');

            expect(Array.isArray(props)).toBe(true);
            const fillProp = props.find(p => p.Key === 'Fill');
            expect(fillProp).toBeDefined();
        });
    });

    describe('GetProperties for different element types', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return properties for XORMReference element', async () => {
            const mockRef = new tfx.XORMReference();
            mockRef.ID = 'ref-1';
            mockRef.Name = 'FK_Test';
            mockRef.Source = 'table-1';
            mockRef.Target = 'table-2';
            mockRef.Description = 'Test reference';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockRef);

            const props = await bridge.GetProperties('ref-1');

            expect(Array.isArray(props)).toBe(true);
            // ID is never shown in the properties panel
            expect(props.some(p => p.Key === 'ID')).toBe(false);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
            // Source and Target are shown as friendly names and are read-only
            const sourceProp = props.find(p => p.Key === 'Source');
            expect(sourceProp).toBeDefined();
            expect(sourceProp?.IsReadOnly).toBe(true);
            const targetProp = props.find(p => p.Key === 'Target');
            expect(targetProp).toBeDefined();
            expect(targetProp?.IsReadOnly).toBe(true);
            expect(props.some(p => p.Key === 'Description')).toBe(true);
        });

        it('should return properties for XORMPKField element (Int32, auto-increment=true)', async () => {
            const mockField = new tfx.XORMPKField();
            mockField.ID = 'field-1';
            mockField.Name = 'UserID';
            mockField.DataType = 'Int32' as any;
            mockField.Length = 4;
            mockField.IsRequired = true;
            mockField.IsAutoIncrement = true;
            mockField.DefaultValue = '';
            mockField.Description = 'Primary key';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = await bridge.GetProperties('field-1');

            expect(Array.isArray(props)).toBe(true);
            // ID is never shown
            expect(props.some(p => p.Key === 'ID')).toBe(false);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
            // DataType is shown but read-only for PKField
            expect(props.some(p => p.Key === 'DataType')).toBe(true);
            const dtProp = props.find(p => p.Key === 'DataType');
            expect(dtProp?.IsReadOnly).toBe(true);
            // Int32 has no Length or Scale
            expect(props.some(p => p.Key === 'Length')).toBe(false);
            expect(props.some(p => p.Key === 'Scale')).toBe(false);
            // IsPrimaryKey is never shown (always true, obvious from context)
            expect(props.some(p => p.Key === 'IsPrimaryKey')).toBe(false);
            // IsRequired always true for PKField — hidden
            expect(props.some(p => p.Key === 'IsRequired')).toBe(false);
            // Int32 supports auto-increment
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(true);
            // DefaultValue hidden when IsAutoIncrement=true
            expect(props.some(p => p.Key === 'DefaultValue')).toBe(false);
        });

        it('should return properties for XORMDesign element', async () => {
            const mockDesign = new tfx.XORMDesign();
            mockDesign.ID = 'design-1';
            mockDesign.Name = 'TestDesign';
            mockDesign.Schema = 'production';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockDesign);

            const props = await bridge.GetProperties('design-1');

            expect(Array.isArray(props)).toBe(true);
            // ID is never shown
            expect(props.some(p => p.Key === 'ID')).toBe(false);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
            expect(props.some(p => p.Key === 'Schema')).toBe(true);
        });

        it('should return only Name property for unknown element type', async () => {
            const mockElement = { ID: 'unknown-1', Name: 'Unknown' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            const props = await bridge.GetProperties('unknown-1');

            expect(Array.isArray(props)).toBe(true);
            expect(props.length).toBe(1); // Only Name (ID is never shown)
            expect(props[0].Key).toBe('Name');
        });

        it('should use fallback PKTypes when _PKDataTypes is empty', async () => {
            // Load model with a table - don't mock GetElementByID
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            // Force _PKDataTypes to be empty
            (bridge as any)._PKDataTypes = [];

            const props = bridge.GetProperties('table-1');
            const pkTypeProp = props.find(p => p.Key === 'PKType');

            expect(pkTypeProp).toBeDefined();
            // Fallback types should be used (alphabetically sorted)
            expect(pkTypeProp?.Options).toEqual(["Guid", "Int32", "Int64"]);
        });

        it('should use loaded PKTypes when _PKDataTypes has values', async () => {
            // Load model with a table
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Width: 150, Height: 200 }]
            });
            await bridge.LoadOrmModelFromText(json);

            // Set _PKDataTypes to custom values
            (bridge as any)._PKDataTypes = ["Int32", "Int64", "Guid", "BigInt"];

            const props = bridge.GetProperties('table-1');
            const pkTypeProp = props.find(p => p.Key === 'PKType');

            expect(pkTypeProp).toBeDefined();
            // Custom types should be used
            expect(pkTypeProp?.Options).toEqual(["Int32", "Int64", "Guid", "BigInt"]);
        });

        it('should use fallback AllTypes when _AllDataTypes is empty', async () => {
            // Create a mock field element
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'TestField';
            mockField.DataType = 'String' as any;

            // Mock GetElementByID to return the field
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            // Force _AllDataTypes to be empty
            (bridge as any)._AllDataTypes = [];

            const props = bridge.GetProperties('field-1');
            const dataTypeProp = props.find(p => p.Key === 'DataType');

            expect(dataTypeProp).toBeDefined();
            // Fallback types should be used (alphabetically sorted)
            expect(dataTypeProp?.Options).toEqual(["Boolean", "DateTime", "Guid", "Int32", "String"]);
        });

        it('should use loaded AllTypes when _AllDataTypes has values', async () => {
            // Create a mock field element
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'TestField';
            mockField.DataType = 'String' as any;

            // Mock GetElementByID to return the field
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            // Set _AllDataTypes to custom values
            (bridge as any)._AllDataTypes = ["String", "Int32", "Decimal", "Binary"];

            const props = bridge.GetProperties('field-1');
            const dataTypeProp = props.find(p => p.Key === 'DataType');

            expect(dataTypeProp).toBeDefined();
            // Custom types should be used
            expect(dataTypeProp?.Options).toEqual(["String", "Int32", "Decimal", "Binary"]);
        });

        it('should expose AllowedValues as TagList type for a regular non-FK, non-AI field', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'Status';
            mockField.DataType = 'String' as any;
            mockField.IsAutoIncrement = false;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('field-1');
            const avProp = props.find(p => p.Key === 'AllowedValues');

            expect(avProp).toBeDefined();
            expect(avProp?.Type).toBe(XPropertyType.TagList);
            expect(avProp?.Hint).toBeTruthy();
        });

        it('should set Hint and Placeholder on Name property for different element types', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'Amount';
            mockField.DataType = 'Int32' as any;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('field-1');
            const nameProp = props.find(p => p.Key === 'Name');

            expect(nameProp?.Hint).toBeTruthy();
            expect(nameProp?.Placeholder).toBeTruthy();
        });

        it('should set Placeholder on Description property', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'Amount';
            mockField.DataType = 'Int32' as any;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('field-1');
            const descProp = props.find(p => p.Key === 'Description');

            expect(descProp?.Placeholder).toBeTruthy();
        });

        it('should set Placeholder on DefaultValue property for non-auto-increment regular field', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'Amount';
            mockField.DataType = 'Int32' as any;
            mockField.IsAutoIncrement = false;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('field-1');
            const dvProp = props.find(p => p.Key === 'DefaultValue');

            expect(dvProp?.Placeholder).toBeTruthy();
            expect(dvProp?.Hint).toBeTruthy();
        });

        it('should sort properties with unknown group using fallback order 99', async () => {
            // Access private SortProperties method
            const sortProps = (bridge as any).SortProperties.bind(bridge);

            // Create properties with known and unknown groups
            const props = [
                new XPropertyItem("B", "B", "val", XPropertyType.String, undefined, "UnknownGroup"),
                new XPropertyItem("A", "A", "val", XPropertyType.String, undefined, "Data"),
                new XPropertyItem("C", "C", "val", XPropertyType.String, undefined, "AnotherUnknown")
            ];

            const sorted = sortProps(props);

            // Data (order 2) should come first, then unknown groups (order 99) sorted by name
            expect(sorted[0].Key).toBe("A"); // Data group = 2
            expect(sorted[1].Key).toBe("B"); // UnknownGroup = 99, name "B"
            expect(sorted[2].Key).toBe("C"); // AnotherUnknown = 99, name "C"
        });

        it('should handle properties with null group using General fallback', async () => {
            const sortProps = (bridge as any).SortProperties.bind(bridge);

            const props = [
                new XPropertyItem("Z", "Z", "val", XPropertyType.String, undefined, null as any),
                new XPropertyItem("A", "A", "val", XPropertyType.String, undefined, "Data")
            ];

            const sorted = sortProps(props);

            // Data (2) should come first, null treated as General (99)
            expect(sorted[0].Key).toBe("A");
            expect(sorted[1].Key).toBe("Z");
        });

        it('should handle properties with undefined group using General fallback', async () => {
            const sortProps = (bridge as any).SortProperties.bind(bridge);

            // Create property with undefined group (no group parameter)
            const props = [
                new XPropertyItem("Z", "Z", "val", XPropertyType.String), // No group = undefined
                new XPropertyItem("A", "A", "val", XPropertyType.String, undefined, "Data")
            ];

            const sorted = sortProps(props);

            // Data (2) should come first, undefined treated as General (99)
            expect(sorted[0].Key).toBe("A");
            expect(sorted[1].Key).toBe("Z");
        });

        it('should return conditional properties for XORMPKField with Guid type (no auto-increment)', async () => {
            const mockField = new tfx.XORMPKField();
            mockField.ID = 'pk-guid';
            mockField.Name = 'ID';
            mockField.DataType = 'Guid' as any;
            mockField.IsAutoIncrement = false;

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('pk-guid');

            // Guid has no auto-increment — flag hidden
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(false);
            // DefaultValue shown because IsAutoIncrement=false
            expect(props.some(p => p.Key === 'DefaultValue')).toBe(true);
            // IsPrimaryKey never shown
            expect(props.some(p => p.Key === 'IsPrimaryKey')).toBe(false);
            // IsRequired never shown for PKField
            expect(props.some(p => p.Key === 'IsRequired')).toBe(false);
        });

        it('should return conditional properties for XORMField with String type (HasLength=true, no scale, no auto-increment)', async () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'f-str';
            mockField.Name = 'Username';
            mockField.DataType = 'String' as any;
            mockField.IsAutoIncrement = false;

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('f-str');

            // String has Length
            expect(props.some(p => p.Key === 'Length')).toBe(true);
            // String has no Scale
            expect(props.some(p => p.Key === 'Scale')).toBe(false);
            // String cannot auto-increment
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(false);
            // DefaultValue shown (no auto-increment)
            expect(props.some(p => p.Key === 'DefaultValue')).toBe(true);
            // IsRequired visible for regular fields
            expect(props.some(p => p.Key === 'IsRequired')).toBe(true);
            // IsPrimaryKey never shown
            expect(props.some(p => p.Key === 'IsPrimaryKey')).toBe(false);
            // ID never shown
            expect(props.some(p => p.Key === 'ID')).toBe(false);
        });

        it('should hide auto-increment and default value for FK fields', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'fk1';
            mockField.Name = 'UserID';
            mockField.DataType = 'Int32' as any;
            mockField.IsAutoIncrement = false;
            mockField.IsRequired = true;
            jest.spyOn(mockField, 'IsForeignKey', 'get').mockReturnValue(true);
            jest.spyOn(mockField, 'GetExpectedDataType').mockReturnValue('Int32');

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('fk1');

            // FK DataType shown and read-only
            const dtProp = props.find(p => p.Key === 'DataType');
            expect(dtProp).toBeDefined();
            expect(dtProp?.IsReadOnly).toBe(true);
            // IsAutoIncrement hidden for FK fields
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(false);
            // DefaultValue hidden for FK fields
            expect(props.some(p => p.Key === 'DefaultValue')).toBe(false);
            // IsRequired still shown
            expect(props.some(p => p.Key === 'IsRequired')).toBe(true);
        });

        it('should fall back to element.DataType when GetExpectedDataType returns null for FK field', () => {
            // Covers the ?? right-side branch: isForeignKey=true but GetExpectedDataType()=null
            const mockField = new tfx.XORMField();
            mockField.ID = 'fk2';
            mockField.Name = 'OrderID';
            mockField.DataType = 'Int64' as any;
            mockField.IsAutoIncrement = false;
            jest.spyOn(mockField, 'IsForeignKey', 'get').mockReturnValue(true);
            jest.spyOn(mockField, 'GetExpectedDataType').mockReturnValue(null as any);

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('fk2');

            // When GetExpectedDataType returns null the field's own DataType is used
            const dtProp = props.find(p => p.Key === 'DataType');
            expect(dtProp).toBeDefined();
            expect(dtProp?.Value).toBe('Int64');
            expect(dtProp?.IsReadOnly).toBe(true);
        });

        it('should show Length and Scale for Numeric type when loaded from type infos', async () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'f-num';
            mockField.Name = 'Amount';
            mockField.DataType = 'Numeric' as any;
            mockField.IsAutoIncrement = false;

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('f-num');

            // Numeric has Length and Scale
            expect(props.some(p => p.Key === 'Length')).toBe(true);
            expect(props.some(p => p.Key === 'Scale')).toBe(true);
            // Numeric cannot auto-increment
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(false);
        });

        it('should show Length and Scale for XORMPKField with Numeric type (unusual but possible)', () => {
            // XORMPKField DataType is unlocked until LockDataType() is called,
            // so setting it to Numeric is possible for edge-case coverage (e.g., custom C# import).
            const mockPKField = new tfx.XORMPKField();
            mockPKField.ID = 'pk-num';
            mockPKField.Name = 'ID';
            mockPKField.DataType = 'Numeric';
            jest.spyOn(mockPKField, 'IsAutoIncrement', 'get').mockReturnValue(false);

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockPKField);

            const props = bridge.GetProperties('pk-num');

            // Numeric has Length and Scale
            expect(props.some(p => p.Key === 'Length')).toBe(true);
            expect(props.some(p => p.Key === 'Scale')).toBe(true);
            // Numeric cannot auto-increment
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(false);
        });

        it('should use loaded _AllDataTypes for XORMPKField DataType enum options (true branch of length > 0)', () => {
            const mockPKField = new tfx.XORMPKField();
            mockPKField.ID = 'pk-loaded';
            mockPKField.Name = 'ID';
            jest.spyOn(mockPKField, 'IsAutoIncrement', 'get').mockReturnValue(true);
            (bridge as any)._AllDataTypes = ['Int32', 'String', 'Guid'];

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockPKField);

            const props = bridge.GetProperties('pk-loaded');

            const dtProp = props.find(p => p.Key === 'DataType');
            expect(dtProp).toBeDefined();
            expect(dtProp?.Options).toEqual(['Int32', 'String', 'Guid']);
        });

        it('should use loaded _AllDataTypes for XORMField DataType enum options (true branch of length > 0)', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'f-loaded';
            mockField.Name = 'Amount';
            mockField.DataType = 'Int32' as any;
            mockField.IsAutoIncrement = false;
            (bridge as any)._AllDataTypes = ['Int32', 'String', 'Guid'];

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('f-loaded');

            const dtProp = props.find(p => p.Key === 'DataType');
            expect(dtProp).toBeDefined();
            expect(dtProp?.Options).toEqual(['Int32', 'String', 'Guid']);
        });

        it('should return hidden auto-increment for XORMField IsAutoIncrement=true (DefaultValue hidden)', async () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'f-int';
            mockField.Name = 'Counter';
            mockField.DataType = 'Int32' as any;
            mockField.IsAutoIncrement = true;

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = bridge.GetProperties('f-int');

            // IsAutoIncrement shown (Int32 can auto-increment)
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(true);
            // DefaultValue hidden when IsAutoIncrement=true
            expect(props.some(p => p.Key === 'DefaultValue')).toBe(false);
        });

        it('should use fallback order 99 for grpB when second element has unknown group', async () => {
            const sortProps = (bridge as any).SortProperties.bind(bridge);

            // First element has known group, second has unknown group
            const props = [
                new XPropertyItem("A", "A", "val", XPropertyType.String, undefined, "Data"),
                new XPropertyItem("B", "B", "val", XPropertyType.String, undefined, "UnknownGroupB")
            ];

            const sorted = sortProps(props);

            // Data (order 2) should come first, unknown group (order 99) should come second
            expect(sorted[0].Key).toBe("A"); // Data group = 2
            expect(sorted[1].Key).toBe("B"); // UnknownGroupB = 99
        });

        it('should use fallback order 99 for both grpA and grpB when both have unknown groups', async () => {
            const sortProps = (bridge as any).SortProperties.bind(bridge);

            // Both elements have unknown groups - will trigger ?? 99 for both
            const props = [
                new XPropertyItem("X", "X", "val", XPropertyType.String, undefined, "UnknownGroupX"),
                new XPropertyItem("Y", "Y", "val", XPropertyType.String, undefined, "UnknownGroupY")
            ];

            const sorted = sortProps(props);

            // Both have same group order (99), so sorted by name
            expect(sorted[0].Key).toBe("X");
            expect(sorted[1].Key).toBe("Y");
        });
    });

    describe('GetGroupOrder', () => {
        it('should return correct order for known groups', async () => {
            const getGroupOrder = (bridge as any).GetGroupOrder.bind(bridge);

            expect(getGroupOrder("Identity")).toBe(1);
            expect(getGroupOrder("Data")).toBe(2);
            expect(getGroupOrder("Behaviour")).toBe(3);
            expect(getGroupOrder("Appearance")).toBe(4);
            expect(getGroupOrder("Design")).toBe(5);
            expect(getGroupOrder("Control")).toBe(6);
            expect(getGroupOrder("Test")).toBe(7);
            expect(getGroupOrder("General")).toBe(99);
        });

        it('should return 99 for unknown group', async () => {
            const getGroupOrder = (bridge as any).GetGroupOrder.bind(bridge);

            expect(getGroupOrder("UnknownGroup")).toBe(99);
            expect(getGroupOrder("AnotherUnknown")).toBe(99);
        });

        it('should return 99 when group is undefined', async () => {
            const getGroupOrder = (bridge as any).GetGroupOrder.bind(bridge);

            expect(getGroupOrder(undefined)).toBe(99);
        });

        it('should return 99 when group is null', async () => {
            const getGroupOrder = (bridge as any).GetGroupOrder.bind(bridge);

            expect(getGroupOrder(null as any)).toBe(99);
        });
    });

    describe('GetEffectiveTypeInfo', () => {
        it('should return type info from _TypeInfos when available', () => {
            const getInfo = (bridge as any).GetEffectiveTypeInfo.bind(bridge);
            (bridge as any)._TypeInfos = [
                { TypeName: 'MyType', HasLength: true, HasScale: true, CanAutoIncrement: false }
            ];
            const info = getInfo('MyType');
            expect(info.HasLength).toBe(true);
            expect(info.HasScale).toBe(true);
            expect(info.CanAutoIncrement).toBe(false);
        });

        it('should fall back to _FallbackTypeHints when type not in _TypeInfos', () => {
            const getInfo = (bridge as any).GetEffectiveTypeInfo.bind(bridge);
            (bridge as any)._TypeInfos = [];
            const info = getInfo('String');
            expect(info.HasLength).toBe(true);
            expect(info.HasScale).toBe(false);
            expect(info.CanAutoIncrement).toBe(false);
        });

        it('should fall back to _FallbackTypeHints for all built-in types', () => {
            const getInfo = (bridge as any).GetEffectiveTypeInfo.bind(bridge);
            (bridge as any)._TypeInfos = [];

            expect(getInfo('Boolean').CanAutoIncrement).toBe(false);
            expect(getInfo('Date').CanAutoIncrement).toBe(false);
            expect(getInfo('DateTime').CanAutoIncrement).toBe(false);
            expect(getInfo('Binary').HasLength).toBe(true);
            expect(getInfo('Guid').CanAutoIncrement).toBe(false);
            expect(getInfo('Int8').CanAutoIncrement).toBe(true);
            expect(getInfo('Int16').CanAutoIncrement).toBe(true);
            expect(getInfo('Int32').CanAutoIncrement).toBe(true);
            expect(getInfo('Int64').CanAutoIncrement).toBe(true);
            expect(getInfo('Numeric').HasLength).toBe(true);
            expect(getInfo('Numeric').HasScale).toBe(true);
            expect(getInfo('Text').CanAutoIncrement).toBe(false);
        });

        it('should return all-false for completely unknown type names', () => {
            const getInfo = (bridge as any).GetEffectiveTypeInfo.bind(bridge);
            (bridge as any)._TypeInfos = [];
            const info = getInfo('SomeCompletelyUnknownType');
            expect(info.HasLength).toBe(false);
            expect(info.HasScale).toBe(false);
            expect(info.CanAutoIncrement).toBe(false);
        });

        it('should fall back to _FallbackTypeHints when _TypeInfos has entries that do not match the queried type', () => {
            const getInfo = (bridge as any).GetEffectiveTypeInfo.bind(bridge);
            // _TypeInfos is non-empty but contains a different type — loop runs, if is false, falls through to ??
            (bridge as any)._TypeInfos = [
                { TypeName: 'OtherType', HasLength: false, HasScale: false, CanAutoIncrement: false }
            ];
            const info = getInfo('String');
            expect(info.HasLength).toBe(true);
            expect(info.HasScale).toBe(false);
            expect(info.CanAutoIncrement).toBe(false);
        });
    });

    describe('ResolveFieldFriendlyName', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return raw ID when fieldID is empty', () => {
            const resolve = (bridge as any).ResolveFieldFriendlyName.bind(bridge);
            expect(resolve('')).toBe('');
        });

        it('should return raw ID when element not found', () => {
            const resolve = (bridge as any).ResolveFieldFriendlyName.bind(bridge);
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);
            expect(resolve('missing-id')).toBe('missing-id');
        });

        it('should return TableName.FieldName when field has a parent with a name', () => {
            const resolve = (bridge as any).ResolveFieldFriendlyName.bind(bridge);

            const mockTable = { Name: 'Users' };
            const mockField = { Name: 'UserID', ParentNode: mockTable };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            expect(resolve('field-id')).toBe('Users.UserID');
        });

        it('should return just FieldName when field has no parent', () => {
            const resolve = (bridge as any).ResolveFieldFriendlyName.bind(bridge);

            const mockField = { Name: 'UserID', ParentNode: null };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            expect(resolve('field-id')).toBe('UserID');
        });

        it('should return just FieldName when parent has no Name', () => {
            const resolve = (bridge as any).ResolveFieldFriendlyName.bind(bridge);

            const mockField = { Name: 'UserID', ParentNode: { Name: '' } };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            expect(resolve('field-id')).toBe('UserID');
        });
    });

    describe('ResolveTableFriendlyName', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return raw ID when tableID is empty', () => {
            const resolve = (bridge as any).ResolveTableFriendlyName.bind(bridge);
            expect(resolve('')).toBe('');
        });

        it('should return table name when element is found', () => {
            const resolve = (bridge as any).ResolveTableFriendlyName.bind(bridge);

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Orders' });
            expect(resolve('t1')).toBe('Orders');
        });

        it('should return raw ID when element not found', () => {
            const resolve = (bridge as any).ResolveTableFriendlyName.bind(bridge);

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);
            expect(resolve('missing-table-id')).toBe('missing-table-id');
        });
    });

    describe('UpdateProperty fallback', () => {
        it('should return { Success: false, Message } when element not found', () => {
            // Don't load any model, so element won't be found
            const result = bridge.UpdateProperty('elem-1', 'Name', 'NewName');

            expect(result.Success).toBe(false);
            expect(result.Message).toBe('Element not found.');
        });
    });

    describe('GetProperties for XORMDesign (new properties)', () => {
        let designId: string;

        beforeEach(async () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'TestModel', Tables: [
                { ID: 'tbl1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }
            ]}));
            designId = bridge.Controller.Design.ID;
        });

        it('should return ParentModel, StateControlTable and TenantControlTable properties', () => {
            const props = bridge.GetProperties(designId);

            expect(props.some(p => p.Key === 'ParentModel')).toBe(true);
            expect(props.some(p => p.Key === 'StateControlTable')).toBe(true);
            expect(props.some(p => p.Key === 'TenantControlTable')).toBe(true);
        });

        it('should return ParentModel as MultiFileSelect type', () => {
            const props = bridge.GetProperties(designId);
            const pm = props.find(p => p.Key === 'ParentModel')!;

            expect(pm.Type).toBe(XPropertyType.MultiFileSelect);
        });

        it('should include current model tables in StateControlTable options', () => {
            const props = bridge.GetProperties(designId);
            const sct = props.find(p => p.Key === 'StateControlTable')!;

            expect(sct.Options).toBeDefined();
            expect(sct.Options).toContain('');
            expect(sct.Options).toContain('Orders');
        });

        it('should expose available orm files in ParentModel options when _AvailableOrmFiles is populated', () => {
            (bridge as any)._AvailableOrmFiles = ['Auth.dsorm', 'Common.dsorm'];
            const props = bridge.GetProperties(designId);
            const pm = props.find(p => p.Key === 'ParentModel')!;

            expect(pm.Options).toEqual(['Auth.dsorm', 'Common.dsorm']);
        });

        it('should trigger background parent table load when design has ParentModel but no cached tables', async () => {
            const design = bridge.Controller.Design;
            design.ParentModel = 'Auth.dsorm';
            (bridge as any)._ParentModelTableGroups = [];

            const b2 = new XTFXBridge();
            b2.LoadOrmModelFromText(JSON.stringify({ Name: 'Auth', Tables: [
                { ID: 't1', Name: 'AuthUser', X: 0, Y: 0, Width: 200, Height: 60 }
            ]}));
            const parentXml = b2.SaveOrmModelToText();

            bridge.SetContextPath('/test/dir/current.dsorm');
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentXml));

            expect(() => bridge.GetProperties(designId)).not.toThrow();
        });

        it('should include cached parent model tables in StateControlTable and TenantControlTable options', () => {
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Parent.dsorm', Tables: [
                    { Name: 'ParentTable1', Fill: '' },
                    { Name: 'ParentTable2', Fill: '' }
                ]}
            ];
            const props = bridge.GetProperties(designId);
            const sct = props.find(p => p.Key === 'StateControlTable')!;
            const tct = props.find(p => p.Key === 'TenantControlTable')!;

            expect(sct.Options).toContain('ParentTable1');
            expect(sct.Options).toContain('Orders');
            expect(tct.Options).toContain('ParentTable2');
        });
    });

    describe('UpdateProperty for XORMDesign (new properties)', () => {
        let designId: string;

        beforeEach(() => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'TestModel' }));
            designId = bridge.Controller.Design.ID;
        });

        it('should update ParentModel property and trigger background table reload', () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('<XORMDocument />'));

            const result = bridge.UpdateProperty(designId, 'ParentModel', 'Auth.dsorm');

            expect(result.Success).toBe(true);
            expect(bridge.Controller.Design.ParentModel).toBe('Auth.dsorm');
        });

        it('should update ParentModel with empty value without error', () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('<XORMDocument />'));

            const result = bridge.UpdateProperty(designId, 'ParentModel', '');

            expect(result.Success).toBe(true);
        });

        it('should update StateControlTable property', () => {
            const result = bridge.UpdateProperty(designId, 'StateControlTable', 'Orders');

            expect(result.Success).toBe(true);
            expect(bridge.Controller.Design.StateControlTable).toBe('Orders');
        });

        it('should update TenantControlTable property', () => {
            const result = bridge.UpdateProperty(designId, 'TenantControlTable', 'Tenants');

            expect(result.Success).toBe(true);
            expect(bridge.Controller.Design.TenantControlTable).toBe('Tenants');
        });

        it('should return error for unknown XORMDesign property', () => {
            const result = bridge.UpdateProperty(designId, 'UnknownDesignProp', 'value');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Unknown property');
        });
    });

});
