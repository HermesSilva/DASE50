// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XORMDesignerState } from '../../../Designers/ORM/ORMDesignerState';
import { Uri, createMockTextDocument } from '../../__mocks__/vscode';

describe('XORMDesignerState', () => {
    let state: XORMDesignerState;
    let mockDocument: vscode.TextDocument;

    beforeEach(() => {
        jest.clearAllMocks();
        
        const uri = Uri.file('/test/model.dsorm');
        mockDocument = createMockTextDocument(uri, '{}') as unknown as vscode.TextDocument;
        state = new XORMDesignerState(mockDocument);
    });

    afterEach(() => {
        state.Dispose();
    });

    describe('constructor', () => {
        it('should initialize with document', () => {
            expect(state.Document).toBe(mockDocument);
        });

        it('should initialize as not dirty', () => {
            expect(state.IsDirty).toBe(false);
        });

        it('should have Bridge property', () => {
            expect(state.Bridge).toBeDefined();
        });
    });

    describe('IsUntitled', () => {
        it('should return false for file scheme', () => {
            expect(state.IsUntitled).toBe(false);
        });

        it('should return true for untitled scheme', () => {
            const untitledUri = Uri.parse('untitled:Untitled-1.dsorm');
            const untitledDoc = createMockTextDocument(untitledUri) as unknown as vscode.TextDocument;
            const untitledState = new XORMDesignerState(untitledDoc);

            expect(untitledState.IsUntitled).toBe(true);
            untitledState.Dispose();
        });
    });

    describe('IsDirty', () => {
        it('should update dirty state', () => {
            state.IsDirty = true;

            expect(state.IsDirty).toBe(true);
        });

        it('should fire OnStateChanged when dirty changes', () => {
            const mockListener = jest.fn();
            state.OnStateChanged(mockListener);

            state.IsDirty = true;

            expect(mockListener).toHaveBeenCalledWith({ IsDirty: true });
        });

        it('should not fire when setting same value', () => {
            const mockListener = jest.fn();
            state.IsDirty = false; // Set initial
            state.OnStateChanged(mockListener);

            state.IsDirty = false; // Same value

            expect(mockListener).not.toHaveBeenCalled();
        });
    });

    describe('Load', () => {
        it('should load model from file', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await state.Load();

            expect(state.IsDirty).toBe(false);
        });

        it('should mark untitled as dirty after load', async () => {
            const untitledUri = Uri.parse('untitled:Untitled-1.dsorm');
            const untitledDoc = createMockTextDocument(untitledUri) as unknown as vscode.TextDocument;
            const untitledState = new XORMDesignerState(untitledDoc);

            await untitledState.Load();

            expect(untitledState.IsDirty).toBe(true);
            untitledState.Dispose();
        });

        it('should throw error when readFile fails', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

            await expect(state.Load()).rejects.toThrow('File not found');
        });
    });

    describe('Save', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should save model to file', async () => {
            state.IsDirty = true;

            await state.Save();

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
            expect(state.IsDirty).toBe(false);
        });

        it('should not write file for untitled documents', async () => {
            const untitledUri = Uri.parse('untitled:Untitled-1.dsorm');
            const untitledDoc = createMockTextDocument(untitledUri) as unknown as vscode.TextDocument;
            const untitledState = new XORMDesignerState(untitledDoc);

            await untitledState.Save();

            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
            untitledState.Dispose();
        });

        it('should throw error when writeFile fails', async () => {
            (vscode.workspace.fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));
            state.IsDirty = true;

            await expect(state.Save()).rejects.toThrow('Write failed');
        });
    });

    describe('AddTable', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
            state.Bridge.AddTable = jest.fn().mockReturnValue({ Success: true });
        });

        it('should add table and mark dirty', async () => {
            const result = await state.AddTable(100, 200, 'NewTable');

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should call Bridge.AddTable with correct params', async () => {
            await state.AddTable(150, 250, 'TestTable');

            expect(state.Bridge.AddTable).toHaveBeenCalledWith(150, 250, 'TestTable');
        });
    });

    describe('AddReference', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
            state.Bridge.AddReference = jest.fn().mockReturnValue({ Success: true });
        });

        it('should add reference and mark dirty', () => {
            const result = state.AddReference('source-1', 'target-1', 'RefName');

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should not mark dirty when add fails', () => {
            state.Bridge.AddReference = jest.fn().mockReturnValue({ Success: false });
            
            const result = state.AddReference('source-1', 'target-1', 'RefName');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('should handle null result from bridge', () => {
            state.Bridge.AddReference = jest.fn().mockReturnValue(null);
            
            const result = state.AddReference('source-1', 'target-1', 'RefName');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('DeleteSelected', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should return failure when no selection', () => {
            const result = state.DeleteSelected();

            expect(result.Success).toBe(false);
            expect(result.Message).toBe('No selection.');
        });

        it('should delete selected elements and mark dirty', () => {
            // Mock SelectionService with selection
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'SelectedIDs', { value: ['elem-1', 'elem-2'], writable: true });
            selectionService.Clear = jest.fn();

            // Mock Bridge.DeleteElement - returns XIOperationResult
            state.Bridge.DeleteElement = jest.fn().mockReturnValue({ Success: true });

            const result = state.DeleteSelected();

            expect(result.Success).toBe(true);
            expect(state.Bridge.DeleteElement).toHaveBeenCalledWith('elem-1');
            expect(state.Bridge.DeleteElement).toHaveBeenCalledWith('elem-2');
            expect(selectionService.Clear).toHaveBeenCalled();
            expect(state.IsDirty).toBe(true);
        });

        it('should return failure when DeleteElement fails', () => {
            // Mock SelectionService with selection
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'SelectedIDs', { value: ['elem-1'], writable: true });
            selectionService.Clear = jest.fn();

            // Mock Bridge.DeleteElement to fail - returns XIOperationResult
            state.Bridge.DeleteElement = jest.fn().mockReturnValue({ Success: false });

            const result = state.DeleteSelected();

            expect(result.Success).toBe(false);
        });
    });

    describe('RenameSelected', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should return failure when no selection', () => {
            const result = state.RenameSelected('NewName');

            expect(result.Success).toBe(false);
            expect(result.Message).toBe('No selection.');
        });

        it('should return failure when no PrimaryID', () => {
            // Mock SelectionService with selection but no PrimaryID
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'PrimaryID', { value: null, writable: true });

            const result = state.RenameSelected('NewName');

            expect(result.Success).toBe(false);
            expect(result.Message).toBe('No selection.');
        });

        it('should rename selected element and mark dirty', () => {
            // Mock SelectionService with selection and PrimaryID
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'PrimaryID', { value: 'elem-1', writable: true });

            // Mock Bridge.RenameElement - returns XIOperationResult
            state.Bridge.RenameElement = jest.fn().mockReturnValue({ Success: true });

            const result = state.RenameSelected('NewName');

            expect(result.Success).toBe(true);
            expect(state.Bridge.RenameElement).toHaveBeenCalledWith('elem-1', 'NewName');
            expect(state.IsDirty).toBe(true);
        });

        it('should return failure when RenameElement fails', () => {
            // Mock SelectionService with selection and PrimaryID
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'PrimaryID', { value: 'elem-1', writable: true });

            // Mock Bridge.RenameElement to fail - returns XIOperationResult
            state.Bridge.RenameElement = jest.fn().mockReturnValue({ Success: false });

            const result = state.RenameSelected('NewName');

            expect(result.Success).toBe(false);
        });
    });

    describe('MoveElement', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
            // Mock Bridge.MoveElement - returns XIOperationResult
            state.Bridge.MoveElement = jest.fn().mockReturnValue({ Success: true });
        });

        it('should move element and mark dirty', () => {
            const result = state.MoveElement('elem-1', 300, 400);

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should not mark dirty when move fails', () => {
            state.Bridge.MoveElement = jest.fn().mockReturnValue({ Success: false });
            
            const result = state.MoveElement('elem-1', 300, 400);

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('UpdateProperty', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
            // Mock Bridge.UpdateProperty - returns XIOperationResult
            state.Bridge.UpdateProperty = jest.fn().mockReturnValue({ Success: true });
        });

        it('should update property and mark dirty', () => {
            const result = state.UpdateProperty('elem-1', 'Name', 'NewName');

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should not mark dirty when update fails', () => {
            state.Bridge.UpdateProperty = jest.fn().mockReturnValue({ Success: false });
            
            const result = state.UpdateProperty('elem-1', 'Name', 'NewName');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('GetModelData', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should return model data from bridge', async () => {
            const mockData = { Tables: [], References: [] };
            state.Bridge.GetModelData = jest.fn().mockResolvedValue(mockData);

            const data = await state.GetModelData();

            expect(data).toEqual(mockData);
        });
    });

    describe('Validate', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should return validation issues', async () => {
            const mockIssues = [{ ElementID: 'elem-1', Message: 'Error' }];
            state.Bridge.ValidateOrmModel = jest.fn().mockResolvedValue(mockIssues);

            const issues = await state.Validate();

            expect(issues).toEqual(mockIssues);
        });
    });

    describe('GetProperties', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should return properties from bridge', async () => {
            const mockProps = [{ Key: 'Name', Name: 'Name', Value: 'Test' }];
            state.Bridge.GetProperties = jest.fn().mockResolvedValue(mockProps);

            const props = await state.GetProperties('elem-1');

            expect(props).toEqual(mockProps);
        });
    });

    describe('IssueService', () => {
        it('should return issue service', () => {
            expect(state.IssueService).toBeDefined();
        });
    });

    describe('SelectionService', () => {
        it('should return selection service', () => {
            expect(state.SelectionService).toBeDefined();
        });
    });

    describe('Dispose', () => {
        it('should dispose without error', () => {
            expect(() => state.Dispose()).not.toThrow();
        });
    });

    describe('DocumentUri', () => {
        it('should return document uri as string', () => {
            const uri = state.DocumentUri;

            expect(typeof uri).toBe('string');
            expect(uri).toBeTruthy();
        });
    });

    describe('AddField', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should add field and mark dirty on success', () => {
            state.Bridge.AddField = jest.fn().mockReturnValue({ Success: true });

            const result = state.AddField('table-1', 'NewField', 'String');

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should not mark dirty when add fails', () => {
            state.Bridge.AddField = jest.fn().mockReturnValue({ Success: false });

            const result = state.AddField('table-1', 'NewField', 'String');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('should handle null result from bridge', () => {
            state.Bridge.AddField = jest.fn().mockReturnValue(null);

            const result = state.AddField('table-1', 'NewField', 'String');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('AlignLines', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should align lines and mark dirty on success', () => {
            state.Bridge.AlignLines = jest.fn().mockReturnValue(true);

            const result = state.AlignLines();

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should not mark dirty when align returns false', () => {
            state.Bridge.AlignLines = jest.fn().mockReturnValue(false);

            const result = state.AlignLines();

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('AddTable null result', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should handle null result from Bridge.AddTable', () => {
            state.Bridge.AddTable = jest.fn().mockReturnValue(null);

            const result = state.AddTable(100, 200, 'NewTable');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('RenameSelected null result', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should handle null result from Bridge.RenameElement', () => {
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'PrimaryID', { value: 'elem-1', writable: true });
            state.Bridge.RenameElement = jest.fn().mockReturnValue(null);

            const result = state.RenameSelected('NewName');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('MoveElement null result', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should handle null result from Bridge.MoveElement', () => {
            state.Bridge.MoveElement = jest.fn().mockReturnValue(null);

            const result = state.MoveElement('elem-1', 300, 400);

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('UpdateProperty null result', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should handle null result from Bridge.UpdateProperty', () => {
            state.Bridge.UpdateProperty = jest.fn().mockReturnValue(null);

            const result = state.UpdateProperty('elem-1', 'Name', 'NewName');

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('DeleteSelected null result', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should handle null result from Bridge.DeleteElement', () => {
            const selectionService = state.SelectionService;
            Object.defineProperty(selectionService, 'HasSelection', { value: true, writable: true });
            Object.defineProperty(selectionService, 'SelectedIDs', { value: ['elem-1'], writable: true });
            selectionService.Clear = jest.fn();
            state.Bridge.DeleteElement = jest.fn().mockReturnValue(null);

            const result = state.DeleteSelected();

            expect(result.Success).toBe(false);
        });
    });
});
