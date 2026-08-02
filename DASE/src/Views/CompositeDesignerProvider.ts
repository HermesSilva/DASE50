import * as vscode from "vscode";
import type { IPropertiesCapableProvider, IPropertiesCapableState } from "../Models/DesignerContracts";
import { GetActiveDesignerTracker } from "../Services/ActiveDesignerTracker";

/**
 * Delega para o `XORMDesignerEditorProvider` ou o `XAppDesignerEditorProvider` conforme
 * `ActiveDesignerTracker.LastActive` — é o que permite o painel `Dase.Properties` (ÚNICO,
 * compartilhado) servir os dois designers sem duplicar o painel nem o ORM saber que o App
 * existe. `null` (nada teve foco ainda) cai no ORM, preservando o comportamento de quem só
 * usa o ORM Designer hoje.
 */
export class XCompositeDesignerProvider implements IPropertiesCapableProvider {
    private readonly _Orm: IPropertiesCapableProvider;
    private readonly _App: IPropertiesCapableProvider;

    constructor(pOrmProvider: IPropertiesCapableProvider, pAppProvider: IPropertiesCapableProvider) {
        this._Orm = pOrmProvider;
        this._App = pAppProvider;
    }

    private get Active(): IPropertiesCapableProvider {
        return GetActiveDesignerTracker().LastActive === "App" ? this._App : this._Orm;
    }

    GetActiveState(): IPropertiesCapableState | null {
        return this.Active.GetActiveState();
    }

    GetActivePanel(): vscode.WebviewPanel | null {
        return this.Active.GetActivePanel();
    }

    SendIssuesUpdate(pPanel: vscode.WebviewPanel, pState: IPropertiesCapableState): Promise<void> {
        return this.Active.SendIssuesUpdate(pPanel, pState);
    }
}
