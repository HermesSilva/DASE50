// Mock do módulo vscode para testes unitários

export class EventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];

    event = (listener: (e: T) => void): { dispose: () => void } => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const idx = this.listeners.indexOf(listener);
                if (idx >= 0) this.listeners.splice(idx, 1);
            }
        };
    };

    fire(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }

    dispose(): void {
        this.listeners = [];
    }
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}

export class TreeItem {
    public label?: string | { label: string };
    public id?: string;
    public iconPath?: unknown;
    public description?: string;
    public tooltip?: string | unknown;
    public command?: { command: string; title: string; arguments?: unknown[] };
    public contextValue?: string;
    public collapsibleState?: TreeItemCollapsibleState;

    constructor(label: string | { label: string }, collapsibleState?: TreeItemCollapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState ?? TreeItemCollapsibleState.None;
    }
}

export class ThemeIcon {
    public id: string;

    constructor(id: string) {
        this.id = id;
    }
}

export class MarkdownString {
    public value: string;
    public isTrusted?: boolean;
    public supportThemeIcons?: boolean;

    constructor(value?: string) {
        this.value = value ?? "";
    }

    appendText(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendMarkdown(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendCodeblock(value: string, language?: string): MarkdownString {
        this.value += `\`\`\`${language ?? ""}\n${value}\n\`\`\``;
        return this;
    }
}

export class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query: string;
    readonly fragment: string;
    readonly fsPath: string;

    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
        this.fsPath = path;
    }

    static parse(value: string): Uri {
        const colonIdx = value.indexOf(':');
        const scheme = colonIdx >= 0 ? value.substring(0, colonIdx) : 'file';
        const rest = colonIdx >= 0 ? value.substring(colonIdx + 1) : value;
        return new Uri(scheme, '', rest, '', '');
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    toString(): string {
        return `${this.scheme}:${this.path}`;
    }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment
        );
    }
}

export interface OutputChannel {
    name: string;
    append(value: string): void;
    appendLine(value: string): void;
    clear(): void;
    show(preserveFocus?: boolean): void;
    hide(): void;
    dispose(): void;
}

function createMockOutputChannel(name: string): OutputChannel {
    const lines: string[] = [];
    return {
        name,
        append: jest.fn((value: string) => lines.push(value)),
        appendLine: jest.fn((value: string) => lines.push(value + '\n')),
        clear: jest.fn(() => lines.length = 0),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
    };
}

export interface ExtensionContext {
    subscriptions: { dispose(): void }[];
    extensionPath: string;
    globalState: {
        get<T>(key: string): T | undefined;
        update(key: string, value: unknown): Thenable<void>;
    };
    workspaceState: {
        get<T>(key: string): T | undefined;
        update(key: string, value: unknown): Thenable<void>;
    };
}

export function createMockExtensionContext(): ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: '/mock/extension/path',
        globalState: {
            get: jest.fn(),
            update: jest.fn(() => Promise.resolve())
        },
        workspaceState: {
            get: jest.fn(),
            update: jest.fn(() => Promise.resolve())
        }
    };
}

export interface WebviewPanel {
    webview: {
        html: string;
        options: object;
        onDidReceiveMessage: (listener: (msg: unknown) => void) => { dispose(): void };
        postMessage: (message: unknown) => Thenable<boolean>;
        asWebviewUri: (localUri: Uri) => Uri;
        cspSource: string;
    };
    active: boolean;
    visible: boolean;
    onDidDispose: (listener: () => void) => { dispose(): void };
    onDidChangeViewState: (listener: () => void) => { dispose(): void };
    reveal(): void;
    dispose(): void;
}

export function createMockWebviewPanel(): WebviewPanel & { _disposeListeners: (() => void)[]; _viewStateListeners: ((e: { webviewPanel: WebviewPanel }) => void)[] } {
    const disposables: (() => void)[] = [];
    const messageListeners: ((msg: unknown) => void)[] = [];
    const viewStateListeners: ((e: { webviewPanel: WebviewPanel }) => void)[] = [];
    
    const onDidReceiveMessageMock = jest.fn((listener) => {
        messageListeners.push(listener);
        return { dispose: () => { } };
    });
    
    const onDidDisposeMock = jest.fn((listener: () => void) => {
        disposables.push(listener);
        return { dispose: () => { } };
    });

    const panel = {
        webview: {
            html: '',
            options: {},
            onDidReceiveMessage: onDidReceiveMessageMock,
            postMessage: jest.fn(() => Promise.resolve(true)),
            asWebviewUri: (uri: Uri) => uri,
            cspSource: 'mock-csp-source'
        },
        active: true,
        visible: true,
        onDidDispose: onDidDisposeMock,
        _disposeListeners: disposables,
        _viewStateListeners: viewStateListeners,
        onDidChangeViewState: jest.fn((listener: (e: { webviewPanel: WebviewPanel }) => void) => {
            viewStateListeners.push(listener);
            return { dispose: () => { } };
        }),
        reveal: jest.fn(),
        dispose: () => disposables.forEach(d => d())
    };
    
    return panel as WebviewPanel & { _disposeListeners: (() => void)[]; _viewStateListeners: ((e: { webviewPanel: WebviewPanel }) => void)[] };
}

export interface TextDocument {
    uri: Uri;
    fileName: string;
    languageId: string;
    version: number;
    isDirty: boolean;
    isUntitled: boolean;
    getText(range?: Range): string;
    lineAt(line: number): { text: string };
    lineCount: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface Position {
    line: number;
    character: number;
}

export function createMockTextDocument(uri: Uri, content: string = ''): TextDocument {
    const lines = content.split('\n');
    return {
        uri,
        fileName: uri.fsPath,
        languageId: 'json',
        version: 1,
        isDirty: false,
        isUntitled: uri.scheme === 'untitled',
        getText: () => content,
        lineAt: (line: number) => ({ text: lines[line] || '' }),
        lineCount: lines.length
    };
}

export const window = {
    createOutputChannel: jest.fn((name: string) => createMockOutputChannel(name)),
    showInformationMessage: jest.fn(() => Promise.resolve(undefined)),
    showWarningMessage: jest.fn(() => Promise.resolve(undefined)),
    showErrorMessage: jest.fn(() => Promise.resolve(undefined)),
    showInputBox: jest.fn(() => Promise.resolve(undefined)),
    showQuickPick: jest.fn(() => Promise.resolve(undefined)),
    registerCustomEditorProvider: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
    activeTextEditor: undefined as { document: TextDocument } | undefined
};

export const commands = {
    registerCommand: jest.fn(() => ({ dispose: () => { } })),
    executeCommand: jest.fn(() => Promise.resolve())
};

export const workspace = {
    fs: {
        readFile: jest.fn(() => Promise.resolve(Buffer.from('{}'))),
        writeFile: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),
        stat: jest.fn(() => Promise.resolve({ type: FileType.File })),
        createDirectory: jest.fn(() => Promise.resolve())
    },
    openTextDocument: jest.fn(),
    workspaceFolders: []
};

export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}

export { EventEmitter as Event };
