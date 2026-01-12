import { describe, it, expect } from "vitest";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XDesign } from "../src/Design/XDesign.js";

describe("XORMDesign", () => {
    it("should be instantiable", () => {
        const design = new XORMDesign();
        expect(design).toBeDefined();
        expect(design).toBeInstanceOf(XORMDesign);
        expect(design).toBeInstanceOf(XDesign);
    });

    it("should get and set Schema property", () => {
        const design = new XORMDesign();
        expect(design.Schema).toBe("dbo");
        design.Schema = "sales";
        expect(design.Schema).toBe("sales");
    });
});
