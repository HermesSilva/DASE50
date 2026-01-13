import { XGuid } from "../Core/XGuid.js";
import { XRect, XPoint, XColor } from "../Core/XGeometry.js";

export type XDataTypeName =
    | "String"
    | "Guid"
    | "Guid[]"
    | "Boolean"
    | "Int32"
    | "Int64"
    | "Double"
    | "Decimal"
    | "DateTime"
    | "Size"
    | "Rect"
    | "Point"
    | "Point[]"
    | "Color"
    | "Thickness"
    | "Unknown";

export interface XISize
{
    Width: number;
    Height: number;
}

export interface XIRect
{
    X: number;
    Y: number;
    Width: number;
    Height: number;
}

export interface XIPoint
{
    X: number;
    Y: number;
}

export interface XIColor
{
    A: number;
    R: number;
    G: number;
    B: number;
}

export interface XIThickness
{
    Left: number;
    Top: number;
    Right: number;
    Bottom: number;
}

export interface XITypeConverter<T>
{
    TypeName: XDataTypeName;
    ToString(pValue: T): string;
    FromString(pValue: string): T;
    IsDefault(pValue: T, pDefault: T): boolean;
}

export class XTypeConverter
{
    private static readonly _Converters: Map<XDataTypeName, XITypeConverter<unknown>> = new Map();

    static
    {
        XTypeConverter.RegisterDefaultConverters();
    }

    private static RegisterDefaultConverters(): void
    {
        XTypeConverter.Register<string>({
            TypeName: "String",
            ToString: (pValue: string): string => pValue ?? "",
            FromString: (pValue: string): string => pValue ?? "",
            IsDefault: (pValue: string, pDefault: string): boolean => pValue === pDefault
        });

        XTypeConverter.Register<string>({
            TypeName: "Guid",
            ToString: (pValue: string): string => pValue ?? XGuid.EmptyValue,
            FromString: (pValue: string): string =>
            {
                if (!pValue)
                    return XGuid.EmptyValue;
                return XGuid.IsValid(pValue) ? pValue.toUpperCase() : XGuid.EmptyValue;
            },
            
            IsDefault: (pValue: string, pDefault: string): boolean =>
                XGuid.IsEmptyValue(pValue) && XGuid.IsEmptyValue(pDefault)
        });

        XTypeConverter.Register<string[]>({
            TypeName: "Guid[]",
            ToString: (pValue: string[]): string =>
            {
                if (!pValue || pValue.length === 0)
                    return "";
                return pValue.join("|");
            },
            FromString: (pValue: string): string[] =>
            {
                if (!pValue)
                    return [];
                return pValue.split("|").filter(g => XGuid.IsValid(g));
            },
            
            IsDefault: (pValue: string[], pDefault: string[]): boolean =>
            {
                if (!pValue || !pDefault)
                    return (pValue?.length ?? 0) === 0 && (pDefault?.length ?? 0) === 0;
                if (pValue.length !== pDefault.length)
                    return false;
                return pValue.every((v, i) => v === pDefault[i]);
            }
            
        });

        XTypeConverter.Register<boolean>({
            TypeName: "Boolean",
            ToString: (pValue: boolean): string => pValue ? "true" : "false",
            FromString: (pValue: string): boolean =>
            {
                if (!pValue)
                    return false;
                return pValue.toLowerCase() === "true" || pValue === "1";
            },
            IsDefault: (pValue: boolean, pDefault: boolean): boolean => pValue === pDefault
        });

        XTypeConverter.Register<number>({
            TypeName: "Int32",
            ToString: (pValue: number): string => Math.trunc(pValue ?? 0).toString(),
            FromString: (pValue: string): number =>
            {
                const num = parseInt(pValue, 10);
                return isNaN(num) ? 0 : num;
            },
            IsDefault: (pValue: number, pDefault: number): boolean => pValue === pDefault
        });

        XTypeConverter.Register<number>({
            TypeName: "Int64",
            ToString: (pValue: number): string => Math.trunc(pValue ?? 0).toString(),
            FromString: (pValue: string): number =>
            {
                const num = parseInt(pValue, 10);
                return isNaN(num) ? 0 : num;
            },
            IsDefault: (pValue: number, pDefault: number): boolean => pValue === pDefault
        });

        XTypeConverter.Register<number>({
            TypeName: "Double",
            ToString: (pValue: number): string => (pValue ?? 0).toString(),
            FromString: (pValue: string): number =>
            {
                const num = parseFloat(pValue);
                return isNaN(num) ? 0 : num;
            },
            IsDefault: (pValue: number, pDefault: number): boolean =>
                Math.abs((pValue ?? 0) - (pDefault ?? 0)) < Number.EPSILON
        });

        XTypeConverter.Register<number>({
            TypeName: "Decimal",
            ToString: (pValue: number): string => (pValue ?? 0).toString(),
            FromString: (pValue: string): number =>
            {
                const num = parseFloat(pValue);
                return isNaN(num) ? 0 : num;
            },
            IsDefault: (pValue: number, pDefault: number): boolean =>
                Math.abs((pValue ?? 0) - (pDefault ?? 0)) < Number.EPSILON
        });

        XTypeConverter.Register<Date>({
            TypeName: "DateTime",
            ToString: (pValue: Date): string => pValue?.toISOString() ?? "",
            FromString: (pValue: string): Date =>
            {
                const date = new Date(pValue);
                return isNaN(date.getTime()) ? new Date(0) : date;
            },
            IsDefault: (pValue: Date, pDefault: Date): boolean =>
                pValue?.getTime() === pDefault?.getTime()
        });

        XTypeConverter.Register<XISize>({
            TypeName: "Size",
            ToString: (pValue: XISize): string =>
            {
                if (!pValue)
                    return "{Width=0;Height=0}";
                return `{Width=${pValue.Width};Height=${pValue.Height}}`;
            },
            FromString: (pValue: string): XISize =>
            {
                const match = pValue?.match(/Width=([^;]+);Height=([^}]+)/);
                if (!match)
                    return { Width: 0, Height: 0 };
                
                return {
                    Width: parseFloat(match[1]) || 0,
                    Height: parseFloat(match[2]) || 0
                };
                
            },
            
            IsDefault: (pValue: XISize, pDefault: XISize): boolean =>
                pValue?.Width === pDefault?.Width && pValue?.Height === pDefault?.Height
        });

        XTypeConverter.Register<XIRect>({
            TypeName: "Rect",
            ToString: (pValue: XIRect | { Left?: number; Top?: number; Width?: number; Height?: number }): string =>
            {
                if (!pValue)
                    return "{X=0;Y=0;Width=0;Height=0}";
                
                // XRect uses Left/Top, XIRect uses X/Y
                // Prioritize Left/Top if they exist (XRect), otherwise use X/Y (XIRect)
                let x: number;
                let y: number;
                
                if ("Left" in pValue && pValue.Left !== undefined) {
                    x = pValue.Left;
                } else if ("X" in pValue && pValue.X !== undefined) {
                    x = pValue.X;
                } else {
                    x = 0;
                }
                
                if ("Top" in pValue && pValue.Top !== undefined) {
                    y = pValue.Top;
                } else if ("Y" in pValue && pValue.Y !== undefined) {
                    y = pValue.Y;
                } else {
                    y = 0;
                }
                
                const w = pValue.Width ?? 0;
                const h = pValue.Height ?? 0;
                return `{X=${x};Y=${y};Width=${w};Height=${h}}`;
            },
            FromString: (pValue: string): XRect =>
            {
                const match = pValue?.match(/X=([^;]+);Y=([^;]+);Width=([^;]+);Height=([^}]+)/);
                const x = match ? (parseFloat(match[1]) || 0) : 0;
                const y = match ? (parseFloat(match[2]) || 0) : 0;
                const w = match ? (parseFloat(match[3]) || 0) : 0;
                const h = match ? (parseFloat(match[4]) || 0) : 0;
                
                return new XRect(x, y, w, h);
            },
            
            IsDefault: (pValue: XIRect | { Left?: number; Top?: number; Width?: number; Height?: number }, pDefault: XIRect | { Left?: number; Top?: number; Width?: number; Height?: number }): boolean =>
            {
                const px = ("X" in pValue ? pValue.X : (pValue as { Left?: number }).Left) ?? 0;
                const py = ("Y" in pValue ? pValue.Y : (pValue as { Top?: number }).Top) ?? 0;
                const dx = ("X" in pDefault ? pDefault.X : (pDefault as { Left?: number }).Left) ?? 0;
                const dy = ("Y" in pDefault ? pDefault.Y : (pDefault as { Top?: number }).Top) ?? 0;
                const vw = pValue.Width ?? 0;
                const vh = pValue.Height ?? 0;
                const dw = pDefault.Width ?? 0;
                const dh = pDefault.Height ?? 0;
                return px === dx && py === dy && vw === dw && vh === dh;
            }
        });

        XTypeConverter.Register<XIPoint>({
            TypeName: "Point",
            ToString: (pValue: XIPoint): string =>
            {
                
                if (!pValue)
                    return "{X=0;Y=0}";
                return `{X=${pValue.X};Y=${pValue.Y}}`;
                
            },
            FromString: (pValue: string): XPoint =>
            {
                const match = pValue?.match(/X=([^;]+);Y=([^}]+)/);
                
                if (!match)
                    return new XPoint(0, 0);
                
                return new XPoint(
                    parseFloat(match[1]) || 0,
                    parseFloat(match[2]) || 0
                );
            },
            IsDefault: (pValue: XIPoint, pDefault: XIPoint): boolean =>
                pValue?.X === pDefault?.X && pValue?.Y === pDefault?.Y
        });

        XTypeConverter.Register<XIPoint[]>({
            TypeName: "Point[]",
            ToString: (pValue: XIPoint[]): string =>
            {
                if (!pValue || pValue.length === 0)
                    return "";
                return pValue.map(p => `{X=${p.X};Y=${p.Y}}`).join("|");
            },
            FromString: (pValue: string): XPoint[] =>
            {
                if (!pValue)
                    return [];
                
                const parts = pValue.split("|");
                
                return parts.map(part =>
                {
                    const match = part.match(/X=([^;]+);Y=([^}]+)/);
                    
                    if (!match)
                        return new XPoint(0, 0);
                    
                    return new XPoint(
                        parseFloat(match[1]) || 0,
                        parseFloat(match[2]) || 0
                    );
                });
            },
            
            IsDefault: (pValue: XIPoint[], pDefault: XIPoint[]): boolean =>
            {
                if (!pValue || !pDefault)
                    return (pValue?.length ?? 0) === 0 && (pDefault?.length ?? 0) === 0;
                if (pValue.length !== pDefault.length)
                    return false;
                return pValue.every((p, i) => p.X === pDefault[i].X && p.Y === pDefault[i].Y);
            }
            
        });

        XTypeConverter.Register<XIColor>({
            TypeName: "Color",
            ToString: (pValue: XIColor): string =>
            {
                if (!pValue)
                    return "{A=255;R=0;G=0;B=0}";
                return `{A=${pValue.A};R=${pValue.R};G=${pValue.G};B=${pValue.B}}`;
            },
            FromString: (pValue: string): XIColor =>
            {
                const match = pValue?.match(/A=(\d+);R=(\d+);G=(\d+);B=(\d+)/);
                if (!match)
                    return new XColor(255, 0, 0, 0);
                
                return new XColor(
                    parseInt(match[1], 10),
                    parseInt(match[2], 10),
                    parseInt(match[3], 10),
                    parseInt(match[4], 10)
                );
                
            },
            
            IsDefault: (pValue: XIColor, pDefault: XIColor): boolean =>
                pValue?.A === pDefault?.A &&
                pValue?.R === pDefault?.R &&
                pValue?.G === pDefault?.G &&
                pValue?.B === pDefault?.B
            
        });

        XTypeConverter.Register<XIThickness>({
            TypeName: "Thickness",
            ToString: (pValue: XIThickness): string =>
            {
                if (!pValue)
                    return "{Left=0;Top=0;Right=0;Bottom=0}";
                return `{Left=${pValue.Left};Top=${pValue.Top};Right=${pValue.Right};Bottom=${pValue.Bottom}}`;
            },
            FromString: (pValue: string): XIThickness =>
            {
                const match = pValue?.match(/Left=([^;]+);Top=([^;]+);Right=([^;]+);Bottom=([^}]+)/);
                if (!match)
                    return { Left: 0, Top: 0, Right: 0, Bottom: 0 };
                
                return {
                    Left: parseFloat(match[1]),
                    Top: parseFloat(match[2]),
                    Right: parseFloat(match[3]),
                    Bottom: parseFloat(match[4])
                };
                
            },
            IsDefault: (pValue: XIThickness, pDefault: XIThickness): boolean =>
            {
                const v = pValue ?? { Left: 0, Top: 0, Right: 0, Bottom: 0 };
                const d = pDefault ?? { Left: 0, Top: 0, Right: 0, Bottom: 0 };
                return v.Left === d.Left && v.Top === d.Top && v.Right === d.Right && v.Bottom === d.Bottom;
            }
        });
    }

    public static Register<T>(pConverter: XITypeConverter<T>): void
    {
        XTypeConverter._Converters.set(pConverter.TypeName, pConverter as unknown as XITypeConverter<unknown>);
    }

    public static GetConverter<T>(pTypeName: XDataTypeName): XITypeConverter<T> | null
    {
        return (XTypeConverter._Converters.get(pTypeName) as XITypeConverter<T>) ?? null;
    }

    public static ToString(pValue: unknown, pTypeName: XDataTypeName): string
    {
        const converter = XTypeConverter._Converters.get(pTypeName);
        if (!converter)
            return String(pValue ?? "");
        return converter.ToString(pValue);
    }

    public static FromString<T>(pValue: string, pTypeName: XDataTypeName): T
    {
        const converter = XTypeConverter._Converters.get(pTypeName);
        if (!converter)
            return pValue as unknown as T;
        return converter.FromString(pValue) as T;
    }

    public static InferTypeName(pValue: unknown): XDataTypeName
    {
        if (pValue === null || pValue === undefined)
            return "String";

        if (typeof pValue === "string")
        {
            if (XGuid.IsValid(pValue))
                return "Guid";
            return "String";
        }

        if (typeof pValue === "boolean")
            return "Boolean";

        if (typeof pValue === "number")
        {
            if (Number.isInteger(pValue))
                return "Int32";
            return "Double";
        }

        if (pValue instanceof Date)
            return "DateTime";

        if (Array.isArray(pValue))
        {
            if (pValue.length > 0 && typeof pValue[0] === "string" && XGuid.IsValid(pValue[0]))
                return "Guid[]";
            if (pValue.length > 0 && typeof pValue[0] === "object" && "X" in pValue[0])
                return "Point[]";
            
            return "Unknown";
        }

        if (typeof pValue === "object")
        {
            if ("Width" in pValue && "Height" in pValue && !("X" in pValue) && !("Left" in pValue))
                return "Size";
            if (("X" in pValue || "Left" in pValue) && ("Y" in pValue || "Top" in pValue) && "Width" in pValue)
                return "Rect";
            if ("X" in pValue && "Y" in pValue && !("Width" in pValue))
                return "Point";
            if ("A" in pValue && "R" in pValue && "G" in pValue && "B" in pValue)
                return "Color";
            if ("Left" in pValue && "Top" in pValue && "Right" in pValue && "Bottom" in pValue)
                return "Thickness";
        }

        return "Unknown";
    }

    public static IsDefaultValue(pValue: unknown, pDefault: unknown, pTypeName: XDataTypeName): boolean
    {
        const converter = XTypeConverter._Converters.get(pTypeName);
        if (!converter)
            return pValue === pDefault;
        return converter.IsDefault(pValue, pDefault);
    }
}

