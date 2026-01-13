import * as vscode from "vscode";
import * as path from "path";
import { IFileSystemAdapter } from "@tootega/tfx";

/**
 * VS Code filesystem adapter for XConfigurationManager
 * Uses VS Code's workspace filesystem API for file operations
 */
export class XVsCodeFileSystemAdapter implements IFileSystemAdapter
{
    async FileExists(pPath: string): Promise<boolean>
    {
        try
        {
            const uri = vscode.Uri.file(pPath);
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.type === vscode.FileType.File;
        }
        catch
        {
            return false;
        }
    }

    async DirectoryExists(pPath: string): Promise<boolean>
    {
        try
        {
            const uri = vscode.Uri.file(pPath);
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.type === vscode.FileType.Directory;
        }
        catch
        {
            return false;
        }
    }

    async ReadFile(pPath: string): Promise<string>
    {
        const uri = vscode.Uri.file(pPath);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString("utf-8");
    }

    async WriteFile(pPath: string, pContent: string): Promise<void>
    {
        const uri = vscode.Uri.file(pPath);
        const content = Buffer.from(pContent, "utf-8");
        await vscode.workspace.fs.writeFile(uri, content);
    }

    async CreateDirectory(pPath: string): Promise<void>
    {
        const uri = vscode.Uri.file(pPath);
        await vscode.workspace.fs.createDirectory(uri);
    }

    GetParentDirectory(pPath: string): string
    {
        return path.dirname(pPath);
    }

    JoinPath(...pSegments: string[]): string
    {
        return path.join(...pSegments);
    }

    GetDirectoryName(pPath: string): string
    {
        return path.dirname(pPath);
    }

    IsRootPath(pPath: string): boolean
    {
        const parsed = path.parse(pPath);
        return parsed.dir === parsed.root || pPath === parsed.root;
    }
}

