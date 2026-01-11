import { describe, it, expect } from "vitest";
import * as Design from "../src/Design/index.js";
import * as Core from "../src/Core/index.js";
import * as Main from "../src/index.js";

describe("Index Files", () => {
    it("should export Design elements", () => {
        expect(Design.XDocument).toBeDefined();
        expect(new Design.XDocument()).toBeInstanceOf(Design.XDocument);
        expect(Design.XRectangle).toBeDefined();
        expect(Design.XLine).toBeDefined();
        expect(Design.XField).toBeDefined();
        expect(Design.XCursor).toBeDefined();
        expect(Design.XLineCap).toBeDefined();
        expect(Design.XLineJoin).toBeDefined();
    });

    it("should export Core elements", () => {
        expect(Core.XElement).toBeDefined();
        expect(new Core.XElement()).toBeInstanceOf(Core.XElement);
        expect(Core.XProperty).toBeDefined();
    });

    it("should export Main elements", () => {
        expect(Main.XDocument).toBeDefined();
        expect(new Main.XDocument()).toBeInstanceOf(Main.XDocument);
    });
});
