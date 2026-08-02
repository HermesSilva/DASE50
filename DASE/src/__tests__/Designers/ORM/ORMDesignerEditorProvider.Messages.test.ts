// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

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
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetProperties: jest.fn().mockResolvedValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null },
                Bridge: { LastSyncMutated: false, AlignLines: jest.fn().mockReturnValue(true) }
            };
        });

        it('should handle DesignerReady message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.Bridge.AlignLines).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle DesignerReady message with references in model', async () => {
            mockState.GetModelData = jest.fn().mockResolvedValue({
                Tables: [],
                References: [
                    { Name: 'FK_Test', Points: [{ X: 0, Y: 0 }, { X: 100, Y: 100 }] }
                ]
            });

            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.Bridge.AlignLines).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle DesignerReady message when references are undefined', async () => {
            mockState.GetModelData = jest.fn().mockResolvedValue({
                Tables: []
            });

            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.Bridge.AlignLines).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle DesignerReady message when references are null', async () => {
            mockState.GetModelData = jest.fn().mockResolvedValue({
                Tables: [],
                References: null
            });

            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.Bridge.AlignLines).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should handle DesignerReady message when reference points are missing', async () => {
            mockState.GetModelData = jest.fn().mockResolvedValue({
                Tables: [],
                References: [
                    { Name: 'FK_UndefinedPoints' },
                    { Name: 'FK_NullPoints', Points: null }
                ]
            });

            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.Bridge.AlignLines).toHaveBeenCalled();
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

        it('should handle ReorderField message', async () => {
            mockState.ReorderField = jest.fn().mockReturnValue({ Success: true });
            mockState.AlignLines = jest.fn().mockReturnValue(true);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'ReorderField',
                Payload: { FieldID: 'field-1', NewIndex: 2 }
            });

            expect(mockState.ReorderField).toHaveBeenCalledWith('field-1', 2);
            expect(mockState.AlignLines).toHaveBeenCalled();
        });

        it('should not notify when ReorderField fails', async () => {
            mockState.ReorderField = jest.fn().mockReturnValue({ Success: false });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'ReorderField',
                Payload: { FieldID: 'field-1', NewIndex: 2 }
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

            expect(mockState.AddReference).toHaveBeenCalledWith('table-1', 'table-2', 'FK_Test', undefined);
        });

        it('should handle DragDropAddRelation without name', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'DragDropAddRelation',
                Payload: { SourceID: 'table-1', TargetID: 'table-2' }
            });

            expect(mockState.AddReference).toHaveBeenCalledWith('table-1', 'table-2', '', undefined);
        });

        it('should handle DragDropAddRelation with IsOneToOne flag', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'DragDropAddRelation',
                Payload: { SourceID: 'table-1', TargetID: 'table-2', IsOneToOne: true }
            });

            expect(mockState.AddReference).toHaveBeenCalledWith('table-1', 'table-2', '', true);
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

        it('should show confirmation dialog when UseStateControl is set to false', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Remove');

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'tbl-1', PropertyKey: 'UseStateControl', Value: false }
            });

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('remove'),
                expect.objectContaining({ modal: true }),
                'Remove',
                'Cancel'
            );
        });

        it('should call UpdateProperty after user confirms state control disable', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Remove');

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'tbl-1', PropertyKey: 'UseStateControl', Value: false }
            });

            expect(mockState.UpdateProperty).toHaveBeenCalledWith('tbl-1', 'UseStateControl', false);
        });

        it('should NOT call UpdateProperty when user cancels state control disable', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'tbl-1', PropertyKey: 'UseStateControl', Value: false }
            });

            expect(mockState.UpdateProperty).not.toHaveBeenCalled();
        });

        it('should refresh properties (reset checkbox) when user cancels state control disable', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'tbl-1', PropertyKey: 'UseStateControl', Value: false }
            });

            // Properties panel should be refreshed to reset the unchecked checkbox
            expect(mockState.GetProperties).toHaveBeenCalledWith('tbl-1');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'PropertiesChanged' })
            );
        });

        it('should NOT show confirmation when UseStateControl is set to true', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'tbl-1', PropertyKey: 'UseStateControl', Value: true }
            });

            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
            expect(mockState.UpdateProperty).toHaveBeenCalledWith('tbl-1', 'UseStateControl', true);
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

        it('should refresh canvas when LastSyncMutated is true after ValidateModel', async () => {
            mockState.Validate = jest.fn().mockResolvedValue([]);
            mockState.Bridge = { LastSyncMutated: true };

            await provider.HandleMessage(mockPanel, mockState, { Type: 'ValidateModel' });

            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
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

        it('should execute OrganizeTablesAI command on OrganizeTablesAI message', async () => {
            const executeMock = vscode.commands.executeCommand as jest.MockedFunction<typeof vscode.commands.executeCommand>;
            await provider.HandleMessage(mockPanel, mockState, { Type: 'OrganizeTablesAI' });
            expect(executeMock).toHaveBeenCalledWith('Dase.OrganizeTablesAI');
        });

        it('should log error when OrganizeTablesAI command rejects', async () => {
            const executeMock = vscode.commands.executeCommand as jest.MockedFunction<typeof vscode.commands.executeCommand>;
            executeMock.mockRejectedValueOnce(new Error('rejected'));
            await provider.HandleMessage(mockPanel, mockState, { Type: 'OrganizeTablesAI' });
            await new Promise(r => setImmediate(r));
            expect(executeMock).toHaveBeenCalledWith('Dase.OrganizeTablesAI');
        });

        it('should execute OrganizeTablesAIExecute command with model index on OrganizeTablesAIExecute message', async () => {
            const executeMock = vscode.commands.executeCommand as jest.MockedFunction<typeof vscode.commands.executeCommand>;
            const layout = { RankDir: 'LR', Ranker: 'network-simplex', RankSep: 180, NodeSep: 55 };
            await provider.HandleMessage(mockPanel, mockState, { Type: 'OrganizeTablesAIExecute', Payload: { ModelIndex: 2, Layout: layout } });
            expect(executeMock).toHaveBeenCalledWith('Dase.OrganizeTablesAIExecute', 2, layout);
        });

        it('should default to model index 0 when ModelIndex is missing in OrganizeTablesAIExecute message', async () => {
            const executeMock = vscode.commands.executeCommand as jest.MockedFunction<typeof vscode.commands.executeCommand>;
            await provider.HandleMessage(mockPanel, mockState, { Type: 'OrganizeTablesAIExecute', Payload: {} });
            expect(executeMock).toHaveBeenCalledWith('Dase.OrganizeTablesAIExecute', 0, undefined);
        });

        it('should execute OrganizeTablesAIRevert command on AIOrganizeRevert message', async () => {
            const executeMock = vscode.commands.executeCommand as jest.MockedFunction<typeof vscode.commands.executeCommand>;
            await provider.HandleMessage(mockPanel, mockState, { Type: 'AIOrganizeRevert' });
            expect(executeMock).toHaveBeenCalledWith('Dase.OrganizeTablesAIRevert');
        });

        it('should execute ExportToDBML command on ExportToDBML message', async () => {
            const executeMock = vscode.commands.executeCommand as jest.MockedFunction<typeof vscode.commands.executeCommand>;
            await provider.HandleMessage(mockPanel, mockState, { Type: 'ExportToDBML' });
            expect(executeMock).toHaveBeenCalledWith('Dase.ExportToDBML');
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
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                Bridge: { LastSyncMutated: false, AlignLines: jest.fn().mockReturnValue(true) },
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

            expect(mockState.Bridge.AlignLines).toHaveBeenCalled();
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

    describe('HandleMessage AlignLines', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') }
            };
        });

        it('should handle AlignLines message', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'AlignLines' });

            expect(mockState.AlignLines).toHaveBeenCalled();
        });

        it('should post model data when AlignLines succeeds', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'AlignLines' });

            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should not post message when AlignLines fails', async () => {
            mockState.AlignLines = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AlignLines' });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('HandleMessage AddField with tableID from payload', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') }
            };
        });

        it('should use tableID from payload when provided', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { TableID: 'table-from-payload', Name: 'TestField', DataType: 'String' }
            });

            expect(mockState.AddField).toHaveBeenCalledWith('table-from-payload', 'TestField', 'String');
        });

        it('should not show input prompts when Name and DataType are provided', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { TableID: 'table-1', Name: 'ProvidedName', DataType: 'Int32' }
            });

            expect(vscode.window.showInputBox).not.toHaveBeenCalled();
            expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        });
    });

    describe('OnAddField tableID from selection', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') }
            };
        });

        it('should use selection PrimaryID when tableID not in payload', async () => {
            // Setup selection service with selection
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'selected-table-id',
                SelectedIDs: ['selected-table-id']
            });

            // Create new provider with the updated mock
            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            await testProvider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { Name: 'TestField', DataType: 'String' } // No TableID
            });

            expect(mockState.AddField).toHaveBeenCalledWith('selected-table-id', 'TestField', 'String');
        });

        it('should show warning when no tableID and no selection', async () => {
            // Setup selection service without selection
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: false,
                PrimaryID: null,
                SelectedIDs: []
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            await testProvider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { Name: 'TestField', DataType: 'String' } // No TableID
            });

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No table selected.');
            expect(mockState.AddField).not.toHaveBeenCalled();
        });

        it('should prompt for field name when not provided and add field', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);
            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('PromptedFieldName');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('DateTime');

            await testProvider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { TableID: 'table-1' } // No Name or DataType
            });

            expect(vscode.window.showInputBox).toHaveBeenCalled();
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            expect(mockState.AddField).toHaveBeenCalledWith('table-1', 'PromptedFieldName', 'DateTime');
        });

        it('should abort when field name prompt is cancelled', async () => {
            (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { TableID: 'table-1' } // No Name
            });

            expect(mockState.AddField).not.toHaveBeenCalled();
        });

        it('should abort when data type prompt is cancelled', async () => {
            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('TestField');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { TableID: 'table-1' } // No DataType
            });

            expect(mockState.AddField).not.toHaveBeenCalled();
        });

        it('should not post message when AddField fails', async () => {
            mockState.AddField = jest.fn().mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { TableID: 'table-1', Name: 'TestField', DataType: 'String' }
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('HandleMessage ReloadDataTypes', () => {
        it('should handle ReloadDataTypes message', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            const state = (provider as any)._States.get(uri.toString());
            state.ReloadDataTypes = jest.fn().mockResolvedValue(undefined);
            state.Bridge.GetAllDataTypes = jest.fn().mockReturnValue(['String', 'Int32']);
            state.Bridge.GetPKDataTypes = jest.fn().mockReturnValue(['Int32', 'Int64']);
            state.GetProperties = jest.fn().mockReturnValue([]);

            await provider.HandleMessage(mockPanel as any, state, { Type: 'ReloadDataTypes' });

            expect(state.ReloadDataTypes).toHaveBeenCalled();
        });
    });

    describe('HandleMessage RequestSeedData', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Bridge: {
                    GetSeedData: jest.fn().mockReturnValue({ TableID: 't1', TableName: 'T', Columns: [], Rows: [] }),
                    SaveSeedData: jest.fn().mockReturnValue({ Success: true }),
                    GetShadowTablePickerData: jest.fn().mockReturnValue({ X: 0, Y: 0, Models: [] }),
                    AddShadowTable: jest.fn().mockReturnValue({ Success: true, ElementID: 'shadow-1' }),
                    LastSyncMutated: false,
                    GetAllDataTypes: jest.fn().mockReturnValue([]),
                    GetPKDataTypes: jest.fn().mockReturnValue([])
                },
                GetModelData: jest.fn().mockReturnValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockReturnValue([]),
                AddShadowTable: jest.fn().mockReturnValue({ Success: true, ElementID: 'shadow-1' }),
                GetProperties: jest.fn().mockReturnValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should send seed data when table exists', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: { TableID: 't1' }
            });

            expect(mockState.Bridge.GetSeedData).toHaveBeenCalledWith('t1');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'SeedDataLoaded' })
            );
        });

        it('should do nothing when TableID is missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: {}
            });

            expect(mockState.Bridge.GetSeedData).not.toHaveBeenCalled();
        });

        it('should log warning when seed data is null', async () => {
            mockState.Bridge.GetSeedData.mockReturnValue(null);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: { TableID: 'not-found' }
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('HandleMessage SaveSeedData', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Bridge: {
                    SaveSeedData: jest.fn().mockReturnValue({ Success: true }),
                    LastSyncMutated: false,
                    GetAllDataTypes: jest.fn().mockReturnValue([]),
                    GetPKDataTypes: jest.fn().mockReturnValue([])
                },
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should save seed data and notify changes on success', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { TableID: 't1', Rows: [{ TupleID: 'r1', Values: { f1: 'v1' } }] }
            });

            expect(mockState.Bridge.SaveSeedData).toHaveBeenCalledWith('t1', [{ TupleID: 'r1', Values: { f1: 'v1' } }]);
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'SeedDataSaved' })
            );
        });

        it('should do nothing when TableID is missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { Rows: [] }
            });

            expect(mockState.Bridge.SaveSeedData).not.toHaveBeenCalled();
        });

        it('should do nothing when Rows is not an array', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { TableID: 't1', Rows: 'invalid' }
            });

            expect(mockState.Bridge.SaveSeedData).not.toHaveBeenCalled();
        });

        it('should not notify document changed when save fails', async () => {
            mockState.Bridge.SaveSeedData.mockReturnValue({ Success: false, Message: 'Error' });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { TableID: 't1', Rows: [] }
            });

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: 'SeedDataSaved',
                    Payload: expect.objectContaining({ Success: false })
                })
            );
        });
    });

    describe('HandleMessage RequestIndexes', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Bridge: {
                    GetTableIndexes: jest.fn().mockReturnValue({ TableID: 't1', TableName: 'T', Columns: [], Indexes: [] }),
                    SaveTableIndexes: jest.fn().mockReturnValue({ Success: true }),
                    LastSyncMutated: false,
                    GetAllDataTypes: jest.fn().mockReturnValue([]),
                    GetPKDataTypes: jest.fn().mockReturnValue([])
                },
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should send index data when table exists', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestIndexes',
                Payload: { TableID: 't1' }
            });

            expect(mockState.Bridge.GetTableIndexes).toHaveBeenCalledWith('t1');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'IndexesLoaded' })
            );
        });

        it('should do nothing when TableID is missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestIndexes',
                Payload: {}
            });

            expect(mockState.Bridge.GetTableIndexes).not.toHaveBeenCalled();
        });

        it('should log warning when index data is null', async () => {
            mockState.Bridge.GetTableIndexes.mockReturnValue(null);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestIndexes',
                Payload: { TableID: 'not-found' }
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('HandleMessage SaveIndexes', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Bridge: {
                    SaveTableIndexes: jest.fn().mockReturnValue({ Success: true }),
                    LastSyncMutated: false,
                    GetAllDataTypes: jest.fn().mockReturnValue([]),
                    GetPKDataTypes: jest.fn().mockReturnValue([])
                },
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should save indexes and notify changes on success', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveIndexes',
                Payload: { TableID: 't1', Indexes: [{ IndexID: 'NEW', Name: 'IX_1', Fields: [{ FieldID: 'f1' }] }] }
            });

            expect(mockState.Bridge.SaveTableIndexes).toHaveBeenCalledWith(
                't1', [{ IndexID: 'NEW', Name: 'IX_1', Fields: [{ FieldID: 'f1' }] }]
            );
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'IndexesSaved' })
            );
        });

        it('should do nothing when TableID is missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveIndexes',
                Payload: { Indexes: [] }
            });

            expect(mockState.Bridge.SaveTableIndexes).not.toHaveBeenCalled();
        });

        it('should do nothing when Indexes is not an array', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveIndexes',
                Payload: { TableID: 't1', Indexes: 'invalid' }
            });

            expect(mockState.Bridge.SaveTableIndexes).not.toHaveBeenCalled();
        });

        it('should not notify document changed when save fails', async () => {
            mockState.Bridge.SaveTableIndexes.mockReturnValue({ Success: false, Message: 'Error' });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveIndexes',
                Payload: { TableID: 't1', Indexes: [] }
            });

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: 'IndexesSaved',
                    Payload: expect.objectContaining({ Success: false })
                })
            );
        });
    });

    describe('HandleMessage RequestShadowTablePicker', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Bridge: {
                    GetShadowTablePickerData: jest.fn().mockReturnValue({ X: 10, Y: 20, Models: [] }),
                    LastSyncMutated: false
                },
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should send shadow table picker data', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: { X: 10, Y: 20 }
            });

            expect(mockState.Bridge.GetShadowTablePickerData).toHaveBeenCalledWith(10, 20);
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'ShadowTablePickerData' })
            );
        });

        it('should do nothing when X is not a number', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: { X: 'invalid', Y: 20 }
            });

            expect(mockState.Bridge.GetShadowTablePickerData).not.toHaveBeenCalled();
        });

        it('should do nothing when Y is not a number', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: { X: 10, Y: null }
            });

            expect(mockState.Bridge.GetShadowTablePickerData).not.toHaveBeenCalled();
        });
    });

    describe('HandleMessage AddShadowTable', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                AddShadowTable: jest.fn().mockReturnValue({ Success: true, ElementID: 'shadow-1' }),
                GetModelData: jest.fn().mockReturnValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                Bridge: {
                    LastSyncMutated: false,
                    GetAllDataTypes: jest.fn().mockReturnValue([]),
                    GetPKDataTypes: jest.fn().mockReturnValue([])
                },
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should add shadow table and send model update', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: {
                    X: 100, Y: 200, ModelName: 'Auth.dsorm',
                    DocumentID: 'doc-1', DocumentName: 'Auth',
                    ModuleID: '', ModuleName: '',
                    TableID: 'tbl-1', TableName: 'AppUser'
                }
            });

            expect(mockState.AddShadowTable).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
        });

        it('should call AddShadowTable even when TableID is missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: { TableName: 'T' }
            });

            expect(mockState.AddShadowTable).toHaveBeenCalled();
        });

        it('should do nothing when TableName is missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: { TableID: 't1' }
            });

            expect(mockState.AddShadowTable).not.toHaveBeenCalled();
        });

        it('should not send model update when add fails', async () => {
            mockState.AddShadowTable.mockReturnValue({ Success: false });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: {
                    X: 0, Y: 0, ModelName: 'M',
                    DocumentID: 'd', DocumentName: 'M',
                    ModuleID: '', ModuleName: '',
                    TableID: 't1', TableName: 'T'
                }
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('CreateSQLScript message', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                GetModelData: jest.fn().mockReturnValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                Bridge: { LastSyncMutated: false, GetAllDataTypes: jest.fn().mockReturnValue([]) },
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should execute Dase.CreateSQLScript command', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'CreateSQLScript',
                Payload: {}
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('Dase.CreateSQLScript');
        });
    });

    describe('CreateSQLScriptExecute message', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                GetModelData: jest.fn().mockReturnValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                Bridge: { LastSyncMutated: false, GetAllDataTypes: jest.fn().mockReturnValue([]) },
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should execute Dase.CreateSQLScriptExecute with payload fields', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'CreateSQLScriptExecute',
                Payload: { ModelIndex: 2, Database: 'postgresql', CustomDB: '' }
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'Dase.CreateSQLScriptExecute', 2, 'postgresql', ''
            );
        });

        it('should pass CustomDB when database is "another"', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'CreateSQLScriptExecute',
                Payload: { ModelIndex: 0, Database: 'another', CustomDB: 'Firebird' }
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'Dase.CreateSQLScriptExecute', 0, 'another', 'Firebird'
            );
        });

        it('should default ModelIndex to 0 when missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'CreateSQLScriptExecute',
                Payload: { Database: 'mysql' }
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'Dase.CreateSQLScriptExecute', 0, 'mysql', ''
            );
        });

        it('should default Database to sqlserver when missing', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'CreateSQLScriptExecute',
                Payload: { ModelIndex: 1 }
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'Dase.CreateSQLScriptExecute', 1, 'sqlserver', ''
            );
        });
    });

    describe('GenerateORMCode message', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                GetModelData: jest.fn().mockReturnValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockReturnValue([]),
                GetProperties: jest.fn().mockReturnValue([]),
                Bridge: { LastSyncMutated: false, GetAllDataTypes: jest.fn().mockReturnValue([]) },
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('should execute Dase.GenerateORMCode command', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'GenerateORMCode',
                Payload: {}
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('Dase.GenerateORMCode');
        });
    });

});
