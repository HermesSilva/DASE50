import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "./Designers/ORM/ORMDesignerEditorProvider";
import { XNewORMDesignerCommand } from "./Designers/ORM/Commands/NewORMDesignerCommand";
import { XOpenORMDesignerCommand } from "./Designers/ORM/Commands/OpenORMDesignerCommand";
import { XAddTableCommand } from "./Designers/ORM/Commands/AddTableCommand";
import { XAddFieldCommand } from "./Designers/ORM/Commands/AddFieldCommand";
import { XAlignLinesCommand } from "./Designers/ORM/Commands/AlignLinesCommand";
import { XValidateORMModelCommand } from "./Designers/ORM/Commands/ValidateORMModelCommand";
import { XDeleteSelectedCommand } from "./Commands/DeleteSelectedCommand";
import { XRenameSelectedCommand } from "./Commands/RenameSelectedCommand";
import { XIssuesViewProvider } from "./Views/IssuesViewProvider";
import { XPropertiesViewProvider } from "./Views/PropertiesViewProvider";
import { InitializeLogService, GetLogService } from "./Services/LogService";

export function activate(pContext: vscode.ExtensionContext): void
{
    const log = InitializeLogService(pContext);
    log.Info("DASE extension is activating...");

    try
    {
        const designerProvider = XORMDesignerEditorProvider.Register(pContext);

        XNewORMDesignerCommand.Register(pContext, designerProvider);
        XOpenORMDesignerCommand.Register(pContext, designerProvider);
        XAddTableCommand.Register(pContext, designerProvider);
        XAddFieldCommand.Register(pContext, designerProvider);
        XAlignLinesCommand.Register(pContext, designerProvider);
        XValidateORMModelCommand.Register(pContext, designerProvider);
        XDeleteSelectedCommand.Register(pContext, designerProvider);
        XRenameSelectedCommand.Register(pContext, designerProvider);

        XIssuesViewProvider.Register(pContext);
        XPropertiesViewProvider.Register(pContext, designerProvider);

        log.Info("DASE extension activated successfully");
    }
    catch (error)
    {
        log.Error("Failed to activate DASE extension", error);
        throw error;
    }
}

export function deactivate(): void
{
    GetLogService().Info("DASE extension deactivated");
}
