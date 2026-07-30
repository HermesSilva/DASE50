import * as vscode from 'vscode';
import { XGenerateORMCodeCommand } from '../../../../Designers/ORM/Commands/GenerateORMCodeCommand';

jest.mock('vscode');

describe('XGenerateORMCodeCommand', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Register', () => {
        it('registers only Dase.GenerateORMCode — the AI dialog commands are gone', () => {
            const subscriptions: any[] = [];
            const provider: any = {};

            (vscode.commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });

            XGenerateORMCodeCommand.Register({ subscriptions } as any, provider);

            const registered = (vscode.commands.registerCommand as jest.Mock).mock.calls.map(c => c[0]);
            expect(registered).toEqual(['Dase.GenerateORMCode']);
            expect(registered).not.toContain('Dase.GenerateORMCodeExecute');
            expect(registered).not.toContain('Dase.ORMGenBrowseContext');
            expect(subscriptions).toHaveLength(1);
        });
    });

    describe('FindInDase', () => {
        it('walks up the tree until it finds the .DASE entry', async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockImplementation(async (uri: any) => {
                if (String(uri.fsPath).replace(/\\/g, '/') === '/repo/.DASE/Templates')
                    return {};
                throw new Error('ENOENT');
            });

            const found = await XGenerateORMCodeCommand.FindInDase('/repo/Modules/SYS', 'Templates');

            expect(found).not.toBeNull();
            expect(String(found).replace(/\\/g, '/')).toBe('/repo/.DASE/Templates');
        });

        it('returns null instead of looping forever when nothing is found', async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));

            const found = await XGenerateORMCodeCommand.FindInDase('/a/b/c', 'ORM.Types.json');

            expect(found).toBeNull();
        });
    });

    describe('DeriveNamespace', () => {

        /** Simula uma árvore de pastas/arquivos para readDirectory. */
        function MockTree(pTree: Record<string, [string, vscode.FileType][]>) {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation(async (uri: any) => {
                const key = String(uri.fsPath).replace(/\\/g, '/');
                if (!(key in pTree)) throw new Error('ENOENT');
                return pTree[key];
            });
        }

        const F = vscode.FileType.File;
        const D = vscode.FileType.Directory;

        /**
         * O caso do TootegaERP: o .dsorm mora em Tootega.SYS/, ao lado dos projetos do
         * módulo. Obrigar a redigitar "Tootega.SYS" nas propriedades seria fricção pura.
         */
        it('usa o prefixo comum dos projetos vizinhos', async () => {
            MockTree({
                '/repo/Tootega.SYS': [
                    ['MER-SYS.dsorm', F],
                    ['Tootega.SYS.API', D],
                    ['Tootega.SYS.Common', D],
                    ['Tootega.SYS.Infra', D]
                ],
                '/repo/Tootega.SYS/Tootega.SYS.API': [['Tootega.SYS.API.csproj', F]],
                '/repo/Tootega.SYS/Tootega.SYS.Common': [['Tootega.SYS.Common.csproj', F]],
                '/repo/Tootega.SYS/Tootega.SYS.Infra': [['Tootega.SYS.Infra.csproj', F]]
            });

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/Tootega.SYS')).toBe('Tootega.SYS');
        });

        /**
         * O caso que produziu pastas `T.Common/` e `T.Infra/` no Tootega.ID: um projeto fora
         * do padrão (TID.Launcher) ao lado de sete Tootega.ID.*. O prefixo comum de TODOS é
         * a letra "T" — por isso a regra é por segmentos e por maioria, nunca por prefixo
         * textual de todos.
         */
        it('ignora projeto fora do padrão em vez de degenerar o prefixo', async () => {
            MockTree({
                '/repo/Tootega.ID': [
                    ['TID.Launcher', D],
                    ['Tootega.ID.API', D],
                    ['Tootega.ID.Bench', D],
                    ['Tootega.ID.Common', D],
                    ['Tootega.ID.Infra', D],
                    ['Tootega.ID.Service', D]
                ],
                '/repo/Tootega.ID/TID.Launcher': [['TID.Launcher.csproj', F]],
                '/repo/Tootega.ID/Tootega.ID.API': [['Tootega.ID.API.csproj', F]],
                '/repo/Tootega.ID/Tootega.ID.Bench': [['Tootega.ID.Bench.csproj', F]],
                '/repo/Tootega.ID/Tootega.ID.Common': [['Tootega.ID.Common.csproj', F]],
                '/repo/Tootega.ID/Tootega.ID.Infra': [['Tootega.ID.Infra.csproj', F]],
                '/repo/Tootega.ID/Tootega.ID.Service': [['Tootega.ID.Service.csproj', F]]
            });

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/Tootega.ID')).toBe('Tootega.ID');
        });

        it('escolhe pela maioria mesmo quando a pasta não dá pista', async () => {
            MockTree({
                '/repo/modulos': [
                    ['Acme.Vendas.API.csproj', F],
                    ['Acme.Vendas.Infra.csproj', F],
                    ['Legado.Tools.csproj', F]
                ]
            });

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/modulos')).toBe('Acme.Vendas');
        });

        it('a pasta vence quando é a raiz dos projetos que contém', async () => {
            MockTree({
                '/repo/Loja': [['Loja.Dados', D]],
                '/repo/Loja/Loja.Dados': [['Loja.Dados.csproj', F]]
            });

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/Loja')).toBe('Loja');
        });

        it('com um projeto só e pasta sem relação, usa o nome do projeto', async () => {
            MockTree({
                '/repo/modelagem': [['Loja.Dados.csproj', F]]
            });

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/modelagem')).toBe('Loja.Dados');
        });

        it('não corta no meio de um segmento do nome', async () => {
            MockTree({
                '/repo/App': [['App.Core.csproj', F], ['App.Console.csproj', F]]
            });

            // Prefixo textual seria "App.Co" — o corte tem de cair no ponto.
            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/App')).toBe('App');
        });

        it('sem projeto nenhum, usa o nome da pasta', async () => {
            MockTree({ '/repo/Modelos': [['MER.dsorm', F]] });

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/Modelos')).toBe('Modelos');
        });

        it('pasta ilegível não quebra a geração', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('EACCES'));

            expect(await XGenerateORMCodeCommand.DeriveNamespace('/repo/Qualquer')).toBe('Qualquer');
        });
    });

    describe('MatchProjects', () => {

        /**
         * O template endereça o projeto REAL, não `Namespace + ".Infra"`. É o que evita o
         * caso do Tootega.ID, em que a concatenação apontava para uma pasta inexistente.
         */
        it('casa cada sufixo com o projeto correspondente', () => {
            const projetos = [
                'TID.Launcher', 'Tootega.ID.API', 'Tootega.ID.Common',
                'Tootega.ID.Infra', 'Tootega.ID.Service'
            ];

            expect(XGenerateORMCodeCommand.MatchProjects(projetos, ['Infra', 'Common']))
                .toEqual({ Infra: 'Tootega.ID.Infra', Common: 'Tootega.ID.Common' });
        });

        it('no empate escolhe o nome mais curto', () => {
            const projetos = ['App.Test.Integration', 'App.Test', 'App.Test.Unit'];

            // "App.Test" é a raiz; os outros são projetos de teste específicos.
            expect(XGenerateORMCodeCommand.MatchProjects(projetos, ['Test']))
                .toEqual({ Test: 'App.Test' });
        });

        it('omite o sufixo sem projeto, para o fallback assumir', () => {
            expect(XGenerateORMCodeCommand.MatchProjects(['Solo.Infra'], ['Infra', 'Common']))
                .toEqual({ Infra: 'Solo.Infra' });
        });

        it('aceita projeto cujo nome é o próprio sufixo', () => {
            expect(XGenerateORMCodeCommand.MatchProjects(['Infra', 'Web'], ['Infra']))
                .toEqual({ Infra: 'Infra' });
        });
    });

    describe('WriteFiles', () => {

        /**
         * Regenerar não pode reescrever arquivo idêntico: isso marcaria dezenas de arquivos
         * como modificados no controle de versão a cada geração, escondendo a mudança real.
         */
        it('skips files whose content is already identical', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('igual', 'utf-8'));

            const r = await XGenerateORMCodeCommand.WriteFiles(
                [{ Path: 'a/X.cs', Content: 'igual', ArtifactId: 'entity' }],
                '/out'
            );

            expect(r).toEqual({ Created: 0, Updated: 0, Unchanged: 1 });
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });

        it('counts a missing file as created and a differing one as updated', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async (uri: any) => {
                if (String(uri.fsPath).includes('Novo'))
                    throw new Error('ENOENT');
                return Buffer.from('antigo', 'utf-8');
            });

            const r = await XGenerateORMCodeCommand.WriteFiles(
                [
                    { Path: 'Novo.cs', Content: 'conteudo', ArtifactId: 'entity' },
                    { Path: 'Velho.cs', Content: 'novo conteudo', ArtifactId: 'entity' }
                ],
                '/out'
            );

            expect(r).toEqual({ Created: 1, Updated: 1, Unchanged: 0 });
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(2);
        });
    });
});
