import * as vscode from "vscode";
import { XAppDesignerEditorProvider } from "../AppDesignerEditorProvider";

export class XOpenAppDesignerCommand
{
    private readonly _Provider: XAppDesignerEditorProvider;

    constructor(pProvider: XAppDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.OpenAppDesigner";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XAppDesignerEditorProvider): XOpenAppDesignerCommand
    {
        const command = new XOpenAppDesignerCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XOpenAppDesignerCommand.CommandID,
            (pUri: vscode.Uri) => command.Execute(pUri)
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(pUri?: vscode.Uri): Promise<void>
    {
        let targetUri = pUri;
        if (!targetUri)
        {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.fileName.endsWith(".dsapp"))
                targetUri = activeEditor.document.uri;
        }

        if (!targetUri)
        {
            vscode.window.showWarningMessage("No App file selected.");
            return;
        }

        await vscode.commands.executeCommand(
            "vscode.openWith",
            targetUri,
            XAppDesignerEditorProvider.ViewType
        );
    }
}

module.exports = { XOpenAppDesignerCommand };
