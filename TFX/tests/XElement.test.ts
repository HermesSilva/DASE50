import { describe, it, expect } from "vitest";
import {
    XElement,
    XDocumentBase,
    IsXDocumentBase,
    IsXElement,
    type XElementPredicate
} from "../src/Core/XElement.js";
import { XGuid } from "../src/Core/XGuid.js";

class TestElement extends XElement
{
    public static Guid = XGuid.NewValue();
}

class ChildElement extends XElement
{
    public Value: number = 0;
}

class GrandChildElement extends XElement
{
}

class TestDocument extends XDocumentBase
{
    public Elements: XElement[] = [];

    public override GetTree(pTree: XElement[]): void
    {
        for (const elem of this.Elements)
            pTree.push(elem);
    }
}

describe("XDocumentBase", () =>
{
    describe("IsXDocumentBase", () =>
    {
        it("should return true for XDocumentBase instance", () =>
        {
            const doc = new TestDocument();
            expect(IsXDocumentBase(doc)).toBe(true);
        });

        it("should return false for XElement instance", () =>
        {
            const elem = new TestElement();
            expect(IsXDocumentBase(elem)).toBe(false);
        });

        it("should return false for null", () =>
        {
            expect(IsXDocumentBase(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            expect(IsXDocumentBase(undefined)).toBe(false);
        });

        it("should return false for plain object", () =>
        {
            expect(IsXDocumentBase({})).toBe(false);
        });
    });
});

describe("XElement", () =>
{
    describe("IsXElement", () =>
    {
        it("should return true for XElement instance", () =>
        {
            const elem = new TestElement();
            expect(IsXElement(elem)).toBe(true);
        });

        it("should return false for XDocumentBase instance", () =>
        {
            const doc = new TestDocument();
            expect(IsXElement(doc)).toBe(false);
        });

        it("should return false for null", () =>
        {
            expect(IsXElement(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            expect(IsXElement(undefined)).toBe(false);
        });

        it("should return false for plain object", () =>
        {
            expect(IsXElement({})).toBe(false);
        });
    });

    describe("constructor and properties", () =>
    {
        it("should create element with default values", () =>
        {
            const elem = new TestElement();
            expect(elem.ID).toBe(XGuid.EmptyValue);
            expect(elem.Name).toBe("");
            expect(elem.ClassName).toBe("TestElement");
            expect(elem.ParentNode).toBeNull();
            expect(elem.ChildNodes).toEqual([]);
        });

        it("should set and get ID", () =>
        {
            const elem = new TestElement();
            const id = XGuid.NewValue();
            elem.ID = id;
            expect(elem.ID).toBe(id);
        });

        it("should set and get Name", () =>
        {
            const elem = new TestElement();
            elem.Name = "TestName";
            expect(elem.Name).toBe("TestName");
        });

        it("should set and get ClassName", () =>
        {
            const elem = new TestElement();
            expect(elem.ClassName).toBe("TestElement");
        });
    });

    describe("virtual properties", () =>
    {
        it("CanDuplicate should return true by default", () =>
        {
            const elem = new TestElement();
            expect(elem.CanDuplicate).toBe(true);
        });

        it("IsInheritable should return true by default", () =>
        {
            const elem = new TestElement();
            expect(elem.IsInheritable).toBe(true);
        });

        it("IsCacheable should return true by default", () =>
        {
            const elem = new TestElement();
            expect(elem.IsCacheable).toBe(true);
        });

        it("FullNameSpace should return empty string by default", () =>
        {
            const elem = new TestElement();
            expect(elem.FullNameSpace).toBe("");
        });

        it("DisplayText should return Name by default", () =>
        {
            const elem = new TestElement();
            elem.Name = "TestDisplay";
            expect(elem.DisplayText).toBe("TestDisplay");
        });

        it("DisplayCode should return Name by default", () =>
        {
            const elem = new TestElement();
            elem.Name = "TestCode";
            expect(elem.DisplayCode).toBe("TestCode");
        });

        it("TreeText should return DisplayText by default", () =>
        {
            const elem = new TestElement();
            elem.Name = "TreeName";
            expect(elem.TreeText).toBe("TreeName");
        });

        it("Folder should return 'None' by default", () =>
        {
            const elem = new TestElement();
            expect(elem.Folder).toBe("None");
        });
    });

    describe("AppendChild", () =>
    {
        it("should add child to ChildNodes", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();

            parent.AppendChild(child);

            expect(parent.ChildNodes.length).toBe(1);
            expect(parent.ChildNodes[0]).toBe(child);
        });

        it("should set ParentNode on child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();

            parent.AppendChild(child);

            expect(child.ParentNode).toBe(parent);
        });

        it("should remove child from previous parent", () =>
        {
            const parent1 = new TestElement();
            const parent2 = new TestElement();
            const child = new ChildElement();

            parent1.AppendChild(child);
            parent2.AppendChild(child);

            expect(parent1.ChildNodes.length).toBe(0);
            expect(parent2.ChildNodes.length).toBe(1);
            expect(child.ParentNode).toBe(parent2);
        });

        it("should do nothing if child already has same parent", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();

            parent.AppendChild(child);
            parent.AppendChild(child);

            expect(parent.ChildNodes.length).toBe(1);
        });
    });

    describe("RemoveChild", () =>
    {
        it("should remove child from ChildNodes", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const result = parent.RemoveChild(child);

            expect(result).toBe(true);
            expect(parent.ChildNodes.length).toBe(0);
        });

        it("should set ParentNode to null on child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            parent.RemoveChild(child);

            expect(child.ParentNode).toBeNull();
        });

        it("should return false if child not found", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();

            const result = parent.RemoveChild(child);

            expect(result).toBe(false);
        });
    });
    describe("InsertChildAt", () =>
    {
        it("should insert child at specific index", () =>
        {
            const parent = new TestElement();
            const child1 = new TestElement();
            const child2 = new TestElement();
            parent.AppendChild(child1);
            parent.InsertChildAt(child2, 0);
            expect(parent.ChildNodes[0]).toBe(child2);
            expect(parent.ChildNodes[1]).toBe(child1);
        });

        it("should move existing child to new position", () =>
        {
            const parent = new TestElement();
            const child1 = new TestElement();
            const child2 = new TestElement();
            parent.AppendChild(child1);
            parent.AppendChild(child2);
            expect(parent.ChildNodes[0]).toBe(child1);
            expect(parent.ChildNodes[1]).toBe(child2);

            parent.InsertChildAt(child1, 1);
            expect(parent.ChildNodes[0]).toBe(child2);
            expect(parent.ChildNodes[1]).toBe(child1);
        });

        it("should handle indices out of range", () =>
        {
            const parent = new TestElement();
            const child1 = new TestElement();
            parent.InsertChildAt(child1, 100);
            expect(parent.ChildNodes[0]).toBe(child1);

            const child2 = new TestElement();
            parent.InsertChildAt(child2, -100);
            expect(parent.ChildNodes[0]).toBe(child2);
        });

        it("should handle child with same parent but not in ChildNodes (line 249 branch)", () =>
        {
            const parent = new TestElement();
            const child = new TestElement();
            
            // Artificially set _ParentNode without adding to ChildNodes array
            // This simulates an inconsistent state
            (child as any)._ParentNode = parent;
            
            // InsertChildAt should handle this gracefully - indexOf returns -1
            // So the splice at line 250 is skipped, and child is added at the index
            parent.InsertChildAt(child, 0);
            
            expect(parent.ChildNodes[0]).toBe(child);
            expect(child.ParentNode).toBe(parent);
        });
    });
    describe("RemoveFromParent", () =>
    {
        it("should remove element from parent", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const result = child.RemoveFromParent();

            expect(result).toBe(true);
            expect(parent.ChildNodes.length).toBe(0);
            expect(child.ParentNode).toBeNull();
        });

        it("should return false if no parent", () =>
        {
            const child = new ChildElement();

            const result = child.RemoveFromParent();

            expect(result).toBe(false);
        });

        it("should return false if parent is not XElement", () =>
        {
            const child = new ChildElement();
            (child as unknown as { _ParentNode: unknown })._ParentNode = {};

            const result = child.RemoveFromParent();

            expect(result).toBe(false);
        });
    });

    describe("GetChild", () =>
    {
        it("should return child by type", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const found = parent.GetChild<ChildElement>(e => e instanceof ChildElement);

            expect(found).toBe(child);
        });

        it("should return null if no matching child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const found = parent.GetChild<GrandChildElement>(e => e instanceof GrandChildElement);

            expect(found).toBeNull();
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            const child1 = new ChildElement();
            child1.Value = 10;
            const child2 = new ChildElement();
            child2.Value = 20;
            parent.AppendChild(child1);
            parent.AppendChild(child2);

            const found = parent.GetChild<ChildElement>(c => c instanceof ChildElement && c.Value === 20);

            expect(found).toBe(child2);
        });

        it("should return null if predicate matches nothing", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            child.Value = 10;
            parent.AppendChild(child);

            const found = parent.GetChild<ChildElement>(c => c instanceof ChildElement && c.Value === 99);

            expect(found).toBeNull();
        });
    });

    describe("GetChildDeep", () =>
    {
        it("should find direct child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const found = parent.GetChildDeep<ChildElement>(e => e instanceof ChildElement);

            expect(found).toBe(child);
        });

        it("should find nested child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            const grandChild = new GrandChildElement();
            parent.AppendChild(child);
            child.AppendChild(grandChild);

            const found = parent.GetChildDeep<GrandChildElement>(e => e instanceof GrandChildElement);

            expect(found).toBe(grandChild);
        });

        it("should return null if not found", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const found = parent.GetChildDeep<GrandChildElement>(e => e instanceof GrandChildElement);

            expect(found).toBeNull();
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            const child1 = new ChildElement();
            child1.Value = 10;
            const child2 = new ChildElement();
            child2.Value = 20;
            parent.AppendChild(child1);
            child1.AppendChild(child2);

            const found = parent.GetChildDeep<ChildElement>(c => c instanceof ChildElement && c.Value === 20);

            expect(found).toBe(child2);
        });
    });

    describe("GetChildren", () =>
    {
        it("should return all matching children", () =>
        {
            const parent = new TestElement();
            const child1 = new ChildElement();
            const child2 = new ChildElement();
            const child3 = new GrandChildElement();
            parent.AppendChild(child1);
            parent.AppendChild(child2);
            parent.AppendChild(child3);

            const found = [...parent.GetChildren<ChildElement>(e => e instanceof ChildElement)];

            expect(found.length).toBe(2);
            expect(found).toContain(child1);
            expect(found).toContain(child2);
        });

        it("should return empty iterator if no matches", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const found = [...parent.GetChildren<GrandChildElement>(e => e instanceof GrandChildElement)];

            expect(found.length).toBe(0);
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            const child1 = new ChildElement();
            child1.Value = 10;
            const child2 = new ChildElement();
            child2.Value = 20;
            parent.AppendChild(child1);
            parent.AppendChild(child2);

            const found = [...parent.GetChildren<ChildElement>(c => c instanceof ChildElement && c.Value > 15)];

            expect(found.length).toBe(1);
            expect(found[0]).toBe(child2);
        });
    });

    describe("GetChildrenDeep", () =>
    {
        it("should return all matching children including nested", () =>
        {
            const parent = new TestElement();
            const child1 = new ChildElement();
            const child2 = new ChildElement();
            const nested = new ChildElement();
            parent.AppendChild(child1);
            parent.AppendChild(child2);
            child1.AppendChild(nested);

            const found = [...parent.GetChildrenDeep<ChildElement>(e => e instanceof ChildElement)];

            expect(found.length).toBe(3);
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            const child1 = new ChildElement();
            child1.Value = 10;
            const child2 = new ChildElement();
            child2.Value = 20;
            const nested = new ChildElement();
            nested.Value = 30;
            parent.AppendChild(child1);
            parent.AppendChild(child2);
            child1.AppendChild(nested);

            const found = [...parent.GetChildrenDeep<ChildElement>(c => c instanceof ChildElement && c.Value >= 20)];

            expect(found.length).toBe(2);
        });
    });

    describe("HasChild", () =>
    {
        it("should return true if child exists", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(parent.HasChild<ChildElement>(e => e instanceof ChildElement)).toBe(true);
        });

        it("should return false if no child exists", () =>
        {
            const parent = new TestElement();

            expect(parent.HasChild<ChildElement>(e => e instanceof ChildElement)).toBe(false);
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            child.Value = 10;
            parent.AppendChild(child);

            expect(parent.HasChild<ChildElement>(c => c instanceof ChildElement && c.Value === 10)).toBe(true);
            expect(parent.HasChild<ChildElement>(c => c instanceof ChildElement && c.Value === 99)).toBe(false);
        });
    });

    describe("HasChildDeep", () =>
    {
        it("should return true for direct child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(parent.HasChildDeep<ChildElement>(e => e instanceof ChildElement)).toBe(true);
        });

        it("should return true for nested child", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            const grandChild = new GrandChildElement();
            parent.AppendChild(child);
            child.AppendChild(grandChild);

            expect(parent.HasChildDeep<GrandChildElement>(e => e instanceof GrandChildElement)).toBe(true);
        });

        it("should return false if not found", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(parent.HasChildDeep<GrandChildElement>(e => e instanceof GrandChildElement)).toBe(false);
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            child.Value = 10;
            const nested = new ChildElement();
            nested.Value = 20;
            parent.AppendChild(child);
            child.AppendChild(nested);

            expect(parent.HasChildDeep<ChildElement>(c => c instanceof ChildElement && c.Value === 20)).toBe(true);
            expect(parent.HasChildDeep<ChildElement>(c => c instanceof ChildElement && c.Value === 99)).toBe(false);
        });
    });

    describe("GetOwner", () =>
    {
        it("should return direct parent if matches", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const owner = child.GetOwner<TestElement>(e => e instanceof TestElement);

            expect(owner).toBe(parent);
        });

        it("should return ancestor if matches", () =>
        {
            const grandParent = new TestElement();
            const parent = new ChildElement();
            const child = new GrandChildElement();
            grandParent.AppendChild(parent);
            parent.AppendChild(child);

            const owner = child.GetOwner<TestElement>(e => e instanceof TestElement);

            expect(owner).toBe(grandParent);
        });

        it("should return null if no matching owner", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            const owner = child.GetOwner<GrandChildElement>(e => e instanceof GrandChildElement);

            expect(owner).toBeNull();
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            parent.Name = "Parent";
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(child.GetOwner<TestElement>(e => e instanceof TestElement && e.Name === "Parent")).toBe(parent);
            expect(child.GetOwner<TestElement>(e => e instanceof TestElement && e.Name === "Other")).toBeNull();
        });

        it("should return null if no parent", () =>
        {
            const elem = new TestElement();

            const owner = elem.GetOwner<TestElement>(e => e instanceof TestElement);

            expect(owner).toBeNull();
        });
    });

    describe("HasOwner", () =>
    {
        it("should return true if has matching owner", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(child.HasOwner<TestElement>(e => e instanceof TestElement)).toBe(true);
        });

        it("should return true for ancestor", () =>
        {
            const grandParent = new TestElement();
            const parent = new ChildElement();
            const child = new GrandChildElement();
            grandParent.AppendChild(parent);
            parent.AppendChild(child);

            expect(child.HasOwner<TestElement>(e => e instanceof TestElement)).toBe(true);
        });

        it("should return false if no matching owner", () =>
        {
            const parent = new TestElement();
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(child.HasOwner<GrandChildElement>(e => e instanceof GrandChildElement)).toBe(false);
        });

        it("should filter by predicate", () =>
        {
            const parent = new TestElement();
            parent.Name = "Parent";
            const child = new ChildElement();
            parent.AppendChild(child);

            expect(child.HasOwner<TestElement>(e => e instanceof TestElement && e.Name === "Parent")).toBe(true);
            expect(child.HasOwner<TestElement>(e => e instanceof TestElement && e.Name === "Other")).toBe(false);
        });

        it("should return false if no parent", () =>
        {
            const elem = new TestElement();

            expect(elem.HasOwner<TestElement>(e => e instanceof TestElement)).toBe(false);
        });
    });

    describe("Tree and GetTree", () =>
    {
        it("should return empty array for element without parent", () =>
        {
            const elem = new TestElement();

            expect(elem.Tree).toEqual([]);
        });

        it("should return ancestors for element with parent", () =>
        {
            const grandParent = new TestElement();
            const parent = new ChildElement();
            const child = new GrandChildElement();
            grandParent.AppendChild(parent);
            parent.AppendChild(child);

            const tree = child.Tree;

            expect(tree.length).toBe(2);
            expect(tree[0]).toBe(grandParent);
            expect(tree[1]).toBe(parent);
        });

        it("should include document elements when parent is XDocumentBase", () =>
        {
            const doc = new TestDocument();
            const docElem = new TestElement();
            doc.Elements.push(docElem);
            const child = new ChildElement();
            (child as unknown as { _ParentNode: unknown })._ParentNode = doc;

            const tree = child.Tree;

            expect(tree.length).toBe(1);
            expect(tree[0]).toBe(docElem);
        });

        it("should traverse to document and include its tree", () =>
        {
            const doc = new TestDocument();
            const docElem = new TestElement();
            doc.Elements.push(docElem);

            const parent = new TestElement();
            (parent as unknown as { _ParentNode: unknown })._ParentNode = doc;
            const child = new ChildElement();
            parent.AppendChild(child);

            const tree = child.Tree;

            expect(tree).toContain(docElem);
            expect(tree).toContain(parent);
        });
    });

    describe("RefreshView", () =>
    {
        it("should not throw", () =>
        {
            const elem = new TestElement();
            expect(() => elem.RefreshView()).not.toThrow();
        });
    });

    describe("SendAddItem", () =>
    {
        it("should not throw", () =>
        {
            const elem = new TestElement();
            const child = new ChildElement();
            expect(() => elem.SendAddItem(child)).not.toThrow();
        });
    });

    describe("Copy", () =>
    {
        it("should not throw", () =>
        {
            const elem = new TestElement();
            expect(() => elem.Copy()).not.toThrow();
        });
    });

    describe("Cut", () =>
    {
        it("should not throw", () =>
        {
            const elem = new TestElement();
            expect(() => elem.Cut()).not.toThrow();
        });
    });

    describe("Paste", () =>
    {
        it("should return empty array", () =>
        {
            const elem = new TestElement();
            expect(elem.Paste()).toEqual([]);
        });
    });
});
