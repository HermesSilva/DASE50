import { describe, it, expect } from "vitest";
import { XDocument } from "../src/Design/XDocument.js";
import { XDesignElement } from "../src/Design/XDesignElement.js";

describe("XDocument", () => {
    it("should be instantiable", () => {
        const doc = new XDocument();
        expect(doc).toBeDefined();
        expect(doc).toBeInstanceOf(XDocument);
        expect(doc).toBeInstanceOf(XDesignElement);
    });
});
