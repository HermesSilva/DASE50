// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XDeleteSelectedCommand } from '../../Commands/DeleteSelectedCommand';
import { XORMDesignerEditorProvider } from '../../Designers/ORM/ORMDesignerEditorProvider';
import { Uri } from '../__mocks__/vscode';

describe('XDeleteSelectedCommand', () => {
    let mockProvider: jest.Mocked<XORMDesignerEditorProvider>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProvider = {
            DeleteSelected: jest.fn(),
            GetActiveUri: jest.fn().mockReturnValue(null)
        } as any;

        mockContext = {
            subscriptions: []
        } as any;
    });

    describe('CommandID', () => {
        it('should return correct command ID', () => {
            expect(XDeleteSelectedCommand.CommandID).toBe('Dase.DeleteSelected');
        });
    });

    describe('Register', () => {
        it('should register command', () => {
            XDeleteSelectedCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'Dase.DeleteSelected',
                expect.any(Function)
            );
        });

        it('should add disposable to subscriptions', () => {
            XDeleteSelectedCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it('should return command instance', () => {
            const command = XDeleteSelectedCommand.Register(mockContext, mockProvider);

            expect(command).toBeInstanceOf(XDeleteSelectedCommand);
        });

        it('should execute command when callback is invoked', async () => {
            const activeUri = Uri.file('/test/model.dsorm');
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(activeUri);
            
            XDeleteSelectedCommand.Register(mockContext, mockProvider);

            // Get the callback function passed to registerCommand
            const registerCall = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
            const callback = registerCall[1];
            
            // Execute the callback
            await callback();

            expect(mockProvider.DeleteSelected).toHaveBeenCalledWith(activeUri);
        });
    });

    describe('Execute', () => {
        it('should delete selected when active URI exists', async () => {
            const activeUri = Uri.file('/test/model.dsorm');
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(activeUri);
            const command = new XDeleteSelectedCommand(mockProvider);

            await command.Execute();

            expect(mockProvider.DeleteSelected).toHaveBeenCalledWith(activeUri);
        });

        it('should show warning when no active designer', async () => {
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(null);
            const command = new XDeleteSelectedCommand(mockProvider);

            await command.Execute();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No ORM designer is active.');
            expect(mockProvider.DeleteSelected).not.toHaveBeenCalled();
        });
    });
});
