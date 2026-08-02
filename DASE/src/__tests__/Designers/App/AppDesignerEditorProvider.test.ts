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

describe('XAppDesignerEditorProvider', () => {
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
    });

    describe('ViewType', () => {
        it('returns Dase.AppDesigner', () => {
            expect(XAppDesignerEditorProvider.ViewType).toBe('Dase.AppDesigner');
        });
    });

    describe('Register', () => {
        it('registers the custom editor provider', () => {
            const registered = XAppDesignerEditorProvider.Register(mockContext as any);

            expect(registered).toBeInstanceOf(XAppDesignerEditorProvider);
            expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
                'Dase.AppDesigner',
                expect.any(XAppDesignerEditorProvider),
                expect.objectContaining({
                    webviewOptions: { retainContextWhenHidden: true },
                    supportsMultipleEditorsPerDocument: false
                })
            );
        });

        it('adds the registration to subscriptions', () => {
            XAppDesignerEditorProvider.Register(mockContext as any);
            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('openCustomDocument', () => {
        it('returns a document wrapping the URI', async () => {
            const uri = Uri.file('/test/model.dsapp');
            const doc = await provider.openCustomDocument(uri as any, {} as vscode.CustomDocumentOpenContext, {} as vscode.CancellationToken);

            expect(doc.uri).toBe(uri);
            expect(typeof doc.dispose).toBe('function');
        });
    });

    describe('GetWebviewContent', () => {
        it('references AppDesigner.js/.css and sets a CSP', () => {
            const webview = {
                cspSource: 'vscode-resource:',
                asWebviewUri: (u: vscode.Uri) => u
            } as unknown as vscode.Webview;

            const html = provider.GetWebviewContent(webview);

            expect(html).toContain('AppDesigner.css');
            expect(html).toContain('AppDesigner.js');
            expect(html).toContain('Content-Security-Policy');
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
                GetModelData: jest.fn().mockReturnValue({ Application: null }),
                Validate: jest.fn().mockReturnValue([]),
                CreateApplication: jest.fn().mockReturnValue({ Success: true, ElementID: 'app-1' }),
                SetFormView: jest.fn().mockReturnValue({ Success: true, ElementID: 'form-1' }),
                SetTabbedFormView: jest.fn().mockReturnValue({ Success: true, ElementID: 'form-1' }),
                AddFormTab: jest.fn().mockReturnValue({ Success: true, ElementID: 'tab-1' }),
                AddColumn: jest.fn().mockReturnValue({ Success: true }),
                AddFilter: jest.fn().mockReturnValue({ Success: true }),
                AddButton: jest.fn().mockReturnValue({ Success: true }),
                AddRowAction: jest.fn().mockReturnValue({ Success: true }),
                AddViewer: jest.fn().mockReturnValue({ Success: true }),
                AddFormSection: jest.fn().mockReturnValue({ Success: true, ElementID: 'section-1' }),
                AddField: jest.fn().mockReturnValue({ Success: true, ElementID: 'field-1' }),
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                RenameSelected: jest.fn().mockReturnValue({ Success: true }),
                UpdateProperty: jest.fn().mockReturnValue({ Success: true }),
                DocumentUri: 'file:///test/model.dsapp',
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null }
            };
        });

        it('DesignerReady sends the model and the issues', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'DesignerReady' });

            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockState.Validate).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'IssuesChanged' })
            );
        });

        it('SaveModel delegates to state.Save', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'SaveModel' });
            expect(mockState.Save).toHaveBeenCalled();
        });

        it('SaveModel shows an error message when state.Save rejects', async () => {
            mockState.Save = jest.fn().mockRejectedValue(new Error('disk full'));
            const errorSpy = jest.spyOn(vscode.window, 'showErrorMessage');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SaveModel' });

            expect(errorSpy).toHaveBeenCalledWith('Failed to save App model: disk full');
        });

        it('SaveModel stringifies a non-Error rejection', async () => {
            mockState.Save = jest.fn().mockRejectedValue('disk full');
            const errorSpy = jest.spyOn(vscode.window, 'showErrorMessage');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SaveModel' });

            expect(errorSpy).toHaveBeenCalledWith('Failed to save App model: disk full');
        });

        it('AddColumn/AddFilter/AddButton/AddRowAction/AddViewer/CreateApplication fall back to a default name/title', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'CreateApplication', Payload: {} });
            expect(mockState.CreateApplication).toHaveBeenCalledWith('NewApp');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AddColumn', Payload: {} });
            expect(mockState.AddColumn).toHaveBeenCalledWith('NewColumn');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AddFilter', Payload: {} });
            expect(mockState.AddFilter).toHaveBeenCalledWith('NewFilter');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AddButton', Payload: {} });
            expect(mockState.AddButton).toHaveBeenCalledWith('');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AddRowAction', Payload: {} });
            expect(mockState.AddRowAction).toHaveBeenCalledWith('');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AddViewer', Payload: {} });
            expect(mockState.AddViewer).toHaveBeenCalledWith('');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'AddFormTab', Payload: {} });
            expect(mockState.AddFormTab).toHaveBeenCalledWith('');
        });

        it('SelectElement forwards the payload to the SelectionService', async () => {
            const selectionService = GetSelectionService();
            await provider.HandleMessage(mockPanel, mockState, { Type: 'SelectElement', Payload: { ElementID: 'x' } });
            expect(selectionService.Select).toHaveBeenCalledWith('x');
        });

        it('SelectElement handles Clear/SelectIDs/Toggle/Add variants', async () => {
            const selectionService = GetSelectionService();

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SelectElement', Payload: { Clear: true } });
            expect(selectionService.Clear).toHaveBeenCalled();

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SelectElement', Payload: { SelectIDs: ['a', 'b'] } });
            expect(selectionService.SelectMultiple).toHaveBeenCalledWith(['a', 'b']);

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SelectElement', Payload: { Toggle: true, ElementID: 'a' } });
            expect(selectionService.ToggleSelection).toHaveBeenCalledWith('a');

            await provider.HandleMessage(mockPanel, mockState, { Type: 'SelectElement', Payload: { Add: true, ElementID: 'b' } });
            expect(selectionService.AddToSelection).toHaveBeenCalledWith('b');
        });

        it('ValidateModel dispatches through to OnValidateModel', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'ValidateModel' });
            expect(mockState.Validate).toHaveBeenCalled();
        });

        it('DeleteSelected reloads the model on success', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'DeleteSelected' });

            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
        });

        it('UpdateProperty reloads the model on success', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'app-1', PropertyKey: 'TitleKey', Value: 'sys.plans.title' }
            });

            expect(mockState.UpdateProperty).toHaveBeenCalledWith('app-1', 'TitleKey', 'sys.plans.title');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
        });

        it.each([
            ['CreateApplication', 'CreateApplication', { Name: 'NewApp' }],
            ['SetFormView', 'SetFormView', {}],
            ['SetTabbedFormView', 'SetTabbedFormView', {}],
            ['AddFormTab', 'AddFormTab', { TitleKey: 'crm.people.tab.identification' }],
            ['AddColumn', 'AddColumn', { FieldName: 'Nome' }],
            ['AddFilter', 'AddFilter', { FieldName: 'Nome' }],
            ['AddButton', 'AddButton', { TitleKey: 'buttonBar.new' }],
            ['AddRowAction', 'AddRowAction', { TitleKey: 'orders.invoice' }],
            ['AddViewer', 'AddViewer', { Key: 'resumo' }]
        ])('%s calls state.%s and reloads the model on success', async (messageType, stateMethod, payload) => {
            await provider.HandleMessage(mockPanel, mockState, { Type: messageType, Payload: payload });

            expect(mockState[stateMethod]).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
        });

        it('AddFormSection then AddField compose a section+field round trip', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddFormSection',
                Payload: { ParentID: 'form-1', TitleKey: 'sys.plans.section.billing' }
            });
            expect(mockState.AddFormSection).toHaveBeenCalledWith({ ParentID: 'form-1', TitleKey: 'sys.plans.section.billing' });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddField',
                Payload: { SectionID: 'section-1', FieldName: 'Preco', Row: 0, ColSpan: 16 }
            });
            expect(mockState.AddField).toHaveBeenCalledWith({ SectionID: 'section-1', FieldName: 'Preco', Row: 0, ColSpan: 16 });
        });

        it('DeleteSelected does not reload the model when nothing was selected', async () => {
            mockState.DeleteSelected = jest.fn().mockReturnValue({ Success: false, Message: 'No selection.' });

            await provider.HandleMessage(mockPanel, mockState, { Type: 'DeleteSelected' });

            expect(mockState.GetModelData).not.toHaveBeenCalled();
        });

        it.each([
            ['CreateApplication', 'CreateApplication', { Name: 'x' }],
            ['SetFormView', 'SetFormView', {}],
            ['SetTabbedFormView', 'SetTabbedFormView', {}],
            ['AddFormTab', 'AddFormTab', { TitleKey: 'x' }],
            ['AddFilter', 'AddFilter', { FieldName: 'x' }],
            ['AddButton', 'AddButton', { TitleKey: 'x' }],
            ['AddRowAction', 'AddRowAction', { TitleKey: 'x' }],
            ['AddViewer', 'AddViewer', { Key: 'x' }],
            ['AddFormSection', 'AddFormSection', { ParentID: 'x' }],
            ['AddField', 'AddField', { SectionID: 'x', FieldName: 'y', Row: 0, ColSpan: 1 }]
        ])('%s does not reload the model when state.%s fails', async (messageType, stateMethod, payload) => {
            mockState[stateMethod] = jest.fn().mockReturnValue({ Success: false, Message: 'nope' });

            await provider.HandleMessage(mockPanel, mockState, { Type: messageType, Payload: payload });

            expect(mockState.GetModelData).not.toHaveBeenCalled();
        });

        it('RenameCompleted does not reload the model when the rename fails', async () => {
            mockState.RenameSelected = jest.fn().mockReturnValue({ Success: false, Message: 'No selection.' });

            await provider.HandleMessage(mockPanel, mockState, { Type: 'RenameCompleted', Payload: { NewName: 'x' } });

            expect(mockState.GetModelData).not.toHaveBeenCalled();
        });

        it('UpdateProperty warns the user when the property is unknown', async () => {
            mockState.UpdateProperty = jest.fn().mockReturnValue({ Success: false, Message: 'Unknown property.' });
            const warnSpy = jest.spyOn(vscode.window, 'showWarningMessage');

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'UpdateProperty',
                Payload: { ElementID: 'app-1', PropertyKey: 'DoesNotExist', Value: 1 }
            });

            expect(warnSpy).toHaveBeenCalledWith('Unknown property.');
        });

        it('RenameCompleted reloads the model on success', async () => {
            await provider.HandleMessage(mockPanel, mockState, { Type: 'RenameCompleted', Payload: { NewName: 'Novo Nome' } });

            expect(mockState.RenameSelected).toHaveBeenCalledWith('Novo Nome');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ Type: 'LoadModel' })
            );
        });

        it('ignores an unknown message type without throwing', async () => {
            await expect(provider.HandleMessage(mockPanel, mockState, { Type: 'SomethingElse' })).resolves.toBeUndefined();
        });
    });

    describe('GetActiveUri / GetActiveState / GetActivePanel', () => {
        it('returns null when no webview is active', () => {
            expect(provider.GetActiveUri()).toBeNull();
            expect(provider.GetActiveState()).toBeNull();
            expect(provider.GetActivePanel()).toBeNull();
        });
    });

    describe('ValidateModel', () => {
        it('does nothing when the URI has no open state', async () => {
            await expect(provider.ValidateModel(Uri.file('/nope.dsapp') as any)).resolves.toBeUndefined();
        });
    });
});
