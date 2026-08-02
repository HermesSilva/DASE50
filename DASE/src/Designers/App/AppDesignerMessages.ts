/**
 * Protocolo de mensagens webview↔extensão do App Designer — mirror de
 * `ORMDesignerMessages.ts`, mas só com o vocabulário que a árvore de App usa. Sem
 * mensagens de canvas espacial (`MoveElement`, `AlignLines`, `MoveReferenceTarget`) nem de
 * particularidades do ORM (seed, índices, tabela-espelho, organização por IA).
 */
export const XAppDesignerMessageType = {
    DesignerReady: "DesignerReady",
    LoadModel: "LoadModel",
    SaveModel: "SaveModel",
    SelectElement: "SelectElement",
    SelectionChanged: "SelectionChanged",
    CreateApplication: "CreateApplication",
    SetFormView: "SetFormView",
    SetTabbedFormView: "SetTabbedFormView",
    AddFormTab: "AddFormTab",
    AddColumn: "AddColumn",
    AddFilter: "AddFilter",
    AddButton: "AddButton",
    AddRowAction: "AddRowAction",
    AddViewer: "AddViewer",
    AddFormSection: "AddFormSection",
    AddField: "AddField",
    DeleteSelected: "DeleteSelected",
    RequestRename: "RequestRename",
    RenameCompleted: "RenameCompleted",
    UpdateProperty: "UpdateProperty",
    PropertiesChanged: "PropertiesChanged",
    ValidateModel: "ValidateModel",
    IssuesChanged: "IssuesChanged"
} as const;

export type TAppDesignerMessageType = typeof XAppDesignerMessageType[keyof typeof XAppDesignerMessageType];
