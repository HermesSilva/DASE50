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

    let _Model = { DesignID: null, Tables: [], References: [] };
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
            const tableID = _ContextMenuTarget;
            HideContextMenu();

            switch (action)
            {
                case "add-field":
                    if (tableID)
                        SendMessage(XMessageType.AddField, { TableID: tableID, Name: "NewField", DataType: "String" });
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
                // Select the Design when clicking on the background
                if (_Model.DesignID)
                    SendMessage(XMessageType.SelectElement, { ElementID: _Model.DesignID });
                else
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
        if (pTable.FillProp)
            headerMask.style.fill = pTable.FillProp;
        g.appendChild(headerMask);

        // Apply FillProp to header if defined
        if (pTable.FillProp)
            header.style.fill = pTable.FillProp;

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("class", "orm-table-icon");
        icon.setAttribute("x", 8);
        icon.setAttribute("y", 18);
        icon.textContent = "ID";
        g.appendChild(icon);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("class", "orm-table-title");
        title.setAttribute("x", 28);
        title.setAttribute("y", 18);
        title.textContent = pTable.Name || "Unnamed";
        g.appendChild(title);

        if (pTable.Fields && pTable.Fields.length > 0)
        {
            let y = headerHeight + 16;
            for (const field of pTable.Fields)
            {
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

                const fieldText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldText.setAttribute("class", "orm-table-field" + (field.IsPrimaryKey ? " orm-table-field-pk" : ""));
                fieldText.setAttribute("x", 10);
                fieldText.setAttribute("y", y);
                
                const prefix = field.IsPrimaryKey ? "🔑 " : "";
                const nullable = field.IsNullable ? "" : "*";
                fieldText.textContent = prefix + (field.Name || field.FieldName || "field") + nullable;
                fieldGroup.appendChild(fieldText);

                SetupFieldEvents(fieldGroup, field);
                g.appendChild(fieldGroup);
                
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
            e.stopPropagation();
            
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

    function SetupFieldEvents(pElement, pField)
    {
        pElement.addEventListener("mousedown", function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pField.ID, Toggle: true });
        });

        pElement.addEventListener("dblclick", function(e) {
            e.preventDefault();
            e.stopPropagation();
            ShowRenameInput(pField.ID);
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

    function BuildPathFromPoints(pPoints)
    {
        if (!pPoints || pPoints.length < 2)
            return "";

        let path = `M ${pPoints[0].X} ${pPoints[0].Y}`;
        
        for (let i = 1; i < pPoints.length; i++)
        {
            path += ` L ${pPoints[i].X} ${pPoints[i].Y}`;
        }
        
        return path;
    }

    function SimplifyReferencePoints(pPoints, pSourceTable, pTargetTable)
    {
        // ══════════════════════════════════════════════════════════════════════════════
        // REGRAS DE ROTEAMENTO DE LINHAS (REFERÊNCIAS) - XORMDesign.ts
        // ══════════════════════════════════════════════════════════════════════════════
        // 1. SOURCE: SEMPRE sai HORIZONTALMENTE (esquerda ou direita)
        // 2. TARGET: Pode receber de QUALQUER lado (Left, Right, Top, Bottom)
        // 3. SEGMENTOS: NUNCA diagonal - sempre vertical OU horizontal
        // 4. Segmento mínimo: 30px no source e no target
        // 5. TIPOS DE ROTA: L (2 segmentos), Z/C (3 segmentos)
        // ══════════════════════════════════════════════════════════════════════════════
        
        const MIN_SEGMENT = 30;
        
        if (!pPoints || pPoints.length < 2)
            return [];

        // Filtrar pontos inválidos
        const valid = pPoints.filter(p => p && Number.isFinite(p.X) && Number.isFinite(p.Y));
        if (valid.length < 2)
            return [];

        const start = { X: valid[0].X, Y: valid[0].Y };
        const end = { X: valid[valid.length - 1].X, Y: valid[valid.length - 1].Y };

        // Se não temos tabelas, apenas garantir ortogonalidade básica
        if (!pSourceTable || !pTargetTable)
        {
            // Converter em L simples se for diagonal
            if (Math.abs(end.X - start.X) > 2 && Math.abs(end.Y - start.Y) > 2)
            {
                return [start, { X: end.X, Y: start.Y }, end];
            }
            return [start, end];
        }

        // Calcular bounds das tabelas
        const srcLeft = pSourceTable.X;
        const srcRight = pSourceTable.X + (pSourceTable.Width || 200);
        const srcTop = pSourceTable.Y;
        const srcBottom = pSourceTable.Y + (pSourceTable.Height || 150);
        
        const tgtLeft = pTargetTable.X;
        const tgtRight = pTargetTable.X + (pTargetTable.Width || 200);
        const tgtTop = pTargetTable.Y;
        const tgtBottom = pTargetTable.Y + (pTargetTable.Height || 150);
        const tgtCenterX = tgtLeft + (pTargetTable.Width || 200) / 2;
        const tgtCenterY = tgtTop + (pTargetTable.Height || 150) / 2;

        // Determinar lado de saída do source (baseado na posição do ponto inicial)
        const exitingRight = Math.abs(start.X - srcRight) < Math.abs(start.X - srcLeft);
        
        // Determinar lado de entrada no target (baseado na posição do ponto final)
        const distToLeft = Math.abs(end.X - tgtLeft);
        const distToRight = Math.abs(end.X - tgtRight);
        const distToTop = Math.abs(end.Y - tgtTop);
        const distToBottom = Math.abs(end.Y - tgtBottom);
        const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
        
        let targetSide;
        if (minDist === distToLeft) targetSide = 'left';
        else if (minDist === distToRight) targetSide = 'right';
        else if (minDist === distToTop) targetSide = 'top';
        else targetSide = 'bottom';

        // ══════════════════════════════════════════════════════════════════════════════
        // CRIAR ROTA ORTOGONAL OTIMIZADA (L ou Z/C)
        // ══════════════════════════════════════════════════════════════════════════════
        
        const result = [start];

        if (targetSide === 'left' || targetSide === 'right')
        {
            // Target recebe pela lateral - ROTA EM L (horizontal → vertical → horizontal)
            // Mas se source Y == target entry Y, é uma linha reta horizontal
            if (Math.abs(start.Y - end.Y) < 2)
            {
                // Linha horizontal direta
                result.push(end);
            }
            else
            {
                // Rota em L: horizontal até alinhar com entry, depois vertical, depois horizontal até target
                // Para L simples: horizontal → vertical (2 segmentos)
                const turnX = end.X + (targetSide === 'left' ? -MIN_SEGMENT : MIN_SEGMENT);
                
                // Se o turnX está entre source e target, usar L simples
                if ((exitingRight && turnX > start.X) || (!exitingRight && turnX < start.X))
                {
                    // L simples: horizontal até turnX, depois vertical até end
                    result.push({ X: turnX, Y: start.Y });
                    result.push({ X: turnX, Y: end.Y });
                    result.push(end);
                }
                else
                {
                    // Z route: precisa de ponto intermediário
                    const midX = exitingRight 
                        ? Math.max(srcRight + MIN_SEGMENT, (start.X + end.X) / 2)
                        : Math.min(srcLeft - MIN_SEGMENT, (start.X + end.X) / 2);
                    result.push({ X: midX, Y: start.Y });
                    result.push({ X: midX, Y: end.Y });
                    result.push(end);
                }
            }
        }
        else
        {
            // Target recebe por cima ou por baixo - ROTA EM L (horizontal → vertical)
            if (Math.abs(start.X - end.X) < 2)
            {
                // Linha vertical direta (raro, source deveria sair horizontal)
                result.push(end);
            }
            else
            {
                // Rota em L: horizontal até alinhar com target X, depois vertical
                // Este é o L mais simples: 2 segmentos
                result.push({ X: end.X, Y: start.Y });
                result.push(end);
            }
        }

        // Remover pontos duplicados consecutivos
        const cleaned = [result[0]];
        for (let i = 1; i < result.length; i++)
        {
            const prev = cleaned[cleaned.length - 1];
            if (Math.abs(result[i].X - prev.X) > 1 || Math.abs(result[i].Y - prev.Y) > 1)
                cleaned.push(result[i]);
        }

        // Remover pontos colineares
        if (cleaned.length > 2)
        {
            const final = [cleaned[0]];
            for (let i = 1; i < cleaned.length - 1; i++)
            {
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

    function GetTableColor(pTableID)
    {
        const table = _Model.Tables.find(t => t.ID === pTableID);
        if (table && table.FillProp)
            return table.FillProp;
        return "#2d8a4e";
    }

    function CreateRelationElement(pRef)
    {
        // Source is a field ID - find the table that contains this field
        const sourceTable = _Model.Tables.find(t => 
            t.Fields && t.Fields.some(f => f.ID === pRef.SourceFieldID)
        );
        // Target is a table ID
        const targetTable = _Model.Tables.find(t => t.ID === pRef.TargetTableID);

        if (!sourceTable || !targetTable)
            return null;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-reference");
        g.setAttribute("data-id", pRef.ID);

        // Se há pontos de roteamento, use-os; caso contrário, calcule um caminho simples
        const pointsRaw = pRef.Points && pRef.Points.length >= 2 ? pRef.Points : [];
        const points = SimplifyReferencePoints(pointsRaw, sourceTable, targetTable);
        
        if (points.length >= 2)
        {
            // Renderiza linha roteada com múltiplos segmentos
            const pathData = BuildPathFromPoints(points);
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "orm-reference-line");
            path.setAttribute("d", pathData);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", GetTableColor(pRef.TargetTableID));
            g.appendChild(path);

            // Label no ponto médio
            const midIdx = Math.floor(points.length / 2);
            const midPoint = points[midIdx];
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("class", "orm-reference-label");
            label.setAttribute("x", midPoint.X);
            label.setAttribute("y", midPoint.Y - 10);
            label.setAttribute("text-anchor", "middle");
            label.textContent = pRef.Name || "";
            g.appendChild(label);
        }
        else
        {
            // Fallback: linha reta simples
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
            line.setAttribute("stroke", GetTableColor(pRef.TargetTableID));
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
        }

        g.addEventListener("click", function(e) {
            e.stopPropagation();
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID, Toggle: true });
        });

        return g;
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

        const fields = _TablesLayer.querySelectorAll(".orm-field-group");
        fields.forEach(function(f) {
            const id = f.getAttribute("data-field-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                f.classList.add("selected");
            else
                f.classList.remove("selected");
        });
    }

    function ShowRenameInput(pElementID)
    {
        // Try to find table first
        let table = _Model.Tables.find(t => t.ID === pElementID);
        let field = null;
        let parentTable = null;

        // If not a table, look for a field
        if (!table)
        {
            for (const t of _Model.Tables)
            {
                if (t.Fields)
                {
                    field = t.Fields.find(f => f.ID === pElementID);
                    if (field)
                    {
                        parentTable = t;
                        break;
                    }
                }
            }
        }

        if (!table && !field)
            return;

        let g, elementX, elementY, elementWidth, currentName;

        if (table)
        {
            g = _TablesLayer.querySelector('[data-id="' + pElementID + '"]');
            if (!g)
                return;
            elementX = table.X;
            elementY = table.Y;
            elementWidth = table.Width || 200;
            currentName = table.Name || "";
        }
        else
        {
            g = _TablesLayer.querySelector('[data-field-id="' + pElementID + '"]');
            if (!g)
                return;
            const fieldRect = g.getBoundingClientRect();
            const canvasRect = _CanvasContainer.getBoundingClientRect();
            elementX = parentTable.X;
            elementY = fieldRect.top - canvasRect.top + _CanvasContainer.scrollTop;
            elementWidth = parentTable.Width || 200;
            currentName = field.Name || "";
        }

        const rect = _CanvasContainer.getBoundingClientRect();
        const scrollLeft = _CanvasContainer.scrollLeft;
        const scrollTop = _CanvasContainer.scrollTop;

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("class", "rename-input");
        input.value = currentName;
        input.style.left = (elementX - scrollLeft + rect.left + 10) + "px";
        input.style.top = (elementY - scrollTop + rect.top + 4) + "px";
        input.style.width = (elementWidth - 20) + "px";

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = function() {
            const newName = input.value.trim();
            if (newName && newName !== currentName)
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
