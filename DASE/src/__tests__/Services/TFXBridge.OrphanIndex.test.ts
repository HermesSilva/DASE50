jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';
import * as tfx from '@tootega/tfx';

/**
 * Coluna de índice que aponta para um campo que não existe mais.
 *
 * O XORMIndexField guarda o campo por ID. Apagar um campo e desenhá-lo de novo com o mesmo nome
 * deixa o índice preso ao ID velho: a coluna some da tela e o lixo fica só no arquivo, sem lugar
 * onde consertar. A geração então escrevia `HasIndex(e => e.)`, C# que não compila.
 *
 * O Validate Model conserta — e o conserto precisa CHEGAR AO ARQUIVO. Sem sinalizar mutação, ele
 * ficava na memória e o defeito voltava na abertura seguinte.
 */
describe('XTFXBridge — índice com coluna órfã', () =>
{
    let bridge: XTFXBridge;

    beforeEach(() =>
    {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
        bridge.LoadOrmModelFromText(JSON.stringify({
            Name: 'Vendas',
            Tables: [{
                ID: 'tbl-num', Name: 'VNDxNumeracao', X: 0, Y: 0, Width: 200, Height: 60,
                Fields: [
                    { ID: 'pk-num', Name: 'VNDxNumeracaoID', DataType: 'Int32', IsPrimaryKey: true },
                    { ID: 'fld-inq', Name: 'SYSxInquilinoID', DataType: 'Guid' }
                ]
            }]
        }));
    });

    function Tabela(): tfx.XORMTable
    {
        const design = bridge.Controller?.Design as tfx.XORMDesign;
        return design.GetTables().find(t => t.Name === 'VNDxNumeracao')!;
    }

    /** Índice com uma coluna cujo ParentID não corresponde a campo algum da tabela. */
    function IndiceOrfao(pColuna: string): tfx.XORMIndex
    {
        const index = new tfx.XORMIndex();
        index.ID = tfx.XGuid.NewValue();
        index.Name = 'IX_VNDxNumeracao_SYSxInquilinoID';
        index.IsUnique = true;
        Tabela().AppendChild(index);

        const coluna = new tfx.XORMIndexField();
        coluna.ID = tfx.XGuid.NewValue();
        coluna.Name = pColuna;
        coluna.ParentID = tfx.XGuid.NewValue();
        index.AppendChild(coluna);

        return index;
    }

    it('religa a coluna pelo nome e acusa a mutação, para o modelo ser salvo', () =>
    {
        const index = IndiceOrfao('SYSxInquilinoID');

        bridge.ValidateOrmModel();

        expect(index.GetIndexFields()[0].ParentID).toBe('fld-inq');
        expect(bridge.LastValidationMutated).toBe(true);
    });

    it('remove o índice que ficou sem coluna e reporta como erro', () =>
    {
        IndiceOrfao('ColunaQueSumiu');

        const issues = bridge.ValidateOrmModel();

        expect(Tabela().GetChildrenOfType(tfx.XORMIndex).length).toBe(0);
        expect(issues.some(i => i.Message.includes('has no column left'))).toBe(true);
        expect(bridge.LastValidationMutated).toBe(true);
    });

    it('não acusa mutação quando o índice está íntegro', () =>
    {
        const index = new tfx.XORMIndex();
        index.ID = tfx.XGuid.NewValue();
        index.Name = 'IX_VNDxNumeracao_SYSxInquilinoID';
        Tabela().AppendChild(index);

        const coluna = new tfx.XORMIndexField();
        coluna.ID = tfx.XGuid.NewValue();
        coluna.Name = 'SYSxInquilinoID';
        coluna.ParentID = 'fld-inq';
        index.AppendChild(coluna);

        bridge.ValidateOrmModel();

        expect(index.GetIndexFields().length).toBe(1);
        expect(bridge.LastValidationMutated).toBe(false);
    });
});
