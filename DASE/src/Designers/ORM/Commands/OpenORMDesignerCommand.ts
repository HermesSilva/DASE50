import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";

export class XOpenORMDesignerCommand
{
    // Provider kept for future use (e.g., status queries)
    private readonly _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.OpenORMDesigner";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XOpenORMDesignerCommand
    {
        const command = new XOpenORMDesignerCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XOpenORMDesignerCommand.CommandID,
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
            if (activeEditor && activeEditor.document.fileName.endsWith(".dsorm"))
                targetUri = activeEditor.document.uri;
        }

        if (!targetUri)
        {
            vscode.window.showWarningMessage("No ORM file selected.");
            return;
        }

        await vscode.commands.executeCommand(
            "vscode.openWith",
            targetUri,
            XORMDesignerEditorProvider.ViewType
        );
    }
}

module.exports = { XOpenORMDesignerCommand };
