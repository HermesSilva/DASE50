import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";

export class XReloadDataTypesCommand
{
    private _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.ReloadDataTypes";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XReloadDataTypesCommand
    {
        const command = new XReloadDataTypesCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XReloadDataTypesCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        const uri = this._Provider.GetActiveUri();
        if (!uri)
        {
            vscode.window.showWarningMessage("No ORM designer is active.");
            return;
        }

        await this._Provider.ReloadDataTypes(uri);
        vscode.window.showInformationMessage("Data types reloaded from configuration.");
    }
}
