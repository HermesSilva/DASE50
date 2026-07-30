import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';

jest.mock('vscode');

/** Monta uma árvore em memória para readDirectory / stat / readFile. */
function MockFS(pTree: Record<string, [string, vscode.FileType][]>, pFiles: Record<string, string> = {}) {
    const norm = (u: any) => String(u.fsPath ?? u).replace(/\\/g, '/');

    (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation(async (uri: any) => {
        const k = norm(uri);
        if (!(k in pTree)) throw new Error('ENOENT');
        return pTree[k];
    });

    (vscode.workspace.fs.stat as jest.Mock).mockImplementation(async (uri: any) => {
        const k = norm(uri);
        if (k in pTree || k in pFiles) return {};
        throw new Error('ENOENT');
    });

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async (uri: any) => {
        const k = norm(uri);
        if (!(k in pFiles)) throw new Error('ENOENT');
        return Buffer.from(pFiles[k], 'utf-8');
    });
}

const F = vscode.FileType.File;
const D = vscode.FileType.Directory;

/** Modelo mínimo válido, com uma tabela nomeada. */
function ModeloXml(pTabela: string, pNamespace = ''): string {
    const ns = pNamespace
        ? `<XData Name="Namespace" ID="E9C2A5D8-7B41-4F3E-9A6C-2D8E5B1F4C73" Type="String">${pNamespace}</XData>`
        : '';
    return '<?xml version="1.0" encoding="utf-8"?>' +
        '<XORMDocument ID="11111111-1111-1111-1111-111111111111" Name="M">' +
        `<XORMDesign Name="D"><XValues>${ns}</XValues>` +
        `<XORMTable ID="22222222-2222-2222-2222-222222222222" Name="${pTabela}">` +
        `<XValues><XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">${pTabela}</XData></XValues>` +
        '</XORMTable></XORMDesign></XORMDocument>';
}

describe('XTFXBridge — Import Models', () => {

    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    describe('LoadAvailableRepositoryModels', () => {

        it('does nothing without a context path', async () => {
            await bridge.LoadAvailableRepositoryModels();
            expect((bridge as any)._AvailableRepositoryModels).toEqual([]);
        });

        /**
         * O escopo é o repositório inteiro, não a pasta do modelo: num repositório modular
         * cada módulo guarda o seu MER na própria pasta, e importar do SYS de dentro do VND
         * exige enxergar a árvore toda.
         */
        it('scans the whole repository and skips the model itself', async () => {
            MockFS({
                '/repo': [['.git', D], ['Modules', D], ['node_modules', D]],
                '/repo/.git': [],
                '/repo/node_modules': [['Lixo.dsorm', F]],
                '/repo/Modules': [['A', D], ['B', D]],
                '/repo/Modules/A': [['MER-A.dsorm', F]],
                '/repo/Modules/B': [['MER-B.dsorm', F]]
            });

            bridge.SetContextPath('/repo/Modules/A/MER-A.dsorm');
            await bridge.LoadAvailableRepositoryModels();

            const achados = (bridge as any)._AvailableRepositoryModels as string[];
            expect(achados).toEqual(['Modules/B/MER-B.dsorm']);
        });

        it('ignores heavy folders such as node_modules and bin', async () => {
            MockFS({
                '/repo': [['.git', D], ['node_modules', D], ['bin', D], ['obj', D], ['Bom.dsorm', F]],
                '/repo/.git': [],
                '/repo/node_modules': [['Mau.dsorm', F]],
                '/repo/bin': [['Mau.dsorm', F]],
                '/repo/obj': [['Mau.dsorm', F]]
            });

            bridge.SetContextPath('/repo/Atual.dsorm');
            await bridge.LoadAvailableRepositoryModels();

            expect((bridge as any)._AvailableRepositoryModels).toEqual(['Bom.dsorm']);
        });

        it('prefers the workspace folder that contains the file', async () => {
            (vscode.workspace as any).workspaceFolders = [
                { uri: vscode.Uri.file('/outro') },
                { uri: vscode.Uri.file('/repo') }
            ];

            MockFS({
                '/repo': [['Vizinho.dsorm', F]]
            });

            bridge.SetContextPath('/repo/Atual.dsorm');
            await bridge.LoadAvailableRepositoryModels();

            expect((bridge as any)._AvailableRepositoryModels).toEqual(['Vizinho.dsorm']);
        });

        it('falls back to the model folder when there is no .git or workspace', async () => {
            MockFS({ '/solto': [['Outro.dsorm', F]] });

            bridge.SetContextPath('/solto/Atual.dsorm');
            await bridge.LoadAvailableRepositoryModels();

            expect((bridge as any)._AvailableRepositoryModels).toEqual(['Outro.dsorm']);
        });

        it('survives an unreadable directory', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('EACCES'));
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));

            bridge.SetContextPath('/repo/Atual.dsorm');
            await bridge.LoadAvailableRepositoryModels();

            expect((bridge as any)._AvailableRepositoryModels).toEqual([]);
        });
    });

    describe('LoadImportedModelTables', () => {

        it('does nothing with an empty list', async () => {
            bridge.SetContextPath('/repo/A/MER-A.dsorm');
            await bridge.LoadImportedModelTables([]);
            expect((bridge as any)._ImportedModelTableGroups).toEqual([]);
        });

        it('reads the tables and the namespace of each source', async () => {
            MockFS(
                { '/repo': [['.git', D]], '/repo/.git': [] },
                { '/repo/Modules/SYS/MER-SYS.dsorm': ModeloXml('SYSxInquilino', 'Tootega.SYS') }
            );

            bridge.SetContextPath('/repo/Modules/VND/MER-VND.dsorm');
            await bridge.LoadImportedModelTables(['Modules/SYS/MER-SYS.dsorm']);

            const grupos = (bridge as any)._ImportedModelTableGroups;
            expect(grupos).toHaveLength(1);
            expect(grupos[0].ModelPath).toBe('Modules/SYS/MER-SYS.dsorm');
            expect(grupos[0].Namespace).toBe('Tootega.SYS');
            expect(grupos[0].Tables.map((t: any) => t.Name)).toEqual(['SYSxInquilino']);
        });

        it('skips blank entries and unreadable models', async () => {
            MockFS({ '/repo': [['.git', D]], '/repo/.git': [] }, {});

            bridge.SetContextPath('/repo/A/MER-A.dsorm');
            await bridge.LoadImportedModelTables(['', 'nao/existe.dsorm']);

            expect((bridge as any)._ImportedModelTableGroups).toEqual([]);
        });

        it('skips a source model that has no tables', async () => {
            MockFS(
                { '/repo': [['.git', D]], '/repo/.git': [] },
                {
                    '/repo/Vazio.dsorm':
                        '<?xml version="1.0" encoding="utf-8"?>' +
                        '<XORMDocument ID="33333333-3333-3333-3333-333333333333" Name="V">' +
                        '<XORMDesign Name="D" /></XORMDocument>'
                }
            );

            bridge.SetContextPath('/repo/A/MER-A.dsorm');
            await bridge.LoadImportedModelTables(['Vazio.dsorm']);

            expect((bridge as any)._ImportedModelTableGroups).toEqual([]);
        });
    });

    describe('shadow picker', () => {

        /**
         * Uma tabela escolhida de um modelo importado vem de outro projeto — é o que a
         * geração transforma em Espelho, daí o ModuleName trazer o namespace da origem.
         */
        it('lists imported models with the source namespace', () => {
            (bridge as any)._ImportedModelTableGroups = [{
                ModelPath: 'Back/Modules/Tootega.SYS/MER-SYS.dsorm',
                Namespace: 'Tootega.SYS',
                Tables: [{ Name: 'SYSxInquilino', Fill: '' }]
            }];

            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [] }));

            const grupo = bridge.GetShadowTablePickerData(0, 0).Models
                .find(m => m.ModelName === 'MER-SYS.dsorm');

            expect(grupo).toBeDefined();
            expect(grupo!.ModuleName).toBe('Tootega.SYS');
            expect(grupo!.Tables.map(t => t.Name)).toEqual(['SYSxInquilino']);
        });

        it('does not list the same model twice', () => {
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'MER-SYS.dsorm', Tables: [{ Name: 'A', Fill: '' }] }
            ];
            (bridge as any)._ImportedModelTableGroups = [
                { ModelPath: 'Back/MER-SYS.dsorm', Namespace: 'X', Tables: [{ Name: 'A', Fill: '' }] }
            ];

            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [] }));

            const grupos = bridge.GetShadowTablePickerData(0, 0).Models
                .filter(m => m.ModelName === 'MER-SYS.dsorm');

            expect(grupos).toHaveLength(1);
        });
    });

    describe('Stereotype', () => {

        function TabelaSimples() {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'M',
                Tables: [{ ID: 't1', Name: 'Tbl', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            return 't1';
        }

        it('accepts Entity, Lookup and empty', () => {
            const id = TabelaSimples();

            expect(bridge.UpdateProperty(id, 'Stereotype', 'Lookup').Success).toBe(true);
            expect(bridge.UpdateProperty(id, 'Stereotype', 'Entity').Success).toBe(true);
            expect(bridge.UpdateProperty(id, 'Stereotype', '').Success).toBe(true);
        });

        /** Espelho nasce de tabela shadow e de mais nada — declarar não o cria. */
        it('refuses "Mirror"', () => {
            const id = TabelaSimples();

            const r = bridge.UpdateProperty(id, 'Stereotype', 'Mirror');

            expect(r.Success).toBe(false);
            expect(r.Message).toContain('shadow table');
        });

        it('refuses any other value', () => {
            expect(bridge.UpdateProperty(TabelaSimples(), 'Stereotype', 'Xpto').Success).toBe(false);
        });
    });
});
