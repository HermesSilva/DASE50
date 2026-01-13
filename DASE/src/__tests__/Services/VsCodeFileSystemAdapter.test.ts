import { XVsCodeFileSystemAdapter } from "../../Services/VsCodeFileSystemAdapter";
import * as vscode from "vscode";
import { FileType } from "../__mocks__/vscode";

jest.mock("vscode");

describe("VsCodeFileSystemAdapter", () => {
    let adapter: XVsCodeFileSystemAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        adapter = new XVsCodeFileSystemAdapter();
    });

    describe("FileExists", () => {
        it("should return true when file exists", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.File
            });

            const result = await adapter.FileExists("C:\\test\\file.txt");

            expect(result).toBe(true);
        });

        it("should return false when path is a directory", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.Directory
            });

            const result = await adapter.FileExists("C:\\test");

            expect(result).toBe(false);
        });

        it("should return false when file does not exist", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error("Not found"));

            const result = await adapter.FileExists("C:\\nonexistent.txt");

            expect(result).toBe(false);
        });
    });

    describe("DirectoryExists", () => {
        it("should return true when directory exists", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.Directory
            });

            const result = await adapter.DirectoryExists("C:\\test");

            expect(result).toBe(true);
        });

        it("should return false when path is a file", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.File
            });

            const result = await adapter.DirectoryExists("C:\\test\\file.txt");

            expect(result).toBe(false);
        });

        it("should return false when directory does not exist", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error("Not found"));

            const result = await adapter.DirectoryExists("C:\\nonexistent");

            expect(result).toBe(false);
        });
    });

    describe("ReadFile", () => {
        it("should read file content as string", async () => {
            const content = "test content";
            const buffer = Buffer.from(content, "utf-8");
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(buffer);

            const result = await adapter.ReadFile("C:\\test\\file.txt");

            expect(result).toBe(content);
        });
    });

    describe("WriteFile", () => {
        it("should write content to file", async () => {
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            await adapter.WriteFile("C:\\test\\file.txt", "test content");

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });
    });

    describe("CreateDirectory", () => {
        it("should create directory", async () => {
            (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

            await adapter.CreateDirectory("C:\\test\\newdir");

            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });
    });

    describe("GetParentDirectory", () => {
        it("should return parent directory", () => {
            const result = adapter.GetParentDirectory("C:\\test\\subdir\\file.txt");
            expect(result).toBe("C:\\test\\subdir");
        });
    });

    describe("JoinPath", () => {
        it("should join path segments", () => {
            const result = adapter.JoinPath("C:\\test", "subdir", "file.txt");
            expect(result).toBe("C:\\test\\subdir\\file.txt");
        });
    });

    describe("GetDirectoryName", () => {
        it("should return directory name", () => {
            const result = adapter.GetDirectoryName("C:\\test\\subdir\\file.txt");
            expect(result).toBe("C:\\test\\subdir");
        });
    });

    describe("IsRootPath", () => {
        it("should return true for drive root", () => {
            const result = adapter.IsRootPath("C:\\");
            expect(result).toBe(true);
        });

        it("should return false for non-root path", () => {
            const result = adapter.IsRootPath("C:\\test\\subdir");
            expect(result).toBe(false);
        });
    });
});
