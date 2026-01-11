import { XDesignerSelection } from '../../Models/DesignerSelection';

describe('XDesignerSelection', () => {
    let selection: XDesignerSelection;

    beforeEach(() => {
        selection = new XDesignerSelection();
    });

    describe('constructor', () => {
        it('should initialize with empty selection', () => {
            expect(selection.SelectedIDs).toEqual([]);
            expect(selection.PrimaryID).toBeNull();
            expect(selection.HasSelection).toBe(false);
            expect(selection.Count).toBe(0);
        });
    });

    describe('Set', () => {
        it('should set a single ID as selected', () => {
            selection.Set('table-1');

            expect(selection.SelectedIDs).toEqual(['table-1']);
            expect(selection.PrimaryID).toBe('table-1');
            expect(selection.HasSelection).toBe(true);
            expect(selection.Count).toBe(1);
        });

        it('should replace previous selection', () => {
            selection.Set('table-1');
            selection.Set('table-2');

            expect(selection.SelectedIDs).toEqual(['table-2']);
            expect(selection.PrimaryID).toBe('table-2');
        });
    });

    describe('SetMultiple', () => {
        it('should set multiple IDs as selected', () => {
            selection.SetMultiple(['table-1', 'table-2', 'table-3']);

            expect(selection.SelectedIDs).toEqual(['table-1', 'table-2', 'table-3']);
            expect(selection.PrimaryID).toBe('table-1');
            expect(selection.Count).toBe(3);
        });

        it('should set PrimaryID to null when empty array', () => {
            selection.SetMultiple([]);

            expect(selection.SelectedIDs).toEqual([]);
            expect(selection.PrimaryID).toBeNull();
        });

        it('should create a copy of the input array', () => {
            const ids = ['table-1', 'table-2'];
            selection.SetMultiple(ids);
            ids.push('table-3');

            expect(selection.SelectedIDs).toEqual(['table-1', 'table-2']);
        });
    });

    describe('Add', () => {
        it('should add ID to selection', () => {
            selection.Add('table-1');

            expect(selection.SelectedIDs).toEqual(['table-1']);
            expect(selection.PrimaryID).toBe('table-1');
        });

        it('should not add duplicate IDs', () => {
            selection.Add('table-1');
            selection.Add('table-1');

            expect(selection.SelectedIDs).toEqual(['table-1']);
            expect(selection.Count).toBe(1);
        });

        it('should add multiple IDs', () => {
            selection.Add('table-1');
            selection.Add('table-2');

            expect(selection.SelectedIDs).toEqual(['table-1', 'table-2']);
            expect(selection.PrimaryID).toBe('table-1');
        });

        it('should not change PrimaryID when adding subsequent items', () => {
            selection.Add('table-1');
            selection.Add('table-2');

            expect(selection.PrimaryID).toBe('table-1');
        });
    });

    describe('Remove', () => {
        beforeEach(() => {
            selection.SetMultiple(['table-1', 'table-2', 'table-3']);
        });

        it('should remove ID from selection', () => {
            selection.Remove('table-2');

            expect(selection.SelectedIDs).toEqual(['table-1', 'table-3']);
            expect(selection.Count).toBe(2);
        });

        it('should do nothing when removing non-existent ID', () => {
            selection.Remove('table-99');

            expect(selection.SelectedIDs).toEqual(['table-1', 'table-2', 'table-3']);
        });

        it('should update PrimaryID when removing primary element', () => {
            selection.Remove('table-1');

            expect(selection.PrimaryID).toBe('table-2');
        });

        it('should set PrimaryID to null when removing last element', () => {
            selection.Set('table-1');
            selection.Remove('table-1');

            expect(selection.PrimaryID).toBeNull();
            expect(selection.HasSelection).toBe(false);
        });
    });

    describe('Clear', () => {
        it('should clear all selections', () => {
            selection.SetMultiple(['table-1', 'table-2']);
            selection.Clear();

            expect(selection.SelectedIDs).toEqual([]);
            expect(selection.PrimaryID).toBeNull();
            expect(selection.HasSelection).toBe(false);
            expect(selection.Count).toBe(0);
        });
    });

    describe('Contains', () => {
        beforeEach(() => {
            selection.SetMultiple(['table-1', 'table-2']);
        });

        it('should return true for selected ID', () => {
            expect(selection.Contains('table-1')).toBe(true);
            expect(selection.Contains('table-2')).toBe(true);
        });

        it('should return false for non-selected ID', () => {
            expect(selection.Contains('table-3')).toBe(false);
        });
    });

    describe('Toggle', () => {
        it('should add ID when not selected', () => {
            selection.Toggle('table-1');

            expect(selection.Contains('table-1')).toBe(true);
        });

        it('should remove ID when already selected', () => {
            selection.Set('table-1');
            selection.Toggle('table-1');

            expect(selection.Contains('table-1')).toBe(false);
        });

        it('should toggle correctly in multi-selection', () => {
            selection.SetMultiple(['table-1', 'table-2']);
            
            selection.Toggle('table-2');
            expect(selection.SelectedIDs).toEqual(['table-1']);

            selection.Toggle('table-3');
            expect(selection.SelectedIDs).toEqual(['table-1', 'table-3']);
        });
    });

    describe('HasSelection', () => {
        it('should return false when empty', () => {
            expect(selection.HasSelection).toBe(false);
        });

        it('should return true when has selection', () => {
            selection.Set('table-1');
            expect(selection.HasSelection).toBe(true);
        });
    });

    describe('Count', () => {
        it('should return correct count', () => {
            expect(selection.Count).toBe(0);

            selection.Add('table-1');
            expect(selection.Count).toBe(1);

            selection.Add('table-2');
            expect(selection.Count).toBe(2);

            selection.Remove('table-1');
            expect(selection.Count).toBe(1);
        });
    });
});
