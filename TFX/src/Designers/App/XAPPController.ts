import { XAPPDocument } from "./XAPPDocument.js";
import { XAPPDesign } from "./XAPPDesign.js";
import { XAPPApplication } from "./XAPPApplication.js";
import { XAPPColumn } from "./XAPPColumn.js";
import { XAPPFilterField } from "./XAPPFilterField.js";
import { XAPPButton } from "./XAPPButton.js";
import { XAPPRowAction } from "./XAPPRowAction.js";
import { XAPPApplicationViewer } from "./XAPPApplicationViewer.js";
import { XAPPFormSection } from "./XAPPFormSection.js";
import { XAPPFormTab } from "./XAPPFormTab.js";
import { XAPPField } from "./XAPPField.js";
import { XAPPFormView } from "./XAPPFormView.js";
import { XAPPTabbedFormView } from "./XAPPTabbedFormView.js";
import { XAPPFormViewBase } from "./XAPPFormViewBase.js";
import { XAPPVisibilityRule } from "./XAPPVisibilityRule.js";
import { XAPPFieldBinding } from "./XAPPFieldBinding.js";
import { XAPPDetailGrid } from "./XAPPDetailGrid.js";
import type { XPersistableElement } from "../../Core/XPersistableElement.js";

export interface XIAppOperationResult
{
    Success: boolean;
    ElementID?: string;
    Message?: string;
}

export interface XIAddFormSectionData
{
    /** ID do `XAPPFormView` (App simples) ou de um `XAPPFormTab` (App com abas). */
    ParentID: string;
    TitleKey?: string;
    ShowHeader?: boolean;
}

export interface XIAppAddFieldData
{
    SectionID: string;
    FieldName: string;
    Row: number;
    ColSpan: number;
}

/**
 * Fachada de operações — mirror de `XORMController`. Quem chama (o Bridge, na Fase 2) não
 * conhece a árvore de classes por dentro; só o vocabulário de operações.
 */
export class XAPPController
{
    private _Document: XAPPDocument | null = null;

    public get Document(): XAPPDocument | null
    {
        return this._Document;
    }

    public set Document(pValue: XAPPDocument | null)
    {
        this._Document = pValue;
    }

    public get Design(): XAPPDesign | null
    {
        return this._Document?.Design ?? null;
    }

    public GetApplication(): XAPPApplication | null
    {
        return this.Design?.GetApplication() ?? null;
    }

    /**
     * Cria a `XAPPApplication` raiz de um `.dsapp` novo (idempotente — espelha
     * `XAPPDesign.CreateApplication`). É o único ponto de entrada explícito: as demais
     * operações (`AddColumn`, `SetFormView`...) a criam por efeito colateral via
     * `RequireApplication`, mas um documento em branco não tem nenhuma dessas ações
     * disponíveis na UI antes de existir uma App — por isso o designer precisa deste método.
     */
    public CreateApplication(pName: string = ""): XIAppOperationResult
    {
        const design = this.Design;
        if (design === null)
            return { Success: false, Message: "No document loaded." };

        const app = design.CreateApplication(pName);
        return { Success: true, ElementID: app.ID };
    }

    /**
     * Cria o `XAPPFormView` (formulário simples) da App, se ainda não existir. Espelha
     * `XAPPApplication.SetFormView` — necessário porque uma App recém-criada não tem
     * formulário nenhum, e é o único jeito de o designer chegar a um `ParentID` válido
     * para `AddFormSection`.
     */
    public SetFormView(): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const form = app.SetFormView();
        return { Success: true, ElementID: form.ID };
    }

    /** Espelha `XAPPApplication.SetTabbedFormView` — formulário com abas. */
    public SetTabbedFormView(): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const form = app.SetTabbedFormView();
        return { Success: true, ElementID: form.ID };
    }

    /** Espelha `XAPPTabbedFormView.AddFormTab` — aba nova num formulário já com abas. */
    public AddFormTab(pTitleKey: string = ""): XIAppOperationResult
    {
        const app = this.RequireApplication();
        const form = app?.GetTabbedFormView();
        if (!form)
            return { Success: false, Message: "No tabbed form view loaded." };

        const tab = form.AddFormTab(pTitleKey);
        return { Success: true, ElementID: tab.ID };
    }

    public AddColumn(pFieldName: string): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const column = app.AddColumn(pFieldName);
        return { Success: true, ElementID: column.ID };
    }

    public AddFilter(pFieldName: string): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const filter = app.AddFilter(pFieldName);
        return { Success: true, ElementID: filter.ID };
    }

    public AddButton(pTitleKey: string = ""): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const button = app.AddButton(pTitleKey);
        return { Success: true, ElementID: button.ID };
    }

    public AddRowAction(pTitleKey: string = ""): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const action = app.AddRowAction(pTitleKey);
        return { Success: true, ElementID: action.ID };
    }

    public AddViewer(pKey: string): XIAppOperationResult
    {
        const app = this.RequireApplication();
        if (app === null)
            return { Success: false, Message: "No application loaded." };

        const viewer = app.AddViewer(pKey);
        return { Success: true, ElementID: viewer.ID };
    }

    /** `ParentID` é o `XAPPFormView` (App simples) ou um `XAPPFormTab` (App com abas). */
    public AddFormSection(pData: XIAddFormSectionData): XIAppOperationResult
    {
        const parent = this.GetElementByID(pData.ParentID);
        if (parent === null)
            return { Success: false, Message: "Parent (FormView/FormTab) not found." };

        let section: XAPPFormSection | null = null;

        if (parent instanceof XAPPFormTab)
            section = parent.AddSection(pData.TitleKey ?? "", pData.ShowHeader ?? true);
        else if ("AddSection" in parent && typeof (parent as { AddSection?: unknown }).AddSection === "function")
            section = (parent as unknown as { AddSection: (t: string) => XAPPFormSection }).AddSection(pData.TitleKey ?? "");

        if (section === null)
            return { Success: false, Message: "Parent does not accept sections." };

        return { Success: true, ElementID: section.ID };
    }

    public AddField(pData: XIAppAddFieldData): XIAppOperationResult
    {
        const section = this.GetElementByID(pData.SectionID);
        if (!(section instanceof XAPPFormSection))
            return { Success: false, Message: "Section not found." };

        const field = section.AddField(pData.FieldName, pData.Row, pData.ColSpan);
        return { Success: true, ElementID: field.ID };
    }

    /**
     * Atualiza uma propriedade por NOME simples (ex.: `"TitleKey"`, não
     * `"XAPPApplication.TitleKey"`). Despacho explícito por tipo — a mesma escolha que
     * `TFXBridge.UpdateProperty` já faz para o domínio ORM: o mapeamento
     * `XProperty.RegisterPropertyLink`/`SetValueByKey` por chave-derivada-do-seletor só
     * funciona quando o registro informa `DeclaringType`, o que este código-base nunca faz —
     * duas classes com uma propriedade de mesmo nome (ex.: `TitleKey` existe em quase toda
     * classe deste domínio) colidiriam no mapa global e uma sobrescreveria a outra em
     * silêncio. Despacho direto evita a categoria de defeito inteira.
     */
    public UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): XIAppOperationResult
    {
        const element = this.GetElementByID(pElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        const applied = XAPPController.SetKnownProperty(element, pPropertyKey, pValue);
        if (!applied)
            return { Success: false, Message: `Unknown property "${pPropertyKey}" for element type ${element.ClassName}.` };

        return { Success: true, ElementID: pElementID };
    }

    private static SetKnownProperty(pElement: XPersistableElement, pKey: string, pValue: unknown): boolean
    {
        // "Name" é comum a todo XPersistableElement — trata-se antes do switch por tipo.
        if (pKey === "Name")
        {
            pElement.Name = pValue as string;
            return true;
        }

        if (pElement instanceof XAPPApplication)
            return XAPPController.SetApplicationProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPColumn)
            return XAPPController.SetColumnProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPFilterField)
            return XAPPController.SetFilterFieldProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPButton)
            return XAPPController.SetButtonProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPRowAction)
            return XAPPController.SetRowActionProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPField)
            return XAPPController.SetFieldProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPFormSection)
            return XAPPController.SetFormSectionProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPFormTab)
            return XAPPController.SetFormTabProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPFormViewBase)
            return XAPPController.SetFormViewBaseProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPApplicationViewer)
            return XAPPController.SetViewerProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPVisibilityRule)
            return XAPPController.SetVisibilityRuleProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPFieldBinding)
            return XAPPController.SetFieldBindingProperty(pElement, pKey, pValue);
        if (pElement instanceof XAPPDetailGrid)
            return XAPPController.SetDetailGridProperty(pElement, pKey, pValue);

        return false;
    }

    private static SetApplicationProperty(pApp: XAPPApplication, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "TitleKey": pApp.TitleKey = pValue as string; return true;
            case "DescriptionKey": pApp.DescriptionKey = pValue as string; return true;
            case "Icon": pApp.Icon = pValue as string; return true;
            case "Route": pApp.Route = pValue as string; return true;
            case "DataEndpoint": pApp.DataEndpoint = pValue as string; return true;
            case "KeyField": pApp.KeyField = pValue as string; return true;
            case "Order": pApp.Order = pValue as number; return true;
            case "Scope": pApp.Scope = pValue as XAPPApplication["Scope"]; return true;
            case "ViewTemplate": pApp.ViewTemplate = pValue as XAPPApplication["ViewTemplate"]; return true;
            case "CustomComponentName": pApp.CustomComponentName = pValue as string; return true;
            case "APIBaseURL": pApp.APIBaseURL = pValue as string; return true;
            case "ImportEndpoint": pApp.ImportEndpoint = pValue as string; return true;
            case "CanCreate": pApp.CanCreate = pValue as boolean; return true;
            case "CanEdit": pApp.CanEdit = pValue as boolean; return true;
            case "CanDelete": pApp.CanDelete = pValue as boolean; return true;
            case "CanExport": pApp.CanExport = pValue as boolean; return true;
            case "CanPrint": pApp.CanPrint = pValue as boolean; return true;
            case "HasStateControl": pApp.HasStateControl = pValue as boolean; return true;
            default: return false;
        }
    }

    private static SetColumnProperty(pColumn: XAPPColumn, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "FieldName": pColumn.FieldName = pValue as string; return true;
            case "TitleKey": pColumn.TitleKey = pValue as string; return true;
            case "DataType": pColumn.DataType = pValue as XAPPColumn["DataType"]; return true;
            case "Width": pColumn.Width = pValue as number; return true;
            case "IsTranslatable": pColumn.IsTranslatable = pValue as boolean; return true;
            case "Order": pColumn.Order = pValue as number; return true;
            default: return false;
        }
    }

    private static SetFilterFieldProperty(pFilter: XAPPFilterField, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "FieldName": pFilter.FieldName = pValue as string; return true;
            case "TitleKey": pFilter.TitleKey = pValue as string; return true;
            case "DataType": pFilter.DataType = pValue as XAPPFilterField["DataType"]; return true;
            case "DefaultOperator": pFilter.DefaultOperator = pValue as XAPPFilterField["DefaultOperator"]; return true;
            case "ShowOperatorSelector": pFilter.ShowOperatorSelector = pValue as boolean; return true;
            case "Order": pFilter.Order = pValue as number; return true;
            default: return false;
        }
    }

    private static SetButtonProperty(pButton: XAPPButton, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "TitleKey": pButton.TitleKey = pValue as string; return true;
            case "Icon": pButton.Icon = pValue as string; return true;
            case "ButtonType": pButton.ButtonType = pValue as XAPPButton["ButtonType"]; return true;
            case "Action": pButton.Action = pValue as XAPPButton["Action"]; return true;
            case "ActionCommand": pButton.ActionCommand = pValue as string; return true;
            case "Order": pButton.Order = pValue as number; return true;
            case "RequiresSelection": pButton.RequiresSelection = pValue as boolean; return true;
            case "RequiresConfirmation": pButton.RequiresConfirmation = pValue as boolean; return true;
            case "ConfirmMessageKey": pButton.ConfirmMessageKey = pValue as string; return true;
            default: return false;
        }
    }

    private static SetRowActionProperty(pAction: XAPPRowAction, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "TitleKey": pAction.TitleKey = pValue as string; return true;
            case "Icon": pAction.Icon = pValue as string; return true;
            case "Endpoint": pAction.Endpoint = pValue as string; return true;
            case "ButtonType": pAction.ButtonType = pValue as XAPPRowAction["ButtonType"]; return true;
            case "VisibleWhenField": pAction.VisibleWhenField = pValue as string; return true;
            case "VisibleWhenValues": pAction.VisibleWhenValues = pValue as string; return true;
            case "ReturnsFile": pAction.ReturnsFile = pValue as boolean; return true;
            case "RequiresConfirmation": pAction.RequiresConfirmation = pValue as boolean; return true;
            case "ConfirmMessageKey": pAction.ConfirmMessageKey = pValue as string; return true;
            case "RequiresCompany": pAction.RequiresCompany = pValue as boolean; return true;
            default: return false;
        }
    }

    private static SetFieldProperty(pField: XAPPField, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "FieldName": pField.FieldName = pValue as string; return true;
            case "TitleKey": pField.TitleKey = pValue as string; return true;
            case "EditorType": pField.EditorType = pValue as XAPPField["EditorType"]; return true;
            case "CustomEditorName": pField.CustomEditorName = pValue as string; return true;
            case "IsReadOnly": pField.IsReadOnly = pValue as boolean; return true;
            case "IsRequired": pField.IsRequired = pValue as boolean; return true;
            case "DefaultValue": pField.DefaultValue = pValue as string; return true;
            case "HintText": pField.HintText = pValue as string; return true;
            case "MaxLength": pField.MaxLength = pValue as number; return true;
            case "LookupEndpoint": pField.LookupEndpoint = pValue as string; return true;
            case "Row": pField.Row = pValue as number; return true;
            case "ColSpan": pField.ColSpan = pValue as number; return true;
            default: return false;
        }
    }

    private static SetFormSectionProperty(pSection: XAPPFormSection, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "TitleKey": pSection.TitleKey = pValue as string; return true;
            case "ShowHeader": pSection.ShowHeader = pValue as boolean; return true;
            default: return false;
        }
    }

    private static SetFormTabProperty(pTab: XAPPFormTab, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "TitleKey": pTab.TitleKey = pValue as string; return true;
            case "Icon": pTab.Icon = pValue as string; return true;
            case "CustomComponentName": pTab.CustomComponentName = pValue as string; return true;
            case "DataEndpoint": pTab.DataEndpoint = pValue as string; return true;
            case "LookupEndpoint": pTab.LookupEndpoint = pValue as string; return true;
            case "VisibleWhenField": pTab.VisibleWhenField = pValue as string; return true;
            default: return false;
        }
    }

    private static SetFormViewBaseProperty(pForm: XAPPFormViewBase, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "ModalWidth": pForm.ModalWidth = pValue as number; return true;
            case "ModalRows": pForm.ModalRows = pValue as number; return true;
            case "SaveEndpoint": pForm.SaveEndpoint = pValue as string; return true;
            case "LoadEndpoint": pForm.LoadEndpoint = pValue as string; return true;
            case "CreateTitleKey": pForm.CreateTitleKey = pValue as string; return true;
            case "EditTitleKey": pForm.EditTitleKey = pValue as string; return true;
            case "ViewTitleKey": pForm.ViewTitleKey = pValue as string; return true;
            case "ShowTabs":
                if (pForm instanceof XAPPTabbedFormView)
                {
                    pForm.ShowTabs = pValue as boolean;
                    return true;
                }
                return false;
            default: return false;
        }
    }

    private static SetViewerProperty(pViewer: XAPPApplicationViewer, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "Key": pViewer.Key = pValue as string; return true;
            case "TitleKey": pViewer.TitleKey = pValue as string; return true;
            case "LoadEndpoint": pViewer.LoadEndpoint = pValue as string; return true;
            default: return false;
        }
    }

    private static SetVisibilityRuleProperty(pRule: XAPPVisibilityRule, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "Field": pRule.Field = pValue as string; return true;
            case "Operator": pRule.Operator = pValue as XAPPVisibilityRule["Operator"]; return true;
            case "Values": pRule.MatchValues = pValue as string; return true;
            case "Negate": pRule.Negate = pValue as boolean; return true;
            default: return false;
        }
    }

    private static SetFieldBindingProperty(pBinding: XAPPFieldBinding, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "SourceField": pBinding.SourceField = pValue as string; return true;
            case "TargetField": pBinding.TargetField = pValue as string; return true;
            default: return false;
        }
    }

    private static SetDetailGridProperty(pGrid: XAPPDetailGrid, pKey: string, pValue: unknown): boolean
    {
        switch (pKey)
        {
            case "DataEndpoint": pGrid.DataEndpoint = pValue as string; return true;
            case "AddEndpoint": pGrid.AddEndpoint = pValue as string; return true;
            case "RemoveEndpoint": pGrid.RemoveEndpoint = pValue as string; return true;
            case "LookupEndpoint": pGrid.LookupEndpoint = pValue as string; return true;
            case "KeyField": pGrid.KeyField = pValue as string; return true;
            case "EmptyMessageKey": pGrid.EmptyMessageKey = pValue as string; return true;
            case "RemoveConfirmMessageKey": pGrid.RemoveConfirmMessageKey = pValue as string; return true;
            case "CanAdd": pGrid.CanAdd = pValue as boolean; return true;
            case "CanRemove": pGrid.CanRemove = pValue as boolean; return true;
            case "DetailTitleKey": pGrid.DetailTitleKey = pValue as string; return true;
            case "ChildTitleKey": pGrid.ChildTitleKey = pValue as string; return true;
            default: return false;
        }
    }

    public RenameElement(pElementID: string, pNewName: string): XIAppOperationResult
    {
        const element = this.GetElementByID(pElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        element.Name = pNewName;
        return { Success: true, ElementID: pElementID };
    }

    public RemoveElement(pElementID: string): XIAppOperationResult
    {
        const element = this.GetElementByID(pElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        if (!element.CanDelete)
            return { Success: false, Message: "Element cannot be deleted." };

        const removed = element.RemoveFromParent();
        if (!removed)
            return { Success: false, Message: "Failed to remove element." };

        return { Success: true, ElementID: pElementID };
    }

    public GetElementByID(pID: string): XPersistableElement | null
    {
        if (this._Document === null)
            return null;

        return this.FindElementRecursive(this._Document, pID);
    }

    public GetColumns(): XAPPColumn[]
    {
        return this.GetApplication()?.GetColumns() ?? [];
    }

    public GetFilters(): XAPPFilterField[]
    {
        return this.GetApplication()?.GetFilters() ?? [];
    }

    public GetButtons(): XAPPButton[]
    {
        return this.GetApplication()?.GetButtons() ?? [];
    }

    public GetRowActions(): XAPPRowAction[]
    {
        return this.GetApplication()?.GetRowActions() ?? [];
    }

    private RequireApplication(): XAPPApplication | null
    {
        const design = this.Design;
        if (design === null)
            return null;

        return design.GetApplication() ?? design.CreateApplication();
    }

    private FindElementRecursive(pElement: XPersistableElement, pID: string): XPersistableElement | null
    {
        if (pElement.ID === pID)
            return pElement;

        for (const child of pElement.ChildNodes)
        {
            const found = this.FindElementRecursive(child as XPersistableElement, pID);
            if (found !== null)
                return found;
        }

        return null;
    }
}
