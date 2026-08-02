/**
 * XAppBridge — ponte DASE↔TFX para o domínio de App/Formulário (`.dsapp`).
 *
 * Mirror de `TFXBridge.ts`, mas para `XAPPController`/`XAPPValidator`/`XAPPDocument`
 * (`TFX/src/Designers/App/`) em vez de `XORMController`/`XORMValidator`/`XORMDocument`. Fica
 * em arquivo PRÓPRIO — não uma extensão de `TFXBridge` — porque o ORM já é um arquivo de
 * 3000+ linhas cheio de particularidades (roteamento de linha, herança, espelho, migração de
 * GUID legado do C#) que não fazem sentido nenhum para uma árvore de formulário sem canvas
 * espacial. O que os dois compartilham (envelope de operação, severidade de issue) já vem de
 * `Models/IssueItem.ts`, reaproveitado sem cópia.
 *
 * Fase 2 do plano "App Designer": carga/gravação do texto, validação, e o vocabulário de
 * mutação que `XAPPController` já expõe. A UI (Fase 3/4) ainda não existe — este arquivo não
 * é referenciado por nenhum comando ou editor até lá.
 */
import {
    XAPPController,
    XAPPValidator,
    XAPPDocument,
    XAPPApplication,
    XAPPColumn,
    XAPPFilterField,
    XAPPButton,
    XAPPRowAction,
    XAPPApplicationViewer,
    XAPPFormSection,
    XAPPField,
    XAPPFieldBinding,
    XAPPVisibilityRule,
    XAPPFormTab,
    XAPPDetailGrid,
    XAPPDetailField,
    XAPPScope,
    XAPPViewTemplate,
    XAPPDataType,
    XAPPFilterOperator,
    XAPPButtonType,
    XAPPButtonAction,
    XAPPEditorType,
    XGuid,
    XSerializationEngine,
    RegisterAppElements,
    type XIAppOperationResult,
    type XIAddFormSectionData,
    type XIAppAddFieldData
} from "@tootega/tfx";
import { XIssueItem, XIssueSeverity, TIssueSeverity } from "../Models/IssueItem";
import { XPropertyItem, XPropertyType } from "../Models/PropertyItem";
import * as tfx from "@tootega/tfx";

// ============================================================================
// DTOs para o webview — JSON puro, um espelho 1:1 do modelo TFX (não é o
// contrato final de UI; a Fase 4 decide como desenhar cada peça, mas a forma
// dos dados já é a mesma seja qual for a UI que a consumir).
// ============================================================================

export interface IAppColumnData { ID: string; FieldName: string; TitleKey: string; DataType: number; Width: number; IsTranslatable: boolean; Order: number; }
export interface IAppFilterData { ID: string; FieldName: string; TitleKey: string; DataType: number; DefaultOperator: number; ShowOperatorSelector: boolean; Order: number; }
export interface IAppButtonData { ID: string; Name: string; TitleKey: string; Icon: string; ButtonType: number; Action: number; ActionCommand: string; Order: number; RequiresSelection: boolean; RequiresConfirmation: boolean; ConfirmMessageKey: string; }
export interface IAppRowActionData { ID: string; Name: string; TitleKey: string; Icon: string; Endpoint: string; ButtonType: number; VisibleWhenField: string; VisibleWhenValues: string; ReturnsFile: boolean; RequiresConfirmation: boolean; ConfirmMessageKey: string; RequiresCompany: boolean; }
export interface IAppFieldBindingData { ID: string; SourceField: string; TargetField: string; }
export interface IAppVisibilityRuleData { ID: string; Field: string; Operator: number; Values: string; Negate: boolean; }
export interface IAppFieldData {
    ID: string; FieldName: string; TitleKey: string; EditorType: number; CustomEditorName: string;
    IsReadOnly: boolean; IsRequired: boolean; DefaultValue: string; HintText: string; MaxLength: number;
    LookupEndpoint: string; Row: number; ColSpan: number;
    FieldBindings: IAppFieldBindingData[]; VisibilityRules: IAppVisibilityRuleData[];
}
export interface IAppFormSectionData { ID: string; Name: string; TitleKey: string; ShowHeader: boolean; Fields: IAppFieldData[]; }
export interface IAppDetailColumnData { ID: string; FieldName: string; TitleKey: string; DataType: number; Width: number; IsTranslatable: boolean; }
export interface IAppDetailFieldData { ID: string; FieldName: string; TitleKey: string; }
export interface IAppDetailGridData {
    ID: string; DataEndpoint: string; AddEndpoint: string; RemoveEndpoint: string; LookupEndpoint: string;
    KeyField: string; EmptyMessageKey: string; RemoveConfirmMessageKey: string; CanAdd: boolean; CanRemove: boolean;
    DetailTitleKey: string; ChildTitleKey: string;
    Columns: IAppDetailColumnData[]; DetailFields: IAppDetailFieldData[]; ChildGrid: IAppDetailGridData | null;
}
export interface IAppFormTabData {
    ID: string; Name: string; TitleKey: string; Icon: string; CustomComponentName: string;
    DataEndpoint: string; LookupEndpoint: string; VisibleWhenField: string;
    Sections: IAppFormSectionData[]; VisibilityRules: IAppVisibilityRuleData[]; DetailGrid: IAppDetailGridData | null;
}
interface IAppFormViewHeader { ID: string; ModalWidth: number; ModalRows: number; SaveEndpoint: string; LoadEndpoint: string; CreateTitleKey: string; EditTitleKey: string; ViewTitleKey: string; }
export interface IAppFormViewData extends IAppFormViewHeader { Sections: IAppFormSectionData[]; }
export interface IAppTabbedFormViewData extends IAppFormViewHeader { ShowTabs: boolean; Tabs: IAppFormTabData[]; }
export interface IAppViewerData { ID: string; Key: string; TitleKey: string; LoadEndpoint: string; Sections: IAppFormSectionData[]; }
export interface IAppApplicationData {
    ID: string; Name: string; TitleKey: string; DescriptionKey: string; Icon: string; Route: string;
    DataEndpoint: string; KeyField: string; Order: number; Scope: number; ViewTemplate: number;
    CustomComponentName: string; APIBaseURL: string; ImportEndpoint: string;
    CanCreate: boolean; CanEdit: boolean; CanDelete: boolean; CanExport: boolean; CanPrint: boolean; HasStateControl: boolean;
    Columns: IAppColumnData[]; Filters: IAppFilterData[]; Buttons: IAppButtonData[]; RowActions: IAppRowActionData[];
    Viewers: IAppViewerData[]; FormView: IAppFormViewData | null; TabbedFormView: IAppTabbedFormViewData | null;
}
export interface IAppModelData { Application: IAppApplicationData | null; }

// ============================================================================
// Propriedades para o painel Dase.Properties — mirror de TFXBridge.GetProperties, mas
// dirigido por tabela em vez de switch por classe (o catálogo de campos por tipo de
// elemento já vive aqui uma vez só; nasceu do `FIELD_DEFS` que a Fase 4 tinha embutido no
// webview — ver commit que remove `AppDesigner.js`'s inspetor).
// ============================================================================

type TAppPropKind = "text" | "number" | "bool" | "enum";
type TEnumObj = Record<string, string | number>;
type TAppPropSpec = readonly [key: string, label: string, kind: TAppPropKind, enumObj?: TEnumObj];

const PROPERTY_SPECS: Readonly<Record<string, readonly TAppPropSpec[]>> = {
    XAPPApplication: [
        ["Name", "Nome (Name)", "text"], ["TitleKey", "Título (chave i18n)", "text"],
        ["DescriptionKey", "Descrição (chave i18n)", "text"], ["Icon", "Ícone (lucide)", "text"],
        ["Route", "Rota", "text"], ["DataEndpoint", "Data Endpoint", "text"], ["KeyField", "Key Field", "text"],
        ["Order", "Ordem no menu", "number"], ["Scope", "Scope", "enum", XAPPScope],
        ["ViewTemplate", "View Template", "enum", XAPPViewTemplate],
        ["CustomComponentName", "Custom Component Name", "text"], ["APIBaseURL", "API Base URL", "text"],
        ["ImportEndpoint", "Import Endpoint", "text"],
        ["CanCreate", "Pode criar", "bool"], ["CanEdit", "Pode editar", "bool"], ["CanDelete", "Pode excluir", "bool"],
        ["CanExport", "Pode exportar", "bool"], ["CanPrint", "Pode imprimir", "bool"],
        ["HasStateControl", "Tem controle de estado", "bool"]
    ],
    XAPPColumn: [
        ["FieldName", "Campo (FieldName)", "text"], ["TitleKey", "Título (chave i18n)", "text"],
        ["DataType", "Tipo de dado", "enum", XAPPDataType], ["Width", "Largura (px)", "number"],
        ["IsTranslatable", "É traduzível", "bool"], ["Order", "Ordem", "number"]
    ],
    XAPPFilterField: [
        ["FieldName", "Campo (FieldName)", "text"], ["TitleKey", "Título (chave i18n)", "text"],
        ["DataType", "Tipo de dado", "enum", XAPPDataType], ["DefaultOperator", "Operador", "enum", XAPPFilterOperator],
        ["ShowOperatorSelector", "Mostra seletor de operador", "bool"], ["Order", "Ordem", "number"]
    ],
    XAPPButton: [
        ["Name", "Nome (Name)", "text"], ["TitleKey", "Título (chave i18n)", "text"], ["Icon", "Ícone (lucide)", "text"],
        ["ButtonType", "Tipo visual", "enum", XAPPButtonType], ["Action", "Ação", "enum", XAPPButtonAction],
        ["ActionCommand", "Action Command (custom)", "text"], ["Order", "Ordem", "number"],
        ["RequiresSelection", "Exige seleção", "bool"], ["RequiresConfirmation", "Exige confirmação", "bool"],
        ["ConfirmMessageKey", "Chave da confirmação", "text"]
    ],
    XAPPRowAction: [
        ["Name", "Nome (Name)", "text"], ["TitleKey", "Título (chave i18n)", "text"], ["Icon", "Ícone (lucide)", "text"],
        ["Endpoint", "Endpoint ({id})", "text"], ["ButtonType", "Tipo visual", "enum", XAPPButtonType],
        ["VisibleWhenField", "Visível quando campo", "text"], ["VisibleWhenValues", "Visível quando valores (pipe)", "text"],
        ["ReturnsFile", "Devolve arquivo", "bool"], ["RequiresConfirmation", "Exige confirmação", "bool"],
        ["ConfirmMessageKey", "Chave da confirmação", "text"], ["RequiresCompany", "Exige empresa corrente", "bool"]
    ],
    XAPPApplicationViewer: [
        ["Key", "Chave (casa com o botão)", "text"], ["TitleKey", "Título (chave i18n)", "text"],
        ["LoadEndpoint", "Load Endpoint", "text"]
    ],
    XAPPField: [
        ["FieldName", "Campo (FieldName)", "text"], ["TitleKey", "Título (chave i18n)", "text"],
        ["EditorType", "Tipo de editor", "enum", XAPPEditorType], ["CustomEditorName", "Editor custom (registry)", "text"],
        ["IsReadOnly", "Somente leitura", "bool"], ["IsRequired", "Obrigatório", "bool"],
        ["DefaultValue", "Valor padrão", "text"], ["HintText", "Dica (chave i18n)", "text"],
        ["MaxLength", "Tamanho máximo", "number"], ["LookupEndpoint", "Lookup Endpoint", "text"],
        ["Row", "Linha (grid 32 col. — FE-2)", "number"], ["ColSpan", "Col Span (1-32 — FE-2)", "number"]
    ],
    XAPPFormSection: [
        ["Name", "Nome (Name)", "text"], ["TitleKey", "Título (chave i18n)", "text"], ["ShowHeader", "Mostra cabeçalho", "bool"]
    ],
    XAPPFormTab: [
        ["Name", "Nome (Name)", "text"], ["TitleKey", "Título (chave i18n)", "text"], ["Icon", "Ícone (lucide)", "text"],
        ["CustomComponentName", "Componente custom (aba)", "text"], ["DataEndpoint", "Data Endpoint (aba custom)", "text"],
        ["LookupEndpoint", "Lookup Endpoint (aba custom)", "text"], ["VisibleWhenField", "Visível quando campo", "text"]
    ],
    XAPPFormView: [
        ["ModalWidth", "Largura do modal (% — FE-3)", "number"], ["ModalRows", "Altura (linhas — FE-4)", "number"],
        ["SaveEndpoint", "Save Endpoint", "text"], ["LoadEndpoint", "Load Endpoint ({id})", "text"],
        ["CreateTitleKey", "Título ao criar (chave)", "text"], ["EditTitleKey", "Título ao editar (chave)", "text"],
        ["ViewTitleKey", "Título ao ver (chave)", "text"]
    ],
    XAPPTabbedFormView: [
        ["ModalWidth", "Largura do modal (% — FE-3)", "number"], ["ModalRows", "Altura (linhas — FE-4)", "number"],
        ["SaveEndpoint", "Save Endpoint", "text"], ["LoadEndpoint", "Load Endpoint ({id})", "text"],
        ["CreateTitleKey", "Título ao criar (chave)", "text"], ["EditTitleKey", "Título ao editar (chave)", "text"],
        ["ViewTitleKey", "Título ao ver (chave)", "text"], ["ShowTabs", "Mostra fileira de abas", "bool"]
    ],
    XAPPDetailGrid: [
        ["DataEndpoint", "Data Endpoint ({id}/{rowId})", "text"], ["AddEndpoint", "Add Endpoint", "text"],
        ["RemoveEndpoint", "Remove Endpoint", "text"], ["LookupEndpoint", "Lookup Endpoint (catálogo)", "text"],
        ["KeyField", "Key Field", "text"], ["EmptyMessageKey", "Mensagem vazia (chave)", "text"],
        ["RemoveConfirmMessageKey", "Confirmação de remover (chave)", "text"],
        ["CanAdd", "Pode adicionar", "bool"], ["CanRemove", "Pode remover", "bool"],
        ["DetailTitleKey", "Título do painel de detalhe (chave)", "text"],
        ["ChildTitleKey", "Título da grade filha (chave)", "text"]
    ]
};

function EnumNames(pEnumObj: TEnumObj): string[] {
    return Object.keys(pEnumObj).filter(k => Number.isNaN(Number(k)));
}

function EnumName(pEnumObj: TEnumObj, pValue: number): string {
    return String(pEnumObj[pValue] ?? pValue);
}

function FindEnumObj(pClassName: string, pKey: string): TEnumObj | undefined {
    const spec = PROPERTY_SPECS[pClassName]?.find(s => s[0] === pKey);
    return spec?.[2] === "enum" ? spec[3] : undefined;
}

export class XAppBridge {
    private _Controller: XAPPController | null = null;
    private _Validator: XAPPValidator | null = null;
    private _Engine: XSerializationEngine | null = null;
    private _Initialized: boolean = false;

    Initialize(): void {
        if (this._Initialized)
            return;

        RegisterAppElements();
        this._Controller = new XAPPController();
        this._Validator = new XAPPValidator();
        this._Engine = XSerializationEngine.Instance;
        this._Initialized = true;
    }

    get Controller(): XAPPController | null {
        return this._Controller;
    }

    get Document(): XAPPDocument | null | undefined {
        return this._Controller?.Document;
    }

    // --- Carga / gravação ------------------------------------------------------------------

    LoadAppModelFromText(pText: string): XAPPDocument {
        this.Initialize();

        try {
            const doc = new XAPPDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "App Model";

            const trimmed = (pText ?? "").trim();
            if (trimmed.length > 0 && (trimmed.startsWith("<?xml") || trimmed.startsWith("<"))) {
                const result = this._Engine!.Deserialize<XAPPDocument>(pText);
                if (result.Success && result.Data) {
                    result.Data.Initialize();
                    this._Controller!.Document = result.Data;
                    return result.Data;
                }
            }

            this._Controller!.Document = doc;
            return doc;
        }
        catch (err) {
            console.error("LoadAppModelFromText error:", err);
            const doc = new XAPPDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "App Model";
            this._Controller!.Document = doc;
            return doc;
        }
    }

    SaveAppModelToText(): string {
        this.Initialize();

        try {
            const doc = this._Controller?.Document;
            if (!doc)
                return '<?xml version="1.0" encoding="utf-8"?>\n<XAPPDocument />';

            const result = this._Engine!.Serialize(doc);
            if (result.Success && result.XmlOutput)
                return result.XmlOutput;

            return '<?xml version="1.0" encoding="utf-8"?>\n<XAPPDocument />';
        }
        catch (err) {
            console.error("SaveAppModelToText error:", err);
            return '<?xml version="1.0" encoding="utf-8"?>\n<XAPPDocument />';
        }
    }

    // --- Validação --------------------------------------------------------------------------

    ValidateAppModel(): XIssueItem[] {
        this.Initialize();

        const doc = this._Controller?.Document;
        if (!doc)
            return [];

        const tfxIssues = this._Validator!.Validate(doc);

        return tfxIssues.map(issue => new XIssueItem(
            issue.ElementID,
            issue.ElementName,
            issue.Severity === tfx.XDesignerErrorSeverity?.Error
                ? XIssueSeverity.Error as TIssueSeverity
                : XIssueSeverity.Warning as TIssueSeverity,
            issue.Message,
            issue.PropertyID
        ));
    }

    // --- Mutação (delega ao XAPPController; ver `extensao-do-motor.md` para o vocabulário) --

    CreateApplication(pName: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.CreateApplication(pName);
    }

    SetFormView(): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.SetFormView();
    }

    SetTabbedFormView(): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.SetTabbedFormView();
    }

    AddFormTab(pTitleKey: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddFormTab(pTitleKey);
    }

    AddColumn(pFieldName: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddColumn(pFieldName);
    }

    AddFilter(pFieldName: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddFilter(pFieldName);
    }

    AddButton(pTitleKey: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddButton(pTitleKey);
    }

    AddRowAction(pTitleKey: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddRowAction(pTitleKey);
    }

    AddViewer(pKey: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddViewer(pKey);
    }

    AddFormSection(pData: XIAddFormSectionData): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddFormSection(pData);
    }

    AddField(pData: XIAppAddFieldData): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.AddField(pData);
    }

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): XIAppOperationResult {
        this.Initialize();
        // A chave é o rótulo sem espaços — mesma convenção de `TFXBridge.UpdateProperty`.
        const chave = pPropertyKey.replace(/\s+/g, "");

        // O painel de propriedades edita enum por NOME (string, ex. "TenantUse"); o modelo
        // guarda o código numérico. Convertido aqui — não no XAPPController, que não deveria
        // saber de rótulo nenhum — antes de repassar.
        let valor = pValue;
        if (typeof valor === "string") {
            const element = this._Controller!.GetElementByID(pElementID);
            const enumObj = element ? FindEnumObj(element.ClassName, chave) : undefined;
            if (enumObj && valor in enumObj)
                valor = enumObj[valor];
        }

        return this._Controller!.UpdateProperty(pElementID, chave, valor);
    }

    /**
     * Propriedades para o painel `Dase.Properties` — mirror de `TFXBridge.GetProperties`,
     * dirigido pela tabela `PROPERTY_SPECS` (chaveada por `element.ClassName`).
     */
    GetProperties(pElementID: string): XPropertyItem[] {
        this.Initialize();

        const element = this._Controller!.GetElementByID(pElementID);
        if (!element)
            return [];

        const specs = PROPERTY_SPECS[element.ClassName];
        if (!specs)
            return [];

        const record = element as unknown as Record<string, unknown>;

        return specs.map(([key, label, kind, enumObj]) => {
            if (kind === "bool")
                return new XPropertyItem(key, label, !!record[key], XPropertyType.Boolean);
            if (kind === "number")
                return new XPropertyItem(key, label, record[key] ?? 0, XPropertyType.Number);
            if (kind === "enum" && enumObj)
                return new XPropertyItem(key, label, EnumName(enumObj, record[key] as number), XPropertyType.Enum, EnumNames(enumObj));
            return new XPropertyItem(key, label, (record[key] as string) ?? "", XPropertyType.String);
        });
    }

    RenameElement(pElementID: string, pNewName: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.RenameElement(pElementID, pNewName);
    }

    DeleteElement(pElementID: string): XIAppOperationResult {
        this.Initialize();
        return this._Controller!.RemoveElement(pElementID);
    }

    GetElementInfo(pElementID: string): { ID: string; Name: string; Type: string } | null {
        this.Initialize();

        const element = this._Controller!.GetElementByID(pElementID);
        if (!element)
            return null;

        return {
            ID: element.ID,
            Name: element.Name,
            Type: element.ClassName
        };
    }

    // --- Dados para o webview (LoadModel) ---------------------------------------------------

    GetModelData(): IAppModelData {
        this.Initialize();

        const app = this._Controller?.GetApplication();
        if (!app)
            return { Application: null };

        return { Application: XAppBridge.MapApplication(app) };
    }

    private static MapApplication(pApp: XAPPApplication): IAppApplicationData {
        return {
            ID: pApp.ID, Name: pApp.Name, TitleKey: pApp.TitleKey, DescriptionKey: pApp.DescriptionKey,
            Icon: pApp.Icon, Route: pApp.Route, DataEndpoint: pApp.DataEndpoint, KeyField: pApp.KeyField,
            Order: pApp.Order, Scope: pApp.Scope, ViewTemplate: pApp.ViewTemplate,
            CustomComponentName: pApp.CustomComponentName, APIBaseURL: pApp.APIBaseURL, ImportEndpoint: pApp.ImportEndpoint,
            CanCreate: pApp.CanCreate, CanEdit: pApp.CanEdit, CanDelete: pApp.CanDelete,
            CanExport: pApp.CanExport, CanPrint: pApp.CanPrint, HasStateControl: pApp.HasStateControl,
            Columns: pApp.GetColumns().map(XAppBridge.MapColumn),
            Filters: pApp.GetFilters().map(XAppBridge.MapFilter),
            Buttons: pApp.GetButtons().map(XAppBridge.MapButton),
            RowActions: pApp.GetRowActions().map(XAppBridge.MapRowAction),
            Viewers: pApp.GetViewers().map(XAppBridge.MapViewer),
            FormView: XAppBridge.MapFormView(pApp),
            TabbedFormView: XAppBridge.MapTabbedFormView(pApp)
        };
    }

    private static MapColumn(pColumn: XAPPColumn): IAppColumnData {
        return {
            ID: pColumn.ID, FieldName: pColumn.FieldName, TitleKey: pColumn.TitleKey, DataType: pColumn.DataType,
            Width: pColumn.Width, IsTranslatable: pColumn.IsTranslatable, Order: pColumn.Order
        };
    }

    private static MapFilter(pFilter: XAPPFilterField): IAppFilterData {
        return {
            ID: pFilter.ID, FieldName: pFilter.FieldName, TitleKey: pFilter.TitleKey, DataType: pFilter.DataType,
            DefaultOperator: pFilter.DefaultOperator, ShowOperatorSelector: pFilter.ShowOperatorSelector, Order: pFilter.Order
        };
    }

    private static MapButton(pButton: XAPPButton): IAppButtonData {
        return {
            ID: pButton.ID, Name: pButton.Name, TitleKey: pButton.TitleKey, Icon: pButton.Icon,
            ButtonType: pButton.ButtonType, Action: pButton.Action, ActionCommand: pButton.ActionCommand,
            Order: pButton.Order, RequiresSelection: pButton.RequiresSelection,
            RequiresConfirmation: pButton.RequiresConfirmation, ConfirmMessageKey: pButton.ConfirmMessageKey
        };
    }

    private static MapRowAction(pAction: XAPPRowAction): IAppRowActionData {
        return {
            ID: pAction.ID, Name: pAction.Name, TitleKey: pAction.TitleKey, Icon: pAction.Icon,
            Endpoint: pAction.Endpoint, ButtonType: pAction.ButtonType, VisibleWhenField: pAction.VisibleWhenField,
            VisibleWhenValues: pAction.VisibleWhenValues, ReturnsFile: pAction.ReturnsFile,
            RequiresConfirmation: pAction.RequiresConfirmation, ConfirmMessageKey: pAction.ConfirmMessageKey,
            RequiresCompany: pAction.RequiresCompany
        };
    }

    private static MapFieldBinding(pBinding: XAPPFieldBinding): IAppFieldBindingData {
        return { ID: pBinding.ID, SourceField: pBinding.SourceField, TargetField: pBinding.TargetField };
    }

    private static MapVisibilityRule(pRule: XAPPVisibilityRule): IAppVisibilityRuleData {
        return { ID: pRule.ID, Field: pRule.Field, Operator: pRule.Operator, Values: pRule.MatchValues, Negate: pRule.Negate };
    }

    private static MapField(pField: XAPPField): IAppFieldData {
        return {
            ID: pField.ID, FieldName: pField.FieldName, TitleKey: pField.TitleKey, EditorType: pField.EditorType,
            CustomEditorName: pField.CustomEditorName, IsReadOnly: pField.IsReadOnly, IsRequired: pField.IsRequired,
            DefaultValue: pField.DefaultValue, HintText: pField.HintText, MaxLength: pField.MaxLength,
            LookupEndpoint: pField.LookupEndpoint, Row: pField.Row, ColSpan: pField.ColSpan,
            FieldBindings: pField.GetFieldBindings().map(XAppBridge.MapFieldBinding),
            VisibilityRules: pField.GetVisibilityRules().map(XAppBridge.MapVisibilityRule)
        };
    }

    private static MapSection(pSection: XAPPFormSection): IAppFormSectionData {
        return {
            ID: pSection.ID, Name: pSection.Name, TitleKey: pSection.TitleKey, ShowHeader: pSection.ShowHeader,
            Fields: pSection.GetFields().map(XAppBridge.MapField)
        };
    }

    private static MapDetailColumn(pColumn: XAPPColumn): IAppDetailColumnData {
        return {
            ID: pColumn.ID, FieldName: pColumn.FieldName, TitleKey: pColumn.TitleKey,
            DataType: pColumn.DataType, Width: pColumn.Width, IsTranslatable: pColumn.IsTranslatable
        };
    }

    private static MapDetailField(pField: XAPPDetailField): IAppDetailFieldData {
        return { ID: pField.ID, FieldName: pField.FieldName, TitleKey: pField.TitleKey };
    }

    private static MapDetailGrid(pGrid: XAPPDetailGrid): IAppDetailGridData {
        const childGrid = pGrid.GetChildGrid();
        return {
            ID: pGrid.ID, DataEndpoint: pGrid.DataEndpoint, AddEndpoint: pGrid.AddEndpoint,
            RemoveEndpoint: pGrid.RemoveEndpoint, LookupEndpoint: pGrid.LookupEndpoint, KeyField: pGrid.KeyField,
            EmptyMessageKey: pGrid.EmptyMessageKey, RemoveConfirmMessageKey: pGrid.RemoveConfirmMessageKey,
            CanAdd: pGrid.CanAdd, CanRemove: pGrid.CanRemove, DetailTitleKey: pGrid.DetailTitleKey, ChildTitleKey: pGrid.ChildTitleKey,
            Columns: pGrid.GetColumns().map(XAppBridge.MapDetailColumn),
            DetailFields: pGrid.GetDetailFields().map(XAppBridge.MapDetailField),
            ChildGrid: childGrid ? XAppBridge.MapDetailGrid(childGrid) : null
        };
    }

    private static MapFormTab(pTab: XAPPFormTab): IAppFormTabData {
        const detailGrid = pTab.GetDetailGrid();
        return {
            ID: pTab.ID, Name: pTab.Name, TitleKey: pTab.TitleKey, Icon: pTab.Icon,
            CustomComponentName: pTab.CustomComponentName, DataEndpoint: pTab.DataEndpoint,
            LookupEndpoint: pTab.LookupEndpoint, VisibleWhenField: pTab.VisibleWhenField,
            Sections: pTab.GetSections().map(XAppBridge.MapSection),
            VisibilityRules: pTab.GetVisibilityRules().map(XAppBridge.MapVisibilityRule),
            DetailGrid: detailGrid ? XAppBridge.MapDetailGrid(detailGrid) : null
        };
    }

    private static MapViewer(pViewer: XAPPApplicationViewer): IAppViewerData {
        return {
            ID: pViewer.ID, Key: pViewer.Key, TitleKey: pViewer.TitleKey, LoadEndpoint: pViewer.LoadEndpoint,
            Sections: pViewer.GetSections().map(XAppBridge.MapSection)
        };
    }

    private static MapFormView(pApp: XAPPApplication): IAppFormViewData | null {
        const form = pApp.GetFormView();
        if (!form)
            return null;

        return {
            ID: form.ID, ModalWidth: form.ModalWidth, ModalRows: form.ModalRows,
            SaveEndpoint: form.SaveEndpoint, LoadEndpoint: form.LoadEndpoint,
            CreateTitleKey: form.CreateTitleKey, EditTitleKey: form.EditTitleKey, ViewTitleKey: form.ViewTitleKey,
            Sections: form.GetSections().map(XAppBridge.MapSection)
        };
    }

    private static MapTabbedFormView(pApp: XAPPApplication): IAppTabbedFormViewData | null {
        const form = pApp.GetTabbedFormView();
        if (!form)
            return null;

        return {
            ID: form.ID, ModalWidth: form.ModalWidth, ModalRows: form.ModalRows,
            SaveEndpoint: form.SaveEndpoint, LoadEndpoint: form.LoadEndpoint,
            CreateTitleKey: form.CreateTitleKey, EditTitleKey: form.EditTitleKey, ViewTitleKey: form.ViewTitleKey,
            ShowTabs: form.ShowTabs,
            Tabs: form.GetTabs().map(XAppBridge.MapFormTab)
        };
    }
}
