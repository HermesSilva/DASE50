import { describe, it, expect } from "vitest";
import { XDesignElement } from "../src/Design/XDesignElement.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";

describe("XDesignElement", () => {
    it("should be instantiable", () => {
        const element = new XDesignElement();
        expect(element).toBeDefined();
        expect(element).toBeInstanceOf(XDesignElement);
        expect(element).toBeInstanceOf(XPersistableElement);
    });
});
