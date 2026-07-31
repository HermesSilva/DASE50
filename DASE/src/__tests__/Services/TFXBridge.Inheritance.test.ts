import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueSeverity } from '../../Models/IssueItem';

jest.mock('vscode');

/**
 * Herança de tabela no bridge: o seletor que oferece as bases, a propriedade que grava a
 * escolha e a validação que acusa a base que não existe em modelo nenhum.
 */
describe('XTFXBridge — herança de tabela', () => {

    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    /** Modelo em memória com as tabelas pedidas, cada uma com PK e os campos dados. */
    function Montar(pTabelas: Array<{ Nome: string; Campos?: string[] }>) {
        bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [] }));
        const design = bridge.Controller.Design;

        for (const t of pTabelas) {
            const tabela = design.CreateTable({ Name: t.Nome });
            tabela.CreatePKField({ Name: `${t.Nome}ID`, DataType: 'Int64' });
            for (const campo of t.Campos ?? [])
                tabela.CreateField({ Name: campo, DataType: 'String', Length: 40 });
        }

        return design;
    }

    const Achar = (pNome: string) =>
        bridge.Controller.Design.GetTables().find((t: any) => t.Name === pNome);

    const CampoExterno = (pNome: string) => ({
        Name: pNome, Description: '', DataType: 'String', Length: 40, Scale: 0,
        IsRequired: true, IsAutoIncrement: false, DefaultValue: '', TargetTable: '', IsOneToOne: false
    });

    describe('propriedades da tabela', () => {

        it('a tabela própria mostra Inheritance e Is Model Table', () => {
            Montar([{ Nome: 'VNDxPedido' }]);

            const props = bridge.GetProperties(Achar('VNDxPedido').ID);

            expect(props.find(p => p.Key === 'Inheritance')).toBeDefined();
            expect(props.find(p => p.Key === 'IsModel')!.Value).toBe(false);
        });

        /**
         * O seletor é o mesmo do espelho: as tabelas do modelo aberto e as de cada modelo pai
         * ou importado, um grupo por arquivo — a base pode morar em outro módulo.
         */
        it('o seletor lista o modelo aberto e os modelos declarados, em grupos', () => {
            Montar([{ Nome: 'VNDxPedido' }, { Nome: 'VNDxAuditavel' }]);
            bridge.SetContextPath('/repo/VND/MER-VND.dsorm');
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'MER-BASE.dsorm', Tables: [{ Name: 'BASExRaiz', Fill: '', PKType: 'Int64', Fields: [], Inheritance: '' }] }
            ];
            (bridge as any)._ImportedModelTableGroups = [
                { ModelPath: 'Modules/SYS/MER-SYS.dsorm', Namespace: 'Tootega.SYS', Tables: [{ Name: 'SYSxAuditavel', Fill: '', PKType: 'Int64', Fields: [], Inheritance: '' }] }
            ];

            const prop = bridge.GetProperties(Achar('VNDxPedido').ID).find(p => p.Key === 'Inheritance')!;

            expect(prop.Options).toContain('SYSxAuditavel');
            expect(prop.Options).toContain('BASExRaiz');
            expect(prop.GroupedOptions!.map(g => g.Group))
                .toEqual(['MER-VND.dsorm', 'MER-BASE.dsorm', 'MER-SYS.dsorm']);
        });

        /** Nenhuma tabela é candidata a base de si mesma — oferecê-la seria oferecer um ciclo. */
        it('o seletor não oferece a própria tabela', () => {
            Montar([{ Nome: 'VNDxPedido' }, { Nome: 'VNDxAuditavel' }]);

            const prop = bridge.GetProperties(Achar('VNDxPedido').ID).find(p => p.Key === 'Inheritance')!;

            expect(prop.Options).toContain('VNDxAuditavel');
            expect(prop.Options).not.toContain('VNDxPedido');
        });

        it('a tabela espelho não ganha as propriedades de herança', () => {
            Montar([{ Nome: 'VNDxPedido' }]);
            const espelho = bridge.Controller.Design.CreateTable({ Name: 'SYSxInquilino' });
            espelho.IsShadow = true;
            espelho.ShadowTableName = 'SYSxInquilino';

            const props = bridge.GetProperties(espelho.ID);

            expect(props.find(p => p.Key === 'Inheritance')).toBeUndefined();
            expect(props.find(p => p.Key === 'IsModel')).toBeUndefined();
        });
    });

    describe('UpdateProperty', () => {

        it('grava a base escolhida', () => {
            Montar([{ Nome: 'VNDxPedido' }, { Nome: 'VNDxAuditavel' }]);

            const r = bridge.UpdateProperty(Achar('VNDxPedido').ID, 'Inheritance', 'VNDxAuditavel');

            expect(r.Success).toBe(true);
            expect(Achar('VNDxPedido').Inheritance).toBe('VNDxAuditavel');
        });

        it('grava IsModel', () => {
            Montar([{ Nome: 'VNDxAuditavel' }]);

            bridge.UpdateProperty(Achar('VNDxAuditavel').ID, 'IsModel', true);

            expect(Achar('VNDxAuditavel').IsModel).toBe(true);
        });

        /**
         * O seletor não oferece a própria tabela, mas um agente ou um arquivo editado à mão
         * chega aqui. Aceitar produziria uma cadeia que se fecha em si mesma.
         */
        it('recusa herdar de si mesma', () => {
            Montar([{ Nome: 'VNDxPedido' }]);

            const r = bridge.UpdateProperty(Achar('VNDxPedido').ID, 'Inheritance', 'vndxpedido');

            expect(r.Success).toBe(false);
            expect(r.Message).toContain('cannot inherit from itself');
            expect(Achar('VNDxPedido').Inheritance).toBe('');
        });

        it('limpar a herança volta ao vazio', () => {
            Montar([{ Nome: 'VNDxPedido' }, { Nome: 'VNDxAuditavel' }]);
            bridge.UpdateProperty(Achar('VNDxPedido').ID, 'Inheritance', 'VNDxAuditavel');

            bridge.UpdateProperty(Achar('VNDxPedido').ID, 'Inheritance', '');

            expect(Achar('VNDxPedido').Inheritance).toBe('');
        });
    });

    describe('GetExternalInheritanceTables', () => {

        it('junta modelos pai e importados, sem repetir tabela', () => {
            Montar([{ Nome: 'VNDxPedido' }]);
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'MER-BASE.dsorm', Tables: [{ Name: 'SYSxAuditavel', Fill: '', PKType: 'Int64', Fields: [CampoExterno('CriadoEm')], Inheritance: '' }] }
            ];
            (bridge as any)._ImportedModelTableGroups = [
                { ModelPath: 'Modules/SYS/MER-SYS.dsorm', Namespace: 'Tootega.SYS', Tables: [{ Name: 'SYSxAuditavel', Fill: '', PKType: 'Int64', Fields: [CampoExterno('Outro')], Inheritance: '' }] }
            ];

            const externas = bridge.GetExternalInheritanceTables();

            expect(externas.map(t => t.Name)).toEqual(['SYSxAuditavel']);
            expect(externas[0].Fields.map(f => f.Name)).toEqual(['CriadoEm']);
        });

        it('carrega os campos das tabelas de um modelo importado', async () => {
            const xml = '<?xml version="1.0" encoding="utf-8"?>' +
                '<XORMDocument ID="11111111-1111-1111-1111-111111111111" Name="M">' +
                '<XORMDesign Name="D">' +
                '<XORMTable ID="22222222-2222-2222-2222-222222222222" Name="SYSxAuditavel">' +
                '<XValues><XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">SYSxAuditavel</XData></XValues>' +
                '<XORMPKField ID="33333333-3333-3333-3333-333333333333" Name="SYSxAuditavelID"><XValues>' +
                '<XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">SYSxAuditavelID</XData>' +
                '</XValues></XORMPKField>' +
                '<XORMField ID="44444444-4444-4444-4444-444444444444" Name="CriadoEm"><XValues>' +
                '<XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">CriadoEm</XData>' +
                '</XValues></XORMField>' +
                '</XORMTable></XORMDesign></XORMDocument>';

            (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async () => Buffer.from(xml, 'utf-8'));

            bridge.SetContextPath('/repo/VND/MER-VND.dsorm');
            await bridge.LoadParentModelTables(['MER-SYS.dsorm']);

            const externas = bridge.GetExternalInheritanceTables();

            expect(externas.map(t => t.Name)).toEqual(['SYSxAuditavel']);
            expect(externas[0].Fields.map(f => f.Name)).toEqual(['CriadoEm']);
        });
    });

    describe('LoadInheritanceSources', () => {

        /** `.dsorm` mínimo: uma tabela com um campo, e o que o modelo declara. */
        function ModeloXml(pTabela: string, pCampo: string, pDeclara: { Parent?: string; Import?: string } = {}) {
            const dado = (pNome: string, pId: string, pValor: string) =>
                `<XData Name="${pNome}" ID="${pId}" Type="String">${pValor}</XData>`;

            const declaracoes = [
                pDeclara.Parent ? dado('ParentModel', 'C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20', pDeclara.Parent) : '',
                pDeclara.Import ? dado('ImportModels', '8B14C6E9-3A57-4D2B-9F60-C4E7A1B85D32', pDeclara.Import) : ''
            ].join('');

            return '<?xml version="1.0" encoding="utf-8"?>' +
                '<XORMDocument ID="11111111-1111-1111-1111-111111111111" Name="M">' +
                `<XORMDesign Name="D"><XValues>${declaracoes}</XValues>` +
                `<XORMTable ID="22222222-2222-2222-2222-2222222222${pTabela.length}0" Name="${pTabela}">` +
                `<XValues>${dado('Name', '18043B8B-C189-4FE3-A3C6-552B5C87C7CE', pTabela)}</XValues>` +
                `<XORMField ID="33333333-3333-3333-3333-3333333333${pCampo.length}0" Name="${pCampo}"><XValues>` +
                dado('Name', '18043B8B-C189-4FE3-A3C6-552B5C87C7CE', pCampo) +
                '</XValues></XORMField>' +
                '</XORMTable></XORMDesign></XORMDocument>';
        }

        function MockArquivos(pArquivos: Record<string, string>) {
            const norm = (u: any) => String(u.fsPath ?? u).replace(/\\/g, '/');
            (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async (uri: any) => {
                const k = norm(uri);
                if (!(k in pArquivos)) throw new Error('ENOENT');
                return Buffer.from(pArquivos[k], 'utf-8');
            });
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
        }

        /**
         * A herança sobe até onde a cadeia for. Uma tabela do VND pode herdar de uma do SYS,
         * que herda de uma base comum guardada num terceiro modelo — que o VND não declara,
         * nem tem por que declarar: quem depende dela é o SYS. Parar nos modelos declarados
         * deixaria a tabela gerada sem as colunas desse último nível.
         */
        it('alcança o modelo que só o modelo declarado conhece', async () => {
            MockArquivos({
                '/repo/VND/MER-SYS.dsorm': ModeloXml('SYSxAuditavel', 'CriadoEm', { Parent: 'MER-COR.dsorm' }),
                '/repo/VND/MER-COR.dsorm': ModeloXml('CORxRaiz', 'Versao')
            });

            bridge.SetContextPath('/repo/VND/MER-VND.dsorm');
            Montar([{ Nome: 'VNDxPedido' }]);
            bridge.Controller.Design.ParentModel = 'MER-SYS.dsorm';

            await bridge.LoadInheritanceSources();

            expect(bridge.GetExternalInheritanceTables().map(t => t.Name).sort())
                .toEqual(['CORxRaiz', 'SYSxAuditavel']);
        });

        it('não gira quando dois modelos se declaram um ao outro', async () => {
            MockArquivos({
                '/repo/A.dsorm': ModeloXml('TabelaA', 'CampoA', { Parent: 'B.dsorm' }),
                '/repo/B.dsorm': ModeloXml('TabelaB', 'CampoB', { Parent: 'A.dsorm' })
            });

            bridge.SetContextPath('/repo/MER.dsorm');
            Montar([{ Nome: 'VNDxPedido' }]);
            bridge.Controller.Design.ParentModel = 'A.dsorm';

            await bridge.LoadInheritanceSources();

            expect(bridge.GetExternalInheritanceTables().map(t => t.Name).sort()).toEqual(['TabelaA', 'TabelaB']);
        });

        it('segue o caminho de Import Models a partir da raiz do repositório', async () => {
            MockArquivos({ '/repo/Modules/SYS/MER-SYS.dsorm': ModeloXml('SYSxAuditavel', 'CriadoEm') });
            (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/repo') }];

            bridge.SetContextPath('/repo/Modules/VND/MER-VND.dsorm');
            Montar([{ Nome: 'VNDxPedido' }]);
            bridge.Controller.Design.ImportModels = 'Modules/SYS/MER-SYS.dsorm';

            await bridge.LoadInheritanceSources();

            expect(bridge.GetExternalInheritanceTables().map(t => t.Name)).toEqual(['SYSxAuditavel']);
        });

        it('registra o erro e segue quando um modelo da árvore não pode ser lido', async () => {
            MockArquivos({});

            bridge.SetContextPath('/repo/MER.dsorm');
            Montar([{ Nome: 'VNDxPedido' }]);
            bridge.Controller.Design.ParentModel = 'sumiu.dsorm';

            await bridge.LoadInheritanceSources();

            expect(bridge.GetExternalInheritanceTables()).toEqual([]);
        });

        it('sem caminho de contexto não lê nada', async () => {
            await bridge.LoadInheritanceSources();
            expect(bridge.GetExternalInheritanceTables()).toEqual([]);
        });
    });

    describe('ValidateOrmModel', () => {

        /**
         * O XORMValidator cala sobre um nome que não existe no documento, porque a base pode
         * morar num modelo pai ou importado. Quem lê esses arquivos é o bridge — se ele também
         * calasse, o nome errado passaria batido e a tabela sairia gerada com menos colunas do
         * que o modelo declara, defeito que só apareceria na migração.
         */
        it('acusa base que não existe em modelo nenhum', () => {
            Montar([{ Nome: 'VNDxPedido' }]);
            Achar('VNDxPedido').Inheritance = 'SYSxAuditavel';

            const issues = bridge.ValidateOrmModel();
            const erro = issues.find(i => i.Message.includes('inherits from'));

            expect(erro).toBeDefined();
            expect(erro!.Severity).toBe(XIssueSeverity.Error);
            expect(erro!.Message).toContain('SYSxAuditavel');
        });

        it('cala quando a base está num modelo declarado', () => {
            Montar([{ Nome: 'VNDxPedido' }]);
            Achar('VNDxPedido').Inheritance = 'SYSxAuditavel';
            (bridge as any)._ImportedModelTableGroups = [
                { ModelPath: 'MER-SYS.dsorm', Namespace: 'Tootega.SYS', Tables: [{ Name: 'SYSxAuditavel', Fill: '', PKType: 'Int64', Fields: [CampoExterno('CriadoEm')], Inheritance: '' }] }
            ];

            expect(bridge.ValidateOrmModel().some(i => i.Message.includes('inherits from'))).toBe(false);
        });

        it('acusa campo que colide com o herdado de outro modelo', () => {
            Montar([{ Nome: 'VNDxPedido', Campos: ['CriadoEm'] }]);
            Achar('VNDxPedido').Inheritance = 'SYSxAuditavel';
            (bridge as any)._ImportedModelTableGroups = [
                { ModelPath: 'MER-SYS.dsorm', Namespace: 'Tootega.SYS', Tables: [{ Name: 'SYSxAuditavel', Fill: '', PKType: 'Int64', Fields: [CampoExterno('CriadoEm')], Inheritance: '' }] }
            ];

            const erro = bridge.ValidateOrmModel().find(i => i.Message.includes('collides'));

            expect(erro).toBeDefined();
            expect(erro!.ElementName).toBe('CriadoEm');
            expect(erro!.Message).toContain('SYSxAuditavel');
        });

        /**
         * A colisão contra base do PRÓPRIO modelo já é acusada pelo XORMValidator, campo a
         * campo. Acusar de novo aqui poria a mesma linha duas vezes na lista de problemas.
         */
        it('não repete a colisão que o validador do TFX já acusou', () => {
            Montar([{ Nome: 'VNDxAuditavel', Campos: ['CriadoEm'] }, { Nome: 'VNDxPedido', Campos: ['CriadoEm'] }]);
            Achar('VNDxPedido').Inheritance = 'VNDxAuditavel';

            const colisoes = bridge.ValidateOrmModel().filter(i => i.Message.includes('collides'));

            expect(colisoes).toHaveLength(1);
        });

        /**
         * O ciclo que atravessa modelos só se fecha com as tabelas externas em mãos — o
         * XORMValidator vê apenas um nome que não existe no documento e cala. Sem esta
         * acusação a cadeia pararia calada e a tabela sairia com menos colunas.
         */
        it('acusa ciclo que atravessa modelos', () => {
            Montar([{ Nome: 'VNDxPedido' }]);
            Achar('VNDxPedido').Inheritance = 'SYSxAuditavel';
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxAuditavel', Fill: '', PKType: 'Int64', Fields: [], Inheritance: 'VNDxPedido' }]
            }];

            const erro = bridge.ValidateOrmModel().find(i => i.Message.includes('cycle'));

            expect(erro).toBeDefined();
            expect(erro!.Message).toContain('VNDxPedido -> SYSxAuditavel -> VNDxPedido');
        });

        it('ciclo é acusado uma vez só, pelo validador do TFX', () => {
            Montar([{ Nome: 'A' }, { Nome: 'B' }]);
            Achar('A').Inheritance = 'B';
            Achar('B').Inheritance = 'A';

            const ciclos = bridge.ValidateOrmModel().filter(i => i.Message.toLowerCase().includes('cycle'));

            expect(ciclos.length).toBeGreaterThan(0);
            expect(ciclos.every(i => !i.Message.includes('inherits from'))).toBe(true);
        });

        it('modelo sem herança não ganha problema nenhum novo', () => {
            Montar([{ Nome: 'VNDxPedido', Campos: ['Numero'] }]);

            expect(bridge.ValidateOrmModel().filter(i => i.Severity === XIssueSeverity.Error)).toEqual([]);
        });
    });
});
