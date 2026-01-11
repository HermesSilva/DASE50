/**
 * XMath - Utilitários matemáticos para geometria 2D
 * Traduzido e melhorado do C# original TFX.DASE.Core
 * @module Designers/ORM/Routing/XMath
 */

import { XPoint, XRect } from "./XRouterTypes";

/**
 * Classe utilitária com funções matemáticas para geometria 2D
 */
export class XMath {
    /**
     * Arredonda um valor para um número específico de casas decimais
     * @param value - Valor a ser arredondado
     * @param decimals - Número de casas decimais
     * @returns Valor arredondado
     */
    static Round(value: number, decimals: number): number {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    /**
     * Arredonda um retângulo para um número específico de casas decimais
     * @param rect - Retângulo a ser arredondado
     * @param decimals - Número de casas decimais
     * @returns Novo retângulo com valores arredondados
     */
    static RoundRect(rect: XRect, decimals: number): XRect {
        return {
            Left: XMath.Round(rect.Left, decimals),
            Top: XMath.Round(rect.Top, decimals),
            Width: XMath.Round(rect.Width, decimals),
            Height: XMath.Round(rect.Height, decimals),
            Right: XMath.Round(rect.Left + rect.Width, decimals),
            Bottom: XMath.Round(rect.Top + rect.Height, decimals),
            IsEmpty: rect.Width === 0 && rect.Height === 0
        };
    }

    /**
     * Calcula o centro de um retângulo
     * @param rect - Retângulo
     * @returns Ponto central
     */
    static Center(rect: XRect): XPoint {
        return {
            X: rect.Left + rect.Width / 2,
            Y: rect.Top + rect.Height / 2
        };
    }

    /**
     * Calcula a distância entre dois pontos
     * @param p1 - Primeiro ponto
     * @param p2 - Segundo ponto
     * @returns Distância euclidiana
     */
    static Distance2Points(p1: XPoint, p2: XPoint): number {
        const dx = p2.X - p1.X;
        const dy = p2.Y - p1.Y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calcula a distância ao quadrado entre dois pontos (mais eficiente quando não precisa do valor exato)
     * @param p1 - Primeiro ponto
     * @param p2 - Segundo ponto
     * @returns Distância ao quadrado
     */
    static Distance2PointsSquared(p1: XPoint, p2: XPoint): number {
        const dx = p2.X - p1.X;
        const dy = p2.Y - p1.Y;
        return dx * dx + dy * dy;
    }

    /**
     * Move um ponto por um deslocamento definido por tamanho
     * @param point - Ponto original
     * @param size - Tamanho do deslocamento (Width, Height)
     * @returns Novo ponto deslocado
     */
    static MovePoint(point: XPoint, size: { Width: number; Height: number }): XPoint {
        return {
            X: point.X + size.Width,
            Y: point.Y + size.Height
        };
    }

    /**
     * Encontra o ponto de interseção entre duas linhas
     * @param p1 - Ponto inicial da primeira linha
     * @param p2 - Ponto final da primeira linha
     * @param p3 - Ponto inicial da segunda linha
     * @param p4 - Ponto final da segunda linha
     * @returns Ponto de interseção ou ponto com NaN se não há interseção
     */
    static LineIntersection(p1: XPoint, p2: XPoint, p3: XPoint, p4: XPoint): XPoint {
        const x1 = p1.X, y1 = p1.Y;
        const x2 = p2.X, y2 = p2.Y;
        const x3 = p3.X, y3 = p3.Y;
        const x4 = p4.X, y4 = p4.Y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < 1e-10) {
            return { X: NaN, Y: NaN };
        }

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        // Verifica se a interseção está dentro de ambos os segmentos
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                X: x1 + t * (x2 - x1),
                Y: y1 + t * (y2 - y1)
            };
        }

        return { X: NaN, Y: NaN };
    }

    /**
     * Verifica se uma linha intersecta um retângulo
     * @param rect - Retângulo para verificar
     * @param p1 - Ponto inicial da linha
     * @param p2 - Ponto final da linha
     * @returns true se a linha intersecta o retângulo
     */
    static LineIntersectsRect(rect: XRect, p1: XPoint, p2: XPoint): boolean {
        // Algoritmo de Cohen-Sutherland simplificado
        const left = rect.Left;
        const right = rect.Left + rect.Width;
        const top = rect.Top;
        const bottom = rect.Top + rect.Height;

        // Verifica interseção com cada lado do retângulo
        const topLeft: XPoint = { X: left, Y: top };
        const topRight: XPoint = { X: right, Y: top };
        const bottomLeft: XPoint = { X: left, Y: bottom };
        const bottomRight: XPoint = { X: right, Y: bottom };

        // Verifica se algum endpoint está dentro do retângulo
        if (XMath.PointInRect(rect, p1) || XMath.PointInRect(rect, p2)) {
            return true;
        }

        // Verifica interseção com cada lado
        if (!isNaN(XMath.LineIntersection(p1, p2, topLeft, topRight).X)) return true;
        if (!isNaN(XMath.LineIntersection(p1, p2, topRight, bottomRight).X)) return true;
        if (!isNaN(XMath.LineIntersection(p1, p2, bottomRight, bottomLeft).X)) return true;
        if (!isNaN(XMath.LineIntersection(p1, p2, bottomLeft, topLeft).X)) return true;

        return false;
    }

    /**
     * Verifica se um ponto está dentro de um retângulo
     * @param rect - Retângulo
     * @param point - Ponto para verificar
     * @returns true se o ponto está dentro do retângulo
     */
    static PointInRect(rect: XRect, point: XPoint): boolean {
        return point.X >= rect.Left && 
               point.X <= rect.Left + rect.Width &&
               point.Y >= rect.Top && 
               point.Y <= rect.Top + rect.Height;
    }

    /**
     * Converte um retângulo em um polígono (array de linhas)
     * Retorna as 4 linhas que formam o retângulo com extensão opcional
     * @param rect - Retângulo para converter
     * @param pInflateLine - Extensão das linhas além dos cantos
     * @returns Array de arrays de pontos, cada um representando uma linha
     */
    static ToPolygonEx(rect: XRect, pInflateLine: number = 0): XPoint[][] {
        const left = rect.Left;
        const right = rect.Right ?? rect.Left + rect.Width;
        const top = rect.Top;
        const bottom = rect.Bottom ?? rect.Top + rect.Height;

        // Seguindo exatamente a lógica do C# original
        return [
            // Linha superior (horizontal) - estendida horizontalmente
            [{ X: left - pInflateLine, Y: top }, { X: right + pInflateLine, Y: top }],
            // Linha direita (vertical) - estendida verticalmente
            [{ X: right, Y: top - pInflateLine }, { X: right, Y: bottom + pInflateLine }],
            // Linha inferior (horizontal) - estendida horizontalmente, direção inversa
            [{ X: right + pInflateLine, Y: bottom }, { X: left - pInflateLine, Y: bottom }],
            // Linha esquerda (vertical) - estendida verticalmente, direção inversa
            [{ X: left, Y: bottom + pInflateLine }, { X: left, Y: top - pInflateLine }]
        ];
    }

    /**
     * Cria uma seta para desenho
     * @param tip - Ponto da ponta da seta
     * @param tail - Ponto da cauda (direção)
     * @param size - Tamanho da seta
     * @returns Array de pontos formando a seta
     */
    static CreateArrow(tip: XPoint, tail: XPoint, size: number): XPoint[] {
        const angle = Math.atan2(tip.Y - tail.Y, tip.X - tail.X);
        const arrowAngle = Math.PI / 6; // 30 graus
        
        const halfSize = size / 2;
        
        const p1: XPoint = {
            X: tip.X - halfSize * Math.cos(angle - arrowAngle),
            Y: tip.Y - halfSize * Math.sin(angle - arrowAngle)
        };
        
        const p2: XPoint = {
            X: tip.X - halfSize * Math.cos(angle + arrowAngle),
            Y: tip.Y - halfSize * Math.sin(angle + arrowAngle)
        };
        
        return [p1, tip, p2];
    }

    /**
     * Infla um retângulo por uma quantidade específica
     * @param rect - Retângulo original
     * @param dx - Inflação horizontal
     * @param dy - Inflação vertical
     * @returns Novo retângulo inflado
     */
    static InflateRect(rect: XRect, dx: number, dy: number): XRect {
        return {
            Left: rect.Left - dx,
            Top: rect.Top - dy,
            Width: rect.Width + 2 * dx,
            Height: rect.Height + 2 * dy,
            Right: rect.Left + rect.Width + dx,
            Bottom: rect.Top + rect.Height + dy,
            IsEmpty: false
        };
    }

    /**
     * Une dois retângulos, retornando o menor retângulo que contém ambos
     * @param rect1 - Primeiro retângulo
     * @param rect2 - Segundo retângulo
     * @returns Retângulo união
     */
    static UnionRect(rect1: XRect, rect2: XRect): XRect {
        if (rect1.IsEmpty) return rect2;
        if (rect2.IsEmpty) return rect1;

        const left = Math.min(rect1.Left, rect2.Left);
        const top = Math.min(rect1.Top, rect2.Top);
        const right = Math.max(rect1.Right ?? rect1.Left + rect1.Width, rect2.Right ?? rect2.Left + rect2.Width);
        const bottom = Math.max(rect1.Bottom ?? rect1.Top + rect1.Height, rect2.Bottom ?? rect2.Top + rect2.Height);

        return {
            Left: left,
            Top: top,
            Width: right - left,
            Height: bottom - top,
            Right: right,
            Bottom: bottom,
            IsEmpty: false
        };
    }

    /**
     * Cria um retângulo vazio
     * @returns Retângulo vazio
     */
    static EmptyRect(): XRect {
        return {
            Left: 0,
            Top: 0,
            Width: 0,
            Height: 0,
            Right: 0,
            Bottom: 0,
            IsEmpty: true
        };
    }

    /**
     * Cria um retângulo a partir de dois pontos
     * @param p1 - Primeiro ponto (canto)
     * @param p2 - Segundo ponto (canto oposto)
     * @returns Retângulo normalizado
     */
    static RectFromPoints(p1: XPoint, p2: XPoint): XRect {
        const left = Math.min(p1.X, p2.X);
        const top = Math.min(p1.Y, p2.Y);
        const right = Math.max(p1.X, p2.X);
        const bottom = Math.max(p1.Y, p2.Y);

        return {
            Left: left,
            Top: top,
            Width: right - left,
            Height: bottom - top,
            Right: right,
            Bottom: bottom,
            IsEmpty: false
        };
    }

    /**
     * Normaliza um ângulo para o intervalo [0, 360)
     * @param angle - Ângulo em graus
     * @returns Ângulo normalizado
     */
    static NormalizeAngle(angle: number): number {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Converte graus para radianos
     * @param degrees - Ângulo em graus
     * @returns Ângulo em radianos
     */
    static DegreesToRadians(degrees: number): number {
        return degrees * Math.PI / 180;
    }

    /**
     * Converte radianos para graus
     * @param radians - Ângulo em radianos
     * @returns Ângulo em graus
     */
    static RadiansToDegrees(radians: number): number {
        return radians * 180 / Math.PI;
    }

    /**
     * Clamp de um valor entre mínimo e máximo
     * @param value - Valor a ser limitado
     * @param min - Valor mínimo
     * @param max - Valor máximo
     * @returns Valor limitado
     */
    static Clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Interpolação linear entre dois valores
     * @param a - Valor inicial
     * @param b - Valor final
     * @param t - Parâmetro de interpolação (0-1)
     * @returns Valor interpolado
     */
    static Lerp(a: number, b: number, t: number): number {
        return a + (b - a) * XMath.Clamp(t, 0, 1);
    }

    /**
     * Interpolação linear entre dois pontos
     * @param p1 - Ponto inicial
     * @param p2 - Ponto final
     * @param t - Parâmetro de interpolação (0-1)
     * @returns Ponto interpolado
     */
    static LerpPoint(p1: XPoint, p2: XPoint, t: number): XPoint {
        return {
            X: XMath.Lerp(p1.X, p2.X, t),
            Y: XMath.Lerp(p1.Y, p2.Y, t)
        };
    }

    // ==================== Funções adicionais do C# original ====================

    /**
     * Calcula o ângulo em graus entre dois pontos
     * @param pFirst - Primeiro ponto
     * @param pSecond - Segundo ponto
     * @returns Ângulo em graus (0-360)
     */
    static AngleInDegree(pFirst: XPoint, pSecond: XPoint): number {
        const rad = Math.atan2(pFirst.Y - pSecond.Y, pFirst.X - pSecond.X);
        const pi2 = 2 * Math.PI;
        let result = (pi2 + rad + Math.PI / 2) % pi2;
        if (result < 0) result += pi2;
        return result * 360 / pi2;
    }

    /**
     * Calcula o ângulo em radianos entre dois pontos
     * @param pFirst - Primeiro ponto
     * @param pSecond - Segundo ponto
     * @returns Ângulo em radianos
     */
    static AngleInRad(pFirst: XPoint, pSecond: XPoint): number {
        let degree: number;
        if (pFirst.X === pSecond.X) {
            degree = pFirst.Y < pSecond.Y ? Math.PI * 1.5 : Math.PI / 2.0;
        } else {
            degree = Math.atan((pSecond.Y - pFirst.Y) / (pFirst.X - pSecond.X));
        }
        if (pSecond.X < pFirst.X) {
            degree = degree + Math.PI;
        }
        degree = degree + (Math.PI / 2.0);
        return degree;
    }

    /**
     * Calcula o ponto central de uma linha
     * @param pFirst - Primeiro ponto
     * @param pSecond - Segundo ponto
     * @returns Ponto central
     */
    static CenterLine(pFirst: XPoint, pSecond: XPoint): XPoint {
        return {
            X: pFirst.X - ((pFirst.X - pSecond.X) / 2),
            Y: pFirst.Y - ((pFirst.Y - pSecond.Y) / 2)
        };
    }

    /**
     * Rotaciona um ponto em torno de um centro
     * @param pCenter - Centro de rotação
     * @param pPoint - Ponto a rotacionar
     * @param pDegree - Ângulo em graus
     * @returns Ponto rotacionado
     */
    static RotatePoint(pCenter: XPoint, pPoint: XPoint, pDegree: number): XPoint {
        const length = XMath.Distance2Points(pPoint, pCenter);
        const degree = XMath.AngleInRad(pPoint, pCenter) + ((pDegree * Math.PI) / 180.0);
        return {
            X: pCenter.X - (length * Math.sin(degree)),
            Y: pCenter.Y - (length * Math.cos(degree))
        };
    }

    /**
     * Rotaciona múltiplos pontos em torno de um centro
     * @param pCenter - Centro de rotação
     * @param pPoints - Array de pontos a rotacionar
     * @param pDegree - Ângulo em graus
     * @returns Array de pontos rotacionados
     */
    static RotatePoints(pCenter: XPoint, pPoints: XPoint[], pDegree: number): XPoint[] {
        return pPoints.map(p => XMath.RotatePoint(pCenter, p, pDegree));
    }

    /**
     * Encontra o ponto mais próximo em uma linha a partir de um ponto
     * @param pFirst - Primeiro ponto da linha
     * @param pSecond - Segundo ponto da linha
     * @param pPoint - Ponto de referência
     * @returns Ponto mais próximo na linha
     */
    static PointInLine(pFirst: XPoint, pSecond: XPoint, pPoint: XPoint): XPoint {
        const dx = pSecond.X - pFirst.X;
        const dy = pSecond.Y - pFirst.Y;

        if (dx === 0 && dy === 0) {
            return { X: pFirst.X, Y: pFirst.Y };
        }

        const t = (((pPoint.X - pFirst.X) * dx) + ((pPoint.Y - pFirst.Y) * dy)) / ((dx * dx) + (dy * dy));

        if (t < 0) {
            return pFirst;
        } else if (t > 1) {
            return pSecond;
        }
        
        return {
            X: pFirst.X + (t * dx),
            Y: pFirst.Y + (t * dy)
        };
    }

    /**
     * Calcula a distância de um ponto a uma linha
     * @param pFirst - Primeiro ponto da linha
     * @param pSecond - Segundo ponto da linha
     * @param pPoint - Ponto de referência
     * @returns Distância do ponto à linha
     */
    static PointToLine(pFirst: XPoint, pSecond: XPoint, pPoint: XPoint): number {
        const ptNearest = XMath.PointInLine(pFirst, pSecond, pPoint);
        const ndx = pPoint.X - ptNearest.X;
        const ndy = pPoint.Y - ptNearest.Y;
        return Math.sqrt((ndx * ndx) + (ndy * ndy));
    }

    /**
     * Verifica se um ponto está dentro de um polígono
     * @param pPolygon - Array de pontos formando o polígono
     * @param pPoint - Ponto para verificar
     * @returns true se o ponto está dentro do polígono
     */
    static PointInPolygon(pPolygon: XPoint[], pPoint: XPoint): boolean {
        if (pPolygon.length < 3) return false;

        let inside = false;
        let pt: XPoint = { X: pPolygon[pPolygon.length - 1].X, Y: pPolygon[pPolygon.length - 1].Y };

        for (let i = 0; i < pPolygon.length; i++) {
            const newPoint: XPoint = { X: pPolygon[i].X, Y: pPolygon[i].Y };
            let p1: XPoint, p2: XPoint;

            if (newPoint.X > pt.X) {
                p1 = pt;
                p2 = newPoint;
            } else {
                p1 = newPoint;
                p2 = pt;
            }

            if ((newPoint.X < pPoint.X) === (pPoint.X <= pt.X) &&
                (pPoint.Y - p1.Y) * (p2.X - p1.X) < (p2.Y - p1.Y) * (pPoint.X - p1.X)) {
                inside = !inside;
            }
            pt = newPoint;
        }

        return inside;
    }

    /**
     * Encontra a interseção de uma linha com um polígono
     * @param pPolygon - Array de pontos formando o polígono
     * @param pP1 - Primeiro ponto da linha
     * @param pP2 - Segundo ponto da linha
     * @returns Objeto com ponto de interseção e índice do segmento
     */
    static CrossLineInPolygon(pPolygon: XPoint[], pP1: XPoint, pP2: XPoint): { point: XPoint; index: number } {
        const nanPoint: XPoint = { X: NaN, Y: NaN };
        
        if (!XMath.PointInPolygon(pPolygon, pP1)) {
            return { point: nanPoint, index: -1 };
        }

        for (let i = 0; i < pPolygon.length - 1; i++) {
            const pt = XMath.LineIntersection(pPolygon[i], pPolygon[i + 1], pP1, pP2);
            if (!isNaN(pt.X)) {
                return { point: pt, index: i };
            }
        }

        return { point: nanPoint, index: -1 };
    }

    /**
     * Encontra interseções de uma linha com um círculo
     * @param pCenter - Centro do círculo
     * @param pRadius - Raio do círculo
     * @param pPoint1 - Primeiro ponto da linha
     * @param pPoint2 - Segundo ponto da linha
     * @returns Array de pontos de interseção (0, 1 ou 2)
     */
    static LineCircleIntersections(pCenter: XPoint, pRadius: number, pPoint1: XPoint, pPoint2: XPoint): XPoint[] {
        const cx = pCenter.X;
        const cy = pCenter.Y;
        const dx = pPoint2.X - pPoint1.X;
        const dy = pPoint2.Y - pPoint1.Y;

        const A = dx * dx + dy * dy;
        const B = 2 * (dx * (pPoint1.X - cx) + dy * (pPoint1.Y - cy));
        const C = (pPoint1.X - cx) * (pPoint1.X - cx) + (pPoint1.Y - cy) * (pPoint1.Y - cy) - pRadius * pRadius;

        const det = B * B - 4 * A * C;

        if (A <= 0.0000001 || det < 0) {
            return [];
        }

        if (det === 0) {
            const t = -B / (2 * A);
            return [{ X: pPoint1.X + t * dx, Y: pPoint1.Y + t * dy }];
        } else {
            const t1 = (-B + Math.sqrt(det)) / (2 * A);
            const t2 = (-B - Math.sqrt(det)) / (2 * A);
            return [
                { X: pPoint1.X + t1 * dx, Y: pPoint1.Y + t1 * dy },
                { X: pPoint1.X + t2 * dx, Y: pPoint1.Y + t2 * dy }
            ];
        }
    }

    /**
     * Calcula um ponto em um círculo dado um centro, ponto de direção e raio
     * @param pCenter - Centro do círculo
     * @param pPoint - Ponto de direção
     * @param pRadiusX - Raio X (horizontal)
     * @param pRadiusY - Raio Y (vertical, opcional - usa pRadiusX se não fornecido)
     * @returns Ponto no círculo/elipse
     */
    static PointCircle(pCenter: XPoint, pPoint: XPoint, pRadiusX: number, pRadiusY: number = -1): XPoint {
        if (pRadiusY === -1) pRadiusY = pRadiusX;
        const dg = XMath.AngleInRad(pCenter, pPoint) + Math.PI;
        return {
            X: pCenter.X - (pRadiusX * Math.sin(dg)),
            Y: pCenter.Y - (pRadiusY * Math.cos(dg))
        };
    }

    /**
     * Converte um retângulo em um polígono fechado (5 pontos)
     * @param pRect - Retângulo para converter
     * @returns Array de pontos formando o polígono
     */
    static ToPolygon(pRect: XRect): XPoint[] {
        const right = pRect.Right ?? pRect.Left + pRect.Width;
        const bottom = pRect.Bottom ?? pRect.Top + pRect.Height;
        return [
            { X: pRect.Left, Y: pRect.Top },
            { X: right, Y: pRect.Top },
            { X: right, Y: bottom },
            { X: pRect.Left, Y: bottom },
            { X: pRect.Left, Y: pRect.Top }  // Fecha o polígono
        ];
    }

    /**
     * Converte um array de pontos em um retângulo
     * @param pPoints - Array de pontos
     * @returns Retângulo que contém todos os pontos
     */
    static ToRect(pPoints: XPoint[]): XRect {
        if (!pPoints || pPoints.length === 0) {
            return XMath.EmptyRect();
        }

        const minX = Math.min(...pPoints.map(p => p.X));
        const minY = Math.min(...pPoints.map(p => p.Y));
        const maxX = Math.max(...pPoints.map(p => p.X));
        const maxY = Math.max(...pPoints.map(p => p.Y));

        return {
            Left: minX,
            Top: minY,
            Width: maxX - minX,
            Height: maxY - minY,
            Right: maxX,
            Bottom: maxY,
            IsEmpty: false
        };
    }

    /**
     * Arredonda um ponto usando um fator
     * @param pPoint - Ponto a arredondar
     * @param pFactor - Fator de arredondamento
     * @returns Ponto arredondado
     */
    static RoundPoint(pPoint: XPoint, pFactor: number): XPoint {
        return {
            X: XMath.RoundToFactor(pPoint.X, pFactor),
            Y: XMath.RoundToFactor(pPoint.Y, pFactor)
        };
    }

    /**
     * Arredonda um valor usando um fator (diferente de casas decimais)
     * @param pValue - Valor a arredondar
     * @param pFactor - Fator de arredondamento
     * @returns Valor arredondado
     */
    static RoundToFactor(pValue: number, pFactor: number): number {
        if (isNaN(pValue) || !isFinite(pValue)) return 0;
        const v = Math.round(pValue / pFactor);
        return v * pFactor;
    }

    /**
     * Arredonda um array de pontos usando um fator
     * @param pPoints - Array de pontos
     * @param pFactor - Fator de arredondamento
     * @returns Array de pontos arredondados
     */
    static RoundPoints(pPoints: XPoint[], pFactor: number): XPoint[] {
        if (!pPoints || pPoints.length === 0) return pPoints;
        return pPoints.map(p => XMath.RoundPoint(p, pFactor));
    }

    /**
     * Ajusta um ponto para uma grade
     * @param pPoint - Ponto a ajustar
     * @param pGridLen - Tamanho da grade
     * @returns Ponto ajustado
     */
    static ToGrid(pPoint: XPoint, pGridLen: number): XPoint {
        if (pGridLen <= 0) return pPoint;
        return {
            X: Math.round(pPoint.X / pGridLen) * pGridLen,
            Y: Math.round(pPoint.Y / pGridLen) * pGridLen
        };
    }

    /**
     * Ajusta um retângulo para uma grade
     * @param pRect - Retângulo a ajustar
     * @param pGridLen - Tamanho da grade
     * @returns Retângulo ajustado
     */
    static RectToGrid(pRect: XRect, pGridLen: number): XRect {
        if (pGridLen <= 0) return pRect;
        const topLeft = XMath.ToGrid({ X: pRect.Left, Y: pRect.Top }, pGridLen);
        const size = XMath.SizeToGrid({ Width: pRect.Width, Height: pRect.Height }, pGridLen);
        return {
            Left: topLeft.X,
            Top: topLeft.Y,
            Width: size.Width,
            Height: size.Height,
            Right: topLeft.X + size.Width,
            Bottom: topLeft.Y + size.Height,
            IsEmpty: false
        };
    }

    /**
     * Ajusta um tamanho para uma grade
     * @param pSize - Tamanho a ajustar
     * @param pGridLen - Tamanho da grade
     * @returns Tamanho ajustado
     */
    static SizeToGrid(pSize: { Width: number; Height: number }, pGridLen: number): { Width: number; Height: number } {
        if (pGridLen <= 0) return pSize;
        return {
            Width: Math.round(pSize.Width / pGridLen) * pGridLen,
            Height: Math.round(pSize.Height / pGridLen) * pGridLen
        };
    }

    /**
     * Limita um valor entre mínimo e máximo (alias para Clamp)
     * @param pValue - Valor a limitar
     * @param pMin - Mínimo
     * @param pMax - Máximo
     * @returns Valor limitado
     */
    static MinMax(pValue: number, pMin: number, pMax: number): number {
        return Math.min(Math.max(pValue, pMin), pMax);
    }

    /**
     * Verifica se há interseção entre duas linhas (retorna boolean)
     * @param pP1Line1 - Ponto 1 da linha 1
     * @param pP2Line1 - Ponto 2 da linha 1
     * @param pP1Line2 - Ponto 1 da linha 2
     * @param pP2Line2 - Ponto 2 da linha 2
     * @returns true se há interseção
     */
    static HasLineIntersection(pP1Line1: XPoint, pP2Line1: XPoint, pP1Line2: XPoint, pP2Line2: XPoint): boolean {
        const pt = XMath.LineIntersection(pP1Line1, pP2Line1, pP1Line2, pP2Line2);
        return !isNaN(pt.X) && !isNaN(pt.Y);
    }

    /**
     * Verifica se duas linhas se intersectam (algoritmo auxiliar)
     * @param l1p1 - Ponto 1 da linha 1
     * @param l1p2 - Ponto 2 da linha 1
     * @param l2p1 - Ponto 1 da linha 2
     * @param l2p2 - Ponto 2 da linha 2
     * @returns true se há interseção
     */
    static LineIntersectsLine(l1p1: XPoint, l1p2: XPoint, l2p1: XPoint, l2p2: XPoint): boolean {
        const q = (l1p1.Y - l2p1.Y) * (l2p2.X - l2p1.X) - (l1p1.X - l2p1.X) * (l2p2.Y - l2p1.Y);
        const d = (l1p2.X - l1p1.X) * (l2p2.Y - l2p1.Y) - (l1p2.Y - l1p1.Y) * (l2p2.X - l2p1.X);
        
        if (d === 0) return false;
        
        const r = q / d;
        const q2 = (l1p1.Y - l2p1.Y) * (l1p2.X - l1p1.X) - (l1p1.X - l2p1.X) * (l1p2.Y - l1p1.Y);
        const s = q2 / d;
        
        return !(r < 0 || r > 1 || s < 0 || s > 1);
    }

    /**
     * Compara dois arrays de pontos
     * @param pLeft - Primeiro array
     * @param pRight - Segundo array
     * @returns true se são iguais
     */
    static IsEqual(pLeft: XPoint[] | null | undefined, pRight: XPoint[] | null | undefined): boolean {
        const leftLen = pLeft?.length ?? 0;
        const rightLen = pRight?.length ?? 0;
        
        if (leftLen !== rightLen) return false;
        if (!pLeft || !pRight) return leftLen === rightLen;
        
        for (let i = 0; i < leftLen; i++) {
            if (pLeft[i].X !== pRight[i].X || pLeft[i].Y !== pRight[i].Y) {
                return false;
            }
        }
        return true;
    }

    /**
     * Retorna o retângulo máximo entre um retângulo e um tamanho
     * @param pRect - Retângulo original
     * @param pSize - Tamanho para comparar
     * @returns Retângulo com dimensões máximas
     */
    static MaxRect(pRect: XRect, pSize: { Width: number; Height: number }): XRect {
        return {
            Left: pRect.Left,
            Top: pRect.Top,
            Width: Math.max(pSize.Width, pRect.Width),
            Height: Math.max(pSize.Height, pRect.Height),
            Right: pRect.Left + Math.max(pSize.Width, pRect.Width),
            Bottom: pRect.Top + Math.max(pSize.Height, pRect.Height),
            IsEmpty: false
        };
    }

    /**
     * Cria um retângulo quadrado centrado em um ponto
     * @param pPoint - Centro do retângulo
     * @param pSize - Tamanho do lado do quadrado
     * @returns Retângulo centrado
     */
    static CreateRect(pPoint: XPoint, pSize: number): XRect {
        return {
            Left: pPoint.X - (pSize / 2.0),
            Top: pPoint.Y - (pSize / 2.0),
            Width: pSize,
            Height: pSize,
            Right: pPoint.X + (pSize / 2.0),
            Bottom: pPoint.Y + (pSize / 2.0),
            IsEmpty: false
        };
    }

    /**
     * Obtém o tamanho de um retângulo que contém outro retângulo rotacionado
     * @param pSize - Tamanho original
     * @param pDegree - Ângulo de rotação em radianos
     * @returns Tamanho do retângulo envolvente
     */
    static GetSizeBoxRotated(pSize: { Width: number; Height: number }, pDegree: number): { Width: number; Height: number } {
        const x = Math.abs(pSize.Width * Math.sin(pDegree)) + Math.abs(pSize.Height * Math.cos(pDegree));
        const y = Math.abs(pSize.Width * Math.cos(pDegree)) + Math.abs(pSize.Height * Math.sin(pDegree));
        return { Width: x, Height: y };
    }
}
