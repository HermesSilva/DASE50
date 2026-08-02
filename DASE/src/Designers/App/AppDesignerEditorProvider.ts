import * as vscode from "vscode";
import * as path from "path";
import { XAppDesignerMessageType } from "./AppDesignerMessages";
import { XAppDesignerState } from "./AppDesignerState";
import { GetSelectionService } from "../../Services/SelectionService";
import { GetLogService } from "../../Services/LogService";
import { XDesignerSelection } from "../../Models/DesignerSelection";
import { XIssueItem } from "../../Models/IssueItem";
import { GetActiveDesignerTracker } from "../../Services/ActiveDesignerTracker";
import type { XIAddFormSectionData, XIAppAddFieldData } from "@tootega/tfx";

interface ISelectPayload {
    Clear?: boolean;
    Toggle?: boolean;
    Add?: boolean;
    ElementID?: string;
    SelectIDs?: string[];
}

interface ICreateApplicationPayload { Name: string; }
interface IAddFormTabPayload { TitleKey: string; }
interface IAddColumnPayload { FieldName: string; }
interface IAddFilterPayload { FieldName: string; }
interface IAddButtonPayload { TitleKey: string; }
interface IAddRowActionPayload { TitleKey: string; }
interface IAddViewerPayload { Key: string; }
interface IUpdatePropertyPayload { ElementID: string; PropertyKey: string; Value: unknown; }
interface IRenamePayload { NewName: string; }

interface IDesignerMessage {
    Type: string;
    Payload?: unknown;
}

interface ICustomDocument extends vscode.CustomDocument {
    uri: vscode.Uri;
    dispose: () => void;
}

/**
 * `CustomEditorProvider` para `.dsapp` — mirror estrutural de
 * `XORMDesignerEditorProvider`, mas sem as peças que só existem para o canvas ERD do ORM
 * (roteamento de linha, tabela-espelho, importação DBML, organização por IA, geração de
 * código — as duas últimas chegam na Fase 5). A UI ainda é um esqueleto de leitura
 * (`media/AppDesigner.js`); o que este arquivo garante é o CICLO COMPLETO de abrir, editar
 * pelo protocolo de mensagens, salvar, e validar um `.dsapp` real.
 */
export class XAppDesignerEditorProvider implements vscode.CustomEditorProvider<ICustomDocument> {
    private _Context: vscode.ExtensionContext;
    private _Webviews: Map<string, vscode.WebviewPanel>;
    private _States: Map<string, XAppDesignerState>;
    private _Documents: Map<string, ICustomDocument>;
    private _LastActiveKey: string | null;

    private _OnDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ICustomDocument>>();
    public readonly onDidChangeCustomDocument = this._OnDidChangeCustomDocument.event;

    constructor(pContext: vscode.ExtensionContext) {
        this._Context = pContext;
        this._Webviews = new Map<string, vscode.WebviewPanel>();
        this._States = new Map<string, XAppDesignerState>();
        this._Documents = new Map<string, ICustomDocument>();
        this._LastActiveKey = null;
    }

    static get ViewType(): string {
        return "Dase.AppDesigner";
    }

    static Register(pContext: vscode.ExtensionContext): XAppDesignerEditorProvider {
        const provider = new XAppDesignerEditorProvider(pContext);

        const registration = vscode.window.registerCustomEditorProvider(
            XAppDesignerEditorProvider.ViewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        );

        pContext.subscriptions.push(registration);
        return provider;
    }

    async openCustomDocument(pUri: vscode.Uri, _pOpenContext: vscode.CustomDocumentOpenContext, _pToken: vscode.CancellationToken): Promise<ICustomDocument> {
        const doc: ICustomDocument = {
            uri: pUri,
            dispose: () => { /* nothing */ }
        };
        return doc;
    }

    async resolveCustomEditor(pDocument: ICustomDocument, pWebviewPanel: vscode.WebviewPanel, _pToken: vscode.CancellationToken): Promise<void> {
        const key = pDocument.uri.toString();
        GetLogService().Info(`AppDesigner: resolveCustomEditor start → ${pDocument.uri.fsPath}`);
        const state = new XAppDesignerState(pDocument as unknown as vscode.TextDocument);
        this._States.set(key, state);
        this._Webviews.set(key, pWebviewPanel);
        this._Documents.set(key, pDocument);

        this._LastActiveKey = key;
        GetActiveDesignerTracker().NotifyActive("App");

        pWebviewPanel.onDidChangeViewState((e) => {
            if (e.webviewPanel.active) {
                this._LastActiveKey = key;
                GetActiveDesignerTracker().NotifyActive("App");
                state.RefreshIssues();
            }
        });

        state.OnStateChanged((e) => {
            if (e.IsDirty)
                this._OnDidChangeCustomDocument.fire({ document: pDocument });
        });

        pWebviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._Context.extensionPath, "media"))
            ]
        };

        pWebviewPanel.webview.html = this.GetWebviewContent(pWebviewPanel.webview);
        GetLogService().Info("AppDesigner: webview HTML set");

        this.SetupMessageHandling(pWebviewPanel, state);

        pWebviewPanel.onDidDispose(() => {
            this._Webviews.delete(key);
            this._States.delete(key);
            this._Documents.delete(key);
            state.Dispose();

            if (this._LastActiveKey === key)
                this._LastActiveKey = null;
        });

        try {
            GetLogService().Info("AppDesigner: state.Load() start");
            await state.Load();
            state.Validate();
            GetLogService().Info("AppDesigner: state.Load() done");
        }
        catch (err) {
            GetLogService().Error(`Failed to load document: ${pDocument.uri.fsPath}`, err);
        }
    }

    async saveCustomDocument(pDocument: ICustomDocument, _pCancellation: vscode.CancellationToken): Promise<void> {
        const state = this._States.get(pDocument.uri.toString());
        if (state)
            await state.Save();
    }

    async saveCustomDocumentAs(pDocument: ICustomDocument, pDestination: vscode.Uri, _pCancellation: vscode.CancellationToken): Promise<void> {
        const state = this._States.get(pDocument.uri.toString());
        if (state) {
            const text = state.Bridge.SaveAppModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(pDestination, bytes);
        }
    }

    async revertCustomDocument(pDocument: ICustomDocument, _pCancellation: vscode.CancellationToken): Promise<void> {
        const state = this._States.get(pDocument.uri.toString());
        if (state)
            await state.Load();
    }

    async backupCustomDocument(pDocument: ICustomDocument, pContext: vscode.CustomDocumentBackupContext, _pCancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        const state = this._States.get(pDocument.uri.toString());
        if (state) {
            const text = state.Bridge.SaveAppModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(pContext.destination, bytes);
        }
        return { id: pContext.destination.toString(), delete: () => vscode.workspace.fs.delete(pContext.destination) };
    }

    SetupMessageHandling(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): void {
        const selectionService = GetSelectionService();

        pPanel.webview.onDidReceiveMessage(async (pMsg: IDesignerMessage) => {
            await this.HandleMessage(pPanel, pState, pMsg);
        });

        selectionService.OnSelectionChanged(async (pSelection: XDesignerSelection) => {
            pPanel.webview.postMessage({
                Type: XAppDesignerMessageType.SelectionChanged,
                Payload: { SelectedIDs: pSelection.SelectedIDs, PrimaryID: pSelection.PrimaryID }
            });
        });

        pState.IssueService.OnIssuesChanged((pIssues: XIssueItem[]) => {
            pPanel.webview.postMessage({
                Type: XAppDesignerMessageType.IssuesChanged,
                Payload: { Issues: pIssues }
            });
        });
    }

    async HandleMessage(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pMsg: IDesignerMessage): Promise<void> {
        const type = pMsg.Type;
        const payload = pMsg.Payload || {};

        switch (type) {
            case XAppDesignerMessageType.DesignerReady:
                await this.OnDesignerReady(pPanel, pState);
                break;

            case XAppDesignerMessageType.SaveModel:
                await this.OnSaveModel(pState);
                break;

            case XAppDesignerMessageType.SelectElement:
                this.OnSelectElement(payload as ISelectPayload);
                break;

            case XAppDesignerMessageType.CreateApplication:
                await this.OnCreateApplication(pPanel, pState, payload as ICreateApplicationPayload);
                break;

            case XAppDesignerMessageType.SetFormView:
                await this.OnSetFormView(pPanel, pState);
                break;

            case XAppDesignerMessageType.SetTabbedFormView:
                await this.OnSetTabbedFormView(pPanel, pState);
                break;

            case XAppDesignerMessageType.AddFormTab:
                await this.OnAddFormTab(pPanel, pState, payload as IAddFormTabPayload);
                break;

            case XAppDesignerMessageType.AddColumn:
                await this.OnAddColumn(pPanel, pState, payload as IAddColumnPayload);
                break;

            case XAppDesignerMessageType.AddFilter:
                await this.OnAddFilter(pPanel, pState, payload as IAddFilterPayload);
                break;

            case XAppDesignerMessageType.AddButton:
                await this.OnAddButton(pPanel, pState, payload as IAddButtonPayload);
                break;

            case XAppDesignerMessageType.AddRowAction:
                await this.OnAddRowAction(pPanel, pState, payload as IAddRowActionPayload);
                break;

            case XAppDesignerMessageType.AddViewer:
                await this.OnAddViewer(pPanel, pState, payload as IAddViewerPayload);
                break;

            case XAppDesignerMessageType.AddFormSection:
                await this.OnAddFormSection(pPanel, pState, payload as XIAddFormSectionData);
                break;

            case XAppDesignerMessageType.AddField:
                await this.OnAddField(pPanel, pState, payload as XIAppAddFieldData);
                break;

            case XAppDesignerMessageType.DeleteSelected:
                await this.OnDeleteSelected(pPanel, pState);
                break;

            case XAppDesignerMessageType.UpdateProperty:
                await this.OnUpdateProperty(pPanel, pState, payload as IUpdatePropertyPayload);
                break;

            case XAppDesignerMessageType.ValidateModel:
                await this.OnValidateModel(pPanel, pState);
                break;

            case XAppDesignerMessageType.RenameCompleted:
                await this.OnRenameCompleted(pPanel, pState, payload as IRenamePayload);
                break;

            default:
                GetLogService().Info(`AppDesigner: unhandled message type "${type}"`);
                break;
        }
    }

    private async SendModel(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        pPanel.webview.postMessage({
            Type: XAppDesignerMessageType.LoadModel,
            Payload: pState.GetModelData()
        });
    }

    async SendIssuesUpdate(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        const issues = pState.Validate();
        pPanel.webview.postMessage({
            Type: XAppDesignerMessageType.IssuesChanged,
            Payload: { Issues: issues }
        });
    }

    private NotifyDocumentChanged(pState: XAppDesignerState): void {
        const document = this._Documents.get(pState.DocumentUri);
        if (document)
            this._OnDidChangeCustomDocument.fire({ document });
    }

    async OnDesignerReady(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        await this.SendModel(pPanel, pState);
        await this.SendIssuesUpdate(pPanel, pState);
    }

    async OnSaveModel(pState: XAppDesignerState): Promise<void> {
        try {
            await pState.Save();
        }
        catch (err) {
            GetLogService().Error("Failed to save App model", err);
            const errMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage("Failed to save App model: " + errMsg);
        }
    }

    OnSelectElement(pPayload: ISelectPayload): void {
        const selectionService = GetSelectionService();

        if (pPayload.Clear)
            selectionService.Clear();
        else if (pPayload.SelectIDs)
            selectionService.SelectMultiple(pPayload.SelectIDs);
        else if (pPayload.Toggle && pPayload.ElementID)
            selectionService.ToggleSelection(pPayload.ElementID);
        else if (pPayload.Add && pPayload.ElementID)
            selectionService.AddToSelection(pPayload.ElementID);
        else if (pPayload.ElementID)
            selectionService.Select(pPayload.ElementID);
    }

    async OnCreateApplication(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: ICreateApplicationPayload): Promise<void> {
        const result = pState.CreateApplication(pPayload.Name || "NewApp");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnSetFormView(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        const result = pState.SetFormView();
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnSetTabbedFormView(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        const result = pState.SetTabbedFormView();
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddFormTab(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IAddFormTabPayload): Promise<void> {
        const result = pState.AddFormTab(pPayload.TitleKey || "");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddColumn(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IAddColumnPayload): Promise<void> {
        const result = pState.AddColumn(pPayload.FieldName || "NewColumn");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddFilter(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IAddFilterPayload): Promise<void> {
        const result = pState.AddFilter(pPayload.FieldName || "NewFilter");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddButton(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IAddButtonPayload): Promise<void> {
        const result = pState.AddButton(pPayload.TitleKey || "");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddRowAction(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IAddRowActionPayload): Promise<void> {
        const result = pState.AddRowAction(pPayload.TitleKey || "");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddViewer(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IAddViewerPayload): Promise<void> {
        const result = pState.AddViewer(pPayload.Key || "");
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddFormSection(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: XIAddFormSectionData): Promise<void> {
        const result = pState.AddFormSection(pPayload);
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddField(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: XIAppAddFieldData): Promise<void> {
        const result = pState.AddField(pPayload);
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnDeleteSelected(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        const result = pState.DeleteSelected();
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnUpdateProperty(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IUpdatePropertyPayload): Promise<void> {
        const result = pState.UpdateProperty(pPayload.ElementID, pPayload.PropertyKey, pPayload.Value);
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
        else
            vscode.window.showWarningMessage(result.Message || "Failed to update property.");
    }

    async OnValidateModel(pPanel: vscode.WebviewPanel, pState: XAppDesignerState): Promise<void> {
        await this.SendIssuesUpdate(pPanel, pState);
    }

    async OnRenameCompleted(pPanel: vscode.WebviewPanel, pState: XAppDesignerState, pPayload: IRenamePayload): Promise<void> {
        const result = pState.RenameSelected(pPayload.NewName);
        if (result.Success) {
            await this.SendModel(pPanel, pState);
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async ValidateModel(pUri: vscode.Uri): Promise<void> {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        await this.OnValidateModel(panel, state);
    }

    GetActiveState(): XAppDesignerState | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active) {
                this._LastActiveKey = key;
                return this._States.get(key) || null;
            }
        }

        if (this._LastActiveKey)
            return this._States.get(this._LastActiveKey) || null;

        return null;
    }

    GetActiveUri(): vscode.Uri | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active)
                return vscode.Uri.parse(key);
        }
        return null;
    }

    /** Mirror de `XORMDesignerEditorProvider.GetActivePanel` — usado pelo `CompositeDesignerProvider`. */
    GetActivePanel(): vscode.WebviewPanel | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active) {
                this._LastActiveKey = key;
                return panel;
            }
        }

        if (this._LastActiveKey)
            return this._Webviews.get(this._LastActiveKey) || null;

        return null;
    }

    GetWebviewContent(pWebview: vscode.Webview): string {
        const mediaPath = path.join(this._Context.extensionPath, "media");
        const cssUri = pWebview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, "AppDesigner.css")));
        const jsUri = pWebview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, "AppDesigner.js")));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${pWebview.cspSource} 'unsafe-inline'; script-src ${pWebview.cspSource} 'unsafe-inline';">
    <link rel="stylesheet" href="${cssUri}">
    <title>App Designer</title>
</head>
<body>
    <div id="app-designer-root"></div>
    <script src="${jsUri}"></script>
</body>
</html>`;
    }
}
