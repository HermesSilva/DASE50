import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { XConfigResources } from "../src/Config/XConfigResources.js";
import { XConfigurationManager, XConfigTarget, XConfigGroup, type IFileSystemAdapter } from "../src/Config/XConfigurationManager.js";
import type { XORMTypesConfig } from "../src/Config/XConfigurationTypes.js";
import { XTypeResolver } from "../src/CodeGen/XTypeResolver.js";

const RECURSO = join(__dirname, "..", "src", "Config", "Resources", "ORM.DataType.json");

describe("recurso embarcado de tipos", () => {

    /**
     * `XConfigResources.GetORMDataType()` é o JSON de Resources/ transcrito em TypeScript,
     * e é ele que o DASE grava quando um repositório ainda não tem `.DASE/ORM.Types.json`.
     * Os dois são mantidos em sincronia por script; sem este teste, editar um e esquecer o
     * outro passaria despercebido até alguém gerar código com o mapa errado.
     */
    it("bate exatamente com Resources/ORM.DataType.json", () => {
        const doArquivo = JSON.parse(readFileSync(RECURSO, "utf-8"));
        expect(XConfigResources.GetORMDataType()).toEqual(doArquivo);
    });

    it("declara o formato v2", () => {
        expect(XConfigResources.GetORMDataType().Version).toBe(2);
    });

    it("todo tipo traz o mapeamento de geração para csharp-efcore", () => {
        const semMapa = XConfigResources.GetORMDataType()
            .Types.filter(t => !t.Mappings?.["csharp-efcore"])
            .map(t => t.TypeName);

        expect(semMapa).toEqual([]);
    });

    it("todo tipo resolve numa coluna concreta, sem lacuna", () => {
        const config = XConfigResources.GetORMDataType();
        const resolver = new XTypeResolver(config.Types, "csharp-efcore");

        for (const t of config.Types)
        {
            const r = resolver.Resolve({
                DataType: t.TypeName,
                Length: t.HasLength ? 10 : 0,
                Scale: t.HasScale ? 2 : 0,
                IsRequired: true
            });

            expect(r.Type, t.TypeName).toBeTruthy();
            expect(r.ColumnType, t.TypeName).toBeTruthy();
            expect(r.ColumnType, t.TypeName).not.toContain("{");
        }
    });
});

describe("criação automática do ORM.Types.json", () => {

    /** Filesystem em memória, para observar o que o manager grava de verdade. */
    function CriarFS(): { Adapter: IFileSystemAdapter; Escritos: Map<string, string>; Dirs: Set<string> }
    {
        const escritos = new Map<string, string>();
        const dirs = new Set<string>(["/repo"]);

        const adapter: IFileSystemAdapter = {
            FileExists: async p => escritos.has(p),
            DirectoryExists: async p => dirs.has(p),
            ReadFile: async p => escritos.get(p) ?? "",
            WriteFile: async (p, c) => { escritos.set(p, c); },
            CreateDirectory: async p => { dirs.add(p); },
            GetParentDirectory: p => p.split("/").slice(0, -1).join("/") || "/",
            JoinPath: (...s) => s.join("/"),
            GetDirectoryName: p => p.split("/").slice(0, -1).join("/") || "/",
            IsRootPath: p => p === "/" || p === ""
        };

        return { Adapter: adapter, Escritos: escritos, Dirs: dirs };
    }

    it("grava em .DASE/ORM.Types.json já com os Mappings", async () => {
        XConfigurationManager.ResetInstance();
        const fs = CriarFS();
        fs.Dirs.add("/repo/.git");

        const manager = XConfigurationManager.GetInstance();
        manager.SetFileSystem(fs.Adapter);

        const config = await manager.GetConfiguration<XORMTypesConfig>(
            XConfigTarget.ORM, XConfigGroup.DataType, "/repo/Modulo/MER.dsorm");

        // O nome do arquivo vem de {Target}.{Group}: ORM + Types.
        const caminho = "/repo/.DASE/ORM.Types.json";
        expect(fs.Escritos.has(caminho)).toBe(true);

        const gravado = JSON.parse(fs.Escritos.get(caminho)!) as XORMTypesConfig;
        expect(gravado.Version).toBe(2);
        expect(gravado.Types.length).toBe(config.Types.length);

        // O ponto que importa: quem começa do zero já consegue gerar código.
        const semMapa = gravado.Types.filter(t => !t.Mappings?.["csharp-efcore"]);
        expect(semMapa).toEqual([]);

        expect(new XTypeResolver(gravado.Types, "csharp-efcore").GetUnmappedTypes()).toEqual([]);
    });

    it("um ORM.Types.json v1 já existente é respeitado, não sobrescrito", async () => {
        XConfigurationManager.ResetInstance();
        const fs = CriarFS();
        fs.Dirs.add("/repo/.git");

        const v1 = {
            Name: "DSORMTypes", Target: "ORM", Group: "DataType",
            Types: [{
                TypeName: "String", CanUseInPK: false, HasLength: true, HasScale: false,
                CanUseInIndex: true, IsUTF8: true, CanAutoIncrement: false
            }]
        };
        fs.Escritos.set("/repo/.DASE/ORM.Types.json", JSON.stringify(v1));

        const manager = XConfigurationManager.GetInstance();
        manager.SetFileSystem(fs.Adapter);

        const config = await manager.GetConfiguration<XORMTypesConfig>(
            XConfigTarget.ORM, XConfigGroup.DataType, "/repo/Modulo/MER.dsorm");

        expect(config.Types.length).toBe(1);
        expect(config.Version).toBeUndefined();

        // v1 abre no designer; só a geração é que reclama do que falta.
        expect(new XTypeResolver(config.Types, "csharp-efcore").GetUnmappedTypes()).toEqual(["String"]);
    });
});
