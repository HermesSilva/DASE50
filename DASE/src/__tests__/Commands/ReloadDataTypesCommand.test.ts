import { XReloadDataTypesCommand } from "../../Commands/ReloadDataTypesCommand";
import { XORMDesignerEditorProvider } from "../../Designers/ORM/ORMDesignerEditorProvider";
import * as vscode from "vscode";

jest.mock("vscode");

describe("ReloadDataTypesCommand", () => {
    let mockProvider: jest.Mocked<XORMDesignerEditorProvider>;
    let mockContext: jest.Mocked<vscode.ExtensionContext>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProvider = {
            GetActiveUri: jest.fn(),
            ReloadDataTypes: jest.fn()
        } as unknown as jest.Mocked<XORMDesignerEditorProvider>;

        mockContext = {
            subscriptions: []
        } as unknown as jest.Mocked<vscode.ExtensionContext>;
    });

    describe("CommandID", () => {
        it("should return the correct command ID", () => {
            expect(XReloadDataTypesCommand.CommandID).toBe("Dase.ReloadDataTypes");
        });
    });

    describe("Register", () => {
        it("should register the command with VS Code", () => {
            XReloadDataTypesCommand.Register(mockContext, mockProvider);

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                "Dase.ReloadDataTypes",
                expect.any(Function)
            );
        });

        it("should add disposable to context subscriptions", () => {
            XReloadDataTypesCommand.Register(mockContext, mockProvider);

            expect(mockContext.subscriptions.length).toBe(1);
        });

        it("should execute command when callback is invoked", async () => {
            mockProvider.GetActiveUri.mockReturnValue({ toString: () => "test" } as vscode.Uri);
            mockProvider.ReloadDataTypes.mockResolvedValue();

            XReloadDataTypesCommand.Register(mockContext, mockProvider);

            const callback = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1];
            await callback();

            expect(mockProvider.ReloadDataTypes).toHaveBeenCalled();
        });
    });

    describe("Execute", () => {
        it("should show warning when no designer is active", async () => {
            mockProvider.GetActiveUri.mockReturnValue(null);

            const command = new XReloadDataTypesCommand(mockProvider);
            await command.Execute();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                "No ORM designer is active."
            );
            expect(mockProvider.ReloadDataTypes).not.toHaveBeenCalled();
        });

        it("should call ReloadDataTypes and show message when designer is active", async () => {
            const mockUri = { toString: () => "file:///test.dsorm" } as vscode.Uri;
            mockProvider.GetActiveUri.mockReturnValue(mockUri);
            mockProvider.ReloadDataTypes.mockResolvedValue();

            const command = new XReloadDataTypesCommand(mockProvider);
            await command.Execute();

            expect(mockProvider.ReloadDataTypes).toHaveBeenCalledWith(mockUri);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                "Data types reloaded from configuration."
            );
        });
    });
});
