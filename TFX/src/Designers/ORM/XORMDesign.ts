import { XDesign, XRouteOptions } from "../../Design/XDesign.js";
import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XProperty } from "../../Core/XProperty.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMStateReference } from "./XORMStateReference.js";
import { XORMField } from "./XORMField.js";
import { XRouterShape, XRouterDirection } from "../../Design/XRouterTypes.js";
import { XRouteContext } from "../../Design/XRouteContext.js";
import { XORMMetrics } from "./XORMMetrics.js";

/**
 * Métricas de qualidade do roteamento — usadas em testes e telemetria.
 */
export interface XIRoutingMetrics
{
    ReferenceCount: number;
    TotalLength: number;
    TotalBends: number;
    Crossings: number;
    /** Pares de segmentos colineares de refs distintas com sobreposição > 2px a menos de 2px de distância. */
    Overlaps: number;
    /** Segmentos que atravessam o interior de alguma tabela. */
    TableCrossings: number;
}

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

export interface XIEnableStateControlResult
{
    Success: boolean;
    Message?: string;
    StateFieldID?: string;
    StateReferenceID?: string;
    /** True if a shadow table was auto-created to represent the cross-model state table. */
    ShadowTableCreated?: boolean;
    ShadowTableID?: string;
}

/**
 * XORMDesign - ORM model designer canvas.
 *
 * Line routing uses the XRouter graph-search algorithm (ported from C# XRouter):
 *   - Source exits horizontally (East or West) aligned with the FK field row.
 *   - Target may be entered from any side (East, West, North, South).
 *   - Obstacles (all other tables) are registered so routes go around them.
 *   - Cooperative routing: a shared XRouteContext holds the global track grid
 *     and an occupancy map of already-routed lines, so the A* penalizes
 *     colinear overlap and crossings instead of stacking lines on one track.
 *   - Three-pass per reference: (1) pinned anchors, (2) relaxed anchors with
 *     obstacles kept, (3) orthogonal L/Z fallback — never a diagonal line.
 *   - A final orthogonal nudging pass spreads residual near-colinear segments
 *     into parallel lanes, validated against table bounds.
 */
export class XORMDesign extends XDesign
{
    public static readonly SchemaProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.Schema,
        "95511660-A5D9-4339-9DE2-62ABD7AB4535",
        "Schema",
        "Database Schema",
        "dbo"
    );

    public static readonly ParentModelProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.ParentModel,
        "C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20",
        "ParentModel",
        "Parent Model",
        ""
    );

    /**
     * Modelos que este importa — os `.dsorm` do repositório de onde ele pode trazer
     * tabelas. Vários caminhos separados por `|`, relativos à **raiz do repositório**,
     * o que permite importar de qualquer módulo, não só da pasta vizinha.
     *
     * Propriedade distinta de `ParentModel`, que responde por outra finalidade.
     */
    public static readonly ImportModelsProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.ImportModels,
        "8B14C6E9-3A57-4D2B-9F60-C4E7A1B85D32",
        "ImportModels",
        "Import Models",
        ""
    );

    public static readonly StateControlTableProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.StateControlTable,
        "3A8B7C2D-1E4F-4D6A-89C5-2D7E1F8A3B4C",
        "StateControlTable",
        "State Control Table",
        ""
    );

    /**
     * Este modelo participa da geração de código. Default TRUE: um modelo novo já gera.
     * Desmarcar é a forma de manter um MER de estudo ou rascunho no repositório sem que
     * ele produza arquivos.
     */
    public static readonly GenerateCodeProp = XProperty.Register<XORMDesign, boolean>(
        (p: XORMDesign) => p.GenerateCode,
        "C1A7E4F2-9B3D-4E68-A5C1-7D2F8B4E93A0",
        "GenerateCode",
        "Generate Code",
        true
    );

    /**
     * Perfil de template a aplicar — o nome da pasta em `.DASE/Templates/`.
     * Vazio significa "todos os perfis encontrados", que é o caso comum de um
     * repositório com uma linguagem só.
     */
    public static readonly CodeTemplateProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.CodeTemplate,
        "D4B8C1E7-2F6A-4B95-8E3D-6A1C9F5B72E4",
        "CodeTemplate",
        "Code Template",
        ""
    );

    /**
     * Namespace/pacote raiz do código gerado a partir deste modelo (`Tootega.SYS`).
     *
     * Mora AQUI, e não nos templates, porque é o que muda de solução para solução —
     * assim a pasta `.DASE/Templates/` é copiável entre repositórios sem edição.
     */
    public static readonly NamespaceProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.Namespace,
        "E9C2A5D8-7B41-4F3E-9A6C-2D8E5B1F4C73",
        "Namespace",
        "Namespace",
        ""
    );

    /** Raiz de saída do código gerado, relativa à PASTA DO PRÓPRIO .dsorm. */
    public static readonly OutputRootProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.OutputRoot,
        "A3F6D9B2-5E8C-4172-B4A9-8C3E7D2F6B15",
        "OutputRoot",
        "Output Root",
        "."
    );

    public static readonly TenantControlTableProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.TenantControlTable,
        "F6E1D9B4-3C2A-4A7E-B8D8-1B4C7E9F2A6D",
        "TenantControlTable",
        "Tenant Control Table",
        ""
    );

    private _TablesWithListeners: Set<string> = new Set<string>();
    private _RoutingSuspendDepth: number = 0;
    private _RoutingDirty: boolean = false;

    public constructor()
    {
        super();
    }

    public SuspendRouting(): void
    {
        this._RoutingSuspendDepth++;
    }

    public ResumeRouting(pRouteIfDirty: boolean = true): void
    {
        if (this._RoutingSuspendDepth > 0)
            this._RoutingSuspendDepth--;
        if (this._RoutingSuspendDepth === 0 && this._RoutingDirty && pRouteIfDirty)
        {
            this._RoutingDirty = false;
            this.RouteAllLines();
        }
    }

    public get IsRoutingSuspended(): boolean
    {
        return this._RoutingSuspendDepth > 0;
    }

    public get Schema(): string
    {
        return this.GetValue(XORMDesign.SchemaProp) as string;
    }

    public set Schema(pValue: string)
    {
        this.SetValue(XORMDesign.SchemaProp, pValue);
    }

    /**
     * Pipe-separated list of relative parent model file names, e.g. "Auth.dsorm|Common.dsorm".
     * An empty string means no parent models are selected.
     */
    public get ParentModel(): string
    {
        return this.GetValue(XORMDesign.ParentModelProp) as string;
    }

    public set ParentModel(pValue: string)
    {
        this.SetValue(XORMDesign.ParentModelProp, pValue);
    }

    /**
     * Modelos importados, separados por `|` e relativos à RAIZ DO REPOSITÓRIO —
     * `"Back/Modules/Tootega.SYS/MER-SYS.dsorm|Back/Modules/Tootega.CRM/MER-CRM.dsorm"`.
     * Vazio significa nenhum.
     */
    public get ImportModels(): string
    {
        return this.GetValue(XORMDesign.ImportModelsProp) as string;
    }

    public set ImportModels(pValue: string)
    {
        this.SetValue(XORMDesign.ImportModelsProp, pValue);
    }

    /** Os modelos importados como lista, já sem entradas vazias. */
    public GetImportedModels(): string[]
    {
        return this.ImportModels.split("|").filter(m => m.length > 0);
    }

    /** Name of the table that controls state (state machine) for this design. */
    public get StateControlTable(): string
    {
        return this.GetValue(XORMDesign.StateControlTableProp) as string;
    }

    public set StateControlTable(pValue: string)
    {
        this.SetValue(XORMDesign.StateControlTableProp, pValue);
    }

    /** Name of the table that controls tenant isolation for this design. */
    public get TenantControlTable(): string
    {
        return this.GetValue(XORMDesign.TenantControlTableProp) as string;
    }

    public set TenantControlTable(pValue: string)
    {
        this.SetValue(XORMDesign.TenantControlTableProp, pValue);
    }

    /** Se este modelo participa da geração de código. Default true. */
    public get GenerateCode(): boolean
    {
        return this.GetValue(XORMDesign.GenerateCodeProp) as boolean;
    }

    public set GenerateCode(pValue: boolean)
    {
        this.SetValue(XORMDesign.GenerateCodeProp, pValue);
    }

    /** Perfil de template (pasta em .DASE/Templates/). Vazio = todos. */
    public get CodeTemplate(): string
    {
        return this.GetValue(XORMDesign.CodeTemplateProp) as string;
    }

    public set CodeTemplate(pValue: string)
    {
        this.SetValue(XORMDesign.CodeTemplateProp, pValue);
    }

    /** Namespace raiz do código gerado a partir deste modelo. */
    public get Namespace(): string
    {
        return this.GetValue(XORMDesign.NamespaceProp) as string;
    }

    public set Namespace(pValue: string)
    {
        this.SetValue(XORMDesign.NamespaceProp, pValue);
    }

    /** Raiz de saída, relativa à pasta do .dsorm. */
    public get OutputRoot(): string
    {
        return this.GetValue(XORMDesign.OutputRootProp) as string;
    }

    public set OutputRoot(pValue: string)
    {
        this.SetValue(XORMDesign.OutputRootProp, pValue);
    }

    public override Initialize(): void
    {
        super.Initialize();
        this.SetupTableListeners();
    }

    private SetupTableListeners(): void
    {
        const tables = this.GetTables();
        for (const table of tables)
            this.AttachTableListener(table);
    }

    private AttachTableListener(pTable: XORMTable): void
    {
        if (this._TablesWithListeners.has(pTable.ID))
            return;

        this._TablesWithListeners.add(pTable.ID);
        pTable.OnPropertyChanged.Add((pSender, pProperty, _pValue) =>
        {
            if (pProperty.Name !== "Bounds")
                return;
            if (this._RoutingSuspendDepth > 0)
            {
                this._RoutingDirty = true;
                return;
            }
            const t = pSender as XORMTable;
            this.RouteReferencesOf(t);
        });
    }

    public RouteReferencesOf(pTable: XORMTable): void
    {
        const refs = this.GetReferences();
        const tables = this.GetTables();
        // Re-distribute anchors for ALL refs (incoming counts may have changed)
        // so the touched table's incoming arrows redistribute, and references
        // that connect to its FK fields keep proper field-row alignment.
        const touching = refs.filter(r => this.ReferenceTouchesTable(r, pTable));
        if (touching.length === 0)
            return;
        const anchors = this.ComputeAnchorDistribution(refs, tables);
        // Incremental context: routes of untouched references are pre-committed
        // to the occupancy map so the moved table's lines avoid them, without
        // ever re-routing lines that do not touch the moved table.
        const context = this.CreateRouteContext(tables);
        for (const ref of refs)
        {
            if (!touching.includes(ref) && ref.Points && ref.Points.length >= 2)
                context.Occupancy.AddPath(ref.Points, ref.ID);
        }
        for (const ref of this.OrderForRouting(touching, anchors))
        {
            this.RouteReference(ref, tables, anchors.get(ref.ID), context);
            if (ref.Points && ref.Points.length >= 2)
                context.Occupancy.AddPath(ref.Points, ref.ID);
        }
    }

    private ReferenceTouchesTable(pRef: XORMReference, pTable: XORMTable): boolean
    {
        if (pRef.Target === pTable.ID)
            return true;
        const srcField = this.FindFieldByID(pRef.Source);
        if (srcField?.ParentNode instanceof XORMTable && srcField.ParentNode.ID === pTable.ID)
            return true;
        if (pRef.Source === pTable.ID)
            return true;
        return false;
    }

    public CreateTable(pOptions?: XICreateTableOptions): XORMTable
    {
        const headerHeight = 28;
        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = pOptions?.Name ?? this.GenerateTableName();
        table.Bounds = new XRect(
            pOptions?.X ?? 0,
            pOptions?.Y ?? 0,
            pOptions?.Width ?? 200,
            pOptions?.Height ?? headerHeight  // Empty table = header height only
        );

        this.AttachTableListener(table);

        this.AppendChild(table);
        return table;
    }

    /**
     * Calculates the visual bounds of a table including dynamically calculated height.
     * Visual height is calculated based on field count, matching the frontend rendering.
     * @param pTable - The table to get visual bounds for
     * @returns XRect with visual bounds (height is calculated, not stored value)
     */
    private GetVisualBounds(pTable: XORMTable): XRect
    {
        return XORMMetrics.GetVisualBounds(pTable);
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

    /**
     * Enables the state-control pattern for the given table.
     *
     * Creates an XORMStateField and XORMStateReference linking the table to the design's
     * StateControlTable. If the state table is not found in the current design a shadow
     * table is automatically created.
     *
     * The operation is idempotent: calling it again when already enabled returns success
     * with the existing field/reference IDs.
     */
    public EnableStateControl(pTable: XORMTable): XIEnableStateControlResult
    {
        if (pTable.ParentNode !== this)
            return { Success: false, Message: "Table does not belong to this design." };

        const stateTableName = this.StateControlTable.trim();
        if (!stateTableName)
            return { Success: false, Message: "StateControlTable is not set on the design." };

        // Idempotency: already enabled and field exists
        const existingField = pTable.GetStateField();
        if (existingField && pTable.UseStateControl)
        {
            const existingRef = this.GetStateReferenceForTable(pTable.ID);
            return {
                Success: true,
                StateFieldID: existingField.ID,
                StateReferenceID: existingRef?.ID
            };
        }

        // Locate or auto-create the state control table
        let targetTable = this.GetTables().find(t => t.Name === stateTableName) ?? null;
        let shadowCreated = false;
        let shadowTableID: string | undefined;

        if (targetTable === null)
        {
            // Not in current design → create a shadow placeholder
            const shadowX = pTable.Bounds.X + pTable.Bounds.Width + 60;
            const shadowY = pTable.Bounds.Y;
            targetTable = this.CreateTable({ Name: stateTableName, X: shadowX, Y: shadowY });
            targetTable.IsShadow = true;
            targetTable.ShadowTableName = stateTableName;
            shadowCreated = true;
            shadowTableID = targetTable.ID;
        }

        // DataType inherits the target table's PKType (always non-empty — default is "Int32")
        const fieldDataType = targetTable.PKType;
        const stateField = pTable.CreateStateField(fieldDataType, `${stateTableName}ID`);

        // Create the invisible XORMStateReference
        const stateRef = new XORMStateReference();
        stateRef.ID = XGuid.NewValue();
        stateRef.Name = `FK_${pTable.Name}_${stateTableName}`;
        stateRef.Source = stateField.ID;
        stateRef.Target = targetTable.ID;
        stateRef.Points = [
            new XPoint(pTable.Bounds.Left + pTable.Bounds.Width, pTable.Bounds.Top + pTable.Bounds.Height / 2),
            new XPoint(targetTable.Bounds.Left, targetTable.Bounds.Top + targetTable.Bounds.Height / 2)
        ];
        this.AppendChild(stateRef);

        pTable.UseStateControl = true;

        return {
            Success: true,
            StateFieldID: stateField.ID,
            StateReferenceID: stateRef.ID,
            ShadowTableCreated: shadowCreated,
            ShadowTableID: shadowTableID
        };
    }

    /**
     * Disables the state-control pattern for the given table.
     *
     * Removes the XORMStateReference and the XORMStateField, then clears UseStateControl.
     * The shadow table (if it was auto-created) is NOT removed automatically.
     *
     * @returns true on success; false if the table does not belong to this design.
     */
    public DisableStateControl(pTable: XORMTable): boolean
    {
        if (pTable.ParentNode !== this)
            return false;

        // Remove the state reference first
        const stateRef = this.GetStateReferenceForTable(pTable.ID);
        if (stateRef)
            this.RemoveChild(stateRef);

        // Remove the state field from the table
        pTable.DeleteStateField();

        pTable.UseStateControl = false;
        return true;
    }

    /** Finds the XORMStateReference whose source field belongs to the given table. */
    private GetStateReferenceForTable(pTableID: string): XORMStateReference | null
    {
        for (const child of this.ChildNodes)
        {
            if (!(child instanceof XORMStateReference))
                continue;
            const sourceField = this.FindFieldByID(child.Source);
            if (sourceField?.ParentNode instanceof XORMTable && sourceField.ParentNode.ID === pTableID)
                return child;
        }
        return null;
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
        for (const table of this.GetTables())
        {
            const field = table.FindFieldByID(pID);
            if (field !== null)
                return field;
        }
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

    /**
     * Remove as referências que saem de um campo. Chamado ao excluir o campo: uma
     * referência é o desenho de uma chave estrangeira, e sem a coluna de origem ela não
     * representa mais nada — ficaria como uma linha solta no diagrama, apontando para o
     * nada e reaparecendo a cada validação.
     *
     * @returns quantas referências foram removidas.
     */
    public RemoveReferencesForField(pFieldID: string): number
    {
        let removidas = 0;

        for (const ref of this.GetReferences())
        {
            if (ref.Source !== pFieldID)
                continue;

            if (this.RemoveChild(ref))
                removidas++;
        }

        return removidas;
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
     * Routes all ORM references using the XRouter graph-search algorithm.
     * Mirrors the C# XDesigner.DoRoute pattern.
     */
    public override RouteAllLines(_pOptions?: XRouteOptions): void
    {
        if (this._RoutingSuspendDepth > 0)
        {
            this._RoutingDirty = true;
            return;
        }
        this.SetupTableListeners();
        const references = this.GetReferences();
        const tables = this.GetTables();
        const context = this.CreateRouteContext(tables);
        const anchors = this.ComputeAnchorDistribution(references, tables);
        // Longest references first: hard routes reserve corridors before the
        // easy ones fill in around them. Deterministic tie-break by ID.
        for (const ref of this.OrderForRouting(references, anchors))
        {
            this.RouteReference(ref, tables, anchors.get(ref.ID), context);
            if (ref.Points && ref.Points.length >= 2)
                context.Occupancy.AddPath(ref.Points, ref.ID);
        }

        this.NudgeSegments(references, context);
        this.EnforceSourceExits(references, anchors);
    }

    /**
     * Post-pass safety net: any reference whose points no longer honour the
     * RF5 source-exit invariant (see HasValidSourceExit) is replaced by the
     * deterministic orthogonal fallback. Guarantees a line can never leave
     * its source table from the top/bottom or through the table body, no
     * matter what the search or the nudging produced.
     */
    private EnforceSourceExits(
        pRefs: XORMReference[],
        pAnchors: Map<string, { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection } | undefined>
    ): void
    {
        for (const ref of pRefs)
        {
            if (!ref.Points || ref.Points.length < 2)
                continue;

            let sourceField = ref.GetSourceElement<XORMField>();
            if (!sourceField && ref.Source)
                sourceField = this.FindFieldByID(ref.Source);
            let sourceTable: XORMTable | null = null;
            let fieldY = NaN;
            if (sourceField)
            {
                if (!(sourceField.ParentNode instanceof XORMTable))
                    continue;
                sourceTable = sourceField.ParentNode;
                const idx = sourceTable.GetFields().findIndex(f => f.ID === sourceField!.ID);
                if (idx >= 0)
                    fieldY = XORMMetrics.GetFieldRowY(sourceTable, idx);
            }
            else
                sourceTable = this.FindTableByID(ref.Source);
            if (!sourceTable)
                continue;

            let targetTable = ref.GetTargetElement<XORMTable>();
            if (!targetTable && ref.Target)
                targetTable = this.FindTableByID(ref.Target);
            if (!targetTable)
                continue;

            const sourceBounds = this.GetVisualBounds(sourceTable);
            if (XORMDesign.HasValidSourceExit(ref.Points, sourceBounds, fieldY))
                continue;
            ref.Points = this.OrthogonalFallbackRoute(
                sourceBounds, this.GetVisualBounds(targetTable), fieldY, pAnchors.get(ref.ID));
        }
    }

    private CreateRouteContext(pTables: XORMTable[]): XRouteContext
    {
        const rects = pTables.map(t => ({ ID: t.ID, Rect: this.GetVisualBounds(t) }));
        return new XRouteContext(rects, XORMMetrics.RouterGap);
    }

    /**
     * Deterministic routing order: descending anchor-to-anchor Manhattan
     * distance (hardest first), ties broken by reference ID.
     */
    private OrderForRouting(
        pRefs: XORMReference[],
        pAnchors: Map<string, { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection } | undefined>
    ): XORMReference[]
    {
        const distOf = (pRef: XORMReference): number =>
        {
            const a = pAnchors.get(pRef.ID);
            if (!a)
                return 0;
            return Math.abs(a.SourceAnchor.X - a.TargetAnchor.X) + Math.abs(a.SourceAnchor.Y - a.TargetAnchor.Y);
        };
        return [...pRefs].sort((a, b) =>
        {
            const d = distOf(b) - distOf(a);
            if (d !== 0)
                return d;
            return a.ID < b.ID ? -1 : (a.ID > b.ID ? 1 : 0);
        });
    }

    /**
     * Orthogonal nudging pass (libavoid-style). Pulls apart near-colinear,
     * overlapping interior segments of different references into parallel
     * lanes so lines never stack. Improvements over the old DeOverlapSegments:
     *   - clusters NEAR-colinear segments (within one lane pitch), not only
     *     exactly coincident ones;
     *   - lane order follows each line's approach side (fewer new crossings);
     *   - every shift is validated against table bounds — a lane that would
     *     cut through a table keeps a safe position instead;
     *   - lane pitch 8-12px instead of 20px, keeping bundles compact.
     * Only interior segments are shifted — the first/last stubs stay glued to
     * their table anchors (source FK row / distributed target anchors).
     * Endpoints slide along their perpendicular neighbours, preserving
     * orthogonality.
     */
    private NudgeSegments(pRefs: XORMReference[], pContext?: XRouteContext): void
    {
        const lanePitch = Math.max(8, Math.round(XORMMetrics.RouterGap / 4));
        const clusterTol = lanePitch;
        const orientTol = 1.5;
        const clearance = 4;

        interface ISeg {
            Ref: XORMReference;
            I: number;          // points[I] -> points[I+1]
            Vertical: boolean;
            Fixed: number;      // shared coordinate (X for vertical, Y for horizontal)
            Lo: number;
            Hi: number;
            /** Mean perpendicular coordinate of the two neighbour joints — orders lanes by approach side. */
            ApproachKey: number;
        }

        const segs: ISeg[] = [];
        for (const ref of pRefs)
        {
            const pts = ref.Points;
            if (!pts || pts.length < 4)
                continue;
            // Interior segments only: skip the first (i=0) and last (i=len-2) stubs.
            for (let i = 1; i < pts.length - 2; i++)
            {
                const a = pts[i];
                const b = pts[i + 1];
                const vertical = Math.abs(a.X - b.X) < orientTol;
                const horizontal = Math.abs(a.Y - b.Y) < orientTol;
                if (vertical === horizontal)
                    continue; // diagonal or zero-length — leave untouched
                const prev = pts[i - 1];
                const next = pts[i + 2];
                if (vertical)
                    segs.push({
                        Ref: ref, I: i, Vertical: true, Fixed: a.X,
                        Lo: Math.min(a.Y, b.Y), Hi: Math.max(a.Y, b.Y),
                        ApproachKey: (prev.X + next.X) / 2
                    });
                else
                    segs.push({
                        Ref: ref, I: i, Vertical: false, Fixed: a.Y,
                        Lo: Math.min(a.X, b.X), Hi: Math.max(a.X, b.X),
                        ApproachKey: (prev.Y + next.Y) / 2
                    });
            }
        }

        const moveSegTo = (pSeg: ISeg, pTarget: number): void =>
        {
            const pts = pSeg.Ref.Points;
            const a = pts[pSeg.I];
            const b = pts[pSeg.I + 1];
            if (pSeg.Vertical) { a.X = pTarget; b.X = pTarget; }
            else { a.Y = pTarget; b.Y = pTarget; }
            pSeg.Fixed = pTarget;
        };

        /**
         * Position is acceptable when the moved segment does not cut through
         * any table, the two neighbour segments it stretches stay clear as
         * well, and the shift never collapses an anchor stub below one gap
         * (a swallowed stub makes the line appear to leave the table body).
         */
        const isFree = (pSeg: ISeg, pTarget: number): boolean =>
        {
            const pts = pSeg.Ref.Points;
            const prev = pts[pSeg.I - 1];
            const next = pts[pSeg.I + 2];
            const gap = XORMMetrics.RouterGap;
            if (pSeg.Vertical)
            {
                if (pSeg.I === 1 && Math.abs(pTarget - prev.X) < gap)
                    return false;
                if (pSeg.I === pts.length - 3 && Math.abs(pTarget - next.X) < gap)
                    return false;
            }
            else
            {
                if (pSeg.I === 1 && Math.abs(pTarget - prev.Y) < gap)
                    return false;
                if (pSeg.I === pts.length - 3 && Math.abs(pTarget - next.Y) < gap)
                    return false;
            }
            if (!pContext)
                return true;
            if (!pContext.IsSegmentFree(pSeg.Vertical, pTarget, pSeg.Lo, pSeg.Hi, clearance))
                return false;
            // Stretched neighbours: moving a vertical segment stretches the
            // horizontal joints at both ends (and vice versa). Clearance 0:
            // anchor stubs legitimately touch their own table border, but a
            // stretch that crosses a table interior is rejected.
            if (pSeg.Vertical)
            {
                const y1 = pts[pSeg.I].Y;
                const y2 = pts[pSeg.I + 1].Y;
                return pContext.IsSegmentFree(false, y1, Math.min(prev.X, pTarget), Math.max(prev.X, pTarget), 0)
                    && pContext.IsSegmentFree(false, y2, Math.min(pTarget, next.X), Math.max(pTarget, next.X), 0);
            }
            const x1 = pts[pSeg.I].X;
            const x2 = pts[pSeg.I + 1].X;
            return pContext.IsSegmentFree(true, x1, Math.min(prev.Y, pTarget), Math.max(prev.Y, pTarget), 0)
                && pContext.IsSegmentFree(true, x2, Math.min(pTarget, next.Y), Math.max(pTarget, next.Y), 0);
        };

        const process = (pGroup: ISeg[]): void =>
        {
            // Cluster by near-coincident shared coordinate (chained within tolerance).
            pGroup.sort((a, b) => a.Fixed - b.Fixed);
            let i = 0;
            while (i < pGroup.length)
            {
                let j = i + 1;
                while (j < pGroup.length && pGroup[j].Fixed - pGroup[j - 1].Fixed <= clusterTol)
                    j++;
                const bucket = pGroup.slice(i, j);
                i = j;
                if (bucket.length < 2)
                    continue;
                // Within a cluster keep only those whose spans overlap.
                bucket.sort((a, b) => a.Lo - b.Lo);
                const overlapping: ISeg[] = [];
                for (const seg of bucket)
                {
                    const hits = overlapping.some(o => seg.Lo < o.Hi - orientTol && seg.Hi > o.Lo + orientTol);
                    if (overlapping.length === 0 || hits)
                        overlapping.push(seg);
                }
                if (overlapping.length < 2)
                    continue;

                // Lane order by approach side: lines coming from the left get
                // the left lanes, avoiding crossings introduced by the nudge.
                overlapping.sort((a, b) =>
                {
                    const d = a.ApproachKey - b.ApproachKey;
                    if (Math.abs(d) > 0.5)
                        return d;
                    return a.Ref.ID < b.Ref.ID ? -1 : 1;
                });

                const k = overlapping.length;
                let center = 0;
                for (const seg of overlapping)
                    center += seg.Fixed;
                center /= k;

                for (let m = 0; m < k; m++)
                {
                    const seg = overlapping[m];
                    const offset = (m - (k - 1) / 2) * lanePitch;
                    // Try full pitch, then half pitch, then keep the original
                    // position — never shift a lane into a table.
                    const candidates = [center + offset, center + offset / 2];
                    for (const target of candidates)
                    {
                        if (isFree(seg, target))
                        {
                            moveSegTo(seg, target);
                            break;
                        }
                    }
                }
            }
        };

        process(segs.filter(s => s.Vertical));
        process(segs.filter(s => !s.Vertical));
    }

    /**
     * For each reference, computes the exact entry point on the target side and
     * the explicit exit point on the source side, distributing N parallel
     * connections evenly along each side so arrows do not stack at one spot.
     */
    private ComputeAnchorDistribution(
        pRefs: XORMReference[],
        _pTables: XORMTable[]
    ): Map<string, { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection } | undefined>
    {
        interface IPlan {
            Ref: XORMReference;
            SourceTable: XORMTable;
            TargetTable: XORMTable;
            SourceBounds: XRect;
            TargetBounds: XRect;
            SourceFieldY: number;
        }

        const plans: IPlan[] = [];
        for (const ref of pRefs)
        {
            let sourceField = ref.GetSourceElement<XORMField>();
            if (!sourceField && ref.Source)
                sourceField = this.FindFieldByID(ref.Source);

            let sourceTable: XORMTable | null = null;
            let fieldY = NaN;

            if (sourceField)
            {
                sourceTable = sourceField.ParentNode as XORMTable;
                if (!(sourceTable instanceof XORMTable))
                    continue;
                const idx = sourceTable.GetFields().findIndex(f => f.ID === sourceField!.ID);
                if (idx >= 0)
                    fieldY = XORMMetrics.GetFieldRowY(sourceTable, idx);
            }
            else
            {
                sourceTable = this.FindTableByID(ref.Source);
                if (!sourceTable)
                    continue;
            }

            let targetTable = ref.GetTargetElement<XORMTable>();
            if (!targetTable && ref.Target)
                targetTable = this.FindTableByID(ref.Target);
            if (!targetTable)
                continue;

            plans.push({
                Ref: ref,
                SourceTable: sourceTable,
                TargetTable: targetTable,
                SourceBounds: this.GetVisualBounds(sourceTable),
                TargetBounds: this.GetVisualBounds(targetTable),
                SourceFieldY: fieldY
            });
        }

        // Group by (target, target-side) for incoming distribution.
        // Side assignment is congestion-aware: each side has a capacity
        // (usable border length / minimum anchor spacing); when the preferred
        // side is full, the reference overflows to its next-ranked side so
        // hub tables spread their incoming arrows over multiple borders.
        const minAnchorSpacing = 14;
        const sideCapacity = (pBounds: XRect, pSide: XRouterDirection): number =>
        {
            const margin = XORMMetrics.RouterGap / 2;
            const inset = Math.min(margin, Math.min(pBounds.Width, pBounds.Height) / 4);
            const usable = (pSide === XRouterDirection.East || pSide === XRouterDirection.West)
                ? pBounds.Height - 2 * inset
                : pBounds.Width - 2 * inset;
            return Math.max(1, Math.floor(usable / minAnchorSpacing));
        };

        // Deterministic processing order so overflow assignment is stable.
        const orderedPlans = [...plans].sort((a, b) => a.Ref.ID < b.Ref.ID ? -1 : (a.Ref.ID > b.Ref.ID ? 1 : 0));

        const incomingBySide = new Map<string, IPlan[]>();
        const planSides = new Map<IPlan, { TargetSide: XRouterDirection; SourceSide: XRouterDirection }>();
        for (const plan of orderedPlans)
        {
            // Approach point = the actual FK exit on the source border, so the
            // side ranking sees where the line really comes from.
            const srcCxPlan = plan.SourceBounds.Left + plan.SourceBounds.Width / 2;
            const tgtCxPlan = plan.TargetBounds.Left + plan.TargetBounds.Width / 2;
            const approach = new XPoint(
                tgtCxPlan >= srcCxPlan ? plan.SourceBounds.Left + plan.SourceBounds.Width : plan.SourceBounds.Left,
                isNaN(plan.SourceFieldY) ? plan.SourceBounds.Top + plan.SourceBounds.Height / 2 : plan.SourceFieldY);
            const ranked = this.RankEntrySides(plan.SourceBounds, plan.TargetBounds, approach);
            let tSide = ranked[0];
            for (const side of ranked)
            {
                const key = `${plan.TargetTable.ID}|${side}`;
                const used = incomingBySide.get(key)?.length ?? 0;
                if (used < sideCapacity(plan.TargetBounds, side))
                {
                    tSide = side;
                    break;
                }
            }
            // The FK line MUST leave the source horizontally (East/West) at the
            // field-row height — never from the top/bottom. Choose the side that
            // faces the target.
            const srcCx = plan.SourceBounds.Left + plan.SourceBounds.Width / 2;
            const tgtCx = plan.TargetBounds.Left + plan.TargetBounds.Width / 2;
            const sSide = tgtCx >= srcCx ? XRouterDirection.East : XRouterDirection.West;
            planSides.set(plan, { TargetSide: tSide, SourceSide: sSide });
            const key = `${plan.TargetTable.ID}|${tSide}`;
            if (!incomingBySide.has(key)) incomingBySide.set(key, []);
            incomingBySide.get(key)!.push(plan);
        }

        const result = new Map<string, { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection } | undefined>();

        for (const [, group] of incomingBySide)
        {
            const tSide = planSides.get(group[0])!.TargetSide;
            const tBounds = group[0].TargetBounds;
            // Desired coordinate = projection of where the line actually comes
            // from onto the entry side: the source FK field-row Y for E/W
            // sides, the source exit-stub X for N/S sides. A lone incoming
            // route then enters straight (no jog to the middle of the border);
            // sorting by it keeps arrival order matching departure order so
            // sibling lines do not cross.
            const desiredOf = (p: IPlan): number =>
            {
                if (tSide === XRouterDirection.East || tSide === XRouterDirection.West)
                    return isNaN(p.SourceFieldY)
                        ? p.SourceBounds.Top + p.SourceBounds.Height / 2
                        : p.SourceFieldY;
                const srcCx = p.SourceBounds.Left + p.SourceBounds.Width / 2;
                const tgtCx = p.TargetBounds.Left + p.TargetBounds.Width / 2;
                return tgtCx >= srcCx
                    ? p.SourceBounds.Right + XORMMetrics.RouterGap
                    : p.SourceBounds.Left - XORMMetrics.RouterGap;
            };
            group.sort((a, b) =>
            {
                const d = desiredOf(a) - desiredOf(b);
                if (Math.abs(d) > 0.5)
                    return d;
                return a.Ref.ID < b.Ref.ID ? -1 : 1;
            });

            const margin = XORMMetrics.RouterGap / 2;
            const inset = Math.min(margin, Math.min(tBounds.Width, tBounds.Height) / 4);
            const horizontalSide = tSide === XRouterDirection.North || tSide === XRouterDirection.South;
            const lo = (horizontalSide ? tBounds.Left : tBounds.Top) + inset;
            const hi = (horizontalSide ? tBounds.Right : tBounds.Bottom) - inset;
            const coords = XORMDesign.ResolveAnchorCoords(group.map(desiredOf), lo, hi, minAnchorSpacing);

            for (let i = 0; i < group.length; i++)
            {
                const tAnchor = horizontalSide
                    ? new XPoint(coords[i], tSide === XRouterDirection.North ? tBounds.Top : tBounds.Bottom)
                    : new XPoint(tSide === XRouterDirection.West ? tBounds.Left : tBounds.Right, coords[i]);
                const plan = group[i];
                const sides = planSides.get(plan)!;
                const sAnchor = this.SourceAnchor(plan.SourceBounds, sides.SourceSide, plan.SourceFieldY);
                result.set(plan.Ref.ID, {
                    TargetAnchor: tAnchor,
                    TargetSide: tSide,
                    SourceAnchor: sAnchor,
                    SourceSide: sides.SourceSide
                });
            }
        }

        return result;
    }

    /**
     * Places anchors as close as possible to their desired coordinates while
     * keeping a minimum spacing and staying within [pLo, pHi]. Forward pass
     * pushes overlapping anchors ahead; backward pass restores spacing when
     * the chain was squashed against the upper bound. When the span cannot
     * fit all anchors at the requested spacing, the pitch shrinks evenly.
     */
    private static ResolveAnchorCoords(pDesired: number[], pLo: number, pHi: number, pSpacing: number): number[]
    {
        const clamp = (pV: number): number => Math.min(pHi, Math.max(pLo, pV));
        const n = pDesired.length;
        if (n === 1)
            return [clamp(pDesired[0])];

        const span = Math.max(0, pHi - pLo);
        const pitch = Math.min(pSpacing, span / (n - 1));
        const out = new Array<number>(n);
        out[0] = clamp(pDesired[0]);
        for (let i = 1; i < n; i++)
            out[i] = clamp(Math.max(pDesired[i], out[i - 1] + pitch));
        for (let i = n - 2; i >= 0; i--)
        {
            if (out[i] > out[i + 1] - pitch)
                out[i] = out[i + 1] - pitch;
        }
        return out;
    }

    private PickEntrySide(pFrom: XRect, pTo: XRect): XRouterDirection
    {
        return this.RankEntrySides(pFrom, pTo)[0];
    }

    /**
     * Entry sides of the target ranked by estimated route cost from the
     * approach point (the source anchor). Each side's cost is the Manhattan
     * distance to its entry stub PLUS a wrap penalty when the approach point
     * is on the wrong half-plane (entering that side would require going
     * around the table — the source of "hook" routes). A center-to-center
     * tie between two sides no longer picks the wrapped one.
     */
    private RankEntrySides(pFrom: XRect, pTo: XRect, pApproach?: XPoint): XRouterDirection[]
    {
        const gap = XORMMetrics.RouterGap;
        const fromCx = pFrom.Left + pFrom.Width / 2;
        const fromCy = pFrom.Top + pFrom.Height / 2;
        const toCx = pTo.Left + pTo.Width / 2;
        const toCy = pTo.Top + pTo.Height / 2;
        // FK lines leave the source horizontally at the border facing the target.
        const approach = pApproach ?? new XPoint(
            toCx >= fromCx ? pFrom.Left + pFrom.Width : pFrom.Left,
            fromCy);

        const entryOf = (pSide: XRouterDirection): XPoint =>
        {
            switch (pSide)
            {
                case XRouterDirection.East: return new XPoint(pTo.Left + pTo.Width + gap, toCy);
                case XRouterDirection.West: return new XPoint(pTo.Left - gap, toCy);
                case XRouterDirection.North: return new XPoint(toCx, pTo.Top - gap);
                default: return new XPoint(toCx, pTo.Top + pTo.Height + gap);
            }
        };
        // Wrap deficit: how far the approach point sits inside the wrong
        // half-plane for this side. Doubled because the route must travel
        // past the table and come back.
        const wrapOf = (pSide: XRouterDirection): number =>
        {
            switch (pSide)
            {
                case XRouterDirection.East: return Math.max(0, (pTo.Left + pTo.Width + gap) - approach.X) * 2;
                case XRouterDirection.West: return Math.max(0, approach.X - (pTo.Left - gap)) * 2;
                case XRouterDirection.North: return Math.max(0, approach.Y - (pTo.Top - gap)) * 2;
                default: return Math.max(0, (pTo.Top + pTo.Height + gap) - approach.Y) * 2;
            }
        };

        const sides = [XRouterDirection.East, XRouterDirection.West, XRouterDirection.North, XRouterDirection.South];
        const costs = new Map<XRouterDirection, number>();
        for (const side of sides)
        {
            const entry = entryOf(side);
            costs.set(side, Math.abs(entry.X - approach.X) + Math.abs(entry.Y - approach.Y) + wrapOf(side));
        }
        sides.sort((a, b) => costs.get(a)! - costs.get(b)!);
        return sides;
    }

    private SourceAnchor(pBounds: XRect, pSide: XRouterDirection, pFieldY: number): XPoint
    {
        if (pSide === XRouterDirection.East)
            return new XPoint(pBounds.Left + pBounds.Width, isNaN(pFieldY) ? pBounds.Top + pBounds.Height / 2 : pFieldY);
        if (pSide === XRouterDirection.West)
            return new XPoint(pBounds.Left, isNaN(pFieldY) ? pBounds.Top + pBounds.Height / 2 : pFieldY);
        if (pSide === XRouterDirection.North)
            return new XPoint(pBounds.Left + pBounds.Width / 2, pBounds.Top);
        return new XPoint(pBounds.Left + pBounds.Width / 2, pBounds.Top + pBounds.Height);
    }

    /**
     * Routes a single reference using the XRouter graph-search algorithm.
     * Source exits horizontally (East/West) at the FK field row Y.
     * Target may be entered from any side.
     * Three passes: (1) pinned anchors + obstacles, (2) relaxed anchors with
     * obstacles KEPT (never route through tables to "solve" a failure),
     * (3) orthogonal L/Z fallback so the reference always renders without
     * diagonals.
     */
    private RouteReference(
        pRef: XORMReference,
        pTables: XORMTable[],
        pAnchor?: { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection },
        pContext?: XRouteContext
    ): void
    {
        let sourceField = pRef.GetSourceElement<XORMField>();
        if (!sourceField && pRef.Source)
            sourceField = this.FindFieldByID(pRef.Source);

        let sourceTable: XORMTable | null = null;
        let fieldY = NaN;

        if (sourceField)
        {
            sourceTable = sourceField.ParentNode as XORMTable;
            if (!(sourceTable instanceof XORMTable))
                return;

            const fieldIndex = sourceTable.GetFields().findIndex(f => f.ID === sourceField!.ID);
            if (fieldIndex >= 0)
                fieldY = XORMMetrics.GetFieldRowY(sourceTable, fieldIndex);
        }
        else
        {
            sourceTable = this.FindTableByID(pRef.Source);
            if (!sourceTable)
                return;
        }

        let targetTable = pRef.GetTargetElement<XORMTable>();
        if (!targetTable && pRef.Target)
            targetTable = this.FindTableByID(pRef.Target);

        if (!targetTable)
            return;

        const sourceBounds = this.GetVisualBounds(sourceTable);
        const targetBounds = this.GetVisualBounds(targetTable);

        const fieldRect = isNaN(fieldY)
            ? sourceBounds
            : new XRect(
                sourceBounds.Left,
                fieldY - XORMMetrics.FieldRowHeight / 2,
                sourceBounds.Width,
                XORMMetrics.FieldRowHeight
              );

        const srcDirs = pAnchor
            ? [pAnchor.SourceSide]
            : this.PickSourceDirections(sourceBounds, targetBounds);
        const tgtDirs = pAnchor
            ? [pAnchor.TargetSide]
            : this.PickTargetDirections(sourceBounds, targetBounds);

        const srcStart = pAnchor
            ? pAnchor.SourceAnchor
            : (isNaN(fieldY) ? new XPoint(NaN, NaN) : new XPoint(NaN, fieldY));
        const tgtStart = pAnchor
            ? pAnchor.TargetAnchor
            : new XPoint(NaN, NaN);

        const srcShape: XRouterShape = {
            Rect: fieldRect,
            StartPoint: srcStart,
            DesiredDegree: srcDirs
        };

        const tgtShape: XRouterShape = {
            Rect: targetBounds,
            StartPoint: tgtStart,
            DesiredDegree: tgtDirs
        };

        const router = this.Router;
        router.Gap = XORMMetrics.RouterGap;
        // Turn penalty equal to the gap: a bend must save at least one full
        // corridor of length to be worth it — kills gratuitous zig-zags.
        router.TurnPenalty = XORMMetrics.RouterGap;
        router.Context = pContext ?? null;
        router.CurrentRefID = pRef.ID;
        router.clearObstacles();
        router.setEndpoints(sourceBounds, targetBounds);

        const clearance = XORMMetrics.RouterGap / 2;
        for (const t of pTables)
        {
            if (t.ID !== sourceTable.ID && t.ID !== targetTable.ID)
            {
                const b = this.GetVisualBounds(t);
                router.addObstacle(new XRect(
                    b.Left - clearance,
                    b.Top - clearance,
                    b.Width + clearance * 2,
                    b.Height + clearance * 2
                ));
            }
        }
        // The source and target tables themselves are obstacles too (not
        // inflated: anchors sit on their borders and exit stubs leave at a
        // full gap). Without this, a route could cut through its own tables.
        router.addObstacle(sourceBounds);
        router.addObstacle(targetBounds);

        router.CheckCrossRect = true;
        router.clear();
        let result = router.getAllLines(srcShape, tgtShape);

        if (!result.IsValid || result.Points.length === 0)
        {
            // Pass 2: relax the pinned anchors (all geometrically sensible
            // direction combinations, free anchor position) but KEEP the
            // obstacles — a failed route must never cut through tables.
            const relaxedSrc: XRouterShape = {
                Rect: fieldRect,
                StartPoint: isNaN(fieldY) ? new XPoint(NaN, NaN) : new XPoint(NaN, fieldY),
                DesiredDegree: this.PickSourceDirections(sourceBounds, targetBounds)
            };
            const relaxedTgt: XRouterShape = {
                Rect: targetBounds,
                StartPoint: new XPoint(NaN, NaN),
                DesiredDegree: this.PickTargetDirections(sourceBounds, targetBounds)
            };
            router.clear();
            result = router.getAllLines(relaxedSrc, relaxedTgt);
        }

        router.Context = null;
        router.CurrentRefID = "";

        if (result.IsValid && result.Points.length > 0
            && XORMDesign.HasValidSourceExit(result.Points, sourceBounds, fieldY))
        {
            pRef.Points = result.Points;
            return;
        }

        // Final guard: orthogonal L/Z fallback between the chosen anchors so
        // the reference always renders — never a diagonal line.
        pRef.Points = this.OrthogonalFallbackRoute(sourceBounds, targetBounds, fieldY, pAnchor);
    }

    /**
     * Hard RF5 invariant for a routed reference: the line must START on the
     * source table's LEFT or RIGHT border at the FK field row, leave
     * horizontally and outward with a visible stub, and no later segment may
     * cut back through the source table body (a line emerging from under the
     * table). Any route that violates this is discarded in favour of the
     * deterministic orthogonal fallback.
     */
    private static HasValidSourceExit(pPoints: XPoint[], pSourceBounds: XRect, pFieldY: number): boolean
    {
        if (pPoints.length < 2)
            return false;
        const tol = 0.75;
        const p0 = pPoints[0];
        const p1 = pPoints[1];
        const onWest = Math.abs(p0.X - pSourceBounds.Left) < tol;
        const onEast = Math.abs(p0.X - pSourceBounds.Right) < tol;
        if (!onWest && !onEast)
            return false;
        if (!isNaN(pFieldY) && Math.abs(p0.Y - pFieldY) > tol)
            return false;
        if (Math.abs(p1.Y - p0.Y) > tol)
            return false;
        const outward = onEast ? p1.X - p0.X : p0.X - p1.X;
        if (outward < 12)
            return false;
        for (let i = 1; i < pPoints.length - 1; i++)
        {
            const a = pPoints[i];
            const b = pPoints[i + 1];
            const loX = Math.min(a.X, b.X);
            const hiX = Math.max(a.X, b.X);
            const loY = Math.min(a.Y, b.Y);
            const hiY = Math.max(a.Y, b.Y);
            if (hiX > pSourceBounds.Left + tol && loX < pSourceBounds.Right - tol
                && hiY > pSourceBounds.Top + tol && loY < pSourceBounds.Bottom - tol)
                return false;
        }
        return true;
    }

    /**
     * Deterministic orthogonal fallback: exits the source horizontally at the
     * FK row, runs a vertical trunk one gap away from the source border and
     * enters the target through its anchor side. Every segment is H/V.
     */
    private OrthogonalFallbackRoute(
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pFieldY: number,
        pAnchor?: { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection }
    ): XPoint[]
    {
        const gap = XORMMetrics.RouterGap / 2;
        const srcSide = pAnchor?.SourceSide
            ?? (pTargetBounds.Left + pTargetBounds.Width / 2 >= pSourceBounds.Left + pSourceBounds.Width / 2
                ? XRouterDirection.East
                : XRouterDirection.West);
        const srcPt = pAnchor
            ? pAnchor.SourceAnchor
            : (srcSide === XRouterDirection.East
                ? new XPoint(pSourceBounds.Right, isNaN(pFieldY) ? pSourceBounds.Top + pSourceBounds.Height / 2 : pFieldY)
                : new XPoint(pSourceBounds.Left, isNaN(pFieldY) ? pSourceBounds.Top + pSourceBounds.Height / 2 : pFieldY));
        const tgtSide = pAnchor?.TargetSide
            ?? (srcSide === XRouterDirection.East ? XRouterDirection.West : XRouterDirection.East);
        const tgtPt = pAnchor
            ? pAnchor.TargetAnchor
            : (tgtSide === XRouterDirection.West
                ? new XPoint(pTargetBounds.Left, pTargetBounds.Top + pTargetBounds.Height / 2)
                : new XPoint(pTargetBounds.Right, pTargetBounds.Top + pTargetBounds.Height / 2));

        // Vertical trunk X: one gap out of the source border toward the target.
        const trunkX = srcSide === XRouterDirection.East
            ? pSourceBounds.Right + gap
            : pSourceBounds.Left - gap;

        // Entry stub: one gap out of the target border on the entry side.
        let entry: XPoint;
        switch (tgtSide)
        {
            case XRouterDirection.West:
                entry = new XPoint(pTargetBounds.Left - gap, tgtPt.Y);
                break;
            case XRouterDirection.East:
                entry = new XPoint(pTargetBounds.Right + gap, tgtPt.Y);
                break;
            case XRouterDirection.North:
                entry = new XPoint(tgtPt.X, pTargetBounds.Top - gap);
                break;
            default: // South
                entry = new XPoint(tgtPt.X, pTargetBounds.Bottom + gap);
                break;
        }

        // Trunk vertical to the entry stub height, horizontal run to the stub,
        // then the stub enters the anchor (horizontal for E/W, vertical for N/S).
        const points: XPoint[] = [
            srcPt,
            new XPoint(trunkX, srcPt.Y),
            new XPoint(trunkX, entry.Y),
            entry,
            tgtPt
        ];

        // Drop consecutive duplicates (degenerate spans collapse cleanly).
        const out: XPoint[] = [points[0]];
        for (let i = 1; i < points.length; i++)
        {
            const prev = out[out.length - 1];
            if (Math.abs(points[i].X - prev.X) > 0.5 || Math.abs(points[i].Y - prev.Y) > 0.5)
                out.push(points[i]);
        }
        return out;
    }

    private PickSourceDirections(pSource: XRect, pTarget: XRect): XRouterDirection[]
    {
        if (pTarget.Left >= pSource.Right)
            return [XRouterDirection.East, XRouterDirection.West];
        if (pTarget.Right <= pSource.Left)
            return [XRouterDirection.West, XRouterDirection.East];
        return [XRouterDirection.East, XRouterDirection.West];
    }

    private PickTargetDirections(pSource: XRect, pTarget: XRect): XRouterDirection[]
    {
        const dirs: XRouterDirection[] = [];
        if (pTarget.Left >= pSource.Right)
            dirs.push(XRouterDirection.West);
        else if (pTarget.Right <= pSource.Left)
            dirs.push(XRouterDirection.East);

        if (pTarget.Top >= pSource.Bottom)
            dirs.push(XRouterDirection.North);
        else if (pTarget.Bottom <= pSource.Top)
            dirs.push(XRouterDirection.South);

        if (dirs.indexOf(XRouterDirection.West) < 0) dirs.push(XRouterDirection.West);
        if (dirs.indexOf(XRouterDirection.East) < 0) dirs.push(XRouterDirection.East);
        if (dirs.indexOf(XRouterDirection.North) < 0) dirs.push(XRouterDirection.North);
        if (dirs.indexOf(XRouterDirection.South) < 0) dirs.push(XRouterDirection.South);
        return dirs;
    }

    /**
     * Routing quality metrics over the current reference points — total
     * length, bends, line/line crossings, colinear overlaps and table
     * crossings. Used by tests as a regression gate and by telemetry.
     */
    public GetRoutingMetrics(): XIRoutingMetrics
    {
        interface IMSeg { RefID: string; Vertical: boolean; Fixed: number; Lo: number; Hi: number; }
        const segs: IMSeg[] = [];
        const refs = this.GetReferences();
        let totalLength = 0;
        let totalBends = 0;

        for (const ref of refs)
        {
            const pts = ref.Points;
            if (!pts || pts.length < 2)
                continue;
            for (let i = 1; i < pts.length; i++)
            {
                const a = pts[i - 1];
                const b = pts[i];
                totalLength += Math.abs(a.X - b.X) + Math.abs(a.Y - b.Y);
                if (i >= 2)
                {
                    const p = pts[i - 2];
                    const horiz1 = Math.abs(p.Y - a.Y) < 0.5;
                    const horiz2 = Math.abs(a.Y - b.Y) < 0.5;
                    if (horiz1 !== horiz2)
                        totalBends++;
                }
                if (Math.abs(a.X - b.X) < 0.5 && Math.abs(a.Y - b.Y) >= 0.5)
                    segs.push({ RefID: ref.ID, Vertical: true, Fixed: a.X, Lo: Math.min(a.Y, b.Y), Hi: Math.max(a.Y, b.Y) });
                else if (Math.abs(a.Y - b.Y) < 0.5 && Math.abs(a.X - b.X) >= 0.5)
                    segs.push({ RefID: ref.ID, Vertical: false, Fixed: a.Y, Lo: Math.min(a.X, b.X), Hi: Math.max(a.X, b.X) });
            }
        }

        let crossings = 0;
        let overlaps = 0;
        for (let i = 0; i < segs.length; i++)
        {
            for (let j = i + 1; j < segs.length; j++)
            {
                const a = segs[i];
                const b = segs[j];
                if (a.RefID === b.RefID)
                    continue;
                if (a.Vertical !== b.Vertical)
                {
                    const v = a.Vertical ? a : b;
                    const h = a.Vertical ? b : a;
                    if (v.Fixed > h.Lo + 1 && v.Fixed < h.Hi - 1 && h.Fixed > v.Lo + 1 && h.Fixed < v.Hi - 1)
                        crossings++;
                }
                else if (Math.abs(a.Fixed - b.Fixed) < 2)
                {
                    const lo = Math.max(a.Lo, b.Lo);
                    const hi = Math.min(a.Hi, b.Hi);
                    if (hi - lo > 2)
                        overlaps++;
                }
            }
        }

        let tableCrossings = 0;
        const tables = this.GetTables().map(t => this.GetVisualBounds(t));
        for (const seg of segs)
        {
            for (const r of tables)
            {
                if (seg.Vertical)
                {
                    if (seg.Fixed > r.Left + 1 && seg.Fixed < r.Right - 1 && seg.Hi > r.Top + 1 && seg.Lo < r.Bottom - 1)
                    {
                        tableCrossings++;
                        break;
                    }
                }
                else if (seg.Fixed > r.Top + 1 && seg.Fixed < r.Bottom - 1 && seg.Hi > r.Left + 1 && seg.Lo < r.Right - 1)
                {
                    tableCrossings++;
                    break;
                }
            }
        }

        return {
            ReferenceCount: refs.length,
            TotalLength: totalLength,
            TotalBends: totalBends,
            Crossings: crossings,
            Overlaps: overlaps,
            TableCrossings: tableCrossings
        };
    }
}
