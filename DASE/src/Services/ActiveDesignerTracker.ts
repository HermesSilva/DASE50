/**
 * ActiveDesignerTracker — singleton simples que registra qual TIPO de designer (ORM ou App)
 * teve o foco por último.
 *
 * Existe porque `Dase.Properties` é UM painel só, compartilhado pelos dois designers
 * (`XORMDesignerEditorProvider` e `XAppDesignerEditorProvider`), cada um com sua própria noção
 * de "último ativo" — mas nenhum dos dois sabe, sozinho, se é ELE que está com o foco agora ou
 * o outro. O `CompositeDesignerProvider` (`Views/PropertiesViewProvider.ts`) consulta este
 * tracker para decidir para qual dos dois delegar `GetActiveState`/`GetActivePanel`.
 */
export type TDesignerKind = "ORM" | "App";

export class XActiveDesignerTracker {
    private _Last: TDesignerKind | null = null;

    NotifyActive(pKind: TDesignerKind): void {
        this._Last = pKind;
    }

    get LastActive(): TDesignerKind | null {
        return this._Last;
    }
}

let _Instance: XActiveDesignerTracker | null = null;

export function GetActiveDesignerTracker(): XActiveDesignerTracker {
    if (!_Instance)
        _Instance = new XActiveDesignerTracker();
    return _Instance;
}
