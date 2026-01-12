import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";

export class XNewORMDesignerCommand
{
    private readonly _Provider: XORMDesignerEditorProvider;
    private static _UntitledCounter: number = 1;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.NewORMDesigner";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XNewORMDesignerCommand
    {
        const command = new XNewORMDesignerCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XNewORMDesignerCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        const untitledUri = vscode.Uri.parse(`untitled:Untitled-${XNewORMDesignerCommand._UntitledCounter++}.dsorm`);

        await vscode.commands.executeCommand(
            "vscode.openWith",
            untitledUri,
            XORMDesignerEditorProvider.ViewType
        );
    }
}

module.exports = { XNewORMDesignerCommand };
