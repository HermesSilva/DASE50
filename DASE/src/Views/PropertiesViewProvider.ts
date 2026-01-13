import * as vscode from "vscode";
import { GetSelectionService } from "../Services/SelectionService";
import { XPropertyItem } from "../Models/PropertyItem";
import { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";
import { XDesignerSelection } from "../Models/DesignerSelection";

export class XPropertiesViewProvider implements vscode.WebviewViewProvider
{
    // Context kept for future features (theming, storage)
    private readonly _Context: vscode.ExtensionContext;
    private _DesignerProvider: XORMDesignerEditorProvider;
    private _View: vscode.WebviewView | null;
    private _Properties: XPropertyItem[];
    private _ElementID: string | null;

    constructor(pContext: vscode.ExtensionContext, pDesignerProvider: XORMDesignerEditorProvider)
    {
        this._Context = pContext;
        this._DesignerProvider = pDesignerProvider;
        this._View = null;
        this._Properties = [];
        this._ElementID = null;
        
        // Register selection listener immediately, not when webview resolves
        const selectionService = GetSelectionService();
        selectionService.OnSelectionChanged(async (pSelection: XDesignerSelection) => {
            this._ElementID = pSelection.PrimaryID;
            
            if (pSelection.PrimaryID)
            {
                const state = this._DesignerProvider.GetActiveState();
                if (state)
                    this._Properties = state.GetProperties(pSelection.PrimaryID);
                else
                    this._Properties = [];
            }
            else
                this._Properties = [];
            
            // If view is not resolved yet, try to reveal it
            if (!this._View && this._Properties.length > 0)
            {
                try
                {
                    await vscode.commands.executeCommand(`${XPropertiesViewProvider.ViewType}.focus`);
                }
                catch
                {
                    // Panel focus failed, will update on next visibility change
                }
            }
            
            this.UpdateView();
        });
    }

    static get ViewType(): string
    {
        return "Dase.Properties";
    }

    static Register(pContext: vscode.ExtensionContext, pDesignerProvider: XORMDesignerEditorProvider): XPropertiesViewProvider
    {
        const provider = new XPropertiesViewProvider(pContext, pDesignerProvider);
        const registration = vscode.window.registerWebviewViewProvider(
            XPropertiesViewProvider.ViewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
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

        // Always set fresh HTML content
        const htmlContent = this.GetHtmlContent();
        pWebviewView.webview.html = htmlContent;
        
        // Handle view disposal
        pWebviewView.onDidDispose(() => {
            this._View = null;
        });
        
        // Handle visibility changes - re-send properties when view becomes visible
        pWebviewView.onDidChangeVisibility(() => {
            if (pWebviewView.visible && this._Properties.length > 0)
                this.UpdateView();
        });
        
        // Update view with current properties (in case selection happened before resolve)
        this.UpdateView();

        pWebviewView.webview.onDidReceiveMessage((pMsg: { Type: string; PropertyKey?: string; Value?: unknown }) => {
            if (pMsg.Type === "UpdateProperty" && pMsg.PropertyKey !== undefined)
                this.OnPropertyChanged(pMsg.PropertyKey, pMsg.Value);
        });
    }

    async OnPropertyChanged(pPropertyKey: string, pValue: unknown): Promise<void>
    {
        if (!this._ElementID)
            return;

        const panel = this._DesignerProvider.GetActivePanel();
        const state = this._DesignerProvider.GetActiveState();

        if (!panel || !state)
            return;

        state.UpdateProperty(this._ElementID, pPropertyKey, pValue);
        
        this._Properties = await state.GetProperties(this._ElementID);
        this.UpdateView();

        const modelData = await state.GetModelData();
        panel.webview.postMessage({
            Type: "LoadModel",
            Payload: modelData
        });

        state.Save();
    }

    async SetProperties(pElementID: string, pProperties: XPropertyItem[]): Promise<void>
    {
        this._ElementID = pElementID;
        this._Properties = pProperties || [];
        this.UpdateView();
    }

    UpdateView(): void
    {
        if (this._View)
        {
            // Serialize properties to plain objects for webview transfer
            const serializedProperties = this._Properties.map(p => ({
                Key: p.Key,
                Name: p.Name,
                Value: p.Value,
                Type: p.Type,
                Options: p.Options,
                IsReadOnly: p.IsReadOnly,
                Category: p.Category,
                Group: p.Group
            }));
            
            // Force HTML refresh if webview script might not be initialized
            // This is a workaround for VS Code caching issues
            if (serializedProperties.length > 0)
                this._View.webview.html = this.GetHtmlContentWithProperties(serializedProperties);
            else
            {
                this._View.webview.postMessage({
                    Type: "UpdateProperties",
                    ElementID: this._ElementID,
                    Properties: serializedProperties
                });
            }
        }
    }
    
    GetHtmlContentWithProperties(pProperties: Array<{Key: string; Name: string; Value: unknown; Type: string; Options: string[] | null; IsReadOnly: boolean; Category: string; Group?: string}>): string
    {
        const propertiesJson = JSON.stringify(pProperties);
        const elementId = this._ElementID ? `"${this._ElementID}"` : "null";
        
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
        .properties-container {
            padding: 8px;
        }
        .property-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .property-name {
            flex: 0 0 40%;
            padding-right: 8px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .property-value {
            flex: 1;
        }
        .property-value input,
        .property-value select {
            width: 100%;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 6px;
            font-family: inherit;
            font-size: inherit;
        }
        .property-value input:focus,
        .property-value select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .property-value input[type="checkbox"] {
            width: auto;
        }
        .no-selection {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
        }
        .property-readonly {
            opacity: 0.6;
        }
        .color-dropdown {
            position: relative;
            width: 100%;
        }
        .color-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .color-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .color-dropdown-swatch {
            width: 16px;
            height: 12px;
            border: 1px solid var(--vscode-input-border);
            flex-shrink: 0;
        }
        .color-dropdown-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .color-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .color-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .color-dropdown.open .color-dropdown-list {
            display: block;
        }
        .color-dropdown-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .color-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .color-dropdown-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .property-group {
            margin-bottom: 8px;
        }
        .property-group-header {
            font-weight: 600;
            padding: 6px 0 4px 0;
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="properties-container" id="properties-container">
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentElementID = ${elementId};
        const initialProperties = ${propertiesJson};
        
        // Web Colors - sorted alphabetically by name
        const WebColors = [
            { name: "AliceBlue", hex: "#F0F8FF" },
            { name: "AntiqueWhite", hex: "#FAEBD7" },
            { name: "Aqua", hex: "#00FFFF" },
            { name: "Aquamarine", hex: "#7FFFD4" },
            { name: "Azure", hex: "#F0FFFF" },
            { name: "Beige", hex: "#F5F5DC" },
            { name: "Bisque", hex: "#FFE4C4" },
            { name: "Black", hex: "#000000" },
            { name: "BlanchedAlmond", hex: "#FFEBCD" },
            { name: "Blue", hex: "#0000FF" },
            { name: "BlueViolet", hex: "#8A2BE2" },
            { name: "Brown", hex: "#A52A2A" },
            { name: "BurlyWood", hex: "#DEB887" },
            { name: "CadetBlue", hex: "#5F9EA0" },
            { name: "Chartreuse", hex: "#7FFF00" },
            { name: "Chocolate", hex: "#D2691E" },
            { name: "Coral", hex: "#FF7F50" },
            { name: "CornflowerBlue", hex: "#6495ED" },
            { name: "Cornsilk", hex: "#FFF8DC" },
            { name: "Crimson", hex: "#DC143C" },
            { name: "Cyan", hex: "#00FFFF" },
            { name: "DarkBlue", hex: "#00008B" },
            { name: "DarkCyan", hex: "#008B8B" },
            { name: "DarkGoldenrod", hex: "#B8860B" },
            { name: "DarkGray", hex: "#A9A9A9" },
            { name: "DarkGreen", hex: "#006400" },
            { name: "DarkKhaki", hex: "#BDB76B" },
            { name: "DarkMagenta", hex: "#8B008B" },
            { name: "DarkOliveGreen", hex: "#556B2F" },
            { name: "DarkOrange", hex: "#FF8C00" },
            { name: "DarkOrchid", hex: "#9932CC" },
            { name: "DarkRed", hex: "#8B0000" },
            { name: "DarkSalmon", hex: "#E9967A" },
            { name: "DarkSeaGreen", hex: "#8FBC8F" },
            { name: "DarkSlateBlue", hex: "#483D8B" },
            { name: "DarkSlateGray", hex: "#2F4F4F" },
            { name: "DarkTurquoise", hex: "#00CED1" },
            { name: "DarkViolet", hex: "#9400D3" },
            { name: "DeepPink", hex: "#FF1493" },
            { name: "DeepSkyBlue", hex: "#00BFFF" },
            { name: "DimGray", hex: "#696969" },
            { name: "DodgerBlue", hex: "#1E90FF" },
            { name: "FireBrick", hex: "#B22222" },
            { name: "FloralWhite", hex: "#FFFAF0" },
            { name: "ForestGreen", hex: "#228B22" },
            { name: "Fuchsia", hex: "#FF00FF" },
            { name: "Gainsboro", hex: "#DCDCDC" },
            { name: "GhostWhite", hex: "#F8F8FF" },
            { name: "Gold", hex: "#FFD700" },
            { name: "Goldenrod", hex: "#DAA520" },
            { name: "Gray", hex: "#808080" },
            { name: "Green", hex: "#008000" },
            { name: "GreenYellow", hex: "#ADFF2F" },
            { name: "Honeydew", hex: "#F0FFF0" },
            { name: "HotPink", hex: "#FF69B4" },
            { name: "IndianRed", hex: "#CD5C5C" },
            { name: "Indigo", hex: "#4B0082" },
            { name: "Ivory", hex: "#FFFFF0" },
            { name: "Khaki", hex: "#F0E68C" },
            { name: "Lavender", hex: "#E6E6FA" },
            { name: "LavenderBlush", hex: "#FFF0F5" },
            { name: "LawnGreen", hex: "#7CFC00" },
            { name: "LemonChiffon", hex: "#FFFACD" },
            { name: "LightBlue", hex: "#ADD8E6" },
            { name: "LightCoral", hex: "#F08080" },
            { name: "LightCyan", hex: "#E0FFFF" },
            { name: "LightGoldenrodYellow", hex: "#FAFAD2" },
            { name: "LightGray", hex: "#D3D3D3" },
            { name: "LightGreen", hex: "#90EE90" },
            { name: "LightPink", hex: "#FFB6C1" },
            { name: "LightSalmon", hex: "#FFA07A" },
            { name: "LightSeaGreen", hex: "#20B2AA" },
            { name: "LightSkyBlue", hex: "#87CEFA" },
            { name: "LightSlateGray", hex: "#778899" },
            { name: "LightSteelBlue", hex: "#B0C4DE" },
            { name: "LightYellow", hex: "#FFFFE0" },
            { name: "Lime", hex: "#00FF00" },
            { name: "LimeGreen", hex: "#32CD32" },
            { name: "Linen", hex: "#FAF0E6" },
            { name: "Magenta", hex: "#FF00FF" },
            { name: "Maroon", hex: "#800000" },
            { name: "MediumAquamarine", hex: "#66CDAA" },
            { name: "MediumBlue", hex: "#0000CD" },
            { name: "MediumOrchid", hex: "#BA55D3" },
            { name: "MediumPurple", hex: "#9370DB" },
            { name: "MediumSeaGreen", hex: "#3CB371" },
            { name: "MediumSlateBlue", hex: "#7B68EE" },
            { name: "MediumSpringGreen", hex: "#00FA9A" },
            { name: "MediumTurquoise", hex: "#48D1CC" },
            { name: "MediumVioletRed", hex: "#C71585" },
            { name: "MidnightBlue", hex: "#191970" },
            { name: "MintCream", hex: "#F5FFFA" },
            { name: "MistyRose", hex: "#FFE4E1" },
            { name: "Moccasin", hex: "#FFE4B5" },
            { name: "NavajoWhite", hex: "#FFDEAD" },
            { name: "Navy", hex: "#000080" },
            { name: "OldLace", hex: "#FDF5E6" },
            { name: "Olive", hex: "#808000" },
            { name: "OliveDrab", hex: "#6B8E23" },
            { name: "Orange", hex: "#FFA500" },
            { name: "OrangeRed", hex: "#FF4500" },
            { name: "Orchid", hex: "#DA70D6" },
            { name: "PaleGoldenrod", hex: "#EEE8AA" },
            { name: "PaleGreen", hex: "#98FB98" },
            { name: "PaleTurquoise", hex: "#AFEEEE" },
            { name: "PaleVioletRed", hex: "#DB7093" },
            { name: "PapayaWhip", hex: "#FFEFD5" },
            { name: "PeachPuff", hex: "#FFDAB9" },
            { name: "Peru", hex: "#CD853F" },
            { name: "Pink", hex: "#FFC0CB" },
            { name: "Plum", hex: "#DDA0DD" },
            { name: "PowderBlue", hex: "#B0E0E6" },
            { name: "Purple", hex: "#800080" },
            { name: "Red", hex: "#FF0000" },
            { name: "RosyBrown", hex: "#BC8F8F" },
            { name: "RoyalBlue", hex: "#4169E1" },
            { name: "SaddleBrown", hex: "#8B4513" },
            { name: "Salmon", hex: "#FA8072" },
            { name: "SandyBrown", hex: "#F4A460" },
            { name: "SeaGreen", hex: "#2E8B57" },
            { name: "Seashell", hex: "#FFF5EE" },
            { name: "Sienna", hex: "#A0522D" },
            { name: "Silver", hex: "#C0C0C0" },
            { name: "SkyBlue", hex: "#87CEEB" },
            { name: "SlateBlue", hex: "#6A5ACD" },
            { name: "SlateGray", hex: "#708090" },
            { name: "Snow", hex: "#FFFAFA" },
            { name: "SpringGreen", hex: "#00FF7F" },
            { name: "SteelBlue", hex: "#4682B4" },
            { name: "Tan", hex: "#D2B48C" },
            { name: "Teal", hex: "#008080" },
            { name: "Thistle", hex: "#D8BFD8" },
            { name: "Tomato", hex: "#FF6347" },
            { name: "Turquoise", hex: "#40E0D0" },
            { name: "Violet", hex: "#EE82EE" },
            { name: "Wheat", hex: "#F5DEB3" },
            { name: "White", hex: "#FFFFFF" },
            { name: "WhiteSmoke", hex: "#F5F5F5" },
            { name: "Yellow", hex: "#FFFF00" },
            { name: "YellowGreen", hex: "#9ACD32" }
        ];
        
        console.log("[PropertiesWebview] Script initialized with", initialProperties.length, "properties");
        
        // Render initial properties immediately
        RenderProperties(initialProperties);
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            console.log("[PropertiesWebview] Message received:", msg.Type, msg);
            if (msg.Type === "UpdateProperties")
            {
                console.log("[PropertiesWebview] UpdateProperties - ElementID:", msg.ElementID, "Properties count:", msg.Properties?.length);
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            console.log("[PropertiesWebview] RenderProperties called with:", pProperties?.length || 0, "properties");
            const container = document.getElementById("properties-container");
            
            if (!pProperties || pProperties.length === 0)
            {
                container.innerHTML = '<div class="no-selection">No element selected</div>';
                return;
            }

            const groups = new Map();
            for (const prop of pProperties)
            {
                const grp = prop.Group || "General";
                if (!groups.has(grp))
                    groups.set(grp, []);
                groups.get(grp).push(prop);
            }

            let html = "";
            for (const [grpName, grpProps] of groups)
            {
                html += '<div class="property-group">';
                html += '<div class="property-group-header">' + EscapeHtml(grpName) + '</div>';
                for (const prop of grpProps)
                {
                    html += '<div class="property-row">';
                    html += '<div class="property-name" title="' + EscapeHtml(prop.Key) + '">' + EscapeHtml(prop.Name) + '</div>';
                    html += '<div class="property-value">';
                    html += GetPropertyEditor(prop);
                    html += '</div></div>';
                }
                html += '</div>';
            }
            
            container.innerHTML = html;
            AttachEventHandlers();
        }

        function FindColorName(pHex)
        {
            const upperHex = pHex.toUpperCase();
            for (const c of WebColors)
            {
                if (c.hex.toUpperCase() === upperHex)
                    return c.name;
            }
            return pHex;
        }

        function GetPropertyEditor(pProp)
        {
            const key = EscapeHtml(pProp.Key);
            const value = pProp.Value !== null && pProp.Value !== undefined ? pProp.Value : "";
            const readonly = pProp.Key === "ID" ? "readonly" : "";

            switch (pProp.Type)
            {
                case "Boolean":
                    const checked = pProp.Value ? "checked" : "";
                    return '<input type="checkbox" data-key="' + key + '" ' + checked + '>';

                case "Number":
                    return '<input type="number" data-key="' + key + '" value="' + value + '" ' + readonly + '>';

                case "Enum":
                    let options = "";
                    if (pProp.Options)
                    {
                        for (const opt of pProp.Options)
                        {
                            const selected = opt === value ? "selected" : "";
                            options += '<option value="' + EscapeHtml(opt) + '" ' + selected + '>' + EscapeHtml(opt) + '</option>';
                        }
                    }
                    return '<select data-key="' + key + '">' + options + '</select>';

                case "Color":
                    const hexColor = ConvertToHtmlColor(value);
                    const selectedColor = WebColors.find(function(c) { return c.hex.toUpperCase() === hexColor.toUpperCase(); }) || { name: "Unknown", hex: hexColor };
                    let colorItems = "";
                    for (const c of WebColors)
                    {
                        const isSelected = c.hex.toUpperCase() === hexColor.toUpperCase();
                        colorItems += '<div class="color-dropdown-item' + (isSelected ? ' selected' : '') + '" data-value="' + c.hex + '">' +
                                     '<div class="color-dropdown-swatch" style="background-color:' + c.hex + '"></div>' +
                                     '<span class="color-dropdown-name">' + c.name + '</span></div>';
                    }
                    return '<div class="color-dropdown" data-key="' + key + '">' +
                           '<div class="color-dropdown-selected">' +
                           '<div class="color-dropdown-swatch" style="background-color:' + hexColor + '"></div>' +
                           '<span class="color-dropdown-name">' + selectedColor.name + '</span>' +
                           '<span class="color-dropdown-arrow">▼</span></div>' +
                           '<div class="color-dropdown-list">' + colorItems + '</div></div>';

                default:
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + '>';
            }
        }

        function ConvertToHtmlColor(pArgbHex)
        {
            if (!pArgbHex || pArgbHex.length !== 8)
                return "#000000";
            return "#" + pArgbHex.substring(2);
        }

        function ConvertFromHtmlColor(pHtmlColor)
        {
            if (!pHtmlColor || pHtmlColor.length !== 7)
                return "FF000000";
            return "FF" + pHtmlColor.substring(1).toUpperCase();
        }

        function AttachEventHandlers()
        {
            // Handle regular inputs and selects
            const inputs = document.querySelectorAll("input, select");
            inputs.forEach(function(input) {
                input.addEventListener("change", function() {
                    const key = this.getAttribute("data-key");
                    let value;
                    
                    if (this.type === "checkbox")
                        value = this.checked;
                    else if (this.type === "number")
                        value = parseFloat(this.value) || 0;
                    else
                        value = this.value;

                    vscode.postMessage({
                        Type: "UpdateProperty",
                        PropertyKey: key,
                        Value: value
                    });
                });
            });

            // Handle custom color dropdowns
            const colorDropdowns = document.querySelectorAll(".color-dropdown");
            colorDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".color-dropdown-selected");
                const list = dropdown.querySelector(".color-dropdown-list");
                const items = dropdown.querySelectorAll(".color-dropdown-item");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    // Close other dropdowns
                    document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                items.forEach(function(item) {
                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        const hexValue = this.getAttribute("data-value");
                        const colorName = this.querySelector(".color-dropdown-name").textContent;
                        const key = dropdown.getAttribute("data-key");

                        // Update selected display
                        selected.querySelector(".color-dropdown-swatch").style.backgroundColor = hexValue;
                        selected.querySelector(".color-dropdown-name").textContent = colorName;

                        // Update selected state in list
                        items.forEach(function(i) { i.classList.remove("selected"); });
                        this.classList.add("selected");

                        // Close dropdown
                        dropdown.classList.remove("open");

                        // Send update
                        vscode.postMessage({
                            Type: "UpdateProperty",
                            PropertyKey: key,
                            Value: ConvertFromHtmlColor(hexValue)
                        });
                    });
                });
            });

            // Close dropdowns when clicking outside
            document.addEventListener("click", function() {
                document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
            });
        }

        function EscapeHtml(pText)
        {
            if (pText === null || pText === undefined)
                return "";
            const div = document.createElement("div");
            div.textContent = String(pText);
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
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
        .properties-container {
            padding: 8px;
        }
        .property-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .property-name {
            flex: 0 0 40%;
            padding-right: 8px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .property-value {
            flex: 1;
        }
        .property-value input,
        .property-value select {
            width: 100%;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 6px;
            font-family: inherit;
            font-size: inherit;
        }
        .property-value input:focus,
        .property-value select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .property-value input[type="checkbox"] {
            width: auto;
        }
        .no-selection {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
        }
        .property-readonly {
            opacity: 0.6;
        }
        .property-group {
            margin-bottom: 8px;
        }
        .property-group-header {
            font-weight: 600;
            padding: 6px 0 4px 0;
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.8;
        }
        .color-dropdown {
            position: relative;
            width: 100%;
        }
        .color-dropdown-selected {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            cursor: pointer;
            min-height: 20px;
        }
        .color-dropdown-selected:hover {
            border-color: var(--vscode-focusBorder);
        }
        .color-dropdown-swatch {
            width: 16px;
            height: 12px;
            border: 1px solid var(--vscode-input-border);
            flex-shrink: 0;
        }
        .color-dropdown-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .color-dropdown-arrow {
            margin-left: auto;
            font-size: 10px;
        }
        .color-dropdown-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            z-index: 1000;
        }
        .color-dropdown.open .color-dropdown-list {
            display: block;
        }
        .color-dropdown-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            cursor: pointer;
        }
        .color-dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .color-dropdown-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
    </style>
</head>
<body>
    <div class="properties-container" id="properties-container">
        <div class="no-selection">No element selected</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentElementID = null;
        
        // Web Colors - sorted alphabetically by name
        const WebColors = [
            { name: "AliceBlue", hex: "#F0F8FF" },
            { name: "AntiqueWhite", hex: "#FAEBD7" },
            { name: "Aqua", hex: "#00FFFF" },
            { name: "Aquamarine", hex: "#7FFFD4" },
            { name: "Azure", hex: "#F0FFFF" },
            { name: "Beige", hex: "#F5F5DC" },
            { name: "Bisque", hex: "#FFE4C4" },
            { name: "Black", hex: "#000000" },
            { name: "BlanchedAlmond", hex: "#FFEBCD" },
            { name: "Blue", hex: "#0000FF" },
            { name: "BlueViolet", hex: "#8A2BE2" },
            { name: "Brown", hex: "#A52A2A" },
            { name: "BurlyWood", hex: "#DEB887" },
            { name: "CadetBlue", hex: "#5F9EA0" },
            { name: "Chartreuse", hex: "#7FFF00" },
            { name: "Chocolate", hex: "#D2691E" },
            { name: "Coral", hex: "#FF7F50" },
            { name: "CornflowerBlue", hex: "#6495ED" },
            { name: "Cornsilk", hex: "#FFF8DC" },
            { name: "Crimson", hex: "#DC143C" },
            { name: "Cyan", hex: "#00FFFF" },
            { name: "DarkBlue", hex: "#00008B" },
            { name: "DarkCyan", hex: "#008B8B" },
            { name: "DarkGoldenrod", hex: "#B8860B" },
            { name: "DarkGray", hex: "#A9A9A9" },
            { name: "DarkGreen", hex: "#006400" },
            { name: "DarkKhaki", hex: "#BDB76B" },
            { name: "DarkMagenta", hex: "#8B008B" },
            { name: "DarkOliveGreen", hex: "#556B2F" },
            { name: "DarkOrange", hex: "#FF8C00" },
            { name: "DarkOrchid", hex: "#9932CC" },
            { name: "DarkRed", hex: "#8B0000" },
            { name: "DarkSalmon", hex: "#E9967A" },
            { name: "DarkSeaGreen", hex: "#8FBC8F" },
            { name: "DarkSlateBlue", hex: "#483D8B" },
            { name: "DarkSlateGray", hex: "#2F4F4F" },
            { name: "DarkTurquoise", hex: "#00CED1" },
            { name: "DarkViolet", hex: "#9400D3" },
            { name: "DeepPink", hex: "#FF1493" },
            { name: "DeepSkyBlue", hex: "#00BFFF" },
            { name: "DimGray", hex: "#696969" },
            { name: "DodgerBlue", hex: "#1E90FF" },
            { name: "FireBrick", hex: "#B22222" },
            { name: "FloralWhite", hex: "#FFFAF0" },
            { name: "ForestGreen", hex: "#228B22" },
            { name: "Fuchsia", hex: "#FF00FF" },
            { name: "Gainsboro", hex: "#DCDCDC" },
            { name: "GhostWhite", hex: "#F8F8FF" },
            { name: "Gold", hex: "#FFD700" },
            { name: "Goldenrod", hex: "#DAA520" },
            { name: "Gray", hex: "#808080" },
            { name: "Green", hex: "#008000" },
            { name: "GreenYellow", hex: "#ADFF2F" },
            { name: "Honeydew", hex: "#F0FFF0" },
            { name: "HotPink", hex: "#FF69B4" },
            { name: "IndianRed", hex: "#CD5C5C" },
            { name: "Indigo", hex: "#4B0082" },
            { name: "Ivory", hex: "#FFFFF0" },
            { name: "Khaki", hex: "#F0E68C" },
            { name: "Lavender", hex: "#E6E6FA" },
            { name: "LavenderBlush", hex: "#FFF0F5" },
            { name: "LawnGreen", hex: "#7CFC00" },
            { name: "LemonChiffon", hex: "#FFFACD" },
            { name: "LightBlue", hex: "#ADD8E6" },
            { name: "LightCoral", hex: "#F08080" },
            { name: "LightCyan", hex: "#E0FFFF" },
            { name: "LightGoldenrodYellow", hex: "#FAFAD2" },
            { name: "LightGray", hex: "#D3D3D3" },
            { name: "LightGreen", hex: "#90EE90" },
            { name: "LightPink", hex: "#FFB6C1" },
            { name: "LightSalmon", hex: "#FFA07A" },
            { name: "LightSeaGreen", hex: "#20B2AA" },
            { name: "LightSkyBlue", hex: "#87CEFA" },
            { name: "LightSlateGray", hex: "#778899" },
            { name: "LightSteelBlue", hex: "#B0C4DE" },
            { name: "LightYellow", hex: "#FFFFE0" },
            { name: "Lime", hex: "#00FF00" },
            { name: "LimeGreen", hex: "#32CD32" },
            { name: "Linen", hex: "#FAF0E6" },
            { name: "Magenta", hex: "#FF00FF" },
            { name: "Maroon", hex: "#800000" },
            { name: "MediumAquamarine", hex: "#66CDAA" },
            { name: "MediumBlue", hex: "#0000CD" },
            { name: "MediumOrchid", hex: "#BA55D3" },
            { name: "MediumPurple", hex: "#9370DB" },
            { name: "MediumSeaGreen", hex: "#3CB371" },
            { name: "MediumSlateBlue", hex: "#7B68EE" },
            { name: "MediumSpringGreen", hex: "#00FA9A" },
            { name: "MediumTurquoise", hex: "#48D1CC" },
            { name: "MediumVioletRed", hex: "#C71585" },
            { name: "MidnightBlue", hex: "#191970" },
            { name: "MintCream", hex: "#F5FFFA" },
            { name: "MistyRose", hex: "#FFE4E1" },
            { name: "Moccasin", hex: "#FFE4B5" },
            { name: "NavajoWhite", hex: "#FFDEAD" },
            { name: "Navy", hex: "#000080" },
            { name: "OldLace", hex: "#FDF5E6" },
            { name: "Olive", hex: "#808000" },
            { name: "OliveDrab", hex: "#6B8E23" },
            { name: "Orange", hex: "#FFA500" },
            { name: "OrangeRed", hex: "#FF4500" },
            { name: "Orchid", hex: "#DA70D6" },
            { name: "PaleGoldenrod", hex: "#EEE8AA" },
            { name: "PaleGreen", hex: "#98FB98" },
            { name: "PaleTurquoise", hex: "#AFEEEE" },
            { name: "PaleVioletRed", hex: "#DB7093" },
            { name: "PapayaWhip", hex: "#FFEFD5" },
            { name: "PeachPuff", hex: "#FFDAB9" },
            { name: "Peru", hex: "#CD853F" },
            { name: "Pink", hex: "#FFC0CB" },
            { name: "Plum", hex: "#DDA0DD" },
            { name: "PowderBlue", hex: "#B0E0E6" },
            { name: "Purple", hex: "#800080" },
            { name: "Red", hex: "#FF0000" },
            { name: "RosyBrown", hex: "#BC8F8F" },
            { name: "RoyalBlue", hex: "#4169E1" },
            { name: "SaddleBrown", hex: "#8B4513" },
            { name: "Salmon", hex: "#FA8072" },
            { name: "SandyBrown", hex: "#F4A460" },
            { name: "SeaGreen", hex: "#2E8B57" },
            { name: "Seashell", hex: "#FFF5EE" },
            { name: "Sienna", hex: "#A0522D" },
            { name: "Silver", hex: "#C0C0C0" },
            { name: "SkyBlue", hex: "#87CEEB" },
            { name: "SlateBlue", hex: "#6A5ACD" },
            { name: "SlateGray", hex: "#708090" },
            { name: "Snow", hex: "#FFFAFA" },
            { name: "SpringGreen", hex: "#00FF7F" },
            { name: "SteelBlue", hex: "#4682B4" },
            { name: "Tan", hex: "#D2B48C" },
            { name: "Teal", hex: "#008080" },
            { name: "Thistle", hex: "#D8BFD8" },
            { name: "Tomato", hex: "#FF6347" },
            { name: "Turquoise", hex: "#40E0D0" },
            { name: "Violet", hex: "#EE82EE" },
            { name: "Wheat", hex: "#F5DEB3" },
            { name: "White", hex: "#FFFFFF" },
            { name: "WhiteSmoke", hex: "#F5F5F5" },
            { name: "Yellow", hex: "#FFFF00" },
            { name: "YellowGreen", hex: "#9ACD32" }
        ];
        
        console.log("[PropertiesWebview] Script initialized");
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            console.log("[PropertiesWebview] Message received:", msg.Type, msg);
            if (msg.Type === "UpdateProperties")
            {
                console.log("[PropertiesWebview] UpdateProperties - ElementID:", msg.ElementID, "Properties count:", msg.Properties?.length);
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            console.log("[PropertiesWebview] RenderProperties called with:", pProperties);
            const container = document.getElementById("properties-container");
            
            if (!pProperties || pProperties.length === 0)
            {
                container.innerHTML = '<div class="no-selection">No element selected</div>';
                return;
            }

            const groups = new Map();
            for (const prop of pProperties)
            {
                const grp = prop.Group || "General";
                if (!groups.has(grp))
                    groups.set(grp, []);
                groups.get(grp).push(prop);
            }

            let html = "";
            for (const [grpName, grpProps] of groups)
            {
                html += '<div class="property-group">';
                html += '<div class="property-group-header">' + EscapeHtml(grpName) + '</div>';
                for (const prop of grpProps)
                {
                    html += '<div class="property-row">';
                    html += '<div class="property-name" title="' + EscapeHtml(prop.Key) + '">' + EscapeHtml(prop.Name) + '</div>';
                    html += '<div class="property-value">';
                    html += GetPropertyEditor(prop);
                    html += '</div></div>';
                }
                html += '</div>';
            }
            
            container.innerHTML = html;
            AttachEventHandlers();
        }

        function GetPropertyEditor(pProp)
        {
            const key = EscapeHtml(pProp.Key);
            const value = pProp.Value !== null && pProp.Value !== undefined ? pProp.Value : "";
            const readonly = pProp.Key === "ID" ? "readonly" : "";

            switch (pProp.Type)
            {
                case "Boolean":
                    const checked = pProp.Value ? "checked" : "";
                    return '<input type="checkbox" data-key="' + key + '" ' + checked + '>';

                case "Number":
                    return '<input type="number" data-key="' + key + '" value="' + value + '" ' + readonly + '>';

                case "Enum":
                    let options = "";
                    if (pProp.Options)
                    {
                        for (const opt of pProp.Options)
                        {
                            const selected = opt === value ? "selected" : "";
                            options += '<option value="' + EscapeHtml(opt) + '" ' + selected + '>' + EscapeHtml(opt) + '</option>';
                        }
                    }
                    return '<select data-key="' + key + '">' + options + '</select>';

                case "Color":
                    const hexColor = ConvertToHtmlColor(value);
                    const selectedColor = WebColors.find(function(c) { return c.hex.toUpperCase() === hexColor.toUpperCase(); }) || { name: "Unknown", hex: hexColor };
                    let colorItems = "";
                    for (const c of WebColors)
                    {
                        const isSelected = c.hex.toUpperCase() === hexColor.toUpperCase();
                        colorItems += '<div class="color-dropdown-item' + (isSelected ? ' selected' : '') + '" data-value="' + c.hex + '">' +
                                     '<div class="color-dropdown-swatch" style="background-color:' + c.hex + '"></div>' +
                                     '<span class="color-dropdown-name">' + c.name + '</span></div>';
                    }
                    return '<div class="color-dropdown" data-key="' + key + '">' +
                           '<div class="color-dropdown-selected">' +
                           '<div class="color-dropdown-swatch" style="background-color:' + hexColor + '"></div>' +
                           '<span class="color-dropdown-name">' + selectedColor.name + '</span>' +
                           '<span class="color-dropdown-arrow">▼</span></div>' +
                           '<div class="color-dropdown-list">' + colorItems + '</div></div>';

                default:
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + '>';
            }
        }

        function ConvertToHtmlColor(pArgbHex)
        {
            // Convert AARRGGBB to #RRGGBB for HTML color input
            if (!pArgbHex || pArgbHex.length !== 8)
                return "#000000";
            return "#" + pArgbHex.substring(2);
        }

        function ConvertFromHtmlColor(pHtmlColor)
        {
            // Convert #RRGGBB to FFRRGGBB (full opacity)
            if (!pHtmlColor || pHtmlColor.length !== 7)
                return "FF000000";
            return "FF" + pHtmlColor.substring(1).toUpperCase();
        }

        function AttachEventHandlers()
        {
            // Handle regular inputs and selects
            const inputs = document.querySelectorAll("input, select");
            inputs.forEach(function(input) {
                input.addEventListener("change", function() {
                    const key = this.getAttribute("data-key");
                    let value;
                    
                    if (this.type === "checkbox")
                        value = this.checked;
                    else if (this.type === "number")
                        value = parseFloat(this.value) || 0;
                    else
                        value = this.value;

                    vscode.postMessage({
                        Type: "UpdateProperty",
                        PropertyKey: key,
                        Value: value
                    });
                });
            });

            // Handle custom color dropdowns
            const colorDropdowns = document.querySelectorAll(".color-dropdown");
            colorDropdowns.forEach(function(dropdown) {
                const selected = dropdown.querySelector(".color-dropdown-selected");
                const list = dropdown.querySelector(".color-dropdown-list");
                const items = dropdown.querySelectorAll(".color-dropdown-item");

                selected.addEventListener("click", function(e) {
                    e.stopPropagation();
                    // Close other dropdowns
                    document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                        if (d !== dropdown) d.classList.remove("open");
                    });
                    dropdown.classList.toggle("open");
                });

                items.forEach(function(item) {
                    item.addEventListener("click", function(e) {
                        e.stopPropagation();
                        const hexValue = this.getAttribute("data-value");
                        const colorName = this.querySelector(".color-dropdown-name").textContent;
                        const key = dropdown.getAttribute("data-key");

                        // Update selected display
                        selected.querySelector(".color-dropdown-swatch").style.backgroundColor = hexValue;
                        selected.querySelector(".color-dropdown-name").textContent = colorName;

                        // Update selected state in list
                        items.forEach(function(i) { i.classList.remove("selected"); });
                        this.classList.add("selected");

                        // Close dropdown
                        dropdown.classList.remove("open");

                        // Send update
                        vscode.postMessage({
                            Type: "UpdateProperty",
                            PropertyKey: key,
                            Value: ConvertFromHtmlColor(hexValue)
                        });
                    });
                });
            });

            // Close dropdowns when clicking outside
            document.addEventListener("click", function() {
                document.querySelectorAll(".color-dropdown.open").forEach(function(d) {
                    d.classList.remove("open");
                });
            });
        }

        function EscapeHtml(pText)
        {
            if (pText === null || pText === undefined)
                return "";
            const div = document.createElement("div");
            div.textContent = String(pText);
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}
