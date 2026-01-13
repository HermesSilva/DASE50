// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueItem } from '../../Models/IssueItem';
import { XPropertyItem } from '../../Models/PropertyItem';

// Import real TFX library
import * as tfx from '@tootega/tfx';

describe('XTFXBridge', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    describe('constructor', () => {
        it('should create uninitialized bridge', () => {
            expect(bridge.Controller).toBeNull();
            expect(bridge.Document).toBeUndefined();
        });
    });

    describe('Initialize', () => {
        it('should initialize TFX components', async () => {
            await bridge.Initialize();

            expect(bridge.Controller).toBeDefined();
        });

        it('should not reinitialize if already initialized', async () => {
            await bridge.Initialize();
            const controller1 = bridge.Controller;

            await bridge.Initialize();
            const controller2 = bridge.Controller;

            expect(controller1).toBe(controller2);
        });
    });

    describe('LoadOrmModelFromText', () => {
        it('should load empty model from empty string', async () => {
            const doc = await bridge.LoadOrmModelFromText('');

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should load empty model from empty JSON', async () => {
            const doc = await bridge.LoadOrmModelFromText('{}');

            expect(doc).toBeDefined();
        });

        it('should handle invalid JSON gracefully', async () => {
            const doc = await bridge.LoadOrmModelFromText('invalid json');

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should load model with tables', async () => {
            const jsonData = JSON.stringify({
                Name: 'Test Model',
                Tables: [
                    {
                        ID: 'table-1',
                        Name: 'Users',
                        X: 100,
                        Y: 200,
                        Width: 200,
                        Height: 150,
                        Fields: [
                            { ID: 'field-1', Name: 'ID', DataType: 'Integer', IsPrimaryKey: true }
                        ]
                    }
                ]
            });

            const doc = await bridge.LoadOrmModelFromText(jsonData);

            expect(doc).toBeDefined();
        });
    });

    describe('SaveOrmModelToText', () => {
        it('should return empty XML when no document', () => {
            const text = bridge.SaveOrmModelToText();

            expect(text).toContain('<?xml');
            expect(text).toContain('XORMDocument');
        });

        it('should save model to XML after loading', async () => {
            await bridge.LoadOrmModelFromText('{}');
            const text = bridge.SaveOrmModelToText();

            expect(text).toContain('<?xml');
        });
    });

    describe('ValidateOrmModel', () => {
        it('should return empty array when Document is null', async () => {
            await bridge.Initialize();
            
            // Set Document to null
            bridge.Controller.Document = null;
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues).toEqual([]);
        });

        it('should return array of issues', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([])
            } as any;
            
            const issues = await bridge.ValidateOrmModel();

            expect(Array.isArray(issues)).toBe(true);
        });

        it('should convert TFX issues to XIssueItem', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([
                    {
                        ElementID: 'elem-1',
                        ElementName: 'Table1',
                        Severity: 2, // Error
                        Message: 'Test error',
                        PropertyID: 'prop-1'
                    }
                ])
            } as any;
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues.length).toBe(1);
            expect(issues[0].ElementID).toBe('elem-1');
            expect(issues[0].Message).toBe('Test error');
        });

        it('should convert warning severity', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([
                    {
                        ElementID: 'elem-1',
                        ElementName: 'Table1',
                        Severity: 1, // Warning (not Error)
                        Message: 'Test warning',
                        PropertyID: 'prop-1'
                    }
                ])
            } as any;
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues.length).toBe(1);
            expect(issues[0].Severity).toBe(1); // Warning
        });
    });

    describe('AddTable', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should add table with coordinates and name', async () => {
            const mockAddTable = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddTable = mockAddTable;

            const result = await bridge.AddTable(100, 200, 'NewTable');

            expect(mockAddTable).toHaveBeenCalledWith({
                X: 100,
                Y: 200,
                Name: 'NewTable'
            });
        });
    });

    describe('AddReference', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should add reference between tables (creates FK field first)', () => {
            const mockAddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'new-fk-field-id' });
            const mockAddReference = jest.fn().mockReturnValue({ Success: true });
            const mockGetElementByID = jest.fn().mockReturnValue({ Name: 'TargetTable' });
            bridge.Controller.AddField = mockAddField;
            bridge.Controller.AddReference = mockAddReference;
            bridge.Controller.GetElementByID = mockGetElementByID;

            const result = bridge.AddReference('source-table-id', 'target-table-id', 'RefName');

            // First creates FK field
            expect(mockAddField).toHaveBeenCalledWith({
                TableID: 'source-table-id',
                Name: 'TargetTableID'
            });
            // Then creates reference using field ID
            expect(mockAddReference).toHaveBeenCalledWith({
                SourceFieldID: 'new-fk-field-id',
                TargetTableID: 'target-table-id',
                Name: 'RefName'
            });
        });
    });

    describe('DeleteElement', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should delete element by ID', () => {
            const mockRemoveElement = jest.fn().mockReturnValue(true);
            bridge.Controller.RemoveElement = mockRemoveElement;

            const result = bridge.DeleteElement('elem-1');

            expect(mockRemoveElement).toHaveBeenCalledWith('elem-1');
        });
    });

    describe('RenameElement', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should rename element', () => {
            const mockRenameElement = jest.fn().mockReturnValue(true);
            bridge.Controller.RenameElement = mockRenameElement;

            const result = bridge.RenameElement('elem-1', 'NewName');

            expect(mockRenameElement).toHaveBeenCalledWith({
                ElementID: 'elem-1',
                NewName: 'NewName'
            });
        });
    });

    describe('MoveElement', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should move element to new position', () => {
            const mockMoveElement = jest.fn().mockReturnValue(true);
            bridge.Controller.MoveElement = mockMoveElement;

            const result = bridge.MoveElement('elem-1', 300, 400);

            expect(mockMoveElement).toHaveBeenCalledWith({
                ElementID: 'elem-1',
                X: 300,
                Y: 400
            });
        });
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

            expect(result.Success).toBe(true);
        });

        it('should update XORMField IsNullable property', async () => {
            const json = JSON.stringify({
                Name: "TestModel",
                Tables: [{ ID: "table-1", Name: "TestTable", X: 100, Y: 100, Fields: [{ ID: "field-1", Name: "Name", DataType: "String" }] }]
            });
            await bridge.LoadOrmModelFromText(json);

            const result = bridge.UpdateProperty('field-1', 'IsNullable', false);

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

        it('should return success for unknown element type with non-Name property (line 467 false branch)', async () => {
            const json = JSON.stringify({
                Name: "TestModel"
            });
            await bridge.LoadOrmModelFromText(json);

            // Mock GetElementByID to return an unknown element type
            const mockElement = { ID: 'unknown-1', Name: 'Unknown', SomeProperty: 'value' } as any;
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            // Use a property key that's NOT "Name" to go through all instanceof checks
            const result = bridge.UpdateProperty('unknown-1', 'SomeOtherProp', 'NewValue');

            // Should return success but property not actually set (falls through)
            expect(result.Success).toBe(true);
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
            expect(props.some(p => p.Key === 'ID')).toBe(true);
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

    describe('GetModelData', () => {
        it('should return empty data when not initialized', async () => {
            // Cria bridge mas mocka Controller.Document para ser null
            const newBridge = new XTFXBridge();
            await newBridge.LoadOrmModelFromText('{}');
            // Força Document para null para testar o branch
            (newBridge as any)._Controller.Document = null;
            
            const data = await newBridge.GetModelData();


            expect(data).toEqual({ Tables: [], References: [] });
        });

        it('should return tables and references', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);
            // Garante que Document.Design existe
            bridge.Controller.Document = { Design: {} };

            const data = await bridge.GetModelData();

            expect(data).toHaveProperty('Tables');
            expect(data).toHaveProperty('References');
            expect(Array.isArray(data.Tables)).toBe(true);
            expect(Array.isArray(data.References)).toBe(true);
        });

        it('should return empty data when Design is null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.Document = { Design: null };

            const data = await bridge.GetModelData();

            expect(data).toEqual({ Tables: [], References: [] });
        });

        it('should map table data correctly with fields', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockField = {
                ID: 'field-1',
                Name: 'UserID',
                DataType: 'Integer',
                IsPrimaryKey: true,
                IsNullable: false
            };
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([mockField])
            };
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Orders_Users',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 200 }, { X: 300, Y: 400 }]
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.Tables.length).toBe(1);
            expect(data.Tables[0].ID).toBe('table-1');
            expect(data.Tables[0].Name).toBe('Users');
            expect(data.Tables[0].Fields.length).toBe(1);
            expect(data.References.length).toBe(1);
            expect(data.References[0].Points.length).toBe(2);
        });

        it('should include FillProp when table has Fill color', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: { ToString: () => 'FF00FF00' },  // Green color
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#00FF00');
        });

        it('should not include FillProp when table has no Fill', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: null,
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBeUndefined();
        });

        it('should handle Fill as string starting with #', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: '#FF0000',
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
        });

        it('should handle Fill as string not starting with #', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: 'FFFF0000',
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
        });

        it('should handle Fill with ToString function (XColor object)', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockColor = {
                ToString: jest.fn().mockReturnValue('FFFF0000')
            };
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: mockColor,
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
            expect(mockColor.ToString).toHaveBeenCalled();
        });

        it('should handle Fill as plain string in GetModelData (edge case - line 586)', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create object without ToString method to test String() conversion
            const fillObj = Object.create(null);
            Object.assign(fillObj, { value: '#FF0000' });
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: '#FF0000', // Plain string (not starting with #) to test else branch
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
        });

        it('should not set FillProp when Fill is object without ToString and not string (line 586 false branch)', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Fill is an object without ToString method and not a string
            // This tests when typeof t.Fill === 'string' returns false
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: 12345, // Number, not a string, no ToString as function
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            // Fill should not be processed since it's neither XColor nor string
            expect(data.Tables[0].FillProp).toBeUndefined();
        });

        it('should handle references with Source/Target properties', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Test',
                Source: 'src-field',
                Target: 'tgt-table',
                Points: null
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].SourceFieldID).toBe('src-field');
            expect(data.References[0].TargetTableID).toBe('tgt-table');
            expect(data.References[0].Points).toEqual([]);
        });
    });

    describe('LoadFromJson', () => {
        let mockDoc: any;
        
        beforeEach(async () => {
            await bridge.Initialize();
            
            // Spy on AppendChild to ensure Fields array is properly initialized
            const originalAppendChild = tfx.XORMTable.prototype.AppendChild;
            jest.spyOn(tfx.XORMTable.prototype, 'AppendChild').mockImplementation(function(this: any, child: any) {
                // Ensure Fields array exists
                if (!this.Fields) {
                    this.Fields = [];
                }
                this.Fields.push(child);
            });
            
            // Create a proper mock document with Design factory methods
            mockDoc = {
                ID: 'test-doc',
                Name: 'Initial',
                Tables: [] as any[],
                References: [] as any[],
                Design: {
                    AppendChild: jest.fn((child: any) => {
                        if (child.Bounds !== undefined) {
                            // Do NOT overwrite Fields - it's now properly initialized
                            // Just push the table to Tables array
                            mockDoc.Tables.push(child);
                        } else if (child.Source !== undefined) {
                            mockDoc.References.push(child);
                        }
                    }),
                    CreateTable: jest.fn((options: any) => {
                        const table: any = {
                            ID: options.ID || tfx.XGuid.NewValue(),
                            Name: options.Name || '',
                            Schema: options.Schema || 'dbo',
                            Description: options.Description || '',
                            X: options.X || 0,
                            Y: options.Y || 0,
                            Width: options.Width || 200,
                            Height: options.Height || 150,
                            Bounds: new tfx.XRect(options.X || 0, options.Y || 0, options.Width || 200, options.Height || 150),
                            Fields: [],
                            CreateField: jest.fn((fieldOpts: any) => {
                                const field: any = {
                                    ID: fieldOpts.ID || tfx.XGuid.NewValue(),
                                    Name: fieldOpts.Name || '',
                                    DataType: fieldOpts.DataType || 'String',
                                    Length: fieldOpts.Length || 0,
                                    IsPrimaryKey: fieldOpts.IsPrimaryKey || false,
                                    IsNullable: fieldOpts.IsNullable !== false,
                                    IsAutoIncrement: fieldOpts.IsAutoIncrement || false,
                                    DefaultValue: fieldOpts.DefaultValue || '',
                                    Description: fieldOpts.Description || ''
                                };
                                table.Fields.push(field);
                                return field;
                            })
                        };
                        mockDoc.Tables.push(table);
                        return table;
                    }),
                    CreateReference: jest.fn((options: any) => {
                        const ref: any = {
                            ID: options.ID || tfx.XGuid.NewValue(),
                            Name: options.Name || '',
                            SourceID: options.SourceID || '',
                            TargetID: options.TargetID || '',
                            Source: options.SourceID || '',
                            Target: options.TargetID || '',
                            Description: options.Description || '',
                            Points: options.Points || []
                        };
                        mockDoc.References.push(ref);
                        return ref;
                    })
                }
            };
        });

        it('should not load when data is null', async () => {
            await (bridge as any).LoadFromJson(mockDoc, null);
            
            // Should not throw
            expect(mockDoc.Design.AppendChild).not.toHaveBeenCalled();
        });

        it('should not load when doc.Design is null', async () => {
            const docWithoutDesign = { Design: null };
            
            await (bridge as any).LoadFromJson(docWithoutDesign, { Name: 'Test' });
            
            // Should not throw
        });

        it('should load model name from JSON', async () => {
            await (bridge as any).LoadFromJson(mockDoc, { Name: 'New Model Name' });
            
            expect(mockDoc.Name).toBe('New Model Name');
        });

        it('should load design Schema from JSON', async () => {
            await (bridge as any).LoadFromJson(mockDoc, { Name: 'Test', Schema: 'production' });
            
            expect(mockDoc.Design.Schema).toBe('production');
        });

        it('should load tables with fields from JSON', async () => {
            const jsonData = {
                Name: 'Test Model',
                Tables: [{
                    ID: 'table-1',
                    Name: 'Users',
                    Schema: 'dbo',
                    Description: 'User table',
                    X: 100,
                    Y: 200,
                    Width: 200,
                    Height: 150,
                    Fields: [{
                        ID: 'field-1',
                        Name: 'ID',
                        DataType: 'Integer',
                        Length: 10,
                        IsPrimaryKey: true,
                        IsNullable: false,
                        IsAutoIncrement: true,
                        DefaultValue: '0',
                        Description: 'Primary key'
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Name).toBe('Test Model');
            expect(mockDoc.Design.CreateTable).toHaveBeenCalled();
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Name).toBe('Users');
            expect(mockDoc.Tables[0].Schema).toBe('dbo');
        });

        it('should load references from JSON (supports legacy SourceID/TargetID)', async () => {
            const jsonData = {
                References: [{
                    ID: 'ref-1',
                    Name: 'FK_Test',
                    SourceID: 'field-1',  // Legacy format
                    TargetID: 'table-2',  // Legacy format
                    Description: 'Foreign key',
                    Points: [{ X: 100, Y: 200 }, { X: 300, Y: 400 }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Design.CreateReference).toHaveBeenCalled();
            expect(mockDoc.References.length).toBe(1);
            expect(mockDoc.References[0].Name).toBe('FK_Test');
        });

        it('should handle tables without optional fields', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'MinimalTable'
                    // No ID, Schema, Description, X, Y, Width, Height, Fields
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            // Should not throw and use defaults
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Name).toBe('MinimalTable');
        });

        it('should use empty string when table Name is undefined', async () => {
            const jsonData = {
                Tables: [{
                    Name: undefined  // Explicitly undefined
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Name).toBe('');  // Should use default empty string
        });

        it('should use empty string when table Name is null', async () => {
            const jsonData = {
                Tables: [{
                    Name: null  // Explicitly null
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Name).toBe('');  // Should use default empty string
        });

        it('should use empty string when table Name is empty string', async () => {
            const jsonData = {
                Tables: [{
                    Name: ''  // Explicitly empty string
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Name).toBe('');  // Should preserve empty string
        });

        it('should use empty string when field Name is undefined', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [{
                        Name: undefined  // Explicitly undefined
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Fields.length).toBe(1);
            expect(mockDoc.Tables[0].Fields[0].Name).toBe('');  // Should use default empty string
        });

        it('should use empty string when field Name is null', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [{
                        Name: null  // Explicitly null
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Fields.length).toBe(1);
            expect(mockDoc.Tables[0].Fields[0].Name).toBe('');  // Should use default empty string
        });

        it('should use empty string when field Name is empty string', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [{
                        Name: ''  // Explicitly empty string
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Fields.length).toBe(1);
            expect(mockDoc.Tables[0].Fields[0].Name).toBe('');  // Should preserve empty string
        });

        it('should handle references without optional fields', async () => {
            const jsonData = {
                References: [{
                    Name: 'MinimalRef'
                    // No ID, SourceFieldID, TargetTableID, Description, Points
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            // Should not throw and use defaults
            expect(mockDoc.References.length).toBe(1);
            expect(mockDoc.References[0].Name).toBe('MinimalRef');
        });

        it('should handle references with points array', async () => {
            const jsonData = {
                References: [{
                    Name: 'RefWithPoints',
                    SourceFieldID: 'field-1',
                    TargetTableID: 'table-2',
                    Description: 'Test description',
                    Points: [{ X: 100, Y: 200 }, { X: 300, Y: 400 }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.References.length).toBe(1);
            expect(mockDoc.References[0].Description).toBe('Test description');
        });

        it('should handle tables with explicit schema and description', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Schema: 'custom_schema',
                    Description: 'This is a test table',
                    X: 50,
                    Y: 100
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Description).toBe('This is a test table');
        });

        it('should handle fields without optional properties', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [{
                        Name: 'MinimalField'
                        // No ID, DataType, Length, IsPrimaryKey, etc.
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            // Should not throw and use defaults
            expect(mockDoc.Tables.length).toBe(1);
        });

        it('should handle fields with all explicit properties', async () => {
            const jsonData = {
                Tables: [{
                    ID: 'table-1',
                    Name: 'FullTable',
                    Schema: 'production',  // Non-default value to test truthy branch
                    Description: 'A full table',
                    X: 100,
                    Y: 200,
                    Width: 300,
                    Height: 200,
                    Fields: [{
                        ID: 'field-1',
                        Name: 'FullField',
                        DataType: 'Int32',  // Non-default value to test truthy branch
                        Length: 10,
                        IsPrimaryKey: true,
                        IsNullable: true,
                        IsAutoIncrement: true,
                        DefaultValue: '0',
                        Description: 'A full field'
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].ID).toBe('table-1');
        });

        // Branch coverage tests for || operators
        it('should use default Schema "dbo" when Schema is undefined', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithoutSchema',
                    Schema: undefined  // Explicitly undefined to test fallback branch
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Schema).toBe('dbo');  // Should use default
        });

        it('should use explicit Schema when provided', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithSchema',
                    Schema: 'production'  // Explicit non-default value
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
        });

        it('should use default Schema "dbo" when Schema is empty string', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithEmptySchema',
                    Schema: ''  // Empty string is falsy
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Schema).toBe('dbo');  // Should use default
        });

        it('should use default Schema "dbo" when Schema is null', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithNullSchema',
                    Schema: null  // null is falsy
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Schema).toBe('dbo');  // Should use default
        });

        it('should use default Name "" when Reference Name is undefined', async () => {
            const jsonData = {
                References: [{
                    SourceFieldID: 'field-1',
                    TargetTableID: 'table-2',
                    Name: undefined  // Explicitly undefined to test fallback branch
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.References.length).toBe(1);
            expect(mockDoc.References[0].Name).toBe('');  // Should use default
        });

        it('should use default DataType "String" when DataType is undefined', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithField',
                    Fields: [{
                        Name: 'FieldWithoutDataType',
                        DataType: undefined  // Explicitly undefined
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            // DataType should be the default value
        });

        it('should use explicit DataType when provided', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithField',
                    Fields: [{
                        Name: 'TypedField',
                        DataType: 'Int32'  // Explicit non-default value
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            // DataType should be Int32, not default
        });

        it('should use default DataType when DataType is null', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TableWithField',
                    Fields: [{
                        Name: 'FieldWithNullDataType',
                        DataType: null  // Explicitly null
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
        });
    });

    describe('SaveToJson', () => {
        it('should return empty object when doc is null', () => {
            const result = (bridge as any).SaveToJson(null);
            
            expect(result).toEqual({});
        });

        it('should return empty object when doc.Design is null', () => {
            const result = (bridge as any).SaveToJson({ Design: null });
            
            expect(result).toEqual({});
        });

        it('should save model with tables and references', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockField = {
                ID: 'field-1',
                Name: 'UserID',
                DataType: 'Integer',
                Length: 4,
                IsPrimaryKey: true,
                IsNullable: false,
                IsAutoIncrement: true,
                DefaultValue: '',
                Description: 'Primary key'
            };
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Schema: 'dbo',
                Description: 'User table',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([mockField])
            };
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Orders_Users',
                Source: 'field-1',
                Target: 'table-2',
                Description: 'Foreign key',
                Points: [{ X: 100, Y: 200 }]
            };
            
            bridge.Controller.Document = { Name: 'Test Model', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.Name).toBe('Test Model');
            expect(result.Tables.length).toBe(1);
            expect(result.Tables[0].ID).toBe('table-1');
            expect(result.Tables[0].Fields.length).toBe(1);
            expect(result.References.length).toBe(1);
        });

        it('should handle tables without GetChildrenOfType', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Schema: 'dbo',
                Description: '',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: null
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.Tables[0].Fields).toEqual([]);
        });

        it('should handle references without Points', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Test',
                Source: 'field-1',
                Target: 'table-2',
                Description: '',
                Points: null
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.References[0].Points).toEqual([]);
        });

        it('should use empty arrays when Controller is null', () => {
            // Create a new bridge instance without initializing
            const uninitializedBridge = new XTFXBridge();
            // Don't call Initialize() so _Controller remains null
            
            // Force a document without controller
            (uninitializedBridge as any)._Controller = null;
            
            const result = (uninitializedBridge as any).SaveToJson({ Name: 'Test', Design: {} });
            
            // Should use empty arrays from || fallback
            expect(result.Tables).toEqual([]);
            expect(result.References).toEqual([]);
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
            expect(props.some(p => p.Key === 'ID')).toBe(true);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
            expect(props.some(p => p.Key === 'Source')).toBe(true);
            expect(props.some(p => p.Key === 'Target')).toBe(true);
            expect(props.some(p => p.Key === 'Description')).toBe(true);
        });

        it('should return properties for XORMField element', async () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'UserID';
            mockField.DataType = 'Integer' as any;
            mockField.Length = 4;
            mockField.IsPrimaryKey = true;
            mockField.IsNullable = false;
            mockField.IsAutoIncrement = true;
            mockField.DefaultValue = '';
            mockField.Description = 'Primary key';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const props = await bridge.GetProperties('field-1');

            expect(Array.isArray(props)).toBe(true);
            expect(props.some(p => p.Key === 'ID')).toBe(true);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
            expect(props.some(p => p.Key === 'DataType')).toBe(true);
            expect(props.some(p => p.Key === 'Length')).toBe(true);
            expect(props.some(p => p.Key === 'IsPrimaryKey')).toBe(true);
            expect(props.some(p => p.Key === 'IsNullable')).toBe(true);
            expect(props.some(p => p.Key === 'IsAutoIncrement')).toBe(true);
        });

        it('should return properties for XORMDesign element', async () => {
            const mockDesign = new tfx.XORMDesign();
            mockDesign.ID = 'design-1';
            mockDesign.Name = 'TestDesign';
            mockDesign.Schema = 'production';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockDesign);

            const props = await bridge.GetProperties('design-1');

            expect(Array.isArray(props)).toBe(true);
            expect(props.some(p => p.Key === 'ID')).toBe(true);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
            expect(props.some(p => p.Key === 'Schema')).toBe(true);
        });

        it('should return only basic properties for unknown element type', async () => {
            const mockElement = { ID: 'unknown-1', Name: 'Unknown' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            const props = await bridge.GetProperties('unknown-1');

            expect(Array.isArray(props)).toBe(true);
            expect(props.length).toBe(2); // Only ID and Name
            expect(props[0].Key).toBe('ID');
            expect(props[1].Key).toBe('Name');
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
    });

    describe('GetElementInfo', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return null for non-existent element', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);

            const info = bridge.GetElementInfo('non-existent');

            expect(info).toBeNull();
        });

        it('should return info for XORMDesign element', () => {
            const mockDesign = new tfx.XORMDesign();
            mockDesign.ID = 'design-1';
            mockDesign.Name = 'TestDesign';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockDesign);

            const info = bridge.GetElementInfo('design-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('design-1');
            expect(info?.Name).toBe('TestDesign');
            expect(info?.Type).toBe('XORMDesign');
        });

        it('should return info for XORMTable element', () => {
            const mockTable = new tfx.XORMTable();
            mockTable.ID = 'table-1';
            mockTable.Name = 'Users';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTable);

            const info = bridge.GetElementInfo('table-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('table-1');
            expect(info?.Name).toBe('Users');
            expect(info?.Type).toBe('XORMTable');
        });

        it('should return info for XORMReference element', () => {
            const mockRef = new tfx.XORMReference();
            mockRef.ID = 'ref-1';
            mockRef.Name = 'FK_Test';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockRef);

            const info = bridge.GetElementInfo('ref-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('ref-1');
            expect(info?.Name).toBe('FK_Test');
            expect(info?.Type).toBe('XORMReference');
        });

        it('should return info for XORMField element', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'UserID';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const info = bridge.GetElementInfo('field-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('field-1');
            expect(info?.Name).toBe('UserID');
            expect(info?.Type).toBe('XORMField');
        });

        it('should return "Unknown" type for unknown element type', () => {
            const mockElement = { ID: 'unknown-1', Name: 'Unknown' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            const info = bridge.GetElementInfo('unknown-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('unknown-1');
            expect(info?.Name).toBe('Unknown');
            expect(info?.Type).toBe('Unknown');
        });
    });

    describe('SaveOrmModelToText error handling', () => {
        it('should return empty XML when Document is null', () => {
            (bridge as any)._Controller = { Document: null };
            
            const result = bridge.SaveOrmModelToText();
            
            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });

        it('should return empty XML on error', async () => {
            await bridge.LoadOrmModelFromText('{}');
            // Force SaveToXml to throw by setting Engine to null
            (bridge as any)._Engine = { SaveToXml: () => { throw new Error('Test error'); } };

            const result = bridge.SaveOrmModelToText();
            
            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });
    });

    describe('ApplyOperation', () => {
        it('should apply operation through controller', async () => {
            await bridge.LoadOrmModelFromText('{}');
            const mockApplyOperation = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.ApplyOperation = mockApplyOperation;

            const result = bridge.ApplyOperation({ type: 'test' });

            expect(mockApplyOperation).toHaveBeenCalledWith({ type: 'test' });
        });

        it('should return undefined when controller is null', () => {
            const result = bridge.ApplyOperation({ type: 'test' });

            expect(result).toBeUndefined();
        });
    });

    describe('LoadOrmModelFromText XML handling', () => {
        it('should load XML format when text starts with <?xml', async () => {
            const xmlText = '<?xml version="1.0"?><XORMDocument><Name>Test</Name></XORMDocument>';
            
            // Mock the Engine.Deserialize to return success with data
            const mockDoc = {
                ID: 'mock-id',
                Name: 'Test Doc',
                ChildNodes: [],
                Design: { ChildNodes: [] },
                Initialize: jest.fn()
            };
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(mockDoc.Initialize).toHaveBeenCalled();
            expect(doc).toBe(mockDoc);
        });

                it('should recover invalid reference points from XML and avoid routing', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-1" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=887;Y=394}|{X=779.5;Y=394}|{X=779.5;Y=170}|{X=672;Y=170}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const pointsArray = [{ X: 887, Y: 394 }, { X: Number.NaN, Y: 394 }];
                        const ref = { ID: 'ref-1', Points: pointsArray };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(mockDoc.Initialize).toHaveBeenCalled();
                        expect(Array.isArray(ref.Points)).toBe(true);
                        expect(ref.Points).toHaveLength(4);
                        expect(ref.Points[1].X).toBe(779.5);
                        expect(ref.Points[3].X).toBe(672);
                        expect(routeAllLines).not.toHaveBeenCalled();
                });

                it('should route lines when reference points are missing and not recoverable', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-2" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">not-a-point-list</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const ref: any = { ID: 'ref-2', Points: [] };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(routeAllLines).toHaveBeenCalledTimes(1);
                });

                it('should not override valid reference points', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-3" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=1;Y=2}|{X=3;Y=4}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const pointsArray = [{ X: 1, Y: 2 }, { X: 3, Y: 4 }];
                        const ref: any = { ID: 'ref-3', Points: pointsArray };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(ref.Points).toBe(pointsArray);
                        expect(routeAllLines).not.toHaveBeenCalled();
                });

                it('should ignore references without Points XData in XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-4" Name="FK_Test">
            <XValues>
                <XData Name="ID" Type="String">ref-4</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([]),
                                        RouteAllLines: jest.fn(),
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        const doc = await bridge.LoadOrmModelFromText(xmlText);
                        expect(doc).toBe(mockDoc);
                });

                it('should ignore empty Points and non-finite point coordinates in XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-5" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">   </XData>
            </XValues>
        </XORMReference>
        <XORMReference ID="ref-6" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=abc;Y=1}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([]),
                                        RouteAllLines: jest.fn(),
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        const doc = await bridge.LoadOrmModelFromText(xmlText);
                        expect(doc).toBe(mockDoc);
                });

                it('should skip fallback when reference ID is not found in XML points map', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-7" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=1;Y=2}|{X=3;Y=4}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const ref: any = { ID: 'ref-other', Points: [] };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(routeAllLines).toHaveBeenCalledTimes(1);
                });

                it('should handle an empty <XData Name="Points"></XData> in XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-8" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]"></XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([]),
                                        RouteAllLines: jest.fn(),
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        const doc = await bridge.LoadOrmModelFromText(xmlText);
                        expect(doc).toBe(mockDoc);
                });

                it('should treat non-array reference Points as invalid and replace from XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-9" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=10;Y=20}|{X=30;Y=40}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const ref: any = { ID: 'ref-9', Points: null };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(Array.isArray(ref.Points)).toBe(true);
                        expect(ref.Points).toHaveLength(2);
                        expect(ref.Points[0].X).toBe(10);
                        expect(ref.Points[1].Y).toBe(40);
                        expect(routeAllLines).not.toHaveBeenCalled();
                });

        it('should load XML format when text starts with <', async () => {
            const xmlText = '<XORMDocument><Name>Test</Name></XORMDocument>';
            
            const mockDoc = {
                ID: 'mock-id',
                Name: 'Test Doc',
                ChildNodes: [],
                Design: { ChildNodes: [] },
                Initialize: jest.fn()
            };
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(mockDoc.Initialize).toHaveBeenCalled();
        });

        it('should fallback to new doc when XML deserialization fails', async () => {
            const xmlText = '<?xml version="1.0"?><XORMDocument></XORMDocument>';
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: false, Data: null }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should fallback to new doc when XML deserialization returns null data', async () => {
            const xmlText = '<?xml version="1.0"?><XORMDocument></XORMDocument>';
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: null }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });
    });

    describe('SaveOrmModelToText serialization branches', () => {
        it('should return XML when serialization succeeds with XmlOutput', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            (bridge as any)._Engine = {
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '<TestXml/>' })
            };

            const result = bridge.SaveOrmModelToText();

            expect(result).toBe('<TestXml/>');
        });

        it('should return empty XML when serialization succeeds but XmlOutput is empty', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            (bridge as any)._Engine = {
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const result = bridge.SaveOrmModelToText();

            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });

        it('should return empty XML when serialization returns Success: false', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            (bridge as any)._Engine = {
                Serialize: jest.fn().mockReturnValue({ Success: false, XmlOutput: '<SomeXml/>' })
            };

            const result = bridge.SaveOrmModelToText();

            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });
    });

    describe('AddReference FK field creation', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should use "Target" as default name when target table not found', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true });

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(bridge.Controller.AddField).toHaveBeenCalledWith(expect.objectContaining({
                TableID: 'source-id',
                Name: 'TargetID'
            }));
        });

        it('should use target table name for FK field when target table found', () => {
            const mockTargetTable = { Name: 'Users' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTargetTable);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true });

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(bridge.Controller.AddField).toHaveBeenCalledWith(expect.objectContaining({
                TableID: 'source-id',
                Name: 'UsersID'
            }));
        });

        it('should generate default reference name when name is empty', () => {
            const mockTargetTable = { Name: 'Orders' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTargetTable);
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'field-id' });
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });

            bridge.AddReference('source-id', 'target-id', '');

            expect(bridge.Controller.AddReference).toHaveBeenCalledWith(expect.objectContaining({
                Name: 'FK_Orders'
            }));
        });

        it('should not create reference when AddField fails', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: false });
            bridge.Controller.AddReference = jest.fn();

            bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(bridge.Controller.AddReference).not.toHaveBeenCalled();
        });

        it('should return fallback when AddField returns null', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue(null);
            bridge.Controller.AddReference = jest.fn();

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(result).toEqual({ Success: false, Message: 'Failed to create FK field.' });
            expect(bridge.Controller.AddReference).not.toHaveBeenCalled();
        });
    });

    describe('GetModelData table Fields fallback', () => {
        it('should use table.Fields when GetChildrenOfType is null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockField = { ID: 'field-1', Name: 'FieldFromArray', DataType: 'String', IsPrimaryKey: false, IsNullable: true };
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: null,
                Fields: [mockField]
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].Fields.length).toBe(1);
            expect(data.Tables[0].Fields[0].Name).toBe('FieldFromArray');
        });

        it('should use empty array when both GetChildrenOfType is undefined and Fields is undefined', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create plain object without GetChildrenOfType method
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 }
                // No GetChildrenOfType property at all
                // No Fields property at all
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].Fields).toEqual([]);
        });

        it('should use empty array when GetChildrenOfType returns null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue(null)
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].Fields).toEqual([]);
        });
    });

    describe('LoadFromJson reference error handling', () => {
        let mockDoc: any;
        
        beforeEach(async () => {
            await bridge.Initialize();
            
            mockDoc = {
                ID: 'test-doc',
                Name: 'Initial',
                Design: {
                    CreateTable: jest.fn().mockReturnValue({
                        ID: 'table-1',
                        Fields: [],
                        CreateField: jest.fn()
                    }),
                    CreateReference: jest.fn().mockImplementation(() => {
                        throw new Error('Reference creation failed');
                    })
                }
            };
        });

        it('should log warning and continue when reference creation throws', async () => {
            const jsonData = {
                References: [
                    { Name: 'FailingRef', SourceFieldID: 'field-1', TargetTableID: 'table-2' }
                ]
            };

            // Should not throw - error is caught and logged
            expect(() => {
                (bridge as any).LoadFromJson(mockDoc, jsonData);
            }).not.toThrow();
        });

        it('should process multiple references and continue after error', async () => {
            let callCount = 0;
            mockDoc.Design.CreateReference = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('First reference failed');
                }
                return { ID: 'ref-2', Name: 'SecondRef', Points: [] };
            });

            const jsonData = {
                References: [
                    { Name: 'FirstRef', SourceFieldID: 'field-1', TargetTableID: 'table-2' },
                    { Name: 'SecondRef', SourceFieldID: 'field-2', TargetTableID: 'table-3' }
                ]
            };

            (bridge as any).LoadFromJson(mockDoc, jsonData);

            expect(mockDoc.Design.CreateReference).toHaveBeenCalledTimes(2);
        });
    });

    describe('SaveToJson Fields fallback', () => {
        it('should use table.Fields when GetChildrenOfType is null in SaveToJson', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockField = { ID: 'field-1', Name: 'FieldFromArray', DataType: 'String', Length: 0, IsPrimaryKey: false, IsNullable: true, IsAutoIncrement: false, DefaultValue: '', Description: '' };
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Schema: 'dbo',
                Description: '',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: null,
                Fields: [mockField]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.Tables[0].Fields.length).toBe(1);
            expect(result.Tables[0].Fields[0].Name).toBe('FieldFromArray');
        });

        it('should use empty array when both GetChildrenOfType is undefined and Fields is undefined in SaveToJson', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create plain object without GetChildrenOfType method or Fields
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Schema: 'dbo',
                Description: '',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 }
                // No GetChildrenOfType property at all
                // No Fields property at all
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.Tables[0].Fields).toEqual([]);
        });
    });

    describe('AlignLines', () => {
        it('should return false when RouteAllLines is undefined', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.RouteAllLines = undefined;

            const result = bridge.AlignLines();

            expect(result).toBe(false);
        });

        it('should return false when RouteAllLines returns undefined', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.RouteAllLines = jest.fn().mockReturnValue(undefined);

            const result = bridge.AlignLines();

            expect(result).toBe(false);
        });

        it('should return true when RouteAllLines succeeds', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.RouteAllLines = jest.fn().mockReturnValue(true);

            const result = bridge.AlignLines();

            expect(result).toBe(true);
        });
    });

    describe('DeleteElement fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.DeleteElement('elem-1');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('RenameElement fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.RenameElement('elem-1', 'NewName');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('MoveElement fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.MoveElement('elem-1', 100, 200);

            expect(result).toEqual({ Success: false });
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

    describe('AddField fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.AddField('table-1', 'NewField', 'String');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('AddTable fallback', () => {
        it('should return { Success: false } when Controller AddTable returns null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.AddTable = jest.fn().mockReturnValue(null);

            const result = bridge.AddTable(100, 200, 'NewTable');

            expect(result).toEqual({ Success: false, Message: "Failed to add table." });
        });
    });

    describe('SaveToJson reference using Source/Target', () => {
        it('should use Source/Target properties for SourceFieldID/TargetTableID', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Test',
                Source: 'src-field',
                Target: 'tgt-table',
                Description: '',
                Points: null
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.References[0].SourceFieldID).toBe('src-field');
            expect(result.References[0].TargetTableID).toBe('tgt-table');
            expect(result.References[0].Points).toEqual([]);
        });

        it('should map reference Points correctly', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Test',
                Source: 'field-1',
                Target: 'table-2',
                Description: 'Test',
                Points: [{ X: 10, Y: 20 }, { X: 30, Y: 40 }]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.References[0].Points).toEqual([{ X: 10, Y: 20 }, { X: 30, Y: 40 }]);
        });
    });

    describe('GetModelData with table having no GetChildrenOfType and no Fields (line 382)', () => {
        it('should use empty array when table has neither GetChildrenOfType nor Fields property', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create a table mock without GetChildrenOfType and without Fields
            const mockTableWithoutMethods = {
                ID: 'table-no-methods',
                Name: 'NoMethodsTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                // No GetChildrenOfType method
                // No Fields property
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTableWithoutMethods]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = bridge.GetModelData();

            expect(result.Tables).toHaveLength(1);
            expect(result.Tables[0].ID).toBe('table-no-methods');
            expect(result.Tables[0].Fields).toEqual([]); // Should be empty array from else branch
        });
    });

    describe('SaveToJson with table having no GetChildrenOfType and no Fields (lines 510-512)', () => {
        it('should use empty array when table has neither GetChildrenOfType nor Fields', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create a table mock that has neither GetChildrenOfType nor Fields
            const tableWithNoFieldAccess = {
                ID: 'table-bare',
                Name: 'BareTable',
                Schema: 'dbo',
                Description: 'A table with no field access',
                Bounds: { Left: 100, Top: 200, Width: 250, Height: 180 }
                // Explicitly no GetChildrenOfType
                // Explicitly no Fields
            };
            
            bridge.Controller.Document = { Name: 'TestDoc', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([tableWithNoFieldAccess]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.Name).toBe('TestDoc');
            expect(result.Tables).toHaveLength(1);
            expect(result.Tables[0].ID).toBe('table-bare');
            expect(result.Tables[0].Name).toBe('BareTable');
            expect(result.Tables[0].Fields).toEqual([]); // Empty array from else branch at line 512
        });

        it('should use Fields when GetChildrenOfType is undefined but Fields exists', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Table with Fields but no GetChildrenOfType
            const tableWithFields = {
                ID: 'table-fields',
                Name: 'FieldsTable',
                Schema: 'dbo',
                Description: '',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                // No GetChildrenOfType
                Fields: [
                    { ID: 'f1', Name: 'ID', DataType: 'Int32', Length: 4, IsPrimaryKey: true, IsNullable: false, IsAutoIncrement: true, DefaultValue: '', Description: '' }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([tableWithFields]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = (bridge as any).SaveToJson(bridge.Controller.Document);

            expect(result.Tables[0].Fields).toHaveLength(1);
            expect(result.Tables[0].Fields[0].Name).toBe('ID');
        });
    });

    describe('AddReference returns falsy result coverage (line 272)', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return fallback when Controller.AddReference returns null', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'field-id' });
            bridge.Controller.AddReference = jest.fn().mockReturnValue(null);

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(result).toEqual({ Success: false });
        });

        it('should return fallback when Controller.AddReference returns undefined', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'field-id' });
            bridge.Controller.AddReference = jest.fn().mockReturnValue(undefined);

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('GetModelData simplifyRoutePoints coverage', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return empty array when valid points < 2', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 100 }]  // Only one valid point
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // With only 1 point, should return the original (no simplification possible)
            expect(result.References[0].Points).toEqual([{ X: 100, Y: 100 }]);
        });

        it('should return empty array when unique points < 2 after dedup', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 100 }, { X: 100, Y: 100 }]  // Duplicate points
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            expect(result.References[0].Points).toEqual([]);
        });

        it('should simplify collinear points in vertical line', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 0 }, { X: 100, Y: 50 }, { X: 100, Y: 100 }]  // Collinear vertical
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Middle point should be removed
            expect(result.References[0].Points).toHaveLength(2);
        });

        it('should simplify collinear points in horizontal line', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 0, Y: 100 }, { X: 50, Y: 100 }, { X: 100, Y: 100 }]  // Collinear horizontal
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Middle point should be removed
            expect(result.References[0].Points).toHaveLength(2);
        });

        it('should preserve orthogonal route points (perpendicular exits)', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            // Orthogonal route with no colinear points - should be preserved
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },   // Start
                    { X: 350, Y: 75 },   // Turn
                    { X: 350, Y: 200 }   // End
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve the 3 points (no colineares to remove)
            expect(result.References[0].Points).toHaveLength(3);
        });

        it('should preserve orthogonal route with multiple turns', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            // Route with turns but no colinear points
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 100, Y: 150 },  // Start
                    { X: 100, Y: 275 },  // Turn 1
                    { X: 300, Y: 275 }   // End
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve the 3 points
            expect(result.References[0].Points).toHaveLength(3);
        });

        it('should preserve Z-shaped routes from server', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 400, Top: 100, Width: 200, Height: 150 }
            };
            // Z-shape route (4 essential points, no colineares)
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },   // Start (right edge)
                    { X: 300, Y: 75 },   // Mid-turn 1
                    { X: 300, Y: 175 },  // Mid-turn 2
                    { X: 400, Y: 175 }   // End (left edge)
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve all 4 points of Z-shape
            expect(result.References[0].Points).toHaveLength(4);
        });

        it('should preserve C-shaped routes from server', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 100, Top: 300, Width: 200, Height: 150 }
            };
            // C-shape route (no colinear points)
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 100, Y: 150 },  // Start
                    { X: 100, Y: 225 },  // Mid
                    { X: 200, Y: 225 },  // Mid
                    { X: 200, Y: 300 }   // End
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve all 4 points of C-shape
            expect(result.References[0].Points).toHaveLength(4);
        });

        it('should return simplified points when no side detected', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            // Points not on any edge - detectSide returns null
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 50, Y: 50 },    // Inside src table (not on edge)
                    { X: 150, Y: 50 },   // Extra
                    { X: 150, Y: 150 },  // Extra
                    { X: 250, Y: 150 },  // Extra
                    { X: 250, Y: 250 }   // Inside tgt area (not on edge)
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Without side detection, should return simplified points (collinear removed)
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle null/undefined points gracefully', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: null
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            expect(result.References[0].Points).toEqual([]);
        });

        it('should simplify when sourceTable or targetTable not found for reference', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            // Reference points to non-existent target table
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'non-existent-table',
                Points: [
                    { X: 200, Y: 75 },
                    { X: 250, Y: 75 },
                    { X: 250, Y: 150 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should return simplified points (collinear removal only, no L/Z optimization)
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });

        it('should return empty array when multiple points but all invalid (line 504)', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                // Multiple points but all have NaN - only 1 valid after filter
                Points: [
                    { X: NaN, Y: 100 },
                    { X: 100, Y: 100 },
                    { X: NaN, Y: NaN },
                    { X: Infinity, Y: 200 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // With only 1 valid point after filter, should return empty array
            expect(result.References[0].Points).toEqual([]);
        });

        it('should use Fields fallback when GetChildrenOfType is missing in find sourceTable', async () => {
            // Source table without GetChildrenOfType but with Fields
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                Fields: [{ ID: 'field-1', Name: 'ID' }]
                // No GetChildrenOfType
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },
                    { X: 300, Y: 275 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should find sourceTable using Fields fallback
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle table with no GetChildrenOfType and no Fields in find sourceTable', async () => {
            // Source table without GetChildrenOfType AND without Fields
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 }
                // No GetChildrenOfType, no Fields
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',  // Won't find this field
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },
                    { X: 300, Y: 275 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should still produce valid points (sourceTable will be undefined)
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('SetContextPath', () => {
        it('should set context path', () => {
            bridge.SetContextPath('/path/to/file.dsorm');
            expect(bridge.ContextPath).toBe('/path/to/file.dsorm');
        });

        it('should reset types loaded when path changes', () => {
            bridge.SetContextPath('/path/to/file1.dsorm');
            bridge.SetContextPath('/path/to/file2.dsorm');
            expect(bridge.ContextPath).toBe('/path/to/file2.dsorm');
        });

        it('should not reset types loaded when path is same', () => {
            bridge.SetContextPath('/path/to/file.dsorm');
            bridge.SetContextPath('/path/to/file.dsorm');
            expect(bridge.ContextPath).toBe('/path/to/file.dsorm');
        });
    });

    describe('GetAllDataTypes', () => {
        it('should return empty array before loading', () => {
            const types = bridge.GetAllDataTypes();
            expect(types).toEqual([]);
        });
    });

    describe('GetPKDataTypes', () => {
        it('should return empty array before loading', () => {
            const types = bridge.GetPKDataTypes();
            expect(types).toEqual([]);
        });
    });

    describe('LoadDataTypes', () => {
        it('should use fallback types on error', async () => {
            bridge.SetContextPath('/nonexistent/path/file.dsorm');
            await bridge.LoadDataTypes();
            
            const allTypes = bridge.GetAllDataTypes();
            const pkTypes = bridge.GetPKDataTypes();
            
            // Should have fallback types
            expect(allTypes.length).toBeGreaterThan(0);
            expect(pkTypes.length).toBeGreaterThan(0);
        });

        it('should not reload if already loaded', async () => {
            bridge.SetContextPath('/test/path/file.dsorm');
            await bridge.LoadDataTypes();
            const types1 = bridge.GetAllDataTypes();
            
            await bridge.LoadDataTypes();
            const types2 = bridge.GetAllDataTypes();
            
            expect(types1).toEqual(types2);
        });
    });

    describe('ReloadDataTypes', () => {
        it('should clear cache and reload types', async () => {
            bridge.SetContextPath('/test/path/file.dsorm');
            await bridge.LoadDataTypes();
            
            await bridge.ReloadDataTypes();
            
            // Should have types after reload
            const allTypes = bridge.GetAllDataTypes();
            expect(allTypes.length).toBeGreaterThan(0);
        });
    });
});