// Importar mock antes do módulo real
jest.mock('vscode');

import { XSelectionService, GetSelectionService } from '../../Services/SelectionService';
import { XDesignerSelection } from '../../Models/DesignerSelection';

describe('XSelectionService', () => {
    let service: XSelectionService;

    beforeEach(() => {
        service = new XSelectionService();
    });

    afterEach(() => {
        service.Dispose();
    });

    describe('constructor', () => {
        it('should initialize with empty selection', () => {
            expect(service.HasSelection).toBe(false);
            expect(service.SelectedIDs).toEqual([]);
            expect(service.PrimaryID).toBeNull();
        });

        it('should have Selection property', () => {
            expect(service.Selection).toBeInstanceOf(XDesignerSelection);
        });
    });

    describe('Select', () => {
        it('should select a single element', () => {
            service.Select('elem-1');

            expect(service.HasSelection).toBe(true);
            expect(service.SelectedIDs).toEqual(['elem-1']);
            expect(service.PrimaryID).toBe('elem-1');
        });

        it('should fire OnSelectionChanged event', () => {
            const mockListener = jest.fn();
            service.OnSelectionChanged(mockListener);

            service.Select('elem-1');

            expect(mockListener).toHaveBeenCalledTimes(1);
            expect(mockListener).toHaveBeenCalledWith(expect.any(XDesignerSelection));
        });
    });

    describe('SelectMultiple', () => {
        it('should select multiple elements', () => {
            service.SelectMultiple(['elem-1', 'elem-2', 'elem-3']);

            expect(service.SelectedIDs).toEqual(['elem-1', 'elem-2', 'elem-3']);
            expect(service.PrimaryID).toBe('elem-1');
        });

        it('should fire OnSelectionChanged event', () => {
            const mockListener = jest.fn();
            service.OnSelectionChanged(mockListener);

            service.SelectMultiple(['elem-1', 'elem-2']);

            expect(mockListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('Clear', () => {
        it('should clear selection', () => {
            service.Select('elem-1');
            service.Clear();

            expect(service.HasSelection).toBe(false);
            expect(service.SelectedIDs).toEqual([]);
            expect(service.PrimaryID).toBeNull();
        });

        it('should fire OnSelectionChanged event', () => {
            const mockListener = jest.fn();
            service.OnSelectionChanged(mockListener);

            service.Clear();

            expect(mockListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('ToggleSelection', () => {
        it('should add element when not selected', () => {
            service.ToggleSelection('elem-1');

            expect(service.IsSelected('elem-1')).toBe(true);
        });

        it('should remove element when already selected', () => {
            service.Select('elem-1');
            service.ToggleSelection('elem-1');

            expect(service.IsSelected('elem-1')).toBe(false);
        });

        it('should fire OnSelectionChanged event', () => {
            const mockListener = jest.fn();
            service.OnSelectionChanged(mockListener);

            service.ToggleSelection('elem-1');

            expect(mockListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('AddToSelection', () => {
        it('should add element to existing selection', () => {
            service.Select('elem-1');
            service.AddToSelection('elem-2');

            expect(service.SelectedIDs).toContain('elem-1');
            expect(service.SelectedIDs).toContain('elem-2');
        });

        it('should fire OnSelectionChanged event', () => {
            const mockListener = jest.fn();
            service.OnSelectionChanged(mockListener);

            service.AddToSelection('elem-1');

            expect(mockListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('RemoveFromSelection', () => {
        it('should remove element from selection', () => {
            service.SelectMultiple(['elem-1', 'elem-2']);
            service.RemoveFromSelection('elem-1');

            expect(service.SelectedIDs).toEqual(['elem-2']);
        });

        it('should fire OnSelectionChanged event', () => {
            service.Select('elem-1');
            const mockListener = jest.fn();
            service.OnSelectionChanged(mockListener);

            service.RemoveFromSelection('elem-1');

            expect(mockListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('IsSelected', () => {
        it('should return true for selected element', () => {
            service.Select('elem-1');

            expect(service.IsSelected('elem-1')).toBe(true);
        });

        it('should return false for non-selected element', () => {
            service.Select('elem-1');

            expect(service.IsSelected('elem-2')).toBe(false);
        });
    });

    describe('Dispose', () => {
        it('should dispose event emitter', () => {
            // Should not throw
            expect(() => service.Dispose()).not.toThrow();
        });
    });
});

describe('GetSelectionService', () => {
    it('should return singleton instance', () => {
        const instance1 = GetSelectionService();
        const instance2 = GetSelectionService();

        expect(instance1).toBe(instance2);
    });

    it('should return XSelectionService instance', () => {
        const instance = GetSelectionService();

        expect(instance).toBeInstanceOf(XSelectionService);
    });
});
