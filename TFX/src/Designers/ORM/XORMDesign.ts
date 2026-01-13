import { XDesign, XRouteOptions } from "../../Design/XDesign.js";
import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XProperty } from "../../Core/XProperty.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";

/** Lado de conexão da tabela */
enum XConnectionSide { Left, Right, Top, Bottom }

export interface XICreateTableOptions
{
    X?: number;
    Y?: number;
    Width?: number;
    Height?: number;
    Name?: string;
}

export interface XICreateReferenceOptions
{
    SourceFieldID: string;
    TargetTableID: string;
    Name?: string;
}

/**
 * XORMDesign - Designer de modelos ORM
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * REGRAS DE ROTEAMENTO DE LINHAS (REFERÊNCIAS)
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. SOURCE (Campo FK):
 *    - SEMPRE sai HORIZONTALMENTE (esquerda ou direita)
 *    - Alinhado verticalmente com o campo FK na tabela source
 *    - Lado de saída determinado pela posição relativa do target
 *    - DEVE ter segmento mínimo horizontal (minSegment = 30px)
 * 
 * 2. TARGET (Tabela referenciada):
 *    - Pode receber de QUALQUER lado: Left, Right, Top, Bottom
 *    - Ponto de entrada NÃO é fixo no centro - é distribuído para evitar
 *      congestionamento quando múltiplas linhas apontam para a mesma tabela
 *    - DEVE ter segmento mínimo antes da entrada (minSegment = 30px)
 * 
 * 3. SEGMENTOS:
 *    - NUNCA diagonal - sempre vertical OU horizontal
 *    - Segmento inicial (source): mínimo 30px horizontal
 *    - Segmento final (target): mínimo 30px na direção de entrada
 *    - Gap mínimo de 20px das tabelas
 * 
 * 4. TIPOS DE ROTA:
 *    - ROTA EM L: Tabelas lado a lado (source sai lateral, target recebe lateral)
 *    - ROTA EM C: Tabelas verticalmente alinhadas (contorna por fora)
 *    - ROTA VERTICAL: Source acima/abaixo do target (entra por Top/Bottom)
 * 
 * 5. ANTI-CONGESTIONAMENTO:
 *    - Múltiplas conexões no mesmo lado são distribuídas com espaçamento de 15px
 *    - Primeira conexão: centro do lado
 *    - Conexões subsequentes: alternam acima/abaixo ou esquerda/direita
 * 
 * 6. COLISÃO:
 *    - Linhas devem evitar passar por dentro de outras tabelas
 *    - Quando há colisão, calcula rota alternativa desviando do obstáculo
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */
export class XORMDesign extends XDesign
{
    public static readonly SchemaProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.Schema,
        "00000001-0002-0001-0001-000000000002",
        "Schema",
        "Database Schema",
        "dbo"
    );

    private _TablesWithListeners: Set<string> = new Set<string>();

    public constructor()
    {
        super();
    }

    public get Schema(): string
    {
        return this.GetValue(XORMDesign.SchemaProp) as string;
    }

    public set Schema(pValue: string)
    {
        this.SetValue(XORMDesign.SchemaProp, pValue);
    }

    public override Initialize(): void
    {
        super.Initialize();
        console.log(`[XORMDesign.Initialize] Called, setting up listeners...`);
        this.SetupTableListeners();
        // NOTE: RouteAllLines is called externally after full document load
        // to ensure all parent/child relationships are established
    }

    private SetupTableListeners(): void
    {
        console.log(`[XORMDesign.SetupTableListeners] Setting up listeners`);

        // Adiciona listeners para todas as tabelas existentes que ainda não têm
        const tables = this.GetTables();
        console.log(`[XORMDesign.SetupTableListeners] Found ${tables.length} tables, already listening to ${this._TablesWithListeners.size}`);
        
        for (const table of tables)
        {
            if (this._TablesWithListeners.has(table.ID))
            {
                console.log(`[XORMDesign.SetupTableListeners] Table "${table.Name}" already has listener, skipping`);
                continue;
            }

            console.log(`[XORMDesign.SetupTableListeners] Adding listener to table "${table.Name}"`);
            this._TablesWithListeners.add(table.ID);
            
            table.OnPropertyChanged.Add((pSender, pProperty, _pValue) =>
            {
                if (pProperty.Name === "Bounds")
                {
                    console.log(`[XORMDesign] Table "${(pSender as XORMTable).Name}" Bounds changed, re-routing...`);
                    this.RouteAllLines();
                }
            });
        }
        
        console.log(`[XORMDesign.SetupTableListeners] Completed. Now listening to ${this._TablesWithListeners.size} tables`);
    }

    public CreateTable(pOptions?: XICreateTableOptions): XORMTable
    {
        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = pOptions?.Name ?? this.GenerateTableName();
        table.Bounds = new XRect(
            pOptions?.X ?? 0,
            pOptions?.Y ?? 0,
            pOptions?.Width ?? 200,
            pOptions?.Height ?? 150
        );

        // Adiciona listener para re-rotear quando Bounds mudar
        this._TablesWithListeners.add(table.ID);
        table.OnPropertyChanged.Add((pSender, pProperty, _pValue) =>
        {
            if (pProperty.Name === "Bounds")
            {
                console.log(`[XORMDesign] Table Bounds changed, re-routing...`);
                this.RouteAllLines();
            }
        });

        this.AppendChild(table);
        return table;
    }

    public CreateReference(pOptions: XICreateReferenceOptions): XORMReference
    {
        const sourceField = this.FindFieldByID(pOptions.SourceFieldID);
        const targetTable = this.FindTableByID(pOptions.TargetTableID);

        if (sourceField === null)
            throw new Error("Source field not found.");

        if (targetTable === null)
            throw new Error("Target table not found.");

        const sourceTable = sourceField.ParentNode as XORMTable;
        if (!(sourceTable instanceof XORMTable))
            throw new Error("Source field has no parent table.");

        const reference = new XORMReference();
        reference.ID = XGuid.NewValue();
        reference.Name = pOptions.Name ?? this.GenerateReferenceName(sourceField, targetTable);
        reference.Source = sourceField.ID;
        reference.Target = targetTable.ID;

        const srcBounds = sourceTable.Bounds;
        const tgtBounds = targetTable.Bounds;
        reference.Points = [
            new XPoint(srcBounds.Left + srcBounds.Width, srcBounds.Top + srcBounds.Height / 2),
            new XPoint(tgtBounds.Left, tgtBounds.Top + tgtBounds.Height / 2)
        ];

        this.AppendChild(reference);
        return reference;
    }

    public DeleteTable(pTable: XORMTable): boolean
    {
        if (pTable.ParentNode !== this)
            return false;

        if (!pTable.CanDelete)
            return false;

        this.RemoveReferencesForTable(pTable.ID);
        return this.RemoveChild(pTable);
    }

    public DeleteReference(pReference: XORMReference): boolean
    {
        if (pReference.ParentNode !== this)
            return false;

        if (!pReference.CanDelete)
            return false;

        return this.RemoveChild(pReference);
    }

    public GetTables(): XORMTable[]
    {
        return this.GetChildrenOfType(XORMTable);
    }

    public GetReferences(): XORMReference[]
    {
        return this.GetChildrenOfType(XORMReference);
    }

    public FindTableByID(pID: string): XORMTable | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMTable && child.ID === pID)
                return child;
        }
        return null;
    }

    public FindReferenceByID(pID: string): XORMReference | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMReference && child.ID === pID)
                return child;
        }
        return null;
    }

    public FindReferenceBySourceFieldID(pFieldID: string): XORMReference | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMReference && child.Source === pFieldID)
                return child;
        }
        return null;
    }

    public FindFieldByID(pID: string): XORMField | null
    {
        console.log(`[FindFieldByID] Looking for field ID: "${pID}"`);
        const tables = this.GetTables();
        console.log(`[FindFieldByID] Tables count: ${tables.length}`);
        
        for (const table of tables)
        {
            const fields = table.GetFields();
            console.log(`[FindFieldByID] Table "${table.Name}" has ${fields.length} fields`);
            
            const field = table.FindFieldByID(pID);
            if (field !== null)
            {
                console.log(`[FindFieldByID] FOUND field "${field.Name}" in table "${table.Name}"`);
                return field;
            }
        }
        console.log(`[FindFieldByID] NOT FOUND`);
        return null;
    }

    private RemoveReferencesForTable(pTableID: string): void
    {
        const references = this.GetReferences();
        for (const ref of references)
        {
            const sourceField = this.FindFieldByID(ref.Source);
            const sourceTableID = sourceField?.ParentNode instanceof XORMTable ? sourceField.ParentNode.ID : null;
            if (sourceTableID === pTableID || ref.Target === pTableID)
                this.RemoveChild(ref);
        }
    }

    private GenerateTableName(): string
    {
        const tables = this.GetTables();
        let idx = tables.length + 1;
        let name = `Table${idx}`;

        while (tables.some(t => t.Name.toLowerCase() === name.toLowerCase()))
        {
            idx++;
            name = `Table${idx}`;
        }

        return name;
    }

    private GenerateReferenceName(pSourceField: XORMField, pTargetTable: XORMTable): string
    {
        const sourceTable = pSourceField.ParentNode as XORMTable;
        return `FK_${sourceTable.Name}_${pTargetTable.Name}`;
    }

    /**
     * Roteia todas as referências do design ORM
     * Regras:
     * 1. Source sai APENAS horizontal (esquerda/direita) alinhado com o campo FK
     * 2. Target pode receber de qualquer lado (esquerda/direita/topo/fundo)
     * 3. Evita colisão com outras tabelas
     * 4. Múltiplos segmentos ortogonais quando necessário
     * 5. NUNCA diagonal - sempre vertical ou horizontal
     * 6. Distribui pontos de conexão para evitar congestionamento
     * 
     * @param pOptions - Opções de roteamento (ignoradas nesta implementação ORM)
     */
    public override RouteAllLines(pOptions?: XRouteOptions): void
    {
        const references = this.GetReferences();
        const tables = this.GetTables();
        console.log(`[XORMDesign.RouteAllLines] Starting. References: ${references.length}, Tables: ${tables.length}`);

        // Garante que listeners estão configurados (importante após load)
        this.SetupTableListeners();

        // Contabiliza quantas conexões cada tabela recebe em cada lado
        const connectionCounts = new Map<string, { Left: number; Right: number; Top: number; Bottom: number }>();
        
        // Inicializa contadores para cada tabela
        for (const table of tables)
        {
            connectionCounts.set(table.ID, { Left: 0, Right: 0, Top: 0, Bottom: 0 });
        }

        for (const ref of references)
        {
            console.log(`[XORMDesign.RouteAllLines] Routing reference ${ref.ID}, Source: ${ref.Source}, Target: ${ref.Target}`);
            this.RouteReference(ref, tables, connectionCounts);
        }
        console.log('[XORMDesign.RouteAllLines] Completed');
    }

    /**
     * Roteia uma referência específica com algoritmo ortogonal
     */
    private RouteReference(
        pRef: XORMReference, 
        pTables: XORMTable[],
        pConnectionCounts: Map<string, { Left: number; Right: number; Top: number; Bottom: number }>
    ): void
    {
        console.log(`[RouteReference] Ref ID: ${pRef.ID}, Source: "${pRef.Source}", Target: "${pRef.Target}"`);
        
        // Tenta usar GetLinkedElement primeiro (funciona quando Document está setado)
        let sourceField = pRef.GetSourceElement<XORMField>();
        let targetTable = pRef.GetTargetElement<XORMTable>();

        // Fallback para FindFieldByID se GetLinkedElement falhar (ex: testes sem Document)
        if (!sourceField && pRef.Source)
            sourceField = this.FindFieldByID(pRef.Source);
        
        if (!targetTable && pRef.Target)
            targetTable = this.FindTableByID(pRef.Target);

        console.log(`[RouteReference] sourceField found: ${sourceField !== null}, targetTable found: ${targetTable !== null}`);
        
        if (!sourceField || !targetTable)
        {
            console.log(`[RouteReference] ABORT: sourceField=${sourceField}, targetTable=${targetTable}`);
            return;
        }

        const sourceTable = sourceField.ParentNode as XORMTable;
        if (!(sourceTable instanceof XORMTable))
        {
            console.log(`[RouteReference] ABORT: sourceTable is not XORMTable`);
            return;
        }

        // Calcula Y do campo source dentro da tabela
        const fieldIndex = sourceTable.GetFields().findIndex(f => f.ID === sourceField.ID);
        if (fieldIndex < 0)
            return;

        const headerHeight = 30;
        const fieldHeight = 20;
        const fieldY = sourceTable.Bounds.Top + headerHeight + (fieldIndex * fieldHeight) + (fieldHeight / 2);

        // Coleta obstáculos (todas as tabelas exceto source e target)
        const obstacles = pTables
            .filter(t => t.ID !== sourceTable.ID && t.ID !== targetTable.ID)
            .map(t => t.Bounds);

        // Calcula rota ortogonal evitando colisões
        console.log(`[RouteReference] Source table at [${sourceTable.Bounds.Left},${sourceTable.Bounds.Top}], Target at [${targetTable.Bounds.Left},${targetTable.Bounds.Top}]`);
        console.log(`[RouteReference] Field Y: ${fieldY}`);
        
        const points = this.CalculateOrthogonalRoute(
            sourceTable.Bounds,
            targetTable.Bounds,
            fieldY,
            obstacles,
            pConnectionCounts.get(targetTable.ID) || { Left: 0, Right: 0, Top: 0, Bottom: 0 }
        );
        
        console.log(`[RouteReference] Calculated ${points.length} points:`);
        points.forEach((p, i) => console.log(`  Point ${i}: [${p.X}, ${p.Y}]`));

        console.log(`[RouteReference] BEFORE assignment - pRef.Points = ${JSON.stringify(pRef.Points)}`);
        pRef.Points = points;
        console.log(`[RouteReference] AFTER assignment - pRef.Points = ${JSON.stringify(pRef.Points)}`);
        console.log(`[RouteReference] Assigned points to reference. Points array length: ${pRef.Points?.length}`);
    }

    /**
     * Calcula rota ortogonal entre source e target evitando obstáculos
     * REGRAS FUNDAMENTAIS:
     * 1. Source SEMPRE sai pela lateral (esquerda ou direita), alinhado com o campo
     * 2. Target pode receber de qualquer lado (Left, Right, Top, Bottom) em qualquer ponto
     * 3. Segmento inicial e final devem ter tamanho mínimo (minSegment)
     * 4. Quando tabelas estão verticalmente alinhadas, usa rota em "C"
     * 5. NUNCA diagonal - sempre vertical ou horizontal
     * 6. Pontos de conexão são distribuídos para evitar congestionamento
     */
    private CalculateOrthogonalRoute(
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pFieldY: number,
        pObstacles: XRect[],
        pTargetConnections: { Left: number; Right: number; Top: number; Bottom: number }
    ): XPoint[]
    {
        const gap = 20; // Espaçamento mínimo das tabelas
        const minSegment = 30; // Tamanho mínimo do segmento inicial/final
        const connectionSpacing = 15; // Espaçamento entre conexões no mesmo lado
        const points: XPoint[] = [];

        // Determina lado de saída do source baseado na posição relativa
        const sourceExitsRight = this.DetermineSourceExitSide(pSourceBounds, pTargetBounds);

        // Ponto de saída do source (horizontal, alinhado com o campo)
        const startX = sourceExitsRight ? pSourceBounds.Right : pSourceBounds.Left;
        const startY = pFieldY;
        points.push(new XPoint(startX, startY));

        // Determina melhor lado de entrada no target
        const targetSide = this.DetermineBestTargetSide(
            pSourceBounds, pTargetBounds, startX, startY, sourceExitsRight
        );

        console.log(`[CalculateOrthogonalRoute] Source exits ${sourceExitsRight ? 'RIGHT' : 'LEFT'}, Target side: ${XConnectionSide[targetSide]}`);
        console.log(`[CalculateOrthogonalRoute] Source bounds: [${pSourceBounds.Left},${pSourceBounds.Top},${pSourceBounds.Width}x${pSourceBounds.Height}]`);
        console.log(`[CalculateOrthogonalRoute] Target bounds: [${pTargetBounds.Left},${pTargetBounds.Top},${pTargetBounds.Width}x${pTargetBounds.Height}]`);

        // Incrementa o contador de conexões para este lado
        pTargetConnections[targetSide === XConnectionSide.Left ? 'Left' :
                          targetSide === XConnectionSide.Right ? 'Right' :
                          targetSide === XConnectionSide.Top ? 'Top' : 'Bottom']++;
        
        // Obtém o índice da conexão atual (1-based, após incrementar)
        const connectionIndex = pTargetConnections[
            targetSide === XConnectionSide.Left ? 'Left' :
            targetSide === XConnectionSide.Right ? 'Right' :
            targetSide === XConnectionSide.Top ? 'Top' : 'Bottom'
        ];

        // Calcula ponto de entrada no target com offset para evitar congestionamento
        const targetEntry = this.GetTargetEntryPoint(pTargetBounds, targetSide, connectionIndex, connectionSpacing);
        console.log(`[CalculateOrthogonalRoute] Target entry point: [${targetEntry.X},${targetEntry.Y}], connection index: ${connectionIndex}`);

        // Calcula rota ortogonal
        const routePoints = this.BuildOrthogonalPath(
            new XPoint(startX, startY),
            targetEntry,
            sourceExitsRight,
            targetSide,
            pSourceBounds,
            pTargetBounds,
            pObstacles,
            gap,
            minSegment
        );

        console.log(`[CalculateOrthogonalRoute] Route points (${routePoints.length}):`);
        routePoints.forEach((p, i) => console.log(`  [${i}]: [${p.X}, ${p.Y}]`));

        points.push(...routePoints);
        return this.OptimizeRoute(points);
    }

    /**
     * Determina se o source deve sair pela direita ou esquerda
     * Considera posição horizontal e se há sobreposição vertical
     */
    private DetermineSourceExitSide(pSourceBounds: XRect, pTargetBounds: XRect): boolean
    {
        const sourceCenterX = pSourceBounds.Left + pSourceBounds.Width / 2;
        const targetCenterX = pTargetBounds.Left + pTargetBounds.Width / 2;
        
        // Verifica se há sobreposição horizontal (tabelas alinhadas verticalmente)
        const sourceRight = pSourceBounds.Right;
        const sourceLeft = pSourceBounds.Left;
        const targetRight = pTargetBounds.Right;
        const targetLeft = pTargetBounds.Left;
        
        const hasHorizontalOverlap = sourceLeft < targetRight && sourceRight > targetLeft;
        
        if (hasHorizontalOverlap)
        {
            // Tabelas alinhadas verticalmente - escolhe lado com mais espaço
            const spaceRight = Math.max(sourceRight, targetRight);
            const spaceLeft = Math.min(sourceLeft, targetLeft);
            // Prefere direita se há mais espaço ou igual
            return (spaceRight - sourceCenterX) >= (sourceCenterX - spaceLeft);
        }
        
        // Caso normal: sai pelo lado mais próximo do target
        return sourceCenterX < targetCenterX;
    }

    /**
     * Determina o melhor lado da tabela target para conexão
     * REGRA: Target pode receber de qualquer lado, mas deve formar rota limpa
     */
    private DetermineBestTargetSide(
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pStartX: number,
        pStartY: number,
        pSourceExitsRight: boolean
    ): XConnectionSide
    {
        const targetCenterY = pTargetBounds.Top + pTargetBounds.Height / 2;
        const targetTop = pTargetBounds.Top;
        const targetBottom = pTargetBounds.Bottom;
        
        // Verifica se há sobreposição horizontal (tabelas verticalmente alinhadas)
        const hasHorizontalOverlap = pSourceBounds.Left < pTargetBounds.Right && 
                                      pSourceBounds.Right > pTargetBounds.Left;
        
        if (hasHorizontalOverlap)
        {
            // Tabelas alinhadas verticalmente - entra por cima ou por baixo
            if (pStartY < targetCenterY)
                return XConnectionSide.Top; // Source está acima - entra por cima
            else
                return XConnectionSide.Bottom; // Source está abaixo - entra por baixo
        }
        
        // Tabelas lado a lado - preferência: lado mais próximo do source
        if (pSourceExitsRight)
        {
            // Source sai pela direita - target preferencialmente recebe pela esquerda
            return XConnectionSide.Left;
        }
        else
        {
            // Source sai pela esquerda - target preferencialmente recebe pela direita
            return XConnectionSide.Right;
        }
    }

    /**
     * Obtém o ponto de entrada na tabela target baseado no lado
     * O ponto é distribuído para evitar congestionamento quando há múltiplas conexões
     * @param pTargetBounds - Bounds da tabela target
     * @param pSide - Lado de entrada
     * @param pConnectionIndex - Índice da conexão (1-based)
     * @param pSpacing - Espaçamento entre conexões
     */
    private GetTargetEntryPoint(
        pTargetBounds: XRect, 
        pSide: XConnectionSide,
        pConnectionIndex: number,
        pSpacing: number
    ): XPoint
    {
        // Calcula offset baseado no índice da conexão
        // Para a primeira conexão (index 1), usa o centro
        // Para conexões subsequentes, alterna para cima/baixo ou esquerda/direita
        const offset = pConnectionIndex === 1 ? 0 : 
                       (pConnectionIndex % 2 === 0 ? -1 : 1) * Math.ceil(pConnectionIndex / 2) * pSpacing;
        
        const centerX = pTargetBounds.Left + pTargetBounds.Width / 2;
        const centerY = pTargetBounds.Top + pTargetBounds.Height / 2;
        
        // Limita o offset para não sair dos bounds
        const maxOffsetX = (pTargetBounds.Width / 2) - 10;
        const maxOffsetY = (pTargetBounds.Height / 2) - 10;
        const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offset));
        const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offset));

        switch (pSide)
        {
            case XConnectionSide.Left:
                // Entra pela esquerda - varia Y
                return new XPoint(pTargetBounds.Left, centerY + clampedOffsetY);
            case XConnectionSide.Right:
                // Entra pela direita - varia Y
                return new XPoint(pTargetBounds.Right, centerY + clampedOffsetY);
            case XConnectionSide.Top:
                // Entra por cima - varia X
                return new XPoint(centerX + clampedOffsetX, pTargetBounds.Top);
            case XConnectionSide.Bottom:
                // Entra por baixo - varia X
                return new XPoint(centerX + clampedOffsetX, pTargetBounds.Bottom);
        }
    }

    /**
     * Constrói caminho ortogonal com segmentos mínimos garantidos
     * REGRA CRÍTICA: Nunca diagonal - sempre segmentos verticais ou horizontais
     */
    private BuildOrthogonalPath(
        pStart: XPoint,
        pEnd: XPoint,
        pSourceExitsRight: boolean,
        pTargetSide: XConnectionSide,
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pObstacles: XRect[],
        pGap: number,
        pMinSegment: number
    ): XPoint[]
    {
        const points: XPoint[] = [];

        // Calcula X do primeiro segmento horizontal (com tamanho mínimo)
        const firstSegmentX = pSourceExitsRight 
            ? Math.max(pStart.X + pMinSegment, pSourceBounds.Right + pMinSegment)
            : Math.min(pStart.X - pMinSegment, pSourceBounds.Left - pMinSegment);

        // Verifica se é rota em C (source e target no mesmo lado - tabelas verticalmente alinhadas)
        const isCRoute = (pSourceExitsRight && pTargetSide === XConnectionSide.Right) ||
                        (!pSourceExitsRight && pTargetSide === XConnectionSide.Left);

        if (isCRoute)
        {
            // Rota em C - contorna por fora (usado quando tabelas estão verticalmente alinhadas)
            const outerX = pSourceExitsRight
                ? Math.max(pSourceBounds.Right, pTargetBounds.Right) + pMinSegment + pGap
                : Math.min(pSourceBounds.Left, pTargetBounds.Left) - pMinSegment - pGap;
            
            // Primeiro segmento horizontal
            points.push(new XPoint(outerX, pStart.Y));
            
            // Segmento vertical até altura do target center
            points.push(new XPoint(outerX, pEnd.Y));
            
            // Ponto final
            points.push(pEnd);
            return points;
        }

        // Conexão para lateral (Left ou Right) - caso mais comum
        if (pTargetSide === XConnectionSide.Left || pTargetSide === XConnectionSide.Right)
        {
            // Rota em L: horizontal -> vertical -> horizontal (se necessário)
            // Garantir segmento mínimo na saída do source e na entrada do target
            
            // Calcula X intermediário garantindo segmento mínimo
            const targetApproachX = pTargetSide === XConnectionSide.Left
                ? pTargetBounds.Left - pMinSegment
                : pTargetBounds.Right + pMinSegment;
            
            // O midX deve estar entre o firstSegmentX e o targetApproachX
            // Isso garante segmento mínimo em ambos os lados
            let midX: number;
            
            if (pSourceExitsRight)
            {
                // Source sai pela direita, target recebe pela esquerda
                // midX deve ser >= firstSegmentX e <= targetApproachX
                midX = Math.max(firstSegmentX, Math.min(targetApproachX, (firstSegmentX + targetApproachX) / 2));
            }
            else
            {
                // Source sai pela esquerda, target recebe pela direita
                // midX deve ser <= firstSegmentX e >= targetApproachX
                midX = Math.min(firstSegmentX, Math.max(targetApproachX, (firstSegmentX + targetApproachX) / 2));
            }
            
            // Verifica se há colisão no caminho
            const hasCollision = this.CheckLRouteCollision(
                pStart.X, pStart.Y,
                midX, pEnd.Y,
                pSourceBounds, pTargetBounds, pObstacles
            );
            
            // Se há colisão, calcula um midX alternativo
            if (hasCollision)
            {
                midX = this.CalculateMidX(
                    firstSegmentX, pStart.Y,
                    targetApproachX, pEnd.Y,
                    pSourceExitsRight,
                    pSourceBounds, pTargetBounds, pObstacles, pGap, pMinSegment
                );
            }

            // Primeiro segmento horizontal (garante tamanho mínimo)
            points.push(new XPoint(midX, pStart.Y));

            // Segmento vertical
            if (Math.abs(pStart.Y - pEnd.Y) > 1)
                points.push(new XPoint(midX, pEnd.Y));

            // Ponto final
            points.push(pEnd);
        }
        else
        {
            // Target entry é Top ou Bottom - rota em C (forma de U deitado)
            // REGRA: Source sai horizontal, linha sobe/desce, entra vertical no target
            // Sempre usa 4 segmentos para manter organização visual:
            // 1. Horizontal (sai do source com segmento mínimo)
            // 2. Vertical (sobe ou desce até altura de approach)
            // 3. Horizontal (vai até alinhar com X do target entry)
            // 4. Vertical (entra no target com segmento mínimo)
            
            // Calcula Y de approach (distância mínima do target)
            const approachY = pTargetSide === XConnectionSide.Top
                ? pTargetBounds.Top - pMinSegment
                : pTargetBounds.Bottom + pMinSegment;
            
            // Ponto 1: Segmento horizontal mínimo saindo do source
            points.push(new XPoint(firstSegmentX, pStart.Y));
            
            // Ponto 2: Segmento vertical até altura de approach
            // Escolhe ir para o approach Y ou ficar no mesmo Y se já está perto
            const intermediateY = this.CalculateIntermediateY(
                pStart.Y, approachY, pTargetBounds, pSourceBounds, pGap
            );
            
            if (Math.abs(pStart.Y - intermediateY) > 1)
                points.push(new XPoint(firstSegmentX, intermediateY));
            
            // Ponto 3: Segmento horizontal até alinhar com X do target entry
            if (Math.abs(firstSegmentX - pEnd.X) > 1)
                points.push(new XPoint(pEnd.X, intermediateY));
            
            // Ponto 4: Segmento vertical de approach até target entry
            if (Math.abs(intermediateY - approachY) > 1)
                points.push(new XPoint(pEnd.X, approachY));

            // Ponto final
            points.push(pEnd);
        }

        return points;
    }

    /**
     * Calcula Y intermediário para rota em C
     * Garante que a linha não cruze o source ou target
     */
    private CalculateIntermediateY(
        pStartY: number,
        pApproachY: number,
        pTargetBounds: XRect,
        pSourceBounds: XRect,
        pGap: number
    ): number
    {
        // Se approach está na mesma direção que o target, usa approach
        // Caso contrário, precisa ir além para evitar cruzar tabelas
        
        // Verifica se fonte está acima ou abaixo do target
        const sourceBelow = pStartY > pTargetBounds.Bottom;
        const sourceAbove = pStartY < pTargetBounds.Top;
        
        if (sourceBelow)
        {
            // Source está abaixo - approach deve estar abaixo do target
            return Math.max(pApproachY, pTargetBounds.Bottom + pGap);
        }
        
        if (sourceAbove)
        {
            // Source está acima - approach deve estar acima do target
            return Math.min(pApproachY, pTargetBounds.Top - pGap);
        }
        
        // Source está ao lado (mesma faixa vertical) - usa approach calculado
        return pApproachY;
    }

    /**
     * Verifica se uma rota em L (horizontal depois vertical) colide com obstáculos
     * @returns true se há colisão
     */
    private CheckLRouteCollision(
        pStartX: number,
        pStartY: number,
        pEndX: number,
        pEndY: number,
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pObstacles: XRect[]
    ): boolean
    {
        // Define o ponto de virada da rota em L
        const turnX = pEndX;
        const turnY = pStartY;

        // Verifica colisão no segmento horizontal (start -> turn)
        const minX = Math.min(pStartX, turnX);
        const maxX = Math.max(pStartX, turnX);
        
        for (const obs of pObstacles)
        {
            // Ignora source e target
            if (obs === pSourceBounds || obs === pTargetBounds)
                continue;
                
            // Verifica se o segmento horizontal cruza o obstáculo
            if (pStartY >= obs.Top && pStartY <= obs.Bottom)
            {
                if (!(maxX < obs.Left || minX > obs.Right))
                    return true; // Colisão no segmento horizontal
            }
        }

        // Verifica colisão no segmento vertical (turn -> end)
        const minY = Math.min(turnY, pEndY);
        const maxY = Math.max(turnY, pEndY);
        
        for (const obs of pObstacles)
        {
            // Ignora source e target
            if (obs === pSourceBounds || obs === pTargetBounds)
                continue;
                
            // Verifica se o segmento vertical cruza o obstáculo
            if (turnX >= obs.Left && turnX <= obs.Right)
            {
                if (!(maxY < obs.Top || minY > obs.Bottom))
                    return true; // Colisão no segmento vertical
            }
        }

        return false; // Sem colisão
    }

    /**
     * Calcula o X intermediário para a rota respeitando segmentos mínimos
     */
    private CalculateMidX(
        pStartX: number,
        pStartY: number,
        pEndX: number,
        pEndY: number,
        pSourceExitsRight: boolean,
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pObstacles: XRect[],
        pGap: number,
        pMinSegment: number
    ): number
    {
        // Ponto médio ideal
        const directMidX = (pStartX + pEndX) / 2;
        
        // Verifica se há obstáculo no caminho direto
        const hasObstacle = this.SegmentHasCollision(pStartX, pStartY, pEndX, pEndY, pObstacles);

        if (!hasObstacle)
        {
            // Garante segmento mínimo mesmo sem obstáculo
            if (pSourceExitsRight)
                return Math.max(directMidX, pSourceBounds.Right + pMinSegment);
            return Math.min(directMidX, pSourceBounds.Left - pMinSegment);
        }

        // Precisa contornar - calcula X seguro
        if (pSourceExitsRight)
        {
            const maxRight = Math.max(
                pSourceBounds.Right + pMinSegment,
                ...pObstacles.map(o => o.Right + pGap)
            );
            return Math.max(directMidX, maxRight);
        }

        const minLeft = Math.min(
            pSourceBounds.Left - pMinSegment,
            ...pObstacles.map(o => o.Left - pGap)
        );
        return Math.min(directMidX, minLeft);
    }

    /**
     * Otimiza a rota removendo pontos duplicados consecutivos
     */
    /**
     * Retorna os pontos otimizados (sem operações extras necessárias)
     * BuildOrthogonalPath já garante que não há duplicatas
     */
    private OptimizeRoute(pPoints: XPoint[]): XPoint[]
    {
        return pPoints;
    }

    /**
     * Verifica se um segmento colide com obstáculos
     */
    private SegmentHasCollision(
        pX1: number, pY1: number,
        pX2: number, pY2: number,
        pObstacles: XRect[]
    ): boolean
    {
        const margin = 2;
        
        for (const obs of pObstacles)
        {
            if (this.LineIntersectsRect(pX1, pY1, pX2, pY2, obs, margin))
                return true;
        }
        
        return false;
    }

    /**
     * Verifica se linha intersecta retângulo (usada para detecção de colisão)
     * Nota: Esta função é chamada principalmente com segmentos diagonais para verificar
     * se o caminho direto entre dois pontos cruza um obstáculo
     */
    private LineIntersectsRect(
        pX1: number, pY1: number,
        pX2: number, pY2: number,
        pRect: XRect,
        pMargin: number
    ): boolean
    {
        const left = pRect.Left - pMargin;
        const top = pRect.Top - pMargin;
        const right = pRect.Right + pMargin;
        const bottom = pRect.Bottom + pMargin;

        // Verifica se linha está totalmente fora
        if ((pX1 < left && pX2 < left) || (pX1 > right && pX2 > right))
            return false;
        if ((pY1 < top && pY2 < top) || (pY1 > bottom && pY2 > bottom))
            return false;

        // Linha cruza ou está dentro do retângulo expandido
        return true;
    }
}