import { describe, it, expect } from "vitest";
import { XTypeConverter } from "../src/Data/XTypeConverter.js";

describe("XTypeConverter Coverage Tests", () => {

    describe("Rect converter edge cases", () => {
        
        it("should handle Rect with only X/Y (no Left/Top) and undefined Width/Height", () => {
            const rect = { X: 50, Y: 75, Width: undefined, Height: undefined };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=50;Y=75;Width=0;Height=0}");
        });

        it("should handle Rect with neither Left nor X (default to 0)", () => {
            const rect = { Width: 100, Height: 200 };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=0;Y=0;Width=100;Height=200}");
        });

        it("should handle Rect with neither Top nor Y (default to 0)", () => {
            const rect = { Left: 10, Width: 100, Height: 200 };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=10;Y=0;Width=100;Height=200}");
        });

        it("should prioritize Left over X when both present", () => {
            const rect = { Left: 100, X: 50, Top: 150, Y: 75, Width: 200, Height: 100 };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=100;Y=150;Width=200;Height=100}");
        });

        it("should prioritize Top over Y when both present", () => {
            const rect = { Left: 100, X: 50, Top: 150, Y: 75, Width: 200, Height: 100 };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=100;Y=150;Width=200;Height=100}");
        });

        it("should use X when Left is undefined", () => {
            const rect = { Left: undefined, X: 50, Y: 75, Width: 200, Height: 100 };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=50;Y=75;Width=200;Height=100}");
        });

        it("should use Y when Top is undefined", () => {
            const rect = { Top: undefined, X: 50, Y: 75, Width: 200, Height: 100 };
            
            const result = XTypeConverter.ToString(rect, "Rect");
            
            expect(result).toBe("{X=50;Y=75;Width=200;Height=100}");
        });
    });

    describe("Rect IsDefault comparison", () => {
        
        it("should compare Rect with X/Y properties correctly", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { X: 100, Y: 150, Width: 200, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should compare Rect with Left/Top properties correctly", () => {
            const value = { Left: 100, Top: 150, Width: 200, Height: 100 };
            const defaultValue = { Left: 100, Top: 150, Width: 200, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should compare Rect mixing X/Y and Left/Top properties", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { Left: 100, Top: 150, Width: 200, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should return false when coordinates differ", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { X: 200, Y: 150, Width: 200, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(false);
        });

        it("should handle Rect with undefined Left/Top using fallback to 0", () => {
            const value = { Width: 200, Height: 100 };
            const defaultValue = { X: 0, Y: 0, Width: 200, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should handle Rect with null Width/Height using optional chaining", () => {
            const value = { X: 100, Y: 150, Width: null, Height: null };
            const defaultValue = { X: 100, Y: 150, Width: null, Height: null };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should handle undefined Width on pValue (line 274 optional chaining)", () => {
            const value = { X: 100, Y: 150 }; // No Width/Height
            const defaultValue = { X: 100, Y: 150, Width: undefined, Height: undefined };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should handle undefined Height on pDefault (line 274 optional chaining)", () => {
            const value = { X: 100, Y: 150, Width: 200 };
            const defaultValue = { X: 100, Y: 150, Width: 200 }; // No Height
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should return false when Width differs", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { X: 100, Y: 150, Width: 300, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(false);
        });

        it("should return false when Height differs", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { X: 100, Y: 150, Width: 200, Height: 200 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(false);
        });

        it("should handle both null Width (pValue?.Width === pDefault?.Width both undefined)", () => {
            const value = { X: 100, Y: 150, Height: 100 }; // No Width
            const defaultValue = { X: 100, Y: 150, Height: 100 }; // No Width
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should handle both null Height (pValue?.Height === pDefault?.Height both undefined)", () => {
            const value = { X: 100, Y: 150, Width: 200 }; // No Height
            const defaultValue = { X: 100, Y: 150, Width: 200 }; // No Height
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(true);
        });

        it("should return false when pValue.Width is null but pDefault.Width is defined", () => {
            const value: any = { X: 100, Y: 150, Width: null, Height: 100 };
            const defaultValue = { X: 100, Y: 150, Width: 200, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(false);
        });

        it("should return false when pDefault.Height is null but pValue.Height is defined", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue: any = { X: 100, Y: 150, Width: 200, Height: null };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            expect(result).toBe(false);
        });

        it("should cover ?? branch when pValue.Width is explicitly undefined", () => {
            const value: any = { X: 0, Y: 0, Width: undefined, Height: 100 };
            const defaultValue = { X: 0, Y: 0, Width: 0, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pValue.Width ?? 0 = 0, pDefault.Width = 0, so should be true
            expect(result).toBe(true);
        });

        it("should cover ?? branch when pValue.Height is explicitly undefined", () => {
            const value: any = { X: 0, Y: 0, Width: 100, Height: undefined };
            const defaultValue = { X: 0, Y: 0, Width: 100, Height: 0 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pValue.Height ?? 0 = 0, pDefault.Height = 0, so should be true
            expect(result).toBe(true);
        });

        it("should cover ?? branch when pDefault.Width is explicitly undefined", () => {
            const value = { X: 0, Y: 0, Width: 0, Height: 100 };
            const defaultValue: any = { X: 0, Y: 0, Width: undefined, Height: 100 };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pDefault.Width ?? 0 = 0, pValue.Width = 0, so should be true
            expect(result).toBe(true);
        });

        it("should cover ?? branch when pDefault.Height is explicitly undefined", () => {
            const value = { X: 0, Y: 0, Width: 100, Height: 0 };
            const defaultValue: any = { X: 0, Y: 0, Width: 100, Height: undefined };
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pDefault.Height ?? 0 = 0, pValue.Height = 0, so should be true
            expect(result).toBe(true);
        });

        it("should handle pDefault without X property (uses Left instead) - line 273", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { Left: 100, Top: 150, Width: 200, Height: 100 }; // No X, has Left
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pDefault has no X, uses Left (100), pValue.X = 100
            expect(result).toBe(true);
        });

        it("should handle pDefault without Y property (uses Top instead) - line 274", () => {
            const value = { X: 100, Y: 150, Width: 200, Height: 100 };
            const defaultValue = { X: 100, Top: 150, Width: 200, Height: 100 }; // No Y, has Top
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pDefault has no Y, uses Top (150), pValue.Y = 150
            expect(result).toBe(true);
        });

        it("should handle pDefault without X and without Left (uses 0) - line 273 null coalescing", () => {
            const value = { X: 0, Y: 150, Width: 200, Height: 100 };
            const defaultValue: any = { Top: 150, Width: 200, Height: 100 }; // No X, No Left
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pDefault has no X, no Left, so ?? 0 applies, pValue.X = 0
            expect(result).toBe(true);
        });

        it("should handle pDefault without Y and without Top (uses 0) - line 274 null coalescing", () => {
            const value = { X: 100, Y: 0, Width: 200, Height: 100 };
            const defaultValue: any = { Left: 100, Width: 200, Height: 100 }; // No Y, No Top
            
            const result = XTypeConverter.IsDefaultValue(value, defaultValue, "Rect");
            
            // pDefault has no Y, no Top, so ?? 0 applies, pValue.Y = 0
            expect(result).toBe(true);
        });
    });
});
