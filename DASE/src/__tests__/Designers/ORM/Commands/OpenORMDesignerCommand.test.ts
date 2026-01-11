// Importar mocks antes dos módulos reais
jest.mock('vscode');
jest.mock('@tootega/tfx');

import * as vscode from 'vscode';
import { XOpenORMDesignerCommand } from '../../../../Designers/ORM/Commands/OpenORMDesignerCommand';
import { XORMDesignerEditorProvider } from '../../../../Designers/ORM/ORMDesignerEditorProvider';
import { Uri, createMockTextDocument } from '../../../__mocks__/vscode';

describe('XOpenORMDesignerCommand', () => {
    let mockProvider: jest.Mocked<XORMDesignerEditorProvider>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProvider = {} as any;

        mockContext = {
            subscriptions: []
        } as any;

        // Reset activeTextEditor
        (vscode.window as any).activeTextEditor = undefined;
    });

    describe('CommandID', () => {
        it('should return correct command ID', () => {
            expect(XOpenORMDesignerCommand.CommandID).toBe('Dase.OpenORMDesigner');
        });
    });

    describe('Register', () => {
        it('should register command', () => {
            XOpenORMDesignerCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'Dase.OpenORMDesigner',
                expect.any(Function)
            );
        });

        it('should add disposable to subscriptions', () => {
            XOpenORMDesignerCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it('should return command instance', () => {
            const command = XOpenORMDesignerCommand.Register(mockContext, mockProvider);

            expect(command).toBeInstanceOf(XOpenORMDesignerCommand);
        });

        it('should execute command when callback is invoked', async () => {
            const uri = Uri.file('/test/model.daseorm.json');
            const mockDoc = createMockTextDocument(uri);
            (mockDoc as any).fileName = '/test/model.daseorm.json';
            
            (vscode.window as any).activeTextEditor = {
                document: mockDoc
            };
            
            XOpenORMDesignerCommand.Register(mockContext, mockProvider);

            // Get the callback function passed to registerCommand
            const registerCall = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
            const callback = registerCall[1];
            
            // Execute the callback
            await callback();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openWith',
                expect.anything(),
                'Dase.ORMDesigner'
            );
        });
    });

    describe('Execute', () => {
        it('should open provided URI with ORM Designer', async () => {
            const command = new XOpenORMDesignerCommand(mockProvider);
            const uri = Uri.file('/test/model.daseorm.json');

            await command.Execute(uri as any);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openWith',
                uri,
                'Dase.ORMDesigner'
            );
        });

        it('should use active editor URI when no URI provided', async () => {
            const command = new XOpenORMDesignerCommand(mockProvider);
            const uri = Uri.file('/test/model.daseorm.json');
            const mockDoc = createMockTextDocument(uri);
            (mockDoc as any).fileName = '/test/model.daseorm.json';
            
            (vscode.window as any).activeTextEditor = {
                document: mockDoc
            };

            await command.Execute();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.openWith',
                uri,
                'Dase.ORMDesigner'
            );
        });

        it('should show warning when no URI and no active editor', async () => {
            const command = new XOpenORMDesignerCommand(mockProvider);
            (vscode.window as any).activeTextEditor = undefined;

            await command.Execute();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No ORM file selected.');
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        });

        it('should show warning when active editor is not ORM file', async () => {
            const command = new XOpenORMDesignerCommand(mockProvider);
            const uri = Uri.file('/test/other.json');
            const mockDoc = createMockTextDocument(uri);
            (mockDoc as any).fileName = '/test/other.json';
            
            (vscode.window as any).activeTextEditor = {
                document: mockDoc
            };

            await command.Execute();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No ORM file selected.');
        });
    });
});
