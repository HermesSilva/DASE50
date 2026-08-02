import * as vscode from "vscode";
import { XAppDesignerEditorProvider } from "../AppDesignerEditorProvider";

export class XNewAppDesignerCommand
{
    private readonly _Provider: XAppDesignerEditorProvider;
    private static _UntitledCounter: number = 1;

    constructor(pProvider: XAppDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.NewAppDesigner";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XAppDesignerEditorProvider): XNewAppDesignerCommand
    {
        const command = new XNewAppDesignerCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XNewAppDesignerCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        const untitledUri = vscode.Uri.parse(`untitled:Untitled-${XNewAppDesignerCommand._UntitledCounter++}.dsapp`);

        await vscode.commands.executeCommand(
            "vscode.openWith",
            untitledUri,
            XAppDesignerEditorProvider.ViewType
        );
    }
}

module.exports = { XNewAppDesignerCommand };
