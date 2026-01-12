// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XAddTableCommand } from '../../../../Designers/ORM/Commands/AddTableCommand';
import { XORMDesignerEditorProvider } from '../../../../Designers/ORM/ORMDesignerEditorProvider';

describe('XAddTableCommand', () => {
    let mockProvider: jest.Mocked<XORMDesignerEditorProvider>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProvider = {
            AddTableToActiveDesigner: jest.fn()
        } as any;

        mockContext = {
            subscriptions: []
        } as any;
    });

    describe('CommandID', () => {
        it('should return correct command ID', () => {
            expect(XAddTableCommand.CommandID).toBe('Dase.AddTable');
        });
    });

    describe('Register', () => {
        it('should register command', () => {
            XAddTableCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'Dase.AddTable',
                expect.any(Function)
            );
        });

        it('should add disposable to subscriptions', () => {
            XAddTableCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it('should return command instance', () => {
            const command = XAddTableCommand.Register(mockContext, mockProvider);

            expect(command).toBeInstanceOf(XAddTableCommand);
        });

        it('should execute command when callback is invoked', async () => {
            XAddTableCommand.Register(mockContext, mockProvider);

            // Get the callback function passed to registerCommand
            const registerCall = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
            const callback = registerCall[1];
            
            // Execute the callback
            await callback();

            expect(mockProvider.AddTableToActiveDesigner).toHaveBeenCalled();
        });
    });

    describe('Execute', () => {
        it('should call AddTableToActiveDesigner on provider', async () => {
            const command = new XAddTableCommand(mockProvider);

            await command.Execute();

            expect(mockProvider.AddTableToActiveDesigner).toHaveBeenCalled();
        });
    });
});
