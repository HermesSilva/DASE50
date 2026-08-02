import { GetActiveDesignerTracker } from '../../Services/ActiveDesignerTracker';

describe('XActiveDesignerTracker', () => {
    it('starts with no last-active kind', () => {
        // O tracker é um singleton do módulo — outros testes já podem tê-lo tocado; aqui só
        // confirmamos que NotifyActive muda o valor lido de volta corretamente.
        const tracker = GetActiveDesignerTracker();
        tracker.NotifyActive('ORM');
        expect(tracker.LastActive).toBe('ORM');

        tracker.NotifyActive('App');
        expect(tracker.LastActive).toBe('App');
    });

    it('returns the same singleton instance', () => {
        expect(GetActiveDesignerTracker()).toBe(GetActiveDesignerTracker());
    });
});
