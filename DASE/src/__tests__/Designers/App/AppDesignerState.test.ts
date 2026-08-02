jest.mock('vscode');

import * as vscode from 'vscode';
import { XAppDesignerState } from '../../../Designers/App/AppDesignerState';
import { Uri, createMockTextDocument } from '../../__mocks__/vscode';

describe('XAppDesignerState', () => {
    let state: XAppDesignerState;
    let mockDocument: vscode.TextDocument;

    beforeEach(() => {
        jest.clearAllMocks();

        const uri = Uri.file('/test/model.dsapp');
        mockDocument = createMockTextDocument(uri, '') as unknown as vscode.TextDocument;
        state = new XAppDesignerState(mockDocument);
    });

    afterEach(() => {
        state.Dispose();
    });

    describe('constructor', () => {
        it('initializes with the document', () => {
            expect(state.Document).toBe(mockDocument);
        });

        it('initializes as not dirty', () => {
            expect(state.IsDirty).toBe(false);
        });

        it('has a Bridge instance', () => {
            expect(state.Bridge).toBeDefined();
        });
    });

    describe('IsUntitled', () => {
        it('is false for the file scheme', () => {
            expect(state.IsUntitled).toBe(false);
        });

        it('is true for the untitled scheme', () => {
            const untitledUri = Uri.parse('untitled:Untitled-1.dsapp');
            const untitledDoc = createMockTextDocument(untitledUri) as unknown as vscode.TextDocument;
            const untitledState = new XAppDesignerState(untitledDoc);

            expect(untitledState.IsUntitled).toBe(true);
            untitledState.Dispose();
        });
    });

    describe('IsDirty', () => {
        it('fires OnStateChanged when it changes', () => {
            const listener = jest.fn();
            state.OnStateChanged(listener);

            state.IsDirty = true;

            expect(listener).toHaveBeenCalledWith({ IsDirty: true });
        });

        it('does not fire when set to the same value', () => {
            const listener = jest.fn();
            state.IsDirty = false;
            state.OnStateChanged(listener);

            state.IsDirty = false;

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('DocumentUri / SelectionService', () => {
        it('exposes the document URI as a string', () => {
            expect(state.DocumentUri).toBe(mockDocument.uri.toString());
        });

        it('exposes the shared SelectionService', () => {
            expect(state.SelectionService).toBeDefined();
        });
    });

    describe('Load', () => {
        it('marks an untitled document dirty without touching the filesystem', async () => {
            const untitledUri = Uri.parse('untitled:Untitled-1.dsapp');
            const untitledDoc = createMockTextDocument(untitledUri) as unknown as vscode.TextDocument;
            const untitledState = new XAppDesignerState(untitledDoc);

            await untitledState.Load();

            expect(untitledState.IsDirty).toBe(true);
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
            untitledState.Dispose();
        });

        it('loads from the filesystem and clears the dirty flag', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(''));

            await state.Load();

            expect(state.IsDirty).toBe(false);
        });

        it('logs and rethrows a filesystem failure', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('disk error'));

            await expect(state.Load()).rejects.toThrow('disk error');
        });
    });

    describe('Save', () => {
        it('writes the serialized model to disk', async () => {
            await state.Load();
            state.Bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            await state.Save();

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
            expect(state.IsDirty).toBe(false);
        });

        it('does nothing for an untitled document', async () => {
            const untitledUri = Uri.parse('untitled:Untitled-1.dsapp');
            const untitledDoc = createMockTextDocument(untitledUri) as unknown as vscode.TextDocument;
            const untitledState = new XAppDesignerState(untitledDoc);

            await untitledState.Save();

            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
            untitledState.Dispose();
        });

        it('logs and rethrows a filesystem failure', async () => {
            await state.Load();
            (vscode.workspace.fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

            await expect(state.Save()).rejects.toThrow('disk full');
        });
    });

    describe('mutation delegates', () => {
        beforeEach(async () => {
            await state.Load();
            state.Bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
        });

        it('CreateApplication is idempotent and marks the state dirty', async () => {
            const freshState = new XAppDesignerState(mockDocument);
            await freshState.Load();

            const first = freshState.CreateApplication('SYSxPlanos');
            expect(first.Success).toBe(true);
            expect(freshState.IsDirty).toBe(true);

            const second = freshState.CreateApplication('Ignored');
            expect(second.ElementID).toBe(first.ElementID);
            freshState.Dispose();
        });

        it('SetFormView marks the state dirty and is idempotent', () => {
            const first = state.SetFormView();
            expect(first.Success).toBe(true);
            expect(state.IsDirty).toBe(true);

            const second = state.SetFormView();
            expect(second.ElementID).toBe(first.ElementID);
        });

        it('SetTabbedFormView marks the state dirty and AddFormTab composes into it', () => {
            const formResult = state.SetTabbedFormView();
            expect(formResult.Success).toBe(true);

            const tabResult = state.AddFormTab('crm.people.tab.identification');
            expect(tabResult.Success).toBe(true);
        });

        it('AddColumn marks the state dirty on success', () => {
            const result = state.AddColumn('Nome');
            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('AddButton marks the state dirty on success', () => {
            const result = state.AddButton('buttonBar.new');
            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('AddFilter marks the state dirty on success', () => {
            const result = state.AddFilter('Nome');
            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('AddRowAction marks the state dirty on success', () => {
            const result = state.AddRowAction('orders.invoice');
            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('AddViewer marks the state dirty on success', () => {
            const result = state.AddViewer('resumo');
            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('AddColumn/AddFilter/AddButton/AddRowAction/AddViewer report failure without an application', () => {
            const emptyState = new XAppDesignerState(mockDocument);

            expect(emptyState.AddColumn('Nome').Success).toBe(false);
            expect(emptyState.AddFilter('Nome').Success).toBe(false);
            expect(emptyState.AddButton('x').Success).toBe(false);
            expect(emptyState.AddRowAction('x').Success).toBe(false);
            expect(emptyState.AddViewer('x').Success).toBe(false);
            expect(emptyState.IsDirty).toBe(false);

            emptyState.Dispose();
        });

        it('AddFormTab reports failure when there is no tabbed form view yet', () => {
            const result = state.AddFormTab('x');
            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('AddFormSection reports failure for an unknown parent', () => {
            const result = state.AddFormSection({ ParentID: 'does-not-exist' });
            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('AddField reports failure for an unknown section', () => {
            const result = state.AddField({ SectionID: 'does-not-exist', FieldName: 'Nome', Row: 0, ColSpan: 32 });
            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('UpdateProperty reports failure for an unknown element', () => {
            const result = state.UpdateProperty('does-not-exist', 'TitleKey', 'x');
            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('DeleteSelected reports no selection when nothing is selected', () => {
            state.SelectionService.Clear();
            const result = state.DeleteSelected();
            expect(result).toEqual({ Success: false, Message: 'No selection.' });
        });

        it('DeleteSelected removes every selected element and clears the selection', () => {
            const columnResult = state.AddColumn('Nome');
            state.SelectionService.Select(columnResult.ElementID!);

            const result = state.DeleteSelected();

            expect(result.Success).toBe(true);
            expect(state.SelectionService.HasSelection).toBe(false);
        });

        it('DeleteSelected reports failure when an element cannot be removed', () => {
            state.SelectionService.Select('does-not-exist');

            const result = state.DeleteSelected();

            expect(result.Success).toBe(false);
            expect(state.SelectionService.HasSelection).toBe(true); // não limpa em falha parcial
            state.SelectionService.Clear();
        });

        it('RenameSelected reports no selection when nothing is selected', () => {
            state.SelectionService.Clear();
            const result = state.RenameSelected('Novo Nome');
            expect(result).toEqual({ Success: false, Message: 'No selection.' });
        });

        it('RenameSelected renames the primary selection and marks the state dirty', () => {
            const columnResult = state.AddColumn('Nome');
            state.SelectionService.Select(columnResult.ElementID!);

            const result = state.RenameSelected('NomeRenomeado');

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
            state.SelectionService.Clear();
        });

        it('AddFormSection and AddField compose into the form view', () => {
            const app = state.Bridge.Controller!.GetApplication()!;
            const form = app.SetFormView();

            const sectionResult = state.AddFormSection({ ParentID: form.ID });
            expect(sectionResult.Success).toBe(true);

            const fieldResult = state.AddField({ SectionID: sectionResult.ElementID!, FieldName: 'Preco', Row: 0, ColSpan: 16 });
            expect(fieldResult.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('UpdateProperty marks the state dirty on success', () => {
            const app = state.Bridge.Controller!.GetApplication()!;
            const result = state.UpdateProperty(app.ID, 'TitleKey', 'sys.plans.title');
            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('GetProperties delegates to the bridge (used by the shared Dase.Properties panel)', () => {
            const app = state.Bridge.Controller!.GetApplication()!;
            const props = state.GetProperties(app.ID);
            expect(props.some(p => p.Key === 'TitleKey')).toBe(true);
        });

        it('GetElementInfo resolves an element by ID', () => {
            const columnResult = state.AddColumn('Nome');
            const info = state.GetElementInfo(columnResult.ElementID!);
            expect(info?.Type).toBe('XAPPColumn');
        });

        it('GetElementInfo returns null for an unknown ID', () => {
            expect(state.GetElementInfo('does-not-exist')).toBeNull();
        });

        it('RefreshIssues republishes the last validation result', () => {
            const issues = state.Validate();
            const setIssuesSpy = jest.spyOn(state.IssueService, 'SetIssues');

            state.RefreshIssues();

            expect(setIssuesSpy).toHaveBeenCalledWith(issues);
        });
    });

    describe('Validate / GetModelData', () => {
        it('returns model data with the current application', async () => {
            await state.Load();
            state.Bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            const modelData = state.GetModelData();
            expect(modelData.Application?.Name).toBe('SYSxPlanos');
        });

        it('publishes issues to the IssueService', async () => {
            await state.Load();
            state.Bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            const setIssuesSpy = jest.spyOn(state.IssueService, 'SetIssues');
            const issues = state.Validate();

            expect(setIssuesSpy).toHaveBeenCalledWith(issues);
        });
    });
});
