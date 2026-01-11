// Importar mocks antes dos módulos reais
jest.mock('vscode');
jest.mock('@tootega/tfx');

import * as vscode from 'vscode';
import { XRenameSelectedCommand } from '../../Commands/RenameSelectedCommand';
import { XORMDesignerEditorProvider } from '../../Designers/ORM/ORMDesignerEditorProvider';
import { Uri } from '../__mocks__/vscode';

describe('XRenameSelectedCommand', () => {
    let mockProvider: jest.Mocked<XORMDesignerEditorProvider>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProvider = {
            RenameSelected: jest.fn(),
            GetActiveUri: jest.fn().mockReturnValue(null)
        } as any;

        mockContext = {
            subscriptions: []
        } as any;
    });

    describe('CommandID', () => {
        it('should return correct command ID', () => {
            expect(XRenameSelectedCommand.CommandID).toBe('Dase.RenameSelected');
        });
    });

    describe('Register', () => {
        it('should register command', () => {
            XRenameSelectedCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'Dase.RenameSelected',
                expect.any(Function)
            );
        });

        it('should add disposable to subscriptions', () => {
            XRenameSelectedCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it('should return command instance', () => {
            const command = XRenameSelectedCommand.Register(mockContext, mockProvider);

            expect(command).toBeInstanceOf(XRenameSelectedCommand);
        });

        it('should execute command when callback is invoked', async () => {
            const activeUri = Uri.file('/test/model.daseorm.json');
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(activeUri);
            
            XRenameSelectedCommand.Register(mockContext, mockProvider);

            // Get the callback function passed to registerCommand
            const registerCall = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
            const callback = registerCall[1];
            
            // Execute the callback
            await callback();

            expect(mockProvider.RenameSelected).toHaveBeenCalledWith(activeUri);
        });
    });

    describe('Execute', () => {
        it('should rename selected when active URI exists', async () => {
            const activeUri = Uri.file('/test/model.daseorm.json');
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(activeUri);
            const command = new XRenameSelectedCommand(mockProvider);

            await command.Execute();

            expect(mockProvider.RenameSelected).toHaveBeenCalledWith(activeUri);
        });

        it('should show warning when no active designer', async () => {
            mockProvider.GetActiveUri = jest.fn().mockReturnValue(null);
            const command = new XRenameSelectedCommand(mockProvider);

            await command.Execute();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No ORM designer is active.');
            expect(mockProvider.RenameSelected).not.toHaveBeenCalled();
        });
    });
});
