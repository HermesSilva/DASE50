import * as vscode from "vscode";
import { GetSelectionService } from "../Services/SelectionService";
import { XPropertyItem } from "../Models/PropertyItem";
import type { IPropertiesCapableProvider } from "../Models/DesignerContracts";
import { XDesignerSelection } from "../Models/DesignerSelection";
import { GetLogService } from "../Services/LogService";

export class XPropertiesViewProvider implements vscode.WebviewViewProvider {
    // Context kept for future features (theming, storage)
    private readonly _Context: vscode.ExtensionContext;
    private _DesignerProvider: IPropertiesCapableProvider;
    private _View: vscode.WebviewView | null;
    private _Properties: XPropertyItem[];
    private _ElementID: string | null;

    constructor(pContext: vscode.ExtensionContext, pDesignerProvider: IPropertiesCapableProvider) {
        this._Context = pContext;
        this._DesignerProvider = pDesignerProvider;
        this._View = null;
        this._Properties = [];
        this._ElementID = null;

        // Register selection listener immediately, not when webview resolves
        const selectionService = GetSelectionService();
        selectionService.OnSelectionChanged(async (pSelection: XDesignerSelection) => {
            GetLogService().Info(`Properties: selection changed → ${pSelection.PrimaryID ?? "none"}`);
            this._ElementID = pSelection.PrimaryID;

            if (pSelection.PrimaryID) {
                const state = this._DesignerProvider.GetActiveState();
                if (state)
                    this._Properties = state.GetProperties(pSelection.PrimaryID);
                else
                    this._Properties = [];
            }
            else
                this._Properties = [];

            // If view is not resolved yet, try to reveal it
            if (!this._View && this._Properties.length > 0) {
                try {
                    await vscode.commands.executeCommand(`${XPropertiesViewProvider.ViewType}.focus`);
                }
                catch {
                    // Panel focus failed, will update on next visibility change
                }
            }

            this.UpdateView();
        });
    }

    static get ViewType(): string {
        return "Dase.Properties";
    }

    static Register(pContext: vscode.ExtensionContext, pDesignerProvider: IPropertiesCapableProvider): XPropertiesViewProvider {
        const provider = new XPropertiesViewProvider(pContext, pDesignerProvider);
        const registration = vscode.window.registerWebviewViewProvider(
            XPropertiesViewProvider.ViewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );
        pContext.subscriptions.push(registration);
        return provider;
    }

    resolveWebviewView(pWebviewView: vscode.WebviewView, _pContext: vscode.WebviewViewResolveContext, _pToken: vscode.CancellationToken): void {
        const log = GetLogService();
        log.Info("Properties: resolveWebviewView start");
        this._View = pWebviewView;

        pWebviewView.webview.options = {
            enableScripts: true
        };

        // Always set fresh HTML content
        let htmlContent: string;
        try {
            htmlContent = this.GetHtmlContent();
            pWebviewView.webview.html = htmlContent;
            log.Info(`Properties: empty HTML set (${htmlContent.length} chars)`);
        }
        catch (err) {
            log.Error("Properties: GetHtmlContent failed", err);
            pWebviewView.webview.html = "<html><body style='font-family:sans-serif;padding:8px'>DASE Properties failed to render. See the DASE output log.</body></html>";
        }

        // Handle view disposal
        pWebviewView.onDidDispose(() => {
            this._View = null;
        });

        // Handle visibility changes - re-send properties when view becomes visible
        pWebviewView.onDidChangeVisibility(() => {
            if (pWebviewView.visible && this._Properties.length > 0)
                this.UpdateView();
        });

        // Update view with current properties (in case selection happened before resolve)
        this.UpdateView();
        log.Info("Properties: resolveWebviewView done");

        pWebviewView.webview.onDidReceiveMessage((pMsg: { Type: string; PropertyKey?: string; Value?: unknown; Uri?: string; Message?: string; Source?: string; Line?: number }) => {
            if (pMsg.Type === "WebviewError") {
                GetLogService().Error(`Properties WEBVIEW ERROR: ${pMsg.Message} (${pMsg.Source ?? ""}:${pMsg.Line ?? 0})`);
                return;
            }
            GetLogService().Info(`Properties: message received → ${pMsg.Type}`);
            switch (pMsg.Type) {
                case "WebviewReady":
                    break;
                case "UpdateProperty":
                    if (pMsg.PropertyKey !== undefined)
                        this.OnPropertyChanged(pMsg.PropertyKey, pMsg.Value);
                    break;
                case "OpenSettings":
                    void vscode.commands.executeCommand("workbench.action.openSettings", "dase");
                    break;
                case "RequestModelFiles":
                    void this.SendModelFiles();
                    break;
                case "OpenModel":
                    if (pMsg.Uri)
                        void this.OpenModelFile(pMsg.Uri);
                    break;
            }
        });
    }

    /** Find all .dsorm models in the workspace and push them to the explorer tab. */
    private async SendModelFiles(): Promise<void> {
        if (!this._View)
            return;
        try {
            const uris = await vscode.workspace.findFiles("**/*.dsorm", "**/node_modules/**", 500);
            uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
            const folders = vscode.workspace.workspaceFolders ?? [];
            const files = uris.map(u => {
                const folder = folders.find(f => u.fsPath.startsWith(f.uri.fsPath));
                const rel = folder ? vscode.workspace.asRelativePath(u, false) : u.fsPath;
                const name = rel.replace(/\\/g, "/");
                return { name, uri: u.toString() };
            });
            this._View.webview.postMessage({ Type: "ModelFiles", Files: files });
        }
        catch {
            this._View.webview.postMessage({ Type: "ModelFiles", Files: [] });
        }
    }

    /** Open a .dsorm file in the ORM Designer custom editor. */
    private async OpenModelFile(pUri: string): Promise<void> {
        try {
            const uri = vscode.Uri.parse(pUri);
            await vscode.commands.executeCommand("vscode.openWith", uri, "Dase.ORMDesigner");
        }
        catch (err) {
            void vscode.window.showErrorMessage(`Could not open model: ${err}`);
        }
    }

    // ─── HubView chrome (toolbar + tabs + explorer) ─────────────────────────
    // Shared markup/styles/scripts injected into BOTH HTML templates so the
    // toolbar, tab control, and the .dsorm explorer are identical regardless of
    // whether a design element is currently selected.

    /** CSS for the toolbar, tab control, and explorer. Injected before </style>. */
    private ChromeCss(): string {
        return `
        .dase-toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 6px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBarSectionHeader-background, var(--vscode-panel-background));
        }
        .dase-tool-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--vscode-foreground);
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            padding: 2px 8px;
            cursor: pointer;
        }
        .dase-tool-btn:hover {
            background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.2));
            border-color: var(--vscode-panel-border);
        }
        .dase-tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .dase-tab {
            font-size: 11px;
            color: var(--vscode-foreground);
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            padding: 5px 12px;
            cursor: pointer;
            opacity: 0.7;
        }
        .dase-tab:hover { opacity: 1; }
        .dase-tab-active {
            opacity: 1;
            border-bottom-color: var(--vscode-activityBar-activeBorder, #007acc);
        }
        .dase-pane { display: none; }
        .dase-pane-active { display: block; }
        .dase-explorer-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .dase-explorer-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            opacity: 0.8;
        }
        .dase-explorer-list { padding: 4px 0; }
        .dase-explorer-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .dase-explorer-item:hover { background: var(--vscode-list-hoverBackground); }
        .dase-explorer-icon { opacity: 0.7; flex-shrink: 0; }
        .dase-explorer-name { overflow: hidden; text-overflow: ellipsis; }
        .dase-explorer-empty {
            padding: 10px 12px;
            font-size: 12px;
            opacity: 0.6;
        }`;
    }

    /** Toolbar + tab headers. Injected right after <body>. */
    private ChromeTopHtml(): string {
        return `    <div class="dase-toolbar">
        <button class="dase-tool-btn" id="dase-btn-config" title="Open DASE settings">&#9881; Config</button>
    </div>
    <div class="dase-tabs">
        <button class="dase-tab dase-tab-active" data-tab="properties">Properties</button>
        <button class="dase-tab" data-tab="explorer">Explorer</button>
    </div>`;
    }

    /** Explorer tab pane. Injected after the properties pane. */
    private ExplorerPaneHtml(): string {
        return `    <div id="dase-pane-explorer" class="dase-pane">
        <div class="dase-explorer-toolbar">
            <span class="dase-explorer-title">ORM Models (*.dsorm)</span>
            <button class="dase-tool-btn" id="dase-btn-refresh" title="Refresh">&#8635;</button>
        </div>
        <div id="dase-explorer-list" class="dase-explorer-list">
            <div class="dase-explorer-empty">Loading&hellip;</div>
        </div>
    </div>`;
    }

    /** Tab-switching, config-button, and explorer scripts. Injected before </script>. */
    private ChromeJs(): string {
        return `
        window.addEventListener('error', function(ev) {
            try { vscode.postMessage({ Type: 'WebviewError', Message: (ev && ev.message) ? ev.message : String(ev), Source: (ev && ev.filename) || '', Line: (ev && ev.lineno) || 0 }); } catch (e) {}
        });
        window.addEventListener('unhandledrejection', function(ev) {
            try { vscode.postMessage({ Type: 'WebviewError', Message: 'unhandledrejection: ' + ((ev && ev.reason) ? String(ev.reason) : '') }); } catch (e) {}
        });
        try { vscode.postMessage({ Type: 'WebviewReady' }); } catch (e) {}
        (function() {
            function activateTab(pName) {
                document.querySelectorAll('.dase-tab').forEach(function(t) {
                    t.classList.toggle('dase-tab-active', t.getAttribute('data-tab') === pName);
                });
                document.querySelectorAll('.dase-pane').forEach(function(p) {
                    p.classList.toggle('dase-pane-active', p.id === 'dase-pane-' + pName);
                });
                if (pName === 'explorer') requestModelFiles();
            }
            document.querySelectorAll('.dase-tab').forEach(function(t) {
                t.addEventListener('click', function() { activateTab(t.getAttribute('data-tab')); });
            });
            var cfg = document.getElementById('dase-btn-config');
            if (cfg) cfg.addEventListener('click', function() { vscode.postMessage({ Type: 'OpenSettings' }); });
            var rf = document.getElementById('dase-btn-refresh');
            if (rf) rf.addEventListener('click', requestModelFiles);
            function requestModelFiles() { vscode.postMessage({ Type: 'RequestModelFiles' }); }
            function renderModelFiles(pFiles) {
                var list = document.getElementById('dase-explorer-list');
                if (!list) return;
                if (!pFiles || pFiles.length === 0) {
                    list.innerHTML = '<div class="dase-explorer-empty">No .dsorm models found in the workspace.</div>';
                    return;
                }
                list.innerHTML = '';
                pFiles.forEach(function(f) {
                    var item = document.createElement('div');
                    item.className = 'dase-explorer-item';
                    item.title = f.uri;
                    var icon = document.createElement('span');
                    icon.className = 'dase-explorer-icon';
                    icon.textContent = '▦';
                    var name = document.createElement('span');
                    name.className = 'dase-explorer-name';
                    name.textContent = f.name;
                    item.appendChild(icon);
                    item.appendChild(name);
                    item.addEventListener('click', function() {
                        vscode.postMessage({ Type: 'OpenModel', Uri: f.uri });
                    });
                    list.appendChild(item);
                });
            }
            window.addEventListener('message', function(e) {
                var m = e.data;
                if (m && m.Type === 'ModelFiles') renderModelFiles(m.Files);
            });
        })();`;
    }

    async OnPropertyChanged(pPropertyKey: string, pValue: unknown): Promise<void> {
        if (!this._ElementID)
            return;

        const panel = this._DesignerProvider.GetActivePanel();
        const state = this._DesignerProvider.GetActiveState();

        if (!panel || !state)
            return;

        // Disabling state control removes a field and an FK reference — guard with confirmation
        if (pPropertyKey === "UseStateControl" && pValue === false) {
            const answer = await vscode.window.showWarningMessage(
                "This will remove the state field and its FK reference from the table. Continue?",
                { modal: true },
                "Remove",
                "Cancel"
            );

            if (answer !== "Remove") {
                // User cancelled. Just refresh properties to revert the checkbox visually.
                this._Properties = await state.GetProperties(this._ElementID);
                this.UpdateView();
                return;
            }
        }

        state.UpdateProperty(this._ElementID, pPropertyKey, pValue);

        // When parent model selection changes, wait for the async table load to complete
        // before refreshing properties — otherwise the dropdowns show the old groups.
        // "ParentModel" só existe no domínio ORM; `LoadParentModelTables` é opcional na
        // interface compartilhada por isso mesmo (ver Models/DesignerContracts.ts).
        if (pPropertyKey === "ParentModel" && state.LoadParentModelTables) {
            const models = ((pValue as string) || "").split("|").filter(f => f.length > 0);
            await state.LoadParentModelTables(models);
        }

        // Refresh properties list — structure may change (e.g. DataType changes visible fields)
        // Always force re-render when ParentModel changes (grouped option content changes, not just keys)
        const oldKeys = pPropertyKey === "ParentModel" ? "" : this._Properties.map(p => p.Key).join(",");
        this._Properties = await state.GetProperties(this._ElementID);
        const newKeys = this._Properties.map(p => p.Key).join(",");

        // Only send UpdateProperties when structure changes; avoids innerHTML re-render on every keystroke
        if (oldKeys !== newKeys && this._View) {
            const serializedProperties = this._Properties.map(p => ({
                Key: p.Key,
                Name: p.Name,
                Value: p.Value,
                Type: p.Type,
                Options: p.Options,
                GroupedOptions: p.GroupedOptions || null,
                IsReadOnly: p.IsReadOnly,
                Category: p.Category,
                Group: p.Group,
                Placeholder: p.Placeholder || null,
                Hint: p.Hint || null
            }));
            this._View.webview.postMessage({
                Type: "UpdateProperties",
                ElementID: this._ElementID,
                Properties: serializedProperties
            });
        }
        else if (pPropertyKey === "UseStateControl" && this._View) {
            // Even if the keys didn't change, we need to send the updated properties
            // so the webview knows the value has actually changed, allowing the UI 
            // properties to synchronize visually. 
            // Also, since UseStateControl might trigger shadow table adds
            const serializedProperties = this._Properties.map(p => ({
                Key: p.Key,
                Name: p.Name,
                Value: p.Value,
                Type: p.Type,
                Options: p.Options,
                GroupedOptions: p.GroupedOptions || null,
                IsReadOnly: p.IsReadOnly,
                Category: p.Category,
                Group: p.Group,
                Placeholder: p.Placeholder || null,
                Hint: p.Hint || null
            }));
            this._View.webview.postMessage({
                Type: "UpdateProperties",
                ElementID: this._ElementID,
                Properties: serializedProperties
            });
        }

        const modelData = await state.GetModelData();
        panel.webview.postMessage({
            Type: "LoadModel",
            Payload: modelData
        });

        await this._DesignerProvider.SendIssuesUpdate(panel, state);
        state.Save();
    }


    async SetProperties(pElementID: string, pProperties: XPropertyItem[]): Promise<void> {
        this._ElementID = pElementID;
        this._Properties = pProperties || [];
        this.UpdateView();
    }

    UpdateView(): void {
        if (this._View) {
            GetLogService().Info(`Properties: UpdateView (element=${this._ElementID ?? "none"}, props=${this._Properties.length})`);
            // Serialize properties to plain objects for webview transfer
            const serializedProperties = this._Properties.map(p => ({
                Key: p.Key,
                Name: p.Name,
                Value: p.Value,
                Type: p.Type,
                Options: p.Options,
                GroupedOptions: p.GroupedOptions || null,
                IsReadOnly: p.IsReadOnly,
                Category: p.Category,
                Group: p.Group,
                Placeholder: p.Placeholder || null,
                Hint: p.Hint || null
            }));

            // Force HTML refresh if webview script might not be initialized
            // This is a workaround for VS Code caching issues
            if (serializedProperties.length > 0)
                this._View.webview.html = this.GetHtmlContentWithProperties(serializedProperties);
            else {
                this._View.webview.postMessage({
                    Type: "UpdateProperties",
                    ElementID: this._ElementID,
                    Properties: serializedProperties
                });
            }
        }
    }

    GetHtmlContentWithProperties(pProperties: Array<{ Key: string; Name: string; Value: unknown; Type: string; Options: string[] | null; GroupedOptions?: Array<{ Group: string; Items: string[] }> | null; IsReadOnly: boolean; Category: string; Group?: string; Placeholder?: string | null; Hint?: string | null }>): string {
        const propertiesJson = JSON.stringify(pProperties);
        const elementId = this._ElementID ? `"${this._ElementID}"` : "null";

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-panel-background);
        }
        .properties-container {
            padding: 8px;
        }
        .property-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .property-name {
            flex: 0 0 40%;
            padding-right: 8px;
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 3px;
        }
        .property-name-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
        }
        .prop-hint-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 12px;
            height: 12px;
            font-size: 8px;
            font-weight: 700;
            border-radius: 50%;
            background: var(--vscode-activityBar-activeBorder, #007acc);
            color: #ffffff;
            cursor: help;
            flex-shrink: 0;
            opacity: 0.65;
            user-select: none;
            line-height: 1;
        }
        .prop-hint-icon:hover {
            opacity: 1;
        }
        .property-value {
            flex: 1;
        }
        .property-value input,
        .property-value select {
            width: 100%;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 6px;
            font-family: inherit;
            font-size: inherit;
        }
        .property-value input:focus,
        .property-value select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .property-value input[type="checkbox"] {
            width: auto;
        }
        .no-selection {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
        }
        .property-readonly {
            opacity: 0.6;
        }
        .color-dropdown {
            position: relative;
            width: 100%;
        }
        .color-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .color-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .color-dropdown-swatch {
            width: 16px;
            height: 12px;
            border: 1px solid var(--vscode-input-border);
            flex-shrink: 0;
        }
        .color-dropdown-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .color-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .color-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .color-dropdown.open .color-dropdown-list {
            display: block;
        }
        .color-dropdown-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .color-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .color-dropdown-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        /* DataType dropdown with icons */
        .datatype-dropdown {
            position: relative;
            width: 100%;
        }
        .datatype-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .datatype-dropdown.disabled {
            opacity: 0.55;
            pointer-events: none;
            cursor: default;
        }
        .datatype-dropdown.disabled .datatype-dropdown-selected:hover {
            background-color: transparent;
        }
        .datatype-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .datatype-dropdown-icon {
            display: inline-block;
            background: linear-gradient(135deg, #FF8C00 0%, #FF7200 100%);
            color: #FFFFFF;
            font-size: 9px;
            font-weight: 600;
            min-width: 28px;
            height: 16px;
            line-height: 16px;
            text-align: center;
            border-radius: 3px;
            padding: 0 4px;
            box-shadow: 0 1px 3px rgba(255, 140, 0, 0.3);
            letter-spacing: 0.3px;
        }
        .datatype-dropdown-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .datatype-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .datatype-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .datatype-dropdown.open .datatype-dropdown-list {
            display: block;
        }
        .datatype-dropdown-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .datatype-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .datatype-dropdown-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .property-group {
            margin-bottom: 8px;
        }
        .property-group-header {
            font-weight: 700;
            padding: 5px 8px 4px 10px;
            color: var(--vscode-activityBar-activeBorder, #007acc);
            border-left: 3px solid var(--vscode-activityBar-activeBorder, #007acc);
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 6px;
            margin-top: 6px;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            background: linear-gradient(to right, rgba(0,122,204,0.07), transparent);
        }
        .multifile-dropdown {
            position: relative;
            width: 100%;
        }
        .multifile-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .multifile-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .multifile-dropdown-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
        }
        .multifile-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .multifile-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 150px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .multifile-dropdown.open .multifile-dropdown-list {
            display: block;
        }
        .multifile-dropdown-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .multifile-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .multifile-dropdown-item label {
            cursor: pointer;
            flex: 1;
            font-size: 11px;
        }
        .multifile-no-options {
            padding: 4px 6px;
            opacity: 0.6;
            font-style: italic;
            font-size: 11px;
        }
        .property-value select optgroup {
            font-style: normal;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
        }
        .property-value select.grouped-select option {
            padding-left: 8px;
        }
        .taglist-container {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 3px;
            padding: 3px 5px;
            min-height: 26px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            box-sizing: border-box;
            cursor: text;
        }
        .taglist-container:focus-within {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .taglist-disabled {
            opacity: 0.6;
            cursor: default;
            pointer-events: none;
        }
        .tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 6px 1px 7px;
            background: linear-gradient(135deg, #0078D4 0%, #005a9e 100%);
            color: #ffffff;
            font-size: 10px;
            border-radius: 10px;
            white-space: nowrap;
            max-width: 130px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .tag-remove {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            line-height: 1;
            cursor: pointer;
            opacity: 0.75;
            flex-shrink: 0;
            margin-left: 1px;
            padding-bottom: 1px;
        }
        .tag-remove:hover {
            opacity: 1;
        }
        .tag-input {
            flex: 1;
            min-width: 60px;
            border: none;
            outline: none;
            background: transparent;
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            padding: 1px 2px;
        }
        .taglist-validation-msg {
            font-size: 10px;
            color: var(--vscode-inputValidation-errorForeground, #f14c4c);
            min-height: 13px;
            padding: 1px 4px 0;
        }
${this.ChromeCss()}
    </style>
</head>
<body>
${this.ChromeTopHtml()}
    <div id="dase-pane-properties" class="dase-pane dase-pane-active">
    <div class="properties-container" id="properties-container">
    </div>
    </div>
${this.ExplorerPaneHtml()}
    <script>
        const vscode = acquireVsCodeApi();
        let currentElementID = ${elementId};
        const initialProperties = ${propertiesJson};
        
        // Web Colors - sorted alphabetically by name
        const WebColors = [
            { name: "AliceBlue", hex: "#F0F8FF" },
            { name: "AntiqueWhite", hex: "#FAEBD7" },
            { name: "Aqua", hex: "#00FFFF" },
            { name: "Aquamarine", hex: "#7FFFD4" },
            { name: "Azure", hex: "#F0FFFF" },
            { name: "Beige", hex: "#F5F5DC" },
            { name: "Bisque", hex: "#FFE4C4" },
            { name: "Black", hex: "#000000" },
            { name: "BlanchedAlmond", hex: "#FFEBCD" },
            { name: "Blue", hex: "#0000FF" },
            { name: "BlueViolet", hex: "#8A2BE2" },
            { name: "Brown", hex: "#A52A2A" },
            { name: "BurlyWood", hex: "#DEB887" },
            { name: "CadetBlue", hex: "#5F9EA0" },
            { name: "Chartreuse", hex: "#7FFF00" },
            { name: "Chocolate", hex: "#D2691E" },
            { name: "Coral", hex: "#FF7F50" },
            { name: "CornflowerBlue", hex: "#6495ED" },
            { name: "Cornsilk", hex: "#FFF8DC" },
            { name: "Crimson", hex: "#DC143C" },
            { name: "Cyan", hex: "#00FFFF" },
            { name: "DarkBlue", hex: "#00008B" },
            { name: "DarkCyan", hex: "#008B8B" },
            { name: "DarkGoldenrod", hex: "#B8860B" },
            { name: "DarkGray", hex: "#A9A9A9" },
            { name: "DarkGreen", hex: "#006400" },
            { name: "DarkKhaki", hex: "#BDB76B" },
            { name: "DarkMagenta", hex: "#8B008B" },
            { name: "DarkOliveGreen", hex: "#556B2F" },
            { name: "DarkOrange", hex: "#FF8C00" },
            { name: "DarkOrchid", hex: "#9932CC" },
            { name: "DarkRed", hex: "#8B0000" },
            { name: "DarkSalmon", hex: "#E9967A" },
            { name: "DarkSeaGreen", hex: "#8FBC8F" },
            { name: "DarkSlateBlue", hex: "#483D8B" },
            { name: "DarkSlateGray", hex: "#2F4F4F" },
            { name: "DarkTurquoise", hex: "#00CED1" },
            { name: "DarkViolet", hex: "#9400D3" },
            { name: "DeepPink", hex: "#FF1493" },
            { name: "DeepSkyBlue", hex: "#00BFFF" },
            { name: "DimGray", hex: "#696969" },
            { name: "DodgerBlue", hex: "#1E90FF" },
            { name: "FireBrick", hex: "#B22222" },
            { name: "FloralWhite", hex: "#FFFAF0" },
            { name: "ForestGreen", hex: "#228B22" },
            { name: "Fuchsia", hex: "#FF00FF" },
            { name: "Gainsboro", hex: "#DCDCDC" },
            { name: "GhostWhite", hex: "#F8F8FF" },
            { name: "Gold", hex: "#FFD700" },
            { name: "Goldenrod", hex: "#DAA520" },
            { name: "Gray", hex: "#808080" },
            { name: "Green", hex: "#008000" },
            { name: "GreenYellow", hex: "#ADFF2F" },
            { name: "Honeydew", hex: "#F0FFF0" },
            { name: "HotPink", hex: "#FF69B4" },
            { name: "IndianRed", hex: "#CD5C5C" },
            { name: "Indigo", hex: "#4B0082" },
            { name: "Ivory", hex: "#FFFFF0" },
            { name: "Khaki", hex: "#F0E68C" },
            { name: "Lavender", hex: "#E6E6FA" },
            { name: "LavenderBlush", hex: "#FFF0F5" },
            { name: "LawnGreen", hex: "#7CFC00" },
            { name: "LemonChiffon", hex: "#FFFACD" },
            { name: "LightBlue", hex: "#ADD8E6" },
            { name: "LightCoral", hex: "#F08080" },
            { name: "LightCyan", hex: "#E0FFFF" },
            { name: "LightGoldenrodYellow", hex: "#FAFAD2" },
            { name: "LightGray", hex: "#D3D3D3" },
            { name: "LightGreen", hex: "#90EE90" },
            { name: "LightPink", hex: "#FFB6C1" },
            { name: "LightSalmon", hex: "#FFA07A" },
            { name: "LightSeaGreen", hex: "#20B2AA" },
            { name: "LightSkyBlue", hex: "#87CEFA" },
            { name: "LightSlateGray", hex: "#778899" },
            { name: "LightSteelBlue", hex: "#B0C4DE" },
            { name: "LightYellow", hex: "#FFFFE0" },
            { name: "Lime", hex: "#00FF00" },
            { name: "LimeGreen", hex: "#32CD32" },
            { name: "Linen", hex: "#FAF0E6" },
            { name: "Magenta", hex: "#FF00FF" },
            { name: "Maroon", hex: "#800000" },
            { name: "MediumAquamarine", hex: "#66CDAA" },
            { name: "MediumBlue", hex: "#0000CD" },
            { name: "MediumOrchid", hex: "#BA55D3" },
            { name: "MediumPurple", hex: "#9370DB" },
            { name: "MediumSeaGreen", hex: "#3CB371" },
            { name: "MediumSlateBlue", hex: "#7B68EE" },
            { name: "MediumSpringGreen", hex: "#00FA9A" },
            { name: "MediumTurquoise", hex: "#48D1CC" },
            { name: "MediumVioletRed", hex: "#C71585" },
            { name: "MidnightBlue", hex: "#191970" },
            { name: "MintCream", hex: "#F5FFFA" },
            { name: "MistyRose", hex: "#FFE4E1" },
            { name: "Moccasin", hex: "#FFE4B5" },
            { name: "NavajoWhite", hex: "#FFDEAD" },
            { name: "Navy", hex: "#000080" },
            { name: "OldLace", hex: "#FDF5E6" },
            { name: "Olive", hex: "#808000" },
            { name: "OliveDrab", hex: "#6B8E23" },
            { name: "Orange", hex: "#FFA500" },
            { name: "OrangeRed", hex: "#FF4500" },
            { name: "Orchid", hex: "#DA70D6" },
            { name: "PaleGoldenrod", hex: "#EEE8AA" },
            { name: "PaleGreen", hex: "#98FB98" },
            { name: "PaleTurquoise", hex: "#AFEEEE" },
            { name: "PaleVioletRed", hex: "#DB7093" },
            { name: "PapayaWhip", hex: "#FFEFD5" },
            { name: "PeachPuff", hex: "#FFDAB9" },
            { name: "Peru", hex: "#CD853F" },
            { name: "Pink", hex: "#FFC0CB" },
            { name: "Plum", hex: "#DDA0DD" },
            { name: "PowderBlue", hex: "#B0E0E6" },
            { name: "Purple", hex: "#800080" },
            { name: "Red", hex: "#FF0000" },
            { name: "RosyBrown", hex: "#BC8F8F" },
            { name: "RoyalBlue", hex: "#4169E1" },
            { name: "SaddleBrown", hex: "#8B4513" },
            { name: "Salmon", hex: "#FA8072" },
            { name: "SandyBrown", hex: "#F4A460" },
            { name: "SeaGreen", hex: "#2E8B57" },
            { name: "Seashell", hex: "#FFF5EE" },
            { name: "Sienna", hex: "#A0522D" },
            { name: "Silver", hex: "#C0C0C0" },
            { name: "SkyBlue", hex: "#87CEEB" },
            { name: "SlateBlue", hex: "#6A5ACD" },
            { name: "SlateGray", hex: "#708090" },
            { name: "Snow", hex: "#FFFAFA" },
            { name: "SpringGreen", hex: "#00FF7F" },
            { name: "SteelBlue", hex: "#4682B4" },
            { name: "Tan", hex: "#D2B48C" },
            { name: "Teal", hex: "#008080" },
            { name: "Thistle", hex: "#D8BFD8" },
            { name: "Tomato", hex: "#FF6347" },
            { name: "Turquoise", hex: "#40E0D0" },
            { name: "Violet", hex: "#EE82EE" },
            { name: "Wheat", hex: "#F5DEB3" },
            { name: "White", hex: "#FFFFFF" },
            { name: "WhiteSmoke", hex: "#F5F5F5" },
            { name: "Yellow", hex: "#FFFF00" },
            { name: "YellowGreen", hex: "#9ACD32" }
        ];
        
        // Data type icons mapping
        const DataTypeIcons = {
            "String": "Abc",
            "Int16": "16",
            "Int32": "32",
            "Int64": "64",
            "Decimal": "0.0",
            "Float": "1.5",
            "Double": "2.0",
            "Boolean": "✓✗",
            "DateTime": "📅",
            "Date": "📅",
            "Time": "🕐",
            "Guid": "ID",
            "Byte": "B",
            "Binary": "01",
            "Text": "Txt"
        };

        function GetDataTypeIcon(pDataType) {
            return DataTypeIcons[pDataType] || (pDataType ? pDataType.substring(0, 3) : "?");
        }

        // Render initial properties immediately
        RenderProperties(initialProperties);
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            if (msg.Type === "UpdateProperties")
            {
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            const container = document.getElementById("properties-container");
            
            if (!pProperties || pProperties.length === 0)
            {
                container.innerHTML = '';
                return;
            }

            // Save focus state so we can restore it after DOM replacement
            const focusedEl = document.activeElement;
            const focusedKey = focusedEl ? focusedEl.getAttribute("data-key") : null;
            const selStart = (focusedEl && focusedEl.selectionStart !== undefined) ? focusedEl.selectionStart : null;
            const selEnd = (focusedEl && focusedEl.selectionEnd !== undefined) ? focusedEl.selectionEnd : null;

            const groups = new Map();
            for (const prop of pProperties)
            {
                const grp = prop.Group || "General";
                if (!groups.has(grp))
                    groups.set(grp, []);
                groups.get(grp).push(prop);
            }

            let html = "";
            for (const [grpName, grpProps] of groups)
            {
                html += '<div class="property-group">';
                html += '<div class="property-group-header">' + EscapeHtml(grpName) + '</div>';
                for (const prop of grpProps)
                {
                    html += '<div class="property-row">';
                    html += '<div class="property-name">';
                    html += '<span class="property-name-text" title="' + EscapeHtml(prop.Key) + '">' + EscapeHtml(prop.Name) + '</span>';
                    if (prop.Hint)
                        html += '<span class="prop-hint-icon" title="' + EscapeHtml(prop.Hint) + '">i</span>';
                    html += '</div>';
                    html += '<div class="property-value">';
                    html += GetPropertyEditor(prop);
                    html += '</div></div>';
                }
                html += '</div>';
            }
            
            container.innerHTML = html;
            AttachEventHandlers();

            // Restore focus and cursor position after DOM replacement
            if (focusedKey)
            {
                const restored = container.querySelector('[data-key="' + focusedKey + '"]');
                if (restored && restored.tagName === "INPUT" && restored.type !== "checkbox")
                {
                    restored.focus();
                    try { if (selStart !== null) restored.setSelectionRange(selStart, selEnd); } catch (e) {}
                }
            }
        }

        function FindColorName(pHex)
        {
            const upperHex = pHex.toUpperCase();
            for (const c of WebColors)
            {
                if (c.hex.toUpperCase() === upperHex)
                    return c.name;
            }
            return pHex;
        }

        function GetPropertyEditor(pProp)
        {
            const key = EscapeHtml(pProp.Key);
            const value = pProp.Value !== null && pProp.Value !== undefined ? pProp.Value : "";
            const readonly = pProp.IsReadOnly || pProp.Key === "ID" ? "readonly" : "";

            switch (pProp.Type)
            {
                case "Boolean":
                    const checked = pProp.Value ? "checked" : "";
                    const disabledCheck = pProp.IsReadOnly ? " disabled" : "";
                    return '<input type="checkbox" data-key="' + key + '" ' + checked + disabledCheck + '>';

                case "Number":
                    return '<input type="number" data-key="' + key + '" value="' + value + '" ' + readonly + '>';

                case "Enum":
                    // Use custom datatype dropdown for DataType and PKType properties
                    if (pProp.Key === "DataType" || pProp.Key === "PKType")
                    {
                        const currentValue = String(value);
                        const currentIcon = GetDataTypeIcon(currentValue);
                        if (pProp.IsReadOnly)
                        {
                            return '<div class="datatype-dropdown disabled" data-key="' + key + '">' +
                                   '<div class="datatype-dropdown-selected">' +
                                   '<span class="datatype-dropdown-icon">' + currentIcon + '</span>' +
                                   '<span class="datatype-dropdown-name">' + EscapeHtml(currentValue) + '</span>' +
                                   '</div></div>';
                        }
                        let dataTypeItems = "";
                        if (pProp.Options)
                        {
                            for (const opt of pProp.Options)
                            {
                                const isSelected = opt === currentValue;
                                const icon = GetDataTypeIcon(opt);
                                dataTypeItems += '<div class="datatype-dropdown-item' + (isSelected ? ' selected' : '') + '" data-value="' + EscapeHtml(opt) + '">' +
                                                 '<span class="datatype-dropdown-icon">' + icon + '</span>' +
                                                 '<span class="datatype-dropdown-name">' + EscapeHtml(opt) + '</span></div>';
                            }
                        }
                        return '<div class="datatype-dropdown" data-key="' + key + '">' +
                               '<div class="datatype-dropdown-selected">' +
                               '<span class="datatype-dropdown-icon">' + currentIcon + '</span>' +
                               '<span class="datatype-dropdown-name">' + EscapeHtml(currentValue) + '</span>' +
                               '<span class="datatype-dropdown-arrow">▼</span></div>' +
                               '<div class="datatype-dropdown-list">' + dataTypeItems + '</div></div>';
                    }
                    // Grouped enum - use <optgroup> for tree-like display
                    if (pProp.GroupedOptions && pProp.GroupedOptions.length > 0)
                    {
                        let groupedHtml = '<option value="" ' + (value === "" ? "selected" : "") + '></option>';
                        for (const grp of pProp.GroupedOptions)
                        {
                            groupedHtml += '<optgroup label="' + EscapeHtml(grp.Group) + '">';
                            for (const item of grp.Items)
                            {
                                const sel = item === value ? "selected" : "";
                                groupedHtml += '<option value="' + EscapeHtml(item) + '" ' + sel + '>' + EscapeHtml(item) + '</option>';
                            }
                            groupedHtml += '</optgroup>';
                        }
                        return '<select data-key="' + key + '"' + (pProp.IsReadOnly ? ' disabled' : '') + ' class="grouped-select">' + groupedHtml + '</select>';
                    }
                    // Default enum - standard select
                    let options = "";
                    if (pProp.Options)
                    {
                        for (const opt of pProp.Options)
                        {
                            const selected = opt === value ? "selected" : "";
                            options += '<option value="' + EscapeHtml(opt) + '" ' + selected + '>' + EscapeHtml(opt) + '</option>';
                        }
                    }
                    return '<select data-key="' + key + '"' + (pProp.IsReadOnly ? ' disabled' : '') + '>' + options + '</select>';

                case "Color":
                    const hexColor = ConvertToHtmlColor(value);
                    const selectedColor = WebColors.find(function(c) { return c.hex.toUpperCase() === hexColor.toUpperCase(); }) || { name: "Unknown", hex: hexColor };
                    let colorItems = "";
                    for (const c of WebColors)
                    {
                        const isSelected = c.hex.toUpperCase() === hexColor.toUpperCase();
                        colorItems += '<div class="color-dropdown-item' + (isSelected ? ' selected' : '') + '" data-value="' + c.hex + '">' +
                                     '<div class="color-dropdown-swatch" style="background-color:' + c.hex + '"></div>' +
                                     '<span class="color-dropdown-name">' + c.name + '</span></div>';
                    }
                    return '<div class="color-dropdown" data-key="' + key + '">' +
                           '<div class="color-dropdown-selected">' +
                           '<div class="color-dropdown-swatch" style="background-color:' + hexColor + '"></div>' +
                           '<span class="color-dropdown-name">' + selectedColor.name + '</span>' +
                           '<span class="color-dropdown-arrow">▼</span></div>' +
                           '<div class="color-dropdown-list">' + colorItems + '</div></div>';

                case "MultiFileSelect":
                    const selectedFiles = value ? String(value).split("|").filter(function(f) { return f.length > 0; }) : [];
                    const displayText = selectedFiles.length > 0 ? selectedFiles.join(", ") : "(none)";
                    let checkboxItems = "";
                    if (pProp.Options && pProp.Options.length > 0)
                    {
                        for (const opt of pProp.Options)
                        {
                            const isChecked = selectedFiles.indexOf(opt) >= 0 ? "checked" : "";
                            const cbId = "mf_" + key + "_" + opt.replace(/[^a-zA-Z0-9]/g, "_");
                            checkboxItems += '<div class="multifile-dropdown-item">' +
                                '<input type="checkbox" id="' + EscapeHtml(cbId) + '" data-file="' + EscapeHtml(opt) + '" ' + isChecked + '>' +
                                '<label for="' + EscapeHtml(cbId) + '">' + EscapeHtml(opt) + '</label>' +
                                '</div>';
                        }
                    }
                    else
                    {
                        checkboxItems = '<div class="multifile-no-options">No .dsorm files found</div>';
                    }
                    return '<div class="multifile-dropdown" data-key="' + key + '">' +
                           '<div class="multifile-dropdown-selected">' +
                           '<span class="multifile-dropdown-text">' + EscapeHtml(displayText) + '</span>' +
                           '<span class="multifile-dropdown-arrow">▼</span>' +
                           '</div>' +
                           '<div class="multifile-dropdown-list">' + checkboxItems + '</div>' +
                           '</div>';

                case "TagList":
                    const tagValues = value ? String(value).split("|").filter(function(tv) { return tv.trim().length > 0; }) : [];
                    let tagChips = '';
                    for (const tv of tagValues)
                    {
                        const safeTag = EscapeHtml(tv.trim());
                        tagChips += '<div class="tag-chip" data-tag="' + safeTag + '">' + safeTag;
                        if (!pProp.IsReadOnly) tagChips += '<span class="tag-remove">&#xD7;</span>';
                        tagChips += '</div>';
                    }
                    const tagCls = 'taglist-container' + (pProp.IsReadOnly ? ' taglist-disabled' : '');
                    const tagInput = pProp.IsReadOnly ? '' : '<input class="tag-input" type="text" placeholder="Add value, press Enter\u2026">';
                    return '<div class="' + tagCls + '" data-key="' + key + '">' + tagChips + tagInput + '</div>' +
                           '<div class="taglist-validation-msg"></div>';

                default:
                    const phAttr = pProp.Placeholder ? ' placeholder="' + EscapeHtml(pProp.Placeholder) + '"' : '';
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + phAttr + '>';
            }
        }

        function ConvertToHtmlColor(pArgbHex)
        {
            if (!pArgbHex || pArgbHex.length !== 8)
                return "#000000";
            // XColor.ToString() returns AARRGGBB — strip alpha, prefix with #
            return "#" + pArgbHex.substring(2);
        }

        function ConvertFromHtmlColor(pHtmlColor)
        {
            if (!pHtmlColor || pHtmlColor.length !== 7)
                return "FF000000";
            return "FF" + pHtmlColor.substring(1).toUpperCase();
        }

        function AttachEventHandlers()
        {
            // Handle regular inputs and selects
            // Use "input" for real-time updates, "change" for selects and checkboxes
            const inputs = document.querySelectorAll("input, select");
            inputs.forEach(function(input) {
                const eventType = (input.tagName === "SELECT" || input.type === "checkbox") ? "change" : "input";
                input.addEventListener(eventType, function() {
                    const key = this.getAttribute("data-key");
                    let value;
                    
                    if (this.type === "checkbox")
                        value = this.checked;
                    else if (this.type === "number")
                        value = parseFloat(this.value) || 0;
                    else
                        value = this.value;

                    vscode.postMessage({
                        Type: "UpdateProperty",
                        PropertyKey: key,
                        Value: value
                    });
                });
            });

            // Handle custom color dropdowns
            const colorDropdowns = document.querySelectorAll(".color-dropdown");
            colorDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".color-dropdown-selected");
                const list = dropdown.querySelector(".color-dropdown-list");
                const items = dropdown.querySelectorAll(".color-dropdown-item");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    // Close other dropdowns
                    document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                items.forEach(function(item) {
                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        const hexValue = this.getAttribute("data-value");
                        const colorName = this.querySelector(".color-dropdown-name").textContent;
                        const key = dropdown.getAttribute("data-key");

                        // Update selected display
                        selected.querySelector(".color-dropdown-swatch").style.backgroundColor = hexValue;
                        selected.querySelector(".color-dropdown-name").textContent = colorName;

                        // Update selected state in list
                        items.forEach(function(i) { i.classList.remove("selected"); });
                        this.classList.add("selected");

                        // Close dropdown
                        dropdown.classList.remove("open");

                        // Send update
                        vscode.postMessage({
                            Type: "UpdateProperty",
                            PropertyKey: key,
                            Value: ConvertFromHtmlColor(hexValue)
                        });
                    });
                });
            });

            // Handle custom datatype dropdowns
            const datatypeDropdowns = document.querySelectorAll(".datatype-dropdown:not(.disabled)");
            datatypeDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".datatype-dropdown-selected");
                const items = dropdown.querySelectorAll(".datatype-dropdown-item");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    // Close other dropdowns
                    document.querySelectorAll(".datatype-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                        d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                items.forEach(function(item) {
                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        const value = this.getAttribute("data-value");
                        const name = this.querySelector(".datatype-dropdown-name").textContent;
                        const icon = this.querySelector(".datatype-dropdown-icon").innerHTML;
                        const key = dropdown.getAttribute("data-key");

                        // Update selected display
                        selected.querySelector(".datatype-dropdown-name").textContent = name;
                        selected.querySelector(".datatype-dropdown-icon").innerHTML = icon;

                        // Update selected state in list
                        items.forEach(function(i) { i.classList.remove("selected"); });
                        this.classList.add("selected");

                        // Close dropdown
                        dropdown.classList.remove("open");

                        // Send update
                        vscode.postMessage({
                            Type: "UpdateProperty",
                            PropertyKey: key,
                            Value: value
                        });
                    });
                });
            });

            // Handle multifile-select dropdowns
            const multiFileDropdowns = document.querySelectorAll(".multifile-dropdown");
            multiFileDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".multifile-dropdown-selected");
                const key = dropdown.getAttribute("data-key");
                const textEl = dropdown.querySelector(".multifile-dropdown-text");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    document.querySelectorAll(".color-dropdown.open, .datatype-dropdown.open, .multifile-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                dropdown.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
                    cb.addEventListener("change", function(e) {
                        e.stopPropagation();
                        const checked = [];
                        dropdown.querySelectorAll('input[type="checkbox"]').forEach(function(c) {
                            if (c.checked) checked.push(c.getAttribute("data-file"));
                        });
                        const val = checked.join("|");
                        textEl.textContent = checked.length > 0 ? checked.join(", ") : "(none)";
                        vscode.postMessage({ Type: "UpdateProperty", PropertyKey: key, Value: val });
                    });
                });
            });

            // Handle taglist chip editors
            const taglistContainers = document.querySelectorAll(".taglist-container:not(.taglist-disabled)");
            taglistContainers.forEach(function(container) {
                const tagInput = container.querySelector(".tag-input");
                const tagKey = container.getAttribute("data-key");
                if (!tagInput || !tagKey) return;

                function GetTagValues() {
                    const vals = [];
                    container.querySelectorAll(".tag-chip").forEach(function(ch) { const v = ch.getAttribute("data-tag"); if (v) vals.push(v); });
                    return vals;
                }
                function SendTagUpdate() {
                    vscode.postMessage({ Type: "UpdateProperty", PropertyKey: tagKey, Value: GetTagValues().join("|") });
                }
                function ShowTagError(msg) {
                    const el = container.nextElementSibling;
                    if (el && el.classList.contains("taglist-validation-msg")) el.textContent = msg;
                }
                function ClearTagError() {
                    const el = container.nextElementSibling;
                    if (el && el.classList.contains("taglist-validation-msg")) el.textContent = '';
                }
                function AddTag(raw) {
                    const v = raw.trim();
                    if (!v) { tagInput.value = ''; return; }
                    if (GetTagValues().indexOf(v) >= 0) { ShowTagError('Duplicate: "' + v + '"'); return; }
                    ClearTagError();
                    const chip = document.createElement('div');
                    chip.className = 'tag-chip';
                    chip.setAttribute('data-tag', v);
                    chip.textContent = v;
                    const rm = document.createElement('span');
                    rm.className = 'tag-remove';
                    rm.innerHTML = '&#xD7;';
                    rm.addEventListener('click', function(e) { e.stopPropagation(); chip.remove(); ClearTagError(); SendTagUpdate(); });
                    chip.appendChild(rm);
                    container.insertBefore(chip, tagInput);
                    tagInput.value = '';
                    SendTagUpdate();
                }
                tagInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === '|') { e.preventDefault(); AddTag(tagInput.value); }
                    else if (e.key === 'Backspace' && tagInput.value === '') {
                        const chs = container.querySelectorAll('.tag-chip');
                        if (chs.length > 0) { chs[chs.length - 1].remove(); ClearTagError(); SendTagUpdate(); }
                    }
                });
                tagInput.addEventListener('blur', function() { if (tagInput.value.trim()) AddTag(tagInput.value); });
                container.addEventListener('click', function(e) { if (!e.target.classList.contains('tag-remove')) tagInput.focus(); });
            });

            // Close dropdowns when clicking outside
            document.addEventListener("click", function() {
                document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
                document.querySelectorAll(".datatype-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
                document.querySelectorAll(".multifile-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
            });
        }

        function EscapeHtml(pText)
        {
            if (pText === null || pText === undefined)
                return "";
            const div = document.createElement("div");
            div.textContent = String(pText);
            return div.innerHTML;
        }
${this.ChromeJs()}
    </script>
</body>
</html>`;
    }

    GetHtmlContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-panel-background);
        }
        .properties-container {
            padding: 8px;
        }
        .property-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .property-name {
            flex: 0 0 40%;
            padding-right: 8px;
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 3px;
        }
        .property-name-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
        }
        .prop-hint-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 12px;
            height: 12px;
            font-size: 8px;
            font-weight: 700;
            border-radius: 50%;
            background: var(--vscode-activityBar-activeBorder, #007acc);
            color: #ffffff;
            cursor: help;
            flex-shrink: 0;
            opacity: 0.65;
            user-select: none;
            line-height: 1;
        }
        .prop-hint-icon:hover {
            opacity: 1;
        }
        .property-value {
            flex: 1;
        }
        .property-value input,
        .property-value select {
            width: 100%;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 6px;
            font-family: inherit;
            font-size: inherit;
        }
        .property-value input:focus,
        .property-value select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .property-value input[type="checkbox"] {
            width: auto;
        }
        .no-selection {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
        }
        .property-readonly {
            opacity: 0.6;
        }
        .property-group {
            margin-bottom: 8px;
        }
        .property-group-header {
            font-weight: 700;
            padding: 5px 8px 4px 10px;
            color: var(--vscode-activityBar-activeBorder, #007acc);
            border-left: 3px solid var(--vscode-activityBar-activeBorder, #007acc);
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 6px;
            margin-top: 6px;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            background: linear-gradient(to right, rgba(0,122,204,0.07), transparent);
        }
        .color-dropdown {
            position: relative;
            width: 100%;
        }
        .color-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .color-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .color-dropdown-swatch {
            width: 16px;
            height: 12px;
            border: 1px solid var(--vscode-input-border);
            flex-shrink: 0;
        }
        .color-dropdown-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .color-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .color-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .color-dropdown.open .color-dropdown-list {
            display: block;
        }
        .color-dropdown-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .color-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .color-dropdown-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .multifile-dropdown {
            position: relative;
            width: 100%;
        }
        .multifile-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .multifile-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .multifile-dropdown-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
        }
        .multifile-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .multifile-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 150px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .multifile-dropdown.open .multifile-dropdown-list {
            display: block;
        }
        .multifile-dropdown-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .multifile-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .multifile-dropdown-item label {
            cursor: pointer;
            flex: 1;
            font-size: 11px;
        }
        .multifile-no-options {
            padding: 4px 6px;
            opacity: 0.6;
            font-style: italic;
            font-size: 11px;
        }
        .property-value select optgroup {
            font-style: normal;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
        }
        .property-value select.grouped-select option {
            padding-left: 8px;
        }
        .taglist-container {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 3px;
            padding: 3px 5px;
            min-height: 26px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            box-sizing: border-box;
            cursor: text;
        }
        .taglist-container:focus-within {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .taglist-disabled {
            opacity: 0.6;
            cursor: default;
            pointer-events: none;
        }
        .tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 6px 1px 7px;
            background: linear-gradient(135deg, #0078D4 0%, #005a9e 100%);
            color: #ffffff;
            font-size: 10px;
            border-radius: 10px;
            white-space: nowrap;
            max-width: 130px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .tag-remove {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            line-height: 1;
            cursor: pointer;
            opacity: 0.75;
            flex-shrink: 0;
            margin-left: 1px;
            padding-bottom: 1px;
        }
        .tag-remove:hover {
            opacity: 1;
        }
        .tag-input {
            flex: 1;
            min-width: 60px;
            border: none;
            outline: none;
            background: transparent;
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            padding: 1px 2px;
        }
        .taglist-validation-msg {
            font-size: 10px;
            color: var(--vscode-inputValidation-errorForeground, #f14c4c);
            min-height: 13px;
            padding: 1px 4px 0;
        }
${this.ChromeCss()}
    </style>
</head>
<body>
${this.ChromeTopHtml()}
    <div id="dase-pane-properties" class="dase-pane dase-pane-active">
    <div class="properties-container" id="properties-container">
    </div>
    </div>
${this.ExplorerPaneHtml()}
    <script>
        const vscode = acquireVsCodeApi();
        let currentElementID = null;
        
        // Web Colors - sorted alphabetically by name
        const WebColors = [
            { name: "AliceBlue", hex: "#F0F8FF" },
            { name: "AntiqueWhite", hex: "#FAEBD7" },
            { name: "Aqua", hex: "#00FFFF" },
            { name: "Aquamarine", hex: "#7FFFD4" },
            { name: "Azure", hex: "#F0FFFF" },
            { name: "Beige", hex: "#F5F5DC" },
            { name: "Bisque", hex: "#FFE4C4" },
            { name: "Black", hex: "#000000" },
            { name: "BlanchedAlmond", hex: "#FFEBCD" },
            { name: "Blue", hex: "#0000FF" },
            { name: "BlueViolet", hex: "#8A2BE2" },
            { name: "Brown", hex: "#A52A2A" },
            { name: "BurlyWood", hex: "#DEB887" },
            { name: "CadetBlue", hex: "#5F9EA0" },
            { name: "Chartreuse", hex: "#7FFF00" },
            { name: "Chocolate", hex: "#D2691E" },
            { name: "Coral", hex: "#FF7F50" },
            { name: "CornflowerBlue", hex: "#6495ED" },
            { name: "Cornsilk", hex: "#FFF8DC" },
            { name: "Crimson", hex: "#DC143C" },
            { name: "Cyan", hex: "#00FFFF" },
            { name: "DarkBlue", hex: "#00008B" },
            { name: "DarkCyan", hex: "#008B8B" },
            { name: "DarkGoldenrod", hex: "#B8860B" },
            { name: "DarkGray", hex: "#A9A9A9" },
            { name: "DarkGreen", hex: "#006400" },
            { name: "DarkKhaki", hex: "#BDB76B" },
            { name: "DarkMagenta", hex: "#8B008B" },
            { name: "DarkOliveGreen", hex: "#556B2F" },
            { name: "DarkOrange", hex: "#FF8C00" },
            { name: "DarkOrchid", hex: "#9932CC" },
            { name: "DarkRed", hex: "#8B0000" },
            { name: "DarkSalmon", hex: "#E9967A" },
            { name: "DarkSeaGreen", hex: "#8FBC8F" },
            { name: "DarkSlateBlue", hex: "#483D8B" },
            { name: "DarkSlateGray", hex: "#2F4F4F" },
            { name: "DarkTurquoise", hex: "#00CED1" },
            { name: "DarkViolet", hex: "#9400D3" },
            { name: "DeepPink", hex: "#FF1493" },
            { name: "DeepSkyBlue", hex: "#00BFFF" },
            { name: "DimGray", hex: "#696969" },
            { name: "DodgerBlue", hex: "#1E90FF" },
            { name: "FireBrick", hex: "#B22222" },
            { name: "FloralWhite", hex: "#FFFAF0" },
            { name: "ForestGreen", hex: "#228B22" },
            { name: "Fuchsia", hex: "#FF00FF" },
            { name: "Gainsboro", hex: "#DCDCDC" },
            { name: "GhostWhite", hex: "#F8F8FF" },
            { name: "Gold", hex: "#FFD700" },
            { name: "Goldenrod", hex: "#DAA520" },
            { name: "Gray", hex: "#808080" },
            { name: "Green", hex: "#008000" },
            { name: "GreenYellow", hex: "#ADFF2F" },
            { name: "Honeydew", hex: "#F0FFF0" },
            { name: "HotPink", hex: "#FF69B4" },
            { name: "IndianRed", hex: "#CD5C5C" },
            { name: "Indigo", hex: "#4B0082" },
            { name: "Ivory", hex: "#FFFFF0" },
            { name: "Khaki", hex: "#F0E68C" },
            { name: "Lavender", hex: "#E6E6FA" },
            { name: "LavenderBlush", hex: "#FFF0F5" },
            { name: "LawnGreen", hex: "#7CFC00" },
            { name: "LemonChiffon", hex: "#FFFACD" },
            { name: "LightBlue", hex: "#ADD8E6" },
            { name: "LightCoral", hex: "#F08080" },
            { name: "LightCyan", hex: "#E0FFFF" },
            { name: "LightGoldenrodYellow", hex: "#FAFAD2" },
            { name: "LightGray", hex: "#D3D3D3" },
            { name: "LightGreen", hex: "#90EE90" },
            { name: "LightPink", hex: "#FFB6C1" },
            { name: "LightSalmon", hex: "#FFA07A" },
            { name: "LightSeaGreen", hex: "#20B2AA" },
            { name: "LightSkyBlue", hex: "#87CEFA" },
            { name: "LightSlateGray", hex: "#778899" },
            { name: "LightSteelBlue", hex: "#B0C4DE" },
            { name: "LightYellow", hex: "#FFFFE0" },
            { name: "Lime", hex: "#00FF00" },
            { name: "LimeGreen", hex: "#32CD32" },
            { name: "Linen", hex: "#FAF0E6" },
            { name: "Magenta", hex: "#FF00FF" },
            { name: "Maroon", hex: "#800000" },
            { name: "MediumAquamarine", hex: "#66CDAA" },
            { name: "MediumBlue", hex: "#0000CD" },
            { name: "MediumOrchid", hex: "#BA55D3" },
            { name: "MediumPurple", hex: "#9370DB" },
            { name: "MediumSeaGreen", hex: "#3CB371" },
            { name: "MediumSlateBlue", hex: "#7B68EE" },
            { name: "MediumSpringGreen", hex: "#00FA9A" },
            { name: "MediumTurquoise", hex: "#48D1CC" },
            { name: "MediumVioletRed", hex: "#C71585" },
            { name: "MidnightBlue", hex: "#191970" },
            { name: "MintCream", hex: "#F5FFFA" },
            { name: "MistyRose", hex: "#FFE4E1" },
            { name: "Moccasin", hex: "#FFE4B5" },
            { name: "NavajoWhite", hex: "#FFDEAD" },
            { name: "Navy", hex: "#000080" },
            { name: "OldLace", hex: "#FDF5E6" },
            { name: "Olive", hex: "#808000" },
            { name: "OliveDrab", hex: "#6B8E23" },
            { name: "Orange", hex: "#FFA500" },
            { name: "OrangeRed", hex: "#FF4500" },
            { name: "Orchid", hex: "#DA70D6" },
            { name: "PaleGoldenrod", hex: "#EEE8AA" },
            { name: "PaleGreen", hex: "#98FB98" },
            { name: "PaleTurquoise", hex: "#AFEEEE" },
            { name: "PaleVioletRed", hex: "#DB7093" },
            { name: "PapayaWhip", hex: "#FFEFD5" },
            { name: "PeachPuff", hex: "#FFDAB9" },
            { name: "Peru", hex: "#CD853F" },
            { name: "Pink", hex: "#FFC0CB" },
            { name: "Plum", hex: "#DDA0DD" },
            { name: "PowderBlue", hex: "#B0E0E6" },
            { name: "Purple", hex: "#800080" },
            { name: "Red", hex: "#FF0000" },
            { name: "RosyBrown", hex: "#BC8F8F" },
            { name: "RoyalBlue", hex: "#4169E1" },
            { name: "SaddleBrown", hex: "#8B4513" },
            { name: "Salmon", hex: "#FA8072" },
            { name: "SandyBrown", hex: "#F4A460" },
            { name: "SeaGreen", hex: "#2E8B57" },
            { name: "Seashell", hex: "#FFF5EE" },
            { name: "Sienna", hex: "#A0522D" },
            { name: "Silver", hex: "#C0C0C0" },
            { name: "SkyBlue", hex: "#87CEEB" },
            { name: "SlateBlue", hex: "#6A5ACD" },
            { name: "SlateGray", hex: "#708090" },
            { name: "Snow", hex: "#FFFAFA" },
            { name: "SpringGreen", hex: "#00FF7F" },
            { name: "SteelBlue", hex: "#4682B4" },
            { name: "Tan", hex: "#D2B48C" },
            { name: "Teal", hex: "#008080" },
            { name: "Thistle", hex: "#D8BFD8" },
            { name: "Tomato", hex: "#FF6347" },
            { name: "Turquoise", hex: "#40E0D0" },
            { name: "Violet", hex: "#EE82EE" },
            { name: "Wheat", hex: "#F5DEB3" },
            { name: "White", hex: "#FFFFFF" },
            { name: "WhiteSmoke", hex: "#F5F5F5" },
            { name: "Yellow", hex: "#FFFF00" },
            { name: "YellowGreen", hex: "#9ACD32" }
        ];

        // Data type icons mapping
        const DataTypeIcons = {
            "String": "Abc",
            "Int16": "16",
            "Int32": "32",
            "Int64": "64",
            "Decimal": "0.0",
            "Float": "1.5",
            "Double": "2.0",
            "Boolean": "✓✗",
            "DateTime": "📅",
            "Date": "📅",
            "Time": "🕐",
            "Guid": "ID",
            "Byte": "B",
            "Binary": "01",
            "Text": "Txt"
        };

        function GetDataTypeIcon(pDataType) {
            return DataTypeIcons[pDataType] || (pDataType ? pDataType.substring(0, 3) : "?");
        }
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            if (msg.Type === "UpdateProperties")
            {
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            const container = document.getElementById("properties-container");
            
            if (!pProperties || pProperties.length === 0)
            {
                container.innerHTML = '';
                return;
            }

            // Save focus state so we can restore it after DOM replacement
            const focusedEl = document.activeElement;
            const focusedKey = focusedEl ? focusedEl.getAttribute("data-key") : null;
            const selStart = (focusedEl && focusedEl.selectionStart !== undefined) ? focusedEl.selectionStart : null;
            const selEnd = (focusedEl && focusedEl.selectionEnd !== undefined) ? focusedEl.selectionEnd : null;

            const groups = new Map();
            for (const prop of pProperties)
            {
                const grp = prop.Group || "General";
                if (!groups.has(grp))
                    groups.set(grp, []);
                groups.get(grp).push(prop);
            }

            let html = "";
            for (const [grpName, grpProps] of groups)
            {
                html += '<div class="property-group">';
                html += '<div class="property-group-header">' + EscapeHtml(grpName) + '</div>';
                for (const prop of grpProps)
                {
                    html += '<div class="property-row">';
                    html += '<div class="property-name">';
                    html += '<span class="property-name-text" title="' + EscapeHtml(prop.Key) + '">' + EscapeHtml(prop.Name) + '</span>';
                    if (prop.Hint)
                        html += '<span class="prop-hint-icon" title="' + EscapeHtml(prop.Hint) + '">i</span>';
                    html += '</div>';
                    html += '<div class="property-value">';
                    html += GetPropertyEditor(prop);
                    html += '</div></div>';
                }
                html += '</div>';
            }
            
            container.innerHTML = html;
            AttachEventHandlers();

            // Restore focus and cursor position after DOM replacement
            if (focusedKey)
            {
                const restored = container.querySelector('[data-key="' + focusedKey + '"]');
                if (restored && restored.tagName === "INPUT" && restored.type !== "checkbox")
                {
                    restored.focus();
                    try { if (selStart !== null) restored.setSelectionRange(selStart, selEnd); } catch (e) {}
                }
            }
        }

        function GetPropertyEditor(pProp)
        {
            const key = EscapeHtml(pProp.Key);
            const value = pProp.Value !== null && pProp.Value !== undefined ? pProp.Value : "";
            const readonly = pProp.IsReadOnly || pProp.Key === "ID" ? "readonly" : "";

            switch (pProp.Type)
            {
                case "Boolean":
                    const checked = pProp.Value ? "checked" : "";
                    const disabledCheck = pProp.IsReadOnly ? " disabled" : "";
                    return '<input type="checkbox" data-key="' + key + '" ' + checked + disabledCheck + '>';

                case "Number":
                    return '<input type="number" data-key="' + key + '" value="' + value + '" ' + readonly + '>';

                case "Enum":
                    // Use custom datatype dropdown for DataType and PKType properties
                    if (pProp.Key === "DataType" || pProp.Key === "PKType")
                    {
                        const currentValue = String(value);
                        const currentIcon = GetDataTypeIcon(currentValue);
                        if (pProp.IsReadOnly)
                        {
                            return '<div class="datatype-dropdown disabled" data-key="' + key + '">' +
                                   '<div class="datatype-dropdown-selected">' +
                                   '<span class="datatype-dropdown-icon">' + currentIcon + '</span>' +
                                   '<span class="datatype-dropdown-name">' + EscapeHtml(currentValue) + '</span>' +
                                   '</div></div>';
                        }
                        let dataTypeItems = "";
                        if (pProp.Options)
                        {
                            for (const opt of pProp.Options)
                            {
                                const isSelected = opt === currentValue;
                                const icon = GetDataTypeIcon(opt);
                                dataTypeItems += '<div class="datatype-dropdown-item' + (isSelected ? ' selected' : '') + '" data-value="' + EscapeHtml(opt) + '">' +
                                                 '<span class="datatype-dropdown-icon">' + icon + '</span>' +
                                                 '<span class="datatype-dropdown-name">' + EscapeHtml(opt) + '</span></div>';
                            }
                        }
                        return '<div class="datatype-dropdown" data-key="' + key + '">' +
                               '<div class="datatype-dropdown-selected">' +
                               '<span class="datatype-dropdown-icon">' + currentIcon + '</span>' +
                               '<span class="datatype-dropdown-name">' + EscapeHtml(currentValue) + '</span>' +
                               '<span class="datatype-dropdown-arrow">▼</span></div>' +
                               '<div class="datatype-dropdown-list">' + dataTypeItems + '</div></div>';
                    }
                    // Grouped enum - use <optgroup> for tree-like display
                    if (pProp.GroupedOptions && pProp.GroupedOptions.length > 0)
                    {
                        let groupedHtml = '<option value="" ' + (value === "" ? "selected" : "") + '></option>';
                        for (const grp of pProp.GroupedOptions)
                        {
                            groupedHtml += '<optgroup label="' + EscapeHtml(grp.Group) + '">';
                            for (const item of grp.Items)
                            {
                                const sel = item === value ? "selected" : "";
                                groupedHtml += '<option value="' + EscapeHtml(item) + '" ' + sel + '>' + EscapeHtml(item) + '</option>';
                            }
                            groupedHtml += '</optgroup>';
                        }
                        return '<select data-key="' + key + '"' + (pProp.IsReadOnly ? ' disabled' : '') + ' class="grouped-select">' + groupedHtml + '</select>';
                    }
                    // Default enum - standard select
                    let options = "";
                    if (pProp.Options)
                    {
                        for (const opt of pProp.Options)
                        {
                            const selected = opt === value ? "selected" : "";
                            options += '<option value="' + EscapeHtml(opt) + '" ' + selected + '>' + EscapeHtml(opt) + '</option>';
                        }
                    }
                    return '<select data-key="' + key + '"' + (pProp.IsReadOnly ? ' disabled' : '') + '>' + options + '</select>';

                case "Color":
                    const hexColor = ConvertToHtmlColor(value);
                    const selectedColor = WebColors.find(function(c) { return c.hex.toUpperCase() === hexColor.toUpperCase(); }) || { name: "Unknown", hex: hexColor };
                    let colorItems = "";
                    for (const c of WebColors)
                    {
                        const isSelected = c.hex.toUpperCase() === hexColor.toUpperCase();
                        colorItems += '<div class="color-dropdown-item' + (isSelected ? ' selected' : '') + '" data-value="' + c.hex + '">' +
                                     '<div class="color-dropdown-swatch" style="background-color:' + c.hex + '"></div>' +
                                     '<span class="color-dropdown-name">' + c.name + '</span></div>';
                    }
                    return '<div class="color-dropdown" data-key="' + key + '">' +
                           '<div class="color-dropdown-selected">' +
                           '<div class="color-dropdown-swatch" style="background-color:' + hexColor + '"></div>' +
                           '<span class="color-dropdown-name">' + selectedColor.name + '</span>' +
                           '<span class="color-dropdown-arrow">▼</span></div>' +
                           '<div class="color-dropdown-list">' + colorItems + '</div></div>';

                case "MultiFileSelect":
                    const selectedFiles = value ? String(value).split("|").filter(function(f) { return f.length > 0; }) : [];
                    const displayText = selectedFiles.length > 0 ? selectedFiles.join(", ") : "(none)";
                    let checkboxItems = "";
                    if (pProp.Options && pProp.Options.length > 0)
                    {
                        for (const opt of pProp.Options)
                        {
                            const isChecked = selectedFiles.indexOf(opt) >= 0 ? "checked" : "";
                            const cbId = "mf_" + key + "_" + opt.replace(/[^a-zA-Z0-9]/g, "_");
                            checkboxItems += '<div class="multifile-dropdown-item">' +
                                '<input type="checkbox" id="' + EscapeHtml(cbId) + '" data-file="' + EscapeHtml(opt) + '" ' + isChecked + '>' +
                                '<label for="' + EscapeHtml(cbId) + '">' + EscapeHtml(opt) + '</label>' +
                                '</div>';
                        }
                    }
                    else
                    {
                        checkboxItems = '<div class="multifile-no-options">No .dsorm files found</div>';
                    }
                    return '<div class="multifile-dropdown" data-key="' + key + '">' +
                           '<div class="multifile-dropdown-selected">' +
                           '<span class="multifile-dropdown-text">' + EscapeHtml(displayText) + '</span>' +
                           '<span class="multifile-dropdown-arrow">▼</span>' +
                           '</div>' +
                           '<div class="multifile-dropdown-list">' + checkboxItems + '</div>' +
                           '</div>';

                case "TagList":
                    const tagValues = value ? String(value).split("|").filter(function(tv) { return tv.trim().length > 0; }) : [];
                    let tagChips = '';
                    for (const tv of tagValues)
                    {
                        const safeTag = EscapeHtml(tv.trim());
                        tagChips += '<div class="tag-chip" data-tag="' + safeTag + '">' + safeTag;
                        if (!pProp.IsReadOnly) tagChips += '<span class="tag-remove">&#xD7;</span>';
                        tagChips += '</div>';
                    }
                    const tagCls = 'taglist-container' + (pProp.IsReadOnly ? ' taglist-disabled' : '');
                    const tagInput = pProp.IsReadOnly ? '' : '<input class="tag-input" type="text" placeholder="Add value, press Enter\u2026">';
                    return '<div class="' + tagCls + '" data-key="' + key + '">' + tagChips + tagInput + '</div>' +
                           '<div class="taglist-validation-msg"></div>';

                default:
                    const phAttr = pProp.Placeholder ? ' placeholder="' + EscapeHtml(pProp.Placeholder) + '"' : '';
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + phAttr + '>';
            }
        }

        function ConvertToHtmlColor(pArgbHex)
        {
            // Convert AARRGGBB to #RRGGBB for HTML color input
            if (!pArgbHex || pArgbHex.length !== 8)
                return "#000000";
            return "#" + pArgbHex.substring(2);
        }

        function ConvertFromHtmlColor(pHtmlColor)
        {
            // Convert #RRGGBB to FFRRGGBB (full opacity)
            if (!pHtmlColor || pHtmlColor.length !== 7)
                return "FF000000";
            return "FF" + pHtmlColor.substring(1).toUpperCase();
        }

        function AttachEventHandlers()
        {
            // Handle regular inputs and selects
            // Use "input" for real-time updates, "change" for selects and checkboxes
            const inputs = document.querySelectorAll("input, select");
            inputs.forEach(function(input) {
                const eventType = (input.tagName === "SELECT" || input.type === "checkbox") ? "change" : "input";
                input.addEventListener(eventType, function() {
                    const key = this.getAttribute("data-key");
                    let value;
                    
                    if (this.type === "checkbox")
                        value = this.checked;
                    else if (this.type === "number")
                        value = parseFloat(this.value) || 0;
                    else
                        value = this.value;

                    vscode.postMessage({
                        Type: "UpdateProperty",
                        PropertyKey: key,
                        Value: value
                    });
                });
            });

            // Handle custom color dropdowns
            const colorDropdowns = document.querySelectorAll(".color-dropdown");
            colorDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".color-dropdown-selected");
                const list = dropdown.querySelector(".color-dropdown-list");
                const items = dropdown.querySelectorAll(".color-dropdown-item");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    // Close other dropdowns
                    document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                items.forEach(function(item) {
                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        const hexValue = this.getAttribute("data-value");
                        const colorName = this.querySelector(".color-dropdown-name").textContent;
                        const key = dropdown.getAttribute("data-key");

                        // Update selected display
                        selected.querySelector(".color-dropdown-swatch").style.backgroundColor = hexValue;
                        selected.querySelector(".color-dropdown-name").textContent = colorName;

                        // Update selected state in list
                        items.forEach(function(i) { i.classList.remove("selected"); });
                        this.classList.add("selected");

                        // Close dropdown
                        dropdown.classList.remove("open");

                        // Send update
                        vscode.postMessage({
                            Type: "UpdateProperty",
                            PropertyKey: key,
                            Value: ConvertFromHtmlColor(hexValue)
                        });
                    });
                });
            });

            // Handle custom datatype dropdowns
            const datatypeDropdowns = document.querySelectorAll(".datatype-dropdown:not(.disabled)");
            datatypeDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".datatype-dropdown-selected");
                const items = dropdown.querySelectorAll(".datatype-dropdown-item");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    // Close other dropdowns
                    document.querySelectorAll(".datatype-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                        d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                items.forEach(function(item) {
                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        const value = this.getAttribute("data-value");
                        const name = this.querySelector(".datatype-dropdown-name").textContent;
                        const icon = this.querySelector(".datatype-dropdown-icon").innerHTML;
                        const key = dropdown.getAttribute("data-key");

                        // Update selected display
                        selected.querySelector(".datatype-dropdown-name").textContent = name;
                        selected.querySelector(".datatype-dropdown-icon").innerHTML = icon;

                        // Update selected state in list
                        items.forEach(function(i) { i.classList.remove("selected"); });
                        this.classList.add("selected");

                        // Close dropdown
                        dropdown.classList.remove("open");

                        // Send update
                        vscode.postMessage({
                            Type: "UpdateProperty",
                            PropertyKey: key,
                            Value: value
                        });
                    });
                });
            });

            // Handle multifile-select dropdowns
            const multiFileDropdowns = document.querySelectorAll(".multifile-dropdown");
            multiFileDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".multifile-dropdown-selected");
                const key = dropdown.getAttribute("data-key");
                const textEl = dropdown.querySelector(".multifile-dropdown-text");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    document.querySelectorAll(".color-dropdown.open, .datatype-dropdown.open, .multifile-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                dropdown.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
                    cb.addEventListener("change", function(e) {
                        e.stopPropagation();
                        const checked = [];
                        dropdown.querySelectorAll('input[type="checkbox"]').forEach(function(c) {
                            if (c.checked) checked.push(c.getAttribute("data-file"));
                        });
                        const val = checked.join("|");
                        textEl.textContent = checked.length > 0 ? checked.join(", ") : "(none)";
                        vscode.postMessage({ Type: "UpdateProperty", PropertyKey: key, Value: val });
                    });
                });
            });

            // Handle taglist chip editors
            const taglistContainers = document.querySelectorAll(".taglist-container:not(.taglist-disabled)");
            taglistContainers.forEach(function(container) {
                const tagInput = container.querySelector(".tag-input");
                const tagKey = container.getAttribute("data-key");
                if (!tagInput || !tagKey) return;

                function GetTagValues() {
                    const vals = [];
                    container.querySelectorAll(".tag-chip").forEach(function(ch) { const v = ch.getAttribute("data-tag"); if (v) vals.push(v); });
                    return vals;
                }
                function SendTagUpdate() {
                    vscode.postMessage({ Type: "UpdateProperty", PropertyKey: tagKey, Value: GetTagValues().join("|") });
                }
                function ShowTagError(msg) {
                    const el = container.nextElementSibling;
                    if (el && el.classList.contains("taglist-validation-msg")) el.textContent = msg;
                }
                function ClearTagError() {
                    const el = container.nextElementSibling;
                    if (el && el.classList.contains("taglist-validation-msg")) el.textContent = '';
                }
                function AddTag(raw) {
                    const v = raw.trim();
                    if (!v) { tagInput.value = ''; return; }
                    if (GetTagValues().indexOf(v) >= 0) { ShowTagError('Duplicate: "' + v + '"'); return; }
                    ClearTagError();
                    const chip = document.createElement('div');
                    chip.className = 'tag-chip';
                    chip.setAttribute('data-tag', v);
                    chip.textContent = v;
                    const rm = document.createElement('span');
                    rm.className = 'tag-remove';
                    rm.innerHTML = '&#xD7;';
                    rm.addEventListener('click', function(e) { e.stopPropagation(); chip.remove(); ClearTagError(); SendTagUpdate(); });
                    chip.appendChild(rm);
                    container.insertBefore(chip, tagInput);
                    tagInput.value = '';
                    SendTagUpdate();
                }
                tagInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === '|') { e.preventDefault(); AddTag(tagInput.value); }
                    else if (e.key === 'Backspace' && tagInput.value === '') {
                        const chs = container.querySelectorAll('.tag-chip');
                        if (chs.length > 0) { chs[chs.length - 1].remove(); ClearTagError(); SendTagUpdate(); }
                    }
                });
                tagInput.addEventListener('blur', function() { if (tagInput.value.trim()) AddTag(tagInput.value); });
                container.addEventListener('click', function(e) { if (!e.target.classList.contains('tag-remove')) tagInput.focus(); });
            });

            // Close dropdowns when clicking outside
            document.addEventListener("click", function() {
                document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
                document.querySelectorAll(".datatype-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
                document.querySelectorAll(".multifile-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
            });
        }

        function EscapeHtml(pText)
        {
            if (pText === null || pText === undefined)
                return "";
            const div = document.createElement("div");
            div.textContent = String(pText);
            return div.innerHTML;
        }
${this.ChromeJs()}
    </script>
</body>
</html>`;
    }
}
