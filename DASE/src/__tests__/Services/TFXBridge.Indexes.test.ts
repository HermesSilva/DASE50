// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';

describe('XTFXBridge — Indexes', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    function LoadTableWithTwoFields() {
        bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
            { ID: 'tbl1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60,
              Fields: [
                { ID: 'f1', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                { ID: 'f2', Name: 'Sku', DataType: 'String' },
                { ID: 'f3', Name: 'Notes', DataType: 'String' }
              ]
            }
        ]}));
    }

    describe('GetTableIndexes', () => {
        it('should return null when table does not exist', () => {
            bridge.Initialize();

            expect(bridge.GetTableIndexes('nonexistent-id')).toBeNull();
        });

        it('should return null when element is not an XORMTable', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M' }));
            const designId = bridge.Controller.Design.ID;

            expect(bridge.GetTableIndexes(designId)).toBeNull();
        });

        it('should return the table columns and an empty index list when no index exists', () => {
            LoadTableWithTwoFields();

            const result = bridge.GetTableIndexes('tbl1');

            expect(result).not.toBeNull();
            expect(result!.TableID).toBe('tbl1');
            expect(result!.TableName).toBe('Products');
            expect(result!.Columns.map(c => c.Name)).toEqual(['ID', 'Sku', 'Notes']);
            expect(result!.Indexes).toEqual([]);
        });

        it('should return previously saved indexes with their field settings', () => {
            LoadTableWithTwoFields();
            bridge.SaveTableIndexes('tbl1', [{
                IndexID: 'NEW',
                Name: 'UX_Products_Sku',
                IsUnique: true,
                Filter: '',
                Fields: [{ FieldID: 'f2', IsDescending: false, AllowDuplicate: true, IsIncluded: false }]
            }]);

            const result = bridge.GetTableIndexes('tbl1');

            expect(result!.Indexes.length).toBe(1);
            expect(result!.Indexes[0].Name).toBe('UX_Products_Sku');
            expect(result!.Indexes[0].IsUnique).toBe(true);
            expect(result!.Indexes[0].Fields[0].FieldID).toBe('f2');
            expect(result!.Indexes[0].Fields[0].AllowDuplicate).toBe(true);
        });
    });

    describe('SaveTableIndexes', () => {
        it('should return error result when table is not found', () => {
            bridge.Initialize();

            const result = bridge.SaveTableIndexes('nonexistent-id', []);

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Table not found');
        });

        it('should reject an index without a name', () => {
            LoadTableWithTwoFields();

            const result = bridge.SaveTableIndexes('tbl1', [
                { IndexID: 'NEW', Name: '  ', Fields: [{ FieldID: 'f2' }] }
            ]);

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('needs a name');
        });

        it('should reject duplicate index names', () => {
            LoadTableWithTwoFields();

            const result = bridge.SaveTableIndexes('tbl1', [
                { IndexID: 'NEW', Name: 'IX_Dup', Fields: [{ FieldID: 'f2' }] },
                { IndexID: 'NEW', Name: 'ix_dup', Fields: [{ FieldID: 'f3' }] }
            ]);

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Duplicate index name');
        });

        it('should reject an index whose every column is marked as included', () => {
            LoadTableWithTwoFields();

            const result = bridge.SaveTableIndexes('tbl1', [
                { IndexID: 'NEW', Name: 'IX_Bad', Fields: [{ FieldID: 'f2', IsIncluded: true }] }
            ]);

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('at least one key column');
        });

        it('should persist a new index with ordering, filter and include columns', () => {
            LoadTableWithTwoFields();

            const result = bridge.SaveTableIndexes('tbl1', [{
                IndexID: 'NEW',
                Name: 'IX_Products_Sku',
                IsUnique: false,
                Filter: "Sku <> ''",
                Fields: [
                    { FieldID: 'f2', IsDescending: true },
                    { FieldID: 'f3', IsIncluded: true }
                ]
            }]);

            expect(result.Success).toBe(true);
            const payload = bridge.GetTableIndexes('tbl1');
            expect(payload!.Indexes.length).toBe(1);
            const ix = payload!.Indexes[0];
            expect(ix.Filter).toBe("Sku <> ''");
            expect(ix.Fields).toEqual([
                { FieldID: 'f2', IsDescending: true, AllowDuplicate: false, IsIncluded: false },
                { FieldID: 'f3', IsDescending: false, AllowDuplicate: false, IsIncluded: true }
            ]);
        });

        it('should replace all existing indexes when saving a new list', () => {
            LoadTableWithTwoFields();
            bridge.SaveTableIndexes('tbl1', [
                { IndexID: 'NEW', Name: 'IX_One', Fields: [{ FieldID: 'f2' }] }
            ]);

            const result = bridge.SaveTableIndexes('tbl1', [
                { IndexID: 'NEW', Name: 'IX_Two', Fields: [{ FieldID: 'f3' }] }
            ]);

            expect(result.Success).toBe(true);
            const payload = bridge.GetTableIndexes('tbl1');
            expect(payload!.Indexes.length).toBe(1);
            expect(payload!.Indexes[0].Name).toBe('IX_Two');
        });

        it('should clear all indexes when saving an empty array', () => {
            LoadTableWithTwoFields();
            bridge.SaveTableIndexes('tbl1', [
                { IndexID: 'NEW', Name: 'IX_One', Fields: [{ FieldID: 'f2' }] }
            ]);

            const clearResult = bridge.SaveTableIndexes('tbl1', []);

            expect(clearResult.Success).toBe(true);
            expect(bridge.GetTableIndexes('tbl1')!.Indexes).toEqual([]);
        });
    });
});
