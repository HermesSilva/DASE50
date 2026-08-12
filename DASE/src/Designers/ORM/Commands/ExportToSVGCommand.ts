import * as vscode from "vscode";
import { GetLogService } from "../../../Services/LogService";

/**
 * O SVG chega pronto do webview (ExportCanvasAsSVG em OrmDesigner.js), que já resolveu os
 * estilos computados — o comando só grava o que recebeu. Não há como remontar o desenho aqui:
 * é o webview que tem o DOM do canvas, cores de tema e posições atuais.
 */
export class XExportToSVGCommand {
    static get CommandID(): string {
        return "Dase.ExportToSVG";
    }

    static Register(pContext: vscode.ExtensionContext): XExportToSVGCommand {
        const command = new XExportToSVGCommand();
        const disposable = vscode.commands.registerCommand(
            XExportToSVGCommand.CommandID,
            (pSvgContent?: string) => command.Execute(pSvgContent)
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(pSvgContent?: string): Promise<void> {
        if (!pSvgContent) {
            vscode.window.showErrorMessage("No diagram to export. Open an ORM Designer and try again.");
            return;
        }

        try {
            const targetUri = await vscode.window.showSaveDialog({
                filters: { "SVG Image": ["svg"] },
                title: "Export Diagram to SVG"
            });

            if (!targetUri)
                return;

            const bytes = Buffer.from(pSvgContent, "utf8");
            await vscode.workspace.fs.writeFile(targetUri, bytes);

            vscode.window.showInformationMessage(`Successfully exported diagram to ${targetUri.fsPath}`);
            GetLogService().Info(`Exported SVG to ${targetUri.fsPath}`);
        }
        catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export to SVG: ${error.message}`);
            GetLogService().Error("Failed to export SVG", error);
        }
    }
}

module.exports = { XExportToSVGCommand };
