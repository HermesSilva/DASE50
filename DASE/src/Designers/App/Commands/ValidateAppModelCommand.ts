import * as vscode from "vscode";
import { XAppDesignerEditorProvider } from "../AppDesignerEditorProvider";

export class XValidateAppModelCommand
{
    private _Provider: XAppDesignerEditorProvider;

    constructor(pProvider: XAppDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.ValidateAppModel";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XAppDesignerEditorProvider): XValidateAppModelCommand
    {
        const command = new XValidateAppModelCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XValidateAppModelCommand.CommandID,
            (pUri: vscode.Uri) => command.Execute(pUri)
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(pUri?: vscode.Uri): Promise<void>
    {
        let targetUri = pUri;

        if (!targetUri)
            targetUri = this._Provider.GetActiveUri() || undefined;

        if (!targetUri)
        {
            vscode.window.showWarningMessage("No App designer is active.");
            return;
        }

        await this._Provider.ValidateModel(targetUri);
    }
}
