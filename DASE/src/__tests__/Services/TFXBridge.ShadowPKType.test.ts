jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';
import type { IAddShadowTablePayload } from '../../Services/TFXBridge';
import * as tfx from '@tootega/tfx';

/**
 * O tipo da chave primária de uma tabela espelho.
 *
 * Um espelho não tem campos: o `PKType` da tabela é a ÚNICA declaração do tipo da chave que
 * ele carrega, e é dele que a validação tira o tipo das colunas FK que o apontam. Nascendo
 * com o default (`Int32`), um espelho de tabela com chave `Guid` ou `Int16` rebaixa toda FK
 * que o referencia a `int` — no código gerado e no banco.
 */
describe('XTFXBridge — PKType da tabela espelho', () =>
{
    let bridge: XTFXBridge;

    beforeEach(() =>
    {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    function PayloadEspelho(pOverrides: Partial<IAddShadowTablePayload>): IAddShadowTablePayload
    {
        return {
            X: 400, Y: 0,
            ModelName: '', DocumentID: '', DocumentName: '',
            ModuleID: '', ModuleName: '',
            TableID: '', TableName: '',
            ...pOverrides
        };
    }

    function Espelho(): tfx.XORMTable
    {
        const design = bridge.Controller?.Design as tfx.XORMDesign;
        return design.GetTables().find(t => t.IsShadow)!;
    }

    // -----------------------------------------------------------------------
    // Espelho de tabela do próprio modelo
    // -----------------------------------------------------------------------

    describe('espelho local', () =>
    {
        beforeEach(() =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Vendas',
                Tables: [{
                    ID: 'tbl-inquilino', Name: 'Inquilino', X: 0, Y: 0, Width: 200, Height: 60,
                    Fields: [{ ID: 'pk-inq', Name: 'InquilinoID', DataType: 'Guid', IsPrimaryKey: true }]
                }]
            }));
        });

        it('herda o PKType da original ao ser criado', () =>
        {
            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'Vendas.dsorm', DocumentName: 'Vendas',
                TableID: 'tbl-inquilino', TableName: 'Inquilino'
            }));

            expect(Espelho().PKType).toBe('Guid');
        });

        it('acompanha a original quando a chave dela muda de tipo', () =>
        {
            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'Vendas.dsorm', DocumentName: 'Vendas',
                TableID: 'tbl-inquilino', TableName: 'Inquilino'
            }));

            const design = bridge.Controller?.Design as tfx.XORMDesign;
            design.FindTableByID('tbl-inquilino')!.PKType = 'Int64';

            bridge.ValidateOrmModel();

            expect(Espelho().PKType).toBe('Int64');
            expect(bridge.LastSyncMutated).toBe(true);
        });

        /**
         * O efeito que motiva tudo: a coluna FK sai com o tipo da chave que ela referencia.
         * Com o espelho no default, esta FK viraria `Int32` apontando para um `Guid`.
         */
        it('faz a FK que aponta o espelho sair com o tipo da chave da origem', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Vendas',
                Tables: [
                    {
                        ID: 'tbl-inquilino', Name: 'Inquilino', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [{ ID: 'pk-inq', Name: 'InquilinoID', DataType: 'Guid', IsPrimaryKey: true }]
                    },
                    {
                        ID: 'tbl-pedido', Name: 'Pedido', X: 0, Y: 200, Width: 200, Height: 80,
                        Fields: [
                            { ID: 'pk-ped', Name: 'PedidoID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-inq', Name: 'InquilinoID', DataType: 'Int32', IsPrimaryKey: false }
                        ]
                    },
                    {
                        ID: 'esp-inquilino', Name: 'Inquilino', X: 400, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'tbl-inquilino', ShadowTableName: 'Inquilino'
                    }
                ],
                References: [
                    { ID: 'ref-1', Name: 'FK_Inquilino', SourceFieldID: 'fk-inq', TargetTableID: 'esp-inquilino' }
                ]
            }));

            bridge.ValidateOrmModel();

            const design = bridge.Controller?.Design as tfx.XORMDesign;
            expect(design.FindFieldByID('fk-inq')!.DataType).toBe('Guid');
        });

        it('não acusa mutação quando o espelho já está com o tipo da origem', () =>
        {
            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'Vendas.dsorm', DocumentName: 'Vendas',
                TableID: 'tbl-inquilino', TableName: 'Inquilino'
            }));

            bridge.ValidateOrmModel();

            expect(bridge.LastSyncMutated).toBe(false);
        });

        it('preserva o PKType do espelho ao salvar e reabrir o modelo', () =>
        {
            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'Vendas.dsorm', DocumentName: 'Vendas',
                TableID: 'tbl-inquilino', TableName: 'Inquilino'
            }));

            const xml = bridge.SaveOrmModelToText();
            const outro = new XTFXBridge();
            outro.LoadOrmModelFromText(xml);

            const design = outro.Controller?.Design as tfx.XORMDesign;
            expect(design.GetTables().find(t => t.IsShadow)!.PKType).toBe('Guid');
        });
    });

    // -----------------------------------------------------------------------
    // Espelho de tabela de outro modelo
    // -----------------------------------------------------------------------

    describe('espelho de outro modelo', () =>
    {
        beforeEach(() =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [{ ID: 'tbl-1', Name: 'Pedido', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
        });

        it('herda o PKType da tabela de um modelo importado', () =>
        {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.SYS/MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxInquilino', Fill: '', PKType: 'Guid' }]
            }];

            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'MER-SYS.dsorm',
                DocumentName: 'Back/Modules/Tootega.SYS/MER-SYS',
                ModuleName: 'Tootega.SYS',
                TableName: 'SYSxInquilino'
            }));

            expect(Espelho().PKType).toBe('Guid');
        });

        it('corrige na validação um espelho salvo antes, com o default', () =>
        {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.SYS/MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxEstadoRegistro', Fill: '', PKType: 'Int16' }]
            }];

            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [{
                    ID: 'esp-1', Name: 'SYSxEstadoRegistro', X: 0, Y: 0, Width: 200, Height: 28,
                    IsShadow: true, ShadowTableID: '', ShadowTableName: 'SYSxEstadoRegistro',
                    ShadowDocumentName: 'Back/Modules/Tootega.SYS/MER-SYS'
                }]
            }));

            bridge.ValidateOrmModel();

            expect(Espelho().PKType).toBe('Int16');
            expect(bridge.LastSyncMutated).toBe(true);
        });

        it('mantém o tipo já herdado quando a origem não declara PKType', () =>
        {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.SYS/MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxInquilino', Fill: '' }]
            }];

            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [{
                    ID: 'esp-1', Name: 'SYSxInquilino', X: 0, Y: 0, Width: 200, Height: 28,
                    PKType: 'Guid',
                    IsShadow: true, ShadowTableID: '', ShadowTableName: 'SYSxInquilino',
                    ShadowDocumentName: 'Back/Modules/Tootega.SYS/MER-SYS'
                }]
            }));

            bridge.ValidateOrmModel();

            expect(Espelho().PKType).toBe('Guid');
            expect(bridge.LastSyncMutated).toBe(false);
        });

        it('herda o PKType de uma tabela de modelo-pai', async () =>
        {
            bridge.SetContextPath('/test/dir/CRM.dsorm');

            const pai = new XTFXBridge();
            pai.LoadOrmModelFromText(JSON.stringify({
                Name: 'SYS',
                Tables: [{
                    ID: 'p-1', Name: 'SYSxInquilino', X: 0, Y: 0, Width: 200, Height: 60,
                    Fields: [{ ID: 'p-pk', Name: 'SYSxInquilinoID', DataType: 'Guid', IsPrimaryKey: true }]
                }]
            }));
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(pai.SaveOrmModelToText()));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['SYS.dsorm']);

            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'SYS.dsorm', DocumentName: 'SYS', TableName: 'SYSxInquilino'
            }));

            expect(Espelho().PKType).toBe('Guid');
        });

        /**
         * Tabela sem campo PK é o próprio espelho: o modelo-pai pode conter um, e o seletor
         * o oferece. Aí o tipo da chave só existe na propriedade da tabela.
         */
        it('usa o PKType da tabela quando a origem não tem campo PK', async () =>
        {
            bridge.SetContextPath('/test/dir/CRM.dsorm');

            const pai = new XTFXBridge();
            pai.LoadOrmModelFromText(JSON.stringify({
                Name: 'SYS',
                Tables: [{
                    ID: 'p-esp', Name: 'SYSxInquilino', X: 0, Y: 0, Width: 200, Height: 28,
                    PKType: 'Guid',
                    IsShadow: true, ShadowTableName: 'SYSxInquilino', ShadowDocumentName: 'MER-ID'
                }]
            }));
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(pai.SaveOrmModelToText()));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['SYS.dsorm']);

            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'SYS.dsorm', DocumentName: 'SYS', TableName: 'SYSxInquilino'
            }));

            expect(Espelho().PKType).toBe('Guid');
        });

        /**
         * Modelo gravado pelo DASE4VS traz o tipo da chave como GUID do XDBTypes. Sem a
         * migração, o espelho herdaria a string do GUID como se fosse um nome de tipo.
         */
        it('traduz o tipo legado do C# antes de herdá-lo', async () =>
        {
            bridge.SetContextPath('/test/dir/CRM.dsorm');

            const pai = new XTFXBridge();
            pai.LoadOrmModelFromText(JSON.stringify({
                Name: 'SYS',
                Tables: [{
                    ID: 'p-1', Name: 'SYSxInquilino', X: 0, Y: 0, Width: 200, Height: 60,
                    Fields: [{ ID: 'p-pk', Name: 'SYSxInquilinoID', DataType: 'Guid', IsPrimaryKey: true }]
                }]
            }));
            // GUID do XGuid no XDBTypes do DASE4VS
            const xmlLegado = pai.SaveOrmModelToText()
                .replace(/>Guid</g, '>8C5DEBC0-4165-4429-B106-1554552F802E<');
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(xmlLegado));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['SYS.dsorm']);

            bridge.AddShadowTable(PayloadEspelho({
                ModelName: 'SYS.dsorm', DocumentName: 'SYS', TableName: 'SYSxInquilino'
            }));

            expect(Espelho().PKType).toBe('Guid');
        });
    });

    // -----------------------------------------------------------------------
    // Espelho criado pelo State Control
    // -----------------------------------------------------------------------

    describe('espelho criado pelo State Control', () =>
    {
        it('dá ao campo de estado o tipo da chave da tabela de estado', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                StateControlTable: 'SYSxEstadoRegistro',
                Tables: [{ ID: 'tbl-1', Name: 'Pedido', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.SYS/MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxEstadoRegistro', Fill: '', PKType: 'Int16' }]
            }];

            bridge.UpdateProperty('tbl-1', 'UseStateControl', true);

            const design = bridge.Controller?.Design as tfx.XORMDesign;
            expect(Espelho().PKType).toBe('Int16');
            expect(design.FindTableByID('tbl-1')!.GetStateField()!.DataType).toBe('Int16');
        });
    });

    // -----------------------------------------------------------------------
    // Painel de propriedades
    // -----------------------------------------------------------------------

    describe('GetProperties', () =>
    {
        it('mostra o PKType herdado, sem deixar editar', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'CRM',
                Tables: [{
                    ID: 'esp-1', Name: 'SYSxInquilino', X: 0, Y: 0, Width: 200, Height: 28,
                    PKType: 'Guid',
                    IsShadow: true, ShadowTableID: '', ShadowTableName: 'SYSxInquilino',
                    ShadowDocumentName: 'MER-SYS'
                }]
            }));

            const pkTypeProp = bridge.GetProperties('esp-1').find(p => p.Key === 'PKType');

            expect(pkTypeProp?.Value).toBe('Guid');
            expect(pkTypeProp?.IsReadOnly).toBe(true);
        });
    });
});
