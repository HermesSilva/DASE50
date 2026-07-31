jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';

describe('XTFXBridge — MoveReferenceTarget', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    function loadModel(): void {
        const model = JSON.stringify({
            Name: 'M',
            Tables: [
                { ID: 'src', Name: 'Order', X: 0, Y: 0, Width: 200, Height: 60 },
                { ID: 'real', Name: 'Customer', X: 400, Y: 0, Width: 200, Height: 60 },
                {
                    ID: 'shadow', Name: 'Customer', X: 800, Y: 0, Width: 200, Height: 28,
                    IsShadow: true, ShadowTableID: 'real', ShadowTableName: 'Customer',
                    ShadowDocumentName: ''
                },
                { ID: 'other', Name: 'Product', X: 0, Y: 400, Width: 200, Height: 60 }
            ]
        });
        bridge.LoadOrmModelFromText(model);
    }

    function firstReferenceID(): string {
        const design = bridge.Controller?.Design as any;
        return design.GetReferences()[0].ID;
    }

    function referenceTarget(pRefID: string): string {
        const design = bridge.Controller?.Design as any;
        return design.FindReferenceByID(pRefID).Target;
    }

    it('moves the FK target from the real table to its same-model shadow', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'shadow');

        expect(result.Success).toBe(true);
        expect(referenceTarget(refID)).toBe('shadow');
    });

    it('moves the FK target from a shadow back to its origin real table', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();
        bridge.MoveReferenceTarget(refID, 'shadow');

        const result = bridge.MoveReferenceTarget(refID, 'real');

        expect(result.Success).toBe(true);
        expect(referenceTarget(refID)).toBe('real');
    });

    it('rejects moving to a table with a different origin', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'other');

        expect(result.Success).toBe(false);
        expect(referenceTarget(refID)).toBe('real');
    });

    it('rejects when the reference already targets the given table', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'real');

        expect(result.Success).toBe(false);
    });

    it('fails for an unknown reference', () => {
        loadModel();
        const result = bridge.MoveReferenceTarget('does-not-exist', 'shadow');
        expect(result.Success).toBe(false);
    });

    it('fails for an unknown target table', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'ghost');

        expect(result.Success).toBe(false);
    });

    /**
     * O mesmo espelho de outro modelo aparece VÁRIAS VEZES no diagrama — desenhar uma cópia
     * perto de cada tabela que a referencia evita atravessar o canvas com uma linha. Mover a
     * FK para a cópia mais próxima é justamente para isso que este comando serve.
     */
    describe('espelho de outro modelo', () => {
        function loadModelComEspelhosImportados(): void {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [
                    { ID: 'src', Name: 'CRMxPedido', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'esp-1', Name: 'SYSxInquilino', X: 400, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-1', ShadowTableName: 'SYSxInquilino',
                        ShadowDocumentName: 'Back/Modules/Tootega.SYS/MER-SYS'
                    },
                    {
                        ID: 'esp-2', Name: 'SYSxInquilino', X: 400, Y: 400, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-2', ShadowTableName: 'SYSxInquilino',
                        ShadowDocumentName: 'Back/Modules/Tootega.SYS/MER-SYS'
                    },
                    {
                        ID: 'esp-outro', Name: 'SYSxEstadoRegistro', X: 800, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-outro', ShadowTableName: 'SYSxEstadoRegistro',
                        ShadowDocumentName: 'Back/Modules/Tootega.SYS/MER-SYS'
                    }
                ]
            }));
        }

        it('move a FK entre duas cópias do mesmo espelho', () => {
            loadModelComEspelhosImportados();
            bridge.AddReference('src', 'esp-1', 'FK_SYSxInquilino');
            const refID = firstReferenceID();

            const result = bridge.MoveReferenceTarget(refID, 'esp-2');

            expect(result.Success).toBe(true);
            expect(referenceTarget(refID)).toBe('esp-2');
        });

        it('aceita a cópia mesmo quando os modelos foram declarados por caminhos diferentes', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [
                    { ID: 'src', Name: 'CRMxPedido', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'esp-pai', Name: 'SYSxInquilino', X: 400, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-pai', ShadowTableName: 'SYSxInquilino',
                        ShadowDocumentName: 'MER-SYS'
                    },
                    {
                        ID: 'esp-importado', Name: 'SYSxInquilino', X: 400, Y: 400, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-importado', ShadowTableName: 'SYSxInquilino',
                        ShadowDocumentName: 'Back/Modules/Tootega.SYS/MER-SYS'
                    }
                ]
            }));
            bridge.AddReference('src', 'esp-pai', 'FK_SYSxInquilino');
            const refID = firstReferenceID();

            const result = bridge.MoveReferenceTarget(refID, 'esp-importado');

            expect(result.Success).toBe(true);
        });

        /**
         * Pelo caminho de verdade: as duas cópias saem do seletor de tabela espelho, que é
         * quem grava `ShadowTableID` com o ID do próprio espelho por não haver tabela local
         * a apontar.
         */
        it('move a FK entre duas cópias criadas pelo seletor', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [{ ID: 'src', Name: 'CRMxPedido', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.SYS/MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxInquilino', Fill: '', PKType: 'Guid' }]
            }];

            const payload = {
                X: 400, Y: 0,
                ModelName: 'MER-SYS.dsorm',
                DocumentID: '', DocumentName: 'Back/Modules/Tootega.SYS/MER-SYS',
                ModuleID: '', ModuleName: 'Tootega.SYS',
                TableID: '', TableName: 'SYSxInquilino'
            };
            const primeiro = bridge.AddShadowTable(payload).ElementID!;
            const segundo = bridge.AddShadowTable({ ...payload, Y: 400 }).ElementID!;

            bridge.AddReference('src', primeiro, 'FK_SYSxInquilino');
            const refID = firstReferenceID();

            const result = bridge.MoveReferenceTarget(refID, segundo);

            expect(result.Success).toBe(true);
            expect(referenceTarget(refID)).toBe(segundo);
        });

        it('recusa um espelho de outra tabela do mesmo modelo', () => {
            loadModelComEspelhosImportados();
            bridge.AddReference('src', 'esp-1', 'FK_SYSxInquilino');
            const refID = firstReferenceID();

            const result = bridge.MoveReferenceTarget(refID, 'esp-outro');

            expect(result.Success).toBe(false);
            expect(referenceTarget(refID)).toBe('esp-1');
        });

        it('recusa um espelho sem origem declarada', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [
                    { ID: 'src', Name: 'CRMxPedido', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'esp-1', Name: 'SYSxInquilino', X: 400, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-1', ShadowTableName: 'SYSxInquilino',
                        ShadowDocumentName: 'MER-SYS'
                    },
                    {
                        ID: 'esp-orfao', Name: 'SYSxInquilino', X: 400, Y: 400, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'esp-orfao', ShadowTableName: '',
                        ShadowDocumentName: ''
                    }
                ]
            }));
            bridge.AddReference('src', 'esp-1', 'FK_SYSxInquilino');
            const refID = firstReferenceID();

            const result = bridge.MoveReferenceTarget(refID, 'esp-orfao');

            expect(result.Success).toBe(false);
        });
    });
});
