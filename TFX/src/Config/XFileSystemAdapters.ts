/**
 * Node.js File System Adapter for XConfigurationManager
 * Implements IFileSystemAdapter using Node.js 'fs' and 'path' modules
 */

import { IFileSystemAdapter } from "./XConfigurationManager.js";

/**
 * Node.js implementation of IFileSystemAdapter
 * Uses dynamic imports to work in both Node.js and browser environments
 */
export class XNodeFileSystemAdapter implements IFileSystemAdapter
{
    private _FS: typeof import("fs/promises") | null = null;
    private _Path: typeof import("path") | null = null;
    private _Initialized: boolean = false;

    /**
     * Initialize the adapter (loads Node.js modules)
     */
    async Initialize(): Promise<void>
    {
        if (this._Initialized)
            return;

        this._FS = await import("fs/promises");
        this._Path = await import("path");
        this._Initialized = true;
    }

    /**
     * Ensure adapter is initialized
     */
    private EnsureInitialized(): void
    {
        if (!this._Initialized)
            throw new Error("XNodeFileSystemAdapter not initialized. Call Initialize() first.");
    }

    /**
     * Check if file exists
     */
    async FileExists(pPath: string): Promise<boolean>
    {
        this.EnsureInitialized();
        
        try
        {
            const stats = await this._FS!.stat(pPath);
            return stats.isFile();
        }
        catch
        {
            return false;
        }
    }

    /**
     * Check if directory exists
     */
    async DirectoryExists(pPath: string): Promise<boolean>
    {
        this.EnsureInitialized();
        
        try
        {
            const stats = await this._FS!.stat(pPath);
            return stats.isDirectory();
        }
        catch
        {
            return false;
        }
    }

    /**
     * Read file contents
     */
    async ReadFile(pPath: string): Promise<string>
    {
        this.EnsureInitialized();
        return await this._FS!.readFile(pPath, "utf-8");
    }

    /**
     * Write file contents
     */
    async WriteFile(pPath: string, pContent: string): Promise<void>
    {
        this.EnsureInitialized();
        await this._FS!.writeFile(pPath, pContent, "utf-8");
    }

    /**
     * Create directory (recursive)
     */
    async CreateDirectory(pPath: string): Promise<void>
    {
        this.EnsureInitialized();
        await this._FS!.mkdir(pPath, { recursive: true });
    }

    /**
     * Get parent directory path
     */
    GetParentDirectory(pPath: string): string
    {
        this.EnsureInitialized();
        return this._Path!.dirname(pPath);
    }

    /**
     * Join path segments
     */
    JoinPath(...pSegments: string[]): string
    {
        this.EnsureInitialized();
        return this._Path!.join(...pSegments);
    }

    /**
     * Get directory name from path
     */
    GetDirectoryName(pPath: string): string
    {
        this.EnsureInitialized();
        return this._Path!.dirname(pPath);
    }

    /**
     * Check if path is root (drive root on Windows, / on Unix)
     */
    IsRootPath(pPath: string): boolean
    {
        this.EnsureInitialized();
        const parsed = this._Path!.parse(pPath);
        return parsed.root === pPath || parsed.dir === parsed.root;
    }
}

/**
 * VS Code File System Adapter for XConfigurationManager
 * Uses VS Code workspace.fs API for file operations
 */
export class XVSCodeFileSystemAdapter implements IFileSystemAdapter
{
    private _VSCodeFS: {
        stat: (uri: { fsPath: string }) => Promise<{ type: number }>;
        readFile: (uri: { fsPath: string }) => Promise<Uint8Array>;
        writeFile: (uri: { fsPath: string }, content: Uint8Array) => Promise<void>;
        createDirectory: (uri: { fsPath: string }) => Promise<void>;
    } | null = null;

    private _URIFactory: ((path: string) => { fsPath: string }) | null = null;
    private _PathSeparator: string = "/";

    /**
     * Set VS Code workspace.fs reference
     */
    SetVSCodeFS(
        pFS: typeof XVSCodeFileSystemAdapter.prototype._VSCodeFS,
        pURIFactory: typeof XVSCodeFileSystemAdapter.prototype._URIFactory,
        pPathSeparator?: string
    ): void
    {
        this._VSCodeFS = pFS;
        this._URIFactory = pURIFactory;
        if (pPathSeparator)
            this._PathSeparator = pPathSeparator;
    }

    /**
     * Check if file exists
     */
    async FileExists(pPath: string): Promise<boolean>
    {
        if (!this._VSCodeFS || !this._URIFactory)
            throw new Error("VSCode filesystem not configured");

        try
        {
            const uri = this._URIFactory(pPath);
            const stat = await this._VSCodeFS.stat(uri);
            return stat.type === 1; // FileType.File
        }
        catch
        {
            return false;
        }
    }

    /**
     * Check if directory exists
     */
    async DirectoryExists(pPath: string): Promise<boolean>
    {
        if (!this._VSCodeFS || !this._URIFactory)
            throw new Error("VSCode filesystem not configured");

        try
        {
            const uri = this._URIFactory(pPath);
            const stat = await this._VSCodeFS.stat(uri);
            return stat.type === 2; // FileType.Directory
        }
        catch
        {
            return false;
        }
    }

    /**
     * Read file contents
     */
    async ReadFile(pPath: string): Promise<string>
    {
        if (!this._VSCodeFS || !this._URIFactory)
            throw new Error("VSCode filesystem not configured");

        const uri = this._URIFactory(pPath);
        const data = await this._VSCodeFS.readFile(uri);
        return new TextDecoder().decode(data);
    }

    /**
     * Write file contents
     */
    async WriteFile(pPath: string, pContent: string): Promise<void>
    {
        if (!this._VSCodeFS || !this._URIFactory)
            throw new Error("VSCode filesystem not configured");

        const uri = this._URIFactory(pPath);
        const data = new TextEncoder().encode(pContent);
        await this._VSCodeFS.writeFile(uri, data);
    }

    /**
     * Create directory
     */
    async CreateDirectory(pPath: string): Promise<void>
    {
        if (!this._VSCodeFS || !this._URIFactory)
            throw new Error("VSCode filesystem not configured");

        const uri = this._URIFactory(pPath);
        await this._VSCodeFS.createDirectory(uri);
    }

    /**
     * Get parent directory path
     */
    GetParentDirectory(pPath: string): string
    {
        const sep = this._PathSeparator;
        const normalized = pPath.replace(/[\\/]+$/, "");
        const lastSep = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
        
        if (lastSep <= 0)
            return normalized.substring(0, lastSep + 1) || sep;

        return normalized.substring(0, lastSep);
    }

    /**
     * Join path segments
     */
    JoinPath(...pSegments: string[]): string
    {
        return pSegments
            .map(s => s.replace(/[\\/]+$/, ""))
            .join(this._PathSeparator);
    }

    /**
     * Get directory name from path
     */
    GetDirectoryName(pPath: string): string
    {
        return this.GetParentDirectory(pPath);
    }

    /**
     * Check if path is root
     */
    IsRootPath(pPath: string): boolean
    {
        const normalized = pPath.replace(/[\\/]+$/, "");
        
        // Windows drive root: C: or C:\
        if (/^[A-Za-z]:$/.test(normalized) || /^[A-Za-z]:\\?$/.test(pPath))
            return true;

        // Unix root
        if (normalized === "" || normalized === "/")
            return true;

        return false;
    }
}
