import * as vscode from "vscode";
import { XTFXBridge } from "../../Services/TFXBridge";
import type { IAddShadowTablePayload } from "../../Services/TFXBridge";
import { GetIssueService, XIssueService } from "../../Services/IssueService";
import { GetSelectionService, XSelectionService } from "../../Services/SelectionService";
import { GetLogService } from "../../Services/LogService";
import { XPropertyItem } from "../../Models/PropertyItem";
import { XIssueItem } from "../../Models/IssueItem";

// TFX types - import for type checking only
import type { XIOperationResult } from "@tootega/tfx";

interface IModelData {
    Tables: unknown[];
    References: unknown[];
}

interface IStateChangedEvent {
    IsDirty: boolean;
}

export class XORMDesignerState {
    private _Document: vscode.TextDocument;
    private _Bridge: XTFXBridge;
    private _IsDirty: boolean;
    private _LastIssues: XIssueItem[];
    private _OnStateChanged: vscode.EventEmitter<IStateChangedEvent>;

    constructor(pDocument: vscode.TextDocument) {
        this._Document = pDocument;
        this._Bridge = new XTFXBridge();
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

    get Bridge(): XTFXBridge {
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

            // Set context path for configuration lookup
            if (uri.scheme !== "untitled")
                this._Bridge.SetContextPath(uri.fsPath);

            // Load data types from configuration
            await this._Bridge.LoadDataTypes();

            // Load available .dsorm files from the same directory (for ParentModel property)
            await this._Bridge.LoadAvailableOrmFiles();

            // Every .dsorm in the repository except this one (for the Import Models property)
            await this._Bridge.LoadAvailableRepositoryModels();

            // Discover code-generation template profiles under .DASE/Templates (for CodeTemplate)
            await this._Bridge.LoadAvailableTemplateProfiles();

            // Handle untitled files
            if (uri.scheme === "untitled") {
                this._Bridge.LoadOrmModelFromText("{}");
                this._IsDirty = true; // Mark as dirty so user is prompted to save
                return;
            }

            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(bytes).toString("utf8");
            this._Bridge.LoadOrmModelFromText(text);

            // Pre-load parent model tables so the properties panel has them on first open
            const parentModel = this._Bridge.Controller?.Design?.ParentModel as string | undefined;
            if (parentModel) {
                const selected = parentModel.split("|").filter((f: string) => f.length > 0);
                /* istanbul ignore next */
                if (selected.length > 0)
                    await this._Bridge.LoadParentModelTables(selected);
            }

            // Idem para os modelos importados: é deles que sai boa parte do que o seletor
            // de tabela espelho oferece, e ele pode ser aberto logo no primeiro clique.
            const imported = this._Bridge.Controller?.Design?.GetImportedModels?.() as string[] | undefined;
            if (imported && imported.length > 0)
                await this._Bridge.LoadImportedModelTables(imported);

            // Árvore inteira de modelos alcançáveis: a herança sobe além do que este modelo
            // declara, e a validação precisa disso já na primeira passada — senão uma base
            // legítima, herdada de dois níveis acima, apareceria como não encontrada.
            await this._Bridge.LoadInheritanceSources();

            this._IsDirty = false;
        }
        catch (error) {
            GetLogService().Error(`Failed to load ORM model: ${this._Document.uri.fsPath}`, error);
            throw error;
        }
    }

    async Save(): Promise<void> {
        try {
            const uri = this._Document.uri;

            // For untitled files, we can't write directly - just mark as dirty
            // The VS Code framework will prompt the user to "Save As"
            if (uri.scheme === "untitled")
                return;

            const text = this._Bridge.SaveOrmModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(uri, bytes);
            this._IsDirty = false;
        }
        catch (error) {
            GetLogService().Error(`Failed to save ORM model: ${this._Document.uri.fsPath}`, error);
            throw error;
        }
    }

    GetModelData(): IModelData {
        return this._Bridge.GetModelData();
    }

    Validate(): XIssueItem[] {
        this._LastIssues = this._Bridge.ValidateOrmModel();
        this.IssueService.SetIssues(this._LastIssues);
        return this._LastIssues;
    }

    RefreshIssues(): void {
        this.IssueService.SetIssues(this._LastIssues);
    }

    AddTable(pX: number, pY: number, pName: string): XIOperationResult {
        const result = this._Bridge.AddTable(pX, pY, pName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddReference(pSourceTableID: string, pTargetTableID: string, pName: string, pIsOneToOne?: boolean): XIOperationResult {
        const result = this._Bridge.AddReference(pSourceTableID, pTargetTableID, pName, pIsOneToOne);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddField(pTableID: string, pName: string, pDataType: string): XIOperationResult {
        const result = this._Bridge.AddField(pTableID, pName, pDataType);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AlignLines(): XIOperationResult {
        const result = this._Bridge.AlignLines();
        if (result)
            this.IsDirty = true;
        return { Success: result };
    }

    MoveReferenceTarget(pReferenceID: string, pTargetTableID: string): XIOperationResult {
        const result = this._Bridge.MoveReferenceTarget(pReferenceID, pTargetTableID);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    async LoadParentModelTables(pModels: string[]): Promise<void> {
        return this._Bridge.LoadParentModelTables(pModels);
    }

    AddShadowTable(pPayload: IAddShadowTablePayload): XIOperationResult {
        const result = this._Bridge.AddShadowTable(pPayload);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    DeleteSelected(): XIOperationResult {
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

    RenameSelected(pNewName: string): XIOperationResult {
        const selection = this.SelectionService;
        if (!selection.HasSelection || !selection.PrimaryID)
            return { Success: false, Message: "No selection." };

        const result = this._Bridge.RenameElement(selection.PrimaryID, pNewName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    MoveElement(pElementID: string, pX: number, pY: number): XIOperationResult {
        const result = this._Bridge.MoveElement(pElementID, pX, pY);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    ReorderField(pFieldID: string, pNewIndex: number): XIOperationResult {
        const result = this._Bridge.ReorderField(pFieldID, pNewIndex);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): XIOperationResult {
        const result = this._Bridge.UpdateProperty(pElementID, pPropertyKey, pValue);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    GetProperties(pElementID: string): XPropertyItem[] {
        return this._Bridge.GetProperties(pElementID);
    }

    /* istanbul ignore next — ExportToDBML delegates to bridge; tested via TFXBridge.ExportToDBML.test.ts */
    ExportToDBML(): string {
        return this._Bridge.ExportToDBML();
    }

    GetElementInfo(pElementID: string): { ID: string; Name: string; Type: string } | null {
        return this._Bridge.GetElementInfo(pElementID);
    }

    /**
     * Reload data types from configuration file
     * Use when configuration file has been changed
     */
    async ReloadDataTypes(): Promise<void> {
        await this._Bridge.ReloadDataTypes();
        GetLogService().Info("Data types reloaded from configuration");
    }

    Dispose(): void {
        this._OnStateChanged.dispose();
    }
}
