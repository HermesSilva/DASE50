import * as vscode from "vscode";
import { XPropertyItem } from "./PropertyItem";

/**
 * O subconjunto de `XORMDesignerState`/`XAppDesignerState` que `PropertiesViewProvider`
 * realmente usa. Existe para o painel `Dase.Properties` — hoje escrito contra o tipo
 * concreto do ORM — poder servir os dois designers sem duplicar o painel (ver
 * `CompositeDesignerProvider` em `Views/PropertiesViewProvider.ts`).
 *
 * `LoadParentModelTables` é opcional de propósito: só o ORM a tem (a chave de propriedade
 * `"ParentModel"` só existe no domínio ORM) — o chamador verifica a existência antes de usar.
 */
export interface IPropertiesCapableState {
    GetProperties(pElementID: string): XPropertyItem[];
    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): { Success: boolean; Message?: string };
    GetModelData(): unknown;
    Save(): Promise<void>;
    LoadParentModelTables?(pModels: string[]): Promise<void>;
}

/** O subconjunto de `XORMDesignerEditorProvider`/`XAppDesignerEditorProvider` que o painel usa. */
export interface IPropertiesCapableProvider {
    GetActiveState(): IPropertiesCapableState | null;
    GetActivePanel(): vscode.WebviewPanel | null;
    SendIssuesUpdate(pPanel: vscode.WebviewPanel, pState: IPropertiesCapableState): Promise<void>;
}
