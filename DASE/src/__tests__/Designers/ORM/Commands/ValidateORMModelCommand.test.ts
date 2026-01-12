// Importar mocks antes dos módulos reais
jest.mock('vscode');
jest.mock('@tootega/tfx');

import * as vscode from 'vscode';
import { XValidateORMModelCommand } from '../../../../Designers/ORM/Commands/ValidateORMModelCommand';
import { XORMDesignerEditorProvider } from '../../../../Designers/ORM/ORMDesignerEditorProvider';
import { Uri } from '../../../__mocks__/vscode';

describe('XValidateORMModelCommand', () => {
    let mockProvider: jest.Mocked<XORMDesignerEditorProvider>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProvider = {
            ValidateModel: jest.fn(),
            GetActiveUri: jest.fn().mockReturnValue(null)
        } as any;

        mockContext = {
            subscriptions: []
        } as any;
    });

    describe('CommandID', () => {
        it('should return correct command ID', () => {
            expect(XValidateORMModelCommand.CommandID).toBe('Dase.ValidateORMModel');
        });
    });

    describe('Register', () => {
        it('should register command', () => {
            XValidateORMModelCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'Dase.ValidateORMModel',
                expect.any(Function)
            );
        });

        it('should add disposable to subscriptions', () => {
            XValidateORMModelCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it('should return command instance', () => {
            const command = XValidateORMModelCommand.Register(mockContext, mockProvider);

            expect(command).toBeInstanceOf(XValidateORMModelCommand);
        });

        it('should execute command when callback is invoked', async () => {
            const activeUri = Uri.file('/test/model.dsorm');
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(activeUri);
            
            XValidateORMModelCommand.Register(mockContext, mockProvider);

            // Get the callback function passed to registerCommand
            const registerCall = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
            const callback = registerCall[1];
            
            // Execute the callback
            await callback();

            expect(mockProvider.ValidateModel).toHaveBeenCalledWith(activeUri);
        });
    });

    describe('Execute', () => {
        it('should validate provided URI', async () => {
            const command = new XValidateORMModelCommand(mockProvider);
            const uri = Uri.file('/test/model.dsorm');

            await command.Execute(uri as any);

            expect(mockProvider.ValidateModel).toHaveBeenCalledWith(uri);
        });

        it('should use active URI when no URI provided', async () => {
            const activeUri = Uri.file('/test/active.dsorm');
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(activeUri);
            const command = new XValidateORMModelCommand(mockProvider);

            await command.Execute();

            expect(mockProvider.ValidateModel).toHaveBeenCalledWith(activeUri);
        });

        it('should show warning when no URI and no active designer', async () => {
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(null);
            const command = new XValidateORMModelCommand(mockProvider);

            await command.Execute();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No ORM designer is active.');
            expect(mockProvider.ValidateModel).not.toHaveBeenCalled();
        });
    });
});
