import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";

export class XAlignLinesCommand
{
    private readonly _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.AlignLines";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XAlignLinesCommand
    {
        const command = new XAlignLinesCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XAlignLinesCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        this._Provider.AlignLinesInActiveDesigner();
    }
}

module.exports = { XAlignLinesCommand };
