/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                              TFX CONFIGURATION MANAGER                                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  PURPOSE:                                                                                         ║
 * ║  Manages configuration files for TFX designers (ORM, UI, Flow, API).                              ║
 * ║  Provides hierarchical configuration lookup with caching and default creation.                    ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  CONFIGURATION FILE NAMING:                                                                       ║
 * ║  Files follow the pattern: {Target}.{Group}.json                                                  ║
 * ║  Examples:                                                                                        ║
 * ║    - ORM.DataType.json    (Target: ORM, Group: DataType)                                          ║
 * ║    - ORM.Validation.json  (Target: ORM, Group: Validation)                                        ║
 * ║    - UI.Components.json   (Target: UI, Group: Components)                                         ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  SEARCH ALGORITHM:                                                                                ║
 * ║  1. Check in-memory cache first (key: Target + Group + ContextPath)                               ║
 * ║  2. If not cached, search filesystem hierarchically:                                              ║
 * ║     a. Start from the design file's directory, look for ".DASE" subfolder                         ║
 * ║     b. If not found, move to parent directory and repeat                                          ║
 * ║     c. Continue until reaching repository root (detected by .git folder or drive root)            ║
 * ║  3. If configuration file not found anywhere:                                                     ║
 * ║     a. Create ".DASE" folder at repository root                                                   ║
 * ║     b. Save default configuration to that folder                                                  ║
 * ║     c. Return the default configuration                                                           ║
 * ║  4. Cache the loaded configuration for future requests                                            ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  CACHE BEHAVIOR:                                                                                  ║
 * ║  - Configurations are cached by composite key: {Target}:{Group}:{ResolvedPath}                    ║
 * ║  - Cache can be invalidated per-key or entirely                                                   ║
 * ║  - Cache respects configuration file location (different folders = different cache entries)       ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  CONFIGURATION INHERITANCE:                                                                       ║
 * ║  - More specific configurations (closer to design file) override less specific ones               ║
 * ║  - This allows project-level, folder-level, or repository-level configurations                    ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  SUPPORTED TARGETS:                                                                               ║
 * ║  - ORM: Object-Relational Mapping designer                                                        ║
 * ║  - UI: User Interface designer (future)                                                           ║
 * ║  - Flow: Flow/Process designer (future)                                                           ║
 * ║  - API: API designer (future)                                                                     ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  USAGE EXAMPLE:                                                                                   ║
 * ║  const manager = XConfigurationManager.GetInstance();                                             ║
 * ║  manager.SetFileSystem(fsAdapter); // Inject filesystem adapter                                   ║
 * ║  const types = await manager.GetConfiguration<IORMTypesConfig>(                                   ║
 * ║      XConfigTarget.ORM,                                                                           ║
 * ║      XConfigGroup.DataType,                                                                       ║
 * ║      "/path/to/design/file.dsorm"                                                                 ║
 * ║  );                                                                                               ║
 * ║                                                                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import { XORMDataTypeInfo, XORMTypesConfig } from "./XConfigurationTypes.js";
import { XConfigResources } from "./XConfigResources.js";

/**
 * Supported configuration targets (designer types)
 */
export enum XConfigTarget
{
    ORM = "ORM",
    UI = "UI",
    Flow = "Flow",
    API = "API"
}

/**
 * Supported configuration groups
 */
export enum XConfigGroup
{
    DataType = "Types",
    Validation = "Validation",
    Naming = "Naming",
    Display = "Display",
    Components = "Components"
}

/**
 * File system adapter interface for dependency injection
 * Allows testing without real filesystem access
 */
export interface IFileSystemAdapter
{
    FileExists(pPath: string): Promise<boolean>;
    DirectoryExists(pPath: string): Promise<boolean>;
    ReadFile(pPath: string): Promise<string>;
    WriteFile(pPath: string, pContent: string): Promise<void>;
    CreateDirectory(pPath: string): Promise<void>;
    GetParentDirectory(pPath: string): string;
    JoinPath(...pSegments: string[]): string;
    GetDirectoryName(pPath: string): string;
    IsRootPath(pPath: string): boolean;
}

/**
 * Base interface for all configuration files
 */
export interface IConfigurationFile
{
    Name: string;
    Target: string;
    Group: string;
}

/**
 * Cache entry structure
 */
interface ICacheEntry<T>
{
    Data: T;
    FilePath: string;
    LoadedAt: Date;
}

/**
 * Search result structure
 */
interface ISearchResult
{
    Found: boolean;
    FilePath: string | null;
    IsDefault: boolean;
}

/**
 * Configuration Manager - Singleton
 * Manages configuration files with hierarchical search and caching
 */
export class XConfigurationManager
{
    private static _Instance: XConfigurationManager | null = null;

    private _Cache: Map<string, ICacheEntry<unknown>>;
    private _FileSystem: IFileSystemAdapter | null;
    private _Defaults: Map<string, () => IConfigurationFile>;
    
    /** Configuration folder name */
    static readonly ConfigFolderName = ".DASE";

    private constructor()
    {
        this._Cache = new Map();
        this._FileSystem = null;
        this._Defaults = new Map();
        this.RegisterDefaults();
    }

    /**
     * Get singleton instance
     */
    static GetInstance(): XConfigurationManager
    {
        if (!XConfigurationManager._Instance)
            XConfigurationManager._Instance = new XConfigurationManager();

        return XConfigurationManager._Instance;
    }

    /**
     * Reset instance (for testing purposes)
     */
    static ResetInstance(): void
    {
        XConfigurationManager._Instance = null;
    }

    /**
     * Inject filesystem adapter
     */
    SetFileSystem(pAdapter: IFileSystemAdapter): void
    {
        this._FileSystem = pAdapter;
    }

    /**
     * Register default configuration factories
     */
    private RegisterDefaults(): void
    {
        this._Defaults.set(
            this.BuildDefaultKey(XConfigTarget.ORM, XConfigGroup.DataType),
            () => this.CreateDefaultORMTypes()
        );
    }

    /**
     * Build cache key from parameters
     */
    private BuildCacheKey(pTarget: XConfigTarget, pGroup: XConfigGroup, pResolvedPath: string): string
    {
        return `${pTarget}:${pGroup}:${pResolvedPath}`;
    }

    /**
     * Build default key for default configuration lookup
     */
    private BuildDefaultKey(pTarget: XConfigTarget, pGroup: XConfigGroup): string
    {
        return `${pTarget}:${pGroup}`;
    }

    /**
     * Build configuration file name
     * Pattern: {Target}.{Group}.json
     */
    private BuildFileName(pTarget: XConfigTarget, pGroup: XConfigGroup): string
    {
        return `${pTarget}.${pGroup}.json`;
    }

    /**
     * Get configuration by target and group
     * @param pTarget Designer target (ORM, UI, etc.)
     * @param pGroup Configuration group (Types, Validation, etc.)
     * @param pContextPath Path to the design file being edited
     * @returns Configuration data
     */
    async GetConfiguration<T extends IConfigurationFile>(
        pTarget: XConfigTarget,
        pGroup: XConfigGroup,
        pContextPath: string
    ): Promise<T>
    {
        if (!this._FileSystem)
            throw new Error("FileSystem adapter not configured. Call SetFileSystem() first.");

        const searchResult = await this.SearchConfigurationFile(pTarget, pGroup, pContextPath);
        
        if (searchResult.Found && searchResult.FilePath)
        {
            const cacheKey = this.BuildCacheKey(pTarget, pGroup, searchResult.FilePath);
            
            const cached = this._Cache.get(cacheKey);
            if (cached)
                return cached.Data as T;

            const content = await this._FileSystem.ReadFile(searchResult.FilePath);
            const data = JSON.parse(content) as T;

            this._Cache.set(cacheKey, {
                Data: data,
                FilePath: searchResult.FilePath,
                LoadedAt: new Date()
            });

            return data;
        }

        const defaultConfig = await this.CreateAndSaveDefault<T>(pTarget, pGroup, pContextPath);
        return defaultConfig;
    }

    /**
     * Search for configuration file in hierarchy
     */
    private async SearchConfigurationFile(
        pTarget: XConfigTarget,
        pGroup: XConfigGroup,
        pContextPath: string
    ): Promise<ISearchResult>
    {
        const fileName = this.BuildFileName(pTarget, pGroup);
        let currentDir = this._FileSystem!.GetDirectoryName(pContextPath);
        let repositoryRoot: string | null = null;

        while (currentDir && !this._FileSystem!.IsRootPath(currentDir))
        {
            const configFolder = this._FileSystem!.JoinPath(currentDir, XConfigurationManager.ConfigFolderName);
            const configFile = this._FileSystem!.JoinPath(configFolder, fileName);

            if (await this._FileSystem!.FileExists(configFile))
                return { Found: true, FilePath: configFile, IsDefault: false };

            const gitFolder = this._FileSystem!.JoinPath(currentDir, ".git");
            if (await this._FileSystem!.DirectoryExists(gitFolder))
                repositoryRoot = currentDir;

            currentDir = this._FileSystem!.GetParentDirectory(currentDir);
        }

        if (!repositoryRoot)
            repositoryRoot = this._FileSystem!.GetDirectoryName(pContextPath);

        return { Found: false, FilePath: null, IsDefault: true };
    }

    /**
     * Find repository root by searching for .git folder
     */
    private async FindRepositoryRoot(pStartPath: string): Promise<string>
    {
        let currentDir = this._FileSystem!.GetDirectoryName(pStartPath);
        let lastValidDir = currentDir;

        while (currentDir && !this._FileSystem!.IsRootPath(currentDir))
        {
            lastValidDir = currentDir;

            const gitFolder = this._FileSystem!.JoinPath(currentDir, ".git");
            if (await this._FileSystem!.DirectoryExists(gitFolder))
                return currentDir;

            currentDir = this._FileSystem!.GetParentDirectory(currentDir);
        }

        return lastValidDir;
    }

    /**
     * Create default configuration and save to repository root
     */
    private async CreateAndSaveDefault<T extends IConfigurationFile>(
        pTarget: XConfigTarget,
        pGroup: XConfigGroup,
        pContextPath: string
    ): Promise<T>
    {
        const defaultKey = this.BuildDefaultKey(pTarget, pGroup);
        const factory = this._Defaults.get(defaultKey);

        if (!factory)
            throw new Error(`No default configuration registered for ${pTarget}:${pGroup}`);

        const defaultConfig = factory() as T;
        const repositoryRoot = await this.FindRepositoryRoot(pContextPath);
        const configFolder = this._FileSystem!.JoinPath(repositoryRoot, XConfigurationManager.ConfigFolderName);
        const fileName = this.BuildFileName(pTarget, pGroup);
        const configFile = this._FileSystem!.JoinPath(configFolder, fileName);

        if (!await this._FileSystem!.DirectoryExists(configFolder))
            await this._FileSystem!.CreateDirectory(configFolder);

        const content = JSON.stringify(defaultConfig, null, 2);
        await this._FileSystem!.WriteFile(configFile, content);

        const cacheKey = this.BuildCacheKey(pTarget, pGroup, configFile);
        this._Cache.set(cacheKey, {
            Data: defaultConfig,
            FilePath: configFile,
            LoadedAt: new Date()
        });

        return defaultConfig;
    }

    /**
     * Create default ORM Types configuration
     * Uses embedded resource from Resources/ORM.DataType.json
     */
    private CreateDefaultORMTypes(): XORMTypesConfig
    {
        return XConfigResources.GetORMDataType();
    }

    /**
     * Invalidate cache entry by target, group and path
     */
    InvalidateCache(pTarget: XConfigTarget, pGroup: XConfigGroup, pPath: string): void
    {
        const cacheKey = this.BuildCacheKey(pTarget, pGroup, pPath);
        this._Cache.delete(cacheKey);
    }

    /**
     * Invalidate all cache entries for a target
     */
    InvalidateCacheByTarget(pTarget: XConfigTarget): void
    {
        const keysToDelete: string[] = [];

        for (const key of this._Cache.keys())
            if (key.startsWith(`${pTarget}:`))
                keysToDelete.push(key);

        for (const key of keysToDelete)
            this._Cache.delete(key);
    }

    /**
     * Clear entire cache
     */
    ClearCache(): void
    {
        this._Cache.clear();
    }

    /**
     * Get cached configuration without filesystem lookup
     * Returns null if not in cache
     */
    GetCachedConfiguration<T extends IConfigurationFile>(
        pTarget: XConfigTarget,
        pGroup: XConfigGroup,
        pPath: string
    ): T | null
    {
        const cacheKey = this.BuildCacheKey(pTarget, pGroup, pPath);
        const cached = this._Cache.get(cacheKey);
        
        return cached ? cached.Data as T : null;
    }

    /**
     * Check if configuration is cached
     */
    IsCached(pTarget: XConfigTarget, pGroup: XConfigGroup, pPath: string): boolean
    {
        const cacheKey = this.BuildCacheKey(pTarget, pGroup, pPath);
        return this._Cache.has(cacheKey);
    }

    /**
     * Get all ORM data types from configuration
     * Convenience method for common use case
     */
    async GetORMDataTypes(pContextPath: string): Promise<XORMDataTypeInfo[]>
    {
        const config = await this.GetConfiguration<XORMTypesConfig>(
            XConfigTarget.ORM,
            XConfigGroup.DataType,
            pContextPath
        );

        return config.Types;
    }

    /**
     * Get ORM data types that can be used in primary keys
     */
    async GetORMPrimaryKeyTypes(pContextPath: string): Promise<XORMDataTypeInfo[]>
    {
        const types = await this.GetORMDataTypes(pContextPath);
        return types.filter(t => t.CanUseInPK);
    }

    /**
     * Get ORM data types that support auto-increment
     */
    async GetORMAutoIncrementTypes(pContextPath: string): Promise<XORMDataTypeInfo[]>
    {
        const types = await this.GetORMDataTypes(pContextPath);
        return types.filter(t => t.CanAutoIncrement);
    }

    /**
     * Get ORM data types that can be used in indexes
     */
    async GetORMIndexableTypes(pContextPath: string): Promise<XORMDataTypeInfo[]>
    {
        const types = await this.GetORMDataTypes(pContextPath);
        return types.filter(t => t.CanUseInIndex);
    }

    /**
     * Get ORM data type info by name
     */
    async GetORMDataTypeByName(pContextPath: string, pTypeName: string): Promise<XORMDataTypeInfo | null>
    {
        const types = await this.GetORMDataTypes(pContextPath);
        return types.find(t => t.TypeName === pTypeName) || null;
    }

    /**
     * Get data type names as string array (for UI dropdowns)
     */
    async GetORMDataTypeNames(pContextPath: string): Promise<string[]>
    {
        const types = await this.GetORMDataTypes(pContextPath);
        return types.map(t => t.TypeName);
    }

    /**
     * Register a custom default configuration factory
     */
    RegisterDefault(pTarget: XConfigTarget, pGroup: XConfigGroup, pFactory: () => IConfigurationFile): void
    {
        const key = this.BuildDefaultKey(pTarget, pGroup);
        this._Defaults.set(key, pFactory);
    }

    /**
     * Preload configuration into cache
     */
    async PreloadConfiguration(
        pTarget: XConfigTarget,
        pGroup: XConfigGroup,
        pContextPath: string
    ): Promise<void>
    {
        await this.GetConfiguration(pTarget, pGroup, pContextPath);
    }

    /**
     * Get cache statistics
     */
    GetCacheStats(): { EntryCount: number; Entries: Array<{ Key: string; LoadedAt: Date }> }
    {
        const entries: Array<{ Key: string; LoadedAt: Date }> = [];

        for (const [key, value] of this._Cache.entries())
            entries.push({ Key: key, LoadedAt: value.LoadedAt });

        return { EntryCount: this._Cache.size, Entries: entries };
    }
}
