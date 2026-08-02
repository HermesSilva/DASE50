import * as http from "http";
import * as vscode from "vscode";
import type { AddressInfo } from "net";
import { XAgentBridge } from "../AgentBridge";
import { GetLogService } from "../../Services/LogService";

/** Protocol identifier written to the discovery file and reported by GET /bridge. */
export const BRIDGE_PROTOCOL = "dase-bridge/1";

/**
 * Bridge methods callable over HTTP. Typed against XAgentBridge so a rename there
 * breaks this list at compile time instead of silently 404ing external agents.
 */
const BRIDGE_METHODS = [
    // ── Document targeting ──
    "SetTargetDocument",
    "ClearTarget",
    // ── Read ──
    "GetModelInfo",
    "ListTables",
    "GetTableDetails",
    "GetProperties",
    "GetAvailableDataTypes",
    "ValidateModel",
    "ExportToDBML",
    "ListDocuments",
    "GetElementInfoText",
    "GetSeed",
    "GetIndexes",
    "GetShadowTableOptions",
    "GetOrganizationContextText",
    // ── Write ──
    "AddTable",
    "RenameTable",
    "DeleteTable",
    "MoveTable",
    "SetTableColor",
    "AddField",
    "RenameField",
    "DeleteField",
    "ReorderField",
    "AddReference",
    "MoveReferenceTarget",
    "DeleteReference",
    "UpdateProperty",
    "DeleteElementById",
    "RenameElementById",
    "AlignLines",
    "SaveSeed",
    "SaveIndexes",
    "AddShadowTable",
    "SaveActiveDocument",
    "CreateDocument",
    "ApplyOrganization",
    "RevertOrganizationText"
] as const satisfies ReadonlyArray<keyof XAgentBridge>;

type BridgeMethod = (typeof BRIDGE_METHODS)[number];

const METHOD_SET: ReadonlySet<string> = new Set(BRIDGE_METHODS);

/** Commands an external agent may trigger via the "ExecuteCommand" method. */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
    "Dase.OrganizeTablesAI",
    "Dase.CreateSQLScript",
    "Dase.GenerateORMCode",
    "Dase.ImportFromDBML",
    "Dase.ReloadDataTypes",
    "Dase.NewORMDesigner",
    "Dase.OpenORMDesigner"
]);

interface IBridgeRequest {
    method?: string;
    args?: unknown[];
}

/**
 * XAgentBridgeServer — DASE's "entrada" for external agents.
 *
 * A minimal loopback HTTP endpoint (POST /bridge) that exposes the public surface
 * of {@link XAgentBridge} plus a whitelisted command trigger. It speaks plain JSON
 * ({ method, args } → { ok, result | error }) — NO MCP protocol, NO MCP SDK, no
 * external dependencies. The standalone DASE-MCP product connects here and
 * translates the Model Context Protocol into these bridge calls.
 *
 * Transport: loopback only, ephemeral port by default. Security: loopback bind +
 * Origin header allowlist (DNS-rebind defense).
 */
export class XAgentBridgeServer {
    private _Http: http.Server | null = null;
    // Porta solicitada. Quando 0 (efêmera), o SO escolhe uma porta livre e a real
    // só é conhecida após o bind — por isso `_Port` é reatribuído no listen.
    private _Port: number;
    private readonly _Host = "127.0.0.1";

    constructor(pPort: number) {
        this._Port = pPort;
    }

    /** The full bridge endpoint URL. */
    get Url(): string {
        return `http://${this._Host}:${this._Port}/bridge`;
    }

    /** Start listening. Resolves once the socket is bound (or rejects on error). */
    Start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const server = http.createServer((req, res) => {
                this.HandleRequest(req, res).catch((err) => {
                    GetLogService().Error("Agent bridge request handling failed", err);
                    if (!res.headersSent)
                        this.WriteJson(res, 500, { ok: false, error: "Internal server error" });
                });
            });

            server.on("error", (err) => {
                GetLogService().Error(`Agent bridge server failed to start on ${this._Host}:${this._Port}`, err);
                reject(err);
            });

            server.listen(this._Port, this._Host, () => {
                this._Http = server;
                // Porta efêmera (0): captura a porta real atribuída pelo SO.
                const addr = server.address();
                if (addr && typeof addr === "object")
                    this._Port = (addr as AddressInfo).port;
                GetLogService().Info(`DASE agent bridge listening at ${this.Url}`);
                resolve();
            });
        });
    }

    /** Stop the server. */
    async Stop(): Promise<void> {
        if (this._Http) {
            await new Promise<void>((resolve) => this._Http!.close(() => resolve()));
            this._Http = null;
            GetLogService().Info("DASE agent bridge stopped");
        }
    }

    // ─── Request routing ────────────────────────────────────────────────────

    private async HandleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const url = new URL(req.url ?? "/", `http://${this._Host}:${this._Port}`);
        if (url.pathname !== "/bridge") {
            this.WriteJson(res, 404, { ok: false, error: "Not found" });
            return;
        }

        if (!this.IsOriginAllowed(req)) {
            this.WriteJson(res, 403, { ok: false, error: "Origin not allowed" });
            return;
        }

        if (req.method === "GET") {
            this.WriteJson(res, 200, {
                ok: true,
                result: {
                    name: "dase",
                    protocol: BRIDGE_PROTOCOL,
                    methods: [...BRIDGE_METHODS, "ExecuteCommand"],
                    commands: [...ALLOWED_COMMANDS]
                }
            });
            return;
        }

        if (req.method !== "POST") {
            this.WriteJson(res, 405, { ok: false, error: "Method not allowed" });
            return;
        }

        let body: IBridgeRequest;
        try {
            body = (await this.ReadJsonBody(req)) as IBridgeRequest ?? {};
        }
        catch {
            this.WriteJson(res, 400, { ok: false, error: "Invalid JSON body" });
            return;
        }

        const method = body.method;
        // JSON não tem `undefined`: parâmetros opcionais omitidos chegam como null.
        // Normaliza p/ undefined, que é o que a superfície do XAgentBridge espera.
        const args = (Array.isArray(body.args) ? body.args : [])
            .map((a) => a === null ? undefined : a);

        if (!method || typeof method !== "string") {
            this.WriteJson(res, 400, { ok: false, error: "Missing \"method\"" });
            return;
        }

        try {
            if (method === "ExecuteCommand") {
                const result = await this.ExecuteCommand(args);
                // Convenção: um comando disparado pode devolver { ok:false, error } para sinalizar
                // falha SEM lançar — o comando já a mostrou na UI, mas o agente precisa saber. Sem
                // isto, uma geração que falha voltava como "triggered" e o MCP reportava sucesso.
                if (result !== null && typeof result === "object"
                    && (result as { ok?: unknown }).ok === false
                    && typeof (result as { error?: unknown }).error === "string") {
                    this.WriteJson(res, 200, { ok: false, error: (result as { error: string }).error });
                    return;
                }
                this.WriteJson(res, 200, {
                    ok: true,
                    result: result === undefined || result === null
                        ? `Command "${String(args[0])}" triggered.`
                        : result
                });
                return;
            }

            if (!METHOD_SET.has(method)) {
                this.WriteJson(res, 400, { ok: false, error: `Unknown bridge method "${method}"` });
                return;
            }

            const bridge = XAgentBridge.GetInstance();
            const fn = bridge[method as BridgeMethod] as (...pArgs: unknown[]) => unknown;
            const result = await Promise.resolve(fn.apply(bridge, args));
            this.WriteJson(res, 200, { ok: true, result: result === undefined ? null : result });
        }
        catch (err) {
            GetLogService().Error(`Agent bridge call failed: ${method}`, err);
            this.WriteJson(res, 200, {
                ok: false,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    private async ExecuteCommand(pArgs: unknown[]): Promise<unknown> {
        const command = pArgs[0];
        if (typeof command !== "string" || !ALLOWED_COMMANDS.has(command))
            throw new Error(`Command not allowed: ${String(command)}`);
        // Sem argumento posicional: comandos como Dase.OpenORMDesigner leem o primeiro parâmetro
        // como URI, e injetar um marcador aqui os quebraria. O sinal de falha vem pelo VALOR de
        // retorno do comando (ver o tratamento de { ok:false, error } no chamador).
        return await vscode.commands.executeCommand(command);
    }

    // ─── Security helpers ───────────────────────────────────────────────────

    /**
     * Allow only requests without an Origin (native clients) or pointing at our own
     * loopback host. Blocks browser-based DNS-rebind attacks.
     */
    private IsOriginAllowed(req: http.IncomingMessage): boolean {
        const origin = req.headers["origin"];
        if (!origin) return true;
        try {
            const host = new URL(origin).hostname;
            return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
        }
        catch {
            return false;
        }
    }

    // ─── Low-level IO ───────────────────────────────────────────────────────

    private ReadJsonBody(req: http.IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on("data", (c: Buffer) => chunks.push(c));
            req.on("end", () => {
                const raw = Buffer.concat(chunks).toString("utf8").trim();
                if (!raw) { resolve(undefined); return; }
                try { resolve(JSON.parse(raw)); }
                catch (err) { reject(err); }
            });
            req.on("error", reject);
        });
    }

    private WriteJson(res: http.ServerResponse, pStatus: number, pPayload: unknown): void {
        res.writeHead(pStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify(pPayload));
    }
}
