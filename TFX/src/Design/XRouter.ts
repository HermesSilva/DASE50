/**
 * XRouter - Sistema de roteamento ortogonal para conexões entre formas
 * Traduzido e melhorado do C# original TFX.DASE.Core.Objects.XRouter
 * 
 * Este módulo implementa um algoritmo de roteamento que encontra caminhos
 * ortogonais entre dois retângulos, evitando obstáculos quando necessário.
 * 
 * @module Designers/ORM/Routing/XRouter
 */

import { XMath } from "./XMath";
import {
    XPoint,
    XRect,
    XSize,
    XRouterLine,
    XRouterShape,
    XRouterDirection,
    createRouterLine,
    emptyRouterLine,
    clonePoints,
    isEmptyRect,
    normalizeRect,
    generateGuid
} from "./XRouterTypes";

/**
 * Opções de configuração do router
 */
export interface XRouterOptions {
    /** Espaçamento entre elementos e linhas de roteamento */
    gap?: number;
    /** Usar retângulo interno para cálculos */
    useInnerRect?: boolean;
    /** Usar retângulo externo para cálculos */
    useOuterRect?: boolean;
    /** Retornar a linha mais curta encontrada */
    returnShorterLine?: boolean;
    /** Verificar colisão com obstáculos */
    checkCollision?: boolean;
    /** Verificar cruzamento com retângulos */
    checkCrossRect?: boolean;
}

/**
 * Resultado do roteamento
 */
export interface XRouterResult {
    /** Melhor linha encontrada */
    bestLine: XRouterLine;
    /** Todas as linhas calculadas */
    allLines: XRouterLine[];
    /** Linhas finais válidas */
    finalLines: XRouterLine[];
    /** Número de passos de cálculo */
    steps: number;
    /** Indica se o roteamento foi bem-sucedido */
    success: boolean;
}

/**
 * Classe principal de roteamento ortogonal
 * Encontra caminhos entre dois retângulos evitando obstáculos
 */
export class XRouter {
    // Configurações
    /** Espaçamento padrão entre elementos */
    public Gap: number = 20;
    
    /** Lista de retângulos obstáculos */
    public Rects: XRect[] = [];
    
    /** Usar retângulo interno */
    public UseInnerRect: boolean = false;
    
    /** Usar retângulo externo */
    public UseOuterRect: boolean = false;
    
    /** Retornar linha mais curta */
    public ReturnShorterLine: boolean = true;
    
    /** Verificar colisão com obstáculos */
    public CheckCollision: boolean = false;
    
    /** Verificar cruzamento com retângulos */
    public CheckCrossRect: boolean = true;

    // Resultados
    /** Linhas resolvidas (candidatas válidas) */
    public SolvedLines: XRouterLine[] = [];
    
    /** Todas as linhas calculadas */
    public AllLines: XRouterLine[] = [];
    
    /** Linhas finais após filtragem */
    public FinalLines: XRouterLine[] = [];
    
    /** Linhas do lado esquerdo */
    public LeftLines: XRouterLine[] = [];
    
    /** Linhas do lado direito */
    public RightLines: XRouterLine[] = [];
    
    /** Melhor linha encontrada */
    public BestLine: XRouterLine = emptyRouterLine();
    
    /** Retângulo principal (área de trabalho) */
    public MainRect: XRect = { Left: 0, Top: 0, Width: 0, Height: 0, IsEmpty: true };
    
    /** Retângulo direito (destino) */
    public RightRect: XRect = { Left: 0, Top: 0, Width: 0, Height: 0, IsEmpty: true };
    
    /** Retângulo esquerdo (origem) */
    public LeftRect: XRect = { Left: 0, Top: 0, Width: 0, Height: 0, IsEmpty: true };
    
    /** Contador de passos de cálculo */
    public Steps: number = 0;

    // Variáveis internas
    private _LR: XRect = { Left: 0, Top: 0, Width: 0, Height: 0 };
    private _RR: XRect = { Left: 0, Top: 0, Width: 0, Height: 0 };
    private _MaxIterations: number = 1000; // Limite de segurança para evitar loops infinitos

    /**
     * Cria uma nova instância do XRouter
     * @param options - Opções de configuração opcionais
     */
    constructor(options?: XRouterOptions) {
        if (options) {
            this.Gap = options.gap ?? this.Gap;
            this.UseInnerRect = options.useInnerRect ?? this.UseInnerRect;
            this.UseOuterRect = options.useOuterRect ?? this.UseOuterRect;
            this.ReturnShorterLine = options.returnShorterLine ?? this.ReturnShorterLine;
            this.CheckCollision = options.checkCollision ?? this.CheckCollision;
            this.CheckCrossRect = options.checkCrossRect ?? this.CheckCrossRect;
        }
    }

    /**
     * Define o limite máximo de iterações para evitar loops infinitos
     * @param max - Número máximo de iterações
     */
    public setMaxIterations(max: number): void {
        this._MaxIterations = max;
    }

    /**
     * Limpa todos os resultados e prepara para novo cálculo
     */
    public clear(): void {
        this.AllLines = [];
        this.SolvedLines = [];
        this.FinalLines = [];
        this.LeftLines = [];
        this.RightLines = [];
        this.BestLine = emptyRouterLine();
        this.Steps = 0;
    }

    /**
     * Obtém todas as linhas possíveis entre duas formas
     * @param pLeft - Forma de origem
     * @param pRight - Forma de destino
     * @returns A melhor linha encontrada
     */
    public getAllLines(pLeft: XRouterShape, pRight: XRouterShape): XRouterLine {
        this.CheckCollision = this.Rects.length > 0;
        this.clear();
        
        if (this.prepare(pLeft, pRight, true, true)) {
            this.doRoute();
        }
        
        return this.BestLine;
    }

    /**
     * Roteia uma linha entre duas formas usando linhas pré-definidas
     * @param pLeft - Forma de origem
     * @param pRight - Forma de destino
     * @param pLeftLines - Linhas de saída do lado esquerdo
     * @param pRightLines - Linhas de entrada do lado direito
     * @returns true se encontrou uma rota válida
     */
    public routeLine(
        pLeft: XRouterShape, 
        pRight: XRouterShape, 
        pLeftLines: XRouterLine[], 
        pRightLines: XRouterLine[]
    ): boolean {
        this.CheckCollision = this.Rects.length > 0;
        this.LeftLines = pLeftLines;
        this.RightLines = pRightLines;
        
        if (this.prepare(pLeft, pRight, false, false)) {
            this.doRoute();
        }
        
        return this.BestLine.IsValid;
    }

    /**
     * Executa o algoritmo de roteamento principal
     */
    private doRoute(): void {
        // Segue cada linha do lado esquerdo procurando conexões
        for (const lln of this.LeftLines) {
            this.followLine(
                [...lln.Points], 
                this.AllLines, 
                this.RightLines, 
                new Set<string>(), 
                2
            );
        }

        // Adiciona todas as linhas para o pool
        this.AllLines.push(...this.LeftLines);
        this.AllLines.push(...this.RightLines);

        // Filtra linhas que não colidem com obstáculos
        for (const sln of this.SolvedLines) {
            if (!this.CheckCollision || !this.hasRectCollision(sln.Points)) {
                this.FinalLines.push(sln);
            }
        }

        // Encontra a linha mais curta
        if (this.FinalLines.length > 0) {
            this.BestLine = this.FinalLines.reduce((shortest, current) => {
                const currentLength = this.getLineLength(current.Points);
                const shortestLength = this.getLineLength(shortest.Points);
                return currentLength < shortestLength ? current : shortest;
            });
        }
    }

    /**
     * Prepara as estruturas para o roteamento
     * @param pLeft - Forma de origem
     * @param pRight - Forma de destino
     * @param pCreateLeft - Criar linhas de saída automaticamente
     * @param pCreateRight - Criar linhas de entrada automaticamente
     * @returns true se a preparação foi bem-sucedida
     */
    private prepare(
        pLeft: XRouterShape, 
        pRight: XRouterShape, 
        pCreateLeft: boolean, 
        pCreateRight: boolean
    ): boolean {
        this._LR = normalizeRect(pLeft.Rect);
        this._RR = normalizeRect(pRight.Rect);

        const lct = XMath.Center(this._LR);
        const rct = XMath.Center(this._RR);

        // Calcula o retângulo externo que contém ambas as formas
        let outr: XRect;
        if (!isEmptyRect(this.LeftRect) && !isEmptyRect(this.RightRect)) {
            outr = XMath.UnionRect(this.LeftRect, this.RightRect);
        } else {
            outr = XMath.UnionRect(this._LR, this._RR);
        }
        outr = XMath.InflateRect(outr, this.Gap, this.Gap);

        // Adiciona linhas verticais de conexão se houver espaço
        const vy = Math.max(this._LR.Left, this._RR.Left) - Math.min(
            this._LR.Right ?? this._LR.Left + this._LR.Width, 
            this._RR.Right ?? this._RR.Left + this._RR.Width
        );
        
        if (vy > 2 * this.Gap) {
            const xPos = Math.min(
                this._LR.Right ?? this._LR.Left + this._LR.Width, 
                this._RR.Right ?? this._RR.Left + this._RR.Width
            ) + vy / 2;
            
            this.AllLines.push(createRouterLine([
                { X: xPos, Y: outr.Top },
                { X: xPos, Y: outr.Bottom ?? outr.Top + outr.Height }
            ]));
        }

        // Adiciona linhas horizontais de conexão se houver espaço
        const vx = Math.max(this._LR.Top, this._RR.Top) - Math.min(
            this._LR.Bottom ?? this._LR.Top + this._LR.Height, 
            this._RR.Bottom ?? this._RR.Top + this._RR.Height
        );
        
        if (vx > 2 * this.Gap) {
            const yPos = Math.min(
                this._LR.Bottom ?? this._LR.Top + this._LR.Height, 
                this._RR.Bottom ?? this._RR.Top + this._RR.Height
            ) + vx / 2;
            
            this.AllLines.push(createRouterLine([
                { X: outr.Left, Y: yPos },
                { X: outr.Right ?? outr.Left + outr.Width, Y: yPos }
            ]));
        }

        // Cria linhas de saída/entrada se necessário
        if (pCreateLeft || this.LeftLines.length === 0) {
            this.LeftLines = this.addShapeLines(pLeft, lct, outr, -1);
        }
        
        if (pCreateRight || this.RightLines.length === 0) {
            this.RightLines = this.addShapeLines(pRight, rct, outr, -1);
        }

        // Adiciona as linhas do polígono externo
        const lns = XMath.ToPolygonEx(outr, 0);
        for (const ln of lns) {
            this.AllLines.push(createRouterLine(ln));
        }

        return true;
    }

    /**
     * Segue uma linha procurando conexões com outras linhas
     * @param pSource - Pontos da linha atual
     * @param pTarget - Linhas alvo para conexão
     * @param pEndLines - Linhas finais (destino)
     * @param pPast - Conjunto de IDs já visitados
     * @param pTabs - Nível de tabulação (debug)
     * @param pHopes - Número de "saltos" realizados
     * @param pUseEnd - Usar linha final diretamente
     */
    private followLine(
        pSource: XPoint[],
        pTarget: XRouterLine[],
        pEndLines: XRouterLine[],
        pPast: Set<string>,
        pTabs: number,
        pHopes: number = 1,
        pUseEnd: boolean = false
    ): void {
        // Verifica limite de iterações
        this.Steps++;
        if (this.Steps > this._MaxIterations) {
            return;
        }

        const cnt = pSource.length - 1;
        if (cnt < 1) return;

        const p1 = pSource[cnt - 1];
        const p2 = pSource[cnt];

        // Cria retângulos de verificação com margem
        const rr = XMath.InflateRect(this._RR, -2, -2);
        const rl = XMath.InflateRect(this._LR, -2, -2);

        // Procura interseções com linhas alvo
        for (const rln of pTarget) {
            if (pPast.has(rln.ID)) continue;

            // Verifica interseção entre as linhas
            const pcr = XMath.LineIntersection(p1, p2, rln.Points[0], rln.Points[1]);
            
            // Pula se não há interseção ou se a linha cruza os retângulos origem/destino
            if (isNaN(pcr.X) || 
                XMath.LineIntersectsRect(rl, rln.Points[0], rln.Points[1]) || 
                XMath.LineIntersectsRect(rr, rln.Points[0], rln.Points[1])) {
                continue;
            }

            pPast.add(rln.ID);

            // Cria duas variantes da linha (seguindo em cada direção)
            const pts = clonePoints(pSource);
            const cl1 = [...pts];
            const cl2 = [...pts];

            cl1[cnt] = pcr;
            cl1.push(rln.Points[0]);
            
            cl2[cnt] = pcr;
            cl2.push(rln.Points[1]);

            // Verifica se alguma linha final pode ser alcançada diretamente
            for (const endln of pEndLines) {
                if (endln.ID === rln.ID) continue;

                const pcrEnd = XMath.LineIntersection(p1, p2, endln.Points[0], endln.Points[1]);
                if (isNaN(pcrEnd.X)) continue;

                const cl3 = [...pts];
                cl3[cnt] = pcrEnd;
                cl3.push(endln.Points[0]);
                
                this.SolvedLines.push(createRouterLine(cl3));
            }

            // Continua seguindo recursivamente
            this.followLine(cl1, pTarget, pEndLines, new Set(pPast), pTabs + 2, pHopes + 1);
            this.followLine(cl2, pTarget, pEndLines, new Set(pPast), pTabs + 2, pHopes + 1);
        }
    }

    /**
     * Calcula o ponto de início para uma direção específica
     * @param pDegree - Direção em graus (0, 90, 180, 270)
     * @param pPoint - Ponto de referência
     * @param pCenter - Centro da forma
     * @param pShape - Retângulo da forma
     * @param pOuterRect - Retângulo externo
     * @returns Array com [ponto inicial, ponto final]
     */
    private getStartPoint(
        pDegree: number, 
        pPoint: XPoint, 
        pCenter: XPoint, 
        pShape: XRect, 
        pOuterRect: XRect
    ): XPoint[] {
        let pt1 = { ...pPoint };
        let pt2 = { ...pPoint };

        const shapeRight = pShape.Right ?? pShape.Left + pShape.Width;
        const shapeBottom = pShape.Bottom ?? pShape.Top + pShape.Height;
        const outerRight = pOuterRect.Right ?? pOuterRect.Left + pOuterRect.Width;
        const outerBottom = pOuterRect.Bottom ?? pOuterRect.Top + pOuterRect.Height;

        switch (pDegree) {
            case XRouterDirection.North: // 0 - Norte (saída pelo topo)
                if (isNaN(pPoint.X) && isNaN(pPoint.Y)) {
                    pt1 = { X: pCenter.X, Y: pShape.Top };
                    pt2 = { X: pCenter.X, Y: pOuterRect.Top };
                } else if (isNaN(pPoint.Y)) {
                    pt1 = { X: pPoint.X, Y: pShape.Top };
                    pt2 = { X: pPoint.X, Y: pOuterRect.Top };
                } else if (isNaN(pPoint.X)) {
                    pt1 = { X: pCenter.X, Y: pPoint.Y };
                    pt2 = { X: pCenter.X, Y: pOuterRect.Top };
                } else {
                    pt2 = { X: pPoint.X, Y: pOuterRect.Top };
                }
                break;

            case XRouterDirection.East: // 90 - Leste (saída pela direita)
                if (isNaN(pPoint.X) && isNaN(pPoint.Y)) {
                    pt1 = { X: shapeRight, Y: pCenter.Y };
                    pt2 = { X: outerRight, Y: pCenter.Y };
                } else if (isNaN(pPoint.Y)) {
                    pt1 = { X: pPoint.X, Y: pCenter.Y };
                    pt2 = { X: outerRight, Y: pCenter.Y };
                } else if (isNaN(pPoint.X)) {
                    pt1 = { X: shapeRight, Y: pPoint.Y };
                    pt2 = { X: outerRight, Y: pPoint.Y };
                } else {
                    pt2 = { X: outerRight, Y: pPoint.Y };
                }
                break;

            case XRouterDirection.South: // 180 - Sul (saída pelo fundo)
                if (isNaN(pPoint.X) && isNaN(pPoint.Y)) {
                    pt1 = { X: pCenter.X, Y: shapeBottom };
                    pt2 = { X: pCenter.X, Y: outerBottom };
                } else if (isNaN(pPoint.Y)) {
                    pt1 = { X: pPoint.X, Y: shapeBottom };
                    pt2 = { X: pPoint.X, Y: outerBottom };
                } else if (isNaN(pPoint.X)) {
                    pt1 = { X: pCenter.X, Y: pPoint.Y };
                    pt2 = { X: pCenter.X, Y: outerBottom };
                } else {
                    pt2 = { X: pPoint.X, Y: outerBottom };
                }
                break;

            case XRouterDirection.West: // 270 - Oeste (saída pela esquerda)
                if (isNaN(pPoint.X) && isNaN(pPoint.Y)) {
                    pt1 = { X: pShape.Left, Y: pCenter.Y };
                    pt2 = { X: pOuterRect.Left, Y: pCenter.Y };
                } else if (isNaN(pPoint.Y)) {
                    pt1 = { X: pPoint.X, Y: pCenter.Y };
                    pt2 = { X: pOuterRect.Left, Y: pCenter.Y };
                } else if (isNaN(pPoint.X)) {
                    pt1 = { X: pShape.Left, Y: pPoint.Y };
                    pt2 = { X: pOuterRect.Left, Y: pPoint.Y };
                } else {
                    pt1 = pPoint;
                    pt2 = { X: pOuterRect.Left, Y: pPoint.Y };
                }
                break;
        }

        return [pt1, pt2];
    }

    /**
     * Adiciona linhas de saída para uma forma baseado nas direções desejadas
     * @param pShape - Forma de roteamento
     * @param pCenter - Centro da forma
     * @param pOuterRect - Retângulo externo
     * @param pSuppress - Direção a suprimir (-1 para nenhuma)
     * @returns Lista de linhas de saída
     */
    private addShapeLines(
        pShape: XRouterShape, 
        pCenter: XPoint, 
        pOuterRect: XRect, 
        pSuppress: number
    ): XRouterLine[] {
        const lines: XRouterLine[] = [];

        for (const dg of pShape.DesiredDegree) {
            if (pSuppress === dg) continue;

            const points = this.getStartPoint(dg, pShape.StartPoint, pCenter, pShape.Rect, pOuterRect);
            lines.push(createRouterLine(points, dg, dg));
        }

        return lines;
    }

    /**
     * Calcula o comprimento total de uma linha
     * @param pPoints - Pontos da linha
     * @returns Comprimento total
     */
    private getLineLength(pPoints: XPoint[]): number {
        let ret = 0;
        for (let i = 1; i < pPoints.length; i++) {
            ret += XMath.Distance2Points(pPoints[i - 1], pPoints[i]);
        }
        return ret;
    }

    /**
     * Verifica se uma linha colide com algum retângulo obstáculo
     * @param pPoints - Pontos da linha
     * @returns true se há colisão
     */
    private hasRectCollision(pPoints: XPoint[]): boolean {
        for (const rect of this.Rects) {
            if (rect === this.LeftRect || rect === this.RightRect) continue;
            
            if (this.intersectsRect(rect, pPoints)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Verifica se uma linha intersecta um retângulo específico
     * @param pRect - Retângulo para verificar
     * @param pPoints - Pontos da linha
     * @returns true se há interseção
     */
    private intersectsRect(pRect: XRect, pPoints: XPoint[]): boolean {
        if (!this.CheckCrossRect) return false;

        for (let i = 1; i < pPoints.length; i++) {
            if (XMath.LineIntersectsRect(pRect, pPoints[i - 1], pPoints[i])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Obtém o resultado completo do roteamento
     * @returns Objeto com todos os resultados
     */
    public getResult(): XRouterResult {
        return {
            bestLine: this.BestLine,
            allLines: this.AllLines,
            finalLines: this.FinalLines,
            steps: this.Steps,
            success: this.BestLine.IsValid
        };
    }

    /**
     * Adiciona um retângulo obstáculo
     * @param rect - Retângulo a adicionar
     */
    public addObstacle(rect: XRect): void {
        this.Rects.push(normalizeRect(rect));
    }

    /**
     * Remove todos os obstáculos
     */
    public clearObstacles(): void {
        this.Rects = [];
    }

    /**
     * Define os retângulos origem e destino
     * @param left - Retângulo de origem
     * @param right - Retângulo de destino
     */
    public setEndpoints(left: XRect, right: XRect): void {
        this.LeftRect = normalizeRect(left);
        this.RightRect = normalizeRect(right);
    }
}
