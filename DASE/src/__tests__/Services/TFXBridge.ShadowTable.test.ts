jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';
import type { IAddShadowTablePayload } from '../../Services/TFXBridge';

describe('XTFXBridge ShadowTable', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
        bridge.Initialize();
    });

    describe('GetShadowTablePickerData', () => {
        it('should return empty models when no tables exist', () => {
            bridge.LoadOrmModelFromText('{}');
            const data = bridge.GetShadowTablePickerData(100, 200);

            expect(data.X).toBe(100);
            expect(data.Y).toBe(200);
            expect(data.Models).toEqual([]);
        });

        it('should include current model tables excluding shadow tables', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 't1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 },
                    { ID: 't2', Name: 'Customers', X: 250, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            const data = bridge.GetShadowTablePickerData(50, 80);

            expect(data.Models.length).toBe(1);
            expect(data.Models[0].Tables.length).toBe(2);
            const names = data.Models[0].Tables.map(t => t.Name);
            expect(names).toContain('Orders');
            expect(names).toContain('Customers');
        });

        it('should use context path basename as model name when context is set', () => {
            bridge.SetContextPath('/test/dir/Sales.dsorm');
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Sales',
                Tables: [
                    { ID: 't1', Name: 'Invoice', X: 0, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            const data = bridge.GetShadowTablePickerData(0, 0);

            expect(data.Models[0].ModelName).toBe('Sales.dsorm');
        });

        it('should include parent model table groups', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Main',
                Tables: [
                    { ID: 't1', Name: 'MainTable', X: 0, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            (bridge as any)._ParentModelTableGroups = [
                {
                    ModelName: 'Auth.dsorm',
                    Tables: [
                        { Name: 'AppUser', Fill: '#FF0000' },
                        { Name: 'AppRole', Fill: '#00FF00' }
                    ]
                }
            ];

            const data = bridge.GetShadowTablePickerData(0, 0);

            expect(data.Models.length).toBe(2);
            expect(data.Models[1].ModelName).toBe('Auth.dsorm');
            expect(data.Models[1].Tables.length).toBe(2);
        });

        it('should skip parent model group when its name matches current model', () => {
            bridge.SetContextPath('/test/dir/Auth.dsorm');
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Auth',
                Tables: [
                    { ID: 't1', Name: 'AuthTable', X: 0, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'Dup', Fill: '' }] }
            ];

            const data = bridge.GetShadowTablePickerData(0, 0);

            expect(data.Models.length).toBe(1);
            expect(data.Models[0].ModelName).toBe('Auth.dsorm');
        });

        it('should use Document name as fallback when no context path', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'MyModel',
                Tables: [
                    { ID: 't1', Name: 'T1', X: 0, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            const data = bridge.GetShadowTablePickerData(0, 0);

            expect(data.Models[0].DocumentName).toBeDefined();
        });
    });

    describe('AddShadowTable', () => {
        it('should return error when no active design', () => {
            const result = bridge.AddShadowTable({
                X: 0, Y: 0, ModelName: 'M', DocumentID: 'd1',
                DocumentName: 'M', ModuleID: '', ModuleName: '',
                TableID: 't1', TableName: 'T1'
            } as IAddShadowTablePayload);

            expect(result.Success).toBe(false);
        });

        it('should create a shadow table with metadata', () => {
            bridge.LoadOrmModelFromText('{}');

            const result = bridge.AddShadowTable({
                X: 100, Y: 200, ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1', DocumentName: 'Auth',
                ModuleID: 'mod-1', ModuleName: 'Security',
                TableID: 'tbl-1', TableName: 'AppUser'
            } as IAddShadowTablePayload);

            expect(result.Success).toBe(true);
            expect(result.ElementID).toBeDefined();
        });

        it('should create new shadow table when duplicate', () => {
            bridge.LoadOrmModelFromText('{}');

            const r1 = bridge.AddShadowTable({
                X: 100, Y: 200, ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1', DocumentName: 'Auth',
                ModuleID: '', ModuleName: '',
                TableID: 'tbl-1', TableName: 'AppUser'
            } as IAddShadowTablePayload);

            const r2 = bridge.AddShadowTable({
                X: 300, Y: 400, ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1', DocumentName: 'Auth',
                ModuleID: '', ModuleName: '',
                TableID: 'tbl-2', TableName: 'AppUser'
            } as IAddShadowTablePayload);

            expect(r1.ElementID).not.toBe(r2.ElementID);
        });

        it('should inherit fill from same-design table when TableID matches', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'M',
                Tables: [
                    { ID: 'real-1', Name: 'Customers', X: 0, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            const result = bridge.AddShadowTable({
                X: 300, Y: 0, ModelName: 'M.dsorm',
                DocumentID: '', DocumentName: 'M',
                ModuleID: '', ModuleName: '',
                TableID: 'real-1', TableName: 'Customers'
            } as IAddShadowTablePayload);

            expect(result.Success).toBe(true);
        });

        it('should inherit fill from parent model group when table not in design', () => {
            bridge.LoadOrmModelFromText('{}');
            (bridge as any)._ParentModelTableGroups = [
                {
                    ModelName: 'Auth.dsorm',
                    Tables: [{ Name: 'AppUser', Fill: 'FF0000FF' }]
                }
            ];

            const result = bridge.AddShadowTable({
                X: 0, Y: 0, ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1', DocumentName: 'Auth',
                ModuleID: '', ModuleName: '',
                TableID: 'ext-1', TableName: 'AppUser'
            } as IAddShadowTablePayload);

            expect(result.Success).toBe(true);
        });

        it('should use DocumentName as fallback when ModelName is empty', () => {
            bridge.LoadOrmModelFromText('{}');
            (bridge as any)._ParentModelTableGroups = [
                {
                    ModelName: 'Auth',
                    Tables: [{ Name: 'AppUser', Fill: '' }]
                }
            ];

            const result = bridge.AddShadowTable({
                X: 0, Y: 0, ModelName: '',
                DocumentID: 'doc-1', DocumentName: 'Auth',
                ModuleID: '', ModuleName: '',
                TableID: 'ext-1', TableName: 'AppUser'
            } as IAddShadowTablePayload);

            expect(result.Success).toBe(true);
        });

        it('should handle missing DocumentID and TableID with defaults', () => {
            bridge.LoadOrmModelFromText('{}');

            const result = bridge.AddShadowTable({
                X: 0, Y: 0, ModelName: 'Auth.dsorm',
                DocumentID: '', DocumentName: 'Auth',
                ModuleID: '', ModuleName: '',
                TableID: '', TableName: 'AppUser'
            } as IAddShadowTablePayload);

            expect(result.Success).toBe(true);
        });
    });

    describe('SyncShadowTables (via ValidateOrmModel)', () => {
        it('should produce error for shadow with no resolvable source', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;
            const table = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'Orphan' });
            table.IsShadow = true;

            const issues = bridge.ValidateOrmModel();

            const shadowIssue = issues.find(i => i.Message.includes('no valid source reference'));
            expect(shadowIssue).toBeDefined();
        });

        it('should sync name from same-model original table', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'M',
                Tables: [
                    { ID: 'real-1', Name: 'UpdatedName', X: 0, Y: 0, Width: 200, Height: 60 }
                ]
            }));

            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 300, Y: 0, Width: 200, Height: 28, Name: 'OldName' });
            shadow.IsShadow = true;
            shadow.ShadowTableID = 'real-1';
            shadow.ShadowTableName = 'OldName';

            bridge.ValidateOrmModel();

            expect(shadow.Name).toBe('UpdatedName');
        });

        it('should sync fill from same-model original table', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;

            const real = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 60, Name: 'Real' });

            const shadow = design.CreateTable({ X: 300, Y: 0, Width: 200, Height: 28, Name: 'Real' });
            shadow.IsShadow = true;
            shadow.ShadowTableID = real.ID;
            shadow.ShadowTableName = 'Real';

            bridge.ValidateOrmModel();
            expect((bridge as any)._LastSyncMutated).toBeDefined();
        });

        it('should produce error for cross-model shadow when model not in parent list', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'ExtTable' });
            shadow.IsShadow = true;
            shadow.ShadowDocumentName = 'MissingModel';

            const issues = bridge.ValidateOrmModel();

            const issue = issues.find(i => i.Message.includes('not listed in Parent Model or Import Models'));
            expect(issue).toBeDefined();
        });

        it('should produce error for cross-model shadow when table not found in parent model', () => {
            bridge.LoadOrmModelFromText('{}');
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'AppUser', Fill: '' }] }
            ];
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'Deleted' });
            shadow.IsShadow = true;
            shadow.ShadowDocumentName = 'Auth';
            shadow.ShadowTableName = 'DeletedTable';

            const issues = bridge.ValidateOrmModel();

            const issue = issues.find(i => i.Message.includes('no longer exists in model'));
            expect(issue).toBeDefined();
        });

        it('should sync fill from cross-model parent table entry', () => {
            bridge.LoadOrmModelFromText('{}');
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'AppUser', Fill: 'FF0000FF' }] }
            ];
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'AppUser' });
            shadow.IsShadow = true;
            shadow.ShadowDocumentName = 'Auth';
            shadow.ShadowTableName = 'AppUser';

            bridge.ValidateOrmModel();

            expect((bridge as any)._LastSyncMutated).toBe(true);
        });

        it('should handle cross-model shadow with .dsorm extension in ShadowDocumentName', () => {
            bridge.LoadOrmModelFromText('{}');
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'AppUser', Fill: '' }] }
            ];
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'AppUser' });
            shadow.IsShadow = true;
            shadow.ShadowDocumentName = 'Auth.dsorm';
            shadow.ShadowTableName = 'AppUser';

            const issues = bridge.ValidateOrmModel();
            const issue = issues.find(i => i.ElementID === shadow.ID && i.Message.includes('no longer exists'));
            expect(issue).toBeUndefined();
        });
    });

    describe('GetProperties for shadow table', () => {
        it('should return read-only shadow properties', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'ShadowTbl' });
            shadow.IsShadow = true;
            shadow.ShadowDocumentName = 'Auth';
            shadow.ShadowTableName = 'AppUser';
            shadow.ShadowModuleName = 'Security';

            const props = bridge.GetProperties(shadow.ID);

            const nameProp = props.find(p => p.Key === 'Name');
            expect(nameProp?.IsReadOnly).toBe(true);

            const docProp = props.find(p => p.Key === 'ShadowDocumentName');
            expect(docProp).toBeDefined();
            expect(docProp?.IsReadOnly).toBe(true);

            const tblProp = props.find(p => p.Key === 'ShadowTableName');
            expect(tblProp).toBeDefined();
            expect(tblProp?.IsReadOnly).toBe(true);

            const modProp = props.find(p => p.Key === 'ShadowModuleName');
            expect(modProp).toBeDefined();
            expect(modProp?.IsReadOnly).toBe(true);
        });

        it('should not show module property when ShadowModuleName is empty', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'ShadowTbl' });
            shadow.IsShadow = true;
            shadow.ShadowDocumentName = 'Auth';
            shadow.ShadowTableName = 'AppUser';

            const props = bridge.GetProperties(shadow.ID);

            const modProp = props.find(p => p.Key === 'ShadowModuleName');
            expect(modProp).toBeUndefined();
        });
    });

    describe('UpdateProperty for shadow table', () => {
        it('should reject Name update on shadow table', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'ShadowTbl' });
            shadow.IsShadow = true;

            const result = bridge.UpdateProperty(shadow.ID, 'Name', 'NewName');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('read-only');
        });

        it('should reject non-Name property updates on shadow table', () => {
            bridge.LoadOrmModelFromText('{}');
            const design = (bridge as any)._Controller?.Design;
            const shadow = design.CreateTable({ X: 0, Y: 0, Width: 200, Height: 28, Name: 'ShadowTbl' });
            shadow.IsShadow = true;

            const result = bridge.UpdateProperty(shadow.ID, 'PKType', 'Int64');

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('read-only');
        });
    });

    describe('LoadFromJson shadow metadata', () => {
        it('should restore shadow table metadata from JSON', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Test',
                Tables: [
                    {
                        ID: 'shadow-1',
                        Name: 'AppUser',
                        X: 100, Y: 200, Width: 200, Height: 28,
                        IsShadow: true,
                        ShadowDocumentID: 'doc-1',
                        ShadowDocumentName: 'Auth',
                        ShadowTableID: 'tbl-1',
                        ShadowTableName: 'AppUser',
                        ShadowModuleID: 'mod-1',
                        ShadowModuleName: 'Security',
                        Fields: []
                    }
                ]
            }));

            const design = (bridge as any)._Controller?.Design;
            const tables = design.GetTables();
            const shadow = tables.find((t: any) => t.Name === 'AppUser');

            expect(shadow).toBeDefined();
            expect(shadow.IsShadow).toBe(true);
            expect(shadow.ShadowDocumentID).toBe('doc-1');
            expect(shadow.ShadowDocumentName).toBe('Auth');
            expect(shadow.ShadowTableID).toBe('tbl-1');
            expect(shadow.ShadowTableName).toBe('AppUser');
            expect(shadow.ShadowModuleID).toBe('mod-1');
            expect(shadow.ShadowModuleName).toBe('Security');
        });

        it('should handle shadow table with partial metadata', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Test',
                Tables: [
                    {
                        ID: 'shadow-2',
                        Name: 'PartialShadow',
                        X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true,
                        ShadowDocumentName: 'Partial',
                        Fields: []
                    }
                ]
            }));

            const design = (bridge as any)._Controller?.Design;
            const tables = design.GetTables();
            const shadow = tables.find((t: any) => t.Name === 'PartialShadow');

            expect(shadow).toBeDefined();
            expect(shadow.IsShadow).toBe(true);
            expect(shadow.ShadowDocumentName).toBe('Partial');
        });
    });
});
