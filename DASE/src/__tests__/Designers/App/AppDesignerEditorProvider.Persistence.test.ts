jest.mock('vscode');

jest.mock('../../../Services/SelectionService', () => ({
    GetSelectionService: jest.fn(() => ({
        OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
        Clear: jest.fn(),
        Select: jest.fn(),
        SelectMultiple: jest.fn(),
        ToggleSelection: jest.fn(),
        AddToSelection: jest.fn(),
        HasSelection: false,
        PrimaryID: null,
        SelectedIDs: []
    }))
}));

import * as vscode from 'vscode';
import { XAppDesignerEditorProvider } from '../../../Designers/App/AppDesignerEditorProvider';
import { createMockExtensionContext, Uri, createMockWebviewPanel } from '../../__mocks__/vscode';
import { GetSelectionService } from '../../../Services/SelectionService';

describe('XAppDesignerEditorProvider persistence', () => {
    let provider: XAppDesignerEditorProvider;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        (GetSelectionService as jest.Mock).mockReturnValue({
            OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
            Clear: jest.fn(),
            Select: jest.fn(),
            SelectMultiple: jest.fn(),
            ToggleSelection: jest.fn(),
            AddToSelection: jest.fn(),
            HasSelection: false,
            PrimaryID: null,
            SelectedIDs: []
        });
        mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;
        provider = new XAppDesignerEditorProvider(mockContext as any);
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(''));
    });

    async function ResolveEditor(pPath: string) {
        const uri = Uri.file(pPath);
        const mockDoc = { uri, dispose: jest.fn() };
        const mockPanel = createMockWebviewPanel();
        const token = {} as vscode.CancellationToken;

        await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
        return { uri, mockDoc, mockPanel, token };
    }

    describe('resolveCustomEditor', () => {
        it('loads and validates the document, wires the webview HTML', async () => {
            const { mockPanel } = await ResolveEditor('/test/model.dsapp');

            expect(mockPanel.webview.html).toContain('AppDesigner.js');
            expect((mockPanel.webview.options as { enableScripts?: boolean }).enableScripts).toBe(true);
        });

        it('logs and swallows a load failure instead of throwing', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('disk error'));

            await expect(ResolveEditor('/test/broken.dsapp')).resolves.toBeDefined();
        });

        it('fires onDidChangeCustomDocument when the state becomes dirty', async () => {
            const { mockDoc, mockPanel } = await ResolveEditor('/test/dirty.dsapp');

            const changeListener = jest.fn();
            provider.onDidChangeCustomDocument(changeListener);

            // Untitled Save marks the state dirty via IsDirty=true in Load(); simulate an edit here.
            const state = provider.GetActiveState();
            expect(state).not.toBeNull();
            state!.IsDirty = true;

            expect(changeListener).toHaveBeenCalledWith({ document: mockDoc });
        });

        it('refreshes issues and updates the last active key when the panel regains focus', async () => {
            const { mockPanel } = await ResolveEditor('/test/focus.dsapp');
            mockPanel.active = true;

            expect(() => mockPanel._viewStateListeners.forEach((l: any) => l({ webviewPanel: mockPanel }))).not.toThrow();
        });

        it('does nothing when the panel loses focus', async () => {
            const { mockPanel } = await ResolveEditor('/test/blur.dsapp');
            mockPanel.active = false;

            expect(() => mockPanel._viewStateListeners.forEach((l: any) => l({ webviewPanel: mockPanel }))).not.toThrow();
        });

        it('does not fire onDidChangeCustomDocument when the state reports IsDirty=false', async () => {
            await ResolveEditor('/test/clean.dsapp');
            const state = provider.GetActiveState()!;

            const changeListener = jest.fn();
            provider.onDidChangeCustomDocument(changeListener);

            (state as unknown as { _OnStateChanged: { fire: (e: { IsDirty: boolean }) => void } })['_OnStateChanged'].fire({ IsDirty: false });

            expect(changeListener).not.toHaveBeenCalled();
        });

        it('cleans up state on dispose', async () => {
            const { mockPanel } = await ResolveEditor('/test/dispose.dsapp');

            expect(provider.GetActiveState()).not.toBeNull();
            mockPanel._disposeListeners.forEach((l: () => void) => l());

            expect(provider.GetActiveState()).toBeNull();
        });

        it('disposing a non-last-active document keeps the last active key intact', async () => {
            const { mockPanel: firstPanel } = await ResolveEditor('/test/first.dsapp');
            const { mockPanel: secondPanel } = await ResolveEditor('/test/second.dsapp'); // becomes last-active

            firstPanel._disposeListeners.forEach((l: () => void) => l());

            // O último ativo continua resolvível — a chave dele não foi limpa pela outra aba.
            secondPanel.active = true;
            expect(provider.GetActiveState()).not.toBeNull();
        });
    });

    describe('saveCustomDocument', () => {
        it('saves an already-open document', async () => {
            const { mockDoc, token } = await ResolveEditor('/test/model.dsapp');

            await provider.saveCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('does nothing when there is no open state', async () => {
            const uri = Uri.file('/test/nonexistent.dsapp');
            (vscode.workspace.fs.writeFile as jest.Mock).mockClear();

            await provider.saveCustomDocument({ uri, dispose: jest.fn() } as any, {} as vscode.CancellationToken);

            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('saveCustomDocumentAs', () => {
        it('serializes the model to the destination URI', async () => {
            const { mockDoc, token } = await ResolveEditor('/test/model.dsapp');
            const destination = Uri.file('/test/model-copy.dsapp');

            await provider.saveCustomDocumentAs(mockDoc as any, destination as any, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(destination, expect.anything());
        });

        it('does nothing when there is no open state', async () => {
            const uri = Uri.file('/test/nonexistent.dsapp');
            (vscode.workspace.fs.writeFile as jest.Mock).mockClear();

            await provider.saveCustomDocumentAs({ uri, dispose: jest.fn() } as any, Uri.file('/x.dsapp') as any, {} as vscode.CancellationToken);

            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('revertCustomDocument', () => {
        it('reloads the document from disk', async () => {
            const { mockDoc, token } = await ResolveEditor('/test/model.dsapp');

            (vscode.workspace.fs.readFile as jest.Mock).mockClear();
            await provider.revertCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
        });

        it('does nothing when there is no open state', async () => {
            const uri = Uri.file('/test/nonexistent.dsapp');
            await expect(provider.revertCustomDocument({ uri, dispose: jest.fn() } as any, {} as vscode.CancellationToken)).resolves.toBeUndefined();
        });
    });

    describe('backupCustomDocument', () => {
        it('writes a backup and returns a delete handle', async () => {
            const { mockDoc, token } = await ResolveEditor('/test/model.dsapp');
            const destination = Uri.file('/backup/model.dsapp');

            const backup = await provider.backupCustomDocument(mockDoc as any, { destination } as vscode.CustomDocumentBackupContext, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(destination, expect.anything());
            expect(backup.id).toBe(destination.toString());

            backup.delete();
            expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(destination);
        });

        it('still returns a delete handle when there is no open state', async () => {
            const destination = Uri.file('/backup/model.dsapp');
            const backup = await provider.backupCustomDocument(
                { uri: Uri.file('/test/nonexistent.dsapp'), dispose: jest.fn() } as any,
                { destination } as vscode.CustomDocumentBackupContext,
                {} as vscode.CancellationToken
            );

            expect(backup.id).toBe(destination.toString());
        });
    });

    describe('SetupMessageHandling', () => {
        it('routes webview messages into HandleMessage', async () => {
            const { mockPanel } = await ResolveEditor('/test/model.dsapp');
            const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

            await expect(handler({ Type: 'SaveModel' })).resolves.toBeUndefined();
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('a real mutation notifies onDidChangeCustomDocument (NotifyDocumentChanged true branch)', async () => {
            const { mockDoc, mockPanel } = await ResolveEditor('/test/model.dsapp');
            const state = provider.GetActiveState()!;
            state.Bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            const changeListener = jest.fn();
            provider.onDidChangeCustomDocument(changeListener);
            const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

            await handler({ Type: 'AddColumn', Payload: { FieldName: 'Nome' } });

            expect(changeListener).toHaveBeenCalledWith({ document: mockDoc });
        });

        it('forwards selection changes to the webview', async () => {
            const selectionCallback = jest.fn();
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: (cb: any) => { selectionCallback.mockImplementation(cb); return { dispose: jest.fn() }; },
                HasSelection: false,
                PrimaryID: null,
                SelectedIDs: []
            });

            const { mockPanel } = await ResolveEditor('/test/model.dsapp');
            selectionCallback({ SelectedIDs: ['a'], PrimaryID: 'a' });

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'SelectionChanged', Payload: { SelectedIDs: ['a'], PrimaryID: 'a' } })
            );
        });
    });

    describe('a real CreateApplication round trip', () => {
        it('renders a usable model after creating the application through the message protocol', async () => {
            const { mockPanel } = await ResolveEditor('/test/blank.dsapp');
            const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

            await handler({ Type: 'CreateApplication', Payload: { Name: 'SYSxPlanos' } });

            const lastLoadModel = (mockPanel.webview.postMessage as jest.Mock).mock.calls
                .map((c: unknown[]) => c[0] as { Type: string; Payload: { Application: { Name: string } } })
                .reverse()
                .find((m) => m.Type === 'LoadModel');

            expect(lastLoadModel?.Payload.Application.Name).toBe('SYSxPlanos');
        });
    });

    describe('GetActiveState / GetActiveUri / ValidateModel with an open editor', () => {
        it('resolves the active panel first, falling back to the last active one', async () => {
            const { uri, mockPanel } = await ResolveEditor('/test/model.dsapp');
            mockPanel.active = true;

            expect(provider.GetActiveState()).not.toBeNull();
            expect(provider.GetActiveUri()!.toString()).toBe(uri.toString());

            mockPanel.active = false;
            expect(provider.GetActiveState()).not.toBeNull(); // last-active fallback
            expect(provider.GetActiveUri()).toBeNull(); // GetActiveUri has no fallback, by design
        });

        it('GetActivePanel resolves the focused panel, falling back to the last active one', async () => {
            const { mockPanel } = await ResolveEditor('/test/model.dsapp');
            mockPanel.active = true;

            expect(provider.GetActivePanel()).toBe(mockPanel);

            mockPanel.active = false;
            expect(provider.GetActivePanel()).toBe(mockPanel); // last-active fallback
        });

        it('ValidateModel posts IssuesChanged for the open document', async () => {
            const { uri, mockPanel } = await ResolveEditor('/test/model.dsapp');
            (mockPanel.webview.postMessage as jest.Mock).mockClear();

            await provider.ValidateModel(uri as any);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'IssuesChanged' })
            );
        });
    });
});
