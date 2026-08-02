jest.mock('vscode');

import { XCompositeDesignerProvider } from '../../Views/CompositeDesignerProvider';
import { GetActiveDesignerTracker } from '../../Services/ActiveDesignerTracker';
import type { IPropertiesCapableProvider } from '../../Models/DesignerContracts';

function MockProvider(pTag: string): IPropertiesCapableProvider & { Tag: string } {
    return {
        Tag: pTag,
        GetActiveState: jest.fn().mockReturnValue({ Tag: pTag }),
        GetActivePanel: jest.fn().mockReturnValue({ Tag: pTag }),
        SendIssuesUpdate: jest.fn().mockResolvedValue(undefined)
    } as unknown as IPropertiesCapableProvider & { Tag: string };
}

describe('XCompositeDesignerProvider', () => {
    it('delegates to ORM when nothing was ever active (default)', () => {
        // Módulo isolado por arquivo de teste (Jest) — o singleton nasce com LastActive=null aqui.
        expect(GetActiveDesignerTracker().LastActive).toBeNull();

        const orm = MockProvider('ORM');
        const app = MockProvider('App');
        const composite = new XCompositeDesignerProvider(orm, app);

        composite.GetActiveState();
        expect(orm.GetActiveState).toHaveBeenCalled();
    });

    it('delegates to App after NotifyActive("App")', () => {
        const orm = MockProvider('ORM');
        const app = MockProvider('App');
        const composite = new XCompositeDesignerProvider(orm, app);

        GetActiveDesignerTracker().NotifyActive('App');

        composite.GetActiveState();
        composite.GetActivePanel();
        expect(app.GetActiveState).toHaveBeenCalled();
        expect(app.GetActivePanel).toHaveBeenCalled();
        expect(orm.GetActiveState).not.toHaveBeenCalled();
    });

    it('delegates back to ORM after NotifyActive("ORM")', async () => {
        const orm = MockProvider('ORM');
        const app = MockProvider('App');
        const composite = new XCompositeDesignerProvider(orm, app);

        GetActiveDesignerTracker().NotifyActive('ORM');

        const panel = {} as never;
        const state = {} as never;
        await composite.SendIssuesUpdate(panel, state);

        expect(orm.SendIssuesUpdate).toHaveBeenCalledWith(panel, state);
        expect(app.SendIssuesUpdate).not.toHaveBeenCalled();
    });
});
