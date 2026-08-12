import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "./Designers/ORM/ORMDesignerEditorProvider";
import { XNewORMDesignerCommand } from "./Designers/ORM/Commands/NewORMDesignerCommand";
import { XOpenORMDesignerCommand } from "./Designers/ORM/Commands/OpenORMDesignerCommand";
import { XAddTableCommand } from "./Designers/ORM/Commands/AddTableCommand";
import { XAddFieldCommand } from "./Designers/ORM/Commands/AddFieldCommand";
import { XAlignLinesCommand } from "./Designers/ORM/Commands/AlignLinesCommand";
import { XValidateORMModelCommand } from "./Designers/ORM/Commands/ValidateORMModelCommand";
import { XExportToDBMLCommand } from "./Designers/ORM/Commands/ExportToDBMLCommand";
import { XExportToSVGCommand } from "./Designers/ORM/Commands/ExportToSVGCommand";
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
import { XAppDesignerEditorProvider } from "./Designers/App/AppDesignerEditorProvider";
import { XNewAppDesignerCommand } from "./Designers/App/Commands/NewAppDesignerCommand";
import { XOpenAppDesignerCommand } from "./Designers/App/Commands/OpenAppDesignerCommand";
import { XValidateAppModelCommand } from "./Designers/App/Commands/ValidateAppModelCommand";
import { XCompositeDesignerProvider } from "./Views/CompositeDesignerProvider";

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
        XExportToSVGCommand.Register(pContext);
        XImportFromDBMLCommand.Register(pContext);
        XValidateORMModelCommand.Register(pContext, designerProvider);
        XDeleteSelectedCommand.Register(pContext, designerProvider);
        XRenameSelectedCommand.Register(pContext, designerProvider);
        XReloadDataTypesCommand.Register(pContext, designerProvider);
        XOrganizeTablesCommand.Register(pContext, designerProvider);
        XCreateSQLScriptCommand.Register(pContext, designerProvider);
        XGenerateORMCodeCommand.Register(pContext, designerProvider);
        XDetachDesignerCommand.Register(pContext);

        // App Designer (.dsapp) — modelo de Aplicação/Formulário do TootegaERP. Integração de
        // agente continua ORM-only até a Fase 6 do plano; o painel de Propriedades já é
        // compartilhado (ver XCompositeDesignerProvider).
        const appDesignerProvider = XAppDesignerEditorProvider.Register(pContext);
        XNewAppDesignerCommand.Register(pContext, appDesignerProvider);
        XOpenAppDesignerCommand.Register(pContext, appDesignerProvider);
        XValidateAppModelCommand.Register(pContext, appDesignerProvider);

        XIssuesViewProvider.Register(pContext);
        const propertiesProvider = new XCompositeDesignerProvider(designerProvider, appDesignerProvider);
        XPropertiesViewProvider.Register(pContext, propertiesProvider);

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
