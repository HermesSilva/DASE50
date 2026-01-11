import { describe, it, expect } from "vitest";
import { XField } from "../src/Design/XField.js";
import { XRectangle } from "../src/Design/XRectangle.js";

describe("XField", () => {
    it("should be instantiable", () => {
        const field = new XField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XField);
        expect(field).toBeInstanceOf(XRectangle);
    });
});
