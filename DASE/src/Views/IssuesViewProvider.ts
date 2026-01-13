import * as vscode from "vscode";
import { GetIssueService } from "../Services/IssueService";
import { GetSelectionService } from "../Services/SelectionService";
import { XIssueItem } from "../Models/IssueItem";

export class XIssuesViewProvider implements vscode.WebviewViewProvider
{
    // Context kept for future features (theming, storage)
    private readonly _Context: vscode.ExtensionContext;
    private _View: vscode.WebviewView | null;
    private _Issues: XIssueItem[];

    constructor(pContext: vscode.ExtensionContext)
    {
        this._Context = pContext;
        this._View = null;
        this._Issues = [];
    }

    static get ViewType(): string
    {
        return "Dase.Issues";
    }

    static Register(pContext: vscode.ExtensionContext): XIssuesViewProvider
    {
        const provider = new XIssuesViewProvider(pContext);
        const registration = vscode.window.registerWebviewViewProvider(
            XIssuesViewProvider.ViewType,
            provider
        );
        pContext.subscriptions.push(registration);
        return provider;
    }

    resolveWebviewView(pWebviewView: vscode.WebviewView, _pContext: vscode.WebviewViewResolveContext, _pToken: vscode.CancellationToken): void
    {
        this._View = pWebviewView;

        pWebviewView.webview.options = {
            enableScripts: true
        };

        pWebviewView.webview.html = this.GetHtmlContent();

        const issueService = GetIssueService();
        issueService.OnIssuesChanged((pIssues: XIssueItem[]) => {
            this._Issues = pIssues;
            this.UpdateView();
        });

        pWebviewView.webview.onDidReceiveMessage((pMsg: { Type: string; ElementID?: string }) => {
            if (pMsg.Type === "SelectIssue" && pMsg.ElementID)
            {
                const selectionService = GetSelectionService();
                selectionService.Select(pMsg.ElementID);
            }
        });
    }

    UpdateView(): void
    {
        if (this._View)
        {
            this._View.webview.postMessage({
                Type: "UpdateIssues",
                Issues: this._Issues
            });
        }
    }

    GetHtmlContent()
    {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-panel-background);
        }
        .issues-container {
            padding: 8px;
        }
        .issue-item {
            display: flex;
            align-items: flex-start;
            padding: 6px 8px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .issue-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .issue-icon {
            margin-right: 8px;
            flex-shrink: 0;
        }
        .issue-error {
            color: var(--vscode-errorForeground, #f14c4c);
        }
        .issue-warning {
            color: var(--vscode-editorWarning-foreground, #cca700);
        }
        .issue-info {
            color: var(--vscode-editorInfo-foreground, #3794ff);
        }
        .issue-content {
            flex-grow: 1;
        }
        .issue-message {
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .issue-element {
            font-size: 0.9em;
            opacity: 0.7;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .no-issues {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div class="issues-container" id="issues-container">
        <div class="no-issues">No issues</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            if (msg.Type === "UpdateIssues")
                RenderIssues(msg.Issues);
        });

        function RenderIssues(pIssues)
        {
            const container = document.getElementById("issues-container");
            
            if (!pIssues || pIssues.length === 0)
            {
                container.innerHTML = '<div class="no-issues">No issues</div>';
                return;
            }

            let html = "";
            for (const issue of pIssues)
            {
                const iconClass = issue.Severity === 2 ? "issue-error" : (issue.Severity === 1 ? "issue-warning" : "issue-info");
                const icon = issue.Severity === 2 ? "✕" : (issue.Severity === 1 ? "⚠" : "ℹ");
                
                html += '<div class="issue-item" data-element-id="' + issue.ElementID + '">';
                html += '<span class="issue-icon ' + iconClass + '">' + icon + '</span>';
                html += '<div class="issue-content">';
                html += '<div class="issue-message">' + EscapeHtml(issue.Message) + '</div>';
                html += '</div></div>';
            }
            
            container.innerHTML = html;

            const items = container.querySelectorAll(".issue-item");
            items.forEach(function(item) {
                item.addEventListener("click", function() {
                    const elementId = this.getAttribute("data-element-id");
                    vscode.postMessage({ Type: "SelectIssue", ElementID: elementId });
                });
            });
        }

        function EscapeHtml(pText)
        {
            const div = document.createElement("div");
            div.textContent = pText;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}
