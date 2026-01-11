import { describe, it, expect } from "vitest";
import { XDesign } from "../src/Design/XDesign.js";
import { XRectangle } from "../src/Design/XRectangle.js";

describe("XDesign", () => {
    it("should be instantiable", () => {
        const design = new XDesign();
        expect(design).toBeDefined();
        expect(design).toBeInstanceOf(XDesign);
        expect(design).toBeInstanceOf(XRectangle);
    });
});
