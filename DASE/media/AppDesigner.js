// AppDesigner.js — webview WYSIWYG do App Designer (Fase 4, reescrita).
//
// O que se vê aqui é (aproximadamente) o que a App vai parecer em produção — grade real,
// barra de filtros real, botões coloridos de verdade, formulário com o grid lógico de 32
// colunas (FE-2) desenhado como grid de verdade, largura do modal calculada pela mesma
// fórmula da FE-8 (970px de referência × ModalWidth%). Não há canvas nem X/Y de pixel: a
// posição de um campo é Row/ColSpan, exatamente como o back exige — por isso "arrastar" aqui
// redimensiona ColSpan (borda direita) e reatribui Row (soltar sobre outra linha), nunca move
// livremente em X.
//
// Reordenar a posição HORIZONTAL de dois campos dentro da MESMA linha não é suportado: o
// modelo (`XAPPField`) não tem propriedade de ordem própria, só a ordem de inserção — fica
// registrado aqui como limitação conhecida, não escondida.
(function () {
    'use strict';

    const vscode = acquireVsCodeApi();
    const root = document.getElementById('app-designer-root');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    let currentModel = null;
    let currentIssues = [];
    let selectedID = null;

    function Post(pType, pPayload) {
        vscode.postMessage({ Type: pType, Payload: pPayload || {} });
    }

    function El(pTag, pClassName, pText) {
        const el = document.createElement(pTag);
        if (pClassName) el.className = pClassName;
        if (pText !== undefined) el.textContent = pText;
        return el;
    }

    // ------------------------------------------------------------------------------------
    // Ícones — conjunto pequeno, os nomes que já aparecem nas Apps reais do TootegaERP.
    // Fora da lista: monograma (primeira letra), não quebra.
    // ------------------------------------------------------------------------------------

    const ICON_PATHS = {
        'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        'check': '<polyline points="20 6 9 17 4 12"/>',
        'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
        'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
        'eye': '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
        'upload': '<path d="M12 3v12"/><polyline points="7 8 12 3 17 8"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
        'download': '<path d="M12 3v12"/><polyline points="7 12 12 17 17 12"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
        'rotate-ccw': '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
        'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'building-2': '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M14 9h1"/><path d="M14 13h1"/>',
        'map-pin': '<path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        'phone': '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9z"/>',
        'receipt': '<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z"/><path d="M8 7h8"/><path d="M8 11h8"/>',
        'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
        'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
        'banknote': '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
        'hash': '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
        'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
        'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
        'layout-dashboard': '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
        'contact': '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M6 16c1-2 3-2 3-2s2 0 3 2"/>'
    };

    function IconEl(pName) {
        const body = ICON_PATHS[pName];
        if (!body) {
            const mono = El('span', 'app-icon-mono', (pName || '?').charAt(0).toUpperCase());
            return mono;
        }
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('app-icon');
        svg.innerHTML = body; // markup estático, curado neste arquivo — não é entrada do usuário
        return svg;
    }

    // Cor por ButtonType (XAPPButtonType) — o modelo hoje só tem estes 4; Warning/Info/Link/Icon
    // existem no front real mas ainda não têm membro no enum do designer.
    const BUTTON_TYPE_CLASS = { 1: 'app-btn-primary', 2: 'app-btn-secondary', 3: 'app-btn-danger', 4: 'app-btn-success' };

    // Cor por AÇÃO (XAPPButtonAction) — prevalece sobre ButtonType, espelha
    // Front/Core/.../XButtonBar.tsx ACTION_STYLES: Criar=verde, Editar=azul,
    // Visualizar=azul-pastel, Exportar=violeta. Fechar não aparece aqui — não é uma ação de
    // XAPPButton (é o X do modal, que este webview ainda não desenha).
    const ACTION_CLASS = { 1: 'app-act-create', 2: 'app-act-edit', 4: 'app-act-view', 6: 'app-act-export' };

    function ButtonVisualClass(pButtonType, pAction) {
        return ACTION_CLASS[pAction] || BUTTON_TYPE_CLASS[pButtonType] || 'app-btn-secondary';
    }

    // ------------------------------------------------------------------------------------
    // Seleção
    // ------------------------------------------------------------------------------------

    function SelectElement(pID) {
        selectedID = pID;
        // SelectElement alimenta o SelectionService compartilhado — quem mostra as
        // propriedades é o painel real Dase.Properties (mesmo do ORM Designer), não este
        // webview. Ver Views/CompositeDesignerProvider.ts.
        Post('SelectElement', { ElementID: pID });
        HighlightSelection();
    }

    function HighlightSelection() {
        root.querySelectorAll('.app-selected').forEach(el => el.classList.remove('app-selected'));
        if (!selectedID) return;
        root.querySelectorAll('[data-id="' + selectedID + '"]').forEach(el => el.classList.add('app-selected'));
    }

    function Selectable(pEl, pID) {
        pEl.setAttribute('data-id', pID);
        pEl.addEventListener('click', (e) => { e.stopPropagation(); SelectElement(pID); });
        return pEl;
    }

    function GhostAdd(pLabel, pOnClick, pIconName) {
        const btn = El('button', 'app-ghost-add');
        if (pIconName) btn.appendChild(IconEl(pIconName));
        btn.appendChild(El('span', '', pLabel));
        btn.addEventListener('click', (e) => { e.stopPropagation(); pOnClick(); });
        return btn;
    }

    // ------------------------------------------------------------------------------------
    // Barra de botões / filtros / grade / ações de linha / visualizadores
    // ------------------------------------------------------------------------------------

    function RenderRealButton(pButton) {
        const cls = 'app-real-btn ' + ButtonVisualClass(pButton.ButtonType, pButton.Action);
        const btn = El('button', cls);
        btn.appendChild(IconEl(pButton.Icon));
        btn.appendChild(El('span', '', pButton.TitleKey || pButton.Name || '(sem título)'));
        Selectable(btn, pButton.ID);
        return btn;
    }

    /** Visualizador (`Viewers`) — sempre a cor de "Visualizar" (azul-pastel), como no front real:
     * uma App declara N visualizadores e todos compartilham essa cor (só o ícone os distingue). */
    function RenderViewerButton(pViewer) {
        const btn = El('button', 'app-real-btn app-act-view');
        btn.appendChild(IconEl('eye'));
        btn.appendChild(El('span', '', pViewer.TitleKey || pViewer.Key || '(sem chave)'));
        Selectable(btn, pViewer.ID);
        return btn;
    }

    function FilterInputFor(pFilter) {
        const dt = pFilter.DataType;
        if (dt === 7) { // Boolean
            const sel = El('select');
            sel.appendChild(El('option', '', 'Sim/Não'));
            return sel;
        }
        if (dt === 2 || dt === 3 || dt === 4) { // Integer/Decimal/Currency
            const input = El('input'); input.type = 'number'; input.disabled = true;
            return input;
        }
        if (dt === 5 || dt === 6) { // Date/DateTime — input nativo, mesmo calendário do front real
            const input = El('input'); input.type = dt === 5 ? 'date' : 'datetime-local'; input.disabled = true;
            return input;
        }
        const input = El('input'); input.type = 'text'; input.disabled = true;
        input.placeholder = pFilter.TitleKey || pFilter.FieldName || '';
        return input;
    }

    /**
     * Barra única — filtros à esquerda, botões à direita, como o cabeçalho REAL de
     * `XApplicationView.tsx` (`XFilter` + `XButtonBar` na mesma linha `flex flex-wrap
     * items-end`, um `flex-1` os separando). Não são duas tiras empilhadas: é UMA.
     */
    function RenderToolbar(pApp) {
        const wrap = El('div', 'app-toolbar-row');

        const filters = El('div', 'app-toolbar-filters');
        for (const filter of pApp.Filters || []) {
            const field = El('div', 'app-filter-field');
            Selectable(field, filter.ID);
            field.appendChild(El('label', 'app-filter-label', filter.TitleKey || filter.FieldName || '(sem nome)'));
            field.appendChild(FilterInputFor(filter));
            filters.appendChild(field);
        }
        filters.appendChild(GhostAdd('Filtro', () => Post('AddFilter', { FieldName: 'NewFilter' }), 'plus'));
        wrap.appendChild(filters);

        wrap.appendChild(El('div', 'app-toolbar-spacer'));

        const buttons = El('div', 'app-toolbar-buttons');
        for (const button of pApp.Buttons || [])
            buttons.appendChild(RenderRealButton(button));
        buttons.appendChild(GhostAdd('Botão', () => Post('AddButton', { TitleKey: '' }), 'plus'));
        wrap.appendChild(buttons);

        return wrap;
    }

    /**
     * `<table>` de verdade — mirror de `XDataView.tsx`/`XDataViewHeader.tsx`: sem linha
     * vertical entre colunas (só espaçamento), cabeçalho com borda inferior DUPLA, linhas do
     * corpo com borda inferior simples e clara.
     */
    function RenderGridPreview(pApp) {
        const wrap = El('div', 'app-grid-wrap');
        const table = El('table', 'app-real-table');

        const thead = El('thead');
        const headerRow = El('tr');
        for (const column of pApp.Columns || []) {
            const cell = El('th', '', column.TitleKey || column.FieldName || '(sem nome)');
            if (column.Width) cell.style.width = column.Width + 'px';
            Selectable(cell, column.ID);
            headerRow.appendChild(cell);
        }
        const addCell = El('th', 'app-grid-add-cell');
        addCell.appendChild(GhostAdd('Coluna', () => Post('AddColumn', { FieldName: 'NewColumn' }), 'plus'));
        headerRow.appendChild(addCell);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = El('tbody');
        const columns = pApp.Columns || [];
        for (let i = 0; i < 2 && columns.length > 0; i++) {
            const skRow = El('tr', i === 0 ? 'app-grid-skeleton-row app-grid-skeleton-row-selected' : 'app-grid-skeleton-row');
            for (const column of columns) {
                const cell = El('td');
                cell.appendChild(El('span', 'app-grid-skeleton-bar'));
                skRow.appendChild(cell);
            }
            skRow.appendChild(El('td'));
            tbody.appendChild(skRow);
        }
        table.appendChild(tbody);
        wrap.appendChild(table);

        if (columns.length === 0)
            wrap.appendChild(El('div', 'app-grid-empty', '(sem colunas — grade vazia)'));

        return wrap;
    }

    function RenderChipsStrip(pTitle, pItems, pLabelFn, pOnAdd) {
        const wrap = El('div', 'app-chip-strip');
        wrap.appendChild(El('div', 'app-chip-strip-title', pTitle));
        const row = El('div', 'app-chip-row');
        for (const item of pItems) {
            const chip = El('div', 'app-chip', pLabelFn(item));
            Selectable(chip, item.ID);
            row.appendChild(chip);
        }
        row.appendChild(GhostAdd('+', pOnAdd));
        wrap.appendChild(row);
        return wrap;
    }

    function RenderViewersStrip(pViewers) {
        const wrap = El('div', 'app-chip-strip');
        wrap.appendChild(El('div', 'app-chip-strip-title', 'Visualizadores (' + pViewers.length + ')'));
        const row = El('div', 'app-chip-row');
        for (const viewer of pViewers)
            row.appendChild(RenderViewerButton(viewer));
        row.appendChild(GhostAdd('Visualizador', () => Post('AddViewer', { Key: 'viewer' }), 'plus'));
        wrap.appendChild(row);
        return wrap;
    }

    // ------------------------------------------------------------------------------------
    // Formulário — grid de 32 colunas de verdade, com arraste (ColSpan / Row)
    // ------------------------------------------------------------------------------------

    const REFERENCE_APP_WIDTH_PX = 970; // FE-8: piso de referência (1280px viewport - sidebar 280px - espaçamentos)

    function FieldWidget(pField) {
        const et = pField.EditorType;
        let el;
        switch (et) {
            case 2: el = El('textarea'); el.rows = 2; el.disabled = true; break;
            case 3: el = El('input'); el.type = 'number'; el.disabled = true; break;
            case 7: case 10: { el = El('div', 'app-field-bool'); const cb = El('input'); cb.type = 'checkbox'; cb.disabled = true; el.appendChild(cb); break; }
            case 8: case 9: case 27: { el = El('select'); el.disabled = true; el.appendChild(El('option', '', 'Selecione…')); break; }
            case 4: el = El('input'); el.type = 'date'; el.disabled = true; break;
            case 5: el = El('input'); el.type = 'datetime-local'; el.disabled = true; break;
            case 6: el = El('input'); el.type = 'time'; el.disabled = true; break;
            case 11: case 28: el = El('div', 'app-field-upload'); el.appendChild(IconEl('upload')); el.appendChild(El('span', '', et === 28 ? 'Escolher imagem' : 'Escolher arquivo')); break;
            case 12: { el = El('div', 'app-field-color'); el.appendChild(El('span', 'app-color-swatch')); el.appendChild(El('span', '', '#FFFFFF')); break; }
            case 13: case 14: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = '🔍 Buscar…'; break;
            case 15: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = '••••••'; break;
            case 16: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = 'nome@exemplo.com'; break;
            case 17: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = '(00) 00000-0000'; break;
            case 18: { el = El('div', 'app-field-affix'); el.appendChild(El('span', 'app-affix', 'R$')); el.appendChild(El('input')); el.querySelector('input').disabled = true; break; }
            case 19: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = '000.000.000-00'; break;
            case 20: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = '00.000.000/0000-00'; break;
            case 21: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = '00000-000'; break;
            case 22: el = El('input'); el.type = 'range'; el.disabled = true; break;
            case 23: el = El('div', 'app-field-rating', '★★★★★'); break;
            case 25: { el = El('div', 'app-field-affix'); el.appendChild(El('input')); el.querySelector('input').disabled = true; el.appendChild(El('span', 'app-affix', '%')); break; }
            case 26: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = 'https://…'; break;
            default: el = El('input'); el.type = 'text'; el.disabled = true; el.placeholder = 'Texto'; break;
        }
        el.classList.add('app-field-widget');
        return el;
    }

    function RenderFieldBody(pField) {
        const body = El('div', 'app-field-body');
        const label = El('label', 'app-field-label');
        label.appendChild(El('span', '', pField.TitleKey || pField.FieldName || '(sem título)'));
        if (pField.IsRequired) label.appendChild(El('span', 'app-field-required', ' *'));
        if (!pField.TitleKey) label.classList.add('app-field-label-missing');
        body.appendChild(label);
        body.appendChild(FieldWidget(pField));
        return body;
    }

    function RenderField(pField, pRowEl, pOtherFieldsInRow) {
        if (pField.EditorType === 24) { // Hidden — chip discreto, sem ocupar largura de campo real
            const chip = El('div', 'app-field-hidden-chip', '🔒 ' + (pField.FieldName || '(sem nome)') + ' (oculto)');
            Selectable(chip, pField.ID);
            pRowEl.appendChild(chip);
            return;
        }

        const wrap = El('div', 'app-field');
        wrap.style.flexBasis = (pField.ColSpan / 32 * 100) + '%';
        wrap.style.maxWidth = (pField.ColSpan / 32 * 100) + '%';
        Selectable(wrap, pField.ID);
        wrap.appendChild(RenderFieldBody(pField));

        const handle = El('div', 'app-resize-handle');
        wrap.appendChild(handle);

        pRowEl.appendChild(wrap);

        MakeResizable(handle, pField, pRowEl, pOtherFieldsInRow, wrap);
        MakeDraggableToRow(wrap, pField);
    }

    function RenderFieldsGrid(pFields, pSectionMaxColSpanRow) {
        const grid = El('div', 'app-fields-grid');
        const byRow = new Map();
        for (const field of pFields || []) {
            const list = byRow.get(field.Row) || [];
            list.push(field);
            byRow.set(field.Row, list);
        }
        const rows = [...byRow.keys()].sort((a, b) => a - b);
        let maxRow = rows.length > 0 ? rows[rows.length - 1] : -1;

        for (const rowNumber of rows) {
            const fieldsInRow = byRow.get(rowNumber);
            const rowEl = El('div', 'app-grid-row-lane');
            rowEl.setAttribute('data-row', String(rowNumber));
            for (const field of fieldsInRow)
                RenderField(field, rowEl, fieldsInRow.filter(f => f !== field));
            grid.appendChild(rowEl);
        }

        const newRow = El('div', 'app-grid-row-lane app-grid-newrow', '+ solte um campo aqui para uma nova linha');
        newRow.setAttribute('data-row', String(maxRow + 1));
        grid.appendChild(newRow);

        return grid;
    }

    // --- Arraste: redimensionar ColSpan (borda direita) ------------------------------------

    function MakeResizable(pHandleEl, pField, pRowEl, pOtherFieldsInRow, pFieldWrapEl) {
        pHandleEl.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            pHandleEl.setPointerCapture(e.pointerId);

            const startX = e.clientX;
            const startSpan = pField.ColSpan;
            const rowWidth = pRowEl.getBoundingClientRect().width || 1;
            const usedByOthers = pOtherFieldsInRow.reduce((sum, f) => sum + (f.EditorType === 24 ? 0 : f.ColSpan), 0);
            const maxSpan = Math.max(1, 32 - usedByOthers);
            let newSpan = startSpan;

            function onMove(pEv) {
                const dx = pEv.clientX - startX;
                const deltaCols = Math.round((dx / rowWidth) * 32);
                newSpan = Math.min(maxSpan, Math.max(1, startSpan + deltaCols));
                pFieldWrapEl.style.flexBasis = (newSpan / 32 * 100) + '%';
                pFieldWrapEl.style.maxWidth = (newSpan / 32 * 100) + '%';
            }
            function onUp(pEv) {
                pHandleEl.releasePointerCapture(pEv.pointerId);
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (newSpan !== startSpan)
                    Post('UpdateProperty', { ElementID: pField.ID, PropertyKey: 'ColSpan', Value: newSpan });
            }
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }

    // --- Arraste: mover para outra linha (Row) ----------------------------------------------

    function MakeDraggableToRow(pFieldWrapEl, pField) {
        pFieldWrapEl.addEventListener('pointerdown', (e) => {
            if (e.target.classList.contains('app-resize-handle')) return;

            const startX = e.clientX;
            const startY = e.clientY;
            let moved = false;

            function ClearDropHighlights() {
                document.querySelectorAll('.app-drop-target').forEach(el => el.classList.remove('app-drop-target'));
            }

            function HighlightAt(pX, pY) {
                ClearDropHighlights();
                const target = FindRowLaneAt(pX, pY);
                if (target) target.classList.add('app-drop-target');
                return target;
            }

            function FindRowLaneAt(pX, pY) {
                const els = document.elementsFromPoint(pX, pY);
                return els.find(el => el.classList && el.classList.contains('app-grid-row-lane')) || null;
            }

            function onMove(pEv) {
                const dx = pEv.clientX - startX, dy = pEv.clientY - startY;
                if (!moved && Math.hypot(dx, dy) > 6) {
                    moved = true;
                    pFieldWrapEl.classList.add('app-field-dragging');
                    document.body.classList.add('app-drag-active');
                }
                if (moved) HighlightAt(pEv.clientX, pEv.clientY);
            }

            function onUp(pEv) {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                pFieldWrapEl.classList.remove('app-field-dragging');
                document.body.classList.remove('app-drag-active');
                ClearDropHighlights();

                if (!moved) {
                    SelectElement(pField.ID);
                    return;
                }

                const target = FindRowLaneAt(pEv.clientX, pEv.clientY);
                if (target) {
                    const newRow = Number(target.getAttribute('data-row'));
                    if (!Number.isNaN(newRow) && newRow !== pField.Row)
                        Post('UpdateProperty', { ElementID: pField.ID, PropertyKey: 'Row', Value: newRow });
                }
            }

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }

    // --- Seção / aba / grade filha -----------------------------------------------------------

    function RenderSectionPanel(pSection, pParentID) {
        const panel = El('div', 'app-section-panel');
        if (pSection.ShowHeader) {
            const header = El('div', 'app-section-header');
            Selectable(header, pSection.ID);
            header.appendChild(El('span', 'app-section-header-title', pSection.TitleKey || pSection.Name || '(sem título)'));
            header.appendChild(GhostAdd('Campo', () => Post('AddField', { SectionID: pSection.ID, FieldName: 'NewField', Row: (pSection.Fields || []).length, ColSpan: 32 }), 'plus'));
            panel.appendChild(header);
        }
        else {
            const ghostRow = El('div', 'app-section-ghost-row');
            Selectable(ghostRow, pSection.ID);
            ghostRow.appendChild(GhostAdd('Campo', () => Post('AddField', { SectionID: pSection.ID, FieldName: 'NewField', Row: (pSection.Fields || []).length, ColSpan: 32 }), 'plus'));
            panel.appendChild(ghostRow);
        }
        panel.appendChild(RenderFieldsGrid(pSection.Fields || []));
        return panel;
    }

    function RenderDetailGridChip(pGrid, pParentID) {
        const chip = El('div', 'app-detail-grid-chip');
        chip.appendChild(IconEl('receipt'));
        chip.appendChild(El('span', '', 'Grade mestre-detalhe: ' + (pGrid.DataEndpoint || '(sem endpoint)')));
        Selectable(chip, pGrid.ID);
        return chip;
    }

    let activeTabID = null;

    function RenderTabbedFormCard(pApp, pForm) {
        const card = El('div', 'app-form-card');
        card.style.width = Math.round(REFERENCE_APP_WIDTH_PX * ((pForm.ModalWidth || 45) / 100)) + 'px';

        const cardHeader = El('div', 'app-form-card-header');
        Selectable(cardHeader, pForm.ID);
        cardHeader.appendChild(El('span', '', pForm.CreateTitleKey || pForm.Name || '(formulário com abas)'));
        cardHeader.appendChild(El('span', 'app-form-card-width', pForm.ModalWidth + '% → ' + Math.round(REFERENCE_APP_WIDTH_PX * ((pForm.ModalWidth || 45) / 100)) + 'px (FE-8)'));
        card.appendChild(cardHeader);

        const tabs = pForm.Tabs || [];
        if (!tabs.some(t => t.ID === activeTabID))
            activeTabID = tabs.length > 0 ? tabs[0].ID : null;

        const tabStrip = El('div', 'app-tab-strip');
        for (const tab of tabs) {
            const tabBtn = El('button', 'app-tab-btn' + (tab.ID === activeTabID ? ' app-tab-active' : ''));
            tabBtn.appendChild(IconEl(tab.Icon));
            tabBtn.appendChild(El('span', '', tab.TitleKey || tab.Name || '(sem título)'));
            tabBtn.setAttribute('data-id', tab.ID);
            tabBtn.addEventListener('click', (e) => { e.stopPropagation(); activeTabID = tab.ID; SelectElement(tab.ID); Render(); });
            tabStrip.appendChild(tabBtn);
        }
        tabStrip.appendChild(GhostAdd('Aba', () => Post('AddFormTab', { TitleKey: '' }), 'plus'));
        card.appendChild(tabStrip);

        const activeTab = tabs.find(t => t.ID === activeTabID);
        const body = El('div', 'app-form-card-body');
        if (activeTab) {
            for (const section of activeTab.Sections || [])
                body.appendChild(RenderSectionPanel(section, activeTab.ID));
            if (activeTab.DetailGrid)
                body.appendChild(RenderDetailGridChip(activeTab.DetailGrid, activeTab.ID));
            if ((!activeTab.Sections || activeTab.Sections.length === 0) && !activeTab.DetailGrid) {
                const ghost = El('div', 'app-section-ghost-row');
                ghost.appendChild(GhostAdd('Seção', () => Post('AddFormSection', { ParentID: activeTab.ID, TitleKey: '' }), 'plus'));
                body.appendChild(ghost);
            }
        }
        else {
            body.appendChild(El('div', 'app-empty-inline', 'Nenhuma aba ainda.'));
        }
        card.appendChild(body);

        return card;
    }

    function RenderSimpleFormCard(pApp, pForm) {
        const card = El('div', 'app-form-card');
        card.style.width = Math.round(REFERENCE_APP_WIDTH_PX * ((pForm.ModalWidth || 45) / 100)) + 'px';

        const cardHeader = El('div', 'app-form-card-header');
        Selectable(cardHeader, pForm.ID);
        cardHeader.appendChild(El('span', '', pForm.CreateTitleKey || pForm.Name || '(formulário)'));
        cardHeader.appendChild(El('span', 'app-form-card-width', pForm.ModalWidth + '% → ' + Math.round(REFERENCE_APP_WIDTH_PX * ((pForm.ModalWidth || 45) / 100)) + 'px (FE-8)'));
        card.appendChild(cardHeader);

        const body = El('div', 'app-form-card-body');
        for (const section of pForm.Sections || [])
            body.appendChild(RenderSectionPanel(section, pForm.ID));
        if (!pForm.Sections || pForm.Sections.length === 0) {
            const ghost = El('div', 'app-section-ghost-row');
            ghost.appendChild(GhostAdd('Seção', () => Post('AddFormSection', { ParentID: pForm.ID, TitleKey: '' }), 'plus'));
            body.appendChild(ghost);
        }
        card.appendChild(body);

        return card;
    }

    // ------------------------------------------------------------------------------------
    // Issues
    // ------------------------------------------------------------------------------------

    function RenderIssues() {
        if (currentIssues.length === 0) return null;
        const wrap = El('div', 'app-issues');
        wrap.appendChild(El('div', 'app-issues-title', 'Problemas (' + currentIssues.length + ')'));
        for (const issue of currentIssues) {
            const row = El('div', 'app-issue app-issue-' + (issue.Severity === 2 ? 'error' : 'warning'), issue.Message);
            if (issue.ElementID) row.addEventListener('click', () => SelectElement(issue.ElementID));
            wrap.appendChild(row);
        }
        return wrap;
    }

    // ------------------------------------------------------------------------------------
    // Render principal
    // ------------------------------------------------------------------------------------

    function Render() {
        root.innerHTML = '';

        if (!currentModel || !currentModel.Application) {
            const empty = El('div', 'app-empty');
            empty.appendChild(El('div', '', 'Nenhuma App carregada.'));
            const btn = El('button', 'app-real-btn app-btn-primary app-create-btn');
            btn.appendChild(IconEl('plus'));
            btn.appendChild(El('span', '', 'Criar App'));
            btn.addEventListener('click', () => Post('CreateApplication', { Name: 'NewApp' }));
            empty.appendChild(btn);
            root.appendChild(empty);
            return;
        }

        const app = currentModel.Application;

        const shell = El('div', 'app-shell');

        const header = El('div', 'app-shell-header');
        Selectable(header, app.ID);
        const titleBlock = El('div', 'app-shell-title-block');
        titleBlock.appendChild(IconEl(app.Icon));
        const texts = El('div');
        texts.appendChild(El('div', 'app-shell-title', app.TitleKey || app.Name || '(sem título)'));
        texts.appendChild(El('div', 'app-shell-subtitle', app.Name + (app.Route ? '  ·  ' + app.Route : '')));
        titleBlock.appendChild(texts);
        header.appendChild(titleBlock);

        const headerActions = El('div', 'app-shell-header-actions');
        const saveBtn = El('button', 'app-real-btn app-btn-primary');
        saveBtn.appendChild(IconEl('check'));
        saveBtn.appendChild(El('span', '', 'Salvar'));
        saveBtn.addEventListener('click', (e) => { e.stopPropagation(); Post('SaveModel'); });
        headerActions.appendChild(saveBtn);

        const delBtn = El('button', 'app-real-btn app-btn-danger');
        delBtn.appendChild(IconEl('trash-2'));
        delBtn.appendChild(El('span', '', 'Excluir selecionado'));
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); if (selectedID && selectedID !== app.ID) Post('DeleteSelected'); });
        headerActions.appendChild(delBtn);
        header.appendChild(headerActions);

        shell.appendChild(header);
        shell.appendChild(RenderToolbar(app));
        shell.appendChild(RenderGridPreview(app));

        shell.appendChild(RenderChipsStrip('Ações de linha', app.RowActions || [], a => a.TitleKey || a.Name || '(sem título)',
            () => Post('AddRowAction', { TitleKey: '' })));

        shell.appendChild(RenderViewersStrip(app.Viewers || []));

        const formArea = El('div', 'app-form-area');
        if (app.FormView) {
            formArea.appendChild(RenderSimpleFormCard(app, app.FormView));
        }
        else if (app.TabbedFormView) {
            formArea.appendChild(RenderTabbedFormCard(app, app.TabbedFormView));
        }
        else {
            const empty = El('div', 'app-empty-inline');
            empty.appendChild(El('div', '', 'Formulário: nenhum ainda.'));
            const actions = El('div', 'app-empty-inline-actions');
            const simpleBtn = El('button', 'app-real-btn app-btn-secondary', '+ Simples');
            simpleBtn.addEventListener('click', () => Post('SetFormView'));
            const tabbedBtn = El('button', 'app-real-btn app-btn-secondary', '+ Com abas');
            tabbedBtn.addEventListener('click', () => Post('SetTabbedFormView'));
            actions.appendChild(simpleBtn);
            actions.appendChild(tabbedBtn);
            empty.appendChild(actions);
            formArea.appendChild(empty);
        }
        shell.appendChild(formArea);

        const issuesNode = RenderIssues();
        if (issuesNode) shell.appendChild(issuesNode);

        root.appendChild(shell);

        HighlightSelection();
    }

    // Edição de propriedades acontece no painel Dase.Properties (compartilhado com o ORM
    // Designer) — não há inspetor embutido neste webview. Ver
    // Views/CompositeDesignerProvider.ts e AppBridge.GetProperties/UpdateProperty.

    window.addEventListener('message', (pEvent) => {
        const msg = pEvent.data;
        switch (msg.Type) {
            case 'LoadModel':
                currentModel = msg.Payload;
                Render();
                break;
            case 'IssuesChanged':
                currentIssues = (msg.Payload && msg.Payload.Issues) || [];
                Render();
                break;
            default:
                break;
        }
    });

    Post('DesignerReady');
})();
