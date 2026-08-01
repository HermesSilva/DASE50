import * as vscode from "vscode";
import * as path from "path";
import { XDesignerMessageType } from "./ORMDesignerMessages";
import { XORMDesignerState } from "./ORMDesignerState";
import { GetSelectionService } from "../../Services/SelectionService";
import { GetLogService } from "../../Services/LogService";
import { XDesignerSelection } from "../../Models/DesignerSelection";
import { XIssueItem } from "../../Models/IssueItem";

interface ISelectPayload {
    Clear?: boolean;
    Toggle?: boolean;
    Add?: boolean;
    ElementID?: string;
    SelectIDs?: string[];
}

interface IAddTablePayload {
    X: number;
    Y: number;
    Name: string;
}

interface IAddRelationPayload {
    SourceID: string;
    TargetID: string;
    Name?: string;
    IsOneToOne?: boolean;
}

interface IMoveReferenceTargetPayload {
    ReferenceID: string;
    TargetTableID: string;
}

interface IAddFieldPayload {
    TableID: string;
    Name: string;
    DataType: string;
}

interface IMoveElementPayload {
    ElementID: string;
    X: number;
    Y: number;
}

interface IMoveElementsPayload {
    Moves: IMoveElementPayload[];
}

interface IUpdatePropertyPayload {
    ElementID: string;
    PropertyKey: string;
    Value: unknown;
}

interface IRenamePayload {
    NewName: string;
}

interface IReorderFieldPayload {
    FieldID: string;
    NewIndex: number;
}

interface IRequestSeedDataPayload {
    TableID: string;
}

interface ISaveSeedDataPayload {
    TableID: string;
    Rows: Array<{
        TupleID: string;
        Values: Record<string, string>;
    }>;
}

interface IRequestShadowTablePickerPayload {
    X: number;
    Y: number;
}

interface IAddShadowTablePayload {
    X: number;
    Y: number;
    ModelName: string;
    DocumentID: string;
    DocumentName: string;
    ModuleID: string;
    ModuleName: string;
    TableID: string;
    TableName: string;
}

interface IOrganizeTablesAIExecutePayload {
    ModelIndex: number;
    Layout?: {
        RankDir?: string;
        Ranker?: string;
        RankSep?: number;
        NodeSep?: number;
    };
}

interface ICreateSQLScriptExecutePayload {
    ModelIndex: number;
    Database: string;
    CustomDB: string;
}

interface IDesignerMessage {
    Type: string;
    Payload?: unknown;
}

interface ICustomDocument extends vscode.CustomDocument {
    uri: vscode.Uri;
    dispose: () => void;
}

export class XORMDesignerEditorProvider implements vscode.CustomEditorProvider<ICustomDocument> {
    private _Context: vscode.ExtensionContext;
    private _Webviews: Map<string, vscode.WebviewPanel>;
    private _States: Map<string, XORMDesignerState>;
    private _Documents: Map<string, ICustomDocument>;
    private _LastActiveKey: string | null;

    private _OnDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ICustomDocument>>();
    public readonly onDidChangeCustomDocument = this._OnDidChangeCustomDocument.event;

    constructor(pContext: vscode.ExtensionContext) {
        this._Context = pContext;
        this._Webviews = new Map<string, vscode.WebviewPanel>();
        this._States = new Map<string, XORMDesignerState>();
        this._Documents = new Map<string, ICustomDocument>();
        this._LastActiveKey = null;
    }

    static get ViewType(): string {
        return "Dase.ORMDesigner";
    }

    static Register(pContext: vscode.ExtensionContext): XORMDesignerEditorProvider {
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

    async openCustomDocument(pUri: vscode.Uri, _pOpenContext: vscode.CustomDocumentOpenContext, _pToken: vscode.CancellationToken): Promise<ICustomDocument> {
        const doc: ICustomDocument = {
            uri: pUri,
            dispose: () => { /* nothing */ }
        };
        return doc;
    }

    async resolveCustomEditor(pDocument: ICustomDocument, pWebviewPanel: vscode.WebviewPanel, _pToken: vscode.CancellationToken): Promise<void> {
        const key = pDocument.uri.toString();
        GetLogService().Info(`ORMDesigner: resolveCustomEditor start → ${pDocument.uri.fsPath}`);
        const state = new XORMDesignerState(pDocument as unknown as vscode.TextDocument);
        this._States.set(key, state);
        this._Webviews.set(key, pWebviewPanel);
        this._Documents.set(key, pDocument);

        // Set as last active immediately so Properties panel can find it
        this._LastActiveKey = key;

        // Track view state changes to update last active key
        pWebviewPanel.onDidChangeViewState((e) => {
            if (e.webviewPanel.active) {
                this._LastActiveKey = key;
                // Update global IssueService with this document's issues
                state.RefreshIssues();
            }
        });

        // Listen to state changes to notify VS Code about dirty state
        state.OnStateChanged((e) => {
            if (e.IsDirty) {
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
        GetLogService().Info("ORMDesigner: webview HTML set");

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
            GetLogService().Info("ORMDesigner: state.Load() start");
            await state.Load();
            // Initial validation to populate issue service even before webview is ready
            state.Validate();
            GetLogService().Info("ORMDesigner: state.Load() done");
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
            const text = state.Bridge.SaveOrmModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(pDestination, bytes);
            // Note: Do not set IsDirty = false here. VS Code will close the old editor
            // and open a new one for the destination URI.
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
            const text = state.Bridge.SaveOrmModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(pContext.destination, bytes);
        }
        return { id: pContext.destination.toString(), delete: () => vscode.workspace.fs.delete(pContext.destination) };
    }

    SetupMessageHandling(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): void {
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

    async HandleMessage(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pMsg: IDesignerMessage): Promise<void> {
        const type = pMsg.Type;
        const payload = pMsg.Payload || {};

        switch (type) {
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

            case XDesignerMessageType.MoveElements:
                await this.OnMoveElements(pPanel, pState, payload as IMoveElementsPayload);
                break;

            case XDesignerMessageType.ReorderField:
                await this.OnReorderField(pPanel, pState, payload as IReorderFieldPayload);
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

            case XDesignerMessageType.MoveReferenceTarget:
                await this.OnMoveReferenceTarget(pPanel, pState, payload as IMoveReferenceTargetPayload);
                break;

            case XDesignerMessageType.ReloadDataTypes:
                await this.OnReloadDataTypes(pPanel, pState);
                break;

            // ----------------------------------------------------
            // Seed Data Messages
            // ----------------------------------------------------
            case XDesignerMessageType.RequestSeedData:
                this.OnRequestSeedData(pPanel, pState, payload as IRequestSeedDataPayload);
                break;
            case XDesignerMessageType.SaveSeedData:
                await this.OnSaveSeedData(pPanel, pState, payload as ISaveSeedDataPayload);
                break;

            // ----------------------------------------------------
            // DBML Messages
            // ----------------------------------------------------
            case "ExportToDBML":
                vscode.commands.executeCommand("Dase.ExportToDBML");
                break;

            case XDesignerMessageType.RequestShadowTablePicker:
                this.OnRequestShadowTablePicker(pPanel, pState, payload as IRequestShadowTablePickerPayload);
                break;

            case XDesignerMessageType.AddShadowTable:
                await this.OnAddShadowTable(pPanel, pState, payload as IAddShadowTablePayload);
                break;

            // ----------------------------------------------------
            // AI Organization
            // ----------------------------------------------------
            case XDesignerMessageType.OrganizeTablesAI:
                GetLogService().Info("OrganizeTablesAI: message received from webview");
                vscode.commands.executeCommand("Dase.OrganizeTablesAI").then(
                    undefined,
                    (err) => GetLogService().Error("Dase.OrganizeTablesAI command failed", err)
                );
                break;

            case XDesignerMessageType.OrganizeTablesAIExecute:
                vscode.commands.executeCommand(
                    "Dase.OrganizeTablesAIExecute",
                    (payload as IOrganizeTablesAIExecutePayload).ModelIndex ?? 0,
                    (payload as IOrganizeTablesAIExecutePayload).Layout
                );
                break;

            case XDesignerMessageType.AIOrganizeRevert:
                vscode.commands.executeCommand("Dase.OrganizeTablesAIRevert");
                break;

            // ----------------------------------------------------
            // AI SQL Script Generation
            // ----------------------------------------------------
            case XDesignerMessageType.CreateSQLScript:
                vscode.commands.executeCommand("Dase.CreateSQLScript");
                break;

            case XDesignerMessageType.CreateSQLScriptExecute: {
                const sqlPayload = payload as ICreateSQLScriptExecutePayload;
                vscode.commands.executeCommand(
                    "Dase.CreateSQLScriptExecute",
                    sqlPayload.ModelIndex ?? 0,
                    sqlPayload.Database   ?? "sqlserver",
                    sqlPayload.CustomDB   ?? ""
                );
                break;
            }

            // ----------------------------------------------------
            // ORM Code Generation
            // ----------------------------------------------------
            case XDesignerMessageType.GenerateORMCode:
                /* istanbul ignore next */
                vscode.commands.executeCommand("Dase.GenerateORMCode");
                break;

            default:
                console.warn("Unknown message type:", type);
        }
    }

    OnRequestSeedData(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IRequestSeedDataPayload): void {
        if (!pPayload?.TableID)
            return;

        const seedData = pState.Bridge.GetSeedData(pPayload.TableID);
        if (!seedData) {
            GetLogService().Warn(`GetSeedData: table not found: ${pPayload.TableID}`);
            return;
        }

        pPanel.webview.postMessage({
            Type: XDesignerMessageType.SeedDataLoaded,
            Payload: seedData
        });
    }

    async OnSaveSeedData(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: ISaveSeedDataPayload): Promise<void> {
        if (!pPayload?.TableID || !Array.isArray(pPayload.Rows))
            return;

        const result = pState.Bridge.SaveSeedData(pPayload.TableID, pPayload.Rows);

        pPanel.webview.postMessage({
            Type: XDesignerMessageType.SeedDataSaved,
            Payload: { TableID: pPayload.TableID, Success: result.Success, Message: result.Message }
        });

        if (result.Success) {
            this.NotifyDocumentChanged(pState);
            await this.SendIssuesUpdate(pPanel, pState);
        }
    }

    OnRequestShadowTablePicker(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IRequestShadowTablePickerPayload): void {
        if (typeof pPayload?.X !== "number" || typeof pPayload?.Y !== "number")
            return;

        const data = pState.Bridge.GetShadowTablePickerData(pPayload.X, pPayload.Y);
        pPanel.webview.postMessage({ Type: XDesignerMessageType.ShadowTablePickerData, Payload: data });
    }

    async OnAddShadowTable(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddShadowTablePayload): Promise<void> {
        if (!pPayload?.TableName)
            return;

        const result = pState.AddShadowTable(pPayload);
        if (result.Success) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({ Type: XDesignerMessageType.LoadModel, Payload: modelData });
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnDesignerReady(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void> {
        // Route all lines before sending model to ensure proper orthogonal routing.
        // This is initial display preparation on open, NOT a user edit, so route via
        // the bridge directly instead of pState.AlignLines() — the state method would
        // set IsDirty=true and fire an onDidChangeCustomDocument edit event, making
        // VS Code mark the freshly-opened document as modified even though nothing
        // changed. RouteAllLines() always returns true regardless of actual geometry
        // changes, so it must never drive the document dirty state on open.
        pState.Bridge.AlignLines();

        const modelData = await pState.GetModelData();
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

    async OnSaveModel(pState: XORMDesignerState): Promise<void> {
        try {
            await pState.Save();
        }
        catch (err) {
            GetLogService().Error("Failed to save model", err);
            const errMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage("Failed to save model: " + errMsg);
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

    async OnAddTable(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddTablePayload): Promise<void> {
        const name = pPayload.Name || "NewTable";
        const result = pState.AddTable(pPayload.X, pPayload.Y, name);
        if (result.Success) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnMoveElement(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IMoveElementPayload): Promise<void> {
        const result = pState.MoveElement(pPayload.ElementID, pPayload.X, pPayload.Y);
        if (result.Success) {
            // Moving a table only re-routes the references that touch it (handled inside
            // MoveElement → Design.RouteReferencesOf). We deliberately do NOT call
            // AlignLines()/RouteAllLines() here: a full re-route redistributes anchors
            // across every table and must not happen on a single drag. Tables are only
            // repositioned by the user or by AI reorganization — never by route recalc.

            // Reload model with updated line positions
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnMoveElements(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IMoveElementsPayload): Promise<void> {
        const moves = pPayload.Moves || [];
        if (moves.length === 0)
            return;

        // Batch group drag: reposition every table, re-routing only the references
        // that touch a moved table (same per-table policy as a single MoveElement —
        // never a global AlignLines). Reload the model once at the end.
        let any = false;
        for (const m of moves) {
            const result = pState.MoveElement(m.ElementID, m.X, m.Y);
            if (result.Success)
                any = true;
        }

        if (any) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnReorderField(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IReorderFieldPayload): Promise<void> {
        const result = pState.ReorderField(pPayload.FieldID, pPayload.NewIndex);
        if (result.Success) {
            pState.AlignLines();
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnDeleteSelected(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void> {
        const result = pState.DeleteSelected();
        if (result.Success) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddRelation(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddRelationPayload): Promise<void> {
        const result = pState.AddReference(
            pPayload.SourceID,
            pPayload.TargetID,
            pPayload.Name || "",
            pPayload.IsOneToOne
        );

        if (result.Success) {
            // Route all lines to apply proper alignment and collision avoidance
            pState.AlignLines();

            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnAddField(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IAddFieldPayload): Promise<void> {
        let tableID = pPayload.TableID;
        let fieldName: string | undefined = pPayload.Name;
        let dataType: string | undefined = pPayload.DataType;

        if (!tableID) {
            const selection = GetSelectionService();
            if (!selection.HasSelection) {
                vscode.window.showWarningMessage("No table selected.");
                return;
            }
            tableID = selection.PrimaryID!;
        }

        if (!fieldName) {
            fieldName = await vscode.window.showInputBox({
                prompt: "Enter field name",
                value: "NewField"
            });

            if (!fieldName)
                return;
        }

        if (!dataType) {
            dataType = await vscode.window.showQuickPick(
                ["String", "Int32", "Int64", "Boolean", "DateTime", "Decimal", "Guid"],
                { placeHolder: "Select data type" }
            );

            if (!dataType)
                return;
        }

        const result = pState.AddField(
            tableID,
            fieldName,
            dataType
        );

        if (result.Success) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnMoveReferenceTarget(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IMoveReferenceTargetPayload): Promise<void> {
        const result = pState.MoveReferenceTarget(pPayload.ReferenceID, pPayload.TargetTableID);

        if (result.Success) {
            // Re-route so the moved line renders cleanly against its new target
            pState.AlignLines();

            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
        else {
            vscode.window.showWarningMessage(result.Message || "Cannot move reference target.");
        }
    }

    async OnAlignLines(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void> {
        const result = pState.AlignLines();

        if (result.Success) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnUpdateProperty(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IUpdatePropertyPayload): Promise<void> {
        // Disabling state control removes a field and a reference — guard with confirmation
        if (pPayload.PropertyKey === "UseStateControl" && pPayload.Value === false) {
            const answer = await vscode.window.showWarningMessage(
                "This will remove the state field and its FK reference from the table. Continue?",
                { modal: true },
                "Remove",
                "Cancel"
            );
            if (answer !== "Remove") {
                // Refresh properties to visually reset the checkbox
                const props = await pState.GetProperties(pPayload.ElementID);
                pPanel.webview.postMessage({
                    Type: XDesignerMessageType.PropertiesChanged,
                    Payload: { Properties: props }
                });
                return;
            }
        }

        const result = pState.UpdateProperty(
            pPayload.ElementID,
            pPayload.PropertyKey,
            pPayload.Value
        );

        if (result.Success) {
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

            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnValidateModel(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void> {
        const issues = await pState.Validate();

        // If shadow-table sync mutated any element (name or colour changed), or the validator
        // repaired the model (missing key, FK type, orphan index column), refresh the canvas and
        // mark the document as dirty — a repair that never reaches the file is no repair.
        if (pState.Bridge.LastSyncMutated || pState.Bridge.LastValidationMutated) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({ Type: XDesignerMessageType.LoadModel, Payload: modelData });
            this.NotifyDocumentChanged(pState);
        }

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

    async OnRenameCompleted(pPanel: vscode.WebviewPanel, pState: XORMDesignerState, pPayload: IRenamePayload): Promise<void> {
        const result = pState.RenameSelected(pPayload.NewName);
        if (result.Success) {
            const modelData = await pState.GetModelData();
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            await this.SendIssuesUpdate(pPanel, pState);
            this.NotifyDocumentChanged(pState);
        }
    }

    async OnReloadDataTypes(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void> {
        await pState.ReloadDataTypes();

        // Notify webview that types have been reloaded
        pPanel.webview.postMessage({
            Type: XDesignerMessageType.DataTypesReloaded,
            Payload: {
                AllTypes: pState.Bridge.GetAllDataTypes(),
                PKTypes: pState.Bridge.GetPKDataTypes()
            }
        });

        // Re-send properties for currently selected element if any
        const selection = GetSelectionService();
        if (selection.HasSelection && selection.PrimaryID) {
            const props = pState.GetProperties(selection.PrimaryID);
            pPanel.webview.postMessage({
                Type: XDesignerMessageType.PropertiesChanged,
                Payload: { Properties: props }
            });
        }
    }

    private NotifyDocumentChanged(pState: XORMDesignerState): void {
        // Simply mark as dirty - the OnStateChanged listener will notify VS Code
        pState.IsDirty = true;
    }

    async SendIssuesUpdate(pPanel: vscode.WebviewPanel, pState: XORMDesignerState): Promise<void> {
        const issues = await pState.Validate();
        pPanel.webview.postMessage({
            Type: XDesignerMessageType.IssuesChanged,
            Payload: { Issues: issues }
        });
    }

    async DeleteSelected(pUri: vscode.Uri): Promise<void> {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        const result = state.DeleteSelected();
        if (result.Success) {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });
            await this.SendIssuesUpdate(panel, state);
            await state.Save();
        }
    }

    async RenameSelected(pUri: vscode.Uri): Promise<void> {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        const selection = GetSelectionService();
        if (!selection.HasSelection) {
            vscode.window.showWarningMessage("No element selected.");
            return;
        }

        panel.webview.postMessage({
            Type: XDesignerMessageType.RequestRename,
            Payload: { ElementID: selection.PrimaryID }
        });
    }

    async ValidateModel(pUri: vscode.Uri): Promise<void> {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        await this.OnValidateModel(panel, state);
    }

    async ReloadDataTypes(pUri: vscode.Uri): Promise<void> {
        const key = pUri.toString();
        const state = this._States.get(key);
        const panel = this._Webviews.get(key);

        if (!state || !panel)
            return;

        await this.OnReloadDataTypes(panel, state);
    }

    GetActiveState(): XORMDesignerState | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active) {
                this._LastActiveKey = key;
                return this._States.get(key) || null;
            }
        }

        // Fallback to last active state
        if (this._LastActiveKey)
            return this._States.get(this._LastActiveKey) || null;

        return null;
    }

    /**
     * Estado + URI do designer ativo (ou do último que esteve ativo), resolvidos JUNTOS a partir
     * da mesma chave. Existe porque {@link GetActiveUri} só devolve a URI do painel com FOCO,
     * enquanto {@link GetActiveState} cai no último ativo — a combinação deixava um chamador com
     * estado mas sem URI (ou vice-versa). Um comando que precisa dos dois usa este método.
     */
    GetActiveStateWithUri(): { State: XORMDesignerState; Uri: vscode.Uri } | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active) {
                this._LastActiveKey = key;
                const state = this._States.get(key);
                return state ? { State: state, Uri: vscode.Uri.parse(key) } : null;
            }
        }

        if (this._LastActiveKey) {
            const state = this._States.get(this._LastActiveKey);
            if (state)
                return { State: state, Uri: vscode.Uri.parse(this._LastActiveKey) };
        }

        return null;
    }

    GetActivePanel(): vscode.WebviewPanel | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active) {
                this._LastActiveKey = key;
                return panel;
            }
        }

        // Fallback to last active panel
        if (this._LastActiveKey)
            return this._Webviews.get(this._LastActiveKey) || null;

        return null;
    }

    GetActiveUri(): vscode.Uri | null {
        for (const [key, panel] of this._Webviews) {
            if (panel.active)
                return vscode.Uri.parse(key);
        }
        return null;
    }

    /**
     * Enumerate every open ORM designer document.
     * Used by the MCP integration to let external clients discover open models.
     */
    GetOpenDocuments(): Array<{ Uri: string; Name: string; Active: boolean }> {
        const result: Array<{ Uri: string; Name: string; Active: boolean }> = [];
        for (const [key, state] of this._States) {
            const panel = this._Webviews.get(key);
            const name = state.Bridge?.Document?.Name ?? vscode.Uri.parse(key).path.split("/").pop() ?? key;
            result.push({ Uri: key, Name: name, Active: panel?.active ?? false });
        }
        return result;
    }

    /**
     * Resolve a designer state by its document URI string.
     * Returns null when no designer is open for that URI.
     */
    GetStateByUri(pUri: string): XORMDesignerState | null {
        return this._States.get(pUri) ?? null;
    }

    /** Resolve the webview panel for an open document by its URI string. */
    GetPanelByUri(pUri: string): vscode.WebviewPanel | null {
        return this._Webviews.get(pUri) ?? null;
    }

    /**
     * Match an open document URI by file name, relative path, or full URI string.
     * Case-insensitive; returns the URI string key or null when no open doc matches.
     */
    private MatchOpenDocument(pDocument: string): string | null {
        const needle = pDocument.replace(/\\/g, "/").toLowerCase();
        // Exact URI match first.
        if (this._States.has(pDocument))
            return pDocument;
        for (const key of this._States.keys()) {
            const lower = key.replace(/\\/g, "/").toLowerCase();
            const base = lower.split("/").pop() ?? lower;
            if (lower === needle || base === needle || lower.endsWith("/" + needle))
                return key;
        }
        return null;
    }

    /**
     * Resolve o URI de um `.dsorm` por nome de arquivo, caminho relativo ou URI — SEM abrir o
     * designer. Primeiro entre os documentos já abertos, depois buscando no workspace. É o que
     * permite gerar código a partir do arquivo em disco sem precisar carregar o webview do
     * designer (ver {@link OpenDocument}, que abre porque a edição precisa do modelo vivo).
     *
     * Devolve a chave-URI (string) ou null quando nenhum `.dsorm` corresponde.
     */
    async ResolveDocumentUri(pDocument: string): Promise<string | null> {
        const key = this.MatchOpenDocument(pDocument);
        if (key)
            return key;

        const needle = pDocument.replace(/\\/g, "/").toLowerCase();
        const candidates = await vscode.workspace.findFiles("**/*.dsorm", "**/node_modules/**", 500);
        const hit = candidates.find(u => {
            const p = u.path.toLowerCase();
            const base = p.split("/").pop() ?? p;
            return p === needle || base === needle || p.endsWith("/" + needle) || u.toString().toLowerCase() === needle;
        });
        return hit ? hit.toString() : null;
    }

    /**
     * Ensure the named `.dsorm` document is open in an ORM designer, opening it if
     * necessary, and return its URI + display name.
     *
     * Resolution order: already-open documents (by file name / relative path / URI),
     * then a workspace search for `.dsorm` files. When found but not open, it is opened
     * via the custom editor and we wait briefly for its state to register.
     *
     * Returns null when no matching `.dsorm` file exists.
     */
    async OpenDocument(pDocument: string): Promise<{ Uri: string; Name: string } | null> {
        // 1. Already open?
        let key = this.MatchOpenDocument(pDocument);

        // 2. Not open — search the workspace for a matching .dsorm file.
        if (!key) {
            const needle = pDocument.replace(/\\/g, "/").toLowerCase();
            const candidates = await vscode.workspace.findFiles("**/*.dsorm", "**/node_modules/**", 500);
            const hit = candidates.find(u => {
                const p = u.path.toLowerCase();
                const base = p.split("/").pop() ?? p;
                return p === needle || base === needle || p.endsWith("/" + needle) || u.toString().toLowerCase() === needle;
            });
            if (!hit)
                return null;

            await vscode.commands.executeCommand("vscode.openWith", hit, XORMDesignerEditorProvider.ViewType);
            key = await this.WaitForState(hit.toString(), 5000);
            if (!key)
                return null;
        }

        const state = this._States.get(key);
        if (!state)
            return null;

        const name = state.Bridge?.Document?.Name ?? vscode.Uri.parse(key).path.split("/").pop() ?? key;
        return { Uri: key, Name: name };
    }

    /**
     * Open a `.dsorm` file by exact URI in the ORM designer (no workspace search),
     * waiting for its state to register. Used for freshly created files, which may
     * live outside the workspace and are not yet indexed by findFiles.
     */
    async OpenDocumentByUri(pUri: vscode.Uri): Promise<{ Uri: string; Name: string } | null> {
        let key = this.MatchOpenDocument(pUri.toString());
        if (!key) {
            await vscode.commands.executeCommand("vscode.openWith", pUri, XORMDesignerEditorProvider.ViewType);
            key = await this.WaitForState(pUri.toString(), 5000);
            if (!key)
                return null;
        }

        const state = this._States.get(key);
        if (!state)
            return null;

        const name = state.Bridge?.Document?.Name ?? pUri.path.split("/").pop() ?? key;
        return { Uri: key, Name: name };
    }

    /** Poll until a state is registered for the given URI key, or timeout. */
    private async WaitForState(pKey: string, pTimeoutMs: number): Promise<string | null> {
        const deadline = Date.now() + pTimeoutMs;
        while (Date.now() < deadline) {
            if (this._States.has(pKey))
                return pKey;
            await new Promise(r => setTimeout(r, 50));
        }
        return this._States.has(pKey) ? pKey : null;
    }

    async AddTableToActiveDesigner(): Promise<void> {
        const state = this.GetActiveState();
        const panel = this.GetActivePanel();

        if (!state || !panel) {
            vscode.window.showWarningMessage("No active ORM Designer.");
            return;
        }

        // Add table at a default position (center of visible area)
        const result = state.AddTable(100, 100, "NewTable");
        if (result.Success) {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await state.Save();
        }
    }

    async AddFieldToSelectedTable(): Promise<void> {
        const state = this.GetActiveState();
        const panel = this.GetActivePanel();

        if (!state || !panel) {
            vscode.window.showWarningMessage("No active ORM Designer.");
            return;
        }

        const selection = GetSelectionService();
        if (!selection.HasSelection) {
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
        if (result.Success) {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await state.Save();
        }
    }

    async AlignLinesInActiveDesigner(): Promise<void> {
        const state = this.GetActiveState();
        const panel = this.GetActivePanel();

        if (!state || !panel) {
            vscode.window.showWarningMessage("No active ORM Designer.");
            return;
        }

        const result = state.AlignLines();
        if (result.Success) {
            const modelData = await state.GetModelData();
            panel.webview.postMessage({
                Type: XDesignerMessageType.LoadModel,
                Payload: modelData
            });

            await state.Save();
            vscode.window.showInformationMessage("Lines aligned successfully.");
        }
        else {
            vscode.window.showWarningMessage("Failed to align lines.");
        }
    }

    GetWebviewContent(pWebview: vscode.Webview): string {
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
            <div id="zoom-indicator">100%</div>
            <div id="table-search" class="table-search hidden">
                <span class="table-search-icon">&#x1f50d;</span>
                <input id="table-search-input" type="text" placeholder="Buscar tabelas…" spellcheck="false" />
                <span id="table-search-count" class="table-search-count"></span>
                <button id="table-search-prev" class="table-search-btn" title="Anterior (Shift+Enter)">&#x25b2;</button>
                <button id="table-search-next" class="table-search-btn" title="Pr&#xf3;ximo (Enter)">&#x25bc;</button>
                <button id="table-search-close" class="table-search-btn" title="Fechar (Esc)">&#x2715;</button>
            </div>
            <div id="canvas-viewport">
                <div id="canvas-sizer">
                    <svg id="canvas" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                                <polygon points="0 0, 8 3, 0 6" fill="context-stroke" fill-opacity="0.9"/>
                            </marker>
                        </defs>
                        <g id="relations-layer"></g>
                        <g id="tables-layer"></g>
                    </svg>
                </div>
            </div>
        </div>
    </div>
    <div id="context-menu" class="context-menu">
        <div class="context-menu-item" data-action="add-table"><span class="icon">📊</span>Add Table</div>
        <div class="context-menu-item" data-action="add-shadow-table"><span class="icon">🔗</span>Add Shadow Table</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete-selected"><span class="icon">🗑️</span>Delete Selected</div>
        <div class="context-menu-item" data-action="rename-selected"><span class="icon">✏️</span>Rename Selected</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="validate-model"><span class="icon">✅</span>Validate Model</div>
        <div class="context-menu-item" data-action="align-lines"><span class="icon">📐</span>Align Lines</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="export-dbml"><span class="icon">📤</span>Export to DBML</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="organize-tables-ai"><span class="icon">&#x2728;</span>Organize Tables using AI</div>
        <div class="context-menu-item" data-action="create-sql-script"><span class="icon">&#x1f5c4;&#xfe0f;</span>Create SQL Script&#x2026;</div>
        <div class="context-menu-item" data-action="generate-orm-code"><span class="icon">&#x1f3d7;&#xfe0f;</span>Generate ORM Code&#x2026;</div>
    </div>
    <div id="table-context-menu" class="context-menu">
        <div class="context-menu-item" data-action="add-field"><span class="icon">➕</span>Add Field</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="edit-seed-data"><span class="icon">🗂️</span>Edit Seed Data</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete-table"><span class="icon">🗑️</span>Delete Table</div>
        <div class="context-menu-item" data-action="rename-table"><span class="icon">✏️</span>Rename Table</div>
    </div>
    <div id="shadow-picker-overlay" class="seed-overlay" style="display:none" tabindex="-1">
        <div id="shadow-picker-modal" class="seed-modal" role="dialog" aria-modal="true" aria-labelledby="shadow-picker-title">
            <div class="seed-modal-header">
                <div class="seed-modal-title-block">
                    <span class="seed-modal-icon">🔗</span>
                    <h2 id="shadow-picker-title" class="seed-modal-title">Add Shadow Table</h2>
                </div>
                <button id="shadow-picker-close" class="seed-modal-close" aria-label="Close">✕</button>
            </div>
            <div style="padding:8px 16px">
                <input id="shadow-search" type="text" placeholder="Search tables..." class="shadow-search-input" autocomplete="off" />
            </div>
            <div id="shadow-tree" class="shadow-tree"></div>
            <div class="seed-modal-footer">
                <span id="shadow-status" class="seed-status-msg"></span>
                <div class="seed-modal-actions">
                    <button id="shadow-btn-cancel" class="seed-btn seed-btn-secondary">Cancel</button>
                    <button id="shadow-btn-add" class="seed-btn seed-btn-primary"><span>➕</span> Add</button>
                </div>
            </div>
        </div>
    </div>
    <div id="seed-editor-overlay" class="seed-overlay" style="display:none" tabindex="-1">
        <div id="seed-editor-modal" class="seed-modal" role="dialog" aria-modal="true" aria-labelledby="seed-modal-title">
            <div class="seed-modal-header">
                <div class="seed-modal-title-block">
                    <span class="seed-modal-icon">🗂️</span>
                    <h2 id="seed-modal-title" class="seed-modal-title"></h2>
                    <span class="seed-modal-badge" id="seed-row-count"></span>
                </div>
                <button id="seed-modal-close" class="seed-modal-close" aria-label="Close" title="Close (Esc)">✕</button>
            </div>
            <div class="seed-modal-toolbar">
                <button id="seed-add-row" class="seed-btn seed-btn-primary" title="Add a new row (Ctrl+Enter)">
                    <span>➕</span> Add Row
                </button>
                <button id="seed-delete-rows" class="seed-btn seed-btn-danger" title="Delete selected rows (Del)">
                    <span>🗑️</span> Delete
                </button>
                <span class="seed-toolbar-sep"></span>
                <span id="seed-validation-badge" class="seed-validation-badge" style="display:none"></span>
            </div>
            <div class="seed-grid-wrapper" id="seed-grid-wrapper">
                <div class="seed-grid-container" id="seed-grid-container">
                    <table class="seed-grid" id="seed-grid" cellspacing="0" cellpadding="0">
                        <thead id="seed-grid-head"></thead>
                        <tbody id="seed-grid-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="seed-modal-footer">
                <span id="seed-status-msg" class="seed-status-msg"></span>
                <div class="seed-modal-actions">
                    <button id="seed-btn-cancel" class="seed-btn seed-btn-secondary">Cancel</button>
                    <button id="seed-btn-save" class="seed-btn seed-btn-success">
                        <span>💾</span> Save
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div id="field-context-menu" class="context-menu">
        <div class="context-menu-item" data-action="rename-field"><span class="icon">✏️</span>Rename Field</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete-field"><span class="icon">🗑️</span>Delete Field</div>
    </div>
    <div id="relation-context-menu" class="context-menu">
        <div class="context-menu-item" data-action="move-target-table"><span class="icon">🎯</span>Move Target Table</div>
    </div>

    <!-- AI SQL Script Generation overlay -->
    <!-- ORM Code Generation overlay -->
    <div id="orm-gen-overlay" class="ai-overlay" style="display:none" aria-hidden="true">
        <div id="orm-gen-modal" class="ai-modal" role="dialog" aria-labelledby="orm-gen-modal-title" aria-live="polite">
            <div class="ai-modal-header">
                <div class="ai-modal-title-block">
                    <span class="ai-modal-icon" id="orm-gen-modal-icon">&#x1f3d7;&#xfe0f;</span>
                    <div>
                        <h2 id="orm-gen-modal-title" class="ai-modal-title">Generate ORM Code</h2>
                        <div id="orm-gen-model-badge" class="ai-model-badge"></div>
                    </div>
                </div>
                <div id="orm-gen-status-dot" class="ai-status-dot ai-status-dot--idle"></div>
            </div>
            <!-- Phase 1: picker -->
            <div id="orm-gen-picker-section" class="ai-picker-section" style="display:none">
                <div class="ai-prompt-preview-wrap">
                    <div class="ai-prompt-preview-label">Prompt preview</div>
                    <textarea class="ai-prompt-preview" id="orm-gen-prompt-preview" readonly spellcheck="false"></textarea>
                </div>
                <div class="ai-model-selector-row">
                    <span class="ai-model-selector-label">Model</span>
                    <div class="ai-model-selector-wrap">
                        <button class="ai-model-selector-btn" id="orm-gen-model-selector-btn" type="button">
                            <span class="ai-model-selector-name" id="orm-gen-model-selector-name">Select model&#x2026;</span>
                            <span class="ai-model-selector-cost" id="orm-gen-model-selector-cost"></span>
                            <span class="ai-model-selector-chevron">&#x25be;</span>
                        </button>
                        <div id="orm-gen-model-dropdown" class="ai-model-dropdown" style="display:none"></div>
                    </div>
                </div>
                <div class="ai-model-selector-row">
                    <span class="ai-model-selector-label">ORM Target</span>
                    <div class="ai-model-selector-wrap">
                        <button class="ai-model-selector-btn" id="orm-gen-target-btn" type="button">
                            <span class="ai-model-selector-name" id="orm-gen-target-name">C# / EF Core</span>
                            <span class="ai-model-selector-chevron">&#x25be;</span>
                        </button>
                        <div id="orm-gen-target-dropdown" class="ai-model-dropdown" style="display:none"></div>
                    </div>
                </div>
                <div class="orm-gen-context-row">
                    <span class="ai-model-selector-label" id="orm-gen-context-label">Context file</span>
                    <div class="orm-gen-context-right">
                        <span class="orm-gen-context-file" id="orm-gen-context-file">None selected</span>
                        <button class="seed-btn seed-btn-secondary orm-gen-browse-btn" id="orm-gen-browse-btn" type="button">Browse&#x2026;</button>
                    </div>
                </div>
            </div>
            <!-- Phase 2: progress -->
            <div id="orm-gen-progress-section" class="ai-progress-section" style="display:none">
                <div class="ai-progress-bar-track">
                    <div class="ai-progress-bar-fill" id="orm-gen-progress-fill" style="width:0%"></div>
                </div>
                <div id="orm-gen-progress-label" class="ai-progress-label">Initializing&#x2026;</div>
            </div>
            <div id="orm-gen-steps-list" class="ai-steps-list" style="display:none"></div>
            <div id="orm-gen-result-section" class="ai-result-section" style="display:none">
                <div id="orm-gen-result-info" class="sql-result-info"></div>
            </div>
            <!-- Footer -->
            <div class="ai-modal-footer" id="orm-gen-modal-footer">
                <button id="orm-gen-cancel-btn" class="seed-btn seed-btn-secondary">Cancel</button>
                <button id="orm-gen-execute-btn" class="seed-btn seed-btn-primary">Generate</button>
            </div>
        </div>
    </div>

    <div id="sql-overlay" class="ai-overlay" style="display:none" aria-hidden="true">
        <div id="sql-modal" class="ai-modal" role="dialog" aria-labelledby="sql-modal-title" aria-live="polite">
            <div class="ai-modal-header">
                <div class="ai-modal-title-block">
                    <span class="ai-modal-icon" id="sql-modal-icon">&#x1f5c4;&#xfe0f;</span>
                    <div>
                        <h2 id="sql-modal-title" class="ai-modal-title">Create SQL Script</h2>
                        <div id="sql-model-badge" class="ai-model-badge"></div>
                    </div>
                </div>
                <div id="sql-status-dot" class="ai-status-dot ai-status-dot--idle"></div>
            </div>
            <!-- Phase 1: picker -->
            <div id="sql-picker-section" class="ai-picker-section" style="display:none">
                <div class="ai-prompt-preview-wrap">
                    <div class="ai-prompt-preview-label">Prompt preview</div>
                    <textarea class="ai-prompt-preview" id="sql-prompt-preview" readonly spellcheck="false"></textarea>
                </div>
                <div class="ai-model-selector-row">
                    <span class="ai-model-selector-label">Model</span>
                    <div class="ai-model-selector-wrap">
                        <button class="ai-model-selector-btn" id="sql-model-selector-btn" type="button">
                            <span class="ai-model-selector-name" id="sql-model-selector-name">Select model&#x2026;</span>
                            <span class="ai-model-selector-cost" id="sql-model-selector-cost"></span>
                            <span class="ai-model-selector-chevron">&#x25be;</span>
                        </button>
                        <div id="sql-model-dropdown" class="ai-model-dropdown" style="display:none"></div>
                    </div>
                </div>
                <div class="ai-model-selector-row">
                    <span class="ai-model-selector-label">Database</span>
                    <div class="ai-model-selector-wrap">
                        <button class="ai-model-selector-btn" id="sql-db-selector-btn" type="button">
                            <span class="ai-model-selector-name" id="sql-db-selector-name">SQL Server</span>
                            <span class="ai-model-selector-chevron">&#x25be;</span>
                        </button>
                        <div id="sql-db-dropdown" class="ai-model-dropdown" style="display:none"></div>
                    </div>
                </div>
                <div id="sql-custom-db-row" class="sql-custom-db-row" style="display:none">
                    <span class="ai-model-selector-label">Name</span>
                    <input type="text" id="sql-custom-db-input" class="sql-custom-db-input"
                           placeholder="Enter database name&#x2026;" autocomplete="off" spellcheck="false" />
                </div>
            </div>
            <!-- Phase 2: progress -->
            <div id="sql-progress-section" class="ai-progress-section" style="display:none">
                <div class="ai-progress-bar-track">
                    <div class="ai-progress-bar-fill" id="sql-progress-fill" style="width:0%"></div>
                </div>
                <div id="sql-progress-label" class="ai-progress-label">Initializing&#x2026;</div>
            </div>
            <div id="sql-steps-list" class="ai-steps-list" style="display:none"></div>
            <div id="sql-result-section" class="ai-result-section" style="display:none">
                <div id="sql-result-info" class="sql-result-info"></div>
            </div>
            <!-- Footer -->
            <div class="ai-modal-footer" id="sql-modal-footer">
                <button id="sql-cancel-btn" class="seed-btn seed-btn-secondary">Cancel</button>
                <button id="sql-execute-btn" class="seed-btn seed-btn-primary">Generate</button>
            </div>
        </div>
    </div>

    <!-- AI Organization progress overlay -->
    <div id="ai-organize-overlay" class="ai-overlay" style="display:none" aria-hidden="true">
        <div id="ai-organize-modal" class="ai-modal" role="dialog" aria-labelledby="ai-modal-title" aria-live="polite">
            <div class="ai-modal-header">
                <div class="ai-modal-title-block">
                    <span class="ai-modal-icon" id="ai-modal-icon">✨</span>
                    <div>
                        <h2 id="ai-modal-title" class="ai-modal-title">Organize Tables with AI</h2>
                        <div id="ai-model-badge" class="ai-model-badge"></div>
                    </div>
                </div>
                <div id="ai-status-dot" class="ai-status-dot ai-status-dot--idle"></div>
            </div>
            <!-- Phase 1: model picker (prompt preview + compact selector) -->
            <div id="ai-picker-section" class="ai-picker-section" style="display:none">
                <div class="ai-prompt-preview-wrap">
                    <div class="ai-prompt-preview-label">Prompt preview</div>
                    <textarea class="ai-prompt-preview" id="ai-prompt-preview" readonly spellcheck="false"></textarea>
                </div>
                <div class="ai-model-selector-row">
                    <span class="ai-model-selector-label">Model</span>
                    <div class="ai-model-selector-wrap">
                        <button class="ai-model-selector-btn" id="ai-model-selector-btn" type="button">
                            <span class="ai-model-selector-name" id="ai-model-selector-name">Select model…</span>
                            <span class="ai-model-selector-cost" id="ai-model-selector-cost"></span>
                            <span class="ai-model-selector-chevron">▾</span>
                        </button>
                        <div id="ai-model-dropdown" class="ai-model-dropdown" style="display:none"></div>
                    </div>
                </div>
                <div class="ai-layout-params" id="ai-layout-params">
                    <div class="ai-layout-params-title">Layout</div>
                    <div class="ai-layout-row">
                        <label for="ai-lp-rankdir">Flow</label>
                        <select id="ai-lp-rankdir">
                            <option value="TB" selected>Wide — flow top → bottom</option>
                            <option value="BT">Wide — flow bottom → top</option>
                            <option value="LR">Tall — flow left → right</option>
                            <option value="RL">Tall — flow right → left</option>
                        </select>
                    </div>
                    <div class="ai-layout-row">
                        <label for="ai-lp-ranker">Ranking</label>
                        <select id="ai-lp-ranker">
                            <option value="network-simplex" selected>Compact (network-simplex)</option>
                            <option value="tight-tree">Balanced (tight-tree)</option>
                            <option value="longest-path">Spread (longest-path)</option>
                        </select>
                    </div>
                    <div class="ai-layout-row">
                        <label for="ai-lp-ranksep">Rank gap <span id="ai-lp-ranksep-val">180</span>px</label>
                        <input type="range" id="ai-lp-ranksep" min="80" max="400" step="20" value="180">
                    </div>
                    <div class="ai-layout-row">
                        <label for="ai-lp-nodesep">Node gap <span id="ai-lp-nodesep-val">55</span>px</label>
                        <input type="range" id="ai-lp-nodesep" min="20" max="160" step="5" value="55">
                    </div>
                </div>
            </div>
            <!-- Phase 2: progress (visible during and after execution) -->
            <div id="ai-progress-section" class="ai-progress-section" style="display:none">
                <div class="ai-progress-bar-track">
                    <div class="ai-progress-bar-fill" id="ai-progress-fill" style="width:0%"></div>
                </div>
                <div id="ai-progress-label" class="ai-progress-label">Initializing…</div>
            </div>
            <div id="ai-steps-list" class="ai-steps-list" style="display:none"></div>
            <div id="ai-result-section" class="ai-result-section" style="display:none">
                <div id="ai-group-chips" class="ai-group-chips"></div>
            </div>
            <!-- Footer: changes buttons per phase -->
            <div class="ai-modal-footer" id="ai-modal-footer">
                <button id="ai-cancel-btn" class="seed-btn seed-btn-secondary">Cancel</button>
                <button id="ai-execute-btn" class="seed-btn seed-btn-primary">Execute</button>
            </div>
        </div>
    </div>

    <script src="${jsUri}"></script>
</body>
</html>`;
    }
}
