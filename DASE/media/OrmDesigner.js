(function () {
    "use strict";

    const vscode = acquireVsCodeApi();

    const XMessageType = {
        DesignerReady: "DesignerReady",
        LoadModel: "LoadModel",
        ModelLoaded: "ModelLoaded",
        SaveModel: "SaveModel",
        SelectElement: "SelectElement",
        SelectionChanged: "SelectionChanged",
        AddTable: "AddTable",
        AddField: "AddField",
        MoveElement: "MoveElement",
        MoveElements: "MoveElements",
        ReorderField: "ReorderField",
        DragDropAddRelation: "DragDropAddRelation",
        DeleteSelected: "DeleteSelected",
        RenameSelected: "RenameSelected",
        UpdateProperty: "UpdateProperty",
        PropertiesChanged: "PropertiesChanged",
        ValidateModel: "ValidateModel",
        IssuesChanged: "IssuesChanged",
        RequestRename: "RequestRename",
        RenameCompleted: "RenameCompleted",
        AlignLines: "AlignLines",
        MoveReferenceTarget: "MoveReferenceTarget",
        // Seed editor
        OpenSeedEditor: "OpenSeedEditor",
        RequestSeedData: "RequestSeedData",
        SeedDataLoaded: "SeedDataLoaded",
        SaveSeedData: "SaveSeedData",
        SeedDataSaved: "SeedDataSaved",
        // Table Options — Indexes tab
        RequestIndexes: "RequestIndexes",
        IndexesLoaded: "IndexesLoaded",
        SaveIndexes: "SaveIndexes",
        IndexesSaved: "IndexesSaved",
        // Shadow table picker
        RequestShadowTablePicker: "RequestShadowTablePicker",
        ShadowTablePickerData: "ShadowTablePickerData",
        AddShadowTable: "AddShadowTable",
        // AI Organization
        OrganizeTablesAI: "OrganizeTablesAI",
        AIOrganizeShowPicker: "AIOrganizeShowPicker",
        OrganizeTablesAIExecute: "OrganizeTablesAIExecute",
        AIOrganizeStart: "AIOrganizeStart",
        AIOrganizeProgress: "AIOrganizeProgress",
        AIOrganizeComplete: "AIOrganizeComplete",
        AIOrganizeError: "AIOrganizeError",
        AIOrganizeRevert: "AIOrganizeRevert",
        // AI SQL Script
        CreateSQLScript: "CreateSQLScript",
        SQLScriptShowPicker: "SQLScriptShowPicker",
        CreateSQLScriptExecute: "CreateSQLScriptExecute",
        SQLScriptStart: "SQLScriptStart",
        SQLScriptProgress: "SQLScriptProgress",
        SQLScriptComplete: "SQLScriptComplete",
        SQLScriptError: "SQLScriptError",
        // ORM Code Generation (template-based; no dialog)
        GenerateORMCode: "GenerateORMCode",
    };

    let _Model = { DesignID: null, Tables: [], References: [] };
    let _SelectedIDs = [];
    let _DragState = null;
    let _Marquee = null; // { startX, startY, rectEl, mode } in canvas coords
    let _Search = { Active: false, Query: "", Matches: [], Index: -1 }; // table name search
    let _RelationDragState = null;
    let _FieldDragState = null;
    let _ContextMenuPosition = { X: 0, Y: 0 };
    let _ContextMenuTarget = null;
    let _FieldContextMenuTarget = null;
    let _RelationContextMenuTarget = null; // reference ID whose target is being moved
    let _MoveTargetState = null; // { RefID } while user is picking a new target table
    let _Issues = [];

    // ── Viewport state (zoom + native scroll) ────────────────────────────────
    // Drawing-area extent; grows with the content (AutoSizeCanvas). The CSS
    // #canvas size is only the pre-model fallback.
    let _CanvasW = 3000;
    let _CanvasH = 2000;
    let _Zoom = 1.0;
    let _SpaceDown = false;
    let _SpacePan = null; // { startClientX, startClientY, startScrollX, startScrollY }

    // Seed editor state
    let _SeedEditor = null; // { TableID, Columns, Rows, OriginalRows, SelectedRows: Set<number> }
    let _SeedNextNewId = 0;
    let _GuidSeq = 0;
    let _IndexEditor = null; // { TableID, Columns, Indexes: [{IndexID, Name, IsUnique, Filter, Fields:[{FieldID,IsDescending,AllowDuplicate,IsIncluded}]}], SelectedIndexID }
    let _IndexNextNewId = 0;
    let _TableOptionsActiveTab = "seed";
    let _ShadowPickerData = null;

    // Data type icons mapping - returns SVG path or emoji
    const DataTypeIcons = {
        "String": "Abc",
        "Int16": "16",
        "Int32": "32",
        "Int64": "64",
        "Decimal": "0.0",
        "Float": "1.5",
        "Double": "2.0",
        "Boolean": "✓✗",
        "DateTime": "📅",
        "Date": "📅",
        "Time": "🕐",
        "Guid": "ID",
        "Byte": "B",
        "Binary": "01",
        "Text": "Txt"
    };

    function GetDataTypeIcon(pDataType) {
        return DataTypeIcons[pDataType] || pDataType?.substring(0, 3) || "?";
    }

    function GetLuminance(pHexColor) {
        if (!pHexColor) return 0;
        // TFX stores colors as ARGB hex (8 chars, no #): AARRGGBB
        // HTML #RRGGBB has 7 chars. Normalise to plain RRGGBB in both cases.
        let hex = pHexColor.startsWith("#") ? pHexColor.slice(1) : pHexColor;
        if (hex.length === 8) hex = hex.slice(2); // strip alpha byte
        if (hex.length !== 6) return 0;
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function ArgbToCssColor(pArgb) {
        // Convert TFX ARGB hex (AARRGGBB) to CSS #RRGGBB.
        // If already #RRGGBB pass through unchanged.
        if (!pArgb) return null;
        if (pArgb.startsWith("#")) return pArgb;
        if (pArgb.length === 8) return "#" + pArgb.slice(2);
        return "#" + pArgb;
    }

    const FKIcon = "🔗";

    const _Canvas = document.getElementById("canvas");
    const _TablesLayer = document.getElementById("tables-layer");
    const _RelationsLayer = document.getElementById("relations-layer");
    const _CanvasContainer = document.getElementById("canvas-container");
    const _CanvasViewport = document.getElementById("canvas-viewport");
    const _CanvasSizer = document.getElementById("canvas-sizer");
    const _ContextMenu = document.getElementById("context-menu");
    const _TableContextMenu = document.getElementById("table-context-menu");
    const _FieldContextMenu = document.getElementById("field-context-menu");
    const _RelationContextMenu = document.getElementById("relation-context-menu");

    function Initialize() {
        SetupCanvasEvents();
        SetupContextMenu();
        SetupZoomPan();
        SetupMessageHandler();
        SetupTableSearch();
        SendMessage(XMessageType.DesignerReady, {});
    }

    function SendMessage(pType, pPayload) {
        vscode.postMessage({ Type: pType, Payload: pPayload });
    }

    function SetupMessageHandler() {
        window.addEventListener("message", function (pEvent) {
            const msg = pEvent.data;
            HandleMessage(msg);
        });
    }

    function HandleMessage(pMsg) {
        switch (pMsg.Type) {
            case XMessageType.LoadModel:
                _Model = pMsg.Payload || { DesignID: null, Tables: [], References: [] };
                RenderModel();
                break;

            case XMessageType.SelectionChanged:
                _SelectedIDs = pMsg.Payload.SelectedIDs || [];
                UpdateSelectionVisuals();
                break;

            case XMessageType.RequestRename:
                ShowRenameInput(pMsg.Payload.ElementID);
                break;

            case XMessageType.IssuesChanged:
                _Issues = (pMsg.Payload && pMsg.Payload.Issues) ? pMsg.Payload.Issues : [];
                UpdateIssueVisuals();
                break;

            case XMessageType.SeedDataLoaded:
                OpenSeedEditorModal(pMsg.Payload);
                break;

            case XMessageType.SeedDataSaved:
                OnSeedDataSaved(pMsg.Payload);
                break;

            case XMessageType.IndexesLoaded:
                OnIndexesLoaded(pMsg.Payload);
                break;

            case XMessageType.IndexesSaved:
                OnIndexesSaved(pMsg.Payload);
                break;

            case XMessageType.ShadowTablePickerData:
                OpenShadowPickerModal(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeShowPicker:
                OpenAIPickerOverlay(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeStart:
                OpenAIOrganizeOverlay(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeProgress:
                UpdateAIOrganizeProgress(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeComplete:
                CompleteAIOrganize(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeError:
                ErrorAIOrganize(pMsg.Payload);
                break;

            case XMessageType.SQLScriptShowPicker:
                OpenSQLScriptPickerOverlay(pMsg.Payload);
                break;

            case XMessageType.SQLScriptStart:
                StartSQLScriptProgress(pMsg.Payload);
                break;

            case XMessageType.SQLScriptProgress:
                UpdateSQLScriptProgress(pMsg.Payload);
                break;

            case XMessageType.SQLScriptComplete:
                CompleteSQLScript(pMsg.Payload);
                break;

            case XMessageType.SQLScriptError:
                ErrorSQLScript(pMsg.Payload);
                break;
        }
    }

    function SetupContextMenu() {
        _ContextMenu.addEventListener("click", function (e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            HideContextMenu();

            switch (action) {
                case "add-table":
                    SendMessage(XMessageType.AddTable, { X: _ContextMenuPosition.X, Y: _ContextMenuPosition.Y });
                    break;
                case "add-shadow-table":
                    SendMessage(XMessageType.RequestShadowTablePicker, { X: _ContextMenuPosition.X, Y: _ContextMenuPosition.Y });
                    break;
                case "delete-selected":
                    SendMessage(XMessageType.DeleteSelected, {});
                    break;
                case "rename-selected":
                    if (_SelectedIDs.length > 0)
                        ShowRenameInput(_SelectedIDs[0]);
                    break;
                case "validate-model":
                    SendMessage(XMessageType.ValidateModel, {});
                    break;
                case "align-lines":
                    SendMessage(XMessageType.AlignLines, {});
                    break;
                case "export-dbml":
                    SendMessage("ExportToDBML", {});
                    break;
                case "organize-tables-ai":
                    SendMessage(XMessageType.OrganizeTablesAI, {});
                    break;
                case "create-sql-script":
                    SendMessage(XMessageType.CreateSQLScript, {});
                    break;
                case "generate-orm-code":
                    SendMessage(XMessageType.GenerateORMCode, {});
                    break;
            }
        });

        _TableContextMenu.addEventListener("click", function (e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            const tableID = _ContextMenuTarget;
            HideContextMenu();

            switch (action) {
                case "add-field":
                    if (tableID)
                        SendMessage(XMessageType.AddField, { TableID: tableID, Name: "NewField", DataType: "String" });
                    break;
                case "table-options":
                    if (tableID)
                        SendMessage(XMessageType.RequestSeedData, { TableID: tableID });
                    break;
                case "delete-table":
                    SendMessage(XMessageType.DeleteSelected, {});
                    break;
                case "rename-table":
                    if (tableID)
                        ShowRenameInput(tableID);
                    break;
            }
        });

        if (_FieldContextMenu) {
            _FieldContextMenu.addEventListener("click", function (e) {
                const item = e.target.closest(".context-menu-item");
                if (!item)
                    return;

                const action = item.getAttribute("data-action");
                const fieldID = _FieldContextMenuTarget;
                HideContextMenu();

                switch (action) {
                    case "delete-field":
                        if (fieldID) {
                            SendMessage(XMessageType.SelectElement, { ElementID: fieldID });
                            SendMessage(XMessageType.DeleteSelected, {});
                        }
                        break;
                    case "rename-field":
                        if (fieldID)
                            ShowRenameInput(fieldID);
                        break;
                }
            });
        }

        if (_RelationContextMenu) {
            _RelationContextMenu.addEventListener("click", function (e) {
                const item = e.target.closest(".context-menu-item");
                if (!item)
                    return;

                const action = item.getAttribute("data-action");
                const refID = _RelationContextMenuTarget;
                HideContextMenu();

                switch (action) {
                    case "move-target-table":
                        if (refID)
                            EnterMoveTargetMode(refID);
                        break;
                }
            });
        }

        document.addEventListener("click", function (e) {
            if (!_ContextMenu.contains(e.target) && !_TableContextMenu.contains(e.target) &&
                (!_FieldContextMenu || !_FieldContextMenu.contains(e.target)) &&
                (!_RelationContextMenu || !_RelationContextMenu.contains(e.target)))
                HideContextMenu();
        });
    }

    function ShowFieldContextMenu(pX, pY, pFieldID) {
        _FieldContextMenuTarget = pFieldID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        if (_FieldContextMenu) {
            _FieldContextMenu.style.left = pX + "px";
            _FieldContextMenu.style.top = pY + "px";
            _FieldContextMenu.classList.add("visible");
        }
    }

    function ShowRelationContextMenu(pX, pY, pRefID) {
        _RelationContextMenuTarget = pRefID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        if (_FieldContextMenu)
            _FieldContextMenu.classList.remove("visible");
        if (_RelationContextMenu) {
            _RelationContextMenu.style.left = pX + "px";
            _RelationContextMenu.style.top = pY + "px";
            _RelationContextMenu.classList.add("visible");
        }
    }

    function UpdateIssueVisuals() {
        const fieldGroups = _TablesLayer.querySelectorAll(".orm-field-group");
        fieldGroups.forEach(function (fg) {
            const fieldID = fg.getAttribute("data-field-id");
            const hasError = _Issues.some(function (issue) {
                return issue.ElementID === fieldID && issue.Severity >= 2;
            });
            const hasWarning = _Issues.some(function (issue) {
                return issue.ElementID === fieldID;
            });
            fg.classList.toggle("has-error", hasError);
            fg.classList.toggle("has-warning", !hasError && hasWarning);
        });

        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) {
            const tableID = t.getAttribute("data-id");
            const hasError = _Issues.some(function (issue) {
                return issue.ElementID === tableID && issue.Severity >= 2;
            });
            const hasWarning = _Issues.some(function (issue) {
                return issue.ElementID === tableID;
            });
            t.classList.toggle("has-error", hasError);
            t.classList.toggle("has-warning", !hasError && hasWarning);
        });
    }

    function ShowContextMenu(pX, pY, pCanvasX, pCanvasY) {
        _ContextMenuPosition.X = pCanvasX;
        _ContextMenuPosition.Y = pCanvasY;
        _ContextMenuTarget = null;

        // Update menu items based on selection
        const deleteItem = _ContextMenu.querySelector('[data-action="delete-selected"]');
        const renameItem = _ContextMenu.querySelector('[data-action="rename-selected"]');

        if (_SelectedIDs.length === 0) {
            deleteItem.classList.add("disabled");
            renameItem.classList.add("disabled");
        }
        else {
            deleteItem.classList.remove("disabled");
            renameItem.classList.remove("disabled");
        }

        _TableContextMenu.classList.remove("visible");
        _ContextMenu.style.left = pX + "px";
        _ContextMenu.style.top = pY + "px";
        _ContextMenu.classList.add("visible");
    }

    function ShowTableContextMenu(pX, pY, pTableID) {
        _ContextMenuTarget = pTableID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.style.left = pX + "px";
        _TableContextMenu.style.top = pY + "px";

        const table = _Model.Tables.find(function (t) { return t.ID === pTableID; });
        const isShadow = table && table.IsShadow;
        const shadowRestricted = ["add-field", "table-options", "rename-table"];
        const items = _TableContextMenu.querySelectorAll(".context-menu-item");
        for (const item of items) {
            const action = item.getAttribute("data-action");
            item.style.display = (isShadow && shadowRestricted.indexOf(action) >= 0) ? "none" : "";
        }
        const seps = _TableContextMenu.querySelectorAll(".context-menu-separator");
        for (const sep of seps)
            sep.style.display = isShadow ? "none" : "";

        _TableContextMenu.classList.add("visible");
    }

    function HideContextMenu() {
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        if (_FieldContextMenu)
            _FieldContextMenu.classList.remove("visible");
        if (_RelationContextMenu)
            _RelationContextMenu.classList.remove("visible");
        _ContextMenuTarget = null;
        _FieldContextMenuTarget = null;
        _RelationContextMenuTarget = null;
    }

    // ── Viewport helpers ─────────────────────────────────────────────────────

    /** Convert client (screen) coordinates to canvas (SVG world) coordinates. */
    function ClientToCanvas(pClientX, pClientY) {
        // getBoundingClientRect reflects the scale transform, so r.left/r.top is
        // the on-screen position of the canvas origin regardless of scroll.
        const r = _Canvas.getBoundingClientRect();
        return {
            x: (pClientX - r.left) / _Zoom,
            y: (pClientY - r.top)  / _Zoom
        };
    }

    /** Apply current _Zoom: scale the canvas and resize the scrollable sizer. */
    function ApplyViewport() {
        _CanvasSizer.style.width  = (_CanvasW * _Zoom) + "px";
        _CanvasSizer.style.height = (_CanvasH * _Zoom) + "px";
        _Canvas.style.transform = `scale(${_Zoom})`;
        const indicator = document.getElementById("zoom-indicator");
        if (indicator) indicator.textContent = Math.round(_Zoom * 100) + "%";
    }

    /** Zoom centred on a client-coordinate point, scaling by pFactor. */
    function ZoomAtPoint(pClientX, pClientY, pFactor) {
        const cr = _Canvas.getBoundingClientRect();
        const wx = (pClientX - cr.left) / _Zoom;
        const wy = (pClientY - cr.top)  / _Zoom;
        _Zoom = Math.max(0.1, Math.min(4.0, _Zoom * pFactor));
        ApplyViewport();
        // Scroll so the world point stays under the cursor (browser clamps).
        const vr = _CanvasViewport.getBoundingClientRect();
        _CanvasViewport.scrollLeft = wx * _Zoom - (pClientX - vr.left);
        _CanvasViewport.scrollTop  = wy * _Zoom - (pClientY - vr.top);
    }


    function SetupZoomPan() {
        const ZOOM_FACTOR = 1.1;

        // ── Ctrl+Wheel → zoom; plain / Shift+Wheel → native scrollbars ────
        _CanvasContainer.addEventListener("wheel", function (e) {
            if (!e.ctrlKey) return; // let the browser scroll the viewport
            e.preventDefault();
            const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
            ZoomAtPoint(e.clientX, e.clientY, factor);
        }, { passive: false });

        // ── Space-bar held → hand-tool pan (Photoshop style) ─────────────
        document.addEventListener("keydown", function (e) {
            const active = document.activeElement;
            const focusOnCanvas = active === document.body ||
                                  active === _CanvasViewport ||
                                  active === _CanvasContainer;
            if (e.code === "Space" && !e.ctrlKey && focusOnCanvas) {
                // The viewport scrolls natively now: default Space = page-down.
                // Block it on EVERY keydown (auto-repeat included), otherwise
                // holding Space scrolls the viewport while panning.
                e.preventDefault();
                if (!e.repeat) {
                    _SpaceDown = true;
                    _CanvasContainer.classList.add("space-pan");
                }
            }

            // Ctrl+0 → reset zoom to 100 % (no zoom), keeping the current view centre
            // so the canvas doesn't jump. Works with both the top-row 0 and numpad 0.
            if ((e.code === "Digit0" || e.code === "Numpad0") && e.ctrlKey) {
                e.preventDefault();
                const r = _CanvasContainer.getBoundingClientRect();
                ZoomAtPoint(r.left + r.width / 2, r.top + r.height / 2, 1 / _Zoom);
            }

            // Ctrl+F → open the table search box
            if (e.code === "KeyF" && e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                OpenTableSearch();
            }

            // Ctrl+= / Ctrl++ → zoom in
            if ((e.code === "Equal" || e.code === "NumpadAdd") && e.ctrlKey) {
                e.preventDefault();
                const r = _CanvasContainer.getBoundingClientRect();
                ZoomAtPoint(r.left + r.width / 2, r.top + r.height / 2, ZOOM_FACTOR);
            }

            // Ctrl+- → zoom out
            if ((e.code === "Minus" || e.code === "NumpadSubtract") && e.ctrlKey) {
                e.preventDefault();
                const r = _CanvasContainer.getBoundingClientRect();
                ZoomAtPoint(r.left + r.width / 2, r.top + r.height / 2, 1 / ZOOM_FACTOR);
            }
        });

        document.addEventListener("keyup", function (e) {
            if (e.code === "Space") {
                _SpaceDown = false;
                _SpacePan = null;
                _CanvasContainer.classList.remove("space-pan", "space-pan-dragging");
            }
        });

        // ── Space-pan drag ────────────────────────────────────────────────
        _CanvasContainer.addEventListener("mousedown", function (e) {
            if (!_SpaceDown) return;
            e.preventDefault();
            _SpacePan = {
                startClientX: e.clientX,
                startClientY: e.clientY,
                startScrollX: _CanvasViewport.scrollLeft,
                startScrollY: _CanvasViewport.scrollTop
            };
            _CanvasContainer.classList.add("space-pan-dragging");
        });

        document.addEventListener("mousemove", function (e) {
            if (!_SpacePan) return;
            _CanvasViewport.scrollLeft = _SpacePan.startScrollX - (e.clientX - _SpacePan.startClientX);
            _CanvasViewport.scrollTop  = _SpacePan.startScrollY - (e.clientY - _SpacePan.startClientY);
        });

        document.addEventListener("mouseup", function () {
            if (_SpacePan) {
                _SpacePan = null;
                _CanvasContainer.classList.remove("space-pan-dragging");
            }
        });

        // ── Middle-mouse-button drag → pan (bonus, matches Photoshop) ────
        _CanvasContainer.addEventListener("mousedown", function (e) {
            if (e.button !== 1) return;
            e.preventDefault();
            const start = { x: e.clientX, y: e.clientY, sx: _CanvasViewport.scrollLeft, sy: _CanvasViewport.scrollTop };
            _CanvasContainer.style.cursor = "grabbing";

            const onMove = function (me) {
                _CanvasViewport.scrollLeft = start.sx - (me.clientX - start.x);
                _CanvasViewport.scrollTop  = start.sy - (me.clientY - start.y);
            };
            const onUp = function () {
                _CanvasContainer.style.cursor = "";
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });

        // Size the sizer on startup so the scrollbars reflect the canvas extent.
        ApplyViewport();
    }

    function SetupCanvasEvents() {
        _Canvas.addEventListener("click", function (e) {
            // A marquee drag just finished → swallow the synthetic click so it
            // doesn't clobber the freshly computed selection.
            if (_Marquee && _Marquee.Consumed) {
                _Marquee = null;
                return;
            }
            if (e.target === _Canvas || e.target.id === "relations-layer" || e.target.id === "tables-layer") {
                // Select the Design when clicking on the background
                if (_Model.DesignID)
                    SendMessage(XMessageType.SelectElement, { ElementID: _Model.DesignID });
                else
                    SendMessage(XMessageType.SelectElement, { Clear: true });
            }
        });

        SetupMarquee();

        _CanvasContainer.addEventListener("contextmenu", function (e) {
            e.preventDefault();

            const cPos = ClientToCanvas(e.clientX, e.clientY);
            ShowContextMenu(e.clientX, e.clientY, cPos.x, cPos.y);
        });
    }

    // ── Computed table bounding box (canvas/model coords). Mirrors the geometry
    //    used by CreateTableElement so the marquee hit-test is pixel-precise. ──
    function GetTableBBox(pTable) {
        const w = pTable.Width || 200;
        const isShadow = !!pTable.IsShadow;
        const fieldCount = isShadow ? 0 : ((pTable.Fields && pTable.Fields.length) || 0);
        const h = 28 + (fieldCount > 0 ? fieldCount * 16 + 12 : 0);
        return { x: pTable.X, y: pTable.Y, w: w, h: h };
    }

    function RectContainsBBox(pR, pB) {
        return pB.x >= pR.x1 && pB.y >= pR.y1 &&
               pB.x + pB.w <= pR.x2 && pB.y + pB.h <= pR.y2;
    }

    function RectIntersectsBBox(pR, pB) {
        return pB.x < pR.x2 && pB.x + pB.w > pR.x1 &&
               pB.y < pR.y2 && pB.y + pB.h > pR.y1;
    }

    // ── Rubber-band (marquee) selection ──────────────────────────────────────
    //  Direction rule (CAD convention):
    //   • drag DOWNWARD  → "contain"  : only tables fully inside the rectangle.
    //   • drag UPWARD    → "crossing" : every table touching the rectangle.
    //  Shift/Ctrl unions with the current selection; otherwise it replaces it.
    //  A threshold avoids hijacking a plain background click. Esc cancels.
    function SetupMarquee() {
        const THRESHOLD = 4; // client px before the marquee actually starts

        _Canvas.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;
            if (_SpaceDown) return; // space-pan owns the gesture
            // Only start on empty canvas background, never on a table/field/anchor.
            if (!(e.target === _Canvas || e.target.id === "relations-layer" || e.target.id === "tables-layer"))
                return;

            _Marquee = null; // clear any stale consumed flag from a prior gesture
            const startClientX = e.clientX;
            const startClientY = e.clientY;
            const startCanvas = ClientToCanvas(startClientX, startClientY);
            const additive = e.shiftKey || e.ctrlKey;
            const baseSelection = additive ? _SelectedIDs.slice() : [];

            let started = false;
            let rectEl = null;

            const onMove = function (me) {
                const dxC = Math.abs(me.clientX - startClientX);
                const dyC = Math.abs(me.clientY - startClientY);
                if (!started) {
                    if (dxC < THRESHOLD && dyC < THRESHOLD) return;
                    started = true;
                    rectEl = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    rectEl.setAttribute("class", "orm-marquee");
                    _Canvas.appendChild(rectEl);
                    _Marquee = { rectEl: rectEl, Consumed: false };
                }

                const cur = ClientToCanvas(me.clientX, me.clientY);
                const upward = me.clientY < startClientY; // crossing when dragging up
                const r = NormalizeRect(startCanvas.x, startCanvas.y, cur.x, cur.y);

                rectEl.setAttribute("x", r.x1);
                rectEl.setAttribute("y", r.y1);
                rectEl.setAttribute("width", r.x2 - r.x1);
                rectEl.setAttribute("height", r.y2 - r.y1);
                rectEl.classList.toggle("orm-marquee-crossing", upward);
                rectEl.classList.toggle("orm-marquee-contain", !upward);

                // Live preview of which tables will be picked.
                const hit = HitTestTables(r, upward);
                PreviewMarqueeSelection(baseSelection, hit);
            };

            const finish = function (me, cancelled) {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                document.removeEventListener("keydown", onKey, true);
                if (!started) { _Marquee = null; return; }
                if (rectEl && rectEl.parentNode) rectEl.parentNode.removeChild(rectEl);

                if (cancelled) {
                    // Restore the visual selection we were previewing over.
                    UpdateSelectionVisuals();
                    _Marquee = null;
                    return;
                }

                const cur = ClientToCanvas(me.clientX, me.clientY);
                const upward = me.clientY < startClientY;
                const r = NormalizeRect(startCanvas.x, startCanvas.y, cur.x, cur.y);
                const hit = HitTestTables(r, upward);
                const finalIDs = UnionIDs(baseSelection, hit);

                // Mark consumed so the trailing click handler doesn't override us.
                _Marquee = { Consumed: true };
                SendMessage(XMessageType.SelectElement, { SelectIDs: finalIDs });
            };

            const onUp = function (me) { finish(me, false); };
            const onKey = function (ke) {
                if (ke.key === "Escape") {
                    ke.preventDefault();
                    ke.stopPropagation();
                    finish(ke, true);
                }
            };

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
            document.addEventListener("keydown", onKey, true);
        });
    }

    function NormalizeRect(pX1, pY1, pX2, pY2) {
        return {
            x1: Math.min(pX1, pX2), y1: Math.min(pY1, pY2),
            x2: Math.max(pX1, pX2), y2: Math.max(pY1, pY2)
        };
    }

    function HitTestTables(pRect, pCrossing) {
        const ids = [];
        for (const t of _Model.Tables) {
            const b = GetTableBBox(t);
            const hit = pCrossing ? RectIntersectsBBox(pRect, b) : RectContainsBBox(pRect, b);
            if (hit) ids.push(t.ID);
        }
        return ids;
    }

    function UnionIDs(pBase, pExtra) {
        const out = pBase.slice();
        for (const id of pExtra)
            if (out.indexOf(id) < 0) out.push(id);
        return out;
    }

    // Paint the marquee preview without round-tripping to the extension host.
    function PreviewMarqueeSelection(pBase, pHit) {
        const preview = UnionIDs(pBase, pHit);
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) {
            const id = t.getAttribute("data-id");
            t.classList.toggle("selected", preview.indexOf(id) >= 0);
        });
    }

    function RenderModel() {
        ComputeAllTableWidths();
        RenderRelations();
        RenderTables();
        UpdateSelectionVisuals();
        AutoSizeCanvas();
        if (_Search.Active) ApplySearchHighlight();
    }

    // ── Auto-fit table width to its content ─────────────────────────────────
    //  Tables must never clip the title or field names. Width is derived from the
    //  widest text row (title, badge, or any field) measured in the real font, so
    //  nothing "overflows" the box. Result is stored on the model up-front so the
    //  relation/anchor/auto-size geometry all agree before anything is drawn.
    let _MeasureCtx = null;

    function GetCanvasFontFamily() {
        const ff = getComputedStyle(document.body).fontFamily;
        return (ff && ff.trim()) ? ff : "sans-serif";
    }

    function MeasureText(pText, pFont, pLetterSpacing) {
        if (!pText) return 0;
        if (!_MeasureCtx)
            _MeasureCtx = document.createElement("canvas").getContext("2d");
        _MeasureCtx.font = pFont;
        let w = _MeasureCtx.measureText(pText).width;
        if (pLetterSpacing)
            w += pLetterSpacing * Math.max(0, pText.length - 1);
        return w;
    }

    function ComputeTableWidth(pTable) {
        const family = GetCanvasFontFamily();
        const isShadow = !!pTable.IsShadow;

        // Title: x=28, 12px/600 with 0.3px letter-spacing; leave an 12px right pad.
        const titleW = MeasureText(pTable.Name || "Unnamed", "600 12px " + family, 0.3);
        let need;
        if (isShadow && pTable.ShadowDocumentName) {
            // Title and the right-aligned "↗ doc" badge must not collide.
            const badgeW = MeasureText("↗ " + pTable.ShadowDocumentName, "italic 9px " + family, 0);
            need = 28 + titleW + 14 + badgeW + 6;
        } else {
            need = 28 + titleW + 12;
        }

        if (!isShadow && pTable.Fields) {
            for (const f of pTable.Fields) {
                // Field name: x=30; required-checkbox occupies the last ~26px on the right.
                const weight = f.IsPrimaryKey ? "700" : "400";
                const name = f.Name || f.FieldName || "field";
                const w = 30 + MeasureText(name, weight + " 10px " + family, 0) + 26;
                if (w > need) need = w;
            }
        }

        return Math.max(200, Math.ceil(need));
    }

    function ComputeAllTableWidths() {
        for (const t of _Model.Tables)
            t.Width = ComputeTableWidth(t);
    }

    // Grow the drawing area to wrap the content with a comfortable margin.
    // Canvas AND sizer must stay in sync: the sizer clips (overflow:hidden) and
    // defines the scrollable extent, so a canvas larger than the sizer gets cut.
    function AutoSizeCanvas() {
        let maxX = 0;
        let maxY = 0;
        for (const t of (_Model.Tables || [])) {
            const b = GetTableBBox(t);
            if (b.x + b.w > maxX) maxX = b.x + b.w;
            if (b.y + b.h > maxY) maxY = b.y + b.h;
        }
        const pad = 400;
        const targetW = Math.max(3000, Math.ceil((maxX + pad) / 100) * 100);
        const targetH = Math.max(2000, Math.ceil((maxY + pad) / 100) * 100);
        if (targetW === _CanvasW && targetH === _CanvasH) return;
        _CanvasW = targetW;
        _CanvasH = targetH;
        _Canvas.style.width  = targetW + "px";
        _Canvas.style.height = targetH + "px";
        ApplyViewport();
    }

    function RenderTables() {
        _TablesLayer.innerHTML = "";

        for (const table of _Model.Tables) {
            const g = CreateTableElement(table);
            _TablesLayer.appendChild(g);
        }
    }

    function CreateTableElement(pTable) {
        const isShadow = !!pTable.IsShadow;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-table" + (isShadow ? " shadow-table" : ""));
        g.setAttribute("data-id", pTable.ID);
        g.setAttribute("transform", "translate(" + pTable.X + "," + pTable.Y + ")");

        const width = pTable.Width || ComputeTableWidth(pTable);
        const headerHeight = 28;
        const fieldHeight = 16;

        // Shadow tables render header only — no body or fields
        // ALWAYS calculate - never use pTable.Height to ensure consistency
        const fieldCount = isShadow ? 0 : ((pTable.Fields && pTable.Fields.length) || 0);
        const bodyHeight = fieldCount > 0 ? fieldCount * fieldHeight + 12 : 0;
        const height = headerHeight + bodyHeight;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", "orm-table-rect");
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("rx", 5);
        rect.setAttribute("ry", 5);
        g.appendChild(rect);

        const header = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        header.setAttribute("class", "orm-table-header");
        header.setAttribute("width", width);
        header.setAttribute("height", headerHeight);
        header.setAttribute("rx", 4);
        header.setAttribute("ry", 4);
        g.appendChild(header);

        const headerMask = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        headerMask.setAttribute("class", "orm-table-header");
        headerMask.setAttribute("y", headerHeight - 4);
        headerMask.setAttribute("width", width);
        headerMask.setAttribute("height", 4);
        g.appendChild(headerMask);

        // Subtle body background
        if (fieldCount > 0) {
            const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            body.setAttribute("class", "orm-table-body");
            body.setAttribute("y", headerHeight);
            body.setAttribute("width", width);
            body.setAttribute("height", bodyHeight);
            g.appendChild(body);
        }

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("class", "orm-table-icon");
        icon.setAttribute("x", 8);
        icon.setAttribute("y", 18);
        icon.textContent = GetDataTypeIcon(pTable.PKType || "Int32");
        g.appendChild(icon);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("class", "orm-table-title");
        title.setAttribute("x", 28);
        title.setAttribute("y", 18);
        title.textContent = pTable.Name || "Unnamed";
        g.appendChild(title);

        // Apply FillProp to header if defined (shadow tables inherit the original's colour)
        if (pTable.FillProp) {
            const cssColor = ArgbToCssColor(pTable.FillProp);
            header.style.fill = cssColor;
            headerMask.style.fill = cssColor;
            // Auto-contrast: use dark text on light backgrounds, white on dark backgrounds
            const luminance = GetLuminance(pTable.FillProp);
            const textColor = luminance > 0.35 ? "#1a1a1a" : "white";
            const iconColor = luminance > 0.35 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.8)";
            title.style.fill = textColor;
            icon.style.fill = iconColor;
        }

        // Shadow table: ghost styling + source document badge
        if (isShadow) {
            // Only apply grey header when no colour was inherited from the original
            if (!pTable.FillProp) {
                header.style.fill = "#555";
                headerMask.style.fill = "#555";
                title.style.fill = "#bbb";
                icon.style.fill = "rgba(180,180,180,0.7)";
            }
            title.style.fontStyle = "italic";
            rect.style.strokeDasharray = "6 3";
            rect.style.stroke = "#666";
            rect.style.fill = "rgba(60,60,60,0.4)";
            if (pTable.ShadowDocumentName) {
                const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
                badge.setAttribute("class", "orm-shadow-badge");
                badge.setAttribute("x", width - 5);
                badge.setAttribute("y", 11);
                badge.setAttribute("text-anchor", "end");
                badge.textContent = "\u2197 " + pTable.ShadowDocumentName;
                // Adapt badge colour to match the header contrast
                if (pTable.FillProp) {
                    const luminance = GetLuminance(pTable.FillProp);
                    badge.style.fill = luminance > 0.35 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
                }
                g.appendChild(badge);
            }
        }

        if (pTable.Fields && pTable.Fields.length > 0) {
            let y = headerHeight + 16;
            for (const field of pTable.Fields) {
                const fieldGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                fieldGroup.setAttribute("class", "orm-field-group");
                fieldGroup.setAttribute("data-field-id", field.ID);
                fieldGroup.style.cursor = "pointer";

                const fieldBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                fieldBg.setAttribute("class", "orm-field-bg");
                fieldBg.setAttribute("x", 2);
                fieldBg.setAttribute("y", y - 12);
                fieldBg.setAttribute("width", width - 4);
                fieldBg.setAttribute("height", 16);
                fieldBg.setAttribute("fill", "transparent");
                fieldGroup.appendChild(fieldBg);

                // Field icon (PK key, FK link, or DataType)
                const fieldIcon = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldIcon.setAttribute("class", "orm-field-icon");
                fieldIcon.setAttribute("x", 10);
                fieldIcon.setAttribute("y", y);
                if (field.IsPrimaryKey)
                    fieldIcon.textContent = "🔑";
                else if (field.IsForeignKey)
                    fieldIcon.textContent = FKIcon;
                else
                    fieldIcon.textContent = GetDataTypeIcon(field.DataType);
                fieldGroup.appendChild(fieldIcon);

                // Field name
                const fieldText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldText.setAttribute("class", "orm-table-field" + (field.IsPrimaryKey ? " orm-table-field-pk" : ""));
                fieldText.setAttribute("x", 30);
                fieldText.setAttribute("y", y);

                fieldText.textContent = field.Name || field.FieldName || "field";
                fieldGroup.appendChild(fieldText);

                // IsRequired checkbox on the right
                // PK fields are always required and checkbox is disabled
                const isRequired = field.IsPrimaryKey ? true : field.IsRequired;
                const checkboxGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                checkboxGroup.setAttribute("class", "orm-field-checkbox" + (field.IsPrimaryKey ? " orm-checkbox-disabled" : ""));
                checkboxGroup.setAttribute("transform", "translate(" + (width - 20) + "," + (y - 8) + ")");

                const checkboxBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                checkboxBg.setAttribute("width", 10);
                checkboxBg.setAttribute("height", 10);
                checkboxBg.setAttribute("rx", 2);
                checkboxBg.setAttribute("ry", 2);
                checkboxBg.setAttribute("class", "orm-checkbox-bg");
                checkboxGroup.appendChild(checkboxBg);

                if (isRequired) {
                    const checkMark = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    checkMark.setAttribute("d", "M2,5 L4,7 L8,3");
                    checkMark.setAttribute("class", "orm-checkbox-check");
                    checkboxGroup.appendChild(checkMark);
                }

                // Only enable click for non-PK fields
                if (!field.IsPrimaryKey) {
                    checkboxGroup.style.cursor = "pointer";
                    checkboxGroup.addEventListener("click", function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        SendMessage(XMessageType.UpdateProperty, {
                            ElementID: field.ID,
                            PropertyKey: "IsRequired",
                            Value: !field.IsRequired
                        });
                    });
                }
                fieldGroup.appendChild(checkboxGroup);

                SetupFieldEvents(fieldGroup, field, pTable);
                g.appendChild(fieldGroup);

                y += 16;
            }
        }

        // Hover border (dashed rectangle around table)
        const hoverPadding = 10;
        const hoverBorder = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hoverBorder.setAttribute("class", "orm-table-hover-border");
        hoverBorder.setAttribute("x", -hoverPadding);
        hoverBorder.setAttribute("y", -hoverPadding);
        hoverBorder.setAttribute("width", width + hoverPadding * 2);
        hoverBorder.setAttribute("height", height + hoverPadding * 2);
        g.appendChild(hoverBorder);

        // Anchor points - 8 points: 4 corners + 4 edge centers
        // Anchors are centered on the hover border line
        const anchorSize = 12;
        const anchorPositions = [
            // Corners - centered on hover border corners
            { x: -hoverPadding - anchorSize / 2, y: -hoverPadding - anchorSize / 2, anchor: "top-left" },
            { x: width + hoverPadding - anchorSize / 2, y: -hoverPadding - anchorSize / 2, anchor: "top-right" },
            { x: -hoverPadding - anchorSize / 2, y: height + hoverPadding - anchorSize / 2, anchor: "bottom-left" },
            { x: width + hoverPadding - anchorSize / 2, y: height + hoverPadding - anchorSize / 2, anchor: "bottom-right" },
            // Edge centers - centered on hover border edges
            { x: width / 2 - anchorSize / 2, y: -hoverPadding - anchorSize / 2, anchor: "top" },
            { x: width / 2 - anchorSize / 2, y: height + hoverPadding - anchorSize / 2, anchor: "bottom" },
            { x: -hoverPadding - anchorSize / 2, y: height / 2 - anchorSize / 2, anchor: "left" },
            { x: width + hoverPadding - anchorSize / 2, y: height / 2 - anchorSize / 2, anchor: "right" }
        ];

        for (const pos of anchorPositions) {
            const anchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            anchor.setAttribute("class", "orm-table-anchor");
            anchor.setAttribute("x", pos.x);
            anchor.setAttribute("y", pos.y);
            anchor.setAttribute("width", anchorSize);
            anchor.setAttribute("height", anchorSize);
            anchor.setAttribute("data-anchor", pos.anchor);
            g.appendChild(anchor);
        }

        SetupTableEvents(g, pTable);

        return g;
    }

    function SetupTableEvents(pElement, pTable) {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let elementStartX = pTable.X;
        let elementStartY = pTable.Y;

        pElement.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;

            // Let space-pan take over when Space is held
            if (_SpaceDown) return;

            if (e.target.classList.contains("orm-table-anchor")) {
                StartRelationDrag(pTable, e);
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const inSelection = _SelectedIDs.indexOf(pTable.ID) >= 0;
            // Group drag: grab any table already part of a multi-selection and the
            // whole set moves together. Ctrl always means "toggle", never group-drag.
            const groupDrag = inSelection && _SelectedIDs.length > 1 && !e.ctrlKey;

            if (e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID, Toggle: true });
            else if (!inSelection)
                // Grabbing an unselected table collapses the selection to just it.
                SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });

            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            // Build the list of tables that will travel with this drag and snapshot
            // their start positions. Single drag → just this table.
            const movers = groupDrag
                ? _Model.Tables.filter(function (t) { return _SelectedIDs.indexOf(t.ID) >= 0; })
                : [pTable];
            const starts = movers.map(function (t) {
                return {
                    table: t,
                    el: _TablesLayer.querySelector('.orm-table[data-id="' + t.ID + '"]'),
                    x: t.X,
                    y: t.Y
                };
            });
            // Clamp so the whole group is shifted as one when it hits the X/Y=0 edge.
            const minStartX = Math.min.apply(null, starts.map(function (s) { return s.x; }));
            const minStartY = Math.min.apply(null, starts.map(function (s) { return s.y; }));
            const moverIDs = new Set(movers.map(function (t) { return t.ID; }));

            let rafPending = false;
            let lastDX = 0;
            let lastDY = 0;
            const onMouseMove = function (e) {
                if (!isDragging)
                    return;

                let dx = (e.clientX - dragStartX) / _Zoom;
                let dy = (e.clientY - dragStartY) / _Zoom;
                dx = Math.max(dx, -minStartX);
                dy = Math.max(dy, -minStartY);
                lastDX = dx;
                lastDY = dy;

                for (const s of starts) {
                    const newX = s.x + dx;
                    const newY = s.y + dy;
                    if (s.el)
                        s.el.setAttribute("transform", "translate(" + newX + "," + newY + ")");
                    s.table.X = newX;
                    s.table.Y = newY;
                }

                if (!rafPending) {
                    rafPending = true;
                    requestAnimationFrame(function () {
                        rafPending = false;
                        UpdateRelationsForDrag(moverIDs, lastDX, lastDY);
                        DrawGroupBBox();
                        AutoSizeCanvas(); // grow the area when dragging past the edge
                    });
                }
            };

            const onMouseUp = function (e) {
                if (isDragging) {
                    const moved = starts.filter(function (s) {
                        return s.table.X !== s.x || s.table.Y !== s.y;
                    });
                    if (moved.length === 1)
                        SendMessage(XMessageType.MoveElement, {
                            ElementID: moved[0].table.ID,
                            X: moved[0].table.X,
                            Y: moved[0].table.Y
                        });
                    else if (moved.length > 1)
                        SendMessage(XMessageType.MoveElements, {
                            Moves: moved.map(function (s) {
                                return { ElementID: s.table.ID, X: s.table.X, Y: s.table.Y };
                            })
                        });
                }

                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        pElement.addEventListener("dblclick", function (e) {
            if (!pTable.IsShadow)
                ShowRenameInput(pTable.ID);
        });

        pElement.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();
            SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });
            ShowTableContextMenu(e.clientX, e.clientY, pTable.ID);
        });
    }

    function SetupFieldEvents(pElement, pField, pTable) {
        let isDragging = false;
        let dragStartY = 0;
        let dragThreshold = 5;

        pElement.addEventListener("mousedown", function (e) {
            e.preventDefault();
            e.stopPropagation();

            // PKFields cannot be reordered
            if (pField.IsPrimaryKey) {
                if (!e.ctrlKey)
                    SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
                else
                    SendMessage(XMessageType.SelectElement, { ElementID: pField.ID, Toggle: true });
                return;
            }

            dragStartY = e.clientY;
            isDragging = false;

            const onMouseMove = function (me) {
                const dy = Math.abs(me.clientY - dragStartY);

                if (!isDragging && dy > dragThreshold) {
                    isDragging = true;
                    StartFieldDrag(pField, pTable, pElement, me);
                }

                if (isDragging && _FieldDragState)
                    UpdateFieldDrag(me);
            };

            const onMouseUp = function (me) {
                if (isDragging && _FieldDragState)
                    EndFieldDrag();
                else {
                    // Simple click - select field
                    if (!e.ctrlKey)
                        SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
                    else
                        SendMessage(XMessageType.SelectElement, { ElementID: pField.ID, Toggle: true });
                }

                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        pElement.addEventListener("dblclick", function (e) {
            e.preventDefault();
            e.stopPropagation();
            ShowRenameInput(pField.ID);
        });

        pElement.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!pField.IsPrimaryKey) {
                SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
                ShowFieldContextMenu(e.clientX, e.clientY, pField.ID);
            }
        });
    }

    function StartFieldDrag(pField, pTable, pElement, pEvent) {
        // Find field index within the table
        const fieldIndex = pTable.Fields.findIndex(f => f.ID === pField.ID);
        if (fieldIndex < 0)
            return;

        // Create drag ghost as a separate group that follows mouse
        const ghost = document.createElementNS("http://www.w3.org/2000/svg", "g");
        ghost.classList.add("orm-field-drag-ghost");
        ghost.setAttribute("data-drag-ghost", "true");

        // Get the original field's bounding box in screen coordinates
        const bbox = pElement.getBBox();
        const fieldWidth = bbox.width;
        const fieldHeight = bbox.height;

        // Create background for visibility (positioned at 0,0 in ghost's local coords)
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", -2);
        bg.setAttribute("y", -1);
        bg.setAttribute("width", fieldWidth + 4);
        bg.setAttribute("height", fieldHeight + 2);
        bg.setAttribute("class", "orm-field-drag-ghost-bg");
        ghost.appendChild(bg);

        // Clone the field content and reset its position to (0,0)
        const fieldClone = pElement.cloneNode(true);
        fieldClone.classList.remove("orm-field-drag-source");
        // Remove the original transform/position - set to origin
        fieldClone.setAttribute("transform", `translate(${-bbox.x}, ${-bbox.y})`);
        ghost.appendChild(fieldClone);

        // Calculate mouse offset from field's top-left for stable dragging
        const _ccStart = ClientToCanvas(pEvent.clientX, pEvent.clientY);
        const mouseX = _ccStart.x;
        const mouseY = _ccStart.y;

        // Calculate offset relative to field's top-left corner on canvas
        const dragOffsetX = mouseX - (pTable.X + bbox.x);
        const dragOffsetY = mouseY - (pTable.Y + bbox.y);

        // Position ghost at original field position
        ghost.setAttribute("transform", `translate(${mouseX - dragOffsetX}, ${mouseY - dragOffsetY})`);

        _TablesLayer.appendChild(ghost);

        // Add dragging class to original
        pElement.classList.add("orm-field-drag-source");

        _FieldDragState = {
            Field: pField,
            Table: pTable,
            OriginalElement: pElement,
            Ghost: ghost,
            OriginalIndex: fieldIndex,
            CurrentIndex: fieldIndex,
            TableElement: pElement.closest(".orm-table"),
            GhostWidth: fieldWidth,
            GhostHeight: fieldHeight,
            DragOffsetX: dragOffsetX,
            DragOffsetY: dragOffsetY
        };

        // Show drop indicators
        UpdateFieldDropIndicators();
    }

    function UpdateFieldDrag(pEvent) {
        if (!_FieldDragState)
            return;

        const table = _FieldDragState.Table;
        const tableElement = _FieldDragState.TableElement;
        if (!tableElement)
            return;

        // Get mouse position relative to canvas
        const _ccMove = ClientToCanvas(pEvent.clientX, pEvent.clientY);
        const mouseX = _ccMove.x;
        const mouseY = _ccMove.y;

        // Update ghost position to follow mouse maintaining initial offset
        if (_FieldDragState.Ghost) {
            const ghostX = mouseX - (_FieldDragState.DragOffsetX || 0);
            const ghostY = mouseY - (_FieldDragState.DragOffsetY || 0);
            _FieldDragState.Ghost.setAttribute("transform", `translate(${ghostX}, ${ghostY})`);
        }

        // Calculate which field slot the mouse is over
        const headerHeight = 28;
        const fieldHeight = 16;
        const tableY = table.Y;

        // Calculate relative Y within the table's field area
        const relY = mouseY - tableY - headerHeight - 4;
        let targetIndex = Math.floor(relY / fieldHeight);

        // Skip PK field (index 0 if present)
        const hasPK = table.Fields.some(f => f.IsPrimaryKey);
        const minIndex = hasPK ? 1 : 0;
        const maxIndex = table.Fields.length - 1;

        targetIndex = Math.max(minIndex, Math.min(targetIndex, maxIndex));

        if (targetIndex !== _FieldDragState.CurrentIndex) {
            _FieldDragState.CurrentIndex = targetIndex;
            UpdateFieldDropIndicators();
        }
    }

    function UpdateFieldDropIndicators() {
        if (!_FieldDragState)
            return;

        const tableElement = _FieldDragState.TableElement;
        if (!tableElement)
            return;

        // Remove existing indicators
        const existing = tableElement.querySelectorAll(".orm-field-drop-indicator");
        existing.forEach(el => el.remove());

        // Don't show indicator if we're at the original position
        if (_FieldDragState.CurrentIndex === _FieldDragState.OriginalIndex)
            return;

        // Create drop indicator line
        const headerHeight = 28;
        const fieldHeight = 16;
        const table = _FieldDragState.Table;
        const width = table.Width || 200;

        // Calculate Y position for the indicator
        const indicatorY = headerHeight + 4 + (_FieldDragState.CurrentIndex * fieldHeight);

        const indicator = document.createElementNS("http://www.w3.org/2000/svg", "line");
        indicator.setAttribute("class", "orm-field-drop-indicator");
        indicator.setAttribute("x1", 4);
        indicator.setAttribute("y1", indicatorY);
        indicator.setAttribute("x2", width - 4);
        indicator.setAttribute("y2", indicatorY);
        tableElement.appendChild(indicator);
    }

    function EndFieldDrag() {
        if (!_FieldDragState)
            return;

        const origIndex = _FieldDragState.OriginalIndex;
        const newIndex = _FieldDragState.CurrentIndex;
        const fieldID = _FieldDragState.Field.ID;
        const tableElement = _FieldDragState.TableElement;

        // Clean up ghost and indicators
        if (_FieldDragState.Ghost)
            _FieldDragState.Ghost.remove();

        if (_FieldDragState.OriginalElement)
            _FieldDragState.OriginalElement.classList.remove("orm-field-drag-source");

        if (tableElement) {
            const indicators = tableElement.querySelectorAll(".orm-field-drop-indicator");
            indicators.forEach(el => el.remove());
        }

        // If position changed, send reorder message
        if (newIndex !== origIndex) {
            SendMessage(XMessageType.ReorderField, {
                FieldID: fieldID,
                NewIndex: newIndex
            });
        }

        _FieldDragState = null;
    }

    function StartRelationDrag(pSourceTable, pEvent) {
        pEvent.preventDefault();
        pEvent.stopPropagation();

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "relation-drag-line");

        // Get anchor position from clicked element
        const anchor = pEvent.target;
        const anchorType = anchor.getAttribute("data-anchor");

        // Calculate visual height (same as CreateTableElement)
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;
        const fieldCount = pSourceTable.Fields ? pSourceTable.Fields.length : 0;
        const visualHeight = fieldCount > 0
            ? headerHeight + (fieldCount * fieldHeight) + padding
            : headerHeight;
        const width = pSourceTable.Width || 200;

        // Calculate start position based on anchor type
        let startX, startY;
        switch (anchorType) {
            case "right":
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y + visualHeight / 2;
                break;
            case "left":
                startX = pSourceTable.X;
                startY = pSourceTable.Y + visualHeight / 2;
                break;
            case "top":
                startX = pSourceTable.X + width / 2;
                startY = pSourceTable.Y;
                break;
            case "bottom":
                startX = pSourceTable.X + width / 2;
                startY = pSourceTable.Y + visualHeight;
                break;
            case "top-left":
                startX = pSourceTable.X;
                startY = pSourceTable.Y;
                break;
            case "top-right":
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y;
                break;
            case "bottom-left":
                startX = pSourceTable.X;
                startY = pSourceTable.Y + visualHeight;
                break;
            case "bottom-right":
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y + visualHeight;
                break;
            default:
                // Fallback to right side
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y + visualHeight / 2;
                break;
        }

        line.setAttribute("x1", startX);
        line.setAttribute("y1", startY);
        line.setAttribute("x2", startX);
        line.setAttribute("y2", startY);

        _RelationsLayer.appendChild(line);

        _RelationDragState = {
            SourceTable: pSourceTable,
            Line: line,
            StartX: startX,
            StartY: startY,
            IsCtrl: pEvent.ctrlKey
        };

        // Visual feedback: dashed drag line for 1:1 (Ctrl held)
        if (pEvent.ctrlKey)
            line.setAttribute("stroke-dasharray", "6 4");

        const onMouseMove = function (e) {
            if (!_RelationDragState)
                return;

            const _ccRm = ClientToCanvas(e.clientX, e.clientY);
            const x = _ccRm.x;
            const y = _ccRm.y;

            _RelationDragState.Line.setAttribute("x2", x);
            _RelationDragState.Line.setAttribute("y2", y);
        };

        const onMouseUp = function (e) {
            if (!_RelationDragState)
                return;

            const _ccRu = ClientToCanvas(e.clientX, e.clientY);
            const x = _ccRu.x;
            const y = _ccRu.y;

            const targetTable = FindTableAtPoint(x, y);

            if (targetTable && targetTable.ID !== _RelationDragState.SourceTable.ID) {
                SendMessage(XMessageType.DragDropAddRelation, {
                    SourceID: _RelationDragState.SourceTable.ID,
                    TargetID: targetTable.ID,
                    IsOneToOne: !!_RelationDragState.IsCtrl
                });
            }

            _RelationDragState.Line.remove();
            _RelationDragState = null;

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    // ── Move Target Table (FK re-point) ──────────────────────────────────────

    function EnterMoveTargetMode(pRefID) {
        ExitMoveTargetMode(); // clear any prior pick
        _MoveTargetState = { RefID: pRefID };

        if (_CanvasContainer)
            _CanvasContainer.classList.add("picking-target");

        ShowMoveTargetHint();

        document.addEventListener("mousedown", OnMoveTargetPick, true);
        document.addEventListener("keydown", OnMoveTargetKey, true);
        document.addEventListener("contextmenu", OnMoveTargetContext, true);
    }

    function ExitMoveTargetMode() {
        _MoveTargetState = null;
        if (_CanvasContainer)
            _CanvasContainer.classList.remove("picking-target");
        HideMoveTargetHint();
        document.removeEventListener("mousedown", OnMoveTargetPick, true);
        document.removeEventListener("keydown", OnMoveTargetKey, true);
        document.removeEventListener("contextmenu", OnMoveTargetContext, true);
    }

    function OnMoveTargetKey(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            ExitMoveTargetMode();
        }
    }

    function OnMoveTargetContext(e) {
        // Suppress the canvas context menu while picking a target
        e.preventDefault();
        e.stopPropagation();
    }

    function OnMoveTargetPick(e) {
        if (!_MoveTargetState)
            return;

        // Any non-primary button cancels the operation
        if (e.button !== 0) {
            e.preventDefault();
            e.stopPropagation();
            ExitMoveTargetMode();
            return;
        }

        const cc = ClientToCanvas(e.clientX, e.clientY);
        const table = FindTableAtPoint(cc.x, cc.y);

        // Stop the click from starting a table drag / selection either way
        e.preventDefault();
        e.stopPropagation();

        // Empty canvas → cancel
        if (!table) {
            ExitMoveTargetMode();
            return;
        }

        const refID = _MoveTargetState.RefID;
        ExitMoveTargetMode();
        SendMessage(XMessageType.MoveReferenceTarget, {
            ReferenceID: refID,
            TargetTableID: table.ID
        });
    }

    function ShowMoveTargetHint() {
        let hint = document.getElementById("move-target-hint");
        if (!hint) {
            hint = document.createElement("div");
            hint.id = "move-target-hint";
            hint.className = "move-target-hint";
            document.body.appendChild(hint);
        }
        hint.textContent = "Click a table to move the FK target here — Esc to cancel";
        hint.style.display = "block";
    }

    function HideMoveTargetHint() {
        const hint = document.getElementById("move-target-hint");
        if (hint)
            hint.style.display = "none";
    }

    function FindTableAtPoint(pX, pY) {
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;

        for (const table of _Model.Tables) {
            const x = table.X;
            const y = table.Y;
            const w = table.Width || 200;

            // Calculate visual height based on field count
            const fieldCount = table.Fields ? table.Fields.length : 0;
            const h = fieldCount > 0
                ? headerHeight + (fieldCount * fieldHeight) + padding
                : headerHeight;

            if (pX >= x && pX <= x + w && pY >= y && pY <= y + h)
                return table;
        }
        return null;
    }

    function BuildPathFromPoints(pPoints) {
        if (!pPoints || pPoints.length < 2)
            return "";

        const CORNER_RADIUS = 15;

        // Helper: arredondar valor
        function round(v) { return Math.round(v * 10) / 10; }

        // Helper: computes a point on the circle (same algorithm as XMath.PointCircle)
        function pointCircle(pCenter, pPoint, pRadius) {
            const dx = pPoint.X - pCenter.X;
            const dy = pPoint.Y - pCenter.Y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.001) return { X: pCenter.X, Y: pCenter.Y };
            const ratio = pRadius / dist;
            return { X: pCenter.X + dx * ratio, Y: pCenter.Y + dy * ratio };
        }

        // Helper: computes the rounded corner points (same algorithm as XMath.AddCorner)
        function addCorner(pCorner, pMaxRadius, pBefore, pAfter) {
            const p1 = { X: round(pBefore.X), Y: round(pBefore.Y) };
            const p2 = { X: round(pAfter.X), Y: round(pAfter.Y) };
            const c = { X: round(pCorner.X), Y: round(pCorner.Y) };

            if (c.X === p1.X && c.Y === p1.Y) return null;
            if (c.X === p2.X && c.Y === p2.Y) return null;

            const isOrthogonal = (p1.Y === c.Y && c.X === p2.X) || (p1.X === c.X && c.Y === p2.Y);
            if (!isOrthogonal) return null;

            // Calculate distance to previous and next points
            const distBefore = Math.sqrt(Math.pow(c.X - p1.X, 2) + Math.pow(c.Y - p1.Y, 2));
            const distAfter = Math.sqrt(Math.pow(c.X - p2.X, 2) + Math.pow(c.Y - p2.Y, 2));

            // Radius must not exceed half of the shortest adjacent segment
            const maxBySegments = Math.min(distBefore, distAfter) / 2;
            const radius = Math.min(pMaxRadius, maxBySegments);

            if (radius < 1) return null;

            const before = pointCircle(pCorner, pBefore, radius);
            const after = pointCircle(pCorner, pAfter, radius);

            return { before, after, corner: pCorner };
        }

        let path = `M ${pPoints[0].X} ${pPoints[0].Y}`;

        for (let i = 1; i < pPoints.length; i++) {
            const prev = pPoints[i - 1];
            const curr = pPoints[i];
            const next = i < pPoints.length - 1 ? pPoints[i + 1] : null;

            if (next) {
                // Try to create a rounded corner
                const corner = addCorner(curr, CORNER_RADIUS, prev, next);
                if (corner) {
                    // Line up to the point before the curve
                    path += ` L ${corner.before.X} ${corner.before.Y}`;
                    // Quadratic Bezier curve (Q) using the corner as the control point
                    path += ` Q ${corner.corner.X} ${corner.corner.Y} ${corner.after.X} ${corner.after.Y}`;
                }
                else {
                    // No valid corner, plain straight line
                    path += ` L ${curr.X} ${curr.Y}`;
                }
            }
            else {
                // Last point, straight line
                path += ` L ${curr.X} ${curr.Y}`;
            }
        }

        return path;
    }

    function SimplifyReferencePoints(pPoints, pSourceTable, pTargetTable) {
        // ══════════════════════════════════════════════════════════════════════════════
        // ROUTING IS DONE BY TFX (XORMDesign.ts)
        // This function only validates and cleans the received points
        // DO NOT recompute routes - respect the points sent by the backend
        // ══════════════════════════════════════════════════════════════════════════════

        if (!pPoints || pPoints.length < 2)
            return [];

        // Filter out invalid points
        const valid = pPoints.filter(p => p && Number.isFinite(p.X) && Number.isFinite(p.Y));
        if (valid.length < 2)
            return [];

        // Remove consecutive duplicate points
        const cleaned = [valid[0]];
        for (let i = 1; i < valid.length; i++) {
            const prev = cleaned[cleaned.length - 1];
            if (Math.abs(valid[i].X - prev.X) > 1 || Math.abs(valid[i].Y - prev.Y) > 1)
                cleaned.push(valid[i]);
        }

        // Remove intermediate collinear points
        if (cleaned.length > 2) {
            const final = [cleaned[0]];
            for (let i = 1; i < cleaned.length - 1; i++) {
                const a = final[final.length - 1];
                const b = cleaned[i];
                const c = cleaned[i + 1];
                const sameX = Math.abs(a.X - b.X) < 2 && Math.abs(b.X - c.X) < 2;
                const sameY = Math.abs(a.Y - b.Y) < 2 && Math.abs(b.Y - c.Y) < 2;
                if (!sameX && !sameY)
                    final.push(b);
            }
            final.push(cleaned[cleaned.length - 1]);
            return final;
        }

        return cleaned;
    }

    function UpdateRelationsTouchingTable(pTable) {
        if (!pTable) return;
        const fieldIDs = new Set((pTable.Fields || []).map(f => f.ID));
        for (const ref of _Model.References) {
            const touches = ref.TargetTableID === pTable.ID
                || ref.SourceFieldID === pTable.ID
                || fieldIDs.has(ref.SourceFieldID);
            if (!touches) continue;
            const node = _RelationsLayer.querySelector('[data-id="' + ref.ID + '"]');
            if (!node) continue;
            const refLive = MakeLivePreviewRef(ref, pTable);
            UpdateRelationElement(node, refLive);
        }
    }

    function MakeLivePreviewRef(pRef, pMovingTable) {
        let sourceTable = _Model.Tables.find(t =>
            t.Fields && t.Fields.some(f => f.ID === pRef.SourceFieldID)
        );
        if (!sourceTable)
            sourceTable = _Model.Tables.find(t => t.ID === pRef.SourceFieldID);
        const targetTable = _Model.Tables.find(t => t.ID === pRef.TargetTableID);
        if (!sourceTable || !targetTable) return pRef;

        const points = (pRef.Points || []).map(p => ({ X: p.X, Y: p.Y }));
        if (points.length < 2)
            return Object.assign({}, pRef);

        const srcMoved = sourceTable.ID === pMovingTable.ID;
        const tgtMoved = targetTable.ID === pMovingTable.ID;

        if (srcMoved) {
            points[0] = { X: pMovingTable.X + (pMovingTable.Width || 200), Y: pMovingTable.Y + (pMovingTable.Height || 60) / 2 };
        }
        if (tgtMoved) {
            points[points.length - 1] = { X: pMovingTable.X, Y: pMovingTable.Y + (pMovingTable.Height || 60) / 2 };
        }
        return Object.assign({}, pRef, { Points: points });
    }

    // Live re-route during a (group) drag. References whose BOTH endpoints belong
    // to the moving set travel rigidly with it (translate the whole polyline);
    // references straddling the set border have only their moving endpoint chased.
    function UpdateRelationsForDrag(pMoverIDs, pDX, pDY) {
        for (const ref of _Model.References) {
            let srcTable = _Model.Tables.find(t =>
                t.Fields && t.Fields.some(f => f.ID === ref.SourceFieldID)
            );
            if (!srcTable)
                srcTable = _Model.Tables.find(t => t.ID === ref.SourceFieldID);
            const tgtTable = _Model.Tables.find(t => t.ID === ref.TargetTableID);
            if (!srcTable || !tgtTable) continue;

            const srcIn = pMoverIDs.has(srcTable.ID);
            const tgtIn = pMoverIDs.has(tgtTable.ID);
            if (!srcIn && !tgtIn) continue;

            const node = _RelationsLayer.querySelector('[data-id="' + ref.ID + '"]');
            if (!node) continue;

            if (srcIn && tgtIn) {
                const pts = (ref.Points || []).map(p => ({ X: p.X + pDX, Y: p.Y + pDY }));
                UpdateRelationElement(node, Object.assign({}, ref, { Points: pts }));
            } else {
                const movingTable = srcIn ? srcTable : tgtTable;
                UpdateRelationElement(node, MakeLivePreviewRef(ref, movingTable));
            }
        }
    }

    // Dashed "shadow" rectangle hugging the whole multi-selection. Drawn behind
    // the tables; rebuilt on every selection change and on each group-drag frame.
    function DrawGroupBBox() {
        const existing = _TablesLayer.querySelector(".orm-group-bbox");
        if (existing) existing.remove();

        const sel = _Model.Tables.filter(t => _SelectedIDs.indexOf(t.ID) >= 0);
        if (sel.length < 2) return;

        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const t of sel) {
            const b = GetTableBBox(t);
            if (b.x < x1) x1 = b.x;
            if (b.y < y1) y1 = b.y;
            if (b.x + b.w > x2) x2 = b.x + b.w;
            if (b.y + b.h > y2) y2 = b.y + b.h;
        }

        const pad = 12;
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", "orm-group-bbox");
        rect.setAttribute("x", x1 - pad);
        rect.setAttribute("y", y1 - pad);
        rect.setAttribute("width", (x2 - x1) + pad * 2);
        rect.setAttribute("height", (y2 - y1) + pad * 2);
        rect.setAttribute("rx", 6);
        rect.setAttribute("ry", 6);
        _TablesLayer.insertBefore(rect, _TablesLayer.firstChild);
    }

    // ── Table search (Ctrl+F) ────────────────────────────────────────────────
    //  Case-insensitive substring match on the table name (matches anywhere,
    //  including the middle). Matches get highlighted, non-matches dimmed; the
    //  focused match is centred. Enter / Shift+Enter cycle, Esc closes.
    function SetupTableSearch() {
        const input = document.getElementById("table-search-input");
        if (!input) return;

        input.addEventListener("input", function () { RunTableSearch(input.value); });
        input.addEventListener("keydown", function (e) {
            if (e.key === "Escape") { e.preventDefault(); CloseTableSearch(); }
            else if (e.key === "Enter") { e.preventDefault(); FocusAdjacentMatch(e.shiftKey ? -1 : 1); }
        });

        const next = document.getElementById("table-search-next");
        const prev = document.getElementById("table-search-prev");
        const close = document.getElementById("table-search-close");
        if (next) next.addEventListener("click", function () { input.focus(); FocusAdjacentMatch(1); });
        if (prev) prev.addEventListener("click", function () { input.focus(); FocusAdjacentMatch(-1); });
        if (close) close.addEventListener("click", CloseTableSearch);
    }

    function OpenTableSearch() {
        const box = document.getElementById("table-search");
        const input = document.getElementById("table-search-input");
        if (!box || !input) return;
        _Search.Active = true;
        box.classList.remove("hidden");
        input.focus();
        input.select();
        RunTableSearch(input.value);
    }

    function CloseTableSearch() {
        const box = document.getElementById("table-search");
        _Search.Active = false;
        _Search.Query = "";
        _Search.Matches = [];
        _Search.Index = -1;
        if (box) box.classList.add("hidden");
        _TablesLayer.classList.remove("searching");
        ClearSearchHighlight();
        const input = document.getElementById("table-search-input");
        if (input) input.blur();
    }

    function RunTableSearch(pQuery) {
        _Search.Query = pQuery || "";
        const q = _Search.Query.trim().toLowerCase();
        if (!q) {
            _Search.Matches = [];
            _Search.Index = -1;
        } else {
            _Search.Matches = _Model.Tables
                .filter(function (t) { return (t.Name || "").toLowerCase().indexOf(q) >= 0; })
                .map(function (t) { return t.ID; });
            _Search.Index = _Search.Matches.length > 0 ? 0 : -1;
        }
        _TablesLayer.classList.toggle("searching", q.length > 0);
        ApplySearchHighlight();
        UpdateSearchCount();
        if (_Search.Index >= 0)
            CenterOnTableID(_Search.Matches[_Search.Index]);
    }

    function FocusAdjacentMatch(pDir) {
        if (_Search.Matches.length === 0) return;
        _Search.Index = (_Search.Index + pDir + _Search.Matches.length) % _Search.Matches.length;
        ApplySearchHighlight();
        UpdateSearchCount();
        CenterOnTableID(_Search.Matches[_Search.Index]);
    }

    function ApplySearchHighlight() {
        const focusID = _Search.Index >= 0 ? _Search.Matches[_Search.Index] : null;
        const matchSet = new Set(_Search.Matches);
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) {
            const id = t.getAttribute("data-id");
            t.classList.toggle("search-match", matchSet.has(id));
            t.classList.toggle("search-focus", id === focusID);
        });
    }

    function ClearSearchHighlight() {
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) { t.classList.remove("search-match", "search-focus"); });
    }

    function UpdateSearchCount() {
        const el = document.getElementById("table-search-count");
        if (!el) return;
        const n = _Search.Matches.length;
        if (!_Search.Query.trim()) el.textContent = "";
        else if (n === 0) el.textContent = "0";
        else el.textContent = (_Search.Index + 1) + "/" + n;
    }

    function CenterOnTableID(pID) {
        const t = _Model.Tables.find(function (x) { return x.ID === pID; });
        if (!t) return;
        const b = GetTableBBox(t);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        _CanvasViewport.scrollLeft = cx * _Zoom - _CanvasViewport.clientWidth / 2;
        _CanvasViewport.scrollTop  = cy * _Zoom - _CanvasViewport.clientHeight / 2;
    }

    function RenderRelations() {
        const keep = new Set();
        for (const ref of _Model.References) {
            keep.add(ref.ID);
            const existing = _RelationsLayer.querySelector('[data-id="' + ref.ID + '"]');
            if (existing) {
                UpdateRelationElement(existing, ref);
            }
            else {
                const g = CreateRelationElement(ref);
                if (g) _RelationsLayer.appendChild(g);
            }
        }
        const all = _RelationsLayer.querySelectorAll(".orm-reference");
        all.forEach(function (node) {
            const id = node.getAttribute("data-id");
            if (!keep.has(id)) node.remove();
        });
    }

    function UpdateRelationElement(pGroup, pRef) {
        let sourceTable = _Model.Tables.find(t =>
            t.Fields && t.Fields.some(f => f.ID === pRef.SourceFieldID)
        );
        if (!sourceTable)
            sourceTable = _Model.Tables.find(t => t.ID === pRef.SourceFieldID);
        const targetTable = _Model.Tables.find(t => t.ID === pRef.TargetTableID);
        if (!sourceTable || !targetTable) return;

        const pointsRaw = pRef.Points && pRef.Points.length >= 2 ? pRef.Points : [];
        const points = SimplifyReferencePoints(pointsRaw, sourceTable, targetTable);
        const lineColor = GetTableColor(pRef.TargetTableID);

        const paths = pGroup.querySelectorAll("path");
        const lines = pGroup.querySelectorAll("line");

        if (points.length >= 2 && paths.length >= 2) {
            const d = BuildPathFromPoints(points);
            paths[0].setAttribute("d", d);
            paths[1].setAttribute("d", d);
            paths[1].setAttribute("stroke", lineColor);
            return;
        }
        if (points.length < 2 && lines.length >= 2) {
            const x1 = sourceTable.X + (sourceTable.Width || 200);
            const y1 = sourceTable.Y + (sourceTable.Height || 150) / 2;
            const x2 = targetTable.X;
            const y2 = targetTable.Y + (targetTable.Height || 150) / 2;
            for (const ln of lines) {
                ln.setAttribute("x1", x1); ln.setAttribute("y1", y1);
                ln.setAttribute("x2", x2); ln.setAttribute("y2", y2);
            }
            lines[1].setAttribute("stroke", lineColor);
            return;
        }

        pGroup.innerHTML = "";
        const fresh = CreateRelationElement(pRef);
        if (fresh) {
            while (fresh.firstChild) pGroup.appendChild(fresh.firstChild);
        }
    }

    function GetTableColor(pTableID) {
        const table = _Model.Tables.find(t => t.ID === pTableID);
        if (table && table.FillProp)
            return ArgbToCssColor(table.FillProp);
        return "#2d8a4e";
    }

    function CreateRelationElement(pRef) {
        // Source is normally a field ID - find the table that contains this field.
        // Fallback: legacy 1:1 Table→Table references use the source table ID directly.
        let sourceTable = _Model.Tables.find(t =>
            t.Fields && t.Fields.some(f => f.ID === pRef.SourceFieldID)
        );
        if (!sourceTable)
            sourceTable = _Model.Tables.find(t => t.ID === pRef.SourceFieldID);
        // Target is a table ID
        const targetTable = _Model.Tables.find(t => t.ID === pRef.TargetTableID);

        if (!sourceTable || !targetTable)
            return null;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-reference");
        g.setAttribute("data-id", pRef.ID);

        // If there are routing points, use them; otherwise compute a simple path
        const pointsRaw = pRef.Points && pRef.Points.length >= 2 ? pRef.Points : [];
        const points = SimplifyReferencePoints(pointsRaw, sourceTable, targetTable);

        const lineColor = GetTableColor(pRef.TargetTableID);

        if (points.length >= 2) {
            // Hit-area path (wide, transparent) — makes the thin line easy to click
            const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            hitPath.setAttribute("class", "orm-reference-hit");
            hitPath.setAttribute("d", BuildPathFromPoints(points));
            g.appendChild(hitPath);

            // Visible routed path
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "orm-fk-line" + (pRef.IsOneToOne ? " orm-fk-line-one-to-one" : ""));
            path.setAttribute("d", BuildPathFromPoints(points));
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", lineColor);
            if (pRef.IsOneToOne)
                path.setAttribute("stroke-dasharray", "6 4");
            path.setAttribute("marker-end", "url(#arrowhead)");
            g.appendChild(path);
        }
        else {
            // Fallback: straight line
            const x1 = sourceTable.X + (sourceTable.Width || 200);
            const y1 = sourceTable.Y + (sourceTable.Height || 150) / 2;
            const x2 = targetTable.X;
            const y2 = targetTable.Y + (targetTable.Height || 150) / 2;

            const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hitLine.setAttribute("class", "orm-reference-hit");
            hitLine.setAttribute("x1", x1); hitLine.setAttribute("y1", y1);
            hitLine.setAttribute("x2", x2); hitLine.setAttribute("y2", y2);
            g.appendChild(hitLine);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "orm-fk-line" + (pRef.IsOneToOne ? " orm-fk-line-one-to-one" : ""));
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            line.setAttribute("stroke", lineColor);
            if (pRef.IsOneToOne)
                line.setAttribute("stroke-dasharray", "6 4");
            line.setAttribute("marker-end", "url(#arrowhead)");
            g.appendChild(line);
        }

        g.addEventListener("click", function (e) {
            e.stopPropagation();
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID, Toggle: true });
        });

        g.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();
            ShowRelationContextMenu(e.clientX, e.clientY, pRef.ID);
        });

        return g;
    }

    function UpdateSelectionVisuals() {
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) {
            const id = t.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                t.classList.add("selected");
            else
                t.classList.remove("selected");
        });

        const refs = _RelationsLayer.querySelectorAll(".orm-reference");
        refs.forEach(function (r) {
            const id = r.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                r.classList.add("selected");
            else
                r.classList.remove("selected");
        });

        const fields = _TablesLayer.querySelectorAll(".orm-field-group");
        fields.forEach(function (f) {
            const id = f.getAttribute("data-field-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                f.classList.add("selected");
            else
                f.classList.remove("selected");
        });

        DrawGroupBBox();
    }

    function ShowRenameInput(pElementID) {
        // Try to find table first
        let table = _Model.Tables.find(t => t.ID === pElementID);
        let field = null;
        let parentTable = null;

        // If not a table, look for a field
        if (!table) {
            for (const t of _Model.Tables) {
                if (t.Fields) {
                    field = t.Fields.find(f => f.ID === pElementID);
                    if (field) {
                        parentTable = t;
                        break;
                    }
                }
            }
        }

        if (!table && !field)
            return;

        let g, screenX, screenY, inputWidth, currentName;
        const cRect = _Canvas.getBoundingClientRect();

        if (table) {
            g = _TablesLayer.querySelector('[data-id="' + pElementID + '"]');
            if (!g) return;
            // Canvas → screen: canvas rect already carries scroll + zoom
            screenX  = table.X * _Zoom + cRect.left;
            screenY  = table.Y * _Zoom + cRect.top;
            inputWidth = (table.Width || 200) * _Zoom;
            currentName = table.Name || "";
        }
        else {
            g = _TablesLayer.querySelector('[data-field-id="' + pElementID + '"]');
            if (!g) return;
            // DOM element already positioned by CSS transform → getBoundingClientRect is correct
            const fieldRect = g.getBoundingClientRect();
            screenX  = fieldRect.left;
            screenY  = fieldRect.top;
            inputWidth = (parentTable.Width || 200) * _Zoom;
            currentName = field.Name || "";
        }

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("class", "rename-input");
        input.value = currentName;
        input.style.left  = (screenX + 10) + "px";
        input.style.top   = (screenY  + 4) + "px";
        input.style.width = (inputWidth - 20) + "px";

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = function () {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                SendMessage(XMessageType.RenameCompleted, { NewName: newName });
            }
            input.remove();
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            }
            else if (e.key === "Escape") {
                e.preventDefault();
                input.remove();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", Initialize);

    // ═══════════════════════════════════════════════════════════════════════
    // SHADOW TABLE PICKER
    // ═══════════════════════════════════════════════════════════════════════

    function OpenShadowPickerModal(pPayload) {
        if (!pPayload || !pPayload.Models)
            return;

        _ShadowPickerData = pPayload;

        const overlay = document.getElementById("shadow-picker-overlay");
        const searchInput = document.getElementById("shadow-search");
        const status = document.getElementById("shadow-status");

        searchInput.value = "";
        status.textContent = "";
        BuildShadowTree(pPayload.Models, "");

        overlay.style.display = "flex";

        document.getElementById("shadow-picker-close").onclick = CloseShadowPickerModal;
        document.getElementById("shadow-btn-cancel").onclick = CloseShadowPickerModal;

        const addBtn = document.getElementById("shadow-btn-add");
        if (addBtn) {
            addBtn.onclick = function () {
                const selectedItems = document.querySelectorAll(".shadow-table-item.selected");
                if (selectedItems.length === 0)
                    return;

                for (const item of selectedItems) {
                    const m = JSON.parse(item.getAttribute("data-model"));
                    const t = JSON.parse(item.getAttribute("data-table"));
                    SendMessage(XMessageType.AddShadowTable, {
                        X: _ShadowPickerData.X,
                        Y: _ShadowPickerData.Y,
                        ModelName: m.ModelName,
                        DocumentID: m.DocumentID,
                        DocumentName: m.DocumentName,
                        ModuleID: m.ModuleID,
                        ModuleName: m.ModuleName,
                        TableID: t.ID,
                        TableName: t.Name
                    });
                }
                CloseShadowPickerModal();
            };
        }

        searchInput.oninput = function () {
            BuildShadowTree(pPayload.Models, searchInput.value);
        };

        searchInput.onkeydown = function (e) {
            if (e.key === "Escape")
                CloseShadowPickerModal();
        };

        overlay.focus();
        searchInput.focus();
    }

    function CloseShadowPickerModal() {
        const overlay = document.getElementById("shadow-picker-overlay");
        if (overlay)
            overlay.style.display = "none";
        _ShadowPickerData = null;
    }

    function BuildShadowTree(pModels, pFilter) {
        const tree = document.getElementById("shadow-tree");
        tree.innerHTML = "";

        const filter = (pFilter || "").toLowerCase().trim();
        let visibleCount = 0;
        let totalCount = 0;

        for (const model of pModels) {
            const matchingTables = model.Tables.filter(function (t) {
                totalCount++;
                return !filter || t.Name.toLowerCase().indexOf(filter) >= 0;
            });

            if (matchingTables.length === 0)
                continue;

            visibleCount += matchingTables.length;

            const groupEl = document.createElement("div");
            groupEl.className = "shadow-group";
            groupEl.textContent = model.ModelName || model.DocumentName;
            tree.appendChild(groupEl);

            for (const tbl of matchingTables) {
                const itemEl = document.createElement("div");
                itemEl.className = "shadow-table-item";
                itemEl.textContent = tbl.Name;
                itemEl.title = model.DocumentName + " \u203a " + tbl.Name;

                itemEl.setAttribute("data-model", JSON.stringify(model));
                itemEl.setAttribute("data-table", JSON.stringify(tbl));

                itemEl.addEventListener("click", function (e) {
                    if (e.ctrlKey || e.metaKey) {
                        itemEl.classList.toggle("selected");
                    }
                    else {
                        const items = tree.querySelectorAll(".shadow-table-item");
                        for (const it of items)
                            it.classList.remove("selected");
                        itemEl.classList.add("selected");
                    }
                });

                itemEl.addEventListener("dblclick", (function (m, t) {
                    return function () {
                        if (!_ShadowPickerData)
                            return;
                        SendMessage(XMessageType.AddShadowTable, {
                            X: _ShadowPickerData.X,
                            Y: _ShadowPickerData.Y,
                            ModelName: m.ModelName,
                            DocumentID: m.DocumentID,
                            DocumentName: m.DocumentName,
                            ModuleID: m.ModuleID,
                            ModuleName: m.ModuleName,
                            TableID: t.ID,
                            TableName: t.Name
                        });
                        CloseShadowPickerModal();
                    };
                })(model, tbl));

                tree.appendChild(itemEl);
            }
        }

        const statusEl = document.getElementById("shadow-status");
        if (statusEl)
            statusEl.textContent = visibleCount + " of " + totalCount + " tables";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SEED DATA EDITOR
    // ═══════════════════════════════════════════════════════════════════════

    function OpenSeedEditorModal(pPayload) {
        if (!pPayload || !pPayload.TableID)
            return;

        _SeedEditor = {
            TableID: pPayload.TableID,
            TableName: pPayload.TableName || "Table",
            Columns: pPayload.Columns || [],
            Rows: (pPayload.Rows || []).map(function (r) {
                return { TupleID: r.TupleID, Values: Object.assign({}, r.Values), IsNew: false };
            }),
            SelectedRows: new Set()
        };
        _SeedNextNewId = 0;
        _IndexEditor = null;

        const overlay = document.getElementById("seed-editor-overlay");
        const title = document.getElementById("seed-modal-title");

        title.textContent = "Table Options — " + _SeedEditor.TableName;

        BuildSeedGrid();
        UpdateSeedRowCount();
        SetSeedStatusMessage("");
        SetSeedValidationBadge(null);
        document.getElementById("seed-btn-save").disabled = false;

        overlay.style.display = "flex";

        // Close handlers
        document.getElementById("seed-modal-close").onclick = CloseSeedEditorModal;
        document.getElementById("seed-btn-cancel").onclick = CloseSeedEditorModal;
        overlay.addEventListener("mousedown", function (e) {
            if (e.target === overlay)
                CloseSeedEditorModal();
        }, { once: true });

        document.getElementById("seed-add-row").onclick = AddSeedRow;
        document.getElementById("seed-delete-rows").onclick = DeleteSelectedSeedRows;
        document.getElementById("index-add-btn").onclick = AddIndex;

        // Tabs
        document.getElementById("tab-btn-seed").onclick = function () { SwitchTableOptionsTab("seed"); };
        document.getElementById("tab-btn-indexes").onclick = function () { SwitchTableOptionsTab("indexes"); };
        SwitchTableOptionsTab("seed");

        // Kick off the Indexes tab load in the background so it's ready by the time
        // the user switches — the badge/list render as soon as the payload lands.
        SendMessage(XMessageType.RequestIndexes, { TableID: pPayload.TableID });

        // Keyboard shortcuts — attach to document, guarded by modal open state
        document.addEventListener("keydown", HandleSeedKeydown);

        overlay.focus();
    }

    // ── Table Options tabs ──────────────────────────────────────────────────

    function SwitchTableOptionsTab(pTab) {
        _TableOptionsActiveTab = pTab;

        const seedPanel = document.getElementById("tab-panel-seed");
        const indexPanel = document.getElementById("tab-panel-indexes");
        const seedBtn = document.getElementById("tab-btn-seed");
        const indexBtn = document.getElementById("tab-btn-indexes");
        const rowCountBadge = document.getElementById("seed-row-count");

        const isSeed = pTab === "seed";
        seedPanel.style.display = isSeed ? "" : "none";
        indexPanel.style.display = isSeed ? "none" : "";
        seedBtn.classList.toggle("active", isSeed);
        indexBtn.classList.toggle("active", !isSeed);
        seedBtn.setAttribute("aria-selected", String(isSeed));
        indexBtn.setAttribute("aria-selected", String(!isSeed));
        rowCountBadge.style.display = isSeed ? "" : "none";

        document.getElementById("seed-btn-save").onclick = isSeed ? SaveSeedEditorData : SaveIndexEditorData;
        SetSeedStatusMessage("");
        SetSeedValidationBadge(null);
    }

    function CloseSeedEditorModal() {
        const overlay = document.getElementById("seed-editor-overlay");
        overlay.style.display = "none";
        document.removeEventListener("keydown", HandleSeedKeydown);
        _SeedEditor = null;
        _IndexEditor = null;
    }

    function HandleSeedKeydown(pEvent) {
        if (pEvent.key === "Escape") {
            pEvent.preventDefault();
            CloseSeedEditorModal();
        }
        else if (pEvent.key === "Enter" && (pEvent.ctrlKey || pEvent.metaKey)) {
            pEvent.preventDefault();
            if (_TableOptionsActiveTab === "seed")
                SaveSeedEditorData();
            else
                SaveIndexEditorData();
        }
        else if (pEvent.key === "Delete" && _TableOptionsActiveTab === "seed" && !IsEditableTarget(pEvent.target)) {
            DeleteSelectedSeedRows();
        }
    }

    function IsEditableTarget(pTarget) {
        return pTarget && (pTarget.tagName === "INPUT" || pTarget.tagName === "SELECT" || pTarget.tagName === "TEXTAREA");
    }

    // ── Grid rendering ───────────────────────────────────────────────────

    function BuildSeedGrid() {
        if (!_SeedEditor)
            return;

        const columns = _SeedEditor.Columns;
        const rows = _SeedEditor.Rows;

        // Build header
        const thead = document.getElementById("seed-grid-head");
        thead.innerHTML = "";
        const headerRow = document.createElement("tr");

        // Select-all column
        const thSelect = document.createElement("th");
        thSelect.className = "col-select";
        const selectAllChk = document.createElement("input");
        selectAllChk.type = "checkbox";
        selectAllChk.className = "seed-row-checkbox";
        selectAllChk.title = "Select all";
        selectAllChk.addEventListener("change", function () {
            if (this.checked) {
                for (let i = 0; i < _SeedEditor.Rows.length; i++)
                    _SeedEditor.SelectedRows.add(i);
            }
            else {
                _SeedEditor.SelectedRows.clear();
            }
            UpdateRowSelectionVisuals();
        });
        thSelect.appendChild(selectAllChk);
        headerRow.appendChild(thSelect);

        for (const col of columns) {
            const th = document.createElement("th");
            const inner = document.createElement("div");
            inner.className = "th-inner";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = col.Name;
            inner.appendChild(nameSpan);

            if (col.IsPrimaryKey) {
                const badge = document.createElement("span");
                badge.className = "seed-col-badge seed-col-pk";
                badge.textContent = "PK";
                inner.appendChild(badge);
            }
            else if (col.IsForeignKey) {
                const badge = document.createElement("span");
                badge.className = "seed-col-badge seed-col-fk";
                badge.textContent = "FK";
                inner.appendChild(badge);
            }

            if (col.IsRequired && !col.IsPrimaryKey) {
                const req = document.createElement("span");
                req.className = "seed-col-req";
                req.textContent = "*";
                req.title = "Required";
                inner.appendChild(req);
            }

            // DataType hint
            const typeSpan = document.createElement("span");
            typeSpan.style.cssText = "font-size:9px;opacity:0.5;font-weight:400;text-transform:none;";
            typeSpan.textContent = " " + GetShortTypeName(col.DataType);
            inner.appendChild(typeSpan);

            th.appendChild(inner);
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);

        // Build body
        const tbody = document.getElementById("seed-grid-body");
        tbody.innerHTML = "";

        if (rows.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = columns.length + 1;
            td.innerHTML = "<div class='seed-empty-state'><span class='seed-empty-icon'>🗂️</span>No rows yet. Click <b>Add Row</b> to begin.</div>";
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        else {
            for (let i = 0; i < rows.length; i++)
                tbody.appendChild(BuildSeedGridRow(rows[i], columns, i));
        }
    }

    function BuildSeedGridRow(pRow, pColumns, pRowIndex) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-row-index", pRowIndex);
        if (pRow.IsNew)
            tr.classList.add("seed-row-new");
        if (_SeedEditor.SelectedRows.has(pRowIndex))
            tr.classList.add("seed-row-selected");

        // Selection checkbox
        const tdSelect = document.createElement("td");
        tdSelect.className = "col-select";
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "seed-row-checkbox";
        chk.checked = _SeedEditor.SelectedRows.has(pRowIndex);
        chk.addEventListener("change", function () {
            if (this.checked)
                _SeedEditor.SelectedRows.add(pRowIndex);
            else
                _SeedEditor.SelectedRows.delete(pRowIndex);
            tr.classList.toggle("seed-row-selected", this.checked);
            SyncSelectAllCheckbox();
        });
        tdSelect.appendChild(chk);
        tr.appendChild(tdSelect);

        // Data cells
        for (const col of pColumns) {
            const td = document.createElement("td");
            const currentValue = pRow.Values[col.FieldID] !== undefined ? pRow.Values[col.FieldID] : "";

            const widget = BuildCellWidget(col, currentValue, pRow, pColumns);
            td.appendChild(widget);
            tr.appendChild(td);
        }

        // Row click for selection (not on input/select)
        tr.addEventListener("click", function (e) {
            if (IsEditableTarget(e.target) || e.target.type === "checkbox")
                return;
            const isSelected = _SeedEditor.SelectedRows.has(pRowIndex);
            if (e.ctrlKey || e.metaKey) {
                if (isSelected)
                    _SeedEditor.SelectedRows.delete(pRowIndex);
                else
                    _SeedEditor.SelectedRows.add(pRowIndex);
            }
            else {
                _SeedEditor.SelectedRows.clear();
                _SeedEditor.SelectedRows.add(pRowIndex);
            }
            UpdateRowSelectionVisuals();
        });

        return tr;
    }

    function BuildCellWidget(pCol, pCurrentValue, pRow, pAllColumns) {
        // Boolean type → checkbox
        if (pCol.DataType === "Boolean") {
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "seed-cell-checkbox";
            chk.checked = pCurrentValue === "true" || pCurrentValue === "1";
            chk.addEventListener("change", function () {
                pRow.Values[pCol.FieldID] = this.checked ? "true" : "false";
                ClearCellError(this.parentElement);
            });
            return chk;
        }

        // FK field with options → select
        if (pCol.IsForeignKey && pCol.FKOptions && pCol.FKOptions.length > 0) {
            const sel = document.createElement("select");
            sel.className = "seed-cell-select";
            sel.title = pCol.FKTableName ? "References: " + pCol.FKTableName : "";

            // Blank option for non-required
            if (!pCol.IsRequired) {
                const blankOpt = document.createElement("option");
                blankOpt.value = "";
                blankOpt.textContent = "— none —";
                sel.appendChild(blankOpt);
            }

            for (const opt of pCol.FKOptions) {
                const option = document.createElement("option");
                option.value = opt.Value;
                option.textContent = opt.Label || opt.Value;
                if (opt.Value === pCurrentValue)
                    option.selected = true;
                sel.appendChild(option);
            }

            // If current value not in options, add it (data from C#)
            if (pCurrentValue && !pCol.FKOptions.some(function (o) { return o.Value === pCurrentValue; })) {
                const orphan = document.createElement("option");
                orphan.value = pCurrentValue;
                orphan.textContent = pCurrentValue + " ⚠";
                orphan.selected = true;
                sel.appendChild(orphan);
            }

            sel.addEventListener("change", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });

            return sel;
        }

        // Date/DateTime → date input
        if (pCol.DataType === "Date" || pCol.DataType === "DateTime") {
            const inp = document.createElement("input");
            inp.type = pCol.DataType === "Date" ? "date" : "datetime-local";
            inp.className = "seed-cell-input";
            inp.value = FormatDateForInput(pCurrentValue, pCol.DataType);

            inp.addEventListener("input", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });
            inp.addEventListener("change", function () {
                pRow.Values[pCol.FieldID] = this.value;
            });

            return inp;
        }

        // Number types → numeric input
        if (IsNumericType(pCol.DataType)) {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.inputMode = "numeric";
            inp.className = "seed-cell-input" + (pCol.IsPrimaryKey ? " seed-cell-pk" : "");
            inp.value = pCurrentValue;
            inp.placeholder = pCol.DataType === "Guid" ? "GUID" : "0";
            if (pCol.IsPrimaryKey && pCurrentValue === "")
                inp.value = SuggestNextPKValue(pAllColumns, pCol);

            inp.addEventListener("input", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });
            inp.addEventListener("blur", function () {
                const err = ValidateCellValue(pCol, this.value);
                if (err)
                    ShowCellError(this.parentElement, err);
            });

            return inp;
        }

        // Guid type → text with pattern
        if (pCol.DataType === "Guid") {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.className = "seed-cell-input" + (pCol.IsPrimaryKey ? " seed-cell-pk" : "");
            inp.value = pCurrentValue;
            inp.placeholder = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
            inp.maxLength = 36;

            inp.addEventListener("input", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });
            inp.addEventListener("blur", function () {
                const err = ValidateCellValue(pCol, this.value);
                if (err)
                    ShowCellError(this.parentElement, err);
            });

            return inp;
        }
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "seed-cell-input" + (pCol.IsPrimaryKey ? " seed-cell-pk" : "");
        inp.value = pCurrentValue;

        if (pCol.DataType === "Text")
            inp.title = "Text (unlimited length)";
        else if (pCol.Length && pCol.Length > 0) {
            inp.maxLength = pCol.Length;
            inp.title = "Max length: " + pCol.Length;
        }

        inp.addEventListener("input", function () {
            pRow.Values[pCol.FieldID] = this.value;
            ClearCellError(this.parentElement);
        });
        inp.addEventListener("blur", function () {
            const err = ValidateCellValue(pCol, this.value);
            if (err)
                ShowCellError(this.parentElement, err);
        });

        return inp;
    }

    function SuggestNextPKValue(pAllColumns, pPKColumn) {
        if (!_SeedEditor)
            return "";

        if (pPKColumn.DataType === "Guid")
            return GenerateSequentialGuid();

        // Find max existing PK value and return max+1
        let max = -1;
        for (const row of _SeedEditor.Rows) {
            const val = row.Values[pPKColumn.FieldID];
            if (val !== undefined && val !== "") {
                const n = parseInt(val, 10);
                if (!isNaN(n) && n > max)
                    max = n;
            }
        }

        return String(max + 1);
    }

    /**
     * Generates a time-ordered UUID (UUID v7 style).
     * The first 48 bits are the current timestamp in ms, making values
     * naturally sortable by creation order while remaining unique.
     */
    function GenerateSequentialGuid() {
        const now = Date.now();
        _GuidSeq = (_GuidSeq + 1) & 0xFFF;

        // p1 + p2: 48-bit ms timestamp (sortable prefix)
        const tsHex = now.toString(16).padStart(12, "0");
        const p1 = tsHex.substring(0, 8);
        const p2 = tsHex.substring(8, 12);

        // p3: version nibble (7) + 12-bit sequence counter
        const p3 = "7" + _GuidSeq.toString(16).padStart(3, "0");

        // p4: variant bits (10xx) + 14 random bits
        const varNibble = (0x8 | (Math.random() * 4 | 0)).toString(16);
        const randA = (Math.random() * 0xFFF | 0).toString(16).padStart(3, "0");
        const p4 = varNibble + randA;

        // p5: 48 random bits
        // `0xFFFFFFFF` overflows the 32-bit SIGNED range that `| 0` truncates to, so roughly
        // half the time that produced a negative number — and toString(16) prints a leading
        // "-" for negatives, corrupting the GUID with a stray dash. `>>> 0` truncates to
        // UNSIGNED 32-bit instead, which is what an 8-hex-digit segment actually needs.
        const p5 = (Math.random() * 0x100000000 >>> 0).toString(16).padStart(8, "0") +
            (Math.random() * 0xFFFF | 0).toString(16).padStart(4, "0");

        return p1 + "-" + p2 + "-" + p3 + "-" + p4 + "-" + p5;
    }

    // ── Row operations ────────────────────────────────────────────────────

    function AddSeedRow() {
        if (!_SeedEditor)
            return;

        const newRow = { TupleID: "NEW_" + (_SeedNextNewId++), Values: {}, IsNew: true };

        // Pre-populate defaults
        for (const col of _SeedEditor.Columns) {
            if (col.DataType === "Boolean")
                newRow.Values[col.FieldID] = "false";
            else if (col.IsPrimaryKey)
                newRow.Values[col.FieldID] = SuggestNextPKValue(_SeedEditor.Columns, col);
            else if (col.IsForeignKey && col.FKOptions && col.FKOptions.length > 0 && col.IsRequired)
                newRow.Values[col.FieldID] = col.FKOptions[0].Value;
            else
                newRow.Values[col.FieldID] = "";
        }

        _SeedEditor.Rows.push(newRow);
        _SeedEditor.SelectedRows.clear();

        // Re-render the grid
        BuildSeedGrid();
        UpdateSeedRowCount();
        SetSeedValidationBadge(null);

        // Focus first editable cell of the new row
        const tbody = document.getElementById("seed-grid-body");
        const newTR = tbody.lastElementChild;
        if (newTR) {
            const firstInput = newTR.querySelector("input:not([type=checkbox]), select");
            if (firstInput) {
                firstInput.focus();
                if (firstInput.type === "text")
                    firstInput.select();
                newTR.scrollIntoView({ block: "nearest" });
            }
        }
    }

    function DeleteSelectedSeedRows() {
        if (!_SeedEditor || _SeedEditor.SelectedRows.size === 0)
            return;

        const indices = Array.from(_SeedEditor.SelectedRows).sort(function (a, b) { return b - a; });
        for (const idx of indices)
            _SeedEditor.Rows.splice(idx, 1);

        _SeedEditor.SelectedRows.clear();
        BuildSeedGrid();
        UpdateSeedRowCount();
        SetSeedValidationBadge(null);
        SetSeedStatusMessage(indices.length + " row(s) deleted.", "");
    }

    // ── Selection visuals ─────────────────────────────────────────────────

    function UpdateRowSelectionVisuals() {
        if (!_SeedEditor)
            return;

        const tbody = document.getElementById("seed-grid-body");
        const rows = tbody.querySelectorAll("tr[data-row-index]");

        rows.forEach(function (tr) {
            const idx = parseInt(tr.getAttribute("data-row-index"), 10);
            const selected = _SeedEditor.SelectedRows.has(idx);
            tr.classList.toggle("seed-row-selected", selected);
            const chk = tr.querySelector(".seed-row-checkbox");
            if (chk)
                chk.checked = selected;
        });

        SyncSelectAllCheckbox();
    }

    function SyncSelectAllCheckbox() {
        if (!_SeedEditor)
            return;
        const selectAll = document.querySelector("#seed-grid-head .seed-row-checkbox");
        if (!selectAll)
            return;
        const total = _SeedEditor.Rows.length;
        const selectedCount = _SeedEditor.SelectedRows.size;
        selectAll.checked = total > 0 && selectedCount === total;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < total;
    }

    function UpdateSeedRowCount() {
        if (!_SeedEditor)
            return;
        const badge = document.getElementById("seed-row-count");
        const n = _SeedEditor.Rows.length;
        badge.textContent = n + (n === 1 ? " row" : " rows");
    }

    // ── Validation ────────────────────────────────────────────────────────

    const NumericTypes = ["Int8", "Int16", "Int32", "Int64", "Decimal", "Float", "Double", "Numeric", "Byte"];

    function IsNumericType(pDataType) {
        return NumericTypes.indexOf(pDataType) >= 0;
    }

    function GetShortTypeName(pDataType) {
        const map = {
            "String": "str", "Text": "txt", "Int8": "i8", "Int16": "i16",
            "Int32": "i32", "Int64": "i64", "Decimal": "dec", "Numeric": "num",
            "Float": "f32", "Double": "f64", "Boolean": "bool",
            "Date": "date", "DateTime": "dt", "Guid": "guid", "Binary": "bin", "Byte": "byte"
        };
        return map[pDataType] || pDataType.toLowerCase().substring(0, 4);
    }

    function FormatDateForInput(pValue, pDataType) {
        if (!pValue)
            return "";
        // Try to parse and reformat for date/datetime-local inputs
        try {
            const d = new Date(pValue);
            if (isNaN(d.getTime()))
                return pValue;
            if (pDataType === "Date")
                return d.toISOString().substring(0, 10);
            // datetime-local: YYYY-MM-DDTHH:MM
            return d.toISOString().substring(0, 16);
        }
        catch {
            return pValue;
        }
    }

    function ValidateCellValue(pCol, pValue) {
        if (!pValue && pValue !== "0" && pValue !== "false") {
            if (pCol.IsRequired || pCol.IsPrimaryKey)
                return pCol.Name + " is required.";
            return null;
        }

        if (IsNumericType(pCol.DataType)) {
            const n = Number(pValue);
            if (isNaN(n))
                return pCol.Name + ": expected a number.";
            if ((pCol.DataType === "Int8" || pCol.DataType === "Int16" ||
                pCol.DataType === "Int32" || pCol.DataType === "Int64") && !Number.isInteger(n))
                return pCol.Name + ": expected an integer.";
        }

        if (pCol.DataType === "Guid") {
            const guidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            if (!guidRe.test(pValue))
                return pCol.Name + ": invalid GUID format.";
        }

        if (pCol.IsForeignKey && pCol.FKOptions && pCol.FKOptions.length > 0) {
            const valid = pCol.FKOptions.some(function (o) { return o.Value === pValue; });
            if (!valid)
                return pCol.Name + ": value not found in " + (pCol.FKTableName || "referenced table") + ".";
        }

        if (pCol.Length && pCol.Length > 0 && pValue.length > pCol.Length)
            return pCol.Name + ": max length is " + pCol.Length + " (current: " + pValue.length + ").";

        return null;
    }

    function ValidateAllSeedRows() {
        if (!_SeedEditor)
            return [];

        const errors = [];
        const pkColumn = _SeedEditor.Columns.find(function (c) { return c.IsPrimaryKey; });
        const pkValues = new Set();

        for (let i = 0; i < _SeedEditor.Rows.length; i++) {
            const row = _SeedEditor.Rows[i];

            for (const col of _SeedEditor.Columns) {
                const value = row.Values[col.FieldID] !== undefined ? row.Values[col.FieldID] : "";
                const err = ValidateCellValue(col, value);
                if (err)
                    errors.push({ Row: i, FieldID: col.FieldID, Message: err });
            }

            // PK uniqueness
            if (pkColumn) {
                const pkVal = row.Values[pkColumn.FieldID];
                if (pkVal !== undefined && pkVal !== "") {
                    if (pkValues.has(pkVal))
                        errors.push({ Row: i, FieldID: pkColumn.FieldID, Message: "Duplicate PK value: " + pkVal });
                    else
                        pkValues.add(pkVal);
                }
            }
        }

        return errors;
    }

    function ShowCellError(pTD, pMessage) {
        if (!pTD)
            return;
        const widget = pTD.querySelector("input, select");
        if (widget)
            widget.classList.add("cell-error");

        let errSpan = pTD.querySelector(".seed-cell-error-msg");
        if (!errSpan) {
            errSpan = document.createElement("span");
            errSpan.className = "seed-cell-error-msg";
            pTD.appendChild(errSpan);
        }
        errSpan.textContent = pMessage;
        pTD.closest("tr").classList.add("seed-row-error");
    }

    function ClearCellError(pTD) {
        if (!pTD)
            return;
        const widget = pTD.querySelector("input, select");
        if (widget)
            widget.classList.remove("cell-error");
        const errSpan = pTD.querySelector(".seed-cell-error-msg");
        if (errSpan)
            errSpan.remove();

        // Only remove row-error class if no other errors remain
        const tr = pTD.closest("tr");
        if (tr && tr.querySelectorAll(".seed-cell-error-msg").length === 0)
            tr.classList.remove("seed-row-error");
    }

    function HighlightValidationErrors(pErrors) {
        if (!_SeedEditor)
            return;

        // Clear existing errors first
        const tbody = document.getElementById("seed-grid-body");
        tbody.querySelectorAll(".cell-error").forEach(function (el) { el.classList.remove("cell-error"); });
        tbody.querySelectorAll(".seed-cell-error-msg").forEach(function (el) { el.remove(); });
        tbody.querySelectorAll(".seed-row-error").forEach(function (tr) { tr.classList.remove("seed-row-error"); });

        const columns = _SeedEditor.Columns;

        for (const err of pErrors) {
            const tr = tbody.querySelector("tr[data-row-index='" + err.Row + "']");
            if (!tr)
                continue;

            // Column index: +1 because of select column
            const colIdx = columns.findIndex(function (c) { return c.FieldID === err.FieldID; });
            if (colIdx < 0)
                continue;

            const td = tr.querySelectorAll("td")[colIdx + 1];
            if (td)
                ShowCellError(td, err.Message);

            tr.scrollIntoView({ block: "nearest" });
        }
    }

    function SetSeedValidationBadge(pErrors) {
        const badge = document.getElementById("seed-validation-badge");
        if (!pErrors || pErrors.length === 0) {
            badge.style.display = "none";
            badge.textContent = "";
        }
        else {
            badge.style.display = "flex";
            badge.textContent = "⚠ " + pErrors.length + " validation error" + (pErrors.length > 1 ? "s" : "");
        }
    }

    // ── Save / Collect ────────────────────────────────────────────────────

    function CollectSeedData() {
        if (!_SeedEditor)
            return [];

        return _SeedEditor.Rows.map(function (row) {
            return {
                TupleID: row.TupleID.startsWith("NEW_") ? "NEW" : row.TupleID,
                Values: Object.assign({}, row.Values)
            };
        });
    }

    function SaveSeedEditorData() {
        if (!_SeedEditor)
            return;

        // Flush any focused input values
        const focused = document.activeElement;
        if (focused && IsEditableTarget(focused))
            focused.blur();

        // Validate
        const errors = ValidateAllSeedRows();
        if (errors.length > 0) {
            HighlightValidationErrors(errors);
            SetSeedValidationBadge(errors);
            SetSeedStatusMessage("Please fix validation errors before saving.", "err");
            return;
        }

        SetSeedValidationBadge(null);
        document.getElementById("seed-btn-save").disabled = true;
        SetSeedStatusMessage("Saving...", "");

        const rows = CollectSeedData();

        SendMessage(XMessageType.SaveSeedData, {
            TableID: _SeedEditor.TableID,
            Rows: rows
        });
    }

    function OnSeedDataSaved(pPayload) {
        if (!_SeedEditor)
            return;

        const btnSave = document.getElementById("seed-btn-save");
        if (!btnSave)
            return;

        if (pPayload && pPayload.Success) {
            SetSeedStatusMessage("✓ Saved successfully.", "ok");
            btnSave.disabled = false;
            // Update internal row IDs so any "NEW" rows get proper IDs on next refresh
            // Close after brief confirmation
            setTimeout(CloseSeedEditorModal, 900);
        }
        else {
            const msg = (pPayload && pPayload.Message) ? pPayload.Message : "Failed to save.";
            SetSeedStatusMessage("✕ " + msg, "err");
            btnSave.disabled = false;
        }
    }

    // ── Status helpers ────────────────────────────────────────────────────

    function SetSeedStatusMessage(pMsg, pType) {
        const el = document.getElementById("seed-status-msg");
        if (!el)
            return;
        el.textContent = pMsg;
        el.className = "seed-status-msg" + (pType ? " status-" + pType : "");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INDEX EDITOR (Table Options → Indexes tab)
    // ═══════════════════════════════════════════════════════════════════════

    function OnIndexesLoaded(pPayload) {
        if (!pPayload || !pPayload.TableID)
            return;

        // Preserve the current selection across a reload triggered while the modal is open.
        const previousSelectedID = _IndexEditor ? _IndexEditor.SelectedIndexID : null;

        _IndexEditor = {
            TableID: pPayload.TableID,
            TableName: pPayload.TableName || "Table",
            Columns: pPayload.Columns || [],
            Indexes: (pPayload.Indexes || []).map(function (ix) {
                const filter = ix.Filter || "";
                const parsedConditions = ParseFilterExpression(filter, pPayload.Columns || []);
                return {
                    IndexID: ix.IndexID,
                    Name: ix.Name || "",
                    IsUnique: !!ix.IsUnique,
                    Filter: filter,
                    FilterConditions: parsedConditions || [],
                    FilterMode: parsedConditions !== null ? "guided" : "advanced",
                    Fields: (ix.Fields || []).map(function (f) {
                        return {
                            FieldID: f.FieldID,
                            IsDescending: !!f.IsDescending,
                            AllowDuplicate: !!f.AllowDuplicate,
                            IsIncluded: !!f.IsIncluded
                        };
                    })
                };
            }),
            SelectedIndexID: null
        };
        _IndexNextNewId = 0;

        const stillExists = previousSelectedID && _IndexEditor.Indexes.some(function (ix) { return ix.IndexID === previousSelectedID; });
        _IndexEditor.SelectedIndexID = stillExists ? previousSelectedID : (_IndexEditor.Indexes[0] ? _IndexEditor.Indexes[0].IndexID : null);

        RenderIndexList();
        RenderIndexDetail();
    }

    function GetSelectedIndex() {
        if (!_IndexEditor || !_IndexEditor.SelectedIndexID)
            return null;
        return _IndexEditor.Indexes.find(function (ix) { return ix.IndexID === _IndexEditor.SelectedIndexID; }) || null;
    }

    function SuggestIndexName(pIndex) {
        const fieldNames = pIndex.Fields
            .filter(function (f) { return !f.IsIncluded; })
            .map(function (f) {
                const col = _IndexEditor.Columns.find(function (c) { return c.FieldID === f.FieldID; });
                return col ? col.Name : "";
            })
            .filter(function (n) { return n; });
        const prefix = pIndex.IsUnique ? "UX_" : "IX_";
        return prefix + _IndexEditor.TableName + (fieldNames.length ? "_" + fieldNames.join("_") : "");
    }

    // ── List pane ────────────────────────────────────────────────────────────

    function RenderIndexList() {
        const list = document.getElementById("index-list");
        if (!list || !_IndexEditor)
            return;

        list.innerHTML = "";

        if (_IndexEditor.Indexes.length === 0) {
            const empty = document.createElement("div");
            empty.className = "index-list-empty";
            empty.textContent = "No indexes yet.";
            list.appendChild(empty);
            return;
        }

        for (const ix of _IndexEditor.Indexes) {
            const item = document.createElement("div");
            item.className = "index-list-item" + (ix.IndexID === _IndexEditor.SelectedIndexID ? " active" : "");
            item.setAttribute("data-index-id", ix.IndexID);

            const info = document.createElement("div");
            info.className = "index-list-item-info";

            const nameRow = document.createElement("div");
            nameRow.className = "index-list-item-name";
            nameRow.textContent = ix.Name || "(unnamed)";
            if (ix.IsUnique) {
                const badge = document.createElement("span");
                badge.className = "seed-col-badge seed-col-pk";
                badge.textContent = "UNIQUE";
                nameRow.appendChild(badge);
            }
            info.appendChild(nameRow);

            const fieldsRow = document.createElement("div");
            fieldsRow.className = "index-list-item-fields";
            const keyCount = ix.Fields.filter(function (f) { return !f.IsIncluded; }).length;
            const incCount = ix.Fields.length - keyCount;
            fieldsRow.textContent = keyCount + (keyCount === 1 ? " column" : " columns") + (incCount ? " + " + incCount + " included" : "");
            info.appendChild(fieldsRow);

            item.appendChild(info);

            const removeBtn = document.createElement("button");
            removeBtn.className = "index-list-item-remove";
            removeBtn.title = "Delete index";
            removeBtn.textContent = "🗑️";
            removeBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                RemoveIndex(ix.IndexID);
            });
            item.appendChild(removeBtn);

            item.addEventListener("click", function () {
                _IndexEditor.SelectedIndexID = ix.IndexID;
                RenderIndexList();
                RenderIndexDetail();
            });

            list.appendChild(item);
        }
    }

    function AddIndex() {
        if (!_IndexEditor)
            return;

        const newIndex = {
            IndexID: "NEW_" + (_IndexNextNewId++),
            Name: "",
            IsUnique: false,
            Filter: "",
            FilterConditions: [],
            FilterMode: "guided",
            Fields: []
        };
        newIndex.Name = SuggestIndexName(newIndex);

        _IndexEditor.Indexes.push(newIndex);
        _IndexEditor.SelectedIndexID = newIndex.IndexID;

        RenderIndexList();
        RenderIndexDetail();

        const nameInput = document.querySelector("#index-detail-pane .index-name-input");
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }

    function RemoveIndex(pIndexID) {
        if (!_IndexEditor)
            return;

        _IndexEditor.Indexes = _IndexEditor.Indexes.filter(function (ix) { return ix.IndexID !== pIndexID; });

        if (_IndexEditor.SelectedIndexID === pIndexID)
            _IndexEditor.SelectedIndexID = _IndexEditor.Indexes[0] ? _IndexEditor.Indexes[0].IndexID : null;

        RenderIndexList();
        RenderIndexDetail();
    }

    // ── Detail pane ──────────────────────────────────────────────────────────

    function RenderIndexDetail() {
        const pane = document.getElementById("index-detail-pane");
        if (!pane)
            return;

        const index = GetSelectedIndex();
        pane.innerHTML = "";

        if (!index) {
            const empty = document.createElement("div");
            empty.className = "index-empty-state";
            empty.id = "index-empty-state";
            empty.innerHTML = "<span class='seed-empty-icon'>🔑</span>No index selected. Click <b>Add</b> to create one.";
            pane.appendChild(empty);
            return;
        }

        // Header row: name + unique
        const headerRow = document.createElement("div");
        headerRow.className = "index-detail-row";

        const nameLabel = document.createElement("label");
        nameLabel.className = "index-field-label";
        nameLabel.textContent = "Name";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "seed-cell-input index-name-input";
        nameInput.value = index.Name;
        nameInput.placeholder = SuggestIndexName(index);
        nameInput.addEventListener("input", function () {
            index.Name = this.value;
            RenderIndexList();
        });
        nameLabel.appendChild(nameInput);
        headerRow.appendChild(nameLabel);

        const uniqueLabel = document.createElement("label");
        uniqueLabel.className = "index-checkbox-label";
        const uniqueChk = document.createElement("input");
        uniqueChk.type = "checkbox";
        uniqueChk.checked = index.IsUnique;
        uniqueChk.addEventListener("change", function () {
            index.IsUnique = this.checked;
            RenderIndexDetail();
            RenderIndexList();
        });
        uniqueLabel.appendChild(uniqueChk);
        uniqueLabel.appendChild(document.createTextNode(" Unique"));
        uniqueLabel.title = "Enforces a UNIQUE constraint across the key columns below.";
        headerRow.appendChild(uniqueLabel);

        pane.appendChild(headerRow);

        pane.appendChild(BuildFilterSection(index));

        pane.appendChild(BuildIndexFieldsGrid(index, {
            IsIncluded: false,
            Title: "Index Columns",
            EmptyMessage: "No key columns yet — add at least one below.",
            AddPlaceholder: "+ Add key column…"
        }));

        pane.appendChild(BuildIndexFieldsGrid(index, {
            IsIncluded: true,
            Title: "Included Columns",
            EmptyMessage: "No included (covering) columns — this index will only carry its key.",
            AddPlaceholder: "+ Add included column…"
        }));
    }

    /**
     * Key columns and INCLUDE (covering) columns mean very different things — one defines
     * uniqueness/ordering, the other just rides along for read performance — so they get
     * their own grids instead of one table with a checkbox toggling what a row even means.
     */
    function BuildIndexFieldsGrid(pIndex, pConfig) {
        const groupFields = pIndex.Fields.filter(function (f) { return f.IsIncluded === pConfig.IsIncluded; });

        const section = document.createElement("div");
        section.className = "index-fields-section";

        const header = document.createElement("div");
        header.className = "index-fields-header";
        header.innerHTML = "<span>" + pConfig.Title + "</span>";

        const addFieldSelect = document.createElement("select");
        addFieldSelect.className = "seed-cell-select index-add-field-select";
        const placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        placeholderOpt.textContent = pConfig.AddPlaceholder;
        addFieldSelect.appendChild(placeholderOpt);

        const usedFieldIDs = new Set(pIndex.Fields.map(function (f) { return f.FieldID; }));
        for (const col of _IndexEditor.Columns) {
            if (usedFieldIDs.has(col.FieldID))
                continue;
            const opt = document.createElement("option");
            opt.value = col.FieldID;
            opt.textContent = col.Name;
            addFieldSelect.appendChild(opt);
        }
        addFieldSelect.addEventListener("change", function () {
            if (!this.value)
                return;
            pIndex.Fields.push({ FieldID: this.value, IsDescending: false, AllowDuplicate: false, IsIncluded: pConfig.IsIncluded });
            if (!pIndex.Name)
                pIndex.Name = SuggestIndexName(pIndex);
            RenderIndexDetail();
            RenderIndexList();
        });
        header.appendChild(addFieldSelect);
        section.appendChild(header);

        if (groupFields.length === 0) {
            const empty = document.createElement("div");
            empty.className = "index-fields-empty";
            empty.textContent = pConfig.EmptyMessage;
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "index-fields-table";
        const thead = document.createElement("thead");
        thead.innerHTML = pConfig.IsIncluded
            ? "<tr><th>Column</th><th></th><th></th></tr>"
            : "<tr><th>Column</th><th title='Sort direction'>Order</th>" +
              "<th title='Allow duplicate NULLs (only relevant for unique indexes)'>Dup. NULL</th><th></th><th></th></tr>";
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (let i = 0; i < groupFields.length; i++)
            tbody.appendChild(BuildIndexFieldRow(pIndex, groupFields[i], i, pConfig.IsIncluded));
        table.appendChild(tbody);

        section.appendChild(table);
        return section;
    }

    // ── Filter (WHERE) builder ──────────────────────────────────────────────
    //
    // Free-text SQL is a trap here: the same string has to mean something on every
    // provider a template might target, and a typo'd column name only surfaces at
    // migration time. So the default is a guided picker — real columns, operators
    // gated by data type, values typed through the right widget — that always emits
    // a well-formed neutral expression. "Advanced" is an escape hatch for the rare
    // expression the picker can't represent, not the default path.

    const FILTER_OP_SQL = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };

    function GetFilterOperators(pDataType) {
        const ops = [{ value: "eq", label: "=" }, { value: "neq", label: "≠" }];
        if (IsNumericType(pDataType) || pDataType === "Date" || pDataType === "DateTime") {
            ops.push(
                { value: "gt", label: ">" },
                { value: "gte", label: "≥" },
                { value: "lt", label: "<" },
                { value: "lte", label: "≤" }
            );
        }
        ops.push({ value: "isnull", label: "is null" }, { value: "isnotnull", label: "is not null" });
        return ops;
    }

    function FindColumnByName(pColumns, pName) {
        return pColumns.find(function (c) { return c.Name === pName; })
            || pColumns.find(function (c) { return c.Name.toLowerCase() === pName.toLowerCase(); })
            || null;
    }

    function FormatFilterLiteral(pCol, pValue) {
        const dataType = pCol.DataType;
        if (dataType === "Boolean")
            return pValue === "false" ? "false" : "true";
        if (IsNumericType(dataType))
            return pValue === "" || pValue === undefined ? "0" : pValue;
        if (dataType === "Date" || dataType === "DateTime")
            return "'" + (pValue || "") + "'";
        return "'" + String(pValue || "").replace(/'/g, "''") + "'";
    }

    function ParseFilterLiteral(pCol, pRaw) {
        const dataType = pCol.DataType;

        if (dataType === "Boolean") {
            if (/^true$/i.test(pRaw)) return "true";
            if (/^false$/i.test(pRaw)) return "false";
            return null;
        }

        if (IsNumericType(dataType))
            return /^-?\d+(\.\d+)?$/.test(pRaw) ? pRaw : null;

        // Date/DateTime/String/Text/Guid — all carried as quoted literals.
        const m = pRaw.match(/^'(.*)'$/s);
        return m ? m[1].replace(/''/g, "'") : null;
    }

    /**
     * Splits a stored Filter expression back into structured conditions.
     * Returns null when the text doesn't match the shape this builder produces —
     * the caller falls back to the raw-text "advanced" editor rather than showing
     * a builder state that doesn't actually represent the saved expression.
     */
    function ParseFilterExpression(pExpr, pColumns) {
        const text = (pExpr || "").trim();
        if (!text)
            return [];

        const parts = text.split(/\s+AND\s+/i);
        const conditions = [];

        for (const rawPart of parts) {
            const part = rawPart.trim();

            let m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+IS\s+NOT\s+NULL$/i);
            if (m) {
                const col = FindColumnByName(pColumns, m[1]);
                if (!col) return null;
                conditions.push({ FieldID: col.FieldID, Op: "isnotnull", Value: "" });
                continue;
            }

            m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+IS\s+NULL$/i);
            if (m) {
                const col = FindColumnByName(pColumns, m[1]);
                if (!col) return null;
                conditions.push({ FieldID: col.FieldID, Op: "isnull", Value: "" });
                continue;
            }

            m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|<>|>=|<=|>|<)\s*(.+)$/);
            if (!m)
                return null;

            const col = FindColumnByName(pColumns, m[1]);
            if (!col)
                return null;

            const opMap = { "=": "eq", "<>": "neq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" };
            const op = opMap[m[2]];
            const allowedOps = GetFilterOperators(col.DataType);
            if (!allowedOps.some(function (o) { return o.value === op; }))
                return null;

            const value = ParseFilterLiteral(col, m[3].trim());
            if (value === null)
                return null;

            conditions.push({ FieldID: col.FieldID, Op: op, Value: value });
        }

        return conditions;
    }

    function SerializeFilterConditions(pConditions) {
        const parts = [];
        for (const cond of pConditions) {
            const col = _IndexEditor.Columns.find(function (c) { return c.FieldID === cond.FieldID; });
            if (!col)
                continue;
            if (cond.Op === "isnull") { parts.push(col.Name + " IS NULL"); continue; }
            if (cond.Op === "isnotnull") { parts.push(col.Name + " IS NOT NULL"); continue; }
            parts.push(col.Name + " " + (FILTER_OP_SQL[cond.Op] || "=") + " " + FormatFilterLiteral(col, cond.Value));
        }
        return parts.join(" AND ");
    }

    function SyncFilterFromConditions(pIndex) {
        pIndex.Filter = SerializeFilterConditions(pIndex.FilterConditions);
    }

    function AddFilterCondition(pIndex) {
        const firstCol = _IndexEditor.Columns[0];
        if (!firstCol)
            return;
        const ops = GetFilterOperators(firstCol.DataType);
        pIndex.FilterConditions.push({ FieldID: firstCol.FieldID, Op: ops[0].value, Value: "" });
        SyncFilterFromConditions(pIndex);
        RenderIndexDetail();
    }

    function ToggleFilterMode(pIndex) {
        if (pIndex.FilterMode === "advanced") {
            // VS Code webviews block window.confirm/alert, so this can't ask before switching —
            // it only switches when the text actually round-trips into equivalent conditions,
            // and leaves the raw expression untouched otherwise.
            const parsed = ParseFilterExpression(pIndex.Filter, _IndexEditor.Columns);
            if (parsed === null) {
                SetSeedStatusMessage("This expression can't be converted to the guided editor automatically — simplify it first.", "err");
                return;
            }
            pIndex.FilterConditions = parsed;
            pIndex.FilterMode = "guided";
            SyncFilterFromConditions(pIndex);
        }
        else {
            pIndex.FilterMode = "advanced";
        }
        RenderIndexDetail();
    }

    function BuildFilterValueWidget(pCol, pValue, pOnChange) {
        const dataType = pCol ? pCol.DataType : "String";

        if (dataType === "Boolean") {
            const sel = document.createElement("select");
            sel.className = "seed-cell-select";
            [["true", "True"], ["false", "False"]].forEach(function (pair) {
                const opt = document.createElement("option");
                opt.value = pair[0];
                opt.textContent = pair[1];
                if (pair[0] === pValue) opt.selected = true;
                sel.appendChild(opt);
            });
            if (!pValue)
                pOnChange("true");
            sel.addEventListener("change", function () { pOnChange(this.value); });
            return sel;
        }

        if (dataType === "Date" || dataType === "DateTime") {
            const inp = document.createElement("input");
            inp.type = dataType === "Date" ? "date" : "datetime-local";
            inp.className = "seed-cell-input";
            inp.value = pValue || "";
            inp.addEventListener("input", function () { pOnChange(this.value); });
            return inp;
        }

        if (IsNumericType(dataType)) {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.inputMode = "numeric";
            inp.className = "seed-cell-input";
            inp.placeholder = "0";
            inp.value = pValue || "";
            inp.addEventListener("input", function () {
                pOnChange(this.value);
                inp.classList.toggle("cell-error", this.value !== "" && isNaN(Number(this.value)));
            });
            return inp;
        }

        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "seed-cell-input";
        inp.placeholder = "value";
        inp.value = pValue || "";
        inp.addEventListener("input", function () { pOnChange(this.value); });
        return inp;
    }

    function BuildFilterConditionRow(pIndex, pCond, pCondIndex) {
        const row = document.createElement("div");
        row.className = "index-filter-row";

        if (pCondIndex > 0) {
            const andLabel = document.createElement("span");
            andLabel.className = "index-filter-and";
            andLabel.textContent = "AND";
            row.appendChild(andLabel);
        }

        const col = _IndexEditor.Columns.find(function (c) { return c.FieldID === pCond.FieldID; });

        const fieldSelect = document.createElement("select");
        fieldSelect.className = "seed-cell-select";
        for (const c of _IndexEditor.Columns) {
            const opt = document.createElement("option");
            opt.value = c.FieldID;
            opt.textContent = c.Name;
            if (c.FieldID === pCond.FieldID) opt.selected = true;
            fieldSelect.appendChild(opt);
        }
        fieldSelect.addEventListener("change", function () {
            pCond.FieldID = this.value;
            const newCol = _IndexEditor.Columns.find(function (c) { return c.FieldID === pCond.FieldID; });
            const ops = GetFilterOperators(newCol ? newCol.DataType : "String");
            if (!ops.some(function (o) { return o.value === pCond.Op; }))
                pCond.Op = ops[0].value;
            pCond.Value = "";
            SyncFilterFromConditions(pIndex);
            RenderIndexDetail();
        });
        row.appendChild(fieldSelect);

        const opSelect = document.createElement("select");
        opSelect.className = "seed-cell-select";
        const ops = GetFilterOperators(col ? col.DataType : "String");
        for (const op of ops) {
            const opt = document.createElement("option");
            opt.value = op.value;
            opt.textContent = op.label;
            if (op.value === pCond.Op) opt.selected = true;
            opSelect.appendChild(opt);
        }
        opSelect.addEventListener("change", function () {
            pCond.Op = this.value;
            pCond.Value = "";
            SyncFilterFromConditions(pIndex);
            RenderIndexDetail();
        });
        row.appendChild(opSelect);

        if (pCond.Op !== "isnull" && pCond.Op !== "isnotnull") {
            const widget = BuildFilterValueWidget(col, pCond.Value, function (pNewValue) {
                pCond.Value = pNewValue;
                SyncFilterFromConditions(pIndex);
            });
            row.appendChild(widget);
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "index-list-item-remove";
        removeBtn.title = "Remove condition";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", function () {
            pIndex.FilterConditions.splice(pCondIndex, 1);
            SyncFilterFromConditions(pIndex);
            RenderIndexDetail();
        });
        row.appendChild(removeBtn);

        return row;
    }

    function BuildFilterSection(pIndex) {
        const section = document.createElement("div");
        section.className = "index-fields-section";

        const header = document.createElement("div");
        header.className = "index-fields-header";
        header.innerHTML = "<span>Filter (WHERE) — optional, all conditions must match (AND)</span>";

        const modeToggle = document.createElement("button");
        modeToggle.className = "index-filter-mode-toggle";
        modeToggle.textContent = pIndex.FilterMode === "advanced" ? "Use guided editor" : "Use raw expression";
        modeToggle.title = pIndex.FilterMode === "advanced"
            ? "Switch back to the validated, multi-database picker."
            : "Escape hatch for expressions the guided picker can't represent — not validated, not portable across providers.";
        modeToggle.addEventListener("click", function () { ToggleFilterMode(pIndex); });
        header.appendChild(modeToggle);

        section.appendChild(header);

        if (pIndex.FilterMode === "advanced") {
            const textarea = document.createElement("textarea");
            textarea.className = "seed-cell-input index-filter-raw";
            textarea.rows = 2;
            textarea.placeholder = "e.g. IsDeleted = false AND Country = 'BR'";
            textarea.value = pIndex.Filter;
            textarea.title = "Free-form condition, written as the model understands it — the template translates it per database provider. Not validated.";
            textarea.addEventListener("input", function () { pIndex.Filter = this.value; });
            section.appendChild(textarea);
            return section;
        }

        if (pIndex.FilterConditions.length === 0) {
            const emptyFilter = document.createElement("div");
            emptyFilter.className = "index-fields-empty";
            emptyFilter.textContent = "No filter — this will be a full index.";
            section.appendChild(emptyFilter);
        }
        else {
            for (let i = 0; i < pIndex.FilterConditions.length; i++)
                section.appendChild(BuildFilterConditionRow(pIndex, pIndex.FilterConditions[i], i));
        }

        const addCondBtn = document.createElement("button");
        addCondBtn.className = "seed-btn seed-btn-secondary index-add-condition-btn";
        addCondBtn.textContent = "+ Add condition";
        addCondBtn.disabled = _IndexEditor.Columns.length === 0;
        addCondBtn.addEventListener("click", function () { AddFilterCondition(pIndex); });
        section.appendChild(addCondBtn);

        return section;
    }

    const INDEX_FIELD_GROUP_DRAG_TYPE = "application/x-dase-index-field-group";

    /**
     * @param pGroupIndex position within the filtered (key-only or include-only) list this
     *        row belongs to — reordering operates on that local list and gets flattened back
     *        into pIndex.Fields by ReorderFieldsGroup.
     */
    function BuildIndexFieldRow(pIndex, pField, pGroupIndex, pIsIncludedGroup) {
        const tr = document.createElement("tr");
        tr.className = "index-field-row";
        tr.draggable = true;
        const groupKey = pIsIncludedGroup ? "include" : "key";
        const col = _IndexEditor.Columns.find(function (c) { return c.FieldID === pField.FieldID; });

        tr.addEventListener("dragstart", function (e) {
            tr.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData(INDEX_FIELD_GROUP_DRAG_TYPE, groupKey);
            e.dataTransfer.setData("text/plain", String(pGroupIndex));
        });
        tr.addEventListener("dragend", function () {
            tr.classList.remove("dragging");
            tr.parentElement.querySelectorAll(".drag-over").forEach(function (el) { el.classList.remove("drag-over"); });
        });
        tr.addEventListener("dragover", function (e) {
            if (!e.dataTransfer.types.includes(INDEX_FIELD_GROUP_DRAG_TYPE))
                return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            tr.classList.add("drag-over");
        });
        tr.addEventListener("dragleave", function () {
            tr.classList.remove("drag-over");
        });
        tr.addEventListener("drop", function (e) {
            e.preventDefault();
            tr.classList.remove("drag-over");
            if (e.dataTransfer.getData(INDEX_FIELD_GROUP_DRAG_TYPE) !== groupKey)
                return; // dragged from the other grid — reordering only makes sense within a grid
            const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
            ReorderFieldsGroup(pIndex, pIsIncludedGroup, fromIndex, pGroupIndex);
        });
        tr.title = "Drag row to reorder";

        // Column name
        const tdName = document.createElement("td");
        tdName.className = "index-field-name";
        tdName.textContent = col ? col.Name : "(missing field)";
        if (col && col.IsPrimaryKey) {
            const badge = document.createElement("span");
            badge.className = "seed-col-badge seed-col-pk";
            badge.textContent = "PK";
            tdName.appendChild(badge);
        }
        tr.appendChild(tdName);

        if (!pIsIncludedGroup) {
            // Ascending / Descending — meaningless for an INCLUDE column, so this grid skips it.
            const tdSort = document.createElement("td");
            const sortSelect = document.createElement("select");
            sortSelect.className = "seed-cell-select";
            const ascOpt = document.createElement("option");
            ascOpt.value = "asc";
            ascOpt.textContent = "▲ ASC";
            const descOpt = document.createElement("option");
            descOpt.value = "desc";
            descOpt.textContent = "▼ DESC";
            sortSelect.appendChild(ascOpt);
            sortSelect.appendChild(descOpt);
            sortSelect.value = pField.IsDescending ? "desc" : "asc";
            sortSelect.addEventListener("change", function () {
                pField.IsDescending = this.value === "desc";
            });
            tdSort.appendChild(sortSelect);
            tr.appendChild(tdSort);

            // Allow duplicate NULL — only meaningful for a unique key column.
            const tdDup = document.createElement("td");
            tdDup.className = "index-field-checkbox-cell";
            if (pIndex.IsUnique) {
                const dupChk = document.createElement("input");
                dupChk.type = "checkbox";
                dupChk.checked = pField.AllowDuplicate;
                dupChk.title = "Allow multiple NULLs in this column despite the UNIQUE constraint.";
                dupChk.addEventListener("change", function () {
                    pField.AllowDuplicate = this.checked;
                });
                tdDup.appendChild(dupChk);
            }
            else {
                tdDup.textContent = "—";
                tdDup.className += " index-field-disabled";
            }
            tr.appendChild(tdDup);
        }

        // Move to the other grid
        const tdMove = document.createElement("td");
        const moveBtn = document.createElement("button");
        moveBtn.className = "index-field-move-btn";
        moveBtn.title = pIsIncludedGroup ? "Move to Index Columns" : "Move to Included Columns";
        moveBtn.textContent = pIsIncludedGroup ? "⇤ Key" : "Include ⇥";
        moveBtn.addEventListener("click", function () {
            pField.IsIncluded = !pIsIncludedGroup;
            if (pField.IsIncluded) {
                pField.IsDescending = false;
                pField.AllowDuplicate = false;
            }
            RenderIndexDetail();
            RenderIndexList();
        });
        tdMove.appendChild(moveBtn);
        tr.appendChild(tdMove);

        // Remove
        const tdRemove = document.createElement("td");
        const removeBtn = document.createElement("button");
        removeBtn.className = "index-list-item-remove";
        removeBtn.title = "Remove column from index";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", function () {
            pIndex.Fields.splice(pIndex.Fields.indexOf(pField), 1);
            RenderIndexDetail();
            RenderIndexList();
        });
        tdRemove.appendChild(removeBtn);
        tr.appendChild(tdRemove);

        return tr;
    }

    function ReorderFieldsGroup(pIndex, pIsIncludedGroup, pFromIndex, pToIndex) {
        const group = pIndex.Fields.filter(function (f) { return f.IsIncluded === pIsIncludedGroup; });
        const otherGroup = pIndex.Fields.filter(function (f) { return f.IsIncluded !== pIsIncludedGroup; });

        if (isNaN(pFromIndex) || pFromIndex === pToIndex
            || pFromIndex < 0 || pFromIndex >= group.length
            || pToIndex < 0 || pToIndex >= group.length)
            return;

        const [moved] = group.splice(pFromIndex, 1);
        group.splice(pToIndex, 0, moved);

        // Key columns first, included columns after — codegen filters each group by
        // IsIncluded independently, so the relative order between the two groups is moot.
        pIndex.Fields = pIsIncludedGroup ? otherGroup.concat(group) : group.concat(otherGroup);
        RenderIndexDetail();
    }

    // ── Validation / Save ────────────────────────────────────────────────────

    function ValidateAllIndexes() {
        if (!_IndexEditor)
            return [];

        const errors = [];
        const namesSeen = new Set();

        for (const ix of _IndexEditor.Indexes) {
            const name = (ix.Name || "").trim();
            if (!name)
                errors.push("Every index needs a name.");
            else {
                const key = name.toLowerCase();
                if (namesSeen.has(key))
                    errors.push("Duplicate index name: \"" + name + "\".");
                namesSeen.add(key);
            }

            const keyFields = ix.Fields.filter(function (f) { return !f.IsIncluded; });
            if (keyFields.length === 0)
                errors.push("Index \"" + (name || "(unnamed)") + "\" needs at least one key column.");

            if (ix.FilterMode === "guided") {
                for (const cond of ix.FilterConditions) {
                    if (cond.Op === "isnull" || cond.Op === "isnotnull")
                        continue;
                    const col = _IndexEditor.Columns.find(function (c) { return c.FieldID === cond.FieldID; });
                    if (col && IsNumericType(col.DataType) && (cond.Value === "" || isNaN(Number(cond.Value))))
                        errors.push("Filter on \"" + col.Name + "\" (index \"" + (name || "(unnamed)") + "\") needs a valid number.");
                }
            }
        }

        return errors;
    }

    function CollectIndexData() {
        if (!_IndexEditor)
            return [];

        return _IndexEditor.Indexes.map(function (ix) {
            return {
                IndexID: ix.IndexID.indexOf("NEW_") === 0 ? "NEW" : ix.IndexID,
                Name: (ix.Name || "").trim(),
                IsUnique: ix.IsUnique,
                Filter: ix.Filter || "",
                Fields: ix.Fields.map(function (f) {
                    return {
                        FieldID: f.FieldID,
                        IsDescending: f.IsDescending,
                        AllowDuplicate: f.AllowDuplicate,
                        IsIncluded: f.IsIncluded
                    };
                })
            };
        });
    }

    function SaveIndexEditorData() {
        if (!_IndexEditor)
            return;

        const errors = ValidateAllIndexes();
        if (errors.length > 0) {
            SetSeedValidationBadge(errors.map(function (m) { return { Message: m }; }));
            SetSeedStatusMessage(errors[0], "err");
            return;
        }

        SetSeedValidationBadge(null);
        document.getElementById("seed-btn-save").disabled = true;
        SetSeedStatusMessage("Saving...", "");

        SendMessage(XMessageType.SaveIndexes, {
            TableID: _IndexEditor.TableID,
            Indexes: CollectIndexData()
        });
    }

    function OnIndexesSaved(pPayload) {
        if (!_IndexEditor)
            return;

        const btnSave = document.getElementById("seed-btn-save");
        if (!btnSave)
            return;

        if (pPayload && pPayload.Success) {
            SetSeedStatusMessage("✓ Saved successfully.", "ok");
            btnSave.disabled = false;
            setTimeout(CloseSeedEditorModal, 900);
        }
        else {
            const msg = (pPayload && pPayload.Message) ? pPayload.Message : "Failed to save.";
            SetSeedStatusMessage("✕ " + msg, "err");
            btnSave.disabled = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  AI ORGANIZER OVERLAY
    // ═══════════════════════════════════════════════════════════════════════════

    const _AI_STEP_LABELS = {
        context:   "Building model context",
        sending:   "Sending to AI model",
        analyzing: "AI analyzing table relationships",
        grouping:  "Grouping tables by domain",
        parsing:   "Parsing AI response",
        layout:    "Computing layout",
        applying:  "Applying positions & colors",
        done:      "Complete"
    };

    let _AICompletedSteps = [];
    let _AISelectedModelIndex = 0;
    let _AIPickerModels = [];

    // ── Picker Phase ─────────────────────────────────────────────────────────

    function _AISetSelectorLabel(pIndex) {
        const m = _AIPickerModels[pIndex];
        if (!m) return;
        document.getElementById("ai-model-selector-name").textContent = m.name;
        const costEl = document.getElementById("ai-model-selector-cost");
        costEl.textContent = m.costLabel || "";
        costEl.style.display = m.costLabel ? "" : "none";
    }

    function _AIBuildDropdown() {
        const dropdown = document.getElementById("ai-model-dropdown");
        dropdown.innerHTML = "";
        for (let i = 0; i < _AIPickerModels.length; i++) {
            const m = _AIPickerModels[i];
            const row = document.createElement("div");
            row.className = "ai-model-row" + (i === _AISelectedModelIndex ? " ai-model-row--selected" : "");
            row.setAttribute("data-index", String(i));
            const costLabel = m.costLabel || "";
            row.innerHTML =
                '<span class="ai-model-check">\u2713</span>' +
                '<span class="ai-model-name">' + EscapeHtml(m.name) + '</span>' +
                (costLabel ? '<span class="ai-model-cost">' + EscapeHtml(costLabel) + '</span>' : "");
            row.addEventListener("click", function (e) {
                e.stopPropagation();
                const rows = dropdown.querySelectorAll(".ai-model-row");
                rows.forEach(function (r) { r.classList.remove("ai-model-row--selected"); });
                row.classList.add("ai-model-row--selected");
                _AISelectedModelIndex = parseInt(row.getAttribute("data-index"), 10);
                _AISetSelectorLabel(_AISelectedModelIndex);
                dropdown.style.display = "none";
            });
            dropdown.appendChild(row);
        }
        // Scroll to selected
        const sel = dropdown.querySelector(".ai-model-row--selected");
        if (sel) setTimeout(function () { sel.scrollIntoView({ block: "nearest" }); }, 0);
    }

    function _AIReadLayoutParams() {
        const rankdirEl = document.getElementById("ai-lp-rankdir");
        const rankerEl = document.getElementById("ai-lp-ranker");
        const rankSepEl = document.getElementById("ai-lp-ranksep");
        const nodeSepEl = document.getElementById("ai-lp-nodesep");
        return {
            RankDir: rankdirEl ? rankdirEl.value : "TB",
            Ranker: rankerEl ? rankerEl.value : "network-simplex",
            RankSep: rankSepEl ? parseInt(rankSepEl.value, 10) : 180,
            NodeSep: nodeSepEl ? parseInt(nodeSepEl.value, 10) : 55
        };
    }

    function OpenAIPickerOverlay(pPayload) {
        const overlay = document.getElementById("ai-organize-overlay");
        if (!overlay) return;

        _AIPickerModels = (pPayload && pPayload.models) ? pPayload.models : [];
        _AICompletedSteps = [];

        // Reset all sections
        document.getElementById("ai-picker-section").style.display = "block";
        document.getElementById("ai-progress-section").style.display = "none";
        document.getElementById("ai-steps-list").style.display = "none";
        document.getElementById("ai-result-section").style.display = "none";
        document.getElementById("ai-model-dropdown").style.display = "none";

        document.getElementById("ai-modal-icon").textContent = "\u2728";
        document.getElementById("ai-modal-title").textContent = "Organize Tables with AI";
        document.getElementById("ai-model-badge").textContent =
            pPayload && pPayload.tableCount ? pPayload.tableCount + " tables" : "";

        const statusDot = document.getElementById("ai-status-dot");
        statusDot.className = "ai-status-dot ai-status-dot--idle";

        // Pre-select last used model
        const lastModelName = _AIGetLastModelName();
        _AISelectedModelIndex = 0;
        for (let i = 0; i < _AIPickerModels.length; i++) {
            if (lastModelName && _AIPickerModels[i].name === lastModelName) {
                _AISelectedModelIndex = i;
                break;
            }
        }
        _AISetSelectorLabel(_AISelectedModelIndex);

        // Prompt preview
        const promptEl = document.getElementById("ai-prompt-preview");
        if (promptEl) promptEl.value = (pPayload && pPayload.promptPreview) ? pPayload.promptPreview : "";

        // Wire model selector button
        const selectorBtn = document.getElementById("ai-model-selector-btn");
        selectorBtn.onclick = function (e) {
            e.stopPropagation();
            const dropdown = document.getElementById("ai-model-dropdown");
            if (dropdown.style.display === "none") {
                const rect = selectorBtn.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 4) + "px";
                dropdown.style.left = rect.left + "px";
                dropdown.style.width = rect.width + "px";
                _AIBuildDropdown();
                dropdown.style.display = "block";
            } else {
                dropdown.style.display = "none";
            }
        };

        // Close dropdown on outside click
        document.addEventListener("click", function _closeDropdown() {
            const dropdown = document.getElementById("ai-model-dropdown");
            if (dropdown) dropdown.style.display = "none";
            document.removeEventListener("click", _closeDropdown);
        });

        // Footer: Cancel + Execute
        const footer = document.getElementById("ai-modal-footer");
        footer.innerHTML =
            '<button id="ai-cancel-btn" class="seed-btn seed-btn-secondary">Cancel</button>' +
            '<button id="ai-execute-btn" class="seed-btn seed-btn-primary">Execute</button>';

        // Wire layout-param live labels
        const rankSep = document.getElementById("ai-lp-ranksep");
        const nodeSep = document.getElementById("ai-lp-nodesep");
        const rankSepVal = document.getElementById("ai-lp-ranksep-val");
        const nodeSepVal = document.getElementById("ai-lp-nodesep-val");
        if (rankSep && rankSepVal)
            rankSep.oninput = function () { rankSepVal.textContent = rankSep.value; };
        if (nodeSep && nodeSepVal)
            nodeSep.oninput = function () { nodeSepVal.textContent = nodeSep.value; };

        document.getElementById("ai-cancel-btn").onclick = CloseAIOrganizeOverlay;
        document.getElementById("ai-execute-btn").onclick = function () {
            SendMessage(XMessageType.OrganizeTablesAIExecute, {
                ModelIndex: _AISelectedModelIndex,
                Layout: _AIReadLayoutParams()
            });
        };

        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }

    // ── Running Phase ─────────────────────────────────────────────────────────

    function OpenAIOrganizeOverlay(pPayload) {
        const overlay = document.getElementById("ai-organize-overlay");
        if (!overlay) return;

        _AICompletedSteps = [];

        // Switch to progress phase
        document.getElementById("ai-picker-section").style.display = "none";
        document.getElementById("ai-progress-section").style.display = "block";
        document.getElementById("ai-steps-list").style.display = "block";
        document.getElementById("ai-steps-list").innerHTML = "";
        document.getElementById("ai-result-section").style.display = "none";

        document.getElementById("ai-progress-fill").style.width = "0%";
        document.getElementById("ai-progress-fill").className = "ai-progress-bar-fill";
        document.getElementById("ai-progress-label").textContent = "Initializing\u2026";
        document.getElementById("ai-modal-icon").textContent = "\u2728";

        const statusDot = document.getElementById("ai-status-dot");
        statusDot.className = "ai-status-dot ai-status-dot--running";

        const badge = document.getElementById("ai-model-badge");
        if (pPayload && pPayload.model) {
            const vendor = pPayload.vendor ? " \u00B7 " + pPayload.vendor : "";
            badge.textContent = pPayload.model + vendor;
        } else {
            badge.textContent = "";
        }

        const title = document.getElementById("ai-modal-title");
        const tableCount = pPayload && pPayload.tableCount ? pPayload.tableCount : 0;
        title.textContent = "Organizing " + (tableCount > 0 ? tableCount + " tables" : "Tables") + " with AI";

        // Footer: empty during run (no buttons while AI works)
        const footer = document.getElementById("ai-modal-footer");
        footer.innerHTML = "";

        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }

    function UpdateAIOrganizeProgress(pPayload) {
        if (!pPayload) return;

        const fill = document.getElementById("ai-progress-fill");
        const label = document.getElementById("ai-progress-label");
        const stepsList = document.getElementById("ai-steps-list");

        if (fill && typeof pPayload.percent === "number")
            fill.style.width = Math.min(100, pPayload.percent) + "%";

        if (label && pPayload.message)
            label.textContent = pPayload.message;

        const stepKey = pPayload.step;
        if (stepKey && stepKey !== "done" && !_AICompletedSteps.includes(stepKey)) {
            _AICompletedSteps.push(stepKey);
            const stepLabel = _AI_STEP_LABELS[stepKey] || stepKey;
            const item = document.createElement("div");
            item.className = "ai-step-item ai-step-item--running";
            item.setAttribute("data-step", stepKey);
            item.innerHTML =
                '<span class="ai-step-spinner"></span>' +
                '<span class="ai-step-text">' + EscapeHtml(stepLabel) + '</span>';
            stepsList.appendChild(item);

            const prev = stepsList.querySelectorAll(".ai-step-item--running");
            for (let i = 0; i < prev.length - 1; i++) {
                prev[i].className = "ai-step-item ai-step-item--done";
                prev[i].innerHTML =
                    '<span class="ai-step-check">\u2713</span>' +
                    '<span class="ai-step-text">' + prev[i].querySelector(".ai-step-text").textContent + '</span>';
            }

            stepsList.scrollTop = stepsList.scrollHeight;
        }
    }

    // ── Complete Phase ────────────────────────────────────────────────────────

    function CompleteAIOrganize(pPayload) {
        const fill = document.getElementById("ai-progress-fill");
        const label = document.getElementById("ai-progress-label");
        const stepsList = document.getElementById("ai-steps-list");
        const resultSection = document.getElementById("ai-result-section");
        const footer = document.getElementById("ai-modal-footer");
        const icon = document.getElementById("ai-modal-icon");
        const statusDot = document.getElementById("ai-status-dot");

        if (fill) fill.style.width = "100%";
        if (fill) fill.classList.add("ai-progress-bar-fill--done");
        if (label) label.textContent = pPayload && pPayload.tablesOrganized
            ? pPayload.tablesOrganized + " tables organized into " + pPayload.groupCount + " groups"
            : "Done!";

        if (icon) icon.textContent = "\u2705";
        if (statusDot) statusDot.className = "ai-status-dot ai-status-dot--done";

        // Save the last used model name to localStorage
        if (_AIPickerModels.length > 0 && _AISelectedModelIndex < _AIPickerModels.length)
            _AISaveLastModelName(_AIPickerModels[_AISelectedModelIndex].name);

        if (stepsList) {
            const pending = stepsList.querySelectorAll(".ai-step-item--running");
            pending.forEach(function (item) {
                item.className = "ai-step-item ai-step-item--done";
                const txt = item.querySelector(".ai-step-text");
                const textContent = txt ? txt.textContent : "";
                item.innerHTML =
                    '<span class="ai-step-check">\u2713</span>' +
                    '<span class="ai-step-text">' + EscapeHtml(textContent) + '</span>';
            });
        }

        if (resultSection && pPayload && pPayload.groups && pPayload.groups.length > 0) {
            const chips = document.getElementById("ai-group-chips");
            chips.innerHTML = "";
            for (const group of pPayload.groups) {
                const chip = document.createElement("div");
                chip.className = "ai-group-chip";
                chip.style.setProperty("--chip-color", group.color || "#888888");
                chip.innerHTML =
                    '<span class="ai-chip-swatch"></span>' +
                    '<span class="ai-chip-label">' + EscapeHtml(group.name) + '</span>' +
                    '<span class="ai-chip-count">' + (group.count || 0) + '</span>';
                chips.appendChild(chip);
            }
            resultSection.style.display = "block";
        }

        // Footer: Revert (if canRevert) + Close
        if (footer) {
            footer.innerHTML = "";
            if (pPayload && pPayload.canRevert) {
                const revertBtn = document.createElement("button");
                revertBtn.id = "ai-revert-btn";
                revertBtn.className = "seed-btn seed-btn-secondary";
                revertBtn.textContent = "Revert";
                revertBtn.onclick = function () {
                    SendMessage(XMessageType.AIOrganizeRevert, {});
                    CloseAIOrganizeOverlay();
                };
                footer.appendChild(revertBtn);
            }
            const closeBtn = document.createElement("button");
            closeBtn.id = "ai-close-btn";
            closeBtn.className = "seed-btn seed-btn-primary";
            closeBtn.textContent = "Close";
            closeBtn.onclick = CloseAIOrganizeOverlay;
            footer.appendChild(closeBtn);
            closeBtn.focus();
        }
    }

    function ErrorAIOrganize(pPayload) {
        const fill = document.getElementById("ai-progress-fill");
        const label = document.getElementById("ai-progress-label");
        const icon = document.getElementById("ai-modal-icon");
        const statusDot = document.getElementById("ai-status-dot");
        const footer = document.getElementById("ai-modal-footer");
        const stepsList = document.getElementById("ai-steps-list");

        if (fill) { fill.style.width = "100%"; fill.classList.add("ai-progress-bar-fill--error"); }
        if (label) label.textContent = (pPayload && pPayload.message) ? pPayload.message : "An error occurred.";
        if (icon) icon.textContent = "\u274C";
        if (statusDot) statusDot.className = "ai-status-dot ai-status-dot--error";

        if (stepsList) {
            const pending = stepsList.querySelectorAll(".ai-step-item--running");
            pending.forEach(function (item) {
                item.className = "ai-step-item ai-step-item--error";
                const txt = item.querySelector(".ai-step-text");
                const textContent = txt ? txt.textContent : "";
                item.innerHTML =
                    '<span class="ai-step-err">\u2715</span>' +
                    '<span class="ai-step-text">' + EscapeHtml(textContent) + '</span>';
            });
        }

        if (footer) {
            footer.innerHTML =
                '<button id="ai-close-btn" class="seed-btn seed-btn-primary">Close</button>';
            document.getElementById("ai-close-btn").onclick = CloseAIOrganizeOverlay;
        }
    }

    function CloseAIOrganizeOverlay() {
        const overlay = document.getElementById("ai-organize-overlay");
        if (overlay) {
            overlay.style.display = "none";
            overlay.setAttribute("aria-hidden", "true");
        }
        _AICompletedSteps = [];
    }

    // ── Persistence helpers ───────────────────────────────────────────────────

    function _AIGetLastModelName() {
        try { return localStorage.getItem("dase.ai.lastModel") || ""; }
        catch { return ""; }
    }

    function _AISaveLastModelName(pName) {
        try { localStorage.setItem("dase.ai.lastModel", pName || ""); }
        catch { /* storage unavailable */ }
    }

    function EscapeHtml(pStr) {
        if (!pStr) return "";
        return String(pStr)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }



    // ── SQL Script Generation overlay ─────────────────────────────────────────

    let _SQLPickerModels   = [];
    let _SQLSelectedModel  = 0;
    let _SQLSelectedDB     = "sqlserver";
    let _SQLCustomDB       = "";

    const _SQL_DATABASES = [
        { id: "sqlserver",  label: "SQL Server"  },
        { id: "oracle",     label: "Oracle"      },
        { id: "postgresql", label: "PostgreSQL"  },
        { id: "mysql",      label: "MySQL"        },
        { id: "another",    label: "Another\u2026" }
    ];

    // --- persistence helpers ---

    function _SQLGetLastModel() {
        try { return localStorage.getItem("dase.sql.lastModel") || ""; }
        catch { return ""; }
    }
    function _SQLSaveLastModel(pName) {
        try { localStorage.setItem("dase.sql.lastModel", pName || ""); }
        catch { /* storage unavailable */ }
    }
    function _SQLGetLastDB() {
        try { return localStorage.getItem("dase.sql.lastDB") || "sqlserver"; }
        catch { return "sqlserver"; }
    }
    function _SQLSaveLastDB(pId) {
        try { localStorage.setItem("dase.sql.lastDB", pId || "sqlserver"); }
        catch { /* storage unavailable */ }
    }

    // --- label helpers ---

    function _SQLSetModelLabel(pIndex) {
        const m = _SQLPickerModels[pIndex];
        if (!m) return;
        document.getElementById("sql-model-selector-name").textContent = m.name;
        const costEl = document.getElementById("sql-model-selector-cost");
        if (costEl) {
            costEl.textContent   = m.costLabel || "";
            costEl.style.display = m.costLabel ? "" : "none";
        }
    }

    function _SQLSetDBLabel(pId) {
        const db = _SQL_DATABASES.find(function (d) { return d.id === pId; });
        const label = db ? db.label : pId;
        const nameEl = document.getElementById("sql-db-selector-name");
        if (nameEl) nameEl.textContent = label;
        // Show / hide custom-DB text field
        const customRow = document.getElementById("sql-custom-db-row");
        if (customRow) customRow.style.display = (pId === "another") ? "flex" : "none";
    }

    // --- dropdown builders ---

    function _SQLBuildModelDropdown() {
        const dropdown = document.getElementById("sql-model-dropdown");
        dropdown.innerHTML = "";
        for (let i = 0; i < _SQLPickerModels.length; i++) {
            const m   = _SQLPickerModels[i];
            const row = document.createElement("div");
            row.className = "ai-model-row" + (i === _SQLSelectedModel ? " ai-model-row--selected" : "");
            row.setAttribute("data-index", String(i));
            const costLabel = m.costLabel || "";
            row.innerHTML =
                "<span class=\"ai-model-check\">\u2713</span>" +
                "<span class=\"ai-model-name\">" + EscapeHtml(m.name) + "</span>" +
                (costLabel ? "<span class=\"ai-model-cost\">" + EscapeHtml(costLabel) + "</span>" : "");
            row.addEventListener("click", function (e) {
                e.stopPropagation();
                const rows = dropdown.querySelectorAll(".ai-model-row");
                rows.forEach(function (r) { r.classList.remove("ai-model-row--selected"); });
                row.classList.add("ai-model-row--selected");
                _SQLSelectedModel = parseInt(row.getAttribute("data-index"), 10);
                _SQLSetModelLabel(_SQLSelectedModel);
                _SQLSaveLastModel(_SQLPickerModels[_SQLSelectedModel]?.name || "");
                dropdown.style.display = "none";
            });
            dropdown.appendChild(row);
        }
        const sel = dropdown.querySelector(".ai-model-row--selected");
        if (sel) setTimeout(function () { sel.scrollIntoView({ block: "nearest" }); }, 0);
    }

    function _SQLBuildDBDropdown() {
        const dropdown = document.getElementById("sql-db-dropdown");
        dropdown.innerHTML = "";
        for (let i = 0; i < _SQL_DATABASES.length; i++) {
            const db  = _SQL_DATABASES[i];
            const row = document.createElement("div");
            row.className = "ai-model-row" + (db.id === _SQLSelectedDB ? " ai-model-row--selected" : "");
            row.setAttribute("data-id", db.id);
            row.innerHTML =
                "<span class=\"ai-model-check\">\u2713</span>" +
                "<span class=\"ai-model-name\">" + EscapeHtml(db.label) + "</span>";
            row.addEventListener("click", function (e) {
                e.stopPropagation();
                const rows = dropdown.querySelectorAll(".ai-model-row");
                rows.forEach(function (r) { r.classList.remove("ai-model-row--selected"); });
                row.classList.add("ai-model-row--selected");
                _SQLSelectedDB = row.getAttribute("data-id");
                _SQLSetDBLabel(_SQLSelectedDB);
                _SQLSaveLastDB(_SQLSelectedDB);
                dropdown.style.display = "none";
                // Update prompt preview
                _SQLUpdatePromptPreview();
            });
            dropdown.appendChild(row);
        }
    }

    function _SQLUpdatePromptPreview() {
        const previewEl  = document.getElementById("sql-prompt-preview");
        const dbNameEl   = document.getElementById("sql-db-selector-name");
        const customEl   = document.getElementById("sql-custom-db-input");
        if (!previewEl) return;
        let dbLabel = (dbNameEl ? dbNameEl.textContent : "SQL Server") || "SQL Server";
        if (_SQLSelectedDB === "another" && customEl && customEl.value.trim())
            dbLabel = customEl.value.trim();
        previewEl.value = _SQLBuildLocalPreview(dbLabel);
    }

    function _SQLBuildLocalPreview(pDbLabel) {
        const count = _SQLPickerModels.length > 0 ? document.getElementById("sql-model-badge")?.textContent || "" : "";
        return (
            "Target database: " + pDbLabel + "\n\n" +
            (count ? count + "\n\n" : "") +
            "The AI will receive the full DBML schema and generate:\n" +
            "  \u2022 CREATE TABLE with " + pDbLabel + "-specific data types\n" +
            "  \u2022 PRIMARY KEY constraints and auto-increment identities\n" +
            "  \u2022 FOREIGN KEY constraints (ON DELETE NO ACTION)\n" +
            "  \u2022 CREATE INDEX for every FK column\n" +
            "  \u2022 DROP / IF NOT EXISTS safety guards\n" +
            "  \u2022 Schema-prefixed identifiers\n" +
            "  \u2022 Descriptive SQL comments per table\n\n" +
            "Output: .sql file saved alongside the .dsorm model."
        );
    }

    // --- phase 1: open picker ---

    function OpenSQLScriptPickerOverlay(pPayload) {
        const overlay = document.getElementById("sql-overlay");
        if (!overlay) return;

        _SQLPickerModels  = (pPayload && pPayload.models) ? pPayload.models : [];
        _SQLSelectedDB    = _SQLGetLastDB();
        _SQLCustomDB      = "";

        // Reset sections
        document.getElementById("sql-picker-section").style.display   = "block";
        document.getElementById("sql-progress-section").style.display = "none";
        document.getElementById("sql-steps-list").style.display        = "none";
        document.getElementById("sql-result-section").style.display   = "none";
        document.getElementById("sql-model-dropdown").style.display   = "none";
        document.getElementById("sql-db-dropdown").style.display      = "none";

        document.getElementById("sql-modal-icon").textContent  = "\uD83D\uDDC4\uFE0F";
        document.getElementById("sql-modal-title").textContent = "Create SQL Script";
        const badgeEl = document.getElementById("sql-model-badge");
        if (badgeEl) {
            const tbl = pPayload?.tableCount ?? 0;
            const ref = pPayload?.refCount   ?? 0;
            badgeEl.textContent = tbl + " table" + (tbl !== 1 ? "s" : "") +
                                  " \u00B7 " + ref + " FK" + (ref !== 1 ? "s" : "");
        }

        // Pre-select model
        const lastModel = _SQLGetLastModel();
        _SQLSelectedModel = 0;
        for (let i = 0; i < _SQLPickerModels.length; i++) {
            if (lastModel && _SQLPickerModels[i].name === lastModel) {
                _SQLSelectedModel = i;
                break;
            }
        }
        _SQLSetModelLabel(_SQLSelectedModel);

        // DB selector
        _SQLSetDBLabel(_SQLSelectedDB);

        // Prompt preview
        const promptEl = document.getElementById("sql-prompt-preview");
        if (promptEl) promptEl.value = (pPayload && pPayload.promptPreview) ? pPayload.promptPreview : _SQLBuildLocalPreview("SQL Server");

        // Custom DB input change
        const customEl = document.getElementById("sql-custom-db-input");
        if (customEl) {
            customEl.value = "";
            customEl.oninput = function () {
                _SQLCustomDB = customEl.value;
                _SQLUpdatePromptPreview();
            };
        }

        // Wire model selector
        const modelBtn = document.getElementById("sql-model-selector-btn");
        modelBtn.onclick = function (e) {
            e.stopPropagation();
            const dd = document.getElementById("sql-model-dropdown");
            if (dd.style.display === "none") {
                const rect = modelBtn.getBoundingClientRect();
                dd.style.top   = (rect.bottom + 4) + "px";
                dd.style.left  = rect.left + "px";
                dd.style.width = rect.width + "px";
                _SQLBuildModelDropdown();
                dd.style.display = "block";
                document.addEventListener("click", function _closeSQLModelDD() {
                    dd.style.display = "none";
                    document.removeEventListener("click", _closeSQLModelDD);
                });
            } else {
                dd.style.display = "none";
            }
        };

        // Wire DB selector
        const dbBtn = document.getElementById("sql-db-selector-btn");
        dbBtn.onclick = function (e) {
            e.stopPropagation();
            const dd = document.getElementById("sql-db-dropdown");
            if (dd.style.display === "none") {
                const rect = dbBtn.getBoundingClientRect();
                dd.style.top   = (rect.bottom + 4) + "px";
                dd.style.left  = rect.left + "px";
                dd.style.width = rect.width + "px";
                _SQLBuildDBDropdown();
                dd.style.display = "block";
                document.addEventListener("click", function _closeSQLDBDD() {
                    dd.style.display = "none";
                    document.removeEventListener("click", _closeSQLDBDD);
                });
            } else {
                dd.style.display = "none";
            }
        };

        // Wire status dot
        const statusDot = document.getElementById("sql-status-dot");
        statusDot.className = "ai-status-dot ai-status-dot--idle";

        // Footer: Cancel + Generate
        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML =
            "<button id=\"sql-cancel-btn\" class=\"seed-btn seed-btn-secondary\">Cancel</button>" +
            "<button id=\"sql-execute-btn\" class=\"seed-btn seed-btn-primary\">Generate</button>";

        document.getElementById("sql-cancel-btn").onclick  = CloseSQLScriptOverlay;
        document.getElementById("sql-execute-btn").onclick = function () {
            const customDB = (document.getElementById("sql-custom-db-input")?.value || "").trim();
            SendMessage(XMessageType.CreateSQLScriptExecute, {
                ModelIndex: _SQLSelectedModel,
                Database:   _SQLSelectedDB,
                CustomDB:   customDB
            });
        };

        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }

    // --- phase 2: progress ---

    function StartSQLScriptProgress(pPayload) {
        document.getElementById("sql-picker-section").style.display   = "none";
        document.getElementById("sql-progress-section").style.display = "block";
        document.getElementById("sql-steps-list").style.display        = "block";
        document.getElementById("sql-steps-list").innerHTML            = "";
        document.getElementById("sql-result-section").style.display   = "none";

        document.getElementById("sql-progress-fill").style.width    = "0%";
        document.getElementById("sql-progress-fill").className      = "ai-progress-bar-fill";
        document.getElementById("sql-progress-label").textContent   = "Initializing\u2026";
        document.getElementById("sql-modal-icon").textContent       = "\uD83D\uDDC4\uFE0F";
        document.getElementById("sql-status-dot").className         = "ai-status-dot ai-status-dot--running";

        const badge = document.getElementById("sql-model-badge");
        if (badge && pPayload) {
            const vendor = pPayload.vendor ? " \u00B7 " + pPayload.vendor : "";
            badge.textContent = (pPayload.model || "") + vendor +
                (pPayload.database ? " \u00B7 " + pPayload.database : "");
        }

        // Footer: only Cancel while running
        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML = "<button id=\"sql-cancel-btn\" class=\"seed-btn seed-btn-secondary\">Cancel</button>";
        document.getElementById("sql-cancel-btn").onclick = CloseSQLScriptOverlay;
    }

    function UpdateSQLScriptProgress(pPayload) {
        if (!pPayload) return;
        const fill  = document.getElementById("sql-progress-fill");
        const label = document.getElementById("sql-progress-label");
        if (fill  && pPayload.percent !== undefined) fill.style.width = Math.min(pPayload.percent, 100) + "%";
        if (label && pPayload.message)               label.textContent = pPayload.message;

        if (pPayload.step && pPayload.step !== "streaming") {
            const list = document.getElementById("sql-steps-list");
            const item = document.createElement("div");
            item.className = "ai-step-item";
            item.innerHTML = "<span class=\"ai-step-check\">\u2713</span><span class=\"ai-step-text\">" +
                EscapeHtml(pPayload.message) + "</span>";
            list.appendChild(item);
            list.scrollTop = list.scrollHeight;
        }
    }

    // --- phase 3: complete ---

    function CompleteSQLScript(pPayload) {
        const fill  = document.getElementById("sql-progress-fill");
        const label = document.getElementById("sql-progress-label");
        if (fill)  { fill.style.width = "100%"; fill.className = "ai-progress-bar-fill ai-progress-bar-fill--done"; }
        if (label && pPayload?.fileName) label.textContent = "Saved \u2014 " + pPayload.fileName;

        document.getElementById("sql-status-dot").className = "ai-status-dot ai-status-dot--done";
        document.getElementById("sql-modal-icon").textContent = "\u2705";

        const resultSect = document.getElementById("sql-result-section");
        const info       = document.getElementById("sql-result-info");
        if (resultSect) resultSect.style.display = "block";
        if (info && pPayload) {
            info.innerHTML =
                "<div class=\"sql-result-row\"><span class=\"sql-result-label\">File</span><span class=\"sql-result-value\">" +
                EscapeHtml(pPayload.fileName || "") + "</span></div>" +
                "<div class=\"sql-result-row\"><span class=\"sql-result-label\">Database</span><span class=\"sql-result-value\">" +
                EscapeHtml(pPayload.database || "") + "</span></div>" +
                "<div class=\"sql-result-row\"><span class=\"sql-result-label\">Lines</span><span class=\"sql-result-value\">" +
                (pPayload.lineCount || 0) + "</span></div>";
        }

        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML = "<button id=\"sql-close-btn\" class=\"seed-btn seed-btn-primary\">Close</button>";
        document.getElementById("sql-close-btn").onclick = CloseSQLScriptOverlay;
    }

    // --- error ---

    function ErrorSQLScript(pPayload) {
        const fill  = document.getElementById("sql-progress-fill");
        const label = document.getElementById("sql-progress-label");
        if (fill)  { fill.className = "ai-progress-bar-fill ai-progress-bar-fill--error"; }
        if (label) label.textContent = (pPayload && pPayload.message) ? pPayload.message : "Error";
        document.getElementById("sql-status-dot").className = "ai-status-dot ai-status-dot--error";

        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML = "<button id=\"sql-close-btn\" class=\"seed-btn seed-btn-secondary\">Close</button>";
        document.getElementById("sql-close-btn").onclick = CloseSQLScriptOverlay;
    }

    function CloseSQLScriptOverlay() {
        const overlay = document.getElementById("sql-overlay");
        if (overlay) {
            overlay.style.display = "none";
            overlay.setAttribute("aria-hidden", "true");
        }
    }

})();
