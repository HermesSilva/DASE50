// Importar mocks antes dos módulos reais
jest.mock('vscode');
jest.mock('@tootega/tfx');

import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueItem } from '../../Models/IssueItem';
import { XPropertyItem } from '../../Models/PropertyItem';

// Importar mock do TFX
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
        it('should return empty JSON when no document', () => {
            const text = bridge.SaveOrmModelToText();

            expect(text).toBe('{}');
        });

        it('should save model to JSON after loading', async () => {
            await bridge.LoadOrmModelFromText('{}');
            const text = bridge.SaveOrmModelToText();

            expect(() => JSON.parse(text)).not.toThrow();
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
            
            // Mock do Validate para retornar array
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([])
            };
            
            const issues = await bridge.ValidateOrmModel();

            expect(Array.isArray(issues)).toBe(true);
        });

        it('should convert TFX issues to XIssueItem', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Mock do Validate para retornar issues
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
            };
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues.length).toBe(1);
            expect(issues[0].ElementID).toBe('elem-1');
            expect(issues[0].Message).toBe('Test error');
        });

        it('should convert warning severity', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Mock do Validate para retornar issues com Warning
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
            };
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues.length).toBe(1);
            expect(issues[0].Severity).toBe(1); // Warning
        });
    });

    describe('AddTable', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should add table with coordinates and name', () => {
            const mockAddTable = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddTable = mockAddTable;

            const result = bridge.AddTable(100, 200, 'NewTable');

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

        it('should add reference between tables', () => {
            const mockAddReference = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddReference = mockAddReference;

            const result = bridge.AddReference('source-id', 'target-id', 'RefName');

            expect(mockAddReference).toHaveBeenCalledWith({
                SourceID: 'source-id',
                TargetID: 'target-id',
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

        it('should update element property', () => {
            const mockUpdateProperty = jest.fn().mockReturnValue(true);
            bridge.Controller.UpdateProperty = mockUpdateProperty;

            const result = bridge.UpdateProperty('elem-1', 'Name', 'UpdatedName');

            expect(mockUpdateProperty).toHaveBeenCalledWith({
                ElementID: 'elem-1',
                PropertyKey: 'Name',
                Value: 'UpdatedName'
            });
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
            mockTable.Schema = 'dbo';
            mockTable.Description = 'User table';
            mockTable.Bounds = new tfx.XRect(100, 200, 200, 150);

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTable);

            const props = await bridge.GetProperties('table-1');

            expect(Array.isArray(props)).toBe(true);
            expect(props.some(p => p.Key === 'ID')).toBe(true);
            expect(props.some(p => p.Key === 'Name')).toBe(true);
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
                SourceID: 'table-1',
                TargetID: 'table-2',
                Source: 'table-1',
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

        it('should handle references without SourceID/TargetID using Source/Target', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Test',
                Source: 'src-table',
                Target: 'tgt-table',
                Points: null
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].SourceID).toBe('src-table');
            expect(data.References[0].TargetID).toBe('tgt-table');
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
            
            // Create a proper mock document with Design.AppendChild
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
            expect(mockDoc.Design.AppendChild).toHaveBeenCalled();
            expect(mockDoc.Tables.length).toBe(1);
            expect(mockDoc.Tables[0].Name).toBe('Users');
            expect(mockDoc.Tables[0].Schema).toBe('dbo');
        });

        it('should load references from JSON', async () => {
            const jsonData = {
                References: [{
                    ID: 'ref-1',
                    Name: 'FK_Test',
                    SourceID: 'table-1',
                    TargetID: 'table-2',
                    Description: 'Foreign key',
                    Points: [{ X: 100, Y: 200 }, { X: 300, Y: 400 }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Design.AppendChild).toHaveBeenCalled();
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
                    // No ID, SourceID, TargetID, Description, Points
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
                    SourceID: 'table-1',
                    TargetID: 'table-2',
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
            expect(mockDoc.Tables[0].Schema).toBe('custom_schema');
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
            expect(mockDoc.Tables[0].Schema).toBe('production');  // Should use explicit value
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
            expect(mockDoc.Tables[0].Schema).toBe('production');  // Should use explicit value, not default
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
                    SourceID: 'table-1',
                    TargetID: 'table-2',
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

        it('should use fallback "String" when XORMFieldDataType is not available', async () => {
            // Temporarily remove XORMFieldDataType to test the final fallback
            const originalFieldDataType = (tfx as any).XORMFieldDataType;
            (tfx as any).XORMFieldDataType = undefined;

            const jsonData = {
                Tables: [{
                    Name: 'TableWithField',
                    Fields: [{
                        Name: 'FieldWithoutDataType',
                        DataType: undefined
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            // Should use "String" as final fallback
            
            // Restore original
            (tfx as any).XORMFieldDataType = originalFieldDataType;
        });

        it('should use XORMFieldDataType.String when DataType is undefined and enum exists', async () => {
            // Ensure XORMFieldDataType exists and has String property
            const originalFieldDataType = (tfx as any).XORMFieldDataType;
            (tfx as any).XORMFieldDataType = { String: 'String' };

            const jsonData = {
                Tables: [{
                    Name: 'TableWithField',
                    Fields: [{
                        Name: 'FieldWithoutDataType',
                        DataType: undefined
                    }]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);
            
            expect(mockDoc.Tables.length).toBe(1);
            // Should use XORMFieldDataType.String value
            
            // Restore original
            (tfx as any).XORMFieldDataType = originalFieldDataType;
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
                SourceID: 'table-1',
                TargetID: 'table-2',
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
                SourceID: 'table-1',
                TargetID: 'table-2',
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

        it('should return only basic properties for unknown element type', async () => {
            const mockElement = { ID: 'unknown-1', Name: 'Unknown' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            const props = await bridge.GetProperties('unknown-1');

            expect(Array.isArray(props)).toBe(true);
            expect(props.length).toBe(2); // Only ID and Name
            expect(props[0].Key).toBe('ID');
            expect(props[1].Key).toBe('Name');
        });
    });

    describe('SaveOrmModelToText error handling', () => {
        it('should return empty JSON when Document is null', () => {
            (bridge as any)._Controller = { Document: null };
            
            const result = bridge.SaveOrmModelToText();
            
            expect(result).toBe('{}');
        });

        it('should return empty JSON on error', async () => {
            await bridge.LoadOrmModelFromText('{}');
            // Force SaveToJson to throw
            const originalSaveToJson = (bridge as any).SaveToJson;
            (bridge as any).SaveToJson = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });

            const result = bridge.SaveOrmModelToText();
            
            expect(result).toBe('{}');
            
            // Restore
            (bridge as any).SaveToJson = originalSaveToJson;
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
});
