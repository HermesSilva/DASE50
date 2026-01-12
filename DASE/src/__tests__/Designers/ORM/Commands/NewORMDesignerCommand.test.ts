// Importar mocks antes dos módulos reais
jest.mock('vscode');
jest.mock('@tootega/tfx');

import * as vscode from 'vscode';
import { XNewORMDesignerCommand } from '../../../../Designers/ORM/Commands/NewORMDesignerCommand';
import { XORMDesignerEditorProvider } from '../../../../Designers/ORM/ORMDesignerEditorProvider';

describe('XNewORMDesignerCommand', () => {
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
            expect(XNewORMDesignerCommand.CommandID).toBe('Dase.NewORMDesigner');
        });
    });

    describe('Register', () => {
        it('should register command', () => {
            XNewORMDesignerCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'Dase.NewORMDesigner',
                expect.any(Function)
            );
        });

        it('should add disposable to subscriptions', () => {
            XNewORMDesignerCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it('should return command instance', () => {
            const command = XNewORMDesignerCommand.Register(mockContext, mockProvider);

            expect(command).toBeInstanceOf(XNewORMDesignerCommand);
        });

        it('should execute command when callback is invoked', async () => {
            XNewORMDesignerCommand.Register(mockContext, mockProvider);

            // Get the callback function passed to registerCommand
            const registerCall = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
            const callback = registerCall[1];
            
            // Execute the callback
            await callback();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openWith',
                expect.objectContaining({
                    scheme: 'untitled'
                }),
                'Dase.ORMDesigner'
            );
        });
    });

    describe('Execute', () => {
        it('should open untitled file with ORM Designer', async () => {
            const command = new XNewORMDesignerCommand(mockProvider);

            await command.Execute();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openWith',
                expect.objectContaining({
                    scheme: 'untitled'
                }),
                'Dase.ORMDesigner'
            );
        });

        it('should generate unique untitled file names', async () => {
            const command = new XNewORMDesignerCommand(mockProvider);

            await command.Execute();
            await command.Execute();

            const calls = (vscode.commands.executeCommand as jest.Mock).mock.calls;
            const uri1 = calls[0][1];
            const uri2 = calls[1][1];

            expect(uri1.toString()).not.toBe(uri2.toString());
        });

        it('should use .dsorm extension', async () => {
            const command = new XNewORMDesignerCommand(mockProvider);

            await command.Execute();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openWith',
                expect.objectContaining({
                    path: expect.stringContaining('.dsorm')
                }),
                expect.any(String)
            );
        });
    });
});
