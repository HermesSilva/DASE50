import { describe, it, expect } from "vitest";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XGuid } from "../src/Core/XGuid.js";

class TestElement extends XPersistableElement
{
    public constructor()
    {
        super();
    }
}

describe("XPersistableElement Coverage Tests", () => {
    
    it("should create child with CreateChild", () => {
        const parent = new TestElement();
        parent.ID = XGuid.NewValue();
        
        const child = parent.CreateChild(TestElement);
        
        expect(child).toBeDefined();
        expect(XGuid.IsFullValue(child.ID)).toBe(true);
        expect(parent.ChildNodes).toContain(child);
        expect(child.Document).toBe(parent.Document);
    });

    it("should delete child by reference with DeleteChild", () => {
        const parent = new TestElement();
        const child = parent.CreateChild(TestElement);
        
        const result = parent.DeleteChild(child);
        
        expect(result).toBe(true);
        expect(parent.ChildNodes).not.toContain(child);
    });

    it("should delete child by ID string with DeleteChild", () => {
        const parent = new TestElement();
        const child = parent.CreateChild(TestElement);
        const childID = child.ID;
        
        const result = parent.DeleteChild(childID);
        
        expect(result).toBe(true);
        expect(parent.ChildNodes).not.toContain(child);
    });

    it("should return false when deleting non-existent child by ID", () => {
        const parent = new TestElement();
        const fakeID = XGuid.NewValue();
        
        const result = parent.DeleteChild(fakeID);
        
        expect(result).toBe(false);
    });

    it("should handle deleting element that is not a child", () => {
        const parent = new TestElement();
        const orphan = new TestElement();
        orphan.ID = XGuid.NewValue();
        
        // Current implementation calls Delete and RemoveChild regardless
        // This tests the branch where elem is not null but may not be a child
        const result = parent.DeleteChild(orphan);
        
        // Behavior: returns true even if not a child (RemoveChild handles it)
        expect(result).toBe(true);
    });
});
