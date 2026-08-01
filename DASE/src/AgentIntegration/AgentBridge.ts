/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { GetLogService } from "../Services/LogService";
import type { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";
import type { XTFXBridge, ITableData, IAddShadowTablePayload } from "../Services/TFXBridge";

/**
 * AgentBridge — Adapter layer between AI agent tools/participants and the DASE extension.
 *
 * Provides a singleton accessor to the active XTFXBridge instance through the
 * XORMDesignerEditorProvider. Translates between AI API contracts and XTFXBridge methods,
 * formatting results as LLM-friendly text.
 *
 * This class ensures that AI agent integrations never need to know about the
 * internals of XTFXBridge or XORMDesignerEditorProvider.
 */
export class XAgentBridge {
    private static _Instance: XAgentBridge | null = null;
    private _Provider: XORMDesignerEditorProvider | null = null;
    private _OrganizationSnapshot: ITableSnapshot[] | null = null;
    /**
     * URI of the document an MCP call is targeting. When set, all resolution
     * (bridge, state, panel) goes to this document instead of the active editor.
     * Set per-call via {@link SetTargetDocument}, cleared via {@link ClearTarget}.
     */
    private _TargetUri: string | null = null;

    private constructor() { }

    static GetInstance(): XAgentBridge {
        if (!XAgentBridge._Instance)
            XAgentBridge._Instance = new XAgentBridge();
        return XAgentBridge._Instance;
    }

    /**
     * Set the active designer editor provider.
     * Called once during extension activation.
     */
    SetProvider(pProvider: XORMDesignerEditorProvider): void {
        this._Provider = pProvider;
    }

    /**
     * Get the target XTFXBridge — the bridge of the document set via
     * {@link SetTargetDocument}, or the active custom editor when no target is set.
     * Returns null if no matching ORM designer is open.
     */
    private GetActiveBridge(): XTFXBridge | null {
        return this.GetTargetState()?.Bridge ?? null;
    }

    /** Resolve the target state (set document or active editor). */
    private GetTargetState() {
        if (!this._Provider)
            return null;
        if (this._TargetUri)
            return this._Provider.GetStateByUri(this._TargetUri);
        return this._Provider.GetActiveState();
    }

    /**
     * Persist the target document through VS Code, not behind its back.
     *
     * In a CustomEditor the dirty flag belongs to VS Code: it is set when the provider
     * fires `onDidChangeCustomDocument` and only cleared when VS Code itself performs the
     * save. Calling `XORMDesignerState.Save` directly writes the file but leaves the tab
     * marked as modified. `workspace.save` routes into `saveCustomDocument`, which calls
     * `XORMDesignerState.Save` — file written once, marker cleared.
     */
    private async SaveTargetDocument(): Promise<boolean> {
        const state = this.GetTargetState();
        if (!state)
            return false;
        if (state.IsUntitled)
            return false;
        const saved = await vscode.workspace.save(state.Document.uri);
        if (saved)
            return true;
        // No editor registered for the URI (document not open): write directly.
        await state.Save();
        return true;
    }

    /** Resolve the target webview panel (set document or active editor). */
    private GetTargetPanel() {
        if (!this._Provider)
            return null;
        if (this._TargetUri)
            return this._Provider.GetPanelByUri(this._TargetUri);
        return this._Provider.GetActivePanel();
    }

    /**
     * Point subsequent operations at a specific `.dsorm` document by file name,
     * relative path, or URI — opening it if it is not already open. Pass a falsy
     * value to clear the target (operate on the active editor).
     *
     * Returns `{ name }` of the resolved document, or `{ error }` when no matching
     * `.dsorm` file exists.
     */
    async SetTargetDocument(pDocument?: string, pOpen: boolean = true): Promise<{ name?: string; error?: string }> {
        this._TargetUri = null;
        if (!pDocument)
            return {};
        if (!this._Provider)
            return { error: "No ORM designer provider available." };

        // pOpen=false: só RESOLVE o caminho no disco e fixa o alvo, sem abrir o webview. É o que
        // a geração de código usa — ela não precisa do designer aberto, lê o modelo do disco. As
        // operações de edição continuam com pOpen=true, por precisarem do modelo vivo no designer.
        if (!pOpen) {
            const uri = await this._Provider.ResolveDocumentUri(pDocument);
            if (!uri)
                return { error: `No .dsorm document matching "${pDocument}" was found in the workspace.` };
            this._TargetUri = uri;
            return { name: uri.split("/").pop() ?? pDocument };
        }

        const resolved = await this._Provider.OpenDocument(pDocument);
        if (!resolved)
            return { error: `No .dsorm document matching "${pDocument}" was found in the workspace.` };

        this._TargetUri = resolved.Uri;
        return { name: resolved.Name };
    }

    /** Clear the per-call document target. */
    ClearTarget(): void {
        this._TargetUri = null;
    }

    /**
     * URI do documento-alvo fixado por {@link SetTargetDocument}, ou null quando não há alvo e a
     * operação deve cair no editor ativo. Exposto para comandos disparados via bridge — a geração
     * de código por MCP — resolverem o MESMO documento que as demais operações do agente, em vez
     * do foco do VS Code, que num fluxo de agente costuma não estar no webview do designer.
     */
    GetTargetUri(): string | null {
        return this._TargetUri;
    }

    /**
     * Check whether an ORM designer is currently active.
     */
    IsDesignerActive(): boolean {
        return this.GetActiveBridge() !== null;
    }

    /**
     * Get a summary of the currently open ORM model.
     * Returns a formatted text description for the LLM.
     */
    GetModelInfo(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const doc = bridge.Document;
            const design = bridge.Controller?.Design;

            const tableCount = modelData.Tables?.length ?? 0;
            const refCount = modelData.References?.length ?? 0;
            const schema = design?.Schema ?? "dbo";
            const docName = doc?.Name ?? "Unnamed";

            let result = `## ORM Model: ${docName}\n`;
            // O modelo é o único elemento que não aparece em listagem nenhuma, e é ele que
            // carrega Import Models, Namespace, Output Root... Sem o elementId aqui, não há
            // por onde um agente começar uma escrita de propriedade do modelo.
            result += `- **elementId:** \`model\` — use it in dase_get_properties / dase_update_property to read or edit the properties below\n`;
            result += `- **Schema:** ${schema}\n`;
            result += `- **Namespace:** ${design?.Namespace || "_(empty)_"}\n`;
            result += `- **Output Root:** ${design?.OutputRoot || "_(empty)_"}\n`;
            result += `- **Import Models:** ${design?.ImportModels || "_(none)_"}\n`;
            result += `- **Parent Model:** ${design?.ParentModel || "_(none)_"}\n`;
            result += `- **Tables:** ${tableCount}\n`;
            result += `- **References (FK):** ${refCount}\n`;

            if (tableCount > 0) {
                result += `\n### Tables\n`;
                for (const table of modelData.Tables) {
                    const fieldCount = table.Fields?.length ?? 0;
                    const shadowLabel = table.IsShadow ? " _(shadow)_" : "";
                    result += `- **${table.Name}**${shadowLabel} — ${fieldCount} fields\n`;
                }
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetModelInfo failed", err);
            return "Error reading model information.";
        }
    }

    /**
     * List all tables in the current model with optional name filter.
     */
    ListTables(pFilter?: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            let tables: ITableData[] = modelData.Tables ?? [];

            if (pFilter) {
                const lowerFilter = pFilter.toLowerCase();
                tables = tables.filter(t => t.Name.toLowerCase().includes(lowerFilter));
            }

            if (tables.length === 0)
                return pFilter
                    ? `No tables found matching "${pFilter}".`
                    : "The model has no tables.";

            let result = `Found ${tables.length} table(s):\n\n`;
            for (const table of tables) {
                const fieldCount = table.Fields?.length ?? 0;
                const pkField = table.Fields?.find((f: any) => f.IsPrimaryKey);
                const pkInfo = pkField ? ` (PK: ${pkField.Name} ${pkField.DataType})` : "";
                const shadowLabel = table.IsShadow ? " [Shadow]" : "";
                result += `- **${table.Name}**${shadowLabel}${pkInfo} — ${fieldCount} fields — tableId: \`${table.ID}\`\n`;
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ListTables failed", err);
            return "Error listing tables.";
        }
    }

    /**
     * Get detailed information about a specific table by name.
     */
    GetTableDetails(pTableName?: string, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const table = rt.table!;

            let result = `## Table: ${table.Name}\n`;
            result += `- **ID:** ${table.ID}\n`;
            if (table.Description)
                result += `- **Description:** ${table.Description}\n`;
            if (table.PKType)
                result += `- **PK Type:** ${table.PKType}\n`;
            if (table.FillProp)
                result += `- **Color:** ${table.FillProp}\n`;
            if (table.IsShadow) {
                result += `- **Shadow Table:** Yes\n`;
                if (table.ShadowDocumentName)
                    result += `- **Source Model:** ${table.ShadowDocumentName}\n`;
                if (table.ShadowTableName)
                    result += `- **Source Table:** ${table.ShadowTableName}\n`;
            }
            // A lista de campos abaixo é só a dos campos PRÓPRIOS. Sem dizer de quem a tabela
            // herda, o código gerado apareceria com colunas que a listagem não explica.
            if (table.IsModel)
                result += `- **Model Table:** Yes — generates nothing of its own; only lends its fields to the tables that inherit it\n`;
            if (table.Inheritance)
                result += `- **Inherits:** ${table.Inheritance} (its fields are generated here too, on top of the ones listed below)\n`;

            result += `\n### Fields (${table.Fields?.length ?? 0})\n`;
            if (table.Fields) {
                result += `| # | Name | Type | PK | FK | Required | AutoInc | Length |\n`;
                result += `|---|------|------|----|----|----------|---------|--------|\n`;
                for (let i = 0; i < table.Fields.length; i++) {
                    const f = table.Fields[i];
                    result += `| ${i + 1} | ${f.Name} | ${f.DataType} | ${f.IsPrimaryKey ? "✓" : ""} | ${f.IsForeignKey ? "✓" : ""} | ${f.IsRequired ? "✓" : ""} | ${f.IsAutoIncrement ? "✓" : ""} | ${f.Length ?? ""} |\n`;
                }
            }

            // Show incoming references (FKs targeting this table)
            const incomingRefs = modelData.References?.filter(
                (r: any) => r.TargetTableID === table.ID
            );
            if (incomingRefs && incomingRefs.length > 0) {
                result += `\n### Incoming References (FK → this table)\n`;
                for (const ref of incomingRefs) {
                    const fieldInfo = bridge.GetElementInfo(ref.SourceFieldID);
                    const fieldLabel = fieldInfo ? `${fieldInfo.Name}` : ref.SourceFieldID;
                    result += `- ${fieldLabel} → ${table.Name}\n`;
                }
            }

            // Show outgoing references (FKs from this table)
            const outgoingRefs = modelData.References?.filter((r: any) => {
                return table.Fields?.some((f: any) => f.ID === r.SourceFieldID);
            });
            if (outgoingRefs && outgoingRefs.length > 0) {
                result += `\n### Outgoing References (this table → FK target)\n`;
                for (const ref of outgoingRefs) {
                    const targetInfo = bridge.GetElementInfo(ref.TargetTableID);
                    const targetLabel = targetInfo ? targetInfo.Name : ref.TargetTableID;
                    const fieldInfo = bridge.GetElementInfo(ref.SourceFieldID);
                    const fieldLabel = fieldInfo ? fieldInfo.Name : ref.SourceFieldID;
                    result += `- ${fieldLabel} → ${targetLabel}\n`;
                }
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetTableDetails failed", err);
            return `Error getting details for table "${pTableName}".`;
        }
    }

    /**
     * Add a new table to the model.
     * Returns a description of the result.
     */
    AddTable(pName: string, pX?: number, pY?: number): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const x = pX ?? 100;
            const y = pY ?? 100;
            const result = bridge.AddTable(x, y, pName);

            if (result.Success) {
                this.RefreshActive();
                return `Table "${pName}" added successfully at position (${x}, ${y}).`;
            }
            else
                return `Failed to add table "${pName}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddTable failed", err);
            return `Error adding table "${pName}".`;
        }
    }

    /**
     * Add a field to a table.
     */
    AddField(pTableName: string | undefined, pFieldName: string, pDataType: string, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const table = rt.table!;

            const result = bridge.AddField(table.ID, pFieldName, pDataType);

            if (result.Success) {
                this.RefreshActive();
                return `Field "${pFieldName}" (${pDataType}) added to table "${table.Name}" successfully.`;
            }
            else
                return `Failed to add field "${pFieldName}" to "${table.Name}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddField failed", err);
            return `Error adding field "${pFieldName}" to "${pTableName ?? pTableId}".`;
        }
    }

    /**
     * Add a FK reference between two tables.
     */
    AddReference(
        pSourceTable: string | undefined,
        pTargetTable: string | undefined,
        pName?: string,
        pSourceTableId?: string,
        pTargetTableId?: string,
        pSourceIsShadow?: boolean,
        pTargetIsShadow?: boolean,
        pOneToOne?: boolean
    ): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const rs = this.ResolveTable(bridge, pSourceTable, pSourceTableId, pSourceIsShadow);
            if (rs.error)
                return `Source: ${rs.error}`;
            const rt = this.ResolveTable(bridge, pTargetTable, pTargetTableId, pTargetIsShadow);
            if (rt.error)
                return `Target: ${rt.error}`;
            const sourceTable = rs.table!;
            const targetTable = rt.table!;

            const refName = pName || `FK_${sourceTable.Name}_${targetTable.Name}`;
            const result = bridge.AddReference(sourceTable.ID, targetTable.ID, refName, pOneToOne);

            if (result.Success) {
                this.RefreshActive();
                return pOneToOne
                    ? `1:1 reference "${refName}" from "${sourceTable.Name}" (PK) to "${targetTable.Name}" created successfully (inheritance-style PK→PK link, no FK field added).`
                    : `Reference "${refName}" from "${sourceTable.Name}" to "${targetTable.Name}" created successfully.`;
            }
            else
                return `Failed to create reference: ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddReference failed", err);
            return `Error creating reference from "${pSourceTable ?? pSourceTableId}" to "${pTargetTable ?? pTargetTableId}".`;
        }
    }

    /**
     * Validate the current ORM model.
     */
    ValidateModel(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const issues = bridge.ValidateOrmModel();

            if (issues.length === 0)
                return "✅ Validation passed — no issues found.";

            const errors = issues.filter(i => i.Severity === 2);
            const warnings = issues.filter(i => i.Severity === 1);

            let result = `### Validation Results\n`;
            result += `- **Errors:** ${errors.length}\n`;
            result += `- **Warnings:** ${warnings.length}\n\n`;

            if (errors.length > 0) {
                result += `#### Errors\n`;
                for (const err of errors)
                    result += `- ❌ **${err.ElementName}**: ${err.Message}\n`;
            }

            if (warnings.length > 0) {
                result += `\n#### Warnings\n`;
                for (const warn of warnings)
                    result += `- ⚠️ **${warn.ElementName}**: ${warn.Message}\n`;
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ValidateModel failed", err);
            return "Error running validation.";
        }
    }

    /**
     * Export the model to DBML format.
     */
    ExportToDBML(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const dbml = bridge.ExportToDBML();
            if (!dbml || dbml.trim().length === 0)
                return "The model is empty — nothing to export.";
            return dbml;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ExportToDBML failed", err);
            return "Error exporting to DBML.";
        }
    }

    /**
     * Get properties of a specific element by ID.
     *
     * A coluna que importa é a Key: é ela que `UpdateProperty` aceita. Mostrar só o rótulo
     * levava a chamada seguinte a tentar "Import Models" e receber "Unknown property" —
     * a grade dizia uma coisa e a escrita exigia outra.
     */
    GetProperties(pElementId: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const props = bridge.GetProperties(pElementId);
            if (!props || props.length === 0)
                return `No properties found for element "${pElementId}".`;

            let result = `### Properties\n`;
            result += `_Use the **Key** column as \`propertyKey\` in dase_update_property._\n\n`;
            result += `| Key | Label | Value | Type | Read-Only |\n`;
            result += `|-----|-------|-------|------|-----------|\n`;
            for (const prop of props)
                result += `| ${prop.Key} | ${prop.Name} | ${prop.Value ?? ""} | ${prop.Type} | ${prop.IsReadOnly ? "✓" : ""} |\n`;

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetProperties failed", err);
            return `Error getting properties for element "${pElementId}".`;
        }
    }

    /**
     * Update a property on an element.
     */
    UpdateProperty(pElementId: string, pPropertyKey: string, pValue: unknown): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const result = bridge.UpdateProperty(pElementId, pPropertyKey, pValue);
            if (result.Success) {
                this.RefreshActive();
                return `Property "${pPropertyKey}" updated successfully.`;
            }
            else
                return `Failed to update property "${pPropertyKey}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.UpdateProperty failed", err);
            return `Error updating property "${pPropertyKey}".`;
        }
    }

    /**
     * Get all available data types in the configuration.
     */
    GetAvailableDataTypes(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        const allTypes = bridge.GetAllDataTypes();
        const pkTypes = bridge.GetPKDataTypes();

        let result = `### Available Data Types\n`;
        result += `**All types:** ${allTypes.join(", ")}\n\n`;
        result += `**PK-compatible types:** ${pkTypes.join(", ")}\n`;

        return result;
    }

    /**
     * Convert a CSS hex color (#RRGGBB or #RGB) to TFX ARGB format (FFRRGGBB).
     * XColor.Parse requires exactly 8 hex chars: AARRGGBB, no '#' prefix.
     */
    private CssToTfxColor(pColor: string): string {
        let hex = pColor.trim();
        if (hex.startsWith("#"))
            hex = hex.slice(1);
        // Expand shorthand #RGB → RRGGBB
        if (hex.length === 3)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        // If already 8 chars (AARRGGBB), return as-is
        if (hex.length === 8)
            return hex.toUpperCase();
        // 6 chars (RRGGBB) → prepend FF for full opacity
        if (hex.length === 6)
            return "FF" + hex.toUpperCase();
        return hex.toUpperCase();
    }

    // ─── Table Positioning & Coloring (Agent Mode) ──────────────────────────

    /**
     * Move a table to a specific position on the canvas (by table name).
     */
    MoveTable(pTableName: string | undefined, pX: number, pY: number, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const table = rt.table!;

            const result = bridge.MoveElement(table.ID, pX, pY);
            if (result.Success) {
                this.RefreshActive();
                return `Table "${table.Name}" moved to (${pX}, ${pY}).`;
            }
            else
                return `Failed to move table "${table.Name}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.MoveTable failed", err);
            return `Error moving table "${pTableName ?? pTableId}".`;
        }
    }

    /**
     * Set the fill color of a table (by table name).
     * Accepts CSS hex colors (#RRGGBB) or ARGB (AARRGGBB).
     */
    SetTableColor(pTableName: string | undefined, pColor: string, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const table = rt.table!;

            const tfxColor = this.CssToTfxColor(pColor);
            const result = bridge.UpdateProperty(table.ID, "Fill", tfxColor);
            if (result.Success) {
                this.RefreshActive();
                return `Table "${table.Name}" color set to ${pColor}.`;
            }
            else
                return `Failed to set color for "${table.Name}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.SetTableColor failed", err);
            return `Error setting color for table "${pTableName ?? pTableId}".`;
        }
    }

    /**
     * Trigger the AI-powered table organization (delegates to the OrganizeTablesAI command).
     * Returns a message indicating the command was triggered.
     */
    async OrganizeLayout(): Promise<string> {
        try {
            await (await import("vscode")).commands.executeCommand("Dase.OrganizeTablesAI");
            return "AI organization command has been triggered. Check the progress notification.";
        }
        catch (err) {
            GetLogService().Error("AgentBridge.OrganizeLayout failed", err);
            return `Error triggering AI organization: ${err}`;
        }
    }

    // ─── AI Organization Snapshot ─────────────────────────────────────────────

    /**
     * Capture current table positions and fill colors before applying an organization plan.
     * Called immediately before ApplyOrganizationPlan to enable one-shot Revert.
     */
    CaptureCurrentPositions(): void {
        const bridge = this.GetActiveBridge();
        if (!bridge) return;
        try {
            const modelData = bridge.GetModelData();
            this._OrganizationSnapshot = (modelData.Tables ?? []).map((t: ITableData) => ({
                id: t.ID,
                x: t.X,
                y: t.Y,
                fill: t.FillProp ?? ""
            }));
        }
        catch (err) {
            GetLogService().Error("AgentBridge.CaptureCurrentPositions failed", err);
            this._OrganizationSnapshot = null;
        }
    }

    /**
     * Restore table positions and colors from the last captured snapshot.
     * Clears the snapshot after use.
     */
    RevertOrganization(): IOrganizationResult {
        const bridge = this.GetActiveBridge();
        const snapshot = this._OrganizationSnapshot;
        if (!bridge || !snapshot)
            return { success: false, message: "No snapshot available to revert.", tablesOrganized: 0, groupCount: 0 };

        try {
            const reverted = snapshot.length;
            for (const snap of snapshot) {
                bridge.MoveElement(snap.id, snap.x, snap.y);
                if (snap.fill)
                    bridge.UpdateProperty(snap.id, "Fill", this.CssToTfxColor(snap.fill));
            }
            bridge.AlignLines();

            if (this._Provider) {
                const state = this.GetTargetState();
                const panel = this.GetTargetPanel();
                if (state && panel) {
                    state.IsDirty = true;
                    panel.webview.postMessage({ Type: "LoadModel", Payload: state.GetModelData() });
                }
            }

            this._OrganizationSnapshot = null;
            return { success: true, message: "Reverted successfully.", tablesOrganized: reverted, groupCount: 0 };
        }
        catch (err) {
            GetLogService().Error("AgentBridge.RevertOrganization failed", err);
            return { success: false, message: String(err), tablesOrganized: 0, groupCount: 0 };
        }
    }

    // ─── AI Organization Methods ────────────────────────────────────────────

    /**
     * Build a structured context payload for the AI table organization feature.
     * Contains table names, fields, dimensions, and reference topology.
     */
    GetOrganizationContext(): IOrganizationContext | null {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return null;

        try {
            const modelData = bridge.GetModelData();
            if (!modelData.Tables || modelData.Tables.length === 0)
                return null;

            const tables: IOrganizationTableInfo[] = modelData.Tables.map((t: ITableData) => ({
                id: t.ID,
                name: t.Name,
                width: t.Width || 200,
                height: t.Height || (60 + (t.Fields?.length ?? 0) * 24),
                fieldCount: t.Fields?.length ?? 0,
                fields: t.Fields?.map((f: any) => f.Name) ?? [],
                isShadow: !!t.IsShadow
            }));

            const references: IOrganizationReferenceInfo[] = (modelData.References ?? []).map((r: any) => {
                // Resolve source field to table name
                const sourceFieldInfo = bridge.GetElementInfo(r.SourceFieldID);
                const sourceTable = modelData.Tables.find(t =>
                    t.Fields?.some((f: any) => f.ID === r.SourceFieldID)
                );
                const targetTable = modelData.Tables.find(t => t.ID === r.TargetTableID);

                return {
                    sourceTable: sourceTable?.Name ?? "Unknown",
                    sourceField: sourceFieldInfo?.Name ?? r.SourceFieldID,
                    targetTable: targetTable?.Name ?? "Unknown"
                };
            });

            // Estimate canvas dimensions based on table count
            const tableCount = tables.length;
            const cols = Math.ceil(Math.sqrt(tableCount));
            const rows = Math.ceil(tableCount / cols);
            const canvasWidth = Math.max(2000, cols * 350);
            const canvasHeight = Math.max(1500, rows * 350);

            return { tables, references, canvasWidth, canvasHeight };
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetOrganizationContext failed", err);
            return null;
        }
    }

    /**
     * Apply an AI-generated organization plan: batch update table positions and colors,
     * then re-route all lines and refresh the webview.
     */
    ApplyOrganizationPlan(pPlan: IAIOrganizationPlan): IOrganizationResult {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return { success: false, message: "No active designer.", tablesOrganized: 0, groupCount: 0 };

        try {
            let tablesOrganized = 0;

            bridge.SuspendRouting?.();
            try {
                for (const group of pPlan.groups) {
                    const tfxColor = this.CssToTfxColor(group.color);

                    for (const tablePlacement of group.tables) {
                        const moveResult = bridge.MoveElement(tablePlacement.id, tablePlacement.x, tablePlacement.y);
                        if (!moveResult?.Success)
                            continue;

                        bridge.UpdateProperty(tablePlacement.id, "Fill", tfxColor);

                        tablesOrganized++;
                    }
                }
            }
            finally {
                bridge.ResumeRouting?.(false);
            }

            bridge.AlignLines();

            // Refresh the webview via the provider
            if (this._Provider) {
                const state = this.GetTargetState();
                const panel = this.GetTargetPanel();
                if (state && panel) {
                    state.IsDirty = true;
                    const modelData = state.GetModelData();
                    panel.webview.postMessage({
                        Type: "LoadModel",
                        Payload: modelData
                    });
                }
            }

            return {
                success: true,
                message: "Organization applied successfully.",
                tablesOrganized,
                groupCount: pPlan.groups.length
            };
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ApplyOrganizationPlan failed", err);
            return { success: false, message: String(err), tablesOrganized: 0, groupCount: 0 };
        }
    }

    // ─── Shared mutation plumbing ───────────────────────────────────────────

    /**
     * Refresh the active designer webview from the current model and persist it.
     *
     * Mirrors the provider's post-mutation flow (LoadModel + Save). postMessage is
     * synchronous; Save is fire-and-forget so callers can stay synchronous and the
     * VS Code Language Model Tools keep their existing string-returning contract.
     */
    private RefreshActive(): void {
        if (!this._Provider)
            return;
        try {
            const state = this.GetTargetState();
            const panel = this.GetTargetPanel();
            if (state && panel) {
                state.IsDirty = true;
                panel.webview.postMessage({ Type: "LoadModel", Payload: state.GetModelData() });
                void this.SaveTargetDocument();
            }
        }
        catch (err) {
            GetLogService().Warn(`AgentBridge.RefreshActive failed: ${err}`);
        }
    }

    // ─── Name → element resolvers ───────────────────────────────────────────

    /**
     * Resolve a table by ID (preferred — unambiguous) or by name.
     *
     * Because shadow tables may share a name with another (real or shadow) table, a
     * name alone can be ambiguous. When `pId` is given it wins outright. Otherwise the
     * name is matched and, if more than one candidate remains, `pIsShadow` narrows it;
     * a still-ambiguous match returns an error listing every candidate's ID + shadow
     * flag so the caller can retry with a `tableId`.
     */
    private ResolveTable(
        pBridge: XTFXBridge,
        pName?: string,
        pId?: string,
        pIsShadow?: boolean
    ): { table?: ITableData; error?: string } {
        const tables: ITableData[] = pBridge.GetModelData().Tables ?? [];

        if (pId) {
            const byId = tables.find(t => t.ID === pId);
            return byId ? { table: byId } : { error: `Table with ID "${pId}" not found.` };
        }

        if (!pName)
            return { error: "Provide a tableName or a tableId." };

        let matches = tables.filter(t => t.Name.toLowerCase() === pName.toLowerCase());
        if (pIsShadow !== undefined)
            matches = matches.filter(t => !!t.IsShadow === pIsShadow);

        if (matches.length === 0)
            return {
                error: pIsShadow !== undefined
                    ? `Table "${pName}" (isShadow=${pIsShadow}) not found.`
                    : `Table "${pName}" not found.`
            };

        if (matches.length > 1) {
            const list = matches
                .map(t => `- ${t.Name} (tableId: ${t.ID}, isShadow: ${!!t.IsShadow})`)
                .join("\n");
            return {
                error: `Multiple tables named "${pName}". Disambiguate with tableId (preferred) or isShadow:\n${list}`
            };
        }

        return { table: matches[0] };
    }

    /** Resolve a field within an already-resolved table, by ID (preferred) or name. */
    private ResolveField(
        pTable: ITableData,
        pFieldName?: string,
        pFieldId?: string
    ): { field?: any; error?: string } {
        const fields: any[] = pTable.Fields ?? [];

        if (pFieldId) {
            const byId = fields.find(f => f.ID === pFieldId);
            return byId ? { field: byId } : { error: `Field with ID "${pFieldId}" not found in "${pTable.Name}".` };
        }

        if (!pFieldName)
            return { error: "Provide a fieldName or a fieldId." };

        const matches = fields.filter(f => f.Name.toLowerCase() === pFieldName.toLowerCase());
        if (matches.length === 0)
            return { error: `Field "${pFieldName}" not found in table "${pTable.Name}".` };
        if (matches.length > 1) {
            const list = matches.map(f => `- ${f.Name} (fieldId: ${f.ID})`).join("\n");
            return { error: `Multiple fields named "${pFieldName}" in "${pTable.Name}". Use fieldId:\n${list}` };
        }
        return { field: matches[0] };
    }

    /** Resolve an FK reference by ID (preferred) or name; name may be ambiguous. */
    private ResolveReference(
        pBridge: XTFXBridge,
        pName?: string,
        pId?: string
    ): { ref?: any; error?: string } {
        const refs: any[] = pBridge.GetModelData().References ?? [];

        if (pId) {
            const byId = refs.find(r => r.ID === pId);
            return byId ? { ref: byId } : { error: `Reference with ID "${pId}" not found.` };
        }

        if (!pName)
            return { error: "Provide a reference name or a referenceId." };

        const matches = refs.filter(r => (r.Name ?? "").toLowerCase() === pName.toLowerCase());
        if (matches.length === 0)
            return { error: `Reference "${pName}" not found.` };
        if (matches.length > 1) {
            const list = matches.map(r => `- ${r.Name} (referenceId: ${r.ID})`).join("\n");
            return { error: `Multiple references named "${pName}". Use referenceId:\n${list}` };
        }
        return { ref: matches[0] };
    }

    // ─── Documents ──────────────────────────────────────────────────────────

    /** List all open ORM designer documents. */
    ListDocuments(): string {
        if (!this._Provider)
            return "No ORM designer provider available.";
        const docs = this._Provider.GetOpenDocuments();
        if (docs.length === 0)
            return "No ORM designer is currently open.";
        let result = `Found ${docs.length} open document(s):\n\n`;
        for (const d of docs)
            result += `- **${d.Name}**${d.Active ? " _(active)_" : ""}\n  - URI: ${d.Uri}\n`;
        return result;
    }

    /** Save the target (or active) document to disk. Awaits the write and reports real status. */
    async SaveActiveDocument(): Promise<string> {
        if (!this._Provider)
            return "No ORM designer provider available.";
        const state = this.GetTargetState();
        if (!state)
            return "No ORM designer is currently open.";
        if (state.IsUntitled)
            return "This document is untitled (never saved to disk). Use dase_new_document to create a named .dsorm file, or save it manually in VS Code (Ctrl+S).";
        try {
            await this.SaveTargetDocument();
            return `ORM document saved: ${state.Document.uri.fsPath}`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.SaveActiveDocument failed", err);
            return `Failed to save ORM document: ${err instanceof Error ? err.message : err}`;
        }
    }

    /**
     * Create a new named `.dsorm` file at the given path (absolute, or relative to the
     * first workspace folder), write an empty ORM model to it and open it in the designer.
     */
    async CreateDocument(pPath: string, pOverwrite?: boolean): Promise<string> {
        if (!this._Provider)
            return "No ORM designer provider available.";
        try {
            let p = (pPath ?? "").trim();
            if (!p)
                return "A file path is required (absolute, or relative to the workspace).";
            if (!p.toLowerCase().endsWith(".dsorm"))
                p += ".dsorm";

            let uri: vscode.Uri;
            const isAbsolute = /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(p);
            if (isAbsolute)
                uri = vscode.Uri.file(p);
            else {
                const ws = vscode.workspace.workspaceFolders?.[0];
                if (!ws)
                    return `Relative path "${p}" given but no workspace folder is open. Provide an absolute path.`;
                uri = vscode.Uri.joinPath(ws.uri, p);
            }

            let exists = true;
            try { await vscode.workspace.fs.stat(uri); }
            catch { exists = false; }
            if (exists && !pOverwrite)
                return `File already exists: ${uri.fsPath}. Pass overwrite=true to replace it, or use dase_open_document to open it.`;

            const parent = vscode.Uri.joinPath(uri, "..");
            await vscode.workspace.fs.createDirectory(parent);

            const emptyModel = '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';
            await vscode.workspace.fs.writeFile(uri, Buffer.from(emptyModel, "utf8"));

            const resolved = await this._Provider.OpenDocumentByUri(uri);
            if (!resolved)
                return `Created "${uri.fsPath}" but the designer did not open it within the timeout. Open it manually or via dase_open_document.`;

            return `New ORM document created and opened: ${uri.fsPath}`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.CreateDocument failed", err);
            return `Failed to create ORM document "${pPath}": ${err instanceof Error ? err.message : err}`;
        }
    }

    // ─── Table mutations (by name) ──────────────────────────────────────────

    DeleteTable(pTableName?: string, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const r = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (r.error)
                return r.error;
            const result = bridge.DeleteElement(r.table!.ID);
            if (!result.Success)
                return `Failed to delete table "${r.table!.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Table "${r.table!.Name}" (ID ${r.table!.ID}) deleted.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.DeleteTable failed", err);
            return `Error deleting table "${pTableName ?? pTableId}".`;
        }
    }

    RenameTable(pTableName?: string, pNewName?: string, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        if (!pNewName)
            return "Provide newName.";
        try {
            const r = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (r.error)
                return r.error;
            const result = bridge.RenameElement(r.table!.ID, pNewName);
            if (!result.Success)
                return `Failed to rename table "${r.table!.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Table "${r.table!.Name}" renamed to "${pNewName}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.RenameTable failed", err);
            return `Error renaming table "${pTableName ?? pTableId}".`;
        }
    }

    // ─── Field mutations (by name) ──────────────────────────────────────────

    DeleteField(pTableName?: string, pFieldName?: string, pTableId?: string, pFieldId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const rf = this.ResolveField(rt.table!, pFieldName, pFieldId);
            if (rf.error)
                return rf.error;
            const result = bridge.DeleteElement(rf.field.ID);
            if (!result.Success)
                return `Failed to delete field "${rf.field.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Field "${rf.field.Name}" deleted from "${rt.table!.Name}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.DeleteField failed", err);
            return `Error deleting field "${pFieldName ?? pFieldId}".`;
        }
    }

    RenameField(pTableName?: string, pFieldName?: string, pNewName?: string, pTableId?: string, pFieldId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        if (!pNewName)
            return "Provide newName.";
        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const rf = this.ResolveField(rt.table!, pFieldName, pFieldId);
            if (rf.error)
                return rf.error;
            const result = bridge.RenameElement(rf.field.ID, pNewName);
            if (!result.Success)
                return `Failed to rename field "${rf.field.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Field "${rf.field.Name}" renamed to "${pNewName}" in "${rt.table!.Name}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.RenameField failed", err);
            return `Error renaming field "${pFieldName ?? pFieldId}".`;
        }
    }

    ReorderField(pTableName?: string, pFieldName?: string, pNewIndex?: number, pTableId?: string, pFieldId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        if (pNewIndex === undefined)
            return "Provide newIndex.";
        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const rf = this.ResolveField(rt.table!, pFieldName, pFieldId);
            if (rf.error)
                return rf.error;
            const result = bridge.ReorderField(rf.field.ID, pNewIndex);
            if (!result.Success)
                return `Failed to reorder field "${rf.field.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Field "${rf.field.Name}" moved to index ${pNewIndex} in "${rt.table!.Name}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ReorderField failed", err);
            return `Error reordering field "${pFieldName ?? pFieldId}".`;
        }
    }

    // ─── Reference mutations ────────────────────────────────────────────────

    DeleteReference(pName?: string, pReferenceId?: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const r = this.ResolveReference(bridge, pName, pReferenceId);
            if (r.error)
                return r.error;
            const result = bridge.DeleteElement(r.ref.ID);
            if (!result.Success)
                return `Failed to delete reference "${r.ref.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Reference "${r.ref.Name}" (ID ${r.ref.ID}) deleted.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.DeleteReference failed", err);
            return `Error deleting reference "${pName ?? pReferenceId}".`;
        }
    }

    /**
     * Re-point an existing FK reference at a different target table (same gesture as
     * the designer's "move FK target"). The source field/table is unchanged.
     */
    MoveReferenceTarget(
        pReferenceName?: string,
        pReferenceId?: string,
        pTargetTable?: string,
        pTargetTableId?: string,
        pTargetIsShadow?: boolean
    ): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const r = this.ResolveReference(bridge, pReferenceName, pReferenceId);
            if (r.error)
                return r.error;
            const t = this.ResolveTable(bridge, pTargetTable, pTargetTableId, pTargetIsShadow);
            if (t.error)
                return `Target: ${t.error}`;
            const result = bridge.MoveReferenceTarget(r.ref.ID, t.table!.ID);
            if (!result.Success)
                return `Failed to move reference "${r.ref.Name}" to "${t.table!.Name}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Reference "${r.ref.Name}" now targets "${t.table!.Name}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.MoveReferenceTarget failed", err);
            return `Error moving reference "${pReferenceName ?? pReferenceId}" to "${pTargetTable ?? pTargetTableId}".`;
        }
    }

    // ─── Generic element ops (by ID) ────────────────────────────────────────

    DeleteElementById(pElementId: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const result = bridge.DeleteElement(pElementId);
            if (!result.Success)
                return `Failed to delete element "${pElementId}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Element "${pElementId}" deleted.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.DeleteElementById failed", err);
            return `Error deleting element "${pElementId}".`;
        }
    }

    RenameElementById(pElementId: string, pNewName: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const result = bridge.RenameElement(pElementId, pNewName);
            if (!result.Success)
                return `Failed to rename element "${pElementId}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Element "${pElementId}" renamed to "${pNewName}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.RenameElementById failed", err);
            return `Error renaming element "${pElementId}".`;
        }
    }

    GetElementInfoText(pElementId: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        const info = bridge.GetElementInfo(pElementId);
        if (!info)
            return `Element "${pElementId}" not found.`;
        // O modelo não tem ID próprio — XORMDesign nunca serializa o seu —, então quem o
        // endereça usa o alias, e é o alias que precisa aparecer aqui.
        const id = info.Type === "XORMDesign" ? "model" : info.ID;
        return `### Element\n- **ID:** ${id}\n- **Name:** ${info.Name}\n- **Type:** ${info.Type}\n`;
    }

    // ─── Layout ─────────────────────────────────────────────────────────────

    AlignLines(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const ok = bridge.AlignLines();
            this.RefreshActive();
            return ok ? "Reference lines aligned." : "Align lines completed with no changes.";
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AlignLines failed", err);
            return "Error aligning lines.";
        }
    }

    // ─── Seed / fixture data ────────────────────────────────────────────────

    GetSeed(pTableName?: string, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const table = rt.table!;
            const payload = bridge.GetSeedData(table.ID);
            if (!payload)
                return `Table "${table.Name}" has no seed data support.`;

            const cols = payload.Columns.map(c => c.Name);

            // $Member é coluna virtual: guarda o identificador do membro do enum gerado a
            // partir da linha, que não é coluna da tabela e não se deriva do texto.
            const temMembro = payload.Rows.some(r => r.Member);

            let result = `## Seed Data: ${payload.TableName}\n`;
            result += `Columns: ${cols.join(", ")}\n`;
            if (temMembro)
                result += `$Member holds the generated enum member name (e.g. BRL for "Real brasileiro").\n`;
            result += "\n";

            if (payload.Rows.length === 0) {
                result += "_(no rows)_\n";
                return result;
            }

            const cabecalho = temMembro ? ["$Member", ...cols] : cols;
            result += `| ${cabecalho.join(" | ")} |\n`;
            result += `| ${cabecalho.map(() => "---").join(" | ")} |\n`;

            for (const row of payload.Rows) {
                const celulas = payload.Columns.map(c => row.Values[c.FieldID] ?? "");
                result += `| ${(temMembro ? [row.Member ?? "", ...celulas] : celulas).join(" | ")} |\n`;
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetSeed failed", err);
            return `Error reading seed data for "${pTableName}".`;
        }
    }

    /**
     * Replace seed rows of a table. `pRows` is an array of objects keyed by column
     * NAME (the LLM does not know field IDs); they are mapped to field IDs here.
     */
    SaveSeed(pTableName: string | undefined, pRows: Array<Record<string, string>>, pTableId?: string, pIsShadow?: boolean): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const rt = this.ResolveTable(bridge, pTableName, pTableId, pIsShadow);
            if (rt.error)
                return rt.error;
            const table = rt.table!;
            const payload = bridge.GetSeedData(table.ID);
            if (!payload)
                return `Table "${table.Name}" has no seed data support.`;

            const nameToId = new Map<string, string>();
            for (const c of payload.Columns)
                nameToId.set(c.Name.toLowerCase(), c.FieldID);

            const saveRows = pRows.map((row, i) => {
                const values: Record<string, string> = {};
                let member = "";

                for (const [k, v] of Object.entries(row)) {
                    // Chave reservada: identificador do membro do enum gerado a partir da
                    // linha. Não é coluna da tabela — não se deriva do texto ("Real
                    // brasileiro" não vira BRL), então precisa vir declarado.
                    if (k === "$Member") {
                        member = String(v);
                        continue;
                    }

                    const fid = nameToId.get(k.toLowerCase());
                    if (fid)
                        values[fid] = String(v);
                }

                return { TupleID: `row-${i}`, Member: member, Values: values };
            });

            const result = bridge.SaveSeedData(table.ID, saveRows);
            if (!result.Success)
                return `Failed to save seed data: ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Saved ${saveRows.length} seed row(s) to "${table.Name}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.SaveSeed failed", err);
            return `Error saving seed data for "${pTableName}".`;
        }
    }

    // ─── Shadow tables ──────────────────────────────────────────────────────

    GetShadowTableOptions(pX: number, pY: number): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const data = bridge.GetShadowTablePickerData(pX, pY);
            if (!data.Models || data.Models.length === 0)
                return "No external models available to shadow.";
            let result = `### Shadow Table Sources\n`;
            for (const m of data.Models) {
                result += `\n#### Model: ${m.ModelName} (module ${m.ModuleName})\n`;
                result += `- DocumentID: ${m.DocumentID}\n- ModuleID: ${m.ModuleID}\n`;
                for (const t of m.Tables)
                    result += `  - ${t.Name} (ID: ${t.ID})\n`;
            }
            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetShadowTableOptions failed", err);
            return "Error reading shadow table options.";
        }
    }

    AddShadowTable(pPayload: IAddShadowTablePayload): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        try {
            const result = bridge.AddShadowTable(pPayload);
            if (!result.Success)
                return `Failed to add shadow table "${pPayload.TableName}": ${result.Message ?? "Unknown error"}.`;
            this.RefreshActive();
            return `Shadow table "${pPayload.TableName}" added from model "${pPayload.ModelName}".`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddShadowTable failed", err);
            return `Error adding shadow table "${pPayload.TableName}".`;
        }
    }

    // ─── MCP-driven table organization ──────────────────────────────────────

    /**
     * Return the organization context (tables + fields + reference topology + canvas
     * size) as JSON so an EXTERNAL AI can compute a layout itself — no VS Code LM
     * involved. The AI then submits the plan via {@link ApplyOrganization}.
     */
    GetOrganizationContextText(): string {
        const ctx = this.GetOrganizationContext();
        if (!ctx)
            return "No ORM designer is currently open, or the model has no tables.";
        return JSON.stringify(ctx, null, 2);
    }

    /**
     * Apply an externally-computed organization plan: snapshot current positions for
     * one-shot revert, reposition + color tables, re-route lines, refresh, and save.
     */
    ApplyOrganization(pPlan: IAIOrganizationPlan): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";
        if (!pPlan || !Array.isArray(pPlan.groups) || pPlan.groups.length === 0)
            return "Invalid plan: 'groups' must be a non-empty array.";

        try {
            this.CaptureCurrentPositions();
            const result = this.ApplyOrganizationPlan(pPlan);
            if (!result.success)
                return `Failed to apply organization: ${result.message}`;

            void this.SaveTargetDocument();
            return `Organization applied: ${result.tablesOrganized} table(s) across ${result.groupCount} group(s). Use dase_revert_organization to undo.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ApplyOrganization failed", err);
            return `Error applying organization: ${err}`;
        }
    }

    /** Revert the last {@link ApplyOrganization} using the captured snapshot. */
    RevertOrganizationText(): string {
        const result = this.RevertOrganization();
        if (!result.success)
            return `Revert failed: ${result.message}`;
        void this.SaveTargetDocument();
        return `Reverted ${result.tablesOrganized} table(s) to their previous positions and colors.`;
    }
}

// ─── Interfaces for AI Organization ────────────────────────────────────────────

export interface IOrganizationTableInfo {
    id: string;
    name: string;
    width: number;
    height: number;
    fieldCount: number;
    fields: string[];
    isShadow: boolean;
}

export interface IOrganizationReferenceInfo {
    sourceTable: string;
    sourceField: string;
    targetTable: string;
}

export interface IOrganizationContext {
    tables: IOrganizationTableInfo[];
    references: IOrganizationReferenceInfo[];
    canvasWidth: number;
    canvasHeight: number;
}

export interface IAITablePlacement {
    id: string;
    x: number;
    y: number;
}

export interface IAIGroup {
    name: string;
    color: string;
    tables: IAITablePlacement[];
}

export interface IAIOrganizationPlan {
    groups: IAIGroup[];
}

export interface IOrganizationResult {
    success: boolean;
    message: string;
    tablesOrganized: number;
    groupCount: number;
}

interface ITableSnapshot {
    id: string;
    x: number;
    y: number;
    fill: string;
}
