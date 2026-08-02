import * as vscode from "vscode";
import { XAppBridge, IAppModelData } from "../../Services/AppBridge";
import { GetIssueService, XIssueService } from "../../Services/IssueService";
import { GetSelectionService, XSelectionService } from "../../Services/SelectionService";
import { GetLogService } from "../../Services/LogService";
import { XIssueItem } from "../../Models/IssueItem";
import { XPropertyItem } from "../../Models/PropertyItem";
import type { XIAppOperationResult, XIAddFormSectionData, XIAppAddFieldData } from "@tootega/tfx";

interface IStateChangedEvent {
    IsDirty: boolean;
}

/**
 * Estado de UMA aba do App Designer — mirror de `XORMDesignerState`, sobre `XAppBridge` em
 * vez de `XTFXBridge`. Sem as particularidades de ORM que não existem aqui: nada de
 * `LoadDataTypes`, `ParentModel`, `ImportModels` — um `.dsapp` não depende de outro arquivo
 * para abrir.
 */
export class XAppDesignerState {
    private _Document: vscode.TextDocument;
    private _Bridge: XAppBridge;
    private _IsDirty: boolean;
    private _LastIssues: XIssueItem[];
    private _OnStateChanged: vscode.EventEmitter<IStateChangedEvent>;

    constructor(pDocument: vscode.TextDocument) {
        this._Document = pDocument;
        this._Bridge = new XAppBridge();
        this._IsDirty = false;
        this._LastIssues = [];
        this._OnStateChanged = new vscode.EventEmitter<IStateChangedEvent>();
    }

    get Document(): vscode.TextDocument {
        return this._Document;
    }

    get DocumentUri(): string {
        return this._Document.uri.toString();
    }

    get Bridge(): XAppBridge {
        return this._Bridge;
    }

    get IsDirty(): boolean {
        return this._IsDirty;
    }

    set IsDirty(pValue: boolean) {
        if (this._IsDirty !== pValue) {
            this._IsDirty = pValue;
            this._OnStateChanged.fire({ IsDirty: pValue });
        }
    }

    get OnStateChanged(): vscode.Event<IStateChangedEvent> {
        return this._OnStateChanged.event;
    }

    get IssueService(): XIssueService {
        return GetIssueService();
    }

    get SelectionService(): XSelectionService {
        return GetSelectionService();
    }

    get IsUntitled(): boolean {
        return this._Document.uri.scheme === "untitled";
    }

    async Load(): Promise<void> {
        try {
            const uri = this._Document.uri;

            if (uri.scheme === "untitled") {
                this._Bridge.LoadAppModelFromText("");
                this._IsDirty = true; // marcado sujo para o VS Code oferecer Salvar Como
                return;
            }

            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(bytes).toString("utf8");
            this._Bridge.LoadAppModelFromText(text);
            this._IsDirty = false;
        }
        catch (error) {
            GetLogService().Error(`Failed to load App model: ${this._Document.uri.fsPath}`, error);
            throw error;
        }
    }

    async Save(): Promise<void> {
        try {
            const uri = this._Document.uri;

            if (uri.scheme === "untitled")
                return;

            const text = this._Bridge.SaveAppModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(uri, bytes);
            this._IsDirty = false;
        }
        catch (error) {
            GetLogService().Error(`Failed to save App model: ${this._Document.uri.fsPath}`, error);
            throw error;
        }
    }

    GetModelData(): IAppModelData {
        return this._Bridge.GetModelData();
    }

    Validate(): XIssueItem[] {
        this._LastIssues = this._Bridge.ValidateAppModel();
        this.IssueService.SetIssues(this._LastIssues);
        return this._LastIssues;
    }

    RefreshIssues(): void {
        this.IssueService.SetIssues(this._LastIssues);
    }

    CreateApplication(pName: string): XIAppOperationResult {
        const result = this._Bridge.CreateApplication(pName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    SetFormView(): XIAppOperationResult {
        const result = this._Bridge.SetFormView();
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    SetTabbedFormView(): XIAppOperationResult {
        const result = this._Bridge.SetTabbedFormView();
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddFormTab(pTitleKey: string): XIAppOperationResult {
        const result = this._Bridge.AddFormTab(pTitleKey);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddColumn(pFieldName: string): XIAppOperationResult {
        const result = this._Bridge.AddColumn(pFieldName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddFilter(pFieldName: string): XIAppOperationResult {
        const result = this._Bridge.AddFilter(pFieldName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddButton(pTitleKey: string): XIAppOperationResult {
        const result = this._Bridge.AddButton(pTitleKey);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddRowAction(pTitleKey: string): XIAppOperationResult {
        const result = this._Bridge.AddRowAction(pTitleKey);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddViewer(pKey: string): XIAppOperationResult {
        const result = this._Bridge.AddViewer(pKey);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddFormSection(pData: XIAddFormSectionData): XIAppOperationResult {
        const result = this._Bridge.AddFormSection(pData);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddField(pData: XIAppAddFieldData): XIAppOperationResult {
        const result = this._Bridge.AddField(pData);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    DeleteSelected(): XIAppOperationResult {
        const selection = this.SelectionService;
        if (!selection.HasSelection)
            return { Success: false, Message: "No selection." };

        const ids = [...selection.SelectedIDs];
        let success = true;

        for (const id of ids) {
            const result = this._Bridge.DeleteElement(id);
            if (!result?.Success)
                success = false;
        }

        if (success) {
            selection.Clear();
            this.IsDirty = true;
        }

        return { Success: success };
    }

    RenameSelected(pNewName: string): XIAppOperationResult {
        const selection = this.SelectionService;
        if (!selection.HasSelection || !selection.PrimaryID)
            return { Success: false, Message: "No selection." };

        const result = this._Bridge.RenameElement(selection.PrimaryID, pNewName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): XIAppOperationResult {
        const result = this._Bridge.UpdateProperty(pElementID, pPropertyKey, pValue);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    GetProperties(pElementID: string): XPropertyItem[] {
        return this._Bridge.GetProperties(pElementID);
    }

    GetElementInfo(pElementID: string): { ID: string; Name: string; Type: string } | null {
        return this._Bridge.GetElementInfo(pElementID);
    }

    Dispose(): void {
        this._OnStateChanged.dispose();
    }
}
