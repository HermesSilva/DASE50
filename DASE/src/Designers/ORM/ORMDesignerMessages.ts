export const XDesignerMessageType = {
    DesignerReady: "DesignerReady",
    LoadModel: "LoadModel",
    ModelLoaded: "ModelLoaded",
    SaveModel: "SaveModel",
    SelectElement: "SelectElement",
    SelectionChanged: "SelectionChanged",
    AddTable: "AddTable",
    AddField: "AddField",
    MoveElement: "MoveElement",
    DragDropAddRelation: "DragDropAddRelation",
    DeleteSelected: "DeleteSelected",
    RenameSelected: "RenameSelected",
    UpdateProperty: "UpdateProperty",
    PropertiesChanged: "PropertiesChanged",
    ValidateModel: "ValidateModel",
    IssuesChanged: "IssuesChanged",
    RequestRename: "RequestRename",
    RenameCompleted: "RenameCompleted",
    AlignLines: "AlignLines",
    ReloadDataTypes: "ReloadDataTypes",
    DataTypesReloaded: "DataTypesReloaded"
} as const;

export type TDesignerMessageType = typeof XDesignerMessageType[keyof typeof XDesignerMessageType];
