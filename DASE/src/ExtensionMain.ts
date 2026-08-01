import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "./Designers/ORM/ORMDesignerEditorProvider";
import { XNewORMDesignerCommand } from "./Designers/ORM/Commands/NewORMDesignerCommand";
import { XOpenORMDesignerCommand } from "./Designers/ORM/Commands/OpenORMDesignerCommand";
import { XAddTableCommand } from "./Designers/ORM/Commands/AddTableCommand";
import { XAddFieldCommand } from "./Designers/ORM/Commands/AddFieldCommand";
import { XAlignLinesCommand } from "./Designers/ORM/Commands/AlignLinesCommand";
import { XValidateORMModelCommand } from "./Designers/ORM/Commands/ValidateORMModelCommand";
import { XExportToDBMLCommand } from "./Designers/ORM/Commands/ExportToDBMLCommand";
import { XImportFromDBMLCommand } from "./Designers/ORM/Commands/ImportFromDBMLCommand";
import { XDeleteSelectedCommand } from "./Commands/DeleteSelectedCommand";
import { XRenameSelectedCommand } from "./Commands/RenameSelectedCommand";
import { XReloadDataTypesCommand } from "./Commands/ReloadDataTypesCommand";
import { XIssuesViewProvider } from "./Views/IssuesViewProvider";
import { XPropertiesViewProvider } from "./Views/PropertiesViewProvider";
import { InitializeLogService, GetLogService } from "./Services/LogService";
import { XGeneratedFileGuard } from "./Services/GeneratedFileGuard";
import { RegisterAgentIntegration } from "./AgentIntegration";
import { RegisterClaudeCliProvider } from "./AgentIntegration/ClaudeCli";
import { XOrganizeTablesCommand } from "./Designers/ORM/Commands/OrganizeTablesCommand";
import { XCreateSQLScriptCommand } from "./Designers/ORM/Commands/CreateSQLScriptCommand";
import { XGenerateORMCodeCommand } from "./Designers/ORM/Commands/GenerateORMCodeCommand";
import { XDetachDesignerCommand } from "./Designers/ORM/Commands/DetachDesignerCommand";

export function activate(pContext: vscode.ExtensionContext): void {
    const log = InitializeLogService(pContext);
    const version = (pContext.extension?.packageJSON?.version as string | undefined) ?? "unknown";
    log.Info(`DASE extension v${version} is activating...`);

    try {
        const designerProvider = XORMDesignerEditorProvider.Register(pContext);

        XNewORMDesignerCommand.Register(pContext, designerProvider);
        XOpenORMDesignerCommand.Register(pContext, designerProvider);
        XAddTableCommand.Register(pContext, designerProvider);
        XAddFieldCommand.Register(pContext, designerProvider);
        XAlignLinesCommand.Register(pContext, designerProvider);
        XExportToDBMLCommand.Register(pContext, designerProvider);
        XImportFromDBMLCommand.Register(pContext);
        XValidateORMModelCommand.Register(pContext, designerProvider);
        XDeleteSelectedCommand.Register(pContext, designerProvider);
        XRenameSelectedCommand.Register(pContext, designerProvider);
        XReloadDataTypesCommand.Register(pContext, designerProvider);
        XOrganizeTablesCommand.Register(pContext, designerProvider);
        XCreateSQLScriptCommand.Register(pContext, designerProvider);
        XGenerateORMCodeCommand.Register(pContext, designerProvider);
        XDetachDesignerCommand.Register(pContext);

        XIssuesViewProvider.Register(pContext);
        XPropertiesViewProvider.Register(pContext, designerProvider);

        // Protege os arquivos gerados: abertos no editor, ficam somente-leitura (na sessão).
        XGeneratedFileGuard.Register(pContext);

        // Register AI Agent Integration (Chat Participant + Language Model Tools)
        RegisterAgentIntegration(pContext, designerProvider);

        // Register Claude Code CLI as a Language Model provider (best-effort)
        RegisterClaudeCliProvider(pContext);

        log.Info("DASE extension activated successfully");
    }
    catch (error) {
        log.Error("Failed to activate DASE extension", error);
        throw error;
    }
}

export function deactivate(): void {
    GetLogService().Info("DASE extension deactivated");
}
