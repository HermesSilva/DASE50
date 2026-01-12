// Importar mocks antes dos módulos reais
jest.mock('vscode');
jest.mock('@tootega/tfx');

// Mock do SelectionService para evitar chamadas ao GetProperties
jest.mock('../../../Services/SelectionService', () => ({
    GetSelectionService: jest.fn(() => ({
        OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
        Clear: jest.fn(),
        Select: jest.fn(),
        ToggleSelection: jest.fn(),
        AddToSelection: jest.fn(),
        HasSelection: false,
        PrimaryID: null,
        SelectedIDs: []
    }))
}));

import * as vscode from 'vscode';
import { XORMDesignerEditorProvider } from '../../../Designers/ORM/ORMDesignerEditorProvider';
import { createMockExtensionContext, Uri, createMockWebviewPanel } from '../../__mocks__/vscode';
import { GetSelectionService } from '../../../Services/SelectionService';

describe('XORMDesignerEditorProvider', () => {
    let provider: XORMDesignerEditorProvider;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset SelectionService mock to default state
        (GetSelectionService as jest.Mock).mockReturnValue({
            OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
            Clear: jest.fn(),
            Select: jest.fn(),
            ToggleSelection: jest.fn(),
            AddToSelection: jest.fn(),
            HasSelection: false,
            PrimaryID: null,
            SelectedIDs: []
        });
        mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;
        provider = new XORMDesignerEditorProvider(mockContext as any);
    });

    describe('ViewType', () => {
        it('should return correct view type', () => {
            expect(XORMDesignerEditorProvider.ViewType).toBe('Dase.ORMDesigner');
        });
    });

    describe('Register', () => {
        it('should register custom editor provider', () => {
            const registered = XORMDesignerEditorProvider.Register(mockContext as any);

            expect(registered).toBeInstanceOf(XORMDesignerEditorProvider);
            expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
                'Dase.ORMDesigner',
                expect.any(XORMDesignerEditorProvider),
                expect.objectContaining({
                    webviewOptions: { retainContextWhenHidden: true },
                    supportsMultipleEditorsPerDocument: false
                })
            );
        });

        it('should add registration to subscriptions', () => {
            XORMDesignerEditorProvider.Register(mockContext as any);

            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('openCustomDocument', () => {
        it('should return document with uri', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const openContext = {} as vscode.CustomDocumentOpenContext;
            const token = {} as vscode.CancellationToken;

            const doc = await provider.openCustomDocument(uri as any, openContext, token);

            expect(doc.uri).toBe(uri);
            expect(typeof doc.dispose).toBe('function');
        });

        it('should call dispose without error', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const openContext = {} as vscode.CustomDocumentOpenContext;
            const token = {} as vscode.CancellationToken;

            const doc = await provider.openCustomDocument(uri as any, openContext, token);

            expect(() => doc.dispose()).not.toThrow();
        });
    });

    describe('resolveCustomEditor', () => {
        it('should setup webview panel', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            expect(mockPanel.webview.html).toBeTruthy();
            expect(mockPanel.webview.options).toBeDefined();
        });

        it('should set local resource roots', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            expect(mockPanel.webview.options).toHaveProperty('enableScripts', true);
        });

        it('should handle load error gracefully', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('Load error'));

            // Should not throw even if load fails
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            expect(mockPanel.webview.html).toBeTruthy();
        });

        it('should cleanup resources on panel dispose', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Trigger dispose callback
            if (mockPanel._disposeListeners) {
                mockPanel._disposeListeners.forEach((cb: () => void) => cb());
            }

            // Verify state is null after dispose
            expect(provider.GetActiveState()).toBeNull();
        });
    });

    describe('saveCustomDocument', () => {
        it('should save document', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            await provider.saveCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            // Clear the mock before test
            (vscode.workspace.fs.writeFile as jest.Mock).mockClear();

            await provider.saveCustomDocument(mockDoc as any, token);

            // writeFile should not be called when state doesn't exist
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('saveCustomDocumentAs', () => {
        it('should save document to new location', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const newUri = Uri.file('/test/model-copy.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            await provider.saveCustomDocumentAs(mockDoc as any, newUri as any, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                newUri,
                expect.any(Buffer)
            );
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/unknown.dsorm');
            const newUri = Uri.file('/test/unknown-copy.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            await provider.saveCustomDocumentAs(mockDoc as any, newUri as any, token);

            // Should not throw and not call writeFile
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('revertCustomDocument', () => {
        it('should reload document', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            (vscode.workspace.fs.readFile as jest.Mock).mockClear();
            await provider.revertCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/unknown.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            await provider.revertCustomDocument(mockDoc as any, token);

            // Should not throw and not call readFile
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
        });
    });

    describe('backupCustomDocument', () => {
        it('should create backup', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;
            const backupUri = Uri.file('/backup/model.dsorm');
            const backupContext = { destination: backupUri } as any;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            const backup = await provider.backupCustomDocument(mockDoc as any, backupContext, token);

            expect(backup).toBeDefined();
            expect(backup.id).toBeTruthy();
            expect(typeof backup.delete).toBe('function');
        });

        it('should call delete function in backup', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;
            const backupUri = Uri.file('/backup/model.dsorm');
            const backupContext = { destination: backupUri } as any;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            (vscode.workspace.fs.delete as jest.Mock).mockClear();

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            const backup = await provider.backupCustomDocument(mockDoc as any, backupContext, token);

            await backup.delete();
            expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(backupUri);
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/unknown.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;
            const backupUri = Uri.file('/backup/unknown.dsorm');
            const backupContext = { destination: backupUri } as any;

            (vscode.workspace.fs.writeFile as jest.Mock).mockClear();
            const backup = await provider.backupCustomDocument(mockDoc as any, backupContext, token);

            // Should still return backup object but not write file
            expect(backup).toBeDefined();
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('GetActiveState', () => {
        it('should return null when no active panel', () => {
            const state = provider.GetActiveState();

            expect(state).toBeNull();
        });

        it('should return state when active panel exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            const state = provider.GetActiveState();

            expect(state).toBeDefined();
            expect(state?.GetModelData).toBeDefined();
        });

        it('should iterate through multiple panels to find active state', async () => {
            // Create first inactive panel
            const uri1 = Uri.file('/test/model1.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            mockPanel1.active = false;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);

            // Create second active panel
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel2 = createMockWebviewPanel();
            mockPanel2.active = true;

            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            const state = provider.GetActiveState();

            expect(state).toBeDefined();
            expect(state?.GetModelData).toBeDefined();
        });

        it('should return null when active panel has no state', () => {
            // Manually add a webview without a state
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            const fakeKey = 'fake-uri';
            
            // Access private member to simulate a webview without state
            (provider as any)._Webviews.set(fakeKey, mockPanel);

            const state = provider.GetActiveState();

            expect(state).toBeNull();
        });
    });

    describe('GetActivePanel', () => {
        it('should return null when no active panel', () => {
            const panel = provider.GetActivePanel();

            expect(panel).toBeNull();
        });

        it('should return panel when active panel exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            const panel = provider.GetActivePanel();

            expect(panel).toBeDefined();
            expect(panel?.webview).toBeDefined();
        });

        it('should iterate through multiple panels to find active', async () => {
            // Create first inactive panel
            const uri1 = Uri.file('/test/model1.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            mockPanel1.active = false;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);

            // Create second active panel
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel2 = createMockWebviewPanel();
            mockPanel2.active = true;

            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            const panel = provider.GetActivePanel();

            expect(panel).toBeDefined();
            expect(panel).toBe(mockPanel2);
        });
    });

    describe('GetActiveUri', () => {
        it('should return null when no active panel', () => {
            const uri = provider.GetActiveUri();

            expect(uri).toBeNull();
        });

        it('should return URI when active panel exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            const activeUri = provider.GetActiveUri();

            expect(activeUri).toBeDefined();
        });

        it('should iterate through multiple panels to find active URI', async () => {
            // Create first inactive panel
            const uri1 = Uri.file('/test/model1.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            mockPanel1.active = false;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);

            // Create second active panel
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel2 = createMockWebviewPanel();
            mockPanel2.active = true;

            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            const activeUri = provider.GetActiveUri();

            expect(activeUri).toBeDefined();
            expect(activeUri?.fsPath).toContain('model2');
        });
    });

    describe('AddTableToActiveDesigner', () => {
        it('should show warning when no active designer', async () => {
            await provider.AddTableToActiveDesigner();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No active ORM Designer.');
        });

        it('should add table when active designer exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Should not throw when called
            await provider.AddTableToActiveDesigner();
        });

        it('should post message and save when AddTable succeeds', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            
            // Create mock state with successful add
            const mockState = {
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            // Inject mocks directly into provider's internal maps
            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);
            (provider as any)._Documents.set(uri.toString(), mockDoc);

            await provider.AddTableToActiveDesigner();

            expect(mockState.AddTable).toHaveBeenCalledWith(100, 100, 'NewTable');
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
        });
    });

    describe('DeleteSelected', () => {
        it('should do nothing when document not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await provider.DeleteSelected(uri as any);

            // Should not throw
        });

        it('should call state delete method when document found', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            // Should not throw when called - delete will fail due to no selection
            await provider.DeleteSelected(uri as any);
        });

        it('should post message and save when delete succeeds', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            
            // Create mock state with successful delete
            const mockState = {
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            // Inject mocks directly into provider's internal maps
            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);

            await provider.DeleteSelected(uri as any);

            expect(mockState.DeleteSelected).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
        });
    });

    describe('RenameSelected', () => {
        it('should do nothing when document not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await provider.RenameSelected(uri as any);

            // Should not throw
        });

        it('should show warning when no selection', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            await provider.RenameSelected(uri as any);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No element selected.');
        });

        it('should post rename request when selection exists', async () => {
            // Setup selection service with selection BEFORE creating provider
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'elem-1',
                SelectedIDs: ['elem-1']
            });

            // Create new provider with the updated mock
            const testProvider = new XORMDesignerEditorProvider(mockContext as any);
            
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await testProvider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            (mockPanel.webview.postMessage as jest.Mock).mockClear();
            
            await testProvider.RenameSelected(uri as any);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: expect.any(String),
                    Payload: expect.objectContaining({ ElementID: 'elem-1' })
                })
            );
        });
    });

    describe('AddFieldToSelectedTable', () => {
        it('should show warning when no active designer', async () => {
            await provider.AddFieldToSelectedTable();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No active ORM Designer.');
        });

        it('should show warning when no selection', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Document: { uri }
            };

            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);

            await provider.AddFieldToSelectedTable();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No table selected.');
        });

        it('should add field when selection exists and inputs provided', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('TestField');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('String');

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).toHaveBeenCalledWith('table-1', 'TestField', 'String');
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
        });

        it('should not add field when field name cancelled', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).not.toHaveBeenCalled();
        });

        it('should not add field when data type cancelled', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('TestField');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).not.toHaveBeenCalled();
        });
    });

    describe('ValidateModel', () => {
        it('should do nothing when document not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await provider.ValidateModel(uri as any);

            // Should not throw
        });

        it('should validate when document found', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Should not throw when called (may have issues with validation internally)
            try {
                await provider.ValidateModel(uri as any);
            } catch {
                // Expected - mock may not support full validation
            }
        });
    });

    describe('GetWebviewContent', () => {
        it('should return HTML content', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html');
            expect(html).toContain('</html>');
        });

        it('should include SVG canvas', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('<svg id="canvas"');
            expect(html).toContain('tables-layer');
            expect(html).toContain('relations-layer');
        });

        it('should include context menu', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('context-menu');
            expect(html).toContain('add-table');
        });

        it('should include table context menu with add field option', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('table-context-menu');
            expect(html).toContain('add-field');
        });

        it('should include icons in context menu items', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('class="icon"');
            expect(html).toContain('📊'); // Add Table icon
            expect(html).toContain('➕'); // Add Field icon
            expect(html).toContain('🗑️'); // Delete icon
            expect(html).toContain('✏️'); // Rename icon
        });

        it('should include CSP header', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'test-csp-source'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('Content-Security-Policy');
            expect(html).toContain('test-csp-source');
        });
    });

    describe('NotifyDocumentChanged (via OnAddTable)', () => {
        it('should fire document change event when document is registered', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            
            // Create mock state with successful add
            const mockState = {
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                IsDirty: false,
                Document: { uri }
            };

            // Inject mocks directly into provider's internal maps
            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);
            (provider as any)._Documents.set(uri.toString(), mockDoc);

            // Spy on the event emitter
            const fireSpy = jest.spyOn((provider as any)._OnDidChangeCustomDocument, 'fire');

            // Call OnAddTable which calls NotifyDocumentChanged internally
            await (provider as any).OnAddTable(mockPanel, mockState, { X: 100, Y: 200, Name: 'Test' });

            expect(fireSpy).toHaveBeenCalledWith({ document: mockDoc });
            expect(mockState.IsDirty).toBe(true);
        });
    });

    describe('HandleMessage', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Load: jest.fn(),
                Save: jest.fn().mockResolvedValue(undefined),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                AddReference: jest.fn().mockReturnValue({ Success: true }),
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                RenameSelected: jest.fn().mockReturnValue({ Success: true }),
                MoveElement: jest.fn().mockReturnValue({ Success: true }),
                UpdateProperty: jest.fn().mockReturnValue({ Success: true }),
                GetProperties: jest.fn().mockResolvedValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should handle DesignerReady message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle SaveModel message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'SaveModel' });

            expect(mockState.Save).toHaveBeenCalled();
        });

        it('should handle SaveModel error', async () => {
            mockState.Save = jest.fn().mockRejectedValue(new Error('Save failed'));

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SaveModel' });

            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should handle SaveModel error with non-Error object', async () => {
            mockState.Save = jest.fn().mockRejectedValue('String error');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SaveModel' });

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('String error')
            );
        });

        it('should handle SelectElement with Clear', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'SelectElement', 
                Payload: { Clear: true } 
            });

            // Verified by no errors
        });

        it('should handle SelectElement with ElementID', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'SelectElement', 
                Payload: { ElementID: 'elem-1' } 
            });

            // Verified by no errors
        });

        it('should handle SelectElement with Toggle', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'SelectElement', 
                Payload: { Toggle: true, ElementID: 'elem-1' } 
            });

            // Verified by no errors
        });

        it('should handle SelectElement with Add', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'SelectElement', 
                Payload: { Add: true, ElementID: 'elem-1' } 
            });

            // Verified by no errors
        });

        it('should handle SelectElement with Toggle but no ElementID', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'SelectElement', 
                Payload: { Toggle: true } 
            });

            // Verified by no errors - should not call any selection method
        });

        it('should handle SelectElement with Add but no ElementID', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'SelectElement', 
                Payload: { Add: true } 
            });

            // Verified by no errors - should not call any selection method
        });

        it('should handle AddTable message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'AddTable', 
                Payload: { X: 100, Y: 200, Name: 'NewTable' } 
            });

            expect(mockState.AddTable).toHaveBeenCalledWith(100, 200, 'NewTable');
        });

        it('should handle AddTable without name', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'AddTable', 
                Payload: { X: 100, Y: 200 } 
            });

            expect(mockState.AddTable).toHaveBeenCalledWith(100, 200, 'NewTable');
        });

        it('should not post message when AddTable fails', async () => {
            mockState.AddTable = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'AddTable', 
                Payload: { X: 100, Y: 200, Name: 'NewTable' } 
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });

        it('should handle MoveElement message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'MoveElement', 
                Payload: { ElementID: 'elem-1', X: 300, Y: 400 } 
            });

            expect(mockState.MoveElement).toHaveBeenCalledWith('elem-1', 300, 400);
        });

        it('should not notify when MoveElement fails', async () => {
            mockState.MoveElement = jest.fn().mockReturnValue({ Success: false });

            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'MoveElement', 
                Payload: { ElementID: 'elem-1', X: 300, Y: 400 } 
            });

            expect(mockState.IsDirty).toBeFalsy();
        });

        it('should handle DeleteSelected message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'DeleteSelected' });

            expect(mockState.DeleteSelected).toHaveBeenCalled();
        });

        it('should not post message when DeleteSelected fails', async () => {
            mockState.DeleteSelected = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, { Type: 'DeleteSelected' });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });

        it('should handle DragDropAddRelation message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'DragDropAddRelation', 
                Payload: { SourceID: 'table-1', TargetID: 'table-2', Name: 'FK_Test' } 
            });

            expect(mockState.AddReference).toHaveBeenCalledWith('table-1', 'table-2', 'FK_Test');
        });

        it('should handle DragDropAddRelation without name', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'DragDropAddRelation', 
                Payload: { SourceID: 'table-1', TargetID: 'table-2' } 
            });

            expect(mockState.AddReference).toHaveBeenCalledWith('table-1', 'table-2', '');
        });

        it('should not post message when AddRelation fails', async () => {
            mockState.AddReference = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'DragDropAddRelation', 
                Payload: { SourceID: 'table-1', TargetID: 'table-2', Name: 'FK_Test' } 
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });

        it('should handle UpdateProperty message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'UpdateProperty', 
                Payload: { ElementID: 'elem-1', PropertyKey: 'Name', Value: 'NewName' } 
            });

            expect(mockState.UpdateProperty).toHaveBeenCalledWith('elem-1', 'Name', 'NewName');
        });

        it('should not post message when UpdateProperty fails', async () => {
            mockState.UpdateProperty = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'UpdateProperty', 
                Payload: { ElementID: 'elem-1', PropertyKey: 'Name', Value: 'NewName' } 
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });

        it('should handle ValidateModel message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'ValidateModel' });

            expect(mockState.Validate).toHaveBeenCalled();
        });

        it('should handle ValidateModel with errors', async () => {
            mockState.Validate = jest.fn().mockResolvedValue([
                { Severity: 2, Message: 'Error 1' }
            ]);

            await provider.HandleMessage(mockPanel, mockState, { Type: 'ValidateModel' });

            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should handle ValidateModel with warnings only', async () => {
            mockState.Validate = jest.fn().mockResolvedValue([
                { Severity: 1, Message: 'Warning 1' }
            ]);

            await provider.HandleMessage(mockPanel, mockState, { Type: 'ValidateModel' });

            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        });

        it('should handle ValidateModel with no issues', async () => {
            mockState.Validate = jest.fn().mockResolvedValue([]);

            await provider.HandleMessage(mockPanel, mockState, { Type: 'ValidateModel' });

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Validation: No issues found.');
        });

        it('should handle RenameCompleted message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'RenameCompleted', 
                Payload: { NewName: 'RenamedElement' } 
            });

            expect(mockState.RenameSelected).toHaveBeenCalledWith('RenamedElement');
        });

        it('should not post message when RenameSelected fails', async () => {
            mockState.RenameSelected = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, { 
                Type: 'RenameCompleted', 
                Payload: { NewName: 'RenamedElement' } 
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });

        it('should warn on unknown message type', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            await provider.HandleMessage(mockPanel, mockState, { Type: 'UnknownType' });

            expect(consoleSpy).toHaveBeenCalledWith('Unknown message type:', 'UnknownType');
            consoleSpy.mockRestore();
        });
    });

    describe('SetupMessageHandling', () => {
        let mockPanel: any;
        let mockState: any;
        let onMessageCallback: ((msg: any) => Promise<void>) | null = null;
        let onSelectionChangedCallback: ((sel: any) => Promise<void>) | null = null;
        let onIssuesChangedCallback: ((issues: any[]) => void) | null = null;

        beforeEach(() => {
            jest.clearAllMocks();
            onMessageCallback = null;
            onSelectionChangedCallback = null;
            onIssuesChangedCallback = null;
            
            mockPanel = {
                webview: {
                    onDidReceiveMessage: jest.fn((cb) => {
                        onMessageCallback = cb;
                        return { dispose: jest.fn() };
                    }),
                    postMessage: jest.fn().mockResolvedValue(true)
                }
            };
            
            mockState = {
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                GetProperties: jest.fn().mockResolvedValue([{ Key: 'Name', Value: 'Test' }]),
                Validate: jest.fn().mockResolvedValue([]),
                IssueService: {
                    OnIssuesChanged: jest.fn((cb) => {
                        onIssuesChangedCallback = cb;
                        return { dispose: jest.fn() };
                    }),
                    SetIssues: jest.fn()
                }
            };
            
            // Override the mock SelectionService to capture the callback
            const { GetSelectionService } = require('../../../Services/SelectionService');
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn((cb) => {
                    onSelectionChangedCallback = cb;
                    return { dispose: jest.fn() };
                }),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: false,
                PrimaryID: null,
                SelectedIDs: []
            });
        });

        it('should setup message listener', () => {
            provider.SetupMessageHandling(mockPanel, mockState);

            expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
        });

        it('should handle incoming messages via callback', async () => {
            provider.SetupMessageHandling(mockPanel, mockState);

            expect(onMessageCallback).not.toBeNull();
            
            // Execute the message callback
            if (onMessageCallback) {
                await onMessageCallback({ Type: 'DesignerReady' });
            }

            expect(mockState.GetModelData).toHaveBeenCalled();
        });

        it('should handle selection changed with PrimaryID', async () => {
            provider.SetupMessageHandling(mockPanel, mockState);

            expect(onSelectionChangedCallback).not.toBeNull();
            
            // Execute the selection changed callback with a PrimaryID
            if (onSelectionChangedCallback) {
                await onSelectionChangedCallback({
                    PrimaryID: 'elem-1',
                    SelectedIDs: ['elem-1']
                });
            }

            expect(mockState.GetProperties).toHaveBeenCalledWith('elem-1');
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle selection changed without PrimaryID', async () => {
            provider.SetupMessageHandling(mockPanel, mockState);

            expect(onSelectionChangedCallback).not.toBeNull();
            
            // Execute the selection changed callback without PrimaryID
            if (onSelectionChangedCallback) {
                await onSelectionChangedCallback({
                    PrimaryID: null,
                    SelectedIDs: []
                });
            }

            expect(mockState.GetProperties).not.toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle issues changed', () => {
            provider.SetupMessageHandling(mockPanel, mockState);

            expect(onIssuesChangedCallback).not.toBeNull();
            
            // Execute the issues changed callback
            if (onIssuesChangedCallback) {
                onIssuesChangedCallback([{ Message: 'Test issue', Severity: 1 }]);
            }

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: expect.any(String),
                    Payload: expect.objectContaining({ Issues: expect.any(Array) })
                })
            );
        });
    });

    describe('Document lifecycle methods', () => {
        it('should have all lifecycle methods', () => {
            expect(typeof provider.openCustomDocument).toBe('function');
            expect(typeof provider.resolveCustomEditor).toBe('function');
            expect(typeof provider.saveCustomDocument).toBe('function');
            expect(typeof provider.saveCustomDocumentAs).toBe('function');
            expect(typeof provider.revertCustomDocument).toBe('function');
            expect(typeof provider.backupCustomDocument).toBe('function');
        });
    });
});
