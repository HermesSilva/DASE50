/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import * as path from "path";
import { XPropertyItem, XPropertyType, IPropertyOptionGroup } from "../Models/PropertyItem";
import { XIssueItem, XIssueSeverity, TIssueSeverity } from "../Models/IssueItem";
import { GetLogService } from "./LogService";
import { XVsCodeFileSystemAdapter } from "./VsCodeFileSystemAdapter";

// TFX imports - direct CommonJS import
import * as tfx from "@tootega/tfx";
import {
    XIAddTableData,
    XIAddReferenceData,
    XIAddFieldData,
    XIMoveElementData,
    XIUpdatePropertyData,
    XIRenameElementData,
    XIReorderFieldData,
    XIOperationResult,
    XElement,
    XORMDocument,
    XORMDesign,
    XORMTable,
    XORMField,
    XORMPKField,
    XORMReference,
    XORMController,
    XORMValidator,
    XPoint,
    XRect,
    XGuid,
    XSerializationEngine,
    RegisterORMElements,
    XColor,
    XConfigurationManager,
    XConfigTarget,
    XConfigGroup,
    XORMDataTypeInfo,
    XORMDataSet,
    XORMDataTuple,
    XFieldValue,
    XORMIndex,
    XORMIndexField,
    DescribeInheritableFields,
    ResolveInheritance,
    type XIExternalTable,
    type XIInheritedField
} from "@tootega/tfx";

/**
 * Tabela de um modelo EXTERNO (pai ou importado), como este bridge a mantém em cache.
 *
 * `Fill` e `PKType` servem ao espelho, que copia a aparência e o tipo da chave da origem.
 * `Fields` e `Inheritance` servem à herança: quem herda de uma tabela de outro modelo
 * precisa das colunas dela, e este cache é o único lugar onde elas existem deste lado —
 * o arquivo de origem não fica aberto.
 */
interface IExternalTableEntry {
    Name: string;
    Fill: string;
    PKType: string;
    Fields: XIInheritedField[];
    Inheritance: string;
    /** Namespace do módulo de origem — a classe base sai por ele quando a herança cruza módulos. */
    Module: string;
}

// Data interfaces for webview communication (JSON-serializable)
// These mirror TFX types but are plain objects for webview transfer

interface IFieldData {
    ID: string;
    Name: string;
    DataType: string;
    IsPrimaryKey: boolean;
    IsForeignKey?: boolean;
    IsRequired?: boolean;
    Length?: number;
    IsAutoIncrement?: boolean;
    DefaultValue?: string;
    Description?: string;
    /** Pipe-separated list of allowed values — models enum/CHECK constraints. */
    AllowedValues?: string;
}

export interface ITableData {
    ID: string;
    Name: string;
    X: number;
    Y: number;
    Width: number;
    Height: number;
    FillProp?: string;
    Description?: string;
    PKType?: string;
    IsShadow?: boolean;
    ShadowDocumentID?: string;
    ShadowDocumentName?: string;
    ShadowTableID?: string;
    ShadowTableName?: string;
    ShadowModuleID?: string;
    ShadowModuleName?: string;
    /** Tabela-modelo: não gera nada; só cede campos a quem a herda. */
    IsModel?: boolean;
    /** Nome da tabela-base cujos campos esta também gera, ou vazio. */
    Inheritance?: string;
    Fields: IFieldData[];
    SeedData?: {
        Headers: string[];
        Tuples: string[][];
    };
}

interface IReferenceData {
    ID: string;
    Name: string;
    SourceFieldID: string;
    TargetTableID: string;
    Description?: string;
    Points: Array<{ X: number; Y: number }>;
    IsOneToOne?: boolean;
}

// Legacy interface for loading old JSON files (supports both old and new field names)
interface ILegacyReferenceData {
    ID?: string;
    Name?: string;
    SourceID?: string;
    TargetID?: string;
    SourceFieldID?: string;
    TargetTableID?: string;
    Description?: string;
    Points?: Array<{ X: number; Y: number }>;
}

interface IModelData {
    DesignID?: string;
    Schema?: string;
    Tables: ITableData[];
    References: IReferenceData[];
}

// ─── Seed / fixture-data editor interfaces ─────────────────────────────────

export interface IFKOption {
    Value: string;
    Label: string;
}

export interface ISeedColumn {
    FieldID: string;
    Name: string;
    DataType: string;
    IsPrimaryKey: boolean;
    IsRequired: boolean;
    IsForeignKey: boolean;
    FKTableName?: string;
    FKOptions?: IFKOption[];
}

export interface ISeedRow {
    TupleID: string;
    /**
     * Identificador do membro do enum gerado a partir desta linha — `BRL`, `Trial`.
     *
     * Não se deriva do texto da coluna de valor: "Real brasileiro" vira `BRL`, "Período de
     * teste" vira `Trial`. Sem ele, o enum sairia com um nome inventado a partir do rótulo
     * em português, e todo código que referencia o membro deixaria de compilar.
     */
    Member: string;
    Values: Record<string, string>;
}

export interface ISeedEditorPayload {
    TableID: string;
    TableName: string;
    Columns: ISeedColumn[];
    Rows: ISeedRow[];
}

export interface ISeedRowSave {
    TupleID: string;
    /** Identificador do membro do enum. Ausente mantém o que já estava gravado. */
    Member?: string;
    Values: Record<string, string>;
}

export interface IShadowTableEntry {
    ID: string;
    Name: string;
}

// ─── Index editor interfaces ────────────────────────────────────────────────

export interface IIndexColumn {
    FieldID: string;
    Name: string;
    DataType: string;
    IsPrimaryKey: boolean;
}

export interface IIndexFieldData {
    FieldID: string;
    IsDescending: boolean;
    AllowDuplicate: boolean;
    IsIncluded: boolean;
}

export interface IIndexData {
    IndexID: string;
    Name: string;
    IsUnique: boolean;
    Filter: string;
    Fields: IIndexFieldData[];
}

export interface IIndexEditorPayload {
    TableID: string;
    TableName: string;
    Columns: IIndexColumn[];
    Indexes: IIndexData[];
}

export interface IIndexFieldSave {
    FieldID: string;
    IsDescending?: boolean;
    AllowDuplicate?: boolean;
    IsIncluded?: boolean;
}

export interface IIndexSave {
    IndexID: string;
    Name: string;
    IsUnique?: boolean;
    Filter?: string;
    Fields: IIndexFieldSave[];
}

export interface IShadowModelEntry {
    ModelName: string;
    DocumentID: string;
    DocumentName: string;
    ModuleID: string;
    ModuleName: string;
    Tables: IShadowTableEntry[];
}

export interface IShadowTablePickerData {
    X: number;
    Y: number;
    Models: IShadowModelEntry[];
}

export interface IAddShadowTablePayload {
    X: number;
    Y: number;
    ModelName: string;
    DocumentID: string;
    DocumentName: string;
    ModuleID: string;
    ModuleName: string;
    TableID: string;
    TableName: string;
}

interface IJsonData {
    Name?: string;
    Schema?: string;
    StateControlTable?: string;
    Tables?: ITableData[];
    References?: ILegacyReferenceData[];
}

export class XTFXBridge {
    private _Controller: XORMController;
    private _Validator: XORMValidator;
    private _Engine: XSerializationEngine;
    private _Initialized: boolean;
    private _ContextPath: string;
    private _AllDataTypes: string[];
    private _PKDataTypes: string[];
    private _TypeInfos: XORMDataTypeInfo[];
    private _TypesLoaded: boolean;
    private _AvailableOrmFiles: string[];
    private _ParentModelTableGroups: Array<{ ModelName: string, Tables: IExternalTableEntry[] }>;
    private _LastSyncMutated: boolean;
    private _LastValidationMutated: boolean = false;
    /** Perfis de template achados em .DASE/Templates — alimenta o combo de CodeTemplate. */
    private _AvailableTemplateProfiles: string[] = [];
    /** Modelos do repositório inteiro, menos o próprio — alimenta `Import Models`. */
    private _AvailableRepositoryModels: string[] = [];

    /**
     * Tabelas dos modelos listados em `Import Models`, um grupo por modelo.
     *
     * Alimentam o seletor de tabela espelho: uma tabela escolhida daqui vem de OUTRO
     * projeto, e é isso que a geração transforma em Espelho — entidade herdada do módulo
     * dono, com a tabela fora da migração deste módulo. `Namespace` é o do modelo de
     * origem, que o código gerado usa no `using`.
     */
    private _ImportedModelTableGroups: Array<{
        ModelPath: string;
        Namespace: string;
        Tables: IExternalTableEntry[];
    }> = [];

    /**
     * Toda tabela alcançável pela árvore de modelos declarados — inclusive as dos modelos que
     * só os modelos declarados conhecem. Existe para a herança subir até o fim da cadeia; os
     * seletores de tabela continuam mostrando apenas o que ESTE modelo declara.
     */
    private _InheritanceTableClosure: IExternalTableEntry[] = [];

    /** Fallback property hints for well-known types when config is not yet loaded. */
    private static readonly _FallbackTypeHints: Record<string, { HasLength: boolean; HasScale: boolean; CanAutoIncrement: boolean }> =
        {
            "Boolean": { HasLength: false, HasScale: false, CanAutoIncrement: false },
            "Date": { HasLength: false, HasScale: false, CanAutoIncrement: false },
            "DateTime": { HasLength: false, HasScale: false, CanAutoIncrement: false },
            "Binary": { HasLength: true, HasScale: false, CanAutoIncrement: false },
            "Guid": { HasLength: false, HasScale: false, CanAutoIncrement: false },
            "Int8": { HasLength: false, HasScale: false, CanAutoIncrement: true },
            "Int16": { HasLength: false, HasScale: false, CanAutoIncrement: true },
            "Int32": { HasLength: false, HasScale: false, CanAutoIncrement: true },
            "Int64": { HasLength: false, HasScale: false, CanAutoIncrement: true },
            "Numeric": { HasLength: true, HasScale: true, CanAutoIncrement: false },
            "String": { HasLength: true, HasScale: false, CanAutoIncrement: false },
            "Text": { HasLength: false, HasScale: false, CanAutoIncrement: false }
        };

    constructor() {
        this._Controller = null!;
        this._Validator = null!;
        this._Engine = null!;
        this._Initialized = false;
        this._ContextPath = "";
        this._AllDataTypes = [];
        this._PKDataTypes = [];
        this._TypeInfos = [];
        this._TypesLoaded = false;
        this._AvailableOrmFiles = [];
        this._ParentModelTableGroups = [];
        this._LastSyncMutated = false;
    }

    Initialize(): void {
        if (this._Initialized)
            return;

        RegisterORMElements();
        this._Controller = new XORMController();
        this._Validator = new XORMValidator();
        this._Engine = XSerializationEngine.Instance;
        this._Initialized = true;
    }

    /**
     * Set the context path for configuration file lookup
     * This should be the path to the current design file
     */
    SetContextPath(pPath: string): void {
        if (this._ContextPath !== pPath) {
            this._ContextPath = pPath;
            this._TypesLoaded = false;
        }
    }

    /**
     * Get the current context path
     */
    get ContextPath(): string {
        return this._ContextPath;
    }

    /**
     * Load data types from configuration file
     * Must be called before GetProperties if types are needed
     */
    async LoadDataTypes(): Promise<void> {
        if (this._TypesLoaded && this._AllDataTypes.length > 0)
            return;

        const manager = XConfigurationManager.GetInstance();
        manager.SetFileSystem(new XVsCodeFileSystemAdapter());

        try {
            const contextPath = this._ContextPath || process.cwd();

            const allTypes = await manager.GetORMDataTypes(contextPath);
            this._TypeInfos = allTypes;
            this._AllDataTypes = allTypes.map(t => t.TypeName).sort((a, b) => a.localeCompare(b));

            const pkTypes = await manager.GetORMPrimaryKeyTypes(contextPath);
            this._PKDataTypes = pkTypes.map(t => t.TypeName).sort((a, b) => a.localeCompare(b));

            this._TypesLoaded = true;

            GetLogService().Info(`Loaded ${this._AllDataTypes.length} data types, ${this._PKDataTypes.length} PK types from configuration`);
        }
        catch (error) {
            GetLogService().Error(`Failed to load data types: ${error}`);
            this._TypeInfos = [];
            this._AllDataTypes = ["Boolean", "DateTime", "Guid", "Int32", "String"];
            this._PKDataTypes = ["Guid", "Int32", "Int64"];
            this._TypesLoaded = true;
        }
    }

    /**
     * Force reload of data types from configuration
     * Use when configuration file has changed
     */
    async ReloadDataTypes(): Promise<void> {
        this._TypesLoaded = false;

        const manager = XConfigurationManager.GetInstance();
        manager.ClearCache();

        await this.LoadDataTypes();
    }

    /** Pastas que nunca contêm modelo e custam caro para varrer. */
    private static readonly _SkipScanDirs = new Set([
        "node_modules", "bin", "obj", ".git", ".vs", ".vscode", "dist", "out", "coverage", "packages"
    ]);

    /**
     * Raiz do repositório para a varredura de modelos: a pasta do workspace que contém o
     * arquivo, ou o diretório com `.git` subindo a partir dele. Sem nenhum dos dois, a
     * própria pasta do modelo — melhor listar pouco que varrer o disco inteiro.
     */
    private async FindRepositoryRoot(pFilePath: string): Promise<string> {
        const folders = vscode.workspace.workspaceFolders ?? [];
        const normalizado = pFilePath.replace(/\\/g, "/").toLowerCase();

        // A pasta de workspace mais específica que contenha o arquivo.
        let melhor = "";
        for (const folder of folders) {
            const raiz = folder.uri.fsPath.replace(/\\/g, "/").toLowerCase();
            if (normalizado.startsWith(raiz + "/") && raiz.length > melhor.length)
                melhor = folder.uri.fsPath;
        }
        if (melhor)
            return melhor;

        let dir = path.dirname(pFilePath);
        for (;;) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(path.join(dir, ".git")));
                return dir;
            }
            catch { /* sem .git aqui */ }

            const pai = path.dirname(dir);
            if (pai === dir)
                return path.dirname(pFilePath);
            dir = pai;
        }
    }

    /**
     * Scans the directory of the current design file and caches all other .dsorm file names found there.
     * Must be called after SetContextPath() with a non-empty context path.
     *
     * Caminhos relativos à PASTA DO MODELO — é o que a propriedade `Parent Model` usa, e
     * o que `LoadParentModelTables` espera ao resolver cada arquivo.
     */
    async LoadAvailableOrmFiles(): Promise<void> {
        this._AvailableOrmFiles = [];

        if (!this._ContextPath)
            return;

        const currentFileName = path.basename(this._ContextPath);
        const rootDir = path.dirname(this._ContextPath);

        const scanDir = async (pAbsDir: string, pRelPrefix: string): Promise<void> => {
            try {
                const dirUri = vscode.Uri.file(pAbsDir);
                const entries = await vscode.workspace.fs.readDirectory(dirUri);
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory) {
                        await scanDir(
                            path.join(pAbsDir, name),
                            pRelPrefix ? `${pRelPrefix}/${name}` : name
                        );
                    }
                    else if (type === vscode.FileType.File && name.endsWith(".dsorm")) {
                        const relPath = pRelPrefix ? `${pRelPrefix}/${name}` : name;
                        if (relPath !== currentFileName)
                            this._AvailableOrmFiles.push(relPath);
                    }
                }
            }
            catch (error) {
                GetLogService().Error(`Failed to scan directory ${pAbsDir}: ${error}`);
            }
        };

        await scanDir(rootDir, "");
        this._AvailableOrmFiles.sort((a, b) => a.localeCompare(b));
    }

    /**
     * Varre o REPOSITÓRIO inteiro e guarda todos os `.dsorm` menos o próprio — é a lista
     * que alimenta a propriedade `Import Models`.
     *
     * O escopo é o repositório, e não a pasta do modelo, porque num repositório modular
     * cada módulo guarda o seu MER na própria pasta: importar uma tabela do SYS de dentro
     * do VND exige enxergar `Back/Modules/Tootega.SYS/MER-SYS.dsorm`.
     *
     * Os caminhos aqui são relativos à RAIZ, ao contrário dos de `LoadAvailableOrmFiles`.
     */
    async LoadAvailableRepositoryModels(): Promise<void> {
        this._AvailableRepositoryModels = [];

        if (!this._ContextPath)
            return;

        const raiz = await this.FindRepositoryRoot(this._ContextPath);
        const atual = path.resolve(this._ContextPath).replace(/\\/g, "/").toLowerCase();

        const scanDir = async (pAbsDir: string, pRelPrefix: string): Promise<void> => {
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(pAbsDir));

                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory) {
                        if (XTFXBridge._SkipScanDirs.has(name.toLowerCase()))
                            continue;
                        await scanDir(
                            path.join(pAbsDir, name),
                            pRelPrefix ? `${pRelPrefix}/${name}` : name
                        );
                    }
                    else if (type === vscode.FileType.File && name.endsWith(".dsorm")) {
                        // Um modelo não importa a si mesmo. A comparação é pelo caminho
                        // absoluto: dois módulos podem ter arquivos de mesmo nome.
                        const abs = path.resolve(pAbsDir, name).replace(/\\/g, "/").toLowerCase();
                        if (abs === atual)
                            continue;

                        this._AvailableRepositoryModels.push(pRelPrefix ? `${pRelPrefix}/${name}` : name);
                    }
                }
            }
            catch (error) {
                GetLogService().Error(`Failed to scan directory ${pAbsDir}: ${error}`);
            }
        };

        await scanDir(raiz, "");
        this._AvailableRepositoryModels.sort((a, b) => a.localeCompare(b));
    }

    /**
     * Descobre os perfis de template disponíveis: subpastas de `.DASE/Templates` que
     * contenham `profile.json`. A busca sobe da pasta do modelo até a raiz do repositório,
     * como o XConfigurationManager faz com os arquivos de configuração.
     *
     * Os perfis são DESCOBERTOS, não declarados: não há arquivo listando quais existem,
     * justamente para que `.DASE/Templates` seja copiável entre repositórios sem edição.
     */
    async LoadAvailableTemplateProfiles(): Promise<void> {
        this._AvailableTemplateProfiles = [];

        if (!this._ContextPath)
            return;

        const achados = new Set<string>();
        let dir = path.dirname(this._ContextPath);

        for (;;) {
            const templatesDir = path.join(dir, ".DASE", "Templates");

            try {
                const entradas = await vscode.workspace.fs.readDirectory(vscode.Uri.file(templatesDir));

                for (const [nome, tipo] of entradas) {
                    if (tipo !== vscode.FileType.Directory)
                        continue;
                    try {
                        await vscode.workspace.fs.stat(vscode.Uri.file(path.join(templatesDir, nome, "profile.json")));
                        achados.add(nome);
                    }
                    catch { /* pasta sem profile.json não é um perfil */ }
                }
            }
            catch { /* sem .DASE/Templates neste nível */ }

            const pai = path.dirname(dir);
            if (pai === dir)
                break;
            dir = pai;
        }

        this._AvailableTemplateProfiles = [...achados].sort((a, b) => a.localeCompare(b));
    }

    /**
     * Tipo da chave primária de uma tabela, como um espelho dela deve herdá-lo.
     *
     * O campo PK vence a propriedade da tabela: `PKType` só é reconciliado com o campo
     * durante a validação, e uma origem recém-lida — de um modelo-pai, de um importado ou
     * do próprio design antes de validar — ainda pode carregar o default `Int32` enquanto
     * o campo já diz `Int16` ou `Guid`.
     */
    private PKTypeDaOrigem(pTable: XORMTable): string {
        return pTable.GetPKField()?.DataType ?? pTable.PKType;
    }

    /**
     * Congela uma tabela de modelo externo no que este modelo precisa dela: aparência e tipo
     * de chave para o espelho, campos e base declarada para a herança.
     *
     * Os campos vêm do documento de origem, que é lido uma vez e descartado — guardar o
     * objeto vivo prenderia dois designs na memória e faria uma edição lá refletir aqui
     * sem passar por validação nenhuma.
     */
    private DescreverTabelaExterna(pTable: XORMTable, pDesign: XORMDesign | null, pCaminho: string): IExternalTableEntry {
        return {
            Name: pTable.Name,
            /* istanbul ignore next — Fill is always set (default XColor.Transparent) */
            Fill: pTable.Fill?.ToString() ?? "",
            PKType: this.PKTypeDaOrigem(pTable),
            Fields: DescribeInheritableFields(pTable, pDesign),
            Inheritance: (pTable.Inheritance ?? "").trim(),
            Module: XTFXBridge.ModuloDoModelo(pDesign, pCaminho)
        };
    }

    /**
     * Namespace do módulo a que um modelo externo pertence.
     *
     * O `Namespace` declarado no `.dsorm` vence. Sem ele, responde a pasta que guarda o
     * arquivo — convenção do repositório, em que cada módulo mantém o próprio MER ao lado
     * do código (`Tootega.SYS/MER-SYS.dsorm`). É dado do disco, não palpite, e é a mesma
     * regra que resolve o namespace do dono de uma tabela espelho.
     */
    private static ModuloDoModelo(pDesign: XORMDesign | null, pCaminho: string): string {
        const declarado = (pDesign?.Namespace ?? "").trim();
        return declarado || path.basename(path.dirname(pCaminho));
    }

    /**
     * Tabelas oferecidas por qualquer seletor de TABELA do painel: as do modelo aberto,
     * depois as de cada modelo-pai e cada modelo importado, uma por grupo — a mesma árvore
     * que o seletor de tabela espelho mostra.
     *
     * Grupo que repete o nome do modelo aberto é descartado: o autor pode ter listado o
     * próprio arquivo em `Parent Model`, e a tabela apareceria duas vezes na árvore.
     *
     * @param pExcluir Nome a tirar da lista — uma tabela não é candidata a base de si mesma.
     */
    private BuildTablePickerOptions(pExcluir?: string): { Options: string[]; Groups: IPropertyOptionGroup[] } {
        /* istanbul ignore next */
        const nomeDoModelo = this._ContextPath ? path.basename(this._ContextPath) : (this._Controller?.Document?.Name ?? "Current Model");
        const excluir = (pExcluir ?? "").toLowerCase();

        /* istanbul ignore next */
        const doModelo = (this._Controller?.Design?.GetTables?.() ?? [])
            .filter((t: XORMTable) => !t.IsShadow && t.Name.toLowerCase() !== excluir)
            .map((t: XORMTable) => t.Name);

        const gruposPai = this._ParentModelTableGroups.filter(g => g.ModelName !== nomeDoModelo);

        // Modelos importados entram na mesma árvore: uma tabela de estado, de posse ou uma
        // base de herança pode morar em outro módulo tanto quanto num modelo-pai.
        const jaListados = new Set([nomeDoModelo, ...gruposPai.map(g => g.ModelName)]);
        const gruposImportados = this._ImportedModelTableGroups
            .map(g => ({ Nome: path.basename(g.ModelPath), Tables: g.Tables }))
            .filter(g => !jaListados.has(g.Nome));

        const nomesExternos = (pEntries: IExternalTableEntry[]) => pEntries
            .map(e => e.Name)
            .filter(n => n.toLowerCase() !== excluir)
            .sort((a, b) => a.localeCompare(b));

        const externas = [
            ...gruposPai.flatMap(g => nomesExternos(g.Tables)),
            ...gruposImportados.flatMap(g => nomesExternos(g.Tables))
        ];

        const groups: IPropertyOptionGroup[] = [];
        if (doModelo.length > 0)
            groups.push({ Group: nomeDoModelo, Items: [...doModelo].sort((a, b) => a.localeCompare(b)) });
        for (const grp of gruposPai)
            groups.push({ Group: grp.ModelName, Items: nomesExternos(grp.Tables) });
        for (const grp of gruposImportados)
            groups.push({ Group: grp.Nome, Items: nomesExternos(grp.Tables) });

        return {
            Options: ["", ...new Set([...doModelo, ...externas])].sort((a, b) => a.localeCompare(b)),
            Groups: groups
        };
    }

    /**
     * Carrega as tabelas de TODO modelo alcançável a partir deste: os que ele declara, os que
     * ELES declaram, e assim por diante, até fechar a árvore.
     *
     * Herança sobe até onde a cadeia for. Uma tabela deste modelo pode herdar de uma do módulo
     * SYS, que por sua vez herda de uma base comum guardada num terceiro modelo — que este aqui
     * não declara, nem tem por que declarar: quem depende dela é o SYS. Parar nos modelos
     * declarados deixaria a tabela gerada sem as colunas desse último nível, e o defeito só
     * apareceria na migração.
     *
     * Alimenta apenas a herança. Os seletores de tabela continuam oferecendo só o que o modelo
     * declara — um espelho contra origem não declarada seria um erro de validação na hora.
     */
    async LoadInheritanceSources(): Promise<void> {
        this._InheritanceTableClosure = [];

        if (!this._ContextPath)
            return;

        this.Initialize();

        const raiz = await this.FindRepositoryRoot(this._ContextPath);
        const chave = (pCaminho: string) => path.normalize(pCaminho).toLowerCase();

        const visitados = new Set<string>([chave(this._ContextPath)]);
        const porNome = new Set<string>();

        /** `ParentModel` é relativo à pasta do modelo que o declara; `ImportModels`, à raiz. */
        const declaradosPor = (pDoc: XORMDocument, pCaminho: string): string[] => {
            const design = pDoc.Design;
            /* istanbul ignore next — Design sempre existe após desserialização bem-sucedida */
            const pais = (design?.ParentModel ?? "").split("|").filter(m => m.length > 0);
            /* istanbul ignore next */
            const importados = design?.GetImportedModels?.() ?? [];

            return [
                ...pais.map(m => path.join(path.dirname(pCaminho), m)),
                ...importados.map(m => path.join(raiz, m))
            ];
        };

        const doc = this._Controller?.Document as XORMDocument | undefined;
        const fila: string[] = doc ? declaradosPor(doc, this._ContextPath) : [];

        while (fila.length > 0) {
            const caminho = fila.shift()!;
            if (visitados.has(chave(caminho)))
                continue;
            visitados.add(chave(caminho));

            try {
                const externo = await this.ReadModelDocument(caminho);
                if (!externo)
                    continue;

                /* istanbul ignore next — Design sempre existe após desserialização bem-sucedida */
                for (const table of (externo.Design?.GetTables?.() ?? []) as XORMTable[]) {
                    // Espelho não tem campos: quem tem é a original, no modelo dono — que a
                    // própria árvore alcança, porque o modelo que espelha o declara.
                    if (table.IsShadow || !table.Name || porNome.has(table.Name.toLowerCase()))
                        continue;
                    porNome.add(table.Name.toLowerCase());
                    this._InheritanceTableClosure.push(this.DescreverTabelaExterna(table, externo.Design, caminho));
                }

                fila.push(...declaradosPor(externo, caminho));
            }
            catch (error) {
                GetLogService().Error(`Failed to load inheritance source ${caminho}: ${error}`);
            }
        }
    }

    /**
     * Tabelas de todos os modelos alcançáveis, no formato que o TFX usa para resolver herança.
     *
     * Uma tabela-base pode aparecer em mais de um modelo; vence a primeira, na ordem em que os
     * modelos foram declarados — a mesma ordem que o seletor mostra.
     */
    GetExternalInheritanceTables(): XIExternalTable[] {
        const saida: XIExternalTable[] = [];
        const vistos = new Set<string>();

        const acrescentar = (pEntries: IExternalTableEntry[]) => {
            for (const entry of pEntries) {
                const chave = entry.Name.toLowerCase();
                if (vistos.has(chave))
                    continue;
                vistos.add(chave);
                saida.push({ Name: entry.Name, Fields: entry.Fields, Inheritance: entry.Inheritance, Module: entry.Module });
            }
        };

        for (const grp of this._ParentModelTableGroups)
            acrescentar(grp.Tables);
        for (const grp of this._ImportedModelTableGroups)
            acrescentar(grp.Tables);
        acrescentar(this._InheritanceTableClosure);

        return saida;
    }

    /**
     * Lê um `.dsorm` do disco como documento pronto para consulta, ou null se não der.
     *
     * Sempre passa pelo NormalizeCSharpXml, para um arquivo em formato C# (raiz `<XORMDesigner>`)
     * ser embrulhado antes da desserialização — o mesmo que LoadOrmModelFromText faz. Em arquivo
     * no formato TS a normalização não muda nada.
     */
    private async ReadModelDocument(pFilePath: string): Promise<XORMDocument | null> {
        this.Initialize();

        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(pFilePath));
        const xml = this.NormalizeCSharpXml(Buffer.from(bytes).toString("utf8"));

        const result = this._Engine?.Deserialize<XORMDocument>(xml);
        if (!result?.Success || !result.Data)
            return null;

        result.Data.Initialize();
        // Mesma migração do documento aberto: num modelo vindo do C# o tipo da PK é um GUID,
        // e o espelho herdaria o GUID em vez de "Int16".
        this.MigrateLegacyDataTypeGUIDs(result.Data);
        return result.Data;
    }

    /**
     * Loads table names from the given parent model files (relative to the current context directory).
     * Results are cached in _ParentModelTableGroups (one group per model file).
     */
    async LoadParentModelTables(pParentModels: string[]): Promise<void> {
        this._ParentModelTableGroups = [];

        if (!this._ContextPath || pParentModels.length === 0)
            return;

        const dirPath = path.dirname(this._ContextPath);
        this.Initialize();

        for (const modelName of pParentModels) {
            if (!modelName)
                continue;
            try {
                const caminho = path.join(dirPath, modelName);
                const doc = await this.ReadModelDocument(caminho);
                if (doc) {
                    /* istanbul ignore next — Design always has GetTables after successful deserialization */
                    const tables = doc.Design?.GetTables?.() ?? [];
                    const tableEntries: IExternalTableEntry[] = [];
                    for (const table of tables) {
                        if (table.Name)
                            tableEntries.push(this.DescreverTabelaExterna(table, doc.Design, caminho));
                    }
                    if (tableEntries.length > 0)
                        this._ParentModelTableGroups.push({ ModelName: modelName, Tables: tableEntries });
                }
            }
            catch (error) {
                GetLogService().Error(`Failed to load parent model tables from ${modelName}: ${error}`);
            }
        }
    }

    /**
     * Get all available data types
     */
    GetAllDataTypes(): string[] {
        return [...this._AllDataTypes];
    }

    /**
     * Get data types that can be used in primary keys
     */
    GetPKDataTypes(): string[] {
        return [...this._PKDataTypes];
    }

    get Controller(): any {
        return this._Controller;
    }

    get Document(): any {
        return this._Controller?.Document;
    }

    LoadOrmModelFromText(pText: string): XORMDocument {
        this.Initialize();

        try {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "ORM Model";

            const tryExtractReferencePointsFromXml = (xmlText: string): Map<string, XPoint[]> => {
                const pointsByRefId = new Map<string, XPoint[]>();
                // Minimal extraction of per-reference Points; this is used only as a fallback when
                // the underlying XML deserializer produces invalid point values (e.g., NaN).
                const refBlockRegex = /<XORMReference\b[^>]*\bID="([^"]+)"[^>]*>([\s\S]*?)<\/XORMReference>/g;
                let refMatch: RegExpExecArray | null;
                while ((refMatch = refBlockRegex.exec(xmlText)) !== null) {
                    const refId = refMatch[1];
                    const refBlock = refMatch[2];

                    const pointsDataMatch = /<XData\b[^>]*\bName="Points"[^>]*>([\s\S]*?)<\/XData>/m.exec(refBlock);
                    if (!pointsDataMatch)
                        continue;

                    const rawPoints = (pointsDataMatch[1] || "").trim();
                    if (!rawPoints)
                        continue;

                    const points: XPoint[] = [];
                    const pointRegex = /\{X=([^;]+);Y=([^}]+)\}/g;
                    let pointMatch: RegExpExecArray | null;
                    while ((pointMatch = pointRegex.exec(rawPoints)) !== null) {
                        const x = Number.parseFloat(pointMatch[1]);
                        const y = Number.parseFloat(pointMatch[2]);
                        if (Number.isFinite(x) && Number.isFinite(y))
                            points.push(new XPoint(x, y));
                    }

                    if (points.length > 0)
                        pointsByRefId.set(refId, points);
                }

                return pointsByRefId;
            };

            if (pText && pText.trim().length > 0) {
                const trimmedText = pText.trim();
                if (trimmedText.startsWith("<?xml") || trimmedText.startsWith("<")) {
                    const normalizedText = this.NormalizeCSharpXml(pText);
                    const result = this._Engine.Deserialize<XORMDocument>(normalizedText);
                    if (result.Success && result.Data) {
                        // Initialize the document to consolidate multiple XORMDesign instances
                        result.Data.Initialize();

                        // Migrate C# DASE4VS legacy DataType/PKType GUIDs to plain type names
                        this.MigrateLegacyDataTypeGUIDs(result.Data);
                        this._Controller.Document = result.Data;

                        // Route all lines after document is fully loaded and relationships established
                        const references = result.Data.Design?.GetReferences?.();

                        // If points were defined in the XML but deserialized into invalid values (e.g., NaN),
                        // recover them from the original XML.
                        const pointsByRefId = tryExtractReferencePointsFromXml(pText);
                        if (references && pointsByRefId.size > 0) {
                            for (const ref of references) {
                                const refId = String(ref?.ID);
                                const fallbackPoints = pointsByRefId.get(refId);
                                if (!fallbackPoints || fallbackPoints.length === 0)
                                    continue;

                                const hasInvalidPoint = Array.isArray(ref.Points)
                                    ? ref.Points.some((p: any) => !Number.isFinite(p?.X) || !Number.isFinite(p?.Y))
                                    : true;

                                if (hasInvalidPoint)
                                    ref.Points = fallbackPoints;
                            }
                        }

                        // Only route when there are missing/invalid points.
                        const shouldRoute = references?.some((ref: any) => {
                            const pts = ref?.Points;
                            if (!Array.isArray(pts) || pts.length === 0)
                                return true;
                            return pts.some((p: any) => !Number.isFinite(p?.X) || !Number.isFinite(p?.Y));
                        });

                        if (shouldRoute)
                            result.Data.Design?.RouteAllLines?.();

                        return result.Data;
                    }
                }
                else {
                    const data = JSON.parse(pText) as IJsonData;
                    this.LoadFromJson(doc, data);
                }
            }

            this._Controller.Document = doc;
            return doc;
        }
        catch (err) {
            console.error("LoadOrmModelFromText error:", err);
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "ORM Model";
            this._Controller.Document = doc;
            return doc;
        }
    }

    /**
     * Maps C# DASE4VS XDBTypes GUIDs to their canonical TS type names.
     * Source of truth: D:\Tootega\Source\DASE4VS — XDBTypes.cs
     * Unmapped C# types use the closest TS equivalent (documented inline).
     */
    private static readonly CSHARP_TYPE_GUID_MAP: ReadonlyMap<string, string> = new Map<string, string>([
        ["D6E6D29B-6496-4AB2-B7E8-7059413DB751", "Text"],         // XText
        ["8EB466C4-AD4D-490A-8076-0C757D292E1D", "Text"],         // XMemo → Text (closest)
        ["0A34C03B-458F-4BDA-BE51-22175CAAF1E0", "Date"],         // XDate
        ["6C9A2A8B-8418-4475-96DF-51F18B29F381", "DateTime"],     // XDateTime
        ["424A36CB-FD57-4FF6-ABA4-8010970352CE", "DateTime"],     // XTime → DateTime (closest)
        ["D2208B2B-71FF-4CAB-8BC5-0A3C11C44157", "DateTime"],     // XDateTimeOffset → DateTime (closest)
        ["B678215D-317B-4E8D-861A-B4F6FCA8AF45", "Binary"],       // XBinary
        ["B42D0699-00B6-4999-BD36-244B12990C2F", "Boolean"],      // XBoolean
        ["8C5DEBC0-4165-4429-B106-1554552F802E", "Guid"],         // XGuid
        ["5BD72111-603B-42E5-9488-53A4299E45EB", "Int16"],        // XInt16
        ["FAADA046-C1B9-4E89-9B64-310E272FC0CC", "Int32"],        // XInt32
        ["ADD41C4D-6BB4-49A6-856E-4CAA566DEBC2", "Int64"],        // XInt64
        ["D250B45C-AB2E-49F5-B4B9-9BD2479A725A", "Int8"],         // XInt8
        ["0B16C95D-7DB8-425F-8DFB-F0A9DBA06400", "Numeric"],      // XNumeric
        ["1F37A18E-30BF-4A5E-B35C-EE194D028FBE", "Numeric"],      // XFloat → Numeric (closest)
        ["8A656713-0DBB-4D25-9CF9-8DA0DBAD4E62", "String"],       // XString
        ["917F5BD8-4D74-4714-85C0-761F0FE4F09F", "String"],       // XSysname → String (closest)
    ]);

    /**
     * Migrates legacy C# DASE4VS DataType and PKType GUID values to plain type name strings.
     * The C# application stored DataType/PKType as Guid references to an internal type registry.
     * The TS version uses plain strings (e.g. "Int32", "String").
     * This method is called once after XML deserialization of a potentially legacy file.
     */
    private MigrateLegacyDataTypeGUIDs(pDocument: XORMDocument): void {
        const design = pDocument.Design;
        if (!design || typeof (design as any).GetTables !== "function")
            return;

        for (const table of design.GetTables()) {
            if (XTFXBridge.IsDataTypeGUID(table.PKType)) {
                const resolved = XTFXBridge.CSHARP_TYPE_GUID_MAP.get(table.PKType.toUpperCase());
                if (resolved)
                    table.PKType = resolved;
                else
                    GetLogService().Warn(`Unknown C# PKType GUID: ${table.PKType} on table "${table.Name}" — left as-is`);
            }

            for (const field of table.GetFields()) {
                if (XTFXBridge.IsDataTypeGUID(field.DataType)) {
                    const resolved = XTFXBridge.CSHARP_TYPE_GUID_MAP.get(field.DataType.toUpperCase());
                    if (resolved)
                        field.DataType = resolved;
                    else
                        GetLogService().Warn(`Unknown C# DataType GUID: ${field.DataType} on field "${field.Name}" — left as-is`);
                }
            }
        }
    }

    /**
     * Returns true when the given string looks like a GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
     * Used to distinguish legacy C# type GUIDs from plain TS type names like "Int32" or "String".
     */
    private static IsDataTypeGUID(pValue: string): boolean {
        return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(pValue);
    }

    private NormalizeCSharpXml(pXml: string): string {
        const trimmed = pXml.trim();

        // Detect optional XML declaration
        let declaration = "";
        let body = trimmed;
        if (body.startsWith("<?xml")) {
            const declEnd = body.indexOf("?>") + 2;
            declaration = body.substring(0, declEnd);
            body = body.substring(declEnd).trimStart();
        }

        // C# format: root is <XORMDesigner> without an <XORMDocument> wrapper.
        // Wrap it so the TS deserializer can produce a valid XORMDocument.
        if (!body.startsWith("<XORMDesigner"))
            return pXml;

        // Normalise XFieldValue: C# stores FieldID as XML attribute and value as text content.
        // TS model expects both as XProperty values inside <XValues>.
        // C# format:  <XFieldValue ID="AAA" FieldID="BBB">someValue</XFieldValue>
        // TS format:  <XFieldValue ID="AAA"><XValues>
        //               <XLinkData Name="FieldID" ID="3DA1B8E4-..." ElementID="BBB" TargetID="BBB"/>
        //               <XData Name="Value" ID="7A6E3F81-..." Type="String">someValue</XData>
        //             </XValues></XFieldValue>
        body = this.NormalizeFieldValues(body);

        const docID = XGuid.NewValue();
        return `${declaration}<XORMDocument ID="${docID}" Name="ORM Model">${body}</XORMDocument>`;
    }

    private NormalizeFieldValues(pXml: string): string {
        // GUIDs matching the registered XFieldValue properties in TS (both are plain Register)
        const fieldIDDataGuid = "3DA1B8E4-FA2C-4B7A-9E63-0D57C84A1F92";
        const valueDataGuid = "7A6E3F81-2B9C-4D5E-8F07-1C4D8E9A2B03";

        const convert = (pAttrs: string, pContent: string): string => {
            const idMatch = /\bID="([^"]+)"/.exec(pAttrs);
            const fieldMatch = /\bFieldID="([^"]+)"/.exec(pAttrs);

            if (!idMatch)
                return `<XFieldValue${pAttrs}>${pContent}</XFieldValue>`; // leave as-is

            const elemID = idMatch[1];
            const fieldID = fieldMatch ? fieldMatch[1] : XGuid.EmptyValue;
            const value = pContent.trim();

            return `<XFieldValue ID="${elemID}"><XValues>` +
                `<XData Name="FieldID" ID="${fieldIDDataGuid}" Type="String">${this.XmlEscape(fieldID)}</XData>` +
                `<XData Name="Value" ID="${valueDataGuid}" Type="String">${this.XmlEscape(value)}</XData>` +
                `</XValues></XFieldValue>`;
        };

        // Handle self-closing form: <XFieldValue ID="..." FieldID="..." />  (empty value)
        let result = pXml.replace(/<XFieldValue([^>]*?)\s*\/>/gs,
            (_m: string, pAttrs: string) => convert(pAttrs, ""));

        // Handle open/close form: <XFieldValue ...>VALUE</XFieldValue>
        result = result.replace(/<XFieldValue([^>]*?)>([\s\S]*?)<\/XFieldValue>/g,
            (_m: string, pAttrs: string, pContent: string) => convert(pAttrs, pContent));

        return result;
    }

    private XmlEscape(pText: string): string {
        return pText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    SaveOrmModelToText(): string {
        try {
            const doc = this._Controller?.Document;
            if (!doc)
                return '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';

            const result = this._Engine.Serialize(doc);
            if (result.Success && result.XmlOutput)
                return result.XmlOutput;

            return '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';
        }
        catch (err) {
            console.error("SaveOrmModelToText error:", err);
            return '<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />';
        }
    }

    /**
     * Whether the last call to ValidateOrmModel caused any mutation on shadow tables
     * (name or colour update). Callers can check this to decide whether to refresh the canvas.
     */
    get LastSyncMutated(): boolean {
        return this._LastSyncMutated;
    }

    /**
     * A última validação CONSERTOU alguma coisa no modelo — chave que faltava, tipo de FK
     * divergente, coluna de índice presa a um campo que não existe mais.
     *
     * Sinal separado do sync de espelhos de propósito: são causas diferentes, e juntá-las faria
     * "o espelho mudou" mentir. Quem valida precisa dos dois para redesenhar a tela e marcar o
     * documento como sujo — conserto que não chega ao arquivo volta a quebrar a geração.
     */
    get LastValidationMutated(): boolean {
        return this._LastValidationMutated;
    }

    /**
     * Synchronises every shadow table in the current design against its source.
     *
     * Same-model shadows (ShadowTableID points to a real table in the current design):
     *   - Table still exists → update Name, ShadowTableName, Fill and PKType to match.
     *   - Table removed → error issue.
     *
     * Cross-model shadows (ShadowTableID is empty / not in current design):
     *   - Parent model not in _ParentModelTableGroups → error issue.
     *   - Table name not found in the parent model group → error issue.
     *   - Table found → update Fill and PKType to match the cached entry.
     *
     * Returns extra XIssueItem[] for missing originals; structural updates are applied
     * directly to the shadow table objects. Sets _LastSyncMutated when any update is made.
     */
    private SyncShadowTables(): XIssueItem[] {
        this._LastSyncMutated = false;
        const issues: XIssueItem[] = [];
        const design = this._Controller?.Design as XORMDesign | null;
        if (!design)
            return issues;

        /* istanbul ignore next — design is null-checked above */
        const allTables: XORMTable[] = design.GetTables?.() ?? [];
        const realTables = allTables.filter((t: XORMTable) => !t.IsShadow);
        const shadowTables = allTables.filter((t: XORMTable) => t.IsShadow);

        for (const shadow of shadowTables) {
            // Try to find the original in the current design by ShadowTableID
            /* istanbul ignore next — ?? null is a type-narrowing guard; find returns undefined */
            const sameModelOriginal = shadow.ShadowTableID
                ? realTables.find((t: XORMTable) => t.ID === shadow.ShadowTableID) ?? null
                : null;

            if (sameModelOriginal) {
                // Same-model shadow: sync name, fill and PK type
                if (sameModelOriginal.Name !== shadow.ShadowTableName) {
                    shadow.Name = sameModelOriginal.Name;
                    shadow.ShadowTableName = sameModelOriginal.Name;
                    this._LastSyncMutated = true;
                }
                const srcFill = sameModelOriginal.Fill?.ToString();
                const dstFill = shadow.Fill?.ToString();
                if (srcFill && srcFill !== dstFill) {
                    shadow.Fill = XColor.Parse(srcFill);
                    this._LastSyncMutated = true;
                }

                // Espelho de tabela do próprio modelo: o tipo da chave é o da original, e não
                // uma cópia que envelhece. Trocar a PK da tabela para Int16 e deixar o espelho
                // em Int32 faria as FKs que apontam o espelho gerarem coluna de tipo diferente
                // da chave que referenciam.
                const srcPKType = this.PKTypeDaOrigem(sameModelOriginal);
                if (srcPKType !== shadow.PKType) {
                    shadow.PKType = srcPKType;
                    this._LastSyncMutated = true;
                }
            }
            else if (shadow.ShadowDocumentName) {
                // Cross-model shadow: ShadowDocumentName stores the model path without extension.
                // _ParentModelTableGroups keys include the extension — add it when looking up.
                const shadowDocName = shadow.ShadowDocumentName;
                const grp = this.FindSourceTableGroup(shadowDocName);

                if (!grp) {
                    issues.push(new XIssueItem(
                        shadow.ID,
                        shadow.Name,
                        XIssueSeverity.Error,
                        `Shadow table "${shadow.Name}" references model "${shadowDocName}" which is not listed in Parent Model or Import Models.`
                    ));
                }
                else {
                    const tableEntry = grp.Tables.find(e => e.Name === shadow.ShadowTableName);
                    if (!tableEntry) {
                        issues.push(new XIssueItem(
                            shadow.ID,
                            shadow.Name,
                            XIssueSeverity.Error,
                            `Shadow table "${shadow.Name}" references table "${shadow.ShadowTableName}" which no longer exists in model "${shadowDocName}".`
                        ));
                    }
                    else {
                        const dstFill = shadow.Fill?.ToString();
                        if (tableEntry.Fill && tableEntry.Fill !== dstFill) {
                            shadow.Fill = XColor.Parse(tableEntry.Fill);
                            this._LastSyncMutated = true;
                        }

                        // O PKType do espelho segue o da origem: é dele que as FKs apontando
                        // este espelho tiram o tipo da coluna. Sem esta reconciliação, abrir o
                        // modelo rebaixaria uma FK Guid/Int64 ao default Int32 do espelho.
                        if (tableEntry.PKType && tableEntry.PKType !== shadow.PKType) {
                            shadow.PKType = tableEntry.PKType;
                            this._LastSyncMutated = true;
                        }
                    }
                }
            }
            else {
                // Shadow with no resolvable source reference
                issues.push(new XIssueItem(
                    shadow.ID,
                    shadow.Name,
                    XIssueSeverity.Error,
                    `Shadow table "${shadow.Name}" has no valid source reference.`
                ));
            }
        }

        return issues;
    }

    /**
     * Herança cuja base mora FORA do modelo aberto.
     *
     * O XORMValidator resolve o que enxerga no documento — ciclo, espelho, colisão com base
     * do mesmo modelo — e cala sobre um nome que não existe ali, porque a base pode estar num
     * modelo pai ou importado. Quem lê esses arquivos é este bridge, então é aqui que a base
     * não encontrada vira erro e que a colisão com campo de base externa é acusada.
     *
     * Sem isto, o nome errado passava calado e a tabela saía gerada com menos colunas do que
     * o modelo declara — defeito que só aparece na migração, longe de onde foi criado.
     */
    private ValidateInheritanceSources(): XIssueItem[] {
        const issues: XIssueItem[] = [];
        const design = this._Controller?.Design as XORMDesign | null;
        if (!design)
            return issues;

        const externas = this.GetExternalInheritanceTables();

        /* istanbul ignore next — design is null-checked above */
        for (const table of (design.GetTables?.() ?? []) as XORMTable[]) {
            if (table.IsShadow || !(table.Inheritance ?? "").trim())
                continue;

            const resultado = ResolveInheritance(table, design, externas);
            const soInternas = ResolveInheritance(table, design);

            if (resultado.Cycle) {
                // Ciclo inteiramente interno é do XORMValidator, que enxerga a cadeia toda —
                // repetir aqui poria a mesma linha duas vezes na lista de problemas. Já o que
                // atravessa modelos só se fecha com as tabelas externas em mãos, e sem esta
                // linha ficaria sem dono: a cadeia pararia calada e a tabela sairia gerada
                // com menos colunas.
                if (soInternas.Cycle)
                    continue;

                issues.push(new XIssueItem(
                    table.ID,
                    table.Name,
                    XIssueSeverity.Error,
                    `Inheritance cycle: ${[table.Name, ...resultado.Chain, resultado.Cycle].join(" -> ")}.`,
                    "Inheritance"
                ));
                continue;
            }

            if (resultado.Missing) {
                issues.push(new XIssueItem(
                    table.ID,
                    table.Name,
                    XIssueSeverity.Error,
                    `Table "${table.Name}" inherits from "${resultado.Missing}", which is not in this model nor in any model listed in Parent Model or Import Models.`,
                    "Inheritance"
                ));
                continue;
            }

            // Colisão: entra só o campo que veio de FORA. O que a cadeia interna já trazia foi
            // acusado pelo XORMValidator, campo a campo — repetir aqui poria a mesma linha
            // duas vezes na lista de problemas.
            const jaAcusados = new Set(soInternas.Fields.map(f => f.Name.toLowerCase()));
            const herdados = new Set(resultado.Fields.map(f => f.Name.toLowerCase()));

            for (const campo of table.GetFields()) {
                const chave = campo.Name.toLowerCase();
                if (!herdados.has(chave) || jaAcusados.has(chave))
                    continue;

                issues.push(new XIssueItem(
                    campo.ID,
                    campo.Name,
                    XIssueSeverity.Error,
                    `Field "${campo.Name}" in table "${table.Name}" collides with the field inherited from "${resultado.Chain.join(" -> ")}".`,
                    "Name"
                ));
            }
        }

        return issues;
    }

    ValidateOrmModel(): XIssueItem[] {
        this.Initialize();

        const doc = this._Controller?.Document;
        if (!doc)
            return [];

        // Sync shadow tables first: update name/fill from source, collect missing-source errors
        const shadowIssues = this.SyncShadowTables();
        const inheritanceIssues = this.ValidateInheritanceSources();

        // Update validator with types from configuration (or defaults if not loaded)
        this._Validator.ValidPKTypes = this._PKDataTypes.length > 0 ? this._PKDataTypes : ["Guid", "Int32", "Int64"];

        const tfxIssues = this._Validator.Validate(doc);

        // O validador não só olha: cria chave que falta, acerta tipo de FK, religa ou remove
        // coluna de índice que perdeu o campo. Sem avisar aqui, o conserto ficava só na memória
        // e o documento voltava do disco com o mesmo defeito na próxima abertura.
        this._LastValidationMutated = this._Validator.Mutated;

        const issues: XIssueItem[] = [...shadowIssues, ...inheritanceIssues];

        for (const issue of tfxIssues) {
            const severity: TIssueSeverity = issue.Severity === tfx.XDesignerErrorSeverity?.Error
                ? XIssueSeverity.Error
                : XIssueSeverity.Warning;
            issues.push(new XIssueItem(
                issue.ElementID,
                issue.ElementName,
                severity,
                issue.Message,
                issue.PropertyID
            ));
        }

        return issues;
    }

    ApplyOperation(pOperation: any): any {
        return this._Controller?.ApplyOperation(pOperation);
    }

    AddTable(pX: number, pY: number, pName: string): XIOperationResult {
        this.Initialize();

        const addTableData: XIAddTableData = { X: pX, Y: pY, Name: pName };
        const result = this._Controller?.AddTable(addTableData);

        return result || { Success: false, Message: "Failed to add table." };
    }

    AddReference(pSourceTableID: string, pTargetTableID: string, pName: string, pIsOneToOne?: boolean): XIOperationResult {
        if (pIsOneToOne) {
            // 1:1 FK: link the source table's PK field directly to the target table — no new FK field created
            const sourceTable = this._Controller?.GetElementByID(pSourceTableID) as XORMTable | null;
            const pkField = sourceTable?.GetPKField?.() ?? null;
            if (!pkField)
                return { Success: false, Message: "Source table has no PK field." };

            const targetTable = this._Controller?.GetElementByID(pTargetTableID) as XORMTable | null;
            const targetName = targetTable?.Name || "Target";

            const addRefData: XIAddReferenceData = {
                SourceFieldID: pkField.ID,
                TargetTableID: pTargetTableID,
                Name: pName || `FK_${sourceTable?.Name ?? "OneToOne"}_${targetName}`
            };
            return this._Controller?.AddReference(addRefData) || { Success: false };
        }

        // Get the target table to build the FK field name
        const targetTable = this._Controller?.GetElementByID(pTargetTableID) as XORMTable | null;
        const targetName = targetTable?.Name || "Target";

        // First create the FK field in the source table
        const fkFieldName = `${targetName}ID`;

        const addFieldData: XIAddFieldData = {
            TableID: pSourceTableID,
            Name: fkFieldName
        };
        const fieldResult = this._Controller?.AddField(addFieldData);

        if (!fieldResult?.Success || !fieldResult?.ElementID)
            return { Success: false, Message: "Failed to create FK field." };

        // Now create the reference using the field ID as source
        const addRefData: XIAddReferenceData = {
            SourceFieldID: fieldResult.ElementID,
            TargetTableID: pTargetTableID,
            Name: pName || `FK_${targetName}`
        };
        return this._Controller?.AddReference(addRefData) || { Success: false };
    }

    AddField(pTableID: string, pName: string, pDataType: string): XIOperationResult {
        if (pDataType) {
            const allTypes = this.GetAllDataTypes();
            if (allTypes.length > 0 && !allTypes.includes(pDataType))
                return {
                    Success: false,
                    Message: `Invalid data type "${pDataType}". Valid types: ${allTypes.join(", ")}.`
                };
        }
        const addFieldData: XIAddFieldData = {
            TableID: pTableID,
            Name: pName,
            DataType: pDataType || undefined
        };
        return this._Controller?.AddField(addFieldData) || { Success: false };
    }

    AlignLines(): boolean {
        return this._Controller?.RouteAllLines?.() ?? false;
    }

    /**
     * Identidade da tabela que um alvo de referência representa: a tabela própria é ela
     * mesma; um espelho é a tabela de ORIGEM que ele desenha.
     *
     * O `ShadowTableID` só identifica a origem quando ela está NESTE modelo. Num espelho de
     * outro modelo não há tabela local para apontar, e `AddShadowTable` grava ali o ID do
     * próprio espelho — duas cópias do mesmo espelho ficariam com identidades diferentes.
     * Para essas, quem identifica a origem é o par modelo + tabela, comparado pelo nome do
     * arquivo porque `ParentModel` e `ImportModels` guardam o caminho a partir de raízes
     * diferentes, e a mesma origem pode chegar pelos dois.
     */
    private OrigemDoAlvo(pTable: XORMTable, pDesign: XORMDesign): string {
        if (!pTable.IsShadow)
            return pTable.ID;

        const originalLocal = pDesign.GetTables()
            .find((t: XORMTable) => !t.IsShadow && t.ID === pTable.ShadowTableID);
        if (originalLocal)
            return originalLocal.ID;

        if (!pTable.ShadowTableName)
            return "";

        const modelo = path.basename(pTable.ShadowDocumentName).replace(/\.dsorm$/i, "");
        return `${modelo}::${pTable.ShadowTableName}`;
    }

    /**
     * Re-points an existing FK reference to a different target table.
     *
     * Only allowed between tables that share the same origin — see {@link OrigemDoAlvo}.
     *
     * This permits swapping a reference between a real table and a same-model shadow
     * of it (in either direction), or between two shadows of the same origin, including
     * two copies of the same table mirrored from another model — but never re-targeting
     * to an unrelated table.
     */
    MoveReferenceTarget(pReferenceID: string, pTargetTableID: string): XIOperationResult {
        const design = this._Controller?.Design as XORMDesign | null;
        if (!design)
            return { Success: false, Message: "No design loaded." };

        const reference = design.FindReferenceByID(pReferenceID);
        if (!reference)
            return { Success: false, Message: "Reference not found." };

        const newTarget = design.FindTableByID(pTargetTableID) as XORMTable | null;
        if (!newTarget)
            return { Success: false, Message: "Target table not found." };

        const currentTarget = design.FindTableByID(reference.Target) as XORMTable | null;
        if (!currentTarget)
            return { Success: false, Message: "Current target table not found." };

        if (newTarget.ID === currentTarget.ID)
            return { Success: false, Message: "The reference already targets this table." };

        const currentOrigin = this.OrigemDoAlvo(currentTarget, design);
        const newOrigin = this.OrigemDoAlvo(newTarget, design);

        if (!currentOrigin || !newOrigin || currentOrigin !== newOrigin)
            return {
                Success: false,
                Message: `Cannot move target: "${newTarget.Name}" does not share the same origin as "${currentTarget.Name}".`
            };

        reference.Target = pTargetTableID;
        return { Success: true };
    }

    SuspendRouting(): void {
        this._Controller?.Design?.SuspendRouting?.();
    }

    ResumeRouting(pRouteIfDirty: boolean = true): void {
        this._Controller?.Design?.ResumeRouting?.(pRouteIfDirty);
    }

    /**
     * Acha o grupo de tabelas de um modelo de origem, olhando tanto os modelos-pai quanto
     * os importados.
     *
     * As duas listas usam chaves diferentes — `ParentModel` guarda o caminho relativo à
     * pasta do modelo, `ImportModels` o caminho relativo à raiz do repositório —, então a
     * comparação aceita o caminho inteiro ou só o nome do arquivo. Sem isso, um espelho
     * vindo de `Import Models` seria tratado como origem inexistente.
     */
    private FindSourceTableGroup(pKey: string): { Tables: IExternalTableEntry[] } | undefined {
        if (!pKey)
            return undefined;

        const comExtensao = pKey.endsWith(".dsorm") ? pKey : `${pKey}.dsorm`;
        const soNome = path.basename(comExtensao);

        return this._ParentModelTableGroups.find(g => g.ModelName === comExtensao)
            ?? this._ImportedModelTableGroups.find(g => g.ModelPath === comExtensao)
            ?? this._ParentModelTableGroups.find(g => path.basename(g.ModelName) === soNome)
            ?? this._ImportedModelTableGroups.find(g => path.basename(g.ModelPath) === soNome);
    }

    /**
     * Carrega as tabelas dos modelos declarados em `Import Models`.
     *
     * Os caminhos são relativos à RAIZ DO REPOSITÓRIO — ao contrário dos de `ParentModel`,
     * que são relativos à pasta do modelo. Guarda também o `Namespace` de cada origem, que
     * é o que o código gerado precisa para referenciar a entidade do módulo dono.
     */
    async LoadImportedModelTables(pModels: string[]): Promise<void> {
        this._ImportedModelTableGroups = [];

        if (!this._ContextPath || pModels.length === 0)
            return;

        const raiz = await this.FindRepositoryRoot(this._ContextPath);
        this.Initialize();

        for (const relativo of pModels) {
            if (!relativo)
                continue;

            try {
                const caminho = path.join(raiz, relativo);
                const doc = await this.ReadModelDocument(caminho);
                if (!doc)
                    continue;

                const design = doc.Design;

                // Só tabelas próprias: o espelho de um espelho não faz sentido — a tabela
                // pertence a um terceiro módulo, e é dele que ela deve ser importada.
                const tables = (design?.GetTables?.() ?? []).filter((t: XORMTable) => !t.IsShadow);
                const entries = tables
                    .filter((t: XORMTable) => t.Name)
                    .map((t: XORMTable) => this.DescreverTabelaExterna(t, design, caminho));

                if (entries.length === 0)
                    continue;

                this._ImportedModelTableGroups.push({
                    ModelPath: relativo,
                    Namespace: design?.Namespace ?? "",
                    Tables: entries
                });
            }
            catch (error) {
                GetLogService().Error(`Failed to load imported model ${relativo}: ${error}`);
            }
        }
    }

    /**
     * Builds the tree of available tables for the shadow table picker.
     * Includes the current model's own tables (as the first group),
     * then one group per parent model previously loaded into _ParentModelTableGroups.
     */
    GetShadowTablePickerData(pX: number, pY: number): IShadowTablePickerData {
        this.Initialize();

        const models: IShadowModelEntry[] = [];

        // Current model
        const currentModelName = this._ContextPath
            ? path.basename(this._ContextPath)
            : /* istanbul ignore next */ (this._Controller?.Document?.Name ?? "Current Model");
        /* istanbul ignore next */
        const currentDocumentName = this._Controller?.Document?.Name ?? "";
        /* istanbul ignore next */
        const currentTables = this._Controller?.Design?.GetTables?.()?.filter((t: XORMTable) => !t.IsShadow) ?? [];
        if (currentTables.length > 0) {
            const docId = this._Controller?.Document?.ID ?? /* istanbul ignore next */ XGuid.NewValue();
            models.push({
                ModelName: currentModelName,
                DocumentID: docId,
                DocumentName: currentDocumentName,
                ModuleID: "",
                ModuleName: "",
                Tables: currentTables.map((t: XORMTable) => ({ ID: t.ID, Name: t.Name }))
                    .sort((a: IShadowTableEntry, b: IShadowTableEntry) => a.Name.localeCompare(b.Name))
            });
        }

        // Parent models — skip any group whose name matches the current model (avoid duplicates)
        for (const grp of this._ParentModelTableGroups) {
            if (grp.ModelName === currentModelName)
                continue;
            models.push({
                ModelName: grp.ModelName,
                DocumentID: "",
                DocumentName: grp.ModelName.replace(/\.dsorm$/i, ""),
                ModuleID: "",
                ModuleName: "",
                Tables: grp.Tables.map(e => ({ ID: "", Name: e.Name }))
                    .sort((a: IShadowTableEntry, b: IShadowTableEntry) => a.Name.localeCompare(b.Name))
            });
        }

        // Modelos importados (`Import Models`). Uma tabela escolhida aqui vem de outro
        // projeto, e é o que a geração transforma em Espelho — daí o ModuleName vir
        // preenchido com o namespace da origem.
        const jaListados = new Set(models.map(m => m.ModelName));

        for (const grp of this._ImportedModelTableGroups) {
            const nome = path.basename(grp.ModelPath);
            if (jaListados.has(nome))
                continue;
            jaListados.add(nome);

            models.push({
                ModelName: nome,
                DocumentID: "",
                DocumentName: grp.ModelPath.replace(/\.dsorm$/i, ""),
                ModuleID: "",
                ModuleName: grp.Namespace,
                Tables: grp.Tables.map(e => ({ ID: "", Name: e.Name }))
                    .sort((a: IShadowTableEntry, b: IShadowTableEntry) => a.Name.localeCompare(b.Name))
            });
        }

        return { X: pX, Y: pY, Models: models };
    }

    /**
     * Creates a Shadow Table in the current design.
     * A shadow table is a read-only placeholder that references a table from another (or the same) model.
     * It is used as a FK target for code-generation purposes.
     */
    AddShadowTable(pPayload: IAddShadowTablePayload): XIOperationResult {
        this.Initialize();

        const design = this._Controller?.Design;
        if (!design)
            return { Success: false, Message: "No active design." };

        // Allow duplicate shadow tables that reference the same source.

        // Create the table at the target position
        const table = design.CreateTable({
            X: pPayload.X,
            Y: pPayload.Y,
            Width: 200,
            Height: 28,
            Name: pPayload.TableName
        });

        table.IsShadow = true;
        table.ShadowDocumentID = pPayload.DocumentID || XGuid.NewValue();
        table.ShadowDocumentName = pPayload.DocumentName;
        table.ShadowTableID = pPayload.TableID || table.ID;
        table.ShadowTableName = pPayload.TableName;
        table.ShadowModuleID = pPayload.ModuleID || "";
        table.ShadowModuleName = pPayload.ModuleName || "";

        // Inherit the original table's fill color so the shadow visually matches its source
        const originalInDesign = pPayload.TableID
            ? design.GetTables().find((t: XORMTable) => t.ID === pPayload.TableID && !t.IsShadow)
            : null;
        if (originalInDesign) {
            /* istanbul ignore next — Fill is always set (default XColor.Transparent) */
            const fillStr = originalInDesign.Fill?.ToString();
            /* istanbul ignore next — fillStr is always truthy since Fill defaults to XColor.Transparent */
            if (fillStr)
                table.Fill = XColor.Parse(fillStr);
            table.PKType = this.PKTypeDaOrigem(originalInDesign);
        }
        else {
            // Cor e PKType herdados da tabela de origem, seja ela de um modelo-pai ou importado.
            // pPayload.DocumentName vem sem a extensão e por isso não casa sozinho —
            // ModelName é a chave preferida.
            //
            // O PKType não é enfeite: uma FK que aponta o espelho toma dele o tipo da coluna,
            // e o default (Int32) transformaria em `int` uma chave Guid ou Int64 do módulo dono.
            const docName = pPayload.ModelName || pPayload.DocumentName;
            const grp = this.FindSourceTableGroup(docName);
            const entry = grp?.Tables.find(e => e.Name === pPayload.TableName);
            if (entry?.Fill)
                table.Fill = XColor.Parse(entry.Fill);
            if (entry?.PKType)
                table.PKType = entry.PKType;
        }

        // Shadow tables are locked and cannot be renamed or deleted accidentally
        table.IsLocked = false; // allow drag/delete but not rename

        // Route lines after structural change
        design.RouteAllLines?.();

        return { Success: true, ElementID: table.ID };
    }

    DeleteElement(pElementID: string): XIOperationResult {
        return this._Controller?.RemoveElement(pElementID) || { Success: false };
    }

    RenameElement(pElementID: string, pNewName: string): XIOperationResult {
        const renameData: XIRenameElementData = {
            ElementID: pElementID,
            NewName: pNewName
        };
        return this._Controller?.RenameElement(renameData) || { Success: false };
    }

    MoveElement(pElementID: string, pX: number, pY: number): XIOperationResult {
        const moveData: XIMoveElementData = {
            ElementID: pElementID,
            X: pX,
            Y: pY
        };
        return this._Controller?.MoveElement(moveData) || { Success: false };
    }

    ReorderField(pFieldID: string, pNewIndex: number): XIOperationResult {
        const reorderData: XIReorderFieldData = {
            FieldID: pFieldID,
            NewIndex: pNewIndex
        };
        return this._Controller?.ReorderField(reorderData) || { Success: false };
    }

    /**
     * Acha o elemento de uma leitura ou escrita de propriedade.
     *
     * O MODELO é um elemento como os outros, só que sem identidade própria: `XORMDesign`
     * nunca grava o seu ID, então ele vale o GUID vazio em toda carga. Num documento
     * recém-criado o `XORMDocument` também está com o ID vazio, e a busca recursiva
     * começa por ele — o modelo ficava inalcançável, e a escrita caía num elemento que
     * não aceita propriedade nenhuma.
     *
     * Daí as duas correções aqui: o documento sempre redireciona para o design, e
     * `"model"` (ou `"design"`) vale como identificador, que é o que um agente tem em
     * mãos — o modelo não aparece em nenhuma listagem de IDs.
     */
    private ResolvePropertyTarget(pElementID: string): XElement | null {
        const design = this._Controller?.Design ?? null;
        const chave = (pElementID ?? "").trim().toLowerCase();

        if (chave === "model" || chave === "design" || chave === XGuid.EmptyValue.toLowerCase())
            return design;

        const element = this._Controller?.GetElementByID(pElementID) ?? null;
        if (element instanceof XORMDocument)
            return design;
        return element;
    }

    /**
     * Chaves aceitas por `UpdateProperty`, por tipo de elemento — o que a mensagem de erro
     * mostra quando a chave não existe, para o autor da chamada se corrigir sem adivinhar.
     */
    private static readonly _PropertyKeys = {
        Model: "Name, Schema, ParentModel, ImportModels, StateControlTable, TenantControlTable, GenerateCode, CodeTemplate, Namespace, OutputRoot",
        Table: "Name, PKType, Description, Fill, X, Y, Width, Height, UseStateControl, GenerateCode, Stereotype, IsModel, Inheritance",
        Field: "Name, DataType, Length, Scale, IsRequired, IsAutoIncrement, DefaultValue, AllowedValues, ValueGeneratedNever, Description",
        Reference: "Name, Description"
    };

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): XIOperationResult {
        this.Initialize();

        const element = this.ResolvePropertyTarget(pElementID);
        if (!element)
            return { Success: false, Message: "Element not found." };

        // A chave é o rótulo sem espaços — "Import Models" é a propriedade "ImportModels".
        // Quem lê a grade de propriedades vê o rótulo, e era com ele que a escrita falhava.
        const chave = pPropertyKey.replace(/\s+/g, "");

        // Directly set known properties instead of using SetValueByKey
        // This avoids key mismatch issues with the property registry
        if (chave === "Name") {
            // Shadow tables cannot be renamed
            if (element instanceof XORMTable && element.IsShadow)
                return { Success: false, Message: "Shadow tables are read-only." };
            element.Name = pValue as string;
        }
        else if (element instanceof XORMTable) {
            // All property edits are blocked on shadow tables
            if (element.IsShadow)
                return { Success: false, Message: "Shadow tables are read-only." };

            switch (chave) {
                case "PKType":
                    element.PKType = pValue as string;
                    break;
                case "GenerateCode":
                    element.GenerateCode = pValue as boolean;
                    break;
                case "Stereotype": {
                    // Espelho não se declara: nasce de tabela shadow e de mais nada.
                    const papel = String(pValue ?? "").trim();
                    if (papel !== "" && papel !== "Entity" && papel !== "Lookup")
                        return { Success: false, Message: `Stereotype must be "Entity", "Lookup" or empty (a mirror comes only from a shadow table).` };
                    element.Stereotype = papel;
                    break;
                }
                case "IsModel":
                    element.IsModel = pValue as boolean;
                    break;
                case "Inheritance": {
                    const base = String(pValue ?? "").trim();
                    // Herdar de si mesma não é ciclo raro nem caso de borda: é o erro que o
                    // seletor já evita, e que só chega aqui por agente ou arquivo editado à mão.
                    if (base.toLowerCase() === element.Name.toLowerCase())
                        return { Success: false, Message: `Table ${element.Name} cannot inherit from itself.` };
                    element.Inheritance = base;
                    break;
                }
                case "Description":
                    element.Description = pValue as string;
                    break;
                case "Fill":
                    if (typeof pValue === "string")
                        element.Fill = XColor.Parse(pValue);
                    else if (pValue instanceof XColor)
                        element.Fill = pValue;
                    break;
                case "X":
                case "Y":
                case "Width":
                case "Height":
                    const bounds = element.Bounds;
                    const newBounds = new XRect(
                        chave === "X" ? (pValue as number) : bounds.Left,
                        chave === "Y" ? (pValue as number) : bounds.Top,
                        chave === "Width" ? (pValue as number) : bounds.Width,
                        chave === "Height" ? (pValue as number) : bounds.Height
                    );
                    element.Bounds = newBounds;
                    break;
                case "UseStateControl":
                    {
                        const design = this._Controller?.Design;
                        /* istanbul ignore next -- design cannot be null if element was found */
                        if (!design)
                            return { Success: false, Message: "No active design." };
                        if (pValue === true) {
                            const enableResult = design.EnableStateControl(element);
                            if (!enableResult.Success)
                                return { Success: false, Message: enableResult.Message };

                            if (enableResult.ShadowTableCreated && enableResult.ShadowTableID) {
                                const shadowTable = design.FindTableByID(enableResult.ShadowTableID);
                                /* istanbul ignore else — FindTableByID always finds the table just created by EnableStateControl */
                                if (shadowTable) {
                                    const stateTableName = design.StateControlTable;

                                    // A tabela de estado pode vir de um modelo-pai ou de um
                                    // importado — procura nas duas listas.
                                    const daPai = this._ParentModelTableGroups
                                        .find(/* istanbul ignore next */ g => g.Tables.some(e => e.Name === stateTableName));
                                    const daImportada = daPai ? undefined : this._ImportedModelTableGroups
                                        .find(/* istanbul ignore next */ g => g.Tables.some(e => e.Name === stateTableName));

                                    const grp = daPai
                                        ? { Caminho: daPai.ModelName, Tables: daPai.Tables }
                                        : daImportada
                                            ? { Caminho: daImportada.ModelPath, Tables: daImportada.Tables }
                                            : null;

                                    /* istanbul ignore next — grp found only when a source model has matching StateControlTable */
                                    if (grp) {
                                        shadowTable.ShadowDocumentName = grp.Caminho.replace(/\.dsorm$/i, "");
                                        const entry = grp.Tables.find(e => e.Name === stateTableName);
                                        /* istanbul ignore next — entry.Fill requires specific shadow config */
                                        if (entry && entry.Fill) {
                                            shadowTable.Fill = XColor.Parse(entry.Fill);
                                        }

                                        // O campo de estado nasceu com o PKType default do espelho,
                                        // porque a origem só é conhecida aqui. Herdar o tipo agora
                                        // reescreve o campo: o setter de PKType propaga para toda FK
                                        // que aponta este espelho, e a de estado é uma delas.
                                        if (entry && entry.PKType)
                                            shadowTable.PKType = entry.PKType;
                                    }
                                }
                            }
                        }
                        else
                            design.DisableStateControl(element);
                        design.RouteAllLines?.();
                        break;
                    }
                default:
                    return { Success: false, Message: `Unknown property "${pPropertyKey}". A table accepts: ${XTFXBridge._PropertyKeys.Table}.` };
            }
        }
        else if (element instanceof XORMReference) {
            switch (chave) {
                case "Description":
                    element.Description = pValue as string;
                    break;
                default:
                    return { Success: false, Message: `Unknown property "${pPropertyKey}". A reference accepts: ${XTFXBridge._PropertyKeys.Reference}.` };
            }
        }
        else if (element instanceof XORMField) {
            switch (chave) {
                case "DataType":
                    // Block DataType changes on FK fields
                    if (element.IsForeignKey)
                        return { Success: false, Message: "Cannot change DataType of a foreign key field." };
                    element.DataType = pValue as string;
                    break;
                case "Length":
                    element.Length = pValue as number;
                    break;
                case "Scale":
                    element.Scale = pValue as number;
                    break;
                case "IsRequired":
                    element.IsRequired = pValue as boolean;
                    break;
                case "IsPrimaryKey":
                    return { Success: false, Message: "Primary key is structural (XORMPKField) and cannot be edited." };
                case "IsAutoIncrement":
                    element.IsAutoIncrement = pValue as boolean;
                    break;
                case "DefaultValue":
                    element.DefaultValue = pValue as string;
                    break;
                case "AllowedValues":
                    if (element.IsAutoIncrement)
                        return { Success: false, Message: "AllowedValues cannot be set on an auto-increment field." };
                    element.AllowedValues = pValue as string;
                    break;
                // Fora da grade de propriedades porque o desenho não a revela: quem sabe que
                // a chave chega pronta da aplicação é o código existente, e é de lá que ela
                // entra no modelo. Escrevível assim mesmo — a alternativa era editar o XML.
                case "ValueGeneratedNever":
                    element.ValueGeneratedNever = pValue as boolean;
                    break;
                case "Description":
                    element.Description = pValue as string;
                    break;
                default:
                    return { Success: false, Message: `Unknown property "${pPropertyKey}". A field accepts: ${XTFXBridge._PropertyKeys.Field}.` };
            }
        }
        else if (element instanceof XORMDesign) {
            switch (chave) {
                case "Schema":
                    element.Schema = pValue as string;
                    break;
                case "ParentModel":
                    element.ParentModel = pValue as string;
                    // Fire-and-forget: reload parent model tables when selection changes
                    {
                        const selected = (pValue as string).split("|").filter(f => f.length > 0);
                        this.LoadParentModelTables(selected).catch(err =>
                            GetLogService().Error(`Parent model table reload failed: ${err}`)
                        );
                        this.LoadInheritanceSources().catch(err =>
                            GetLogService().Error(`Inheritance source reload failed: ${err}`)
                        );
                    }
                    break;
                case "ImportModels":
                    element.ImportModels = pValue as string;
                    // Recarrega as tabelas das origens: são elas que o seletor de tabela
                    // espelho oferece logo depois.
                    this.LoadImportedModelTables(element.GetImportedModels()).catch(err =>
                        GetLogService().Error(`Imported model reload failed: ${err}`)
                    );
                    // E a árvore inteira atrás delas, que é até onde a herança sobe.
                    this.LoadInheritanceSources().catch(err =>
                        GetLogService().Error(`Inheritance source reload failed: ${err}`)
                    );
                    break;
                case "StateControlTable":
                    element.StateControlTable = pValue as string;
                    break;
                case "TenantControlTable":
                    element.TenantControlTable = pValue as string;
                    break;
                case "GenerateCode":
                    element.GenerateCode = pValue as boolean;
                    break;
                case "CodeTemplate":
                    element.CodeTemplate = pValue as string;
                    break;
                case "Namespace":
                    element.Namespace = pValue as string;
                    break;
                case "OutputRoot":
                    element.OutputRoot = pValue as string;
                    break;
                default:
                    return { Success: false, Message: `Unknown property "${pPropertyKey}". The model accepts: ${XTFXBridge._PropertyKeys.Model}.` };
            }
        }
        // Nenhum ramo reconheceu o elemento: dizer que deu certo aqui é pior do que falhar,
        // porque quem chamou grava a resposta como feito e o valor nunca foi para lugar nenhum.
        else
            return { Success: false, Message: `Element "${element.Name || pElementID}" does not accept property edits.` };

        return { Success: true, ElementID: pElementID };
    }

    private static readonly _GroupOrder: Record<string, number> =
        {
            "Identity": 1,
            "Data": 2,
            "Behaviour": 3,
            "Appearance": 4,
            "Design": 5,
            "Control": 6,
            "Test": 7,
            "CodeGen": 8,
            "General": 99
        };

    private GetGroupOrder(pGroup: string | undefined): number {
        const groupName = pGroup ?? "General";
        const order = XTFXBridge._GroupOrder[groupName];
        if (order === undefined)
            return 99;
        return order;
    }

    private SortProperties(pProps: XPropertyItem[]): XPropertyItem[] {
        return pProps.sort((a, b) => {
            const grpA = this.GetGroupOrder(a.Group);
            const grpB = this.GetGroupOrder(b.Group);
            if (grpA !== grpB)
                return grpA - grpB;
            return a.Name.localeCompare(b.Name);
        });
    }

    /** Returns the XORMDataTypeInfo for the given type name, using loaded config if available or static fallback otherwise. */
    private GetEffectiveTypeInfo(pTypeName: string): { HasLength: boolean; HasScale: boolean; CanAutoIncrement: boolean } {
        for (const info of this._TypeInfos)
            if (info.TypeName === pTypeName)
                return info;
        return XTFXBridge._FallbackTypeHints[pTypeName] ?? { HasLength: false, HasScale: false, CanAutoIncrement: false };
    }

    /** Resolves a field ID to a friendly "TableName.FieldName" display string. */
    private ResolveFieldFriendlyName(pFieldID: string): string {
        if (!pFieldID || !this._Controller)
            return pFieldID;
        const field = this._Controller.GetElementByID(pFieldID);
        if (!field)
            return pFieldID;
        const table = field.ParentNode as XElement | null;
        if (table && table.Name)
            return `${table.Name}.${field.Name}`;
        return field.Name;
    }

    /** Resolves a table ID to its display name. */
    private ResolveTableFriendlyName(pTableID: string): string {
        if (!pTableID || !this._Controller)
            return pTableID;
        const table = this._Controller.GetElementByID(pTableID);
        return table?.Name ?? pTableID;
    }

    GetProperties(pElementID: string): XPropertyItem[] {
        this.Initialize();

        const element = this.ResolvePropertyTarget(pElementID);
        if (!element)
            return [];

        const props: XPropertyItem[] = [];

        // Name is always shown and editable for all elements
        const nameProp = new XPropertyItem("Name", "Name", element.Name, XPropertyType.String, undefined, "Identity");
        if (element instanceof XORMDesign)
            nameProp.Placeholder = "e.g. SalesModel";
        else if (element instanceof XORMTable)
            nameProp.Placeholder = "e.g. Customer";
        else
            nameProp.Placeholder = "e.g. CustomerName";
        nameProp.Hint = "Used to generate the class and database table/column name.";
        props.push(nameProp);

        if (element instanceof XORMDesign) {
            const schemaProp = new XPropertyItem("Schema", "Schema", element.Schema, XPropertyType.String, undefined, "Data");
            schemaProp.Placeholder = "e.g. dbo";
            schemaProp.Hint = "Database schema that owns this model's tables (e.g. dbo, public, sales).";
            props.push(schemaProp);

            // Parent model: multi-select from .dsorm files in the same directory
            const parentModelProp = new XPropertyItem("ParentModel", "Parent Model", element.ParentModel, XPropertyType.MultiFileSelect, this._AvailableOrmFiles.length > 0 ? this._AvailableOrmFiles : undefined, "Relations");
            props.push(parentModelProp);

            // Import Models: qualquer modelo do REPOSITÓRIO, menos este. Escopo maior que o
            // de Parent Model — num repositório modular, o MER de cada módulo mora na pasta
            // dele, e importar de outro módulo exige enxergar a árvore inteira.
            const importProp = new XPropertyItem(
                "ImportModels", "Import Models", element.ImportModels, XPropertyType.MultiFileSelect,
                this._AvailableRepositoryModels.length > 0 ? this._AvailableRepositoryModels : undefined,
                "Relations"
            );
            importProp.Hint = "Models this one imports tables from. Paths are relative to the repository root.";
            props.push(importProp);

            // Trigger async parent table load on first access if design has parent models but tables not yet loaded
            if (element.ParentModel && this._ParentModelTableGroups.length === 0) {
                const selected = element.ParentModel.split("|").filter(f => f.length > 0);
                if (selected.length > 0)
                    /* istanbul ignore next */
                    this.LoadParentModelTables(selected).catch(() => { /* background load */ });
            }

            const picker = this.BuildTablePickerOptions();

            const sctProp = new XPropertyItem("StateControlTable", "State Control Table", element.StateControlTable, XPropertyType.Enum, picker.Options, "Relations");
            sctProp.GroupedOptions = picker.Groups.length > 0 ? picker.Groups : null;
            props.push(sctProp);

            const tctProp = new XPropertyItem("TenantControlTable", "Tenant Control Table", element.TenantControlTable, XPropertyType.Enum, picker.Options, "Relations");
            tctProp.GroupedOptions = picker.Groups.length > 0 ? picker.Groups : null;
            props.push(tctProp);

            // ── Geração de código ─────────────────────────────────────────────
            // Ficam no MODELO, não nos templates: é o que muda de solução para solução,
            // e mantém .DASE/Templates copiável entre repositórios sem edição.

            const genProp = new XPropertyItem("GenerateCode", "Generate Code", element.GenerateCode, XPropertyType.Boolean, undefined, "CodeGen");
            genProp.Hint = "Whether this model produces source code. Turn off for study or draft models.";
            props.push(genProp);

            const tplOptions = ["", ...this._AvailableTemplateProfiles];
            const tplProp = new XPropertyItem("CodeTemplate", "Code Template", element.CodeTemplate, XPropertyType.Enum, tplOptions, "CodeGen");
            tplProp.Hint = "Template profile under .DASE/Templates. Empty means every profile found.";
            props.push(tplProp);

            const nsProp = new XPropertyItem("Namespace", "Namespace", element.Namespace, XPropertyType.String, undefined, "CodeGen");
            nsProp.Placeholder = "e.g. Tootega.SYS";
            nsProp.Hint = "Root namespace/package of the code generated from this model.";
            props.push(nsProp);

            const outProp = new XPropertyItem("OutputRoot", "Output Root", element.OutputRoot, XPropertyType.String, undefined, "CodeGen");
            outProp.Placeholder = "e.g. . or ../Back";
            outProp.Hint = "Output root, relative to the folder holding this .dsorm file.";
            props.push(outProp);
        }
        else if (element instanceof XORMTable) {
            if (element.IsShadow) {
                // Shadow table: show origin info, everything read-only
                const nameProp = props.find(p => p.Key === "Name");
                /* istanbul ignore next */
                if (nameProp)
                    nameProp.IsReadOnly = true;

                const docProp = new XPropertyItem("ShadowDocumentName", "Source Model", element.ShadowDocumentName || "", XPropertyType.String, undefined, "Shadow");
                docProp.IsReadOnly = true;
                props.push(docProp);

                const tblProp = new XPropertyItem("ShadowTableName", "Source Table", element.ShadowTableName || "", XPropertyType.String, undefined, "Shadow");
                tblProp.IsReadOnly = true;
                props.push(tblProp);

                // Herdado da origem e mostrado porque é o que decide o tipo das colunas FK
                // que apontam este espelho — sem ele, só o código gerado revelaria a diferença.
                const pkTypeProp = new XPropertyItem("PKType", "PK Type", element.PKType, XPropertyType.String, undefined, "Shadow");
                pkTypeProp.IsReadOnly = true;
                pkTypeProp.Hint = "Primary key type inherited from the source table.";
                props.push(pkTypeProp);

                if (element.ShadowModuleName) {
                    const modProp = new XPropertyItem("ShadowModuleName", "Module", element.ShadowModuleName, XPropertyType.String, undefined, "Shadow");
                    modProp.IsReadOnly = true;
                    props.push(modProp);
                }
            }
            else {
                const pkTypes = this._PKDataTypes.length > 0 ? this._PKDataTypes : ["Guid", "Int32", "Int64"];
                props.push(new XPropertyItem("PKType", "PK Type", element.PKType, XPropertyType.Enum, pkTypes, "Data"));

                // Use State Control — editable only when the design has a StateControlTable configured
                const stateTableName = this._Controller?.Design?.StateControlTable || "";
                const useStateControlProp = new XPropertyItem("UseStateControl", "Use State Control", element.UseStateControl, XPropertyType.Boolean, undefined, "Control");
                useStateControlProp.IsReadOnly = !stateTableName;
                useStateControlProp.Hint = stateTableName
                    ? `Creates a FK to "${stateTableName}". Disabling removes the state field and its reference.`
                    : "Set the State Control Table on the design first.";
                props.push(useStateControlProp);

                const genTblProp = new XPropertyItem("GenerateCode", "Generate Code", element.GenerateCode, XPropertyType.Boolean, undefined, "CodeGen");
                genTblProp.Hint = "Whether this table produces source code. Turn off to keep it in the diagram without generating files.";
                props.push(genTblProp);

                // Só Entity e Lookup: um espelho nasce exclusivamente de tabela shadow,
                // e este ramo só roda para tabelas próprias (o shadow é read-only acima).
                const stereoProp = new XPropertyItem("Stereotype", "Stereotype", element.Stereotype, XPropertyType.Enum, ["", "Entity", "Lookup"], "CodeGen");
                stereoProp.Hint = "How this table generates: Entity or Lookup. Empty lets the generator infer from the table shape.";
                props.push(stereoProp);

                const isModelProp = new XPropertyItem("IsModel", "Is Model Table", element.IsModel, XPropertyType.Boolean, undefined, "CodeGen");
                isModelProp.Hint = "A model table generates nothing of its own — it only lends its fields to the tables that inherit it.";
                props.push(isModelProp);

                // Seletor de tabela igual ao do espelho: o modelo aberto e cada modelo pai ou
                // importado, um grupo por arquivo. A base pode morar em outro módulo.
                //
                // Fica em CodeGen, ao lado de IsModel: herdar não muda o desenho nem o banco
                // desta tabela no diagrama — muda o que ela gera.
                const inhPicker = this.BuildTablePickerOptions(element.Name);
                const inhProp = new XPropertyItem("Inheritance", "Inheritance", element.Inheritance, XPropertyType.Enum, inhPicker.Options, "CodeGen");
                inhProp.GroupedOptions = inhPicker.Groups.length > 0 ? inhPicker.Groups : null;
                inhProp.Hint = "Base table whose fields this table also generates. Empty means none.";
                props.push(inhProp);

                const descTblProp = new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data");
                descTblProp.Placeholder = "Optional description...";
                props.push(descTblProp);

                const fillColor = element.Fill;
                const colorStr = typeof fillColor.ToString === 'function'
                    ? fillColor.ToString()
                    : String(fillColor);
                props.push(new XPropertyItem("Fill", "Fill", colorStr, XPropertyType.Color, undefined, "Appearance"));
            }
        }
        else if (element instanceof XORMReference) {
            // Source and Target are shown as friendly names and are read-only
            const sourceName = this.ResolveFieldFriendlyName(element.Source);
            const targetName = this.ResolveTableFriendlyName(element.Target);

            const sourceProp = new XPropertyItem("Source", "Source Field", sourceName, XPropertyType.String, undefined, "Data");
            sourceProp.IsReadOnly = true;
            props.push(sourceProp);

            const targetProp = new XPropertyItem("Target", "Target Table", targetName, XPropertyType.String, undefined, "Data");
            targetProp.IsReadOnly = true;
            props.push(targetProp);

            const descRefProp = new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data");
            descRefProp.Placeholder = "Optional description...";
            props.push(descRefProp);
        }
        else if (element instanceof XORMPKField) {
            const allTypes = this._AllDataTypes.length > 0 ? this._AllDataTypes : ["Boolean", "DateTime", "Guid", "Int32", "String"];
            const typeInfo = this.GetEffectiveTypeInfo(element.DataType);

            // DataType is read-only: set and locked by the table's PKType
            const dtProp = new XPropertyItem("DataType", "Data Type", element.DataType, XPropertyType.Enum, allTypes, "Data");
            dtProp.IsReadOnly = true;
            props.push(dtProp);

            // Length / Scale — only when the type actually supports them
            if (typeInfo.HasLength)
                props.push(new XPropertyItem("Length", "Length", element.Length, XPropertyType.Number, undefined, "Data"));
            if (typeInfo.HasScale)
                props.push(new XPropertyItem("Scale", "Scale", element.Scale, XPropertyType.Number, undefined, "Data"));

            // IsRequired is always true for PK fields — hidden (no value in showing it)
            // IsPrimaryKey is always true — hidden (context is obvious)

            // Auto Increment — only when the type supports it
            if (typeInfo.CanAutoIncrement)
                props.push(new XPropertyItem("IsAutoIncrement", "Auto Increment", element.IsAutoIncrement, XPropertyType.Boolean, undefined, "Behaviour"));

            // Default Value — only when not using auto-increment
            if (!element.IsAutoIncrement) {
                const dvpkProp = new XPropertyItem("DefaultValue", "Default Value", element.DefaultValue, XPropertyType.String, undefined, "Data");
                dvpkProp.Placeholder = "e.g. 0, true, 'Active'";
                dvpkProp.Hint = "Default value written into the database column definition (DDL DEFAULT clause).";
                props.push(dvpkProp);
            }

            const descPkProp = new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data");
            descPkProp.Placeholder = "Optional description...";
            props.push(descPkProp);
        }
        else if (element instanceof XORMField) {
            const allTypes = this._AllDataTypes.length > 0 ? this._AllDataTypes : ["Boolean", "DateTime", "Guid", "Int32", "String"];
            const isForeignKey = element.IsForeignKey;
            const effectiveDataType = isForeignKey
                ? (element.GetExpectedDataType() ?? element.DataType)
                : element.DataType;
            const typeInfo = this.GetEffectiveTypeInfo(effectiveDataType);

            // DataType: editable for regular fields, read-only for FK fields
            const dataTypeProp = new XPropertyItem("DataType", "Data Type", effectiveDataType, XPropertyType.Enum, allTypes, "Data");
            dataTypeProp.IsReadOnly = isForeignKey;
            props.push(dataTypeProp);

            // Length / Scale — only when the type supports them
            if (typeInfo.HasLength)
                props.push(new XPropertyItem("Length", "Length", element.Length, XPropertyType.Number, undefined, "Data"));
            if (typeInfo.HasScale)
                props.push(new XPropertyItem("Scale", "Scale", element.Scale, XPropertyType.Number, undefined, "Data"));

            // IsRequired is always visible for both regular and FK fields
            props.push(new XPropertyItem("IsRequired", "Required", element.IsRequired, XPropertyType.Boolean, undefined, "Behaviour"));

            // IsPrimaryKey is always false for XORMField — never shown

            if (!isForeignKey) {
                // Auto Increment — only for regular fields and when the type supports it
                if (typeInfo.CanAutoIncrement)
                    props.push(new XPropertyItem("IsAutoIncrement", "Auto Increment", element.IsAutoIncrement, XPropertyType.Boolean, undefined, "Behaviour"));

                // Default Value — only when not using auto-increment
                if (!element.IsAutoIncrement) {
                    const dvProp = new XPropertyItem("DefaultValue", "Default Value", element.DefaultValue, XPropertyType.String, undefined, "Data");
                    dvProp.Placeholder = "e.g. 0, true, 'Active'";
                    dvProp.Hint = "Default value written into the database column definition (DDL DEFAULT clause).";
                    props.push(dvProp);
                }

                // Allowed Values — tag-chip list for enum/CHECK constraint (pipe-separated internally)
                // Read-only when AutoIncrement is active (numeric sequences cannot have fixed values).
                const avProp = new XPropertyItem("AllowedValues", "Allowed Values", element.AllowedValues, XPropertyType.TagList, undefined, "Data");
                avProp.IsReadOnly = element.IsAutoIncrement;
                avProp.Hint = "Each tag is one permitted value. Generates a CHECK constraint or ENUM in the database. Separator: | (pipe).";
                props.push(avProp);
            }

            const descProp = new XPropertyItem("Description", "Description", element.Description, XPropertyType.String, undefined, "Data");
            descProp.Placeholder = "Optional description...";
            props.push(descProp);
        }

        return this.SortProperties(props);
    }

    /**
     * Builds the seed editor payload for the given table.
     * Resolves FK options from referenced tables' DataSets.
     */
    GetSeedData(pTableID: string): ISeedEditorPayload | null {
        this.Initialize();

        const table = this._Controller?.GetElementByID(pTableID) as XORMTable | null;
        if (!(table instanceof XORMTable))
            return null;

        /* istanbul ignore next */
        const design = this._Controller?.Design;
        /* istanbul ignore next */
        const allRefs = design?.GetReferences() ?? [];

        const rawFields = table.GetFields();

        const columns: ISeedColumn[] = rawFields.map(field => {
            const isFk = field.IsForeignKey;
            let fkOptions: IFKOption[] | undefined;
            let fkTableName: string | undefined;

            if (isFk && design) {
                // Find the XORMReference whose Source points to this FK field
                const ref = allRefs.find(r => r.Source === field.ID);
                if (ref) {
                    const targetTable = (design as any).GetTables?.().find((t: any) => t.ID === ref.Target) as XORMTable | undefined;
                    if (targetTable) {
                        fkTableName = targetTable.Name;
                        const pkField = targetTable.GetPKField();
                        const targetFields = targetTable.GetFields();
                        // First non-PK, non-FK field as display field
                        const displayField = targetFields.find(f => !f.IsPrimaryKey && !f.IsForeignKey) ?? pkField;

                        const targetDataSets = (targetTable as any).GetChildrenOfType?.(XORMDataSet) as XORMDataSet[];
                        const targetDataSet: XORMDataSet | undefined = targetDataSets?.[0];

                        if (targetDataSet && pkField) {
                            fkOptions = [];
                            for (const tuple of targetDataSet.GetTuples()) {
                                const fvList = tuple.GetFieldValues();
                                const pkVal = fvList.find(v => v.FieldID === pkField!.ID)?.Value ?? "";
                                const dispVal = displayField
                                    ? (fvList.find(v => v.FieldID === displayField!.ID)?.Value ?? pkVal)
                                    : /* istanbul ignore next */ pkVal;
                                const label = dispVal && dispVal !== pkVal
                                    ? `${pkVal} — ${dispVal}`
                                    : pkVal;
                                fkOptions.push({ Value: pkVal, Label: label });
                            }
                        }
                        else {
                            fkOptions = [];
                        }
                    }
                }
            }

            return {
                FieldID: field.ID,
                Name: field.Name,
                DataType: field.DataType,
                IsPrimaryKey: field.IsPrimaryKey,
                IsRequired: field.IsRequired,
                IsForeignKey: isFk,
                FKTableName: fkTableName,
                FKOptions: fkOptions
            };
        });

        // Collect existing rows from the DataSet
        const dataSets = (table as any).GetChildrenOfType?.(XORMDataSet) as XORMDataSet[];
        const dataSet: XORMDataSet | undefined = dataSets?.[0];
        const rows: ISeedRow[] = [];

        if (dataSet) {
            for (const tuple of dataSet.GetTuples()) {
                const values: Record<string, string> = {};
                for (const fv of tuple.GetFieldValues())
                    values[fv.FieldID] = fv.Value;

                // O Name da tupla guarda o identificador do membro do enum. Quando nunca foi
                // preenchido, ele traz o nome da classe — que não é um identificador.
                const member = tuple.Name && tuple.Name !== "XORMDataTuple" ? tuple.Name : "";

                rows.push({ TupleID: tuple.ID, Member: member, Values: values });
            }
        }

        return {
            TableID: pTableID,
            TableName: table.Name,
            Columns: columns,
            Rows: rows
        };
    }

    /**
     * Inspects the current loaded ORM model and returns a DBML script representation.
     */
    ExportToDBML(): string {
        const modelData = this.GetModelData();
        if (!modelData || !modelData.Tables || modelData.Tables.length === 0)
            return "";

        const tables = modelData.Tables;
        const refs = modelData.References;
        const lines: string[] = [];

        // Project Header
        const doc = this._Controller?.Document;
        const projName = doc?.Design?.Name || "DASE_Project";
        lines.push(`Project "${projName}" {`);
        lines.push(`  database_type: 'Relational'`);
        lines.push(`  Note: 'Generated by Tootega DASE ORM Designer'`);
        lines.push(`}`);
        lines.push("");

        // Iterate over tables
        for (const tbl of tables) {
            if (tbl.IsShadow) continue; // Note: We only generate full DDL for local tables

            lines.push(`Table "${tbl.Name}" {`);
            for (const f of tbl.Fields) {
                // Determine base DBML data type
                let typeStr = f.DataType || "varchar";

                // Construct DBML field settings (pk, note, not null, default)
                const settings: string[] = [];
                if (f.IsPrimaryKey) settings.push("pk");
                if (f.IsAutoIncrement) settings.push("increment");
                if (f.IsRequired && !f.IsPrimaryKey) settings.push("not null");

                if (f.DefaultValue) {
                    // check if string vs numeric for escaping
                    const isNum = !isNaN(Number(f.DefaultValue));
                    settings.push(`default: ${isNum ? f.DefaultValue : `'${f.DefaultValue}'`}`);
                }

                if (f.Description) {
                    settings.push(`note: '${f.Description.replace(/'/g, "''")}'`);
                }

                // If it has allowed values, we might just append a note here or inline an enum
                if (f.AllowedValues) {
                    settings.push(`note: 'Values: ${f.AllowedValues}'`);
                }

                const settingsStr = settings.length > 0 ? ` [${settings.join(", ")}]` : "";
                lines.push(`  "${f.Name}" ${typeStr}${settingsStr}`);
            }

            const hasNotes = !!tbl.Description;
            const hasSeeds = !!tbl.SeedData;

            if (hasNotes || hasSeeds) {
                lines.push(`  Note: '`);
                if (hasNotes && tbl.Description)
                    lines.push(`    ${tbl.Description.replace(/'/g, "''")}`);

                if (hasSeeds && tbl.SeedData) {
                    if (hasNotes) lines.push(``); // Blank line to separate

                    lines.push(`    @seed`);
                    lines.push(`    | ${tbl.SeedData.Headers.join(" | ")} |`);
                    for (const row of tbl.SeedData.Tuples) {
                        lines.push(`    | ${row.join(" | ")} |`);
                    }
                }
                lines.push(`  '`);
            }

            lines.push(`}`);
            lines.push("");
        }

        // Iterate over References (Relationships)
        for (const ref of refs) {
            // DASE captures relationships as lines from SourceTable.SourceField -> TargetTable.??? (Usually TargetTable PK)
            // But references have: SourceFieldID and TargetTableID
            // Let's find names:
            let sourceTbl: ITableData | undefined;
            let sourceField: IFieldData | undefined;

            for (const t of tables) {
                const f = t.Fields.find(x => x.ID === ref.SourceFieldID);
                if (f) {
                    sourceTbl = t;
                    sourceField = f;
                    break;
                }
            }

            const targetTbl = tables.find(t => t.ID === ref.TargetTableID);

            if (sourceTbl && sourceField && targetTbl) {
                let targetField = targetTbl.Fields.find(f => f.IsPrimaryKey);
                /* istanbul ignore next — PK field always exists after EnsurePKField; fallback unreachable */
                if (!targetField && targetTbl.Fields.length > 0)
                    targetField = targetTbl.Fields[0];

                if (targetField) {
                    const relChar = sourceField.IsPrimaryKey ? "-" : ">";
                    lines.push(`Ref "${ref.Name || 'FK'}": "${sourceTbl.Name}"."${sourceField.Name}" ${relChar} "${targetTbl.Name}"."${targetField.Name}"`);
                }
            }
        }

        return lines.join("\n");
    }

    /**
     * Persists seed rows into the table's XORMDataSet.
     * Replaces all existing tuples with the supplied rows.
     */
    SaveSeedData(pTableID: string, pRows: ISeedRowSave[]): XIOperationResult {
        this.Initialize();

        const table = this._Controller?.GetElementByID(pTableID) as XORMTable | null;
        if (!(table instanceof XORMTable))
            return { Success: false, Message: "Table not found." };

        // Get or create the DataSet
        const existingSets = (table as any).GetChildrenOfType?.(XORMDataSet) as XORMDataSet[];
        let dataSet: XORMDataSet = existingSets?.[0];

        if (!dataSet) {
            dataSet = new XORMDataSet();
            dataSet.ID = XGuid.NewValue();
            dataSet.Name = "T";
            table.AppendChild(dataSet);
        }

        // Remove existing tuples
        for (const tuple of dataSet.GetTuples())
            dataSet.RemoveChild(tuple);

        // Create new tuples
        for (const rowData of pRows) {
            const tuple = new XORMDataTuple();
            tuple.ID = rowData.TupleID === "NEW" ? XGuid.NewValue() : rowData.TupleID;

            // Identificador do membro do enum. Sem ele, a geração cai em derivar o nome do
            // texto em português — e "Real brasileiro" não vira BRL.
            if (rowData.Member)
                tuple.Name = rowData.Member;

            for (const [fieldID, value] of Object.entries(rowData.Values)) {
                const fv = new XFieldValue();
                fv.ID = XGuid.NewValue();
                fv.FieldID = fieldID;
                fv.Value = value;
                tuple.AppendChild(fv);
            }

            dataSet.AppendChild(tuple);
        }

        return { Success: true, ElementID: dataSet.ID };
    }

    /**
     * Builds the index editor payload for the given table: its fields (to pick from)
     * and every XORMIndex already defined on it.
     */
    GetTableIndexes(pTableID: string): IIndexEditorPayload | null {
        this.Initialize();

        const table = this._Controller?.GetElementByID(pTableID) as XORMTable | null;
        if (!(table instanceof XORMTable))
            return null;

        const columns: IIndexColumn[] = table.GetFields().map(field => ({
            FieldID: field.ID,
            Name: field.Name,
            DataType: field.DataType,
            IsPrimaryKey: field.IsPrimaryKey
        }));

        const indexes: IIndexData[] = table.GetChildrenOfType(XORMIndex).map(ix => ({
            IndexID: ix.ID,
            Name: ix.Name,
            IsUnique: ix.IsUnique,
            Filter: ix.Filter ?? "",
            Fields: ix.GetIndexFields().map(f => ({
                FieldID: f.ParentID,
                IsDescending: f.IsDescending,
                AllowDuplicate: f.AllowDuplicate,
                IsIncluded: f.IsIncluded
            }))
        }));

        return {
            TableID: pTableID,
            TableName: table.Name,
            Columns: columns,
            Indexes: indexes
        };
    }

    /**
     * Persists the table's indexes. Replaces every existing XORMIndex child with the
     * supplied list — same "clear and rebuild" approach used for seed rows.
     */
    SaveTableIndexes(pTableID: string, pIndexes: IIndexSave[]): XIOperationResult {
        this.Initialize();

        const table = this._Controller?.GetElementByID(pTableID) as XORMTable | null;
        if (!(table instanceof XORMTable))
            return { Success: false, Message: "Table not found." };

        for (const name of pIndexes.map(ix => ix.Name.trim().toLowerCase())) {
            if (!name)
                return { Success: false, Message: "Every index needs a name." };
        }
        const dupeName = pIndexes
            .map(ix => ix.Name.trim().toLowerCase())
            .find((name, i, arr) => arr.indexOf(name) !== i);
        if (dupeName)
            return { Success: false, Message: `Duplicate index name: "${dupeName}".` };

        for (const ix of pIndexes) {
            if (ix.Fields.filter(f => !f.IsIncluded).length === 0)
                return { Success: false, Message: `Index "${ix.Name}" needs at least one key column.` };
        }

        for (const existing of table.GetChildrenOfType(XORMIndex))
            table.RemoveChild(existing);

        for (const ixData of pIndexes) {
            const index = new XORMIndex();
            index.ID = ixData.IndexID === "NEW" ? XGuid.NewValue() : ixData.IndexID;
            index.Name = ixData.Name.trim();
            index.IsUnique = !!ixData.IsUnique;
            index.Filter = ixData.Filter ?? "";

            for (const fieldData of ixData.Fields) {
                const indexField = new XORMIndexField();
                indexField.ID = XGuid.NewValue();
                indexField.ParentID = fieldData.FieldID;
                indexField.IsDescending = !!fieldData.IsDescending;
                indexField.AllowDuplicate = !!fieldData.AllowDuplicate;
                indexField.IsIncluded = !!fieldData.IsIncluded;
                index.AppendChild(indexField);
            }

            table.AppendChild(index);
        }

        return { Success: true, ElementID: table.ID };
    }

    GetElementInfo(pElementID: string): { ID: string; Name: string; Type: string } | null {
        this.Initialize();

        const element = this.ResolvePropertyTarget(pElementID);
        if (!element)
            return null;

        let typeName = "Unknown";
        if (element instanceof XORMDesign)
            typeName = "XORMDesign";
        else if (element instanceof XORMTable)
            typeName = "XORMTable";
        else if (element instanceof XORMReference)
            typeName = "XORMReference";
        else if (element instanceof XORMPKField)
            typeName = "XORMPKField";
        else if (element instanceof XORMField)
            typeName = "XORMField";

        return {
            ID: element.ID,
            Name: element.Name,
            Type: typeName
        };
    }

    GetModelData(): IModelData {
        this.Initialize();

        const doc = this._Controller?.Document;
        if (!doc || !doc.Design)
            return { Tables: [], References: [] };

        const design = doc.Design;
        const tables = this._Controller.GetTables();
        const references = this._Controller.GetReferences();

        const tablesData: ITableData[] = tables.map((t: any) => {
            // Get fields using GetChildrenOfType or directly from Fields array
            const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];

            // Get fill color as HTML hex string - handle both XColor objects and strings
            let fillColor: string | undefined;
            if (t.Fill) {
                if (typeof t.Fill.ToString === 'function')
                    fillColor = `#${t.Fill.ToString().substring(2)}`;
                else if (typeof t.Fill === 'string')
                    fillColor = t.Fill.startsWith('#') ? t.Fill : `#${t.Fill.substring(2)}`;
            }

            // Extract Seed Data if a DataSet is present
            let seedData: { Headers: string[], Tuples: string[][] } | undefined = undefined;
            const dataSets = t.GetChildrenOfType
                ? t.GetChildrenOfType(XORMDataSet)
                : t.Children?.filter((c: any) => c.Class === 'XORMDataSet') || [];

            if (dataSets && dataSets.length > 0) {
                const dataSet = dataSets[0];
                const tuples = dataSet.GetTuples
                    ? dataSet.GetTuples()
                    : dataSet.Children?.filter((c: any) => c.Class === 'XORMDataTuple') || [];

                if (tuples.length > 0) {
                    const headersMap: Record<string, string> = {};
                    const rows: string[][] = [];

                    // Pass 1: Gather all unique Field IDs to form Headers mapping
                    fields.forEach((f: any) => {
                        headersMap[f.ID] = f.Name;
                    });
                    const orderedFieldIDs = fields.map((f: any) => f.ID);
                    const headers = orderedFieldIDs.map((id: string) => headersMap[id] || id);

                    // Pass 2: Extract Tuples
                    for (const tuple of tuples) {
                        const rowMap: Record<string, string> = {};
                        const fieldValues = tuple.GetChildrenOfType
                            ? tuple.GetChildrenOfType(XFieldValue)
                            : /* istanbul ignore next */ (tuple.Children?.filter((c: any) => c.Class === 'XFieldValue') || []);

                        for (const fv of fieldValues) {
                            rowMap[fv.FieldID] = fv.Value || "";
                        }

                        // Ensure ordering corresponds to Headers
                        const row = orderedFieldIDs.map((id: string) => rowMap[id] || "");
                        rows.push(row);
                    }

                    seedData = {
                        Headers: headers,
                        Tuples: rows
                    };
                }
            }

            return {
                ID: t.ID,
                Name: t.Name,
                X: t.Bounds.Left,
                Y: t.Bounds.Top,
                Width: t.Bounds.Width,
                Height: t.Bounds.Height,
                FillProp: fillColor,
                Description: t.Description || undefined,
                PKType: t.PKType,
                IsShadow: t.IsShadow || false,
                ShadowDocumentID: t.ShadowDocumentID || undefined,
                ShadowDocumentName: t.ShadowDocumentName || undefined,
                ShadowTableID: t.ShadowTableID || undefined,
                ShadowTableName: t.ShadowTableName || undefined,
                ShadowModuleID: t.ShadowModuleID || undefined,
                ShadowModuleName: t.ShadowModuleName || undefined,
                IsModel: t.IsModel || false,
                Inheritance: t.Inheritance || undefined,
                Fields: fields.map((f: any) => ({
                    ID: f.ID,
                    Name: f.Name,
                    DataType: f.DataType,
                    IsPrimaryKey: f.IsPrimaryKey,
                    IsForeignKey: f.IsForeignKey,
                    IsRequired: f.IsRequired,
                    IsAutoIncrement: f.IsAutoIncrement,
                    DefaultValue: f.DefaultValue,
                    Description: f.Description || undefined,
                    AllowedValues: f.AllowedValues || undefined
                })),
                SeedData: seedData
            };
        });

        // Helper to simplify route points for webview rendering (does not modify the route, only cleans)
        // Correct routing is done by XORMDesign.ts which follows the defined rules
        const simplifyRoutePoints = (points: Array<{ X: number, Y: number }>, sourceTable: any, targetTable: any): Array<{ X: number, Y: number }> => {
            // Return as-is when not enough points
            if (points.length < 2) return points;

            // 1) Filter invalid points
            const valid = points.filter(p => p && Number.isFinite(p.X) && Number.isFinite(p.Y));
            if (valid.length < 2)
                return [];

            // 2) Remove consecutive duplicates (1px tolerance)
            const unique: Array<{ X: number, Y: number }> = [valid[0]];
            for (let i = 1; i < valid.length; i++) {
                const prev = unique[unique.length - 1];
                if (Math.abs(valid[i].X - prev.X) > 1 || Math.abs(valid[i].Y - prev.Y) > 1)
                    unique.push({ X: valid[i].X, Y: valid[i].Y });
            }

            if (unique.length < 2)
                return [];

            // 3) Remove collinear intermediate points
            const simplified: Array<{ X: number, Y: number }> = [unique[0]];
            for (let i = 1; i < unique.length - 1; i++) {
                const a = simplified[simplified.length - 1];
                const b = unique[i];
                const c = unique[i + 1];

                // 2px tolerance for collinearity
                const sameX = Math.abs(a.X - b.X) < 2 && Math.abs(b.X - c.X) < 2;
                const sameY = Math.abs(a.Y - b.Y) < 2 && Math.abs(b.Y - c.Y) < 2;

                if (!sameX && !sameY)
                    simplified.push(b);
            }
            simplified.push(unique[unique.length - 1]);

            return simplified;
        };

        const refsData: IReferenceData[] = references.filter((r: any) => r.IsVisible !== false).map((r: any) => {
            // Find source and target tables for point simplification
            const sourceTable = tables.find((t: any) => {
                const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];
                return fields.some((f: any) => f.ID === r.Source);
            });
            const targetTable = tables.find((t: any) => t.ID === r.Target);

            const rawPoints = r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || [];
            const simplifiedPoints = simplifyRoutePoints(rawPoints, sourceTable, targetTable);

            // Detect 1:1 relationship: source field is the PK of the source table
            const srcTbl: any = sourceTable;
            const srcFieldsRaw: any[] | null | undefined = srcTbl
                ? (srcTbl.GetChildrenOfType?.(XORMField) ?? srcTbl.Fields)
                : null;
            /* istanbul ignore next */
            const sourceFields: any[] = srcFieldsRaw ?? [];
            const sourceField = sourceFields.find((f: any) => f.ID === r.Source);
            const isOneToOne = !!(sourceField?.IsPrimaryKey);

            return {
                ID: r.ID,
                Name: r.Name,
                SourceFieldID: r.Source,
                TargetTableID: r.Target,
                Points: simplifiedPoints,
                IsOneToOne: isOneToOne
            };
        });

        return { DesignID: design.ID, Tables: tablesData, References: refsData };
    }

    LoadFromJson(pDoc: any, pData: IJsonData): void {
        if (!pData || !pDoc.Design)
            return;

        const design = pDoc.Design;

        if (pData.Name)
            pDoc.Name = pData.Name;

        if (pData.Schema)
            design.Schema = pData.Schema;

        if (pData.StateControlTable !== undefined)
            design.StateControlTable = pData.StateControlTable;

        if (pData.Tables && Array.isArray(pData.Tables)) {
            for (const tData of pData.Tables) {
                const table = design.CreateTable({
                    X: tData.X || 0,
                    Y: tData.Y || 0,
                    Width: tData.Width || 200,
                    Height: tData.Height || 150,
                    Name: tData.Name || ""
                });

                if (tData.ID)
                    table.ID = tData.ID;
                if (tData.Description)
                    table.Description = tData.Description;

                // Um espelho não tem campos, então o tipo da chave só chega por aqui.
                // Numa tabela própria o campo PK é a fonte da verdade e a validação
                // reconcilia os dois logo em seguida.
                if (tData.PKType)
                    table.PKType = tData.PKType;

                // Restore shadow metadata
                if (tData.IsShadow) {
                    table.IsShadow = true;
                    if (tData.ShadowDocumentID) table.ShadowDocumentID = tData.ShadowDocumentID;
                    if (tData.ShadowDocumentName) table.ShadowDocumentName = tData.ShadowDocumentName;
                    if (tData.ShadowTableID) table.ShadowTableID = tData.ShadowTableID;
                    if (tData.ShadowTableName) table.ShadowTableName = tData.ShadowTableName;
                    if (tData.ShadowModuleID) table.ShadowModuleID = tData.ShadowModuleID;
                    if (tData.ShadowModuleName) table.ShadowModuleName = tData.ShadowModuleName;
                }

                if (tData.Fields && Array.isArray(tData.Fields)) {
                    const pkData = tData.Fields.find(f => f.IsPrimaryKey);
                    if (pkData) {
                        let pkField = table.GetPKField();
                        if (!pkField)
                            pkField = table.CreatePKField();

                        if (pkData.Name)
                            pkField.Name = pkData.Name;

                        if (pkData.DataType) {
                            let normalizedPKType: string = pkData.DataType;
                            switch (normalizedPKType) {
                                case "Integer":
                                    normalizedPKType = "Int32";
                                    break;
                                case "Long":
                                    normalizedPKType = "Int64";
                                    break;
                            }

                            // Pela tabela, não pelo campo: CreatePKField trava o DataType, e
                            // atribuí-lo direto é silenciosamente ignorado — a chave importada
                            // ficaria Int32 qualquer que fosse o tipo declarado.
                            if (normalizedPKType === "Int32" || normalizedPKType === "Int64" || normalizedPKType === "Guid")
                                table.PKType = normalizedPKType;
                        }

                        if (pkData.IsAutoIncrement !== undefined)
                            pkField.IsAutoIncrement = pkData.IsAutoIncrement;

                        if (pkData.ID)
                            pkField.ID = pkData.ID;
                        if (pkData.Description)
                            pkField.Description = pkData.Description;
                    }

                    for (const fData of tData.Fields) {
                        if (fData.IsPrimaryKey)
                            continue;

                        const field = table.CreateField({
                            Name: fData.Name || "",
                            DataType: (fData.DataType as string) || "String",
                            Length: fData.Length || 0,
                            IsRequired: fData.IsRequired || false,
                            IsAutoIncrement: fData.IsAutoIncrement || false,
                            DefaultValue: fData.DefaultValue || "",
                            AllowedValues: fData.AllowedValues || ""
                        });

                        if (fData.ID)
                            field.ID = fData.ID;
                        if (fData.Description)
                            field.Description = fData.Description;
                    }
                }
            }
        }

        if (pData.References && Array.isArray(pData.References)) {
            for (const rData of pData.References) {
                try {
                    const ref = design.CreateReference({
                        SourceFieldID: rData.SourceFieldID || rData.SourceID || "",
                        TargetTableID: rData.TargetTableID || rData.TargetID || "",
                        Name: rData.Name || ""
                    });

                    if (rData.ID)
                        ref.ID = rData.ID;
                    if (rData.Description)
                        ref.Description = rData.Description;

                    if (rData.Points && Array.isArray(rData.Points))
                        ref.Points = rData.Points.map((p: any) => new XPoint(p.X, p.Y));
                }
                catch (error) {
                    GetLogService().Warn(`Failed to create reference: ${rData.Name} - ${error}`);
                }
            }
        }
    }

    SaveToJson(pDoc: any): IJsonData {
        if (!pDoc || !pDoc.Design)
            return {};

        const tables = this._Controller?.GetTables() || [];
        const references = this._Controller?.GetReferences() || [];

        return {
            Name: pDoc.Name,
            Schema: pDoc.Design.Schema,
            Tables: tables.map((t: any) => {
                // Get fields using GetChildrenOfType or directly from Fields array
                const fields = t.GetChildrenOfType?.(XORMField) ?? t.Fields ?? [];

                return {
                    ID: t.ID,
                    Name: t.Name,
                    Description: t.Description,
                    X: t.Bounds.Left,
                    Y: t.Bounds.Top,
                    Width: t.Bounds.Width,
                    Height: t.Bounds.Height,
                    // Escrito para o espelho, que não tem campo PK de onde o tipo se deduza.
                    PKType: t.PKType,
                    IsShadow: t.IsShadow || undefined,
                    ShadowDocumentID: t.ShadowDocumentID || undefined,
                    ShadowDocumentName: t.ShadowDocumentName || undefined,
                    ShadowTableID: t.ShadowTableID || undefined,
                    ShadowTableName: t.ShadowTableName || undefined,
                    ShadowModuleID: t.ShadowModuleID || undefined,
                    ShadowModuleName: t.ShadowModuleName || undefined,
                    Fields: fields.map((f: any) => ({
                        ID: f.ID,
                        Name: f.Name,
                        DataType: f.DataType,
                        Length: f.Length,
                        IsPrimaryKey: f.IsPrimaryKey,
                        IsRequired: f.IsRequired,
                        DefaultValue: f.DefaultValue,
                        Description: f.Description
                    }))
                };
            }),
            References: references.map((r: any) => ({
                ID: r.ID,
                Name: r.Name,
                SourceFieldID: r.SourceID || r.Source,
                TargetTableID: r.TargetID || r.Target,
                Description: r.Description,
                Points: r.Points?.map((p: any) => ({ X: p.X, Y: p.Y })) || []
            }))
        };
    }
}
