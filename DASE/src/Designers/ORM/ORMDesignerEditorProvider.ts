import * as vscode from "vscode";
import * as path from "path";
import { XDesignerMessageType } from "./ORMDesignerMessages";
import { XORMDesignerState } from "./ORMDesignerState";
import { GetSelectionService } from "../../Services/SelectionService";
import { GetLogService } from "../../Services/LogService";
import { XDesignerSelection } from "../../Models/DesignerSelection";
import { XIssueItem } from "../../Models/IssueItem";

interface ISelectPayload
{
    Clear?: boolean;
    Toggle?: boolean;
    Add?: boolean;
    ElementID?: string;
}

interface IAddTablePayload
{
    X: number;
    Y: number;
    Name: string;
}

interface IAddRelationPayload
{
    SourceID: string;
    TargetID: string;
    Name?: string;
}

interface IAddFieldPayload
{
    TableID: string;
    Name: string;
    DataType: string;
}

interface IMoveElementPayload
{
    ElementID: string;
    X: number;
    Y: number;
}

interface IUpdatePropertyPayload
{
    ElementID: string;
    PropertyKey: string;
    Value: unknown;
}

interface IRenamePayload
{
    NewName: string;
}

interface IDesignerMessage
{
    Type: string;
    Payload?: unknown;
}

interface ICustomDocument extends vscode.CustomDocument
{
    uri: vscode.Uri;
    dispose: () => void;
}

export class XORMDesignerEditorProvider implements vscode.CustomEditorProvider<ICustomDocument>
{
    private _Context: vscode.ExtensionContext;
    private _Webviews: Map<string, vscode.WebviewPanel>;
    private _States: Map<string, XORMDesignerState>;
    private _Documents: Map<string, ICustomDocument>;

    private _OnDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ICustomDocument>>();
    public readonly onDidChangeCustomDocument = this._OnDidChangeCustomDocument.event;

    constructor(pContext: vscode.ExtensionContext)
    {
        this._Context = pContext;
        this._Webviews = new Map<string, vscode.WebviewPanel>();
        this._States = new Map<string, XORMDesignerState>();
        this._Documents = new Map<string, ICustomDocument>();
    }

    static get ViewType(): string
    {
        return "Dase.ORMDesigner";
    }

    static Register(pContext: vscode.ExtensionContext): XORMDesignerEditorProvider
    {
        const provider = new XORMDesignerEditorProvider(pContext);

        const registration = vscode.window.registerCustomEditorProvider(
            XORMDesignerEditorProvider.ViewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        );

        pContext.subscriptions.push(registration);
        return provider;
    }

    async openCustomDocument(pUri: vscode.Uri, _pOpenContext: vscode.CustomDocumentOpenContext, _pToken: vscode.CancellationToken): Promise<ICustomDocument>
    {
        const doc: ICustomDocument = {
            uri: pUri,
            dispose: () => { /* nothing */ }
        };
        return doc;
    }

    async resolveCustomEditor(pDocument: ICustomDocument, pWebviewPanel: vscode.WebviewPanel, _pToken: vscode.CancellationToken): Promise<void>
    {
        const state = new XORMDesignerState(pDocument as unknown as vscode.TextDocument);
        this._States.set(pDocument.uri.toString(), state);
        this._Webviews.set(pDocument.uri.toString(), pWebviewPanel);
        this._Documents.set(pDocument.uri.toString(), pDocument);

        // Listen to state changes to notify VS Code about dirty state
        state.OnStateChanged((e) => {
            if (e.IsDirty)
            {
                // Only fire when becoming dirty - VS Code handles clean state automatically after save
                this._OnDidChangeCustomDocument.fire({ document: pDocument });
            }
        });

        pWebviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._Context.extensionPath, "media"))
            ]
        };

        pWebviewPanel.webview.html = this.GetWebviewContent(pWebviewPanel.webview);

        this.SetupMessageHandling(pWebviewPanel, state);

        pWebviewPanel.onDidDispose(() => {
            this._Webviews.delete(pDocument.uri.toString());
            this._States.delete(pDocument.uri.toString());
            this._Documents.delete(pDocument.uri.toString());
            state.Dispose();
        });

        try
        {
            await state.Load();
        }
        catch (err)
        {
            GetLogService().Error(`Failed to load document: ${pDocument.uri.fsPath}`, err);
        }
    }

    async saveCustomDocument(pDocument: ICustomDocument, _pCancellation: vscode.CancellationToken): Promise<void>
    {
        GetLogService().Info(`saveCustomDocument called for: ${pDocument.uri.toString()}`);
        const state = this._States.get(pDocument.uri.toString());
        if (state)
        {
            await state.Save();
            GetLogService().Info(`Document saved successfully: ${pDocument.uri.toString()}`);
        }
        else
        {
            GetLogService().Error(`saveCustomDocument: State not found for ${pDocument.uri.toString()}`);
        }
    }

    async saveCustomDocumentAs(pDocument: ICustomDocument, pDestination: vscode.Uri, _pCancellation: vscode.CancellationToken): Promise<void>
    {
        GetLogService().Info(`saveCustomDocumentAs called: ${pDocument.uri.toString()} -> ${pDestination.toString()}`);
        const state = this._States.get(pDocument.uri.toString());
        if (state)
        {
            const text = state.Bridge.SaveOrmModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(pDestination, bytes);
            GetLogService().Info(`Document saved as successfully: ${pDestination.toString()}`);
            // Note: Do not set IsDirty = false here. VS Code will close the old editor
            // and open a new one for the destination URI.
        }
        else
        {
            GetLogService().Error(`saveCustomDocumentAs: State not found for ${pDocument.uri.toString()}`);
        }
    }

    async revertCustomDocument(pDocument: ICustomDocument, _pCancellation: vscode.CancellationToken): Promise<void>
    {
        const state = this._States.get(pDocument.uri.toString());
        if (state)
            await state.Load();
    }

    async backupCustomDocument(pDocument: ICustomDocument, pContext: vscode.CustomDocumentBackupContext, _pCancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup>
    {
        const state = this._States.get(pDocument.uri.toString());
        if (state)
        {
            const text = state.Bridge.SaveOrmModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(pContext.destination, bytes);
        }
        return { id: pContext.destination.toString(), delete: () => vscode.workspace.fs.delete(pContext.destination) };
    }

    SetupMessageHandling(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): void
    {
        const selectionService = GetSelectionService();

        pPanel.webview.onDidReceiveMessage(async (pMsg: IDesignerMessage) => {
            await this.HandleMessage(pPanel, pState, pMsg);
        });

        selectionService.OnSelectionChanged(async (pSelection: XDesignerSelection) => {
            const props = pSelection.PrimaryID 
                ? await pState.GetProperties(pSelection.PrimaryID) 
                : [];
            
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.SelectionChanged,
                Payload: { SelectedIDs: pSelection.SelectedIDs, PrimaryID: pSelection.PrimaryID }
            });

            pPanel.webview.postMessage({
                Type: XDesignerMessageType.PropertiesChanged,
                Payload: { Properties: props }
            });
        });

        pState.IssueService.OnIssuesChanged((pIssues: XIssueItem[]) => {
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.IssuesChanged,
                Payload: { Issues: pIssues }
            });
        });
    }

    async HandleMessage(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pMsg: IDesignerMessage): Promise<void>
    {
        const type = pMsg.Type;
        const payload = pMsg.Payload || {};

        // Log all messages except frequent ones
        if (type !== XDesignerMessageType.SelectElement && type !== XDesignerMessageType.MoveElement)
            GetLogService().Debug(`Message received: ${type}, Payload: ${JSON.stringify(payload)}`);

        switch (type)
        {
            case XDesignerMessageType.DesignerReady:
                await this.OnDesignerReady(pPanel, pState);
                break;

            case XDesignerMessageType.SaveModel:
                await this.OnSaveModel(pState);
                break;

            case XDesignerMessageType.SelectElement:
                this.OnSelectElement(payload as ISelectPayload);
                break;

            case XDesignerMessageType.AddTable:
                await this.OnAddTable(pPanel, pState, payload as IAddTablePayload);
                break;

            case XDesignerMessageType.AddField:
                await this.OnAddField(pPanel, pState, payload as IAddFieldPayload);
                break;

            case XDesignerMessageType.MoveElement:
                await this.OnMoveElement(pPanel, pState, payload as IMoveElementPayload);
                break;

            case XDesignerMessageType.DeleteSelected:
                await this.OnDeleteSelected(pPanel, pState);
                break;

            case XDesignerMessageType.DragDropAddRelation:
                await this.OnAddRelation(pPanel, pState, payload as IAddRelationPayload);
                break;

            case XDesignerMessageType.UpdateProperty:
                await this.OnUpdateProperty(pPanel, pState, payload as IUpdatePropertyPayload);
                break;

            case XDesignerMessageType.ValidateModel:
                await this.OnValidateModel(pPanel, pState);
                break;

            case XDesignerMessageType.RenameCompleted:
                await this.OnRenameCompleted(pPanel, pState, payload as IRenamePayload);
                break;

            case XDesignerMessageType.AlignLines:
                await this.OnAlignLines(pPanel, pState);
                break;

            default:
                console.warn("Unknown message type:", type);
        }
    }

    async OnDesignerReady(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void>
    {
        // Route all lines before sending model to ensure proper orthogonal routing
        GetLogService().Info('[OnDesignerReady] About to call AlignLines');
        const alignResult = pState.AlignLines();
        GetLogService().Info(`[OnDesignerReady] AlignLines result: ${JSON.stringify(alignResult)}`);

        const modelData = await pState.GetModelData();
        GetLogService().Info(`[OnDesignerReady] ModelData references: ${modelData.References?.length || 0}`);
        modelData.References?.forEach((ref: any, i: number) => {
            GetLogService().Info(`  Ref ${i}: ${ref.Name}, Points: ${ref.Points?.length || 0}`);
        });
        pPanel.webview.postMessage({
            Type: XDesignerMessageType.LoadModel,
            Payload: modelData
        });

        const issues = await pState.Validate();
        pPanel.webview.postMessage({
            Type: XDesignerMessageType.IssuesChanged,
            Payload: { Issues: issues }
        });
    }

    async OnSaveModel(pState: XORMDesignerState): Promise<void>
    {
        try
        {
            await pState.Save();
            GetLogService().Info("Model saved successfully");
        }
        catch (err)
        {
            GetLogService().Error("Failed to save model", err);
            const errMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage("Failed to save model: " + errMsg);
        }
    }

    OnSelectElement(pPayload: ISelectPayload): void
    {
        const selectionService = GetSelectionService();
        
        if (pPayload.Clear)
            selectionService.Clear();
        else if (pPayload.Toggle && pPayload.ElementID)
            selectionService.ToggleSelection(pPayload.ElementID);
        else if (pPayload.Add && pPayload.ElementID)
            selectionService.AddToSelection(pPayload.ElementID);
        else if (pPayload.ElementID)
            selectionService.Select(pPayload.ElementID);
    }

    async OnAddTable(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddTablePayload): Promise<void>
    {
        const name = pPayload.Name || "NewTable";
        const result = pState.AddTable(pPayload.X, pPayload.Y, name);
        if (result.Success)
        {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            this.NotifyDocumentChanged(pState);
        }
    }

    async OnMoveElement(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IMoveElementPayload): Promise<void>
    {
        const result = pState.MoveElement(pPayload.ElementID, pPayload.X, pPayload.Y);
        if (result.Success)
        {
            // Route all lines to update connections after table movement
            pState.AlignLines();
            
            // Reload model with updated line positions
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnDeleteSelected(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void>
    {
        const result = pState.DeleteSelected();
        if (result.Success)
        {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddRelation(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddRelationPayload): Promise<void>
    {
        GetLogService().Info(`Adding relation: Source=${pPayload.SourceID}, Target=${pPayload.TargetID}`);
        
        const result = pState.AddReference(
            pPayload.SourceID,
            pPayload.TargetID,
            pPayload.Name || ""
        );

        GetLogService().Info(`AddReference result: Success=${result.Success}, Message=${result.Message || "none"}`);

        if (result.Success)
        {
            // Route all lines to apply proper alignment and collision avoidance
            pState.AlignLines();
            
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddField(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddFieldPayload): Promise<void>
    {
        let tableID = pPayload.TableID;
        let fieldName: string | undefined = pPayload.Name;
        let dataType: string | undefined = pPayload.DataType;

        if (!tableID)
        {
            const selection = GetSelectionService();
            if (!selection.HasSelection)
            {
                vscode.window.showWarningMessage("No table selected.");
                return;
            }
            tableID = selection.PrimaryID!;
        }

        if (!fieldName)
        {
            fieldName = await vscode.window.showInputBox({
                prompt: "Enter field name",
                value: "NewField"
            });

            if (!fieldName)
                return;
        }

        if (!dataType)
        {
            dataType = await vscode.window.showQuickPick(
                ["String", "Int32", "Int64", "Boolean", "DateTime", "Decimal", "Guid"],
                { placeHolder: "Select data type" }
            );

            if (!dataType)
                return;
        }

        GetLogService().Info(`Adding field: TableID=${tableID}, Name=${fieldName}, DataType=${dataType}`);
        
        const result = pState.AddField(
            tableID,
            fieldName,
            dataType
        );

        GetLogService().Info(`AddField result: Success=${result.Success}, Message=${result.Message || "none"}`);

        if (result.Success)
        {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAlignLines(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void>
    {
        GetLogService().Info('OnAlignLines called');
        
        const result = pState.AlignLines();

        GetLogService().Info(`AlignLines result: Success=${result.Success}, Message=${result.Message || "none"}`);

        if (result.Success)
        {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            this.NotifyDocumentChanged(pState);
        }
    }

    async OnUpdateProperty(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IUpdatePropertyPayload): Promise<void>
    {
        const result = pState.UpdateProperty(
            pPayload.ElementID,
            pPayload.PropertyKey,
            pPayload.Value
        );

        if (result.Success)
        {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            const props = await pState.GetProperties(pPayload.ElementID);
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.PropertiesChanged,
                Payload: { Properties: props }
            });

            this.NotifyDocumentChanged(pState);
        }
    }

    async OnValidateModel(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void>
    {
        const issues = await pState.Validate();
        pPanel.webview.postMessage({
            Type: XDesignerMessageType.IssuesChanged,
            Payload: { Issues: issues }
        });

        const errorCount = issues.filter(i => i.Severity === 2).length;
        const warningCount = issues.filter(i => i.Severity === 1).length;

        if (errorCount > 0)
            vscode.window.showErrorMessage(`Validation: ${errorCount} errors, ${warningCount} warnings.`);
        else if (warningCount > 0)
            vscode.window.showWarningMessage(`Validation: ${warningCount} warnings.`);
        else
            vscode.window.showInformationMessage("Validation: No issues found.");
    }

    async OnRenameCompleted(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IRenamePayload): Promise<void>
    {
        const result = pState.RenameSelected(pPayload.NewName);
        if (result.Success)
        {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            this.NotifyDocumentChanged(pState);
        }
    }

    private NotifyDocumentChanged(pState: XORMDesignerState): void
    {
        // Simply mark as dirty - the OnStateChanged listener will notify VS Code
        pState.IsDirty = true;
    }

    async DeleteSelected(pUri: vscode.Uri): Promise<void>
    {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        const result = state.DeleteSelected();
        if (result.Success)
        {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            await state.Save();
        }
    }

    async RenameSelected(pUri: vscode.Uri): Promise<void>
    {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        const selection = GetSelectionService();
        if (!selection.HasSelection)
        {
            vscode.window.showWarningMessage("No element selected.");
            return;
        }

        panel.webview.postMessage({
            Type: XDesignerMessageType.RequestRename,
            Payload: { ElementID: selection.PrimaryID }
        });
    }

    async ValidateModel(pUri: vscode.Uri): Promise<void>
    {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        await this.OnValidateModel(panel, state);
    }

    GetActiveState(): XORMDesignerState | null
    {
        for (const [key, panel] of this._Webviews)
        {
            if (panel.active)
                return this._States.get(key) || null;
        }
        return null;
    }

    GetActivePanel(): vscode.WebviewPanel | null
    {
        for (const [, panel] of this._Webviews)
        {
            if (panel.active)
                return panel;
        }
        return null;
    }

    GetActiveUri(): vscode.Uri | null
    {
        for (const [key, panel] of this._Webviews)
        {
            if (panel.active)
                return vscode.Uri.parse(key);
        }
        return null;
    }

    async AddTableToActiveDesigner(): Promise<void>
    {
        const state = this.GetActiveState();
        const panel = this.GetActivePanel();

        if (!state || !panel)
        {
            vscode.window.showWarningMessage("No active ORM Designer.");
            return;
        }

        // Add table at a default position (center of visible area)
        const result = state.AddTable(100, 100, "NewTable");
        if (result.Success)
        {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await state.Save();
        }
    }

    async AddFieldToSelectedTable(): Promise<void>
    {
        const state = this.GetActiveState();
        const panel = this.GetActivePanel();

        if (!state || !panel)
        {
            vscode.window.showWarningMessage("No active ORM Designer.");
            return;
        }

        const selection = GetSelectionService();
        if (!selection.HasSelection)
        {
            vscode.window.showWarningMessage("No table selected.");
            return;
        }

        const fieldName = await vscode.window.showInputBox({
            prompt: "Enter field name",
            value: "NewField"
        });

        if (!fieldName)
            return;

        const dataType = await vscode.window.showQuickPick(
            ["String", "Int32", "Int64", "Boolean", "DateTime", "Decimal", "Guid"],
            { placeHolder: "Select data type" }
        );

        if (!dataType)
            return;

        const result = state.AddField(selection.PrimaryID!, fieldName, dataType);
        if (result.Success)
        {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await state.Save();
        }
    }

    async AlignLinesInActiveDesigner(): Promise<void>
    {
        const state = this.GetActiveState();
        const panel = this.GetActivePanel();

        if (!state || !panel)
        {
            vscode.window.showWarningMessage("No active ORM Designer.");
            return;
        }

        const result = state.AlignLines();
        if (result.Success)
        {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await state.Save();
            vscode.window.showInformationMessage("Lines aligned successfully.");
        }
        else
        {
            vscode.window.showWarningMessage("Failed to align lines.");
        }
    }

    GetWebviewContent(pWebview: vscode.Webview): string
    {
        const mediaPath = path.join(this._Context.extensionPath, "media");
        const cssUri = pWebview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, "OrmDesigner.css")));
        const jsUri = pWebview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, "OrmDesigner.js")));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${pWebview.cspSource} 'unsafe-inline'; script-src ${pWebview.cspSource} 'unsafe-inline';">
    <link rel="stylesheet" href="${cssUri}">
    <title>ORM Designer</title>
</head>
<body>
    <div id="designer-container">
        <div id="canvas-container">
            <svg id="canvas" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="var(--vscode-foreground, #ccc)"/>
                    </marker>
                    <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="var(--vscode-focusBorder, #007acc)"/>
                    </marker>
                </defs>
                <g id="relations-layer"></g>
                <g id="tables-layer"></g>
            </svg>
        </div>
    </div>
    <div id="context-menu" class="context-menu">
        <div class="context-menu-item" data-action="add-table"><span class="icon">📊</span>Add Table</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete-selected"><span class="icon">🗑️</span>Delete Selected</div>
        <div class="context-menu-item" data-action="rename-selected"><span class="icon">✏️</span>Rename Selected</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="validate-model"><span class="icon">✅</span>Validate Model</div>
        <div class="context-menu-item" data-action="align-lines"><span class="icon">📐</span>Align Lines</div>
    </div>
    <div id="table-context-menu" class="context-menu">
        <div class="context-menu-item" data-action="add-field"><span class="icon">➕</span>Add Field</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete-table"><span class="icon">🗑️</span>Delete Table</div>
        <div class="context-menu-item" data-action="rename-table"><span class="icon">✏️</span>Rename Table</div>
    </div>
    <script src="${jsUri}"></script>
</body>
</html>`;
    }
}
