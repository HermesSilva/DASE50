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
                            // PKType é a fonte da verdade do tipo da chave, como em XORMTable:
                            // o campo PK tem o DataType travado e só muda por aqui.
                            _PKType: 'Int32',
                            get PKType(): string { return this._PKType; },
                            set PKType(pValue: string) {
                                this._PKType = pValue;
                                const pk = table.GetPKField();
                                if (pk)
                                    pk.DataType = pValue;
                            },
                            GetPKField: jest.fn(() => {
                                for (const f of table.Fields)
                                {
                                    if (f && f.IsPrimaryKey)
                                        return f;
                                }
                                return null;
                            }),
                            CreatePKField: jest.fn(() => {
                                const existing = table.GetPKField();
                                if (existing)
                                    return existing;

                                const pk: any = {
                                    ID: tfx.XGuid.NewValue(),
                                    Name: 'ID',
                                    DataType: table.PKType,
                                    Length: 0,
                                    IsPrimaryKey: true,
                                    IsRequired: true,
                                    IsAutoIncrement: true,
                                    DefaultValue: '',
                                    Description: ''
                                };
                                table.Fields.splice(0, 0, pk);
                                return pk;
                            }),
                            CreateField: jest.fn((fieldOpts: any) => {
                                const field: any = {
                                    ID: fieldOpts.ID || tfx.XGuid.NewValue(),
                                    Name: fieldOpts.Name || '',
                                    DataType: fieldOpts.DataType || 'String',
                                    Length: fieldOpts.Length || 0,
                                    IsPrimaryKey: fieldOpts.IsPrimaryKey || false,
                                    IsRequired: fieldOpts.IsRequired || false,
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
                        IsRequired: true,
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

        it('should normalize legacy PK DataType Long to Int64 and skip PK during field creation', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [
                        { Name: 'ID', DataType: 'Long', IsPrimaryKey: true },
                        { Name: 'Name', DataType: 'String', IsPrimaryKey: false }
                    ]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);

            const table = mockDoc.Tables[0];
            expect(table.Fields[0].IsPrimaryKey).toBe(true);
            expect(table.Fields[0].DataType).toBe('Int64');
            expect(table.CreateField).toHaveBeenCalledTimes(1);
        });

        it('should ignore unsupported PK DataType values', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [
                        { Name: 'ID', DataType: 'String', IsPrimaryKey: true }
                    ]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);

            const table = mockDoc.Tables[0];
            expect(table.Fields[0].IsPrimaryKey).toBe(true);
            expect(table.Fields[0].DataType).toBe('Int32');
        });

        it('should accept Guid as PK DataType', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [
                        { Name: 'ID', DataType: 'Guid', IsPrimaryKey: true }
                    ]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);

            const table = mockDoc.Tables[0];
            expect(table.Fields[0].IsPrimaryKey).toBe(true);
            expect(table.Fields[0].DataType).toBe('Guid');
        });

        it('should assign ID and Description to non-PK fields when provided', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [
                        { Name: 'ID', DataType: 'Integer', IsPrimaryKey: true },
                        { ID: 'field-99', Name: 'Name', DataType: 'String', IsPrimaryKey: false, Description: 'User name' }
                    ]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);

            const table = mockDoc.Tables[0];

            let nonPKField: any = null;
            for (const f of table.Fields)
            {
                if (f && !f.IsPrimaryKey)
                    nonPKField = f;
            }

            expect(nonPKField).not.toBeNull();
            expect(nonPKField.ID).toBe('field-99');
            expect(nonPKField.Description).toBe('User name');
        });

        it('should reuse existing PK field when table already has one', async () => {
            const existingPK: any = {
                ID: 'existing-pk',
                Name: 'ID',
                DataType: 'Int32',
                IsPrimaryKey: true,
                IsRequired: true,
                IsAutoIncrement: true,
                DefaultValue: '',
                Description: ''
            };

            mockDoc.Tables = [];
            mockDoc.Design.CreateTable = jest.fn((options: any) => {
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
                    Fields: [existingPK],
                    GetPKField: jest.fn(() => existingPK),
                    CreatePKField: jest.fn(() => {
                        throw new Error('CreatePKField should not be called');
                    }),
                    CreateField: jest.fn((fieldOpts: any) => {
                        const field: any = {
                            ID: fieldOpts.ID || tfx.XGuid.NewValue(),
                            Name: fieldOpts.Name || '',
                            DataType: fieldOpts.DataType || 'String',
                            Length: fieldOpts.Length || 0,
                            IsPrimaryKey: false,
                            IsRequired: fieldOpts.IsRequired || false,
                            IsAutoIncrement: fieldOpts.IsAutoIncrement || false,
                            DefaultValue: fieldOpts.DefaultValue || '',
                            Description: ''
                        };
                        table.Fields.push(field);
                        return field;
                    })
                };

                mockDoc.Tables.push(table);
                return table;
            });

            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [
                        { Name: 'NewID', DataType: 'Integer', IsPrimaryKey: true }
                    ]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);

            const table = mockDoc.Tables[0];
            expect(table.CreatePKField).not.toHaveBeenCalled();
            expect(existingPK.Name).toBe('NewID');
            expect(existingPK.DataType).toBe('Int32');
        });

        it('should not change PK Name/DataType when legacy pkData omits them', async () => {
            const jsonData = {
                Tables: [{
                    Name: 'TestTable',
                    Fields: [
                        { IsPrimaryKey: true }
                    ]
                }]
            };

            await (bridge as any).LoadFromJson(mockDoc, jsonData);

            const table = mockDoc.Tables[0];
            expect(table.Fields[0].IsPrimaryKey).toBe(true);
            expect(table.Fields[0].Name).toBe('ID');
            expect(table.Fields[0].DataType).toBe('Int32');
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
                        IsRequired: false,
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
                IsRequired: true,
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
            
            const mockField = { ID: 'field-1', Name: 'FieldFromArray', DataType: 'String', Length: 0, IsPrimaryKey: false, IsRequired: false, IsAutoIncrement: false, DefaultValue: '', Description: '' };
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
                    { ID: 'f1', Name: 'ID', DataType: 'Int32', Length: 4, IsPrimaryKey: true, IsRequired: true, IsAutoIncrement: true, DefaultValue: '', Description: '' }
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

});
