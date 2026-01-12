import { XRectangle } from "./XRectangle.js";
import { XLine } from "./XLine.js";
import { XRouter, XRouterOptions } from "./XRouter.js";
import { XRouterShape, XRouterDirection } from "./XRouterTypes.js";
import { XRect, XPoint } from "../Core/XGeometry.js";
import { XMath } from "../Core/XMath.js";

/**
 * Opções para o roteamento de linhas
 */
export interface XRouteOptions {
    /** Espaçamento entre elementos e linhas */
    Gap?: number;
    /** Direções permitidas para saída da origem */
    SourceDirections?: XRouterDirection[];
    /** Direções permitidas para entrada no destino */
    TargetDirections?: XRouterDirection[];
    /** Verificar colisão com outros elementos */
    CheckCollision?: boolean;
}

/**
 * Classe base abstrata para designs visuais
 * Fornece funcionalidades de layout e roteamento de linhas
 */
export abstract class XDesign extends XRectangle
{
    private _Router: XRouter | null = null;
    private _DefaultGap: number = 20;

    public constructor()
    {
        super();
    }

    /**
     * Define o espaçamento padrão para roteamento
     */
    public get DefaultGap(): number
    {
        return this._DefaultGap;
    }

    public set DefaultGap(pValue: number)
    {
        this._DefaultGap = pValue;
    }

    /**
     * Obtém ou cria uma instância do router
     */
    protected get Router(): XRouter
    {
        if (!this._Router)
            this._Router = new XRouter({ gap: this._DefaultGap });
        return this._Router;
    }

    /**
     * Roteia todas as linhas do design
     * @param pOptions - Opções de roteamento
     */
    public RouteAllLines(pOptions?: XRouteOptions): void
    {
        const lines = this.GetLines();
        const rectangles = this.GetRectangles();

        for (const line of lines)
            this.RouteLine(line, rectangles, pOptions);
    }

    /**
     * Roteia uma linha específica entre dois retângulos
     * @param pLine - Linha a ser roteada
     * @param pObstacles - Lista de retângulos obstáculos
     * @param pOptions - Opções de roteamento
     * @returns true se o roteamento foi bem-sucedido
     */
    public RouteLine(pLine: XLine, pObstacles?: XRectangle[], pOptions?: XRouteOptions): boolean
    {
        const source = this.FindElementByID(pLine.Source);
        const target = this.FindElementByID(pLine.Target);

        if (!source || !target)
            return false;

        const gap = pOptions?.Gap ?? this._DefaultGap;
        const router = this.Router;
        router.Gap = gap;
        router.clear();
        router.clearObstacles();

        if (pObstacles && (pOptions?.CheckCollision ?? true))
        {
            for (const obs of pObstacles)
            {
                if (obs.ID !== source.ID && obs.ID !== target.ID)
                    router.addObstacle(obs.Bounds);
            }
        }

        const srcDirs = pOptions?.SourceDirections ?? this.GetDefaultDirections(source.Bounds, target.Bounds);
        const tgtDirs = pOptions?.TargetDirections ?? this.GetDefaultDirections(target.Bounds, source.Bounds);

        const srcShape = this.CreateRouterShape(source.Bounds, srcDirs);
        const tgtShape = this.CreateRouterShape(target.Bounds, tgtDirs);

        router.setEndpoints(source.Bounds, target.Bounds);
        const result = router.getAllLines(srcShape, tgtShape);

        if (result.IsValid && result.Points.length > 0)
        {
            pLine.Points = result.Points;
            return true;
        }

        return false;
    }

    /**
     * Roteia uma linha usando pontos de origem e destino específicos
     * @param pLine - Linha a ser roteada
     * @param pSourcePoint - Ponto de origem
     * @param pTargetPoint - Ponto de destino
     * @param pObstacles - Lista de retângulos obstáculos
     * @param pOptions - Opções de roteamento
     * @returns true se o roteamento foi bem-sucedido
     */
    public RouteLineFromPoints(
        pLine: XLine,
        pSourcePoint: XPoint,
        pTargetPoint: XPoint,
        pObstacles?: XRectangle[],
        pOptions?: XRouteOptions
    ): boolean
    {
        const source = this.FindElementByID(pLine.Source);
        const target = this.FindElementByID(pLine.Target);

        if (!source || !target)
            return false;

        const gap = pOptions?.Gap ?? this._DefaultGap;
        const checkCollision = pOptions?.CheckCollision ?? true;
        const router = this.Router;
        router.Gap = gap;
        router.clear();
        router.clearObstacles();

        if (pObstacles && checkCollision)
        {
            for (const obs of pObstacles)
            {
                if (obs.ID !== source.ID && obs.ID !== target.ID)
                    router.addObstacle(obs.Bounds);
            }
        }

        const srcDir = this.GetDirectionFromPoint(source.Bounds, pSourcePoint);
        const tgtDir = this.GetDirectionFromPoint(target.Bounds, pTargetPoint);

        const srcShape: XRouterShape = {
            Rect: source.Bounds,
            StartPoint: pSourcePoint,
            DesiredDegree: [srcDir]
        };

        const tgtShape: XRouterShape = {
            Rect: target.Bounds,
            StartPoint: pTargetPoint,
            DesiredDegree: [tgtDir]
        };

        router.setEndpoints(source.Bounds, target.Bounds);
        const result = router.getAllLines(srcShape, tgtShape);

        if (result.IsValid && result.Points.length > 0)
        {
            pLine.Points = result.Points;
            return true;
        }

        return false;
    }

    /**
     * Obtém todas as linhas filhas do design
     * @returns Array de XLine
     */
    public GetLines(): XLine[]
    {
        const lines: XLine[] = [];
        for (const child of this.ChildNodes)
        {
            if (child instanceof XLine)
                lines.push(child);
        }
        return lines;
    }

    /**
     * Obtém todos os retângulos filhos do design
     * @returns Array de XRectangle
     */
    public GetRectangles(): XRectangle[]
    {
        const rects: XRectangle[] = [];
        for (const child of this.ChildNodes)
        {
            if (child instanceof XRectangle && !(child instanceof XLine))
                rects.push(child);
        }
        return rects;
    }

    /**
     * Encontra um elemento pelo ID
     * @param pID - ID do elemento
     * @returns O elemento ou null
     */
    protected FindElementByID(pID: string): XRectangle | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XRectangle && child.ID === pID)
                return child;
        }
        return null;
    }

    /**
     * Cria um XRouterShape a partir de um retângulo e direções
     * @param pRect - Retângulo da forma
     * @param pDirections - Direções permitidas
     * @returns XRouterShape configurado
     */
    protected CreateRouterShape(pRect: XRect, pDirections: XRouterDirection[]): XRouterShape
    {
        return {
            Rect: pRect,
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: pDirections
        };
    }

    /**
     * Determina as direções padrão baseado na posição relativa
     * @param pFrom - Retângulo de origem
     * @param pTo - Retângulo de destino
     * @returns Array de direções
     */
    protected GetDefaultDirections(pFrom: XRect, pTo: XRect): XRouterDirection[]
    {
        const dirs: XRouterDirection[] = [];
        const fromCenter = XMath.Center(pFrom);
        const toCenter = XMath.Center(pTo);

        const dx = toCenter.X - fromCenter.X;
        const dy = toCenter.Y - fromCenter.Y;

        if (Math.abs(dx) > Math.abs(dy))
        {
            if (dx > 0)
                dirs.push(XRouterDirection.East);
            else
                dirs.push(XRouterDirection.West);
        }
        else
        {
            if (dy > 0)
                dirs.push(XRouterDirection.South);
            else
                dirs.push(XRouterDirection.North);
        }

        if (dirs[0] === XRouterDirection.East || dirs[0] === XRouterDirection.West)
        {
            dirs.push(XRouterDirection.North);
            dirs.push(XRouterDirection.South);
        }
        else
        {
            dirs.push(XRouterDirection.East);
            dirs.push(XRouterDirection.West);
        }

        return dirs;
    }

    /**
     * Determina a direção baseado em um ponto relativo ao retângulo
     * @param pRect - Retângulo de referência
     * @param pPoint - Ponto no ou próximo ao retângulo
     * @returns Direção correspondente
     */
    protected GetDirectionFromPoint(pRect: XRect, pPoint: XPoint): XRouterDirection
    {
        const center = XMath.Center(pRect);
        const eps = 1;

        if (Math.abs(pPoint.Y - pRect.Top) < eps)
            return XRouterDirection.North;
        if (Math.abs(pPoint.Y - pRect.Bottom) < eps)
            return XRouterDirection.South;
        if (Math.abs(pPoint.X - pRect.Left) < eps)
            return XRouterDirection.West;
        if (Math.abs(pPoint.X - (pRect.Left + pRect.Width)) < eps)
            return XRouterDirection.East;

        const dx = pPoint.X - center.X;
        const dy = pPoint.Y - center.Y;

        if (Math.abs(dx) > Math.abs(dy))
        {
            if (dx > 0)
                return XRouterDirection.East;
            return XRouterDirection.West;
        }
        
        if (dy > 0)
            return XRouterDirection.South;
        return XRouterDirection.North;
    }

    /**
     * Organiza automaticamente o layout dos elementos
     * @param pMargin - Margem entre elementos
     */
    public AutoLayout(pMargin: number = 20): void
    {
        const rectangles = this.GetRectangles();
        if (rectangles.length === 0)
            return;

        let x = pMargin;
        let y = pMargin;
        let maxHeight = 0;
        const maxWidth = this.Width > 0 ? this.Width : 800;

        for (const rect of rectangles)
        {
            if (x + rect.Width + pMargin > maxWidth)
            {
                x = pMargin;
                y += maxHeight + pMargin;
                maxHeight = 0;
            }

            rect.Bounds = new XRect(x, y, rect.Width, rect.Height);
            x += rect.Width + pMargin;
            maxHeight = Math.max(maxHeight, rect.Height);
        }

        this.RouteAllLines();
    }
}
