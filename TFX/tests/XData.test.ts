import { describe, it, expect, vi } from "vitest";
import {
    XLanguage,
    XData,
    XBaseLinkData,
    XLinkData,
    XLinkArrayData,
    XParentData,
    XLinkableElement,
    XValues
} from "../src/Core/XData.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XElement } from "../src/Core/XElement.js";

function createMockLinkableElement(): XLinkableElement
{
    return { ID: XGuid.NewValue() } as XLinkableElement;
}

class MockXElement extends XElement
{
    public constructor()
    {
        super();
        this._ID = XGuid.NewValue();
        this._Name = "MockElement";
    }
}

describe("XLanguage", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const lang = new XLanguage();
            expect(lang).toBeInstanceOf(XLanguage);
            expect(lang.InnerText).toBe("");
        });
    });

    describe("InnerText", () =>
    {
        it("should be settable", () =>
        {
            const lang = new XLanguage();
            lang.InnerText = "Hello World";
            expect(lang.InnerText).toBe("Hello World");
        });

        it("should handle empty string", () =>
        {
            const lang = new XLanguage();
            lang.InnerText = "";
            expect(lang.InnerText).toBe("");
        });

        it("should handle long text", () =>
        {
            const lang = new XLanguage();
            const longText = "A".repeat(10000);
            lang.InnerText = longText;
            expect(lang.InnerText).toBe(longText);
        });
    });

    describe("Delete", () =>
    {
        it("should accept deep parameter without error", () =>
        {
            const lang = new XLanguage();
            expect(() => lang.Delete(true)).not.toThrow();
            expect(() => lang.Delete(false)).not.toThrow();
        });
    });
});

describe("XData", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const data = new XData();
            expect(data).toBeInstanceOf(XData);
            expect(data.ID).toBe(XGuid.EmptyValue);
            expect(data.Name).toBe("");
            expect(data.Data).toBeNull();
            expect(data.InnerText).toBe("");
            expect(data.ChildNodes).toEqual([]);
        });
    });

    describe("ID", () =>
    {
        it("should be XGuid.EmptyValue by default", () =>
        {
            const data = new XData();
            expect(data.ID).toBe(XGuid.EmptyValue);
        });

        it("should be settable", () =>
        {
            const data = new XData();
            const newId = XGuid.NewValue();
            data.ID = newId;
            expect(data.ID).toBe(newId);
        });
    });

    describe("Name", () =>
    {
        it("should be empty by default", () =>
        {
            const data = new XData();
            expect(data.Name).toBe("");
        });

        it("should be settable", () =>
        {
            const data = new XData();
            data.Name = "TestName";
            expect(data.Name).toBe("TestName");
        });
    });

    describe("Data", () =>
    {
        it("should be null by default", () =>
        {
            const data = new XData();
            expect(data.Data).toBeNull();
        });

        it("should accept any value", () =>
        {
            const data = new XData();

            data.Data = "string";
            expect(data.Data).toBe("string");

            data.Data = 42;
            expect(data.Data).toBe(42);

            data.Data = { key: "value" };
            expect(data.Data).toEqual({ key: "value" });

            data.Data = [1, 2, 3];
            expect(data.Data).toEqual([1, 2, 3]);
        });
    });

    describe("InnerText", () =>
    {
        it("should be empty by default", () =>
        {
            const data = new XData();
            expect(data.InnerText).toBe("");
        });

        it("should be settable", () =>
        {
            const data = new XData();
            data.InnerText = "Content";
            expect(data.InnerText).toBe("Content");
        });
    });

    describe("ChildNodes", () =>
    {
        it("should be empty array by default", () =>
        {
            const data = new XData();
            expect(data.ChildNodes).toEqual([]);
            expect(data.ChildNodes.length).toBe(0);
        });

        it("should allow adding child nodes", () =>
        {
            const parent = new XData();
            const child1 = new XData();
            const child2 = new XData();

            parent.ChildNodes.push(child1);
            parent.ChildNodes.push(child2);

            expect(parent.ChildNodes.length).toBe(2);
            expect(parent.ChildNodes[0]).toBe(child1);
            expect(parent.ChildNodes[1]).toBe(child2);
        });
    });

    describe("Delete", () =>
    {
        it("should accept deep parameter without error", () =>
        {
            const data = new XData();
            expect(() => data.Delete(true)).not.toThrow();
            expect(() => data.Delete(false)).not.toThrow();
        });
    });

    describe("GetLanguage", () =>
    {
        it("should return null", () =>
        {
            const data = new XData();
            expect(data.GetLanguage("en-US")).toBeNull();
            expect(data.GetLanguage("pt-BR")).toBeNull();
        });
    });

    describe("AddLanguage", () =>
    {
        it("should return new XLanguage", () =>
        {
            const data = new XData();
            const lang = data.AddLanguage("en-US");
            expect(lang).toBeInstanceOf(XLanguage);
        });

        it("should return different instances each time", () =>
        {
            const data = new XData();
            const lang1 = data.AddLanguage("en-US");
            const lang2 = data.AddLanguage("pt-BR");
            expect(lang1).not.toBe(lang2);
        });
    });
});

describe("XBaseLinkData", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const linkData = new XBaseLinkData();
            expect(linkData).toBeInstanceOf(XBaseLinkData);
            expect(linkData).toBeInstanceOf(XData);
            expect(linkData.Element).toBeNull();
        });
    });

    describe("Element", () =>
    {
        it("should be null by default", () =>
        {
            const linkData = new XBaseLinkData();
            expect(linkData.Element).toBeNull();
        });

        it("should be settable", () =>
        {
            const linkData = new XBaseLinkData();
            const element = createMockLinkableElement();
            linkData.Element = element;
            expect(linkData.Element).toBe(element);
        });

        it("should be settable back to null", () =>
        {
            const linkData = new XBaseLinkData();
            const element = createMockLinkableElement();
            linkData.Element = element;
            linkData.Element = null;
            expect(linkData.Element).toBeNull();
        });
    });

    it("should inherit XData properties", () =>
    {
        const linkData = new XBaseLinkData();
        expect(linkData.ID).toBe(XGuid.EmptyValue);
        expect(linkData.Name).toBe("");
        expect(linkData.Data).toBeNull();
    });
});

describe("XLinkData", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const linkData = new XLinkData();
            expect(linkData).toBeInstanceOf(XLinkData);
            expect(linkData).toBeInstanceOf(XBaseLinkData);
            expect(linkData).toBeInstanceOf(XData);
            expect(linkData.Order).toBe(0);
        });
    });

    describe("Order", () =>
    {
        it("should be 0 by default", () =>
        {
            const linkData = new XLinkData();
            expect(linkData.Order).toBe(0);
        });

        it("should be settable", () =>
        {
            const linkData = new XLinkData();
            linkData.Order = 5;
            expect(linkData.Order).toBe(5);
        });

        it("should accept negative values", () =>
        {
            const linkData = new XLinkData();
            linkData.Order = -1;
            expect(linkData.Order).toBe(-1);
        });
    });

    describe("SetElement", () =>
    {
        it("should set Element and Data", () =>
        {
            const linkData = new XLinkData();
            const element = createMockLinkableElement();
            linkData.SetElement(element);
            expect(linkData.Element).toBe(element);
            expect(linkData.Data).toBe(element.ID);
        });

        it("should update when called again", () =>
        {
            const linkData = new XLinkData();
            const element1 = createMockLinkableElement();
            const element2 = createMockLinkableElement();

            linkData.SetElement(element1);
            linkData.SetElement(element2);

            expect(linkData.Element).toBe(element2);
            expect(linkData.Data).toBe(element2.ID);
        });
    });

    describe("LoadElement", () =>
    {
        it("should return element info when element is set", () =>
        {
            const linkData = new XLinkData();
            const element = createMockLinkableElement();
            linkData.Element = element;

            const result = linkData.LoadElement(false);

            expect(result.Element).toBe(element);
            expect(result.IsDocumentOk).toBe(true);
            expect(result.IsElementOk).toBe(true);
        });

        it("should return null element when not set", () =>
        {
            const linkData = new XLinkData();

            const result = linkData.LoadElement(false);

            expect(result.Element).toBeNull();
            expect(result.IsDocumentOk).toBe(true);
            expect(result.IsElementOk).toBe(false);
        });

        it("should handle refresh parameter", () =>
        {
            const linkData = new XLinkData();
            const element = createMockLinkableElement();
            linkData.Element = element;

            const result1 = linkData.LoadElement(false);
            const result2 = linkData.LoadElement(true);

            expect(result1.IsElementOk).toBe(true);
            expect(result2.IsElementOk).toBe(true);
        });
    });
});

describe("XLinkArrayData", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const arrData = new XLinkArrayData();
            expect(arrData).toBeInstanceOf(XLinkArrayData);
            expect(arrData).toBeInstanceOf(XData);
            expect(arrData.ChildNodes).toEqual([]);
        });
    });

    describe("ChildNodes", () =>
    {
        it("should be empty array by default", () =>
        {
            const arrData = new XLinkArrayData();
            expect(arrData.ChildNodes.length).toBe(0);
        });

        it("should contain XLinkData items", () =>
        {
            const arrData = new XLinkArrayData();
            const linkData = new XLinkData();
            arrData.ChildNodes.push(linkData);
            expect(arrData.ChildNodes[0]).toBeInstanceOf(XLinkData);
        });
    });

    describe("SetElement", () =>
    {
        it("should set elements from array", () =>
        {
            const arrData = new XLinkArrayData();
            const elements = [
                createMockLinkableElement(),
                createMockLinkableElement(),
                createMockLinkableElement()
            ];

            arrData.SetElement(elements);

            expect(arrData.ChildNodes.length).toBe(3);
            expect(arrData.ChildNodes[0].Element).toBe(elements[0]);
            expect(arrData.ChildNodes[1].Element).toBe(elements[1]);
            expect(arrData.ChildNodes[2].Element).toBe(elements[2]);
        });

        it("should set correct order on each XLinkData", () =>
        {
            const arrData = new XLinkArrayData();
            const elements = [
                createMockLinkableElement(),
                createMockLinkableElement()
            ];

            arrData.SetElement(elements);

            expect(arrData.ChildNodes[0].Order).toBe(0);
            expect(arrData.ChildNodes[1].Order).toBe(1);
        });

        it("should set Data with array of IDs", () =>
        {
            const arrData = new XLinkArrayData();
            const elements = [
                createMockLinkableElement(),
                createMockLinkableElement()
            ];

            arrData.SetElement(elements);

            const dataArray = arrData.Data as string[];
            expect(dataArray.length).toBe(2);
            expect(dataArray[0]).toBe(elements[0].ID);
            expect(dataArray[1]).toBe(elements[1].ID);
        });

        it("should handle empty array", () =>
        {
            const arrData = new XLinkArrayData();
            arrData.SetElement([]);
            expect(arrData.ChildNodes.length).toBe(0);
            expect(arrData.Data).toEqual([]);
        });
    });

    describe("LoadElement", () =>
    {
        it("should return ok when all elements are set", () =>
        {
            const arrData = new XLinkArrayData();
            const elements = [
                createMockLinkableElement(),
                createMockLinkableElement()
            ];
            arrData.SetElement(elements);

            const result = arrData.LoadElement(false);

            expect(result.IsDocumentOk).toBe(true);
            expect(result.IsElementOk).toBe(true);
        });

        it("should return not ok when element is missing", () =>
        {
            const arrData = new XLinkArrayData();
            const linkData = new XLinkData();
            arrData.ChildNodes.push(linkData);

            const result = arrData.LoadElement(false);

            expect(result.IsDocumentOk).toBe(true);
            expect(result.IsElementOk).toBe(false);
        });

        it("should return ok when no children", () =>
        {
            const arrData = new XLinkArrayData();
            const result = arrData.LoadElement(false);
            expect(result.IsDocumentOk).toBe(true);
            expect(result.IsElementOk).toBe(true);
        });
    });

    describe("Where", () =>
    {
        it("should return copy of ChildNodes", () =>
        {
            const arrData = new XLinkArrayData();
            const elements = [
                createMockLinkableElement(),
                createMockLinkableElement()
            ];
            arrData.SetElement(elements);

            const result = arrData.Where();

            expect(result.length).toBe(2);
            expect(result[0]).toBe(arrData.ChildNodes[0]);
            expect(result[1]).toBe(arrData.ChildNodes[1]);
        });

        it("should return independent copy", () =>
        {
            const arrData = new XLinkArrayData();
            const elements = [createMockLinkableElement()];
            arrData.SetElement(elements);

            const result = arrData.Where();
            result.push(new XLinkData());

            expect(arrData.ChildNodes.length).toBe(1);
            expect(result.length).toBe(2);
        });

        it("should return empty array when no children", () =>
        {
            const arrData = new XLinkArrayData();
            expect(arrData.Where()).toEqual([]);
        });
    });
});

describe("XParentData", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const parentData = new XParentData();
            expect(parentData).toBeInstanceOf(XParentData);
            expect(parentData).toBeInstanceOf(XBaseLinkData);
            expect(parentData).toBeInstanceOf(XData);
            expect(parentData.IsDocumentOk).toBe(true);
            expect(parentData.IsElementOk).toBe(true);
        });
    });

    describe("IsDocumentOk", () =>
    {
        it("should be true by default", () =>
        {
            const parentData = new XParentData();
            expect(parentData.IsDocumentOk).toBe(true);
        });

        it("should be settable", () =>
        {
            const parentData = new XParentData();
            parentData.IsDocumentOk = false;
            expect(parentData.IsDocumentOk).toBe(false);
        });
    });

    describe("IsElementOk", () =>
    {
        it("should be true by default", () =>
        {
            const parentData = new XParentData();
            expect(parentData.IsElementOk).toBe(true);
        });

        it("should be settable", () =>
        {
            const parentData = new XParentData();
            parentData.IsElementOk = false;
            expect(parentData.IsElementOk).toBe(false);
        });
    });

    describe("Refresh", () =>
    {
        it("should set IsDocumentOk to true", () =>
        {
            const parentData = new XParentData();
            parentData.IsDocumentOk = false;
            parentData.Refresh(false);
            expect(parentData.IsDocumentOk).toBe(true);
        });

        it("should set IsElementOk based on Element", () =>
        {
            const parentData = new XParentData();
            parentData.Element = null;
            parentData.Refresh(false);
            expect(parentData.IsElementOk).toBe(false);

            const element = createMockLinkableElement();
            parentData.Element = element;
            parentData.Refresh(false);
            expect(parentData.IsElementOk).toBe(true);
        });

        it("should accept userCheck parameter", () =>
        {
            const parentData = new XParentData();
            const element = createMockLinkableElement();
            parentData.Element = element;

            parentData.Refresh(true);
            expect(parentData.IsElementOk).toBe(true);

            parentData.Refresh(false);
            expect(parentData.IsElementOk).toBe(true);
        });
    });

    describe("SetElement", () =>
    {
        it("should set Element and Data", () =>
        {
            const parentData = new XParentData();
            const element = createMockLinkableElement();

            parentData.SetElement(element);

            expect(parentData.Element).toBe(element);
            expect(parentData.Data).toBe(element.ID);
        });

        it("should update when called again", () =>
        {
            const parentData = new XParentData();
            const element1 = createMockLinkableElement();
            const element2 = createMockLinkableElement();

            parentData.SetElement(element1);
            parentData.SetElement(element2);

            expect(parentData.Element).toBe(element2);
            expect(parentData.Data).toBe(element2.ID);
        });
    });
});

describe("XValues", () =>
{
    function addDataToValues(pValues: XValues, pId: string, pName: string): XData
    {
        const data = new XData();
        data.ID = pId;
        data.Name = pName;
        pValues.ChildNodes.push(data as unknown as XElement);
        return data;
    }

    function addLinkDataToValues(pValues: XValues, pId: string, pName: string): XLinkData
    {
        const data = new XLinkData();
        data.ID = pId;
        data.Name = pName;
        pValues.ChildNodes.push(data as unknown as XElement);
        return data;
    }

    describe("constructor", () =>
    {
        it("should create instance that extends XElement", () =>
        {
            const values = new XValues();
            expect(values).toBeInstanceOf(XValues);
            expect(values).toBeInstanceOf(XElement);
            expect(values.ChildNodes).toEqual([]);
        });

        it("should have XElement properties", () =>
        {
            const values = new XValues();
            expect(values.ID).toBe(XGuid.EmptyValue);
            expect(values.Name).toBe("");
        });
    });

    describe("GetChild with constructor", () =>
    {
        it("should return child by constructor type", () =>
        {
            const values = new XValues();
            const data = addDataToValues(values, XGuid.NewValue(), "TestData");

            const found = values.GetChild(XData);

            expect(found).toBe(data);
        });

        it("should return null when no matching child", () =>
        {
            const values = new XValues();
            addDataToValues(values, XGuid.NewValue(), "TestData");

            const found = values.GetChild(XLinkArrayData);

            expect(found).toBeNull();
        });

        it("should work with predicate", () =>
        {
            const values = new XValues();
            addDataToValues(values, XGuid.NewValue(), "First");
            const second = addDataToValues(values, XGuid.NewValue(), "Second");
            addDataToValues(values, XGuid.NewValue(), "Third");

            const found = values.GetChild(XData, (d: XData) => d.Name === "Second");

            expect(found).toBe(second);
        });

        it("should return null when predicate matches nothing", () =>
        {
            const values = new XValues();
            addDataToValues(values, XGuid.NewValue(), "First");

            const found = values.GetChild(XData, (d: XData) => d.Name === "NotFound");

            expect(found).toBeNull();
        });
    });

    describe("GetChild with XProperty-like object", () =>
    {
        it("should return child by property ID", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const data = addDataToValues(values, propId, "TestProp");
            const propMock = { ID: propId, Name: "TestProp" };

            const found = values.GetChild(propMock as unknown as new () => XData);

            expect(found).toBe(data);
        });

        it("should return null when property ID not found", () =>
        {
            const values = new XValues();
            addDataToValues(values, XGuid.NewValue(), "TestProp");
            const propMock = { ID: XGuid.NewValue(), Name: "Other" };

            const found = values.GetChild(propMock as unknown as new () => XData);

            expect(found).toBeNull();
        });

        it("should match first child with same ID", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const first = addDataToValues(values, propId, "First");
            addDataToValues(values, propId, "Second");

            const propMock = { ID: propId };
            const found = values.GetChild(propMock as unknown as new () => XData);

            expect(found).toBe(first);
        });
    });

    describe("GetChildById", () =>
    {
        it("should return child by ID", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const data = addDataToValues(values, propId, "TestData");

            const found = values.GetChildById<XData>(propId);

            expect(found).toBe(data);
        });

        it("should return null when ID not found", () =>
        {
            const values = new XValues();
            addDataToValues(values, XGuid.NewValue(), "TestData");

            const found = values.GetChildById<XData>(XGuid.NewValue());

            expect(found).toBeNull();
        });

        it("should return correct typed child", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const linkData = addLinkDataToValues(values, propId, "LinkData");

            const found = values.GetChildById<XLinkData>(propId);

            expect(found).toBe(linkData);
            expect(found).toBeInstanceOf(XLinkData);
        });

        it("should return first matching child", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const first = addDataToValues(values, propId, "First");
            addDataToValues(values, propId, "Second");

            const found = values.GetChildById<XData>(propId);

            expect(found).toBe(first);
        });

        it("should work with empty ChildNodes", () =>
        {
            const values = new XValues();

            const found = values.GetChildById<XData>(XGuid.NewValue());

            expect(found).toBeNull();
        });
    });

    describe("GetChildData", () =>
    {
        it("should return first XData child", () =>
        {
            const values = new XValues();
            const data = addDataToValues(values, XGuid.NewValue(), "TestData");

            const found = values.GetChildData<XData>();

            expect(found).toBe(data);
        });

        it("should return null when no children", () =>
        {
            const values = new XValues();

            const found = values.GetChildData<XData>();

            expect(found).toBeNull();
        });

        it("should return first XData instance", () =>
        {
            const values = new XValues();
            const first = addDataToValues(values, XGuid.NewValue(), "First");
            addDataToValues(values, XGuid.NewValue(), "Second");

            const found = values.GetChildData<XData>();

            expect(found).toBe(first);
        });

        it("should work with XLinkData children", () =>
        {
            const values = new XValues();
            const linkData = addLinkDataToValues(values, XGuid.NewValue(), "LinkData");

            const found = values.GetChildData<XLinkData>();

            expect(found).toBe(linkData);
        });

        it("should return null when children exist but are not XData instances", () =>
        {
            const values = new XValues();
            const nonDataChild = { ID: XGuid.NewValue(), Name: "NotXData" };
            values.ChildNodes.push(nonDataChild as unknown as XElement);

            const found = values.GetChildData<XData>();

            expect(found).toBeNull();
        });
    });

    describe("CreateChild", () =>
    {
        it("should create XData with correct ID", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();

            const data = values.CreateChild<XData>(propId);

            expect(data).toBeInstanceOf(XData);
            expect(data.ID).toBe(propId);
        });

        it("should call AppendChild", () =>
        {
            const values = new XValues();
            const spy = vi.spyOn(values, "AppendChild");

            values.CreateChild<XData>(XGuid.NewValue());

            expect(spy).toHaveBeenCalledTimes(1);
            spy.mockRestore();
        });

        it("should set name when provided", () =>
        {
            const values = new XValues();

            const data = values.CreateChild<XData>(XGuid.NewValue(), "CustomName");

            expect(data.Name).toBe("CustomName");
        });

        it("should use empty string when name not provided", () =>
        {
            const values = new XValues();

            const data = values.CreateChild<XData>(XGuid.NewValue());

            expect(data.Name).toBe("");
        });

        it("should use empty string when name is undefined", () =>
        {
            const values = new XValues();

            const data = values.CreateChild<XData>(XGuid.NewValue(), undefined);

            expect(data.Name).toBe("");
        });
    });

    describe("AddValue", () =>
    {
        it("should create XData for non-linked property", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const mockProp = {
                ID: propId,
                Name: "TestProp",
                Default: { IsLinked: false }
            } as unknown as import("../src/Core/XProperty.js").XProperty;

            const data = values.AddValue(mockProp, null);

            expect(data).toBeInstanceOf(XData);
            expect(data.ID).toBe(propId);
            expect(data.Name).toBe("TestProp");
        });

        it("should create XLinkData for linked non-array property", () =>
        {
            const values = new XValues();
            const mockProp = {
                ID: XGuid.NewValue(),
                Name: "LinkedProp",
                Default: { IsLinked: true, TypeName: "Guid" }
            } as unknown as import("../src/Core/XProperty.js").XProperty;

            const data = values.AddValue(mockProp, null);

            expect(data).toBeInstanceOf(XLinkData);
        });

        it("should create XLinkArrayData for linked array property", () =>
        {
            const values = new XValues();
            const mockProp = {
                ID: XGuid.NewValue(),
                Name: "ArrayProp",
                Default: { IsLinked: true, TypeName: "Guid[]" }
            } as unknown as import("../src/Core/XProperty.js").XProperty;

            const data = values.AddValue(mockProp, null);

            expect(data).toBeInstanceOf(XLinkArrayData);
        });

        it("should call AppendChild with data", () =>
        {
            const values = new XValues();
            const spy = vi.spyOn(values, "AppendChild");
            const mockProp = {
                ID: XGuid.NewValue(),
                Name: "Prop",
                Default: { IsLinked: false }
            } as unknown as import("../src/Core/XProperty.js").XProperty;

            values.AddValue(mockProp, null);

            expect(spy).toHaveBeenCalledTimes(1);
            spy.mockRestore();
        });

        it("should handle linked property without TypeName", () =>
        {
            const values = new XValues();
            const mockProp = {
                ID: XGuid.NewValue(),
                Name: "Prop",
                Default: { IsLinked: true }
            } as unknown as import("../src/Core/XProperty.js").XProperty;

            const data = values.AddValue(mockProp, null);

            expect(data).toBeInstanceOf(XLinkData);
        });

        it("should set ID and Name from property", () =>
        {
            const values = new XValues();
            const propId = XGuid.NewValue();
            const mockProp = {
                ID: propId,
                Name: "PropName",
                Default: { IsLinked: false }
            } as unknown as import("../src/Core/XProperty.js").XProperty;

            const data = values.AddValue(mockProp, null);

            expect(data.ID).toBe(propId);
            expect(data.Name).toBe("PropName");
        });
    });
});
