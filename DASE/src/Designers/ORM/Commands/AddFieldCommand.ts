import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";

export class XAddFieldCommand
{
    private readonly _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.AddField";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XAddFieldCommand
    {
        const command = new XAddFieldCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XAddFieldCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        this._Provider.AddFieldToSelectedTable();
    }
}

module.exports = { XAddFieldCommand };
