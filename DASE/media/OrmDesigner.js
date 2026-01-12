(function() {
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
        DragDropAddRelation: "DragDropAddRelation",
        DeleteSelected: "DeleteSelected",
        RenameSelected: "RenameSelected",
        UpdateProperty: "UpdateProperty",
        PropertiesChanged: "PropertiesChanged",
        ValidateModel: "ValidateModel",
        IssuesChanged: "IssuesChanged",
        RequestRename: "RequestRename",
        RenameCompleted: "RenameCompleted",
        AlignLines: "AlignLines"
    };

    let _Model = { Tables: [], References: [] };
    let _SelectedIDs = [];
    let _DragState = null;
    let _RelationDragState = null;
    let _ContextMenuPosition = { X: 0, Y: 0 };
    let _ContextMenuTarget = null;

    const _Canvas = document.getElementById("canvas");
    const _TablesLayer = document.getElementById("tables-layer");
    const _RelationsLayer = document.getElementById("relations-layer");
    const _CanvasContainer = document.getElementById("canvas-container");
    const _ContextMenu = document.getElementById("context-menu");
    const _TableContextMenu = document.getElementById("table-context-menu");

    function Initialize()
    {
        SetupCanvasEvents();
        SetupContextMenu();
        SetupMessageHandler();
        SendMessage(XMessageType.DesignerReady, {});
    }

    function SendMessage(pType, pPayload)
    {
        vscode.postMessage({ Type: pType, Payload: pPayload });
    }

    function SetupMessageHandler()
    {
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            HandleMessage(msg);
        });
    }

    function HandleMessage(pMsg)
    {
        switch (pMsg.Type)
        {
            case XMessageType.LoadModel:
                _Model = pMsg.Payload || { Tables: [], References: [] };
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
                break;
        }
    }

    function SetupContextMenu()
    {
        _ContextMenu.addEventListener("click", function(e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            HideContextMenu();

            switch (action)
            {
                case "add-table":
                    SendMessage(XMessageType.AddTable, { X: _ContextMenuPosition.X, Y: _ContextMenuPosition.Y });
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
            }
        });

        _TableContextMenu.addEventListener("click", function(e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            HideContextMenu();

            switch (action)
            {
                case "add-field":
                    if (_ContextMenuTarget)
                        SendMessage(XMessageType.AddField, { TableID: _ContextMenuTarget });
                    break;
                case "delete-table":
                    SendMessage(XMessageType.DeleteSelected, {});
                    break;
                case "rename-table":
                    if (_ContextMenuTarget)
                        ShowRenameInput(_ContextMenuTarget);
                    break;
            }
        });

        document.addEventListener("click", function(e) {
            if (!_ContextMenu.contains(e.target) && !_TableContextMenu.contains(e.target))
                HideContextMenu();
        });
    }

    function ShowContextMenu(pX, pY, pCanvasX, pCanvasY)
    {
        _ContextMenuPosition.X = pCanvasX;
        _ContextMenuPosition.Y = pCanvasY;
        _ContextMenuTarget = null;

        // Update menu items based on selection
        const deleteItem = _ContextMenu.querySelector('[data-action="delete-selected"]');
        const renameItem = _ContextMenu.querySelector('[data-action="rename-selected"]');
        
        if (_SelectedIDs.length === 0)
        {
            deleteItem.classList.add("disabled");
            renameItem.classList.add("disabled");
        }
        else
        {
            deleteItem.classList.remove("disabled");
            renameItem.classList.remove("disabled");
        }

        _TableContextMenu.classList.remove("visible");
        _ContextMenu.style.left = pX + "px";
        _ContextMenu.style.top = pY + "px";
        _ContextMenu.classList.add("visible");
    }

    function ShowTableContextMenu(pX, pY, pTableID)
    {
        _ContextMenuTarget = pTableID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.style.left = pX + "px";
        _TableContextMenu.style.top = pY + "px";
        _TableContextMenu.classList.add("visible");
    }

    function HideContextMenu()
    {
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        _ContextMenuTarget = null;
    }

    function SetupCanvasEvents()
    {
        _Canvas.addEventListener("click", function(e) {
            if (e.target === _Canvas || e.target.id === "relations-layer" || e.target.id === "tables-layer")
            {
                SendMessage(XMessageType.SelectElement, { Clear: true });
            }
        });

        _CanvasContainer.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            
            const rect = _CanvasContainer.getBoundingClientRect();
            const canvasX = e.clientX - rect.left + _CanvasContainer.scrollLeft;
            const canvasY = e.clientY - rect.top + _CanvasContainer.scrollTop;
            
            ShowContextMenu(e.clientX, e.clientY, canvasX, canvasY);
        });
    }

    function RenderModel()
    {
        RenderRelations();
        RenderTables();
        UpdateSelectionVisuals();
    }

    function RenderTables()
    {
        _TablesLayer.innerHTML = "";
        
        for (const table of _Model.Tables)
        {
            const g = CreateTableElement(table);
            _TablesLayer.appendChild(g);
        }
    }

    function CreateTableElement(pTable)
    {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-table");
        g.setAttribute("data-id", pTable.ID);
        g.setAttribute("transform", "translate(" + pTable.X + "," + pTable.Y + ")");

        const width = pTable.Width || 200;
        const height = pTable.Height || 150;
        const headerHeight = 28;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", "orm-table-rect");
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("rx", 4);
        rect.setAttribute("ry", 4);
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

        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("class", "orm-table-title");
        title.setAttribute("x", 10);
        title.setAttribute("y", 18);
        title.textContent = pTable.Name || "Unnamed";
        g.appendChild(title);

        if (pTable.Fields && pTable.Fields.length > 0)
        {
            let y = headerHeight + 16;
            for (const field of pTable.Fields)
            {
                const fieldText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldText.setAttribute("class", "orm-table-field" + (field.IsPrimaryKey ? " orm-table-field-pk" : ""));
                fieldText.setAttribute("x", 10);
                fieldText.setAttribute("y", y);
                
                const prefix = field.IsPrimaryKey ? "🔑 " : "";
                const nullable = field.IsNullable ? "" : "*";
                fieldText.textContent = prefix + (field.Name || field.FieldName || "field") + nullable;
                g.appendChild(fieldText);
                
                y += 16;
            }
        }

        const anchorSize = 12;
        const rightAnchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rightAnchor.setAttribute("class", "orm-table-anchor");
        rightAnchor.setAttribute("x", width - anchorSize/2);
        rightAnchor.setAttribute("y", height/2 - anchorSize/2);
        rightAnchor.setAttribute("width", anchorSize);
        rightAnchor.setAttribute("height", anchorSize);
        rightAnchor.setAttribute("rx", 2);
        rightAnchor.setAttribute("data-anchor", "right");
        g.appendChild(rightAnchor);

        const leftAnchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        leftAnchor.setAttribute("class", "orm-table-anchor");
        leftAnchor.setAttribute("x", -anchorSize/2);
        leftAnchor.setAttribute("y", height/2 - anchorSize/2);
        leftAnchor.setAttribute("width", anchorSize);
        leftAnchor.setAttribute("height", anchorSize);
        leftAnchor.setAttribute("rx", 2);
        leftAnchor.setAttribute("data-anchor", "left");
        g.appendChild(leftAnchor);

        SetupTableEvents(g, pTable);

        return g;
    }

    function SetupTableEvents(pElement, pTable)
    {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let elementStartX = pTable.X;
        let elementStartY = pTable.Y;

        pElement.addEventListener("mousedown", function(e) {
            if (e.target.classList.contains("orm-table-anchor"))
            {
                StartRelationDrag(pTable, e);
                return;
            }

            e.preventDefault();
            
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID, Toggle: true });

            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            elementStartX = pTable.X;
            elementStartY = pTable.Y;

            const onMouseMove = function(e) {
                if (!isDragging)
                    return;

                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;
                const newX = Math.max(0, elementStartX + dx);
                const newY = Math.max(0, elementStartY + dy);

                pElement.setAttribute("transform", "translate(" + newX + "," + newY + ")");
                pTable.X = newX;
                pTable.Y = newY;

                UpdateRelationEndpoints(pTable.ID);
            };

            const onMouseUp = function(e) {
                if (isDragging && (pTable.X !== elementStartX || pTable.Y !== elementStartY))
                {
                    SendMessage(XMessageType.MoveElement, {
                        ElementID: pTable.ID,
                        X: pTable.X,
                        Y: pTable.Y
                    });
                }
                
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        pElement.addEventListener("dblclick", function(e) {
            ShowRenameInput(pTable.ID);
        });

        pElement.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            e.stopPropagation();
            SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });
            ShowTableContextMenu(e.clientX, e.clientY, pTable.ID);
        });
    }

    function StartRelationDrag(pSourceTable, pEvent)
    {
        pEvent.preventDefault();
        pEvent.stopPropagation();

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "relation-drag-line");
        
        const startX = pSourceTable.X + (pSourceTable.Width || 200);
        const startY = pSourceTable.Y + (pSourceTable.Height || 150) / 2;
        
        line.setAttribute("x1", startX);
        line.setAttribute("y1", startY);
        line.setAttribute("x2", startX);
        line.setAttribute("y2", startY);
        
        _RelationsLayer.appendChild(line);

        _RelationDragState = {
            SourceTable: pSourceTable,
            Line: line,
            StartX: startX,
            StartY: startY
        };

        const onMouseMove = function(e) {
            if (!_RelationDragState)
                return;

            const rect = _CanvasContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + _CanvasContainer.scrollLeft;
            const y = e.clientY - rect.top + _CanvasContainer.scrollTop;

            _RelationDragState.Line.setAttribute("x2", x);
            _RelationDragState.Line.setAttribute("y2", y);
        };

        const onMouseUp = function(e) {
            if (!_RelationDragState)
                return;

            const rect = _CanvasContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + _CanvasContainer.scrollLeft;
            const y = e.clientY - rect.top + _CanvasContainer.scrollTop;

            const targetTable = FindTableAtPoint(x, y);

            if (targetTable && targetTable.ID !== _RelationDragState.SourceTable.ID)
            {
                SendMessage(XMessageType.DragDropAddRelation, {
                    SourceID: _RelationDragState.SourceTable.ID,
                    TargetID: targetTable.ID
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

    function FindTableAtPoint(pX, pY)
    {
        for (const table of _Model.Tables)
        {
            const x = table.X;
            const y = table.Y;
            const w = table.Width || 200;
            const h = table.Height || 150;

            if (pX >= x && pX <= x + w && pY >= y && pY <= y + h)
                return table;
        }
        return null;
    }

    function RenderRelations()
    {
        _RelationsLayer.innerHTML = "";
        
        for (const ref of _Model.References)
        {
            const g = CreateRelationElement(ref);
            if (g)
                _RelationsLayer.appendChild(g);
        }
    }

    function CreateRelationElement(pRef)
    {
        const sourceTable = _Model.Tables.find(t => t.ID === pRef.SourceID);
        const targetTable = _Model.Tables.find(t => t.ID === pRef.TargetID);

        if (!sourceTable || !targetTable)
            return null;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-reference");
        g.setAttribute("data-id", pRef.ID);

        const x1 = sourceTable.X + (sourceTable.Width || 200);
        const y1 = sourceTable.Y + (sourceTable.Height || 150) / 2;
        const x2 = targetTable.X;
        const y2 = targetTable.Y + (targetTable.Height || 150) / 2;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "orm-reference-line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        g.appendChild(line);

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - 10;

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "orm-reference-label");
        label.setAttribute("x", midX);
        label.setAttribute("y", midY);
        label.setAttribute("text-anchor", "middle");
        label.textContent = pRef.Name || "";
        g.appendChild(label);

        g.addEventListener("click", function(e) {
            e.stopPropagation();
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID, Toggle: true });
        });

        return g;
    }

    function UpdateRelationEndpoints(pTableID)
    {
        for (const ref of _Model.References)
        {
            if (ref.SourceID === pTableID || ref.TargetID === pTableID)
            {
                const sourceTable = _Model.Tables.find(t => t.ID === ref.SourceID);
                const targetTable = _Model.Tables.find(t => t.ID === ref.TargetID);

                if (!sourceTable || !targetTable)
                    continue;

                const g = _RelationsLayer.querySelector('[data-id="' + ref.ID + '"]');
                if (!g)
                    continue;

                const line = g.querySelector(".orm-reference-line");
                if (!line)
                    continue;

                const x1 = sourceTable.X + (sourceTable.Width || 200);
                const y1 = sourceTable.Y + (sourceTable.Height || 150) / 2;
                const x2 = targetTable.X;
                const y2 = targetTable.Y + (targetTable.Height || 150) / 2;

                line.setAttribute("x1", x1);
                line.setAttribute("y1", y1);
                line.setAttribute("x2", x2);
                line.setAttribute("y2", y2);

                const label = g.querySelector(".orm-reference-label");
                if (label)
                {
                    label.setAttribute("x", (x1 + x2) / 2);
                    label.setAttribute("y", (y1 + y2) / 2 - 10);
                }
            }
        }
    }

    function UpdateSelectionVisuals()
    {
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function(t) {
            const id = t.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                t.classList.add("selected");
            else
                t.classList.remove("selected");
        });

        const refs = _RelationsLayer.querySelectorAll(".orm-reference");
        refs.forEach(function(r) {
            const id = r.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                r.classList.add("selected");
            else
                r.classList.remove("selected");
        });
    }

    function ShowRenameInput(pElementID)
    {
        const table = _Model.Tables.find(t => t.ID === pElementID);
        if (!table)
            return;

        const g = _TablesLayer.querySelector('[data-id="' + pElementID + '"]');
        if (!g)
            return;

        const rect = _CanvasContainer.getBoundingClientRect();
        const scrollLeft = _CanvasContainer.scrollLeft;
        const scrollTop = _CanvasContainer.scrollTop;

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("class", "rename-input");
        input.value = table.Name || "";
        input.style.left = (table.X - scrollLeft + rect.left + 10) + "px";
        input.style.top = (table.Y - scrollTop + rect.top + 4) + "px";
        input.style.width = ((table.Width || 200) - 20) + "px";

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = function() {
            const newName = input.value.trim();
            if (newName && newName !== table.Name)
            {
                SendMessage(XMessageType.RenameCompleted, { NewName: newName });
            }
            input.remove();
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter")
            {
                e.preventDefault();
                commit();
            }
            else if (e.key === "Escape")
            {
                e.preventDefault();
                input.remove();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", Initialize);
})();
