import * as vscode from "vscode";
import * as path from "path";
import {
    XTypeResolver, BuildCodeModel, XCodeGenerator,
    type XIProfileSpec, type XIGeneratedFile, type XORMDataTypeInfo
} from "@tootega/tfx";
import type { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import { GetLogService } from "../../../Services/LogService";

/**
 * Geração de código ORM a partir de templates.
 *
 * O caminho é DETERMINÍSTICO: mesmo modelo e mesmos templates produzem byte a byte o mesmo
 * código. É o que permite versionar o resultado — a geração por IA que existia aqui antes
 * devolvia texto diferente a cada execução, num arquivo só, ignorando a convenção do projeto.
 *
 * Tudo que é específico da solução (namespace, raiz de saída, perfil) vem do próprio `.dsorm`;
 * os templates em `.DASE/Templates/<perfil>/` são copiáveis entre repositórios sem edição.
 */
export class XGenerateORMCodeCommand {

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void {
        pContext.subscriptions.push(
            vscode.commands.registerCommand("Dase.GenerateORMCode", async () => {
                await XGenerateORMCodeCommand.Execute(pProvider);
            })
        );
    }

    // ── resolução do .DASE ────────────────────────────────────────────────────

    /**
     * Sobe da pasta do modelo até a raiz procurando `.DASE/<relativo>`.
     * Mesma hierarquia que o XConfigurationManager usa para os arquivos de configuração.
     */
    static async FindInDase(pStartDir: string, pRelative: string): Promise<string | null> {
        let dir = pStartDir;

        for (;;) {
            const candidate = path.join(dir, ".DASE", pRelative);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
                return candidate;
            }
            catch { /* não existe neste nível */ }

            const parent = path.dirname(dir);
            if (parent === dir)
                return null;
            dir = parent;
        }
    }

    /** Perfis disponíveis: subpastas de `.DASE/Templates` que tenham `profile.json`. */
    private static async ListProfiles(pTemplatesDir: string): Promise<string[]> {
        const found: string[] = [];

        let entries: [string, vscode.FileType][];
        try { entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(pTemplatesDir)); }
        catch { return found; }

        for (const [name, type] of entries) {
            if (type !== vscode.FileType.Directory)
                continue;
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(path.join(pTemplatesDir, name, "profile.json")));
                found.push(name);
            }
            catch { /* pasta sem profile.json não é perfil */ }
        }

        return found.sort((a, b) => a.localeCompare(b));
    }

    private static async ReadText(pPath: string): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(pPath));
        return Buffer.from(bytes).toString("utf-8");
    }

    /**
     * Descobre o namespace raiz a partir da estrutura, para não obrigar a redigitar o que a
     * pasta já diz. O `Namespace` declarado no modelo continua vencendo — isto é o default.
     *
     * Ordem: prefixo comum dos projetos vizinhos (`Tootega.SYS.API`, `Tootega.SYS.Infra`, …
     * ⇒ `Tootega.SYS`), depois o nome da pasta que contém o `.dsorm`.
     */
    static async DeriveNamespace(pModelDir: string): Promise<string> {
        const projetos = await XGenerateORMCodeCommand.ListProjects(pModelDir);
        const pasta = path.basename(pModelDir);

        // Sinal mais forte: a pasta se chama como os projetos que ela contém
        // (`Tootega.ID/` com `Tootega.ID.Infra`). É a convenção de módulo do repositório.
        if (projetos.some(p => p === pasta || p.startsWith(pasta + ".")))
            return pasta;

        if (projetos.length === 1)
            return projetos[0];

        if (projetos.length > 1) {
            // Prefixo por SEGMENTOS, escolhendo o mais longo que cubra a maioria dos projetos.
            //
            // Prefixo comum de TODOS não serve: basta um projeto fora do padrão — um
            // `TID.Launcher` ao lado de sete `Tootega.ID.*` — para o comum virar "T" e o
            // código inteiro ir parar numa pasta `T.Infra`.
            const votos = new Map<string, number>();

            for (const nome of projetos) {
                const partes = nome.split(".");
                for (let i = 1; i <= partes.length; i++) {
                    const candidato = partes.slice(0, i).join(".");
                    votos.set(candidato, (votos.get(candidato) ?? 0) + 1);
                }
            }

            const minimo = Math.ceil(projetos.length / 2);
            let melhor = "";

            for (const [candidato, quantos] of votos) {
                if (quantos < minimo) continue;
                if (candidato.length > melhor.length) melhor = candidato;
            }

            if (melhor.length > 0) return melhor;
        }

        return pasta;
    }

    /** Nomes de projeto encontrados na pasta do modelo e nas filhas diretas. */
    static async ListProjects(pModelDir: string): Promise<string[]> {
        const projetos: string[] = [];

        const coletar = async (pDir: string) => {
            let entries: [string, vscode.FileType][];
            try { entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(pDir)); }
            catch { return; }

            for (const [name, type] of entries)
                if (type === vscode.FileType.File && /\.(csproj|vbproj|fsproj)$/i.test(name))
                    projetos.push(name.replace(/\.(csproj|vbproj|fsproj)$/i, ""));
        };

        await coletar(pModelDir);
        try {
            for (const [name, type] of await vscode.workspace.fs.readDirectory(vscode.Uri.file(pModelDir)))
                if (type === vscode.FileType.Directory)
                    await coletar(path.join(pModelDir, name));
        }
        catch { /* pasta ilegível */ }

        return projetos;
    }

    /**
     * Casa cada sufixo declarado pelo perfil com o projeto real correspondente:
     * `"Infra"` ⇒ `"Tootega.ID.Infra"`.
     *
     * Havendo mais de um candidato, vence o de nome mais curto — `Tootega.ID.Test` antes de
     * `Tootega.ID.Test.Integration`, que é o projeto de teste específico, não a raiz.
     */
    static MatchProjects(pProjects: string[], pSuffixes: string[]): Record<string, string> {
        const mapa: Record<string, string> = {};

        for (const sufixo of pSuffixes) {
            const candidatos = pProjects
                .filter(p => p === sufixo || p.endsWith("." + sufixo))
                .sort((a, b) => a.length - b.length || a.localeCompare(b));

            if (candidatos.length > 0) mapa[sufixo] = candidatos[0];
        }

        return mapa;
    }

    /**
     * Namespace de cada módulo dono citado por tabela espelho, lido do `.dsorm` do dono.
     * É de lá que sai o `using` da entidade espelho — o espelho herda o tipo do dono.
     */
    private static async ResolveOwnerNamespaces(
        pDoc: any,
        pModelDir: string
    ): Promise<Record<string, string>> {
        const owners: Record<string, string> = {};

        for (const table of pDoc.Design?.GetTables?.() ?? []) {
            if (!table.IsShadow)
                continue;

            const prefix = (table.Name.match(/^([A-Z]{2,4})x/) ?? [])[1];
            if (!prefix || owners[prefix])
                continue;

            // Convenção do repositório: cada módulo guarda o próprio MER ao lado do código.
            const ownerMer = path.join(path.dirname(pModelDir), `Tootega.${prefix}`, `MER-${prefix}.dsorm`);
            let resolved = table.ShadowModuleName || "";

            try {
                const text = await XGenerateORMCodeCommand.ReadText(ownerMer);
                const match = text.match(/Name="Namespace"[^>]*>([^<]+)</);
                if (match) resolved = match[1];
            }
            catch { /* sem o MER do dono, fica o que o espelho registrou */ }

            if (resolved) owners[prefix] = resolved;
        }

        return owners;
    }

    // ── execução ──────────────────────────────────────────────────────────────

    private static async Execute(pProvider: XORMDesignerEditorProvider): Promise<void> {
        const log = GetLogService();

        const state = pProvider.GetActiveState();
        if (!state) {
            vscode.window.showWarningMessage("No ORM Designer is open. Open a .dsorm file first.");
            return;
        }

        const docUri = pProvider.GetActiveUri();
        if (!docUri || docUri.scheme === "untitled") {
            vscode.window.showWarningMessage("Save the model to a file before generating code.");
            return;
        }

        const ormDoc = state.Bridge?.Document;
        const design = ormDoc?.Design;
        if (!design) {
            vscode.window.showWarningMessage("The model could not be read.");
            return;
        }

        if (design.GenerateCode === false) {
            vscode.window.showInformationMessage(
                "This model has Generate Code turned off. Enable it in the model properties to generate."
            );
            return;
        }

        const modelDir = path.dirname(docUri.fsPath);

        try {
            // ── perfil ────────────────────────────────────────────────────────
            const templatesDir = await XGenerateORMCodeCommand.FindInDase(modelDir, "Templates");
            if (!templatesDir) {
                vscode.window.showErrorMessage(
                    "No .DASE/Templates folder found above this model. Add a template profile to generate code."
                );
                return;
            }

            const profiles = await XGenerateORMCodeCommand.ListProfiles(templatesDir);
            if (profiles.length === 0) {
                vscode.window.showErrorMessage(`No template profile found in ${templatesDir} (a profile needs a profile.json).`);
                return;
            }

            const declared = (design.CodeTemplate ?? "").trim();
            let chosen = declared || profiles[0];

            if (declared && !profiles.includes(declared)) {
                vscode.window.showErrorMessage(
                    `Template profile "${declared}" not found. Available: ${profiles.join(", ")}`
                );
                return;
            }

            // Vários perfis e nenhum declarado: quem escolhe é o usuário, não a ordem alfabética.
            if (!declared && profiles.length > 1) {
                const picked = await vscode.window.showQuickPick(profiles, {
                    title: "Generate ORM Code",
                    placeHolder: "Select the template profile to use"
                });
                if (!picked) return;
                chosen = picked;
            }

            const profileDir = path.join(templatesDir, chosen);
            const profile = JSON.parse(
                await XGenerateORMCodeCommand.ReadText(path.join(profileDir, "profile.json"))
            ) as XIProfileSpec;

            const templates = new Map<string, string>();
            for (const [name, type] of await vscode.workspace.fs.readDirectory(vscode.Uri.file(profileDir)))
                if (type === vscode.FileType.File && name.endsWith(".tpl"))
                    templates.set(name, await XGenerateORMCodeCommand.ReadText(path.join(profileDir, name)));

            if (templates.size === 0) {
                vscode.window.showErrorMessage(`Profile "${chosen}" has no .tpl templates.`);
                return;
            }

            // ── tipos ─────────────────────────────────────────────────────────
            const typesPath = await XGenerateORMCodeCommand.FindInDase(modelDir, "ORM.Types.json");
            if (!typesPath) {
                vscode.window.showErrorMessage("No .DASE/ORM.Types.json found above this model.");
                return;
            }

            const types = JSON.parse(await XGenerateORMCodeCommand.ReadText(typesPath)).Types as XORMDataTypeInfo[];
            const resolver = new XTypeResolver(types, profile.Id);

            // Tipo sem mapeamento produziria código silenciosamente errado — melhor parar aqui.
            const unmapped = resolver.GetUnmappedTypes();
            if (unmapped.length > 0) {
                vscode.window.showErrorMessage(
                    `ORM.Types.json has no Mappings["${profile.Id}"] for: ${unmapped.join(", ")}`
                );
                return;
            }

            // ── geração ───────────────────────────────────────────────────────
            const owners = await XGenerateORMCodeCommand.ResolveOwnerNamespaces(ormDoc, modelDir);

            // Declarado no modelo vence; sem ele, a estrutura de pastas e projetos responde.
            const declaredNs = (design.Namespace ?? "").trim();
            const namespace = declaredNs || await XGenerateORMCodeCommand.DeriveNamespace(modelDir);

            // Projetos REAIS para os sufixos que o perfil declara. É daqui que o template tira
            // o caminho de saída e o namespace de cada arquivo — nada de concatenar à mão.
            const suffixes = profile.ProjectSuffixes ?? [];
            const projects = XGenerateORMCodeCommand.MatchProjects(
                await XGenerateORMCodeCommand.ListProjects(modelDir),
                suffixes
            );

            const naoAchados = suffixes.filter(s => !projects[s]);
            if (naoAchados.length > 0)
                log.Info(`GenerateORMCode: sem projeto para ${naoAchados.join(", ")} — usando "${namespace}.<sufixo>"`);

            const model = BuildCodeModel(ormDoc, {
                Resolver: resolver,
                OwnerNamespaces: owners,
                Namespace: namespace,
                Projects: projects,
                ProjectSuffixes: suffixes
            });

            if (!declaredNs)
                log.Info(`GenerateORMCode: namespace derivado da estrutura: "${namespace}"`);

            if (model.Tables.length === 0) {
                vscode.window.showInformationMessage("The model has no tables to generate.");
                return;
            }

            const files = new XCodeGenerator(profile, templates).Generate(model);
            const outputRoot = path.resolve(modelDir, model.OutputRoot || ".");

            const written = await XGenerateORMCodeCommand.WriteFiles(files, outputRoot);

            const summary =
                `${written.Created} created, ${written.Updated} updated, ${written.Unchanged} unchanged` +
                ` — ${model.Entities.length} entities, ${model.Lookups.length} lookups, ${model.Mirrors.length} mirrors.`;

            log.Info(`GenerateORMCode: ${files.length} files with profile "${chosen}" — ${summary}`);

            const action = await vscode.window.showInformationMessage(
                `ORM code generated — ${chosen} / ${model.Namespace}${declaredNs ? "" : " (derived)"}: ${summary}`,
                "Show Folder"
            );
            if (action === "Show Folder")
                await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outputRoot));
        }
        catch (err: any) {
            const message = err?.message ?? String(err);
            log.Error("GenerateORMCode failed", err);
            vscode.window.showErrorMessage(`ORM code generation failed: ${message}`);
        }
    }

    /**
     * Grava os arquivos, pulando os que já estão idênticos — assim regenerar não
     * marca meia centena de arquivos como modificados no controle de versão.
     */
    static async WriteFiles(
        pFiles: XIGeneratedFile[],
        pOutputRoot: string
    ): Promise<{ Created: number; Updated: number; Unchanged: number }> {
        let created = 0, updated = 0, unchanged = 0;

        for (const file of pFiles) {
            const target = vscode.Uri.file(path.join(pOutputRoot, file.Path));

            let previous: string | null = null;
            try { previous = Buffer.from(await vscode.workspace.fs.readFile(target)).toString("utf-8"); }
            catch { previous = null; }

            if (previous === file.Content) { unchanged++; continue; }

            await vscode.workspace.fs.writeFile(target, Buffer.from(file.Content, "utf-8"));
            if (previous === null) created++; else updated++;
        }

        return { Created: created, Updated: updated, Unchanged: unchanged };
    }
}
