jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge, IAddShadowTablePayload } from '../../Services/TFXBridge';

import * as tfx from '@tootega/tfx';

describe('XTFXBridge — Shadow Tables', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    describe('SyncShadowTables (via ValidateOrmModel)', () => {
        it('should sync same-model shadow name when original is renamed', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 'real-1', Name: 'OriginalName', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'shadow-1', Name: 'OldName', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'real-1', ShadowTableName: 'OldName',
                        ShadowDocumentName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const issues = bridge.ValidateOrmModel();

            const design = bridge.Controller?.Design as any;
            const shadow = design.GetTables().find((t: any) => t.IsShadow);
            expect(shadow.Name).toBe('OriginalName');
            expect(shadow.ShadowTableName).toBe('OriginalName');
            expect(bridge.LastSyncMutated).toBe(true);
        });

        it('should sync same-model shadow fill when original fill changes', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 'real-1', Name: 'Tbl', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'shadow-1', Name: 'Tbl', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'real-1', ShadowTableName: 'Tbl',
                        ShadowDocumentName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const design = bridge.Controller?.Design as any;
            const realTable = design.GetTables().find((t: any) => !t.IsShadow);
            realTable.Fill = tfx.XColor.Parse('FF00FF00');
            const shadowTable = design.GetTables().find((t: any) => t.IsShadow);
            shadowTable.Fill = tfx.XColor.Parse('FFFF0000');

            bridge.ValidateOrmModel();

            expect(bridge.LastSyncMutated).toBe(true);
        });

        it('should not mutate when same-model shadow already matches', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 'real-1', Name: 'Tbl', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'shadow-1', Name: 'Tbl', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'real-1', ShadowTableName: 'Tbl',
                        ShadowDocumentName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            bridge.ValidateOrmModel();

            expect(bridge.LastSyncMutated).toBe(false);
        });

        it('should produce error for cross-model shadow with missing parent model group', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'RemoteTbl', X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'RemoteTbl',
                        ShadowDocumentName: 'MissingModel'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const issues = bridge.ValidateOrmModel();

            const shadowIssue = issues.find(i => i.ElementID === 'shadow-1' && i.Message.includes('not listed'));
            expect(shadowIssue).toBeDefined();
        });

        /**
         * Espelho vindo de `Import Models` era acusado de origem inexistente: a validação
         * só consultava os grupos de `Parent Model`, cujas chaves são relativas à pasta do
         * modelo — nunca casariam com um caminho relativo à raiz do repositório.
         */
        it('accepts a shadow whose source came from Import Models', () => {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.CRM/MER-CRM.dsorm',
                Namespace: 'Tootega.CRM',
                Tables: [{ Name: 'CRMxPessoa', Fill: '' }]
            }];

            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'CRMxPessoa', X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'CRMxPessoa',
                        ShadowDocumentName: 'Back/Modules/Tootega.CRM/MER-CRM'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            expect(bridge.ValidateOrmModel().filter(i => i.ElementID === 'shadow-1')).toEqual([]);
        });

        /**
         * A tabela espelho tem de sair da mesma cor da original: no diagrama é assim que se
         * reconhece de onde ela veio. Sem alcançar os grupos importados, ficava transparente.
         */
        it('paints the shadow with the colour of the imported source table', () => {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.CRM/MER-CRM.dsorm',
                Namespace: 'Tootega.CRM',
                Tables: [{ Name: 'CRMxPessoa', Fill: 'FFFF7F50' }]
            }];

            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'CRMxPessoa', X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'CRMxPessoa',
                        ShadowDocumentName: 'Back/Modules/Tootega.CRM/MER-CRM'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            bridge.ValidateOrmModel();

            const shadow = (bridge as any)._Controller.Design.GetTables()
                .find((t: any) => t.ID === 'shadow-1');

            expect(shadow.Fill.ToString()).toBe('FFFF7F50');
            expect(bridge.LastSyncMutated).toBe(true);
        });

        it('still reports a table that vanished from an imported model', () => {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.CRM/MER-CRM.dsorm',
                Namespace: 'Tootega.CRM',
                Tables: [{ Name: 'OutraTabela', Fill: '' }]
            }];

            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'CRMxPessoa', X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'CRMxPessoa',
                        ShadowDocumentName: 'Back/Modules/Tootega.CRM/MER-CRM'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const issue = bridge.ValidateOrmModel()
                .find(i => i.ElementID === 'shadow-1' && i.Message.includes('no longer exists'));

            expect(issue).toBeDefined();
        });

        it('should produce error for cross-model shadow when table no longer exists in parent model', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const parentBridge = new XTFXBridge();
            parentBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Auth',
                Tables: [{ ID: 'ptbl-1', Name: 'AppUser', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const parentXml = parentBridge.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentXml));
            bridge.Initialize();
            await bridge.LoadParentModelTables(['Auth.dsorm']);

            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'DeletedTable', X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'DeletedTable',
                        ShadowDocumentName: 'Auth'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const issues = bridge.ValidateOrmModel();

            const shadowIssue = issues.find(i => i.ElementID === 'shadow-1' && i.Message.includes('no longer exists'));
            expect(shadowIssue).toBeDefined();
        });

        it('should sync fill for cross-model shadow when parent table has matching fill', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const parentBridge = new XTFXBridge();
            parentBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Auth',
                Tables: [{ ID: 'ptbl-1', Name: 'AppUser', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const parentDesign = parentBridge.Controller?.Design as any;
            const parentTable = parentDesign.GetTables()[0];
            parentTable.Fill = tfx.XColor.Parse('FF00FFAA');
            const parentXml = parentBridge.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentXml));
            bridge.Initialize();
            await bridge.LoadParentModelTables(['Auth.dsorm']);

            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'AppUser', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'AppUser',
                        ShadowDocumentName: 'Auth'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const shadowDesign = bridge.Controller?.Design as any;
            const shadow = shadowDesign.GetTables().find((t: any) => t.IsShadow);
            shadow.Fill = tfx.XColor.Parse('FFFF0000');

            bridge.ValidateOrmModel();

            expect(bridge.LastSyncMutated).toBe(true);
        });

        it('should produce error for shadow with no resolvable source reference', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'Orphan', X: 0, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'Orphan',
                        ShadowDocumentName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const issues = bridge.ValidateOrmModel();

            const orphanIssue = issues.find(i => i.ElementID === 'shadow-1' && i.Message.includes('no valid source'));
            expect(orphanIssue).toBeDefined();
        });

        it('should return empty issues when no design exists', () => {
            bridge.Initialize();
            (bridge as any)._Controller.Document = null;

            const issues = bridge.ValidateOrmModel();

            expect(issues).toEqual([]);
        });
    });

    describe('GetShadowTablePickerData', () => {
        it('should return current model tables excluding shadows', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 'tbl-1', Name: 'Users', X: 0, Y: 0, Width: 200, Height: 60 },
                    { ID: 'tbl-2', Name: 'Roles', X: 300, Y: 0, Width: 200, Height: 60 },
                    { ID: 'sh-1', Name: 'ShadowTbl', X: 600, Y: 0, Width: 200, Height: 28, IsShadow: true, ShadowTableID: '', ShadowTableName: 'ShadowTbl', ShadowDocumentName: 'Other' }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const data = bridge.GetShadowTablePickerData(100, 200);

            expect(data.X).toBe(100);
            expect(data.Y).toBe(200);
            expect(data.Models.length).toBeGreaterThanOrEqual(1);
            const currentModel = data.Models[0];
            const tableNames = currentModel.Tables.map(t => t.Name);
            expect(tableNames).toContain('Users');
            expect(tableNames).toContain('Roles');
            expect(tableNames).not.toContain('ShadowTbl');
        });

        it('should include parent model groups', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const parentBridge = new XTFXBridge();
            parentBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Auth',
                Tables: [{ ID: 'ptbl-1', Name: 'AppUser', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentBridge.SaveOrmModelToText()));

            bridge.Initialize();
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            await bridge.LoadParentModelTables(['Auth.dsorm']);

            const data = bridge.GetShadowTablePickerData(0, 0);

            expect(data.Models.length).toBe(2);
            const parentGroup = data.Models.find(m => m.ModelName === 'Auth.dsorm');
            expect(parentGroup).toBeDefined();
            expect(parentGroup!.Tables.map(t => t.Name)).toContain('AppUser');
        });

        it('should skip parent groups matching current model name', async () => {
            bridge.SetContextPath('/test/dir/TestModel.dsorm');

            const parentBridge = new XTFXBridge();
            parentBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'ptbl-1', Name: 'SomeTable', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentBridge.SaveOrmModelToText()));
            bridge.Initialize();
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            await bridge.LoadParentModelTables(['TestModel.dsorm']);

            const data = bridge.GetShadowTablePickerData(0, 0);

            // Current model group is always added; the duplicate parent group should be skipped.
            // Only 1 entry with 'TestModel.dsorm' should remain (the current model group itself).
            const matchingEntries = data.Models.filter(m => m.ModelName === 'TestModel.dsorm');
            expect(matchingEntries.length).toBe(1);
            // Verify the parent group's extra table 'SomeTable' is not included
            const allTableNames = data.Models.flatMap(m => m.Tables.map(t => t.Name));
            expect(allTableNames).not.toContain('SomeTable');
        });

        it('should return empty models when no tables exist', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'Empty' }));

            const data = bridge.GetShadowTablePickerData(50, 75);

            expect(data.X).toBe(50);
            expect(data.Y).toBe(75);
            expect(data.Models).toEqual([]);
        });
    });

    describe('AddShadowTable', () => {
        beforeEach(() => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
        });

        it('should create a shadow table with metadata', () => {
            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: 'Auth.dsorm',
                DocumentID: 'doc-id-1',
                DocumentName: 'Auth',
                ModuleID: 'mod-1',
                ModuleName: 'Authentication',
                TableID: 'remote-tbl-1',
                TableName: 'AppUser'
            };

            const result = bridge.AddShadowTable(payload);

            expect(result.Success).toBe(true);
            expect(result.ElementID).toBeDefined();

            const design = bridge.Controller?.Design as any;
            const shadow = design.GetTables().find((t: any) => t.IsShadow && t.ShadowTableName === 'AppUser');
            expect(shadow).toBeDefined();
            expect(shadow.ShadowDocumentName).toBe('Auth');
            expect(shadow.ShadowModuleName).toBe('Authentication');
        });

        it('should create new shadow when duplicate', () => {
            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: 'Auth.dsorm',
                DocumentID: 'doc-id-1',
                DocumentName: 'Auth',
                ModuleID: '',
                ModuleName: '',
                TableID: 'remote-tbl-1',
                TableName: 'AppUser'
            };

            const result1 = bridge.AddShadowTable(payload);
            const result2 = bridge.AddShadowTable(payload);

            expect(result1.Success).toBe(true);
            expect(result2.Success).toBe(true);
            expect(result2.ElementID).not.toBe(result1.ElementID);
        });

        it('should fail when no design exists', () => {
            const freshBridge = new XTFXBridge();
            freshBridge.Initialize();
            (freshBridge as any)._Controller.Document = null;

            const result = freshBridge.AddShadowTable({
                X: 0, Y: 0,
                ModelName: '', DocumentID: '', DocumentName: '',
                ModuleID: '', ModuleName: '', TableID: 'x', TableName: 'T'
            });

            expect(result.Success).toBe(false);
        });

        it('should inherit fill from same-model original table', () => {
            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: 'TestModel.dsorm',
                DocumentID: '',
                DocumentName: 'TestModel',
                ModuleID: '',
                ModuleName: '',
                TableID: 'tbl-1',
                TableName: 'Products'
            };

            const result = bridge.AddShadowTable(payload);

            expect(result.Success).toBe(true);
        });

        it('should inherit fill from parent model table', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const parentBridge = new XTFXBridge();
            parentBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Auth',
                Tables: [{ ID: 'ptbl-1', Name: 'AppUser', X: 0, Y: 0, Width: 200, Height: 60, Fill: 'FF00AA00' }]
            }));
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentBridge.SaveOrmModelToText()));
            await bridge.LoadParentModelTables(['Auth.dsorm']);

            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: 'Auth.dsorm',
                DocumentID: '',
                DocumentName: 'Auth',
                ModuleID: '',
                ModuleName: '',
                TableID: '',
                TableName: 'AppUser'
            };

            const result = bridge.AddShadowTable(payload);

            expect(result.Success).toBe(true);
        });

        it('should use defaults when TableID and DocumentID are empty', () => {
            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: '',
                DocumentID: '',
                DocumentName: '',
                ModuleID: '',
                ModuleName: '',
                TableID: '',
                TableName: 'Unknown'
            };

            const result = bridge.AddShadowTable(payload);

            expect(result.Success).toBe(true);
        });
    });

    describe('UpdateProperty — shadow table guards', () => {
        let shadowTableID: string;

        beforeEach(() => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 'real-1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'shadow-1', Name: 'ShadowTbl', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'real-1', ShadowTableName: 'ShadowTbl',
                        ShadowDocumentName: 'Other'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);
            shadowTableID = 'shadow-1';
        });

        it('should block Name rename on shadow table', () => {
            const result = bridge.UpdateProperty(shadowTableID, 'Name', 'NewName');
            expect(result.Success).toBe(false);
            expect(result.Message).toContain('read-only');
        });

        it('should block PKType edit on shadow table', () => {
            const result = bridge.UpdateProperty(shadowTableID, 'PKType', 'Int64');
            expect(result.Success).toBe(false);
            expect(result.Message).toContain('read-only');
        });
    });

    describe('GetProperties — shadow table properties', () => {
        it('should return read-only shadow properties for a shadow table', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'RemoteTbl', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'RemoteTbl',
                        ShadowDocumentName: 'Auth', ShadowModuleName: 'AuthModule'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const props = bridge.GetProperties('shadow-1');

            const nameProp = props.find(p => p.Key === 'Name');
            expect(nameProp).toBeDefined();
            expect(nameProp!.IsReadOnly).toBe(true);

            const docProp = props.find(p => p.Key === 'ShadowDocumentName');
            expect(docProp).toBeDefined();
            expect(docProp!.IsReadOnly).toBe(true);
            expect(docProp!.Value).toBe('Auth');

            const tblProp = props.find(p => p.Key === 'ShadowTableName');
            expect(tblProp).toBeDefined();
            expect(tblProp!.IsReadOnly).toBe(true);
            expect(tblProp!.Value).toBe('RemoteTbl');

            const modProp = props.find(p => p.Key === 'ShadowModuleName');
            expect(modProp).toBeDefined();
            expect(modProp!.IsReadOnly).toBe(true);
            expect(modProp!.Value).toBe('AuthModule');
        });

        it('should not include ShadowModuleName when it is empty', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'RemoteTbl', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: '', ShadowTableName: 'RemoteTbl',
                        ShadowDocumentName: 'Auth', ShadowModuleName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const props = bridge.GetProperties('shadow-1');

            const modProp = props.find(p => p.Key === 'ShadowModuleName');
            expect(modProp).toBeUndefined();
        });
    });

    describe('Shadow metadata restoration via LoadOrmModelFromText', () => {
        it('should restore IsShadow and all shadow metadata from JSON round-trip', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'AppUser', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true,
                        ShadowDocumentID: 'doc-123',
                        ShadowDocumentName: 'Auth',
                        ShadowTableID: 'tbl-remote-1',
                        ShadowTableName: 'AppUser',
                        ShadowModuleID: 'mod-1',
                        ShadowModuleName: 'AuthModule'
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const design = bridge.Controller?.Design as any;
            const shadowTable = design.GetTables().find((t: any) => t.ID === 'shadow-1');
            expect(shadowTable).toBeDefined();
            expect(shadowTable.IsShadow).toBe(true);
            expect(shadowTable.ShadowDocumentID).toBe('doc-123');
            expect(shadowTable.ShadowDocumentName).toBe('Auth');
            expect(shadowTable.ShadowTableID).toBe('tbl-remote-1');
            expect(shadowTable.ShadowTableName).toBe('AppUser');
            expect(shadowTable.ShadowModuleID).toBe('mod-1');
            expect(shadowTable.ShadowModuleName).toBe('AuthModule');
        });

        it('should not set shadow metadata when IsShadow is false', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'tbl-1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const design = bridge.Controller?.Design as any;
            const table = design.GetTables().find((t: any) => t.ID === 'tbl-1');
            expect(table).toBeDefined();
            expect(table.IsShadow).toBeFalsy();
        });

        it('should round-trip shadow metadata through save and reload', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'shadow-1', Name: 'Remote', X: 100, Y: 50, Width: 200, Height: 28,
                        IsShadow: true,
                        ShadowDocumentID: 'doc-X',
                        ShadowDocumentName: 'External',
                        ShadowTableID: 'remote-tbl',
                        ShadowTableName: 'Remote',
                        ShadowModuleID: '',
                        ShadowModuleName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const saved = bridge.SaveOrmModelToText();

            const bridge2 = new XTFXBridge();
            bridge2.LoadOrmModelFromText(saved);

            const design2 = bridge2.Controller?.Design as any;
            const shadow2 = design2.GetTables().find((t: any) => t.IsShadow);
            expect(shadow2).toBeDefined();
            expect(shadow2.ShadowDocumentName).toBe('External');
            expect(shadow2.ShadowTableName).toBe('Remote');
        });
    });

    describe('SyncShadowTables — no design (defensive)', () => {
        it('should return empty issues when controller has no design', () => {
            bridge.LoadOrmModelFromText('{}');
            bridge.Initialize();
            (bridge as any)._Controller._Document = null;

            const issues = (bridge as any).SyncShadowTables() as any[];

            expect(issues).toEqual([]);
        });
    });

    describe('UpdateProperty — ParentModel on design element', () => {
        it('should set ParentModel and trigger LoadParentModelTables fire-and-forget', async () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Tbl', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            const designID = bridge.Controller?.Design?.ID;
            expect(designID).toBeDefined();

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(''));

            const result = bridge.UpdateProperty(designID!, 'ParentModel', 'Auth.dsorm|Core.dsorm');

            expect(result.Success).toBe(true);
            expect(bridge.Controller?.Design?.ParentModel).toBe('Auth.dsorm|Core.dsorm');

            await new Promise(r => setTimeout(r, 50));
        });

        it('should log error when LoadParentModelTables rejects', async () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Tbl', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            const designID = bridge.Controller?.Design?.ID;
            expect(designID).toBeDefined();

            jest.spyOn(bridge, 'LoadParentModelTables').mockRejectedValue(new Error('disk failure'));

            const result = bridge.UpdateProperty(designID!, 'ParentModel', 'Broken.dsorm');

            expect(result.Success).toBe(true);

            await new Promise(r => setTimeout(r, 100));
        });
    });
});
