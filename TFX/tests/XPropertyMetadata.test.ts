/**
 * XPropertyMetadata Tests
 * Testes para o sistema de metadados de propriedades
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    XPropertyMetadataProvider,
    XIPropertyContext,
    XIPropertyMetadata,
    XIPropertyValidationResult,
    CreateEnumValidator,
    CreateMinValidator,
    CreateMaxValidator,
    CreateRangeValidator,
    CreatePatternValidator,
    CreateCustomValidator,
    WhenPropertyEquals,
    WhenPropertyIn,
    WhenPropertyNotIn,
    AllOf,
    AnyOf,
    Not
} from "../src/Core/XPropertyMetadata.js";
import { XDesignerErrorSeverity } from "../src/Core/XValidation.js";

/**
 * Mock element for testing
 */
interface IMockElement
{
    Name: string;
    DataType: string;
    Length: number;
    Scale: number;
    IsActive: boolean;
}

/**
 * Mock context implementation
 */
class MockPropertyContext implements XIPropertyContext<IMockElement>
{
    constructor(
        public readonly Element: IMockElement,
        public readonly PropertyID: string,
        public readonly PropertyName: string,
        public readonly CurrentValue: unknown
    ) {}

    GetPropertyValue(pPropertyID: string): unknown
    {
        switch (pPropertyID)
        {
            case "Name": return this.Element.Name;
            case "DataType": return this.Element.DataType;
            case "Length": return this.Element.Length;
            case "Scale": return this.Element.Scale;
            case "IsActive": return this.Element.IsActive;
            default: return undefined;
        }
    }
}

/**
 * Concrete implementation for testing
 */
class MockMetadataProvider extends XPropertyMetadataProvider<IMockElement>
{
    constructor()
    {
        super();
    }

    public AddTestRule(
        pPropertyID: string,
        pPropertyName: string,
        pOptions: {
            IsVisible?: (ctx: XIPropertyContext<IMockElement>) => boolean;
            IsReadOnly?: (ctx: XIPropertyContext<IMockElement>) => boolean;
            IsRequired?: (ctx: XIPropertyContext<IMockElement>) => boolean;
            Validators?: ((ctx: XIPropertyContext<IMockElement>) => XIPropertyValidationResult | null)[];
            HintProvider?: (ctx: XIPropertyContext<IMockElement>) => string | undefined;
            PlaceholderProvider?: (ctx: XIPropertyContext<IMockElement>) => string | undefined;
        }
    ): void
    {
        this.AddPropertyRule(pPropertyID, pPropertyName, pOptions);
    }

    public RemoveTestRule(pPropertyID: string): boolean
    {
        return this.RemoveRule(pPropertyID);
    }

    public GetTestRule(pPropertyID: string): any
    {
        return (this as any).GetRule(pPropertyID);
    }

    public AddTestGlobalValidator(
        pValidator: (ctx: XIPropertyContext<IMockElement>) => XIPropertyValidationResult | null
    ): void
    {
        this.AddGlobalValidator(pValidator);
    }

    protected CreateContext(
        pElement: IMockElement,
        pPropertyID: string,
        pPropertyName: string
    ): XIPropertyContext<IMockElement>
    {
        const currentValue = this.GetPropertyValue(pElement, pPropertyID);
        return new MockPropertyContext(pElement, pPropertyID, pPropertyName, currentValue);
    }

    protected GetPropertyValue(pElement: IMockElement, pPropertyID: string): unknown
    {
        switch (pPropertyID)
        {
            case "Name": return pElement.Name;
            case "DataType": return pElement.DataType;
            case "Length": return pElement.Length;
            case "Scale": return pElement.Scale;
            case "IsActive": return pElement.IsActive;
            default: return undefined;
        }
    }

    protected GetPropertyName(pPropertyID: string): string
    {
        switch (pPropertyID)
        {
            case "Name": return "Name";
            case "DataType": return "Data Type";
            case "Length": return "Length";
            case "Scale": return "Scale";
            case "IsActive": return "Is Active";
            default: return pPropertyID;
        }
    }
}

describe("XPropertyMetadataProvider", () =>
{
    let provider: MockMetadataProvider;
    let element: IMockElement;

    beforeEach(() =>
    {
        provider = new MockMetadataProvider();
        element = {
            Name: "TestField",
            DataType: "String",
            Length: 50,
            Scale: 0,
            IsActive: true
        };
    });

    describe("Basic functionality", () =>
    {
        it("should return default metadata for unregistered property", () =>
        {
            const metadata = provider.GetMetadata(element, "Unknown");

            expect(metadata.PropertyID).toBe("Unknown");
            expect(metadata.IsVisible).toBe(true);
            expect(metadata.IsReadOnly).toBe(false);
            expect(metadata.IsRequired).toBe(false);
            expect(metadata.IsValid).toBe(true);
            expect(metadata.ValidationMessages).toHaveLength(0);
        });

        it("should register and detect rule existence", () =>
        {
            expect(provider.HasRule("Name")).toBe(false);
            provider.AddTestRule("Name", "Name", {});
            expect(provider.HasRule("Name")).toBe(true);
        });

        it("should return registered property IDs", () =>
        {
            provider.AddTestRule("Name", "Name", {});
            provider.AddTestRule("DataType", "Data Type", {});

            const ids = provider.GetRegisteredPropertyIDs();
            expect(ids).toContain("Name");
            expect(ids).toContain("DataType");
            expect(ids).toHaveLength(2);
        });

        it("should remove rules", () =>
        {
            provider.AddTestRule("Name", "Name", {});
            expect(provider.HasRule("Name")).toBe(true);
            
            const result = provider.RemoveTestRule("Name");
            expect(result).toBe(true);
            expect(provider.HasRule("Name")).toBe(false);
        });

        it("should return false when removing non-existent rule", () =>
        {
            const result = provider.RemoveTestRule("NonExistent");
            expect(result).toBe(false);
        });
        it("should allow getting registered rule", () =>
        {
            provider.AddTestRule("Name", "Name", {});
            const rule = provider.GetTestRule("Name");
            expect(rule).toBeDefined();
            expect(rule.PropertyID).toBe("Name");
        });    });

    describe("Visibility rules", () =>
    {
        it("should evaluate IsVisible condition", () =>
        {
            provider.AddTestRule("Length", "Length", {
                IsVisible: (ctx) => ctx.GetPropertyValue("DataType") === "String"
            });

            element.DataType = "String";
            expect(provider.GetMetadata(element, "Length").IsVisible).toBe(true);

            element.DataType = "Int32";
            expect(provider.GetMetadata(element, "Length").IsVisible).toBe(false);
        });

        it("should use convenience method IsPropertyVisible", () =>
        {
            provider.AddTestRule("Scale", "Scale", {
                IsVisible: (ctx) =>
                {
                    const dt = ctx.GetPropertyValue("DataType");
                    return dt === "Numeric" || dt === "Decimal";
                }
            });

            element.DataType = "Decimal";
            expect(provider.IsPropertyVisible(element, "Scale")).toBe(true);

            element.DataType = "String";
            expect(provider.IsPropertyVisible(element, "Scale")).toBe(false);
        });
    });
    describe("Text and Hint providers", () =>
    {
        it("should evaluate Hint and Placeholder providers", () =>
        {
            provider.AddTestRule("Name", "Name", {
                HintProvider: () => "Enter name",
                PlaceholderProvider: () => "Name here"
            });

            const metadata = provider.GetMetadata(element, "Name");
            expect(metadata.Hint).toBe("Enter name");
            expect(metadata.Placeholder).toBe("Name here");
        });
    });
    describe("ReadOnly rules", () =>
    {
        it("should evaluate IsReadOnly condition", () =>
        {
            provider.AddTestRule("Name", "Name", {
                IsReadOnly: (ctx) => !ctx.GetPropertyValue("IsActive")
            });

            element.IsActive = true;
            expect(provider.GetMetadata(element, "Name").IsReadOnly).toBe(false);

            element.IsActive = false;
            expect(provider.GetMetadata(element, "Name").IsReadOnly).toBe(true);
        });

        it("should use convenience method IsPropertyReadOnly", () =>
        {
            provider.AddTestRule("DataType", "Data Type", {
                IsReadOnly: () => true
            });

            expect(provider.IsPropertyReadOnly(element, "DataType")).toBe(true);
        });
    });

    describe("Required rules", () =>
    {
        it("should evaluate IsRequired condition", () =>
        {
            provider.AddTestRule("Length", "Length", {
                IsRequired: (ctx) => ctx.GetPropertyValue("DataType") === "String"
            });

            element.DataType = "String";
            expect(provider.GetMetadata(element, "Length").IsRequired).toBe(true);

            element.DataType = "Int32";
            expect(provider.GetMetadata(element, "Length").IsRequired).toBe(false);
        });

        it("should add validation error when required field is empty", () =>
        {
            provider.AddTestRule("Name", "Name", {
                IsRequired: () => true
            });

            element.Name = "";
            const metadata = provider.GetMetadata(element, "Name");
            
            expect(metadata.IsValid).toBe(false);
            expect(metadata.ValidationMessages).toHaveLength(1);
            expect(metadata.ValidationMessages[0].Message).toContain("required");
        });

        it("should not add validation error for required field with value", () =>
        {
            provider.AddTestRule("Name", "Name", {
                IsRequired: () => true
            });

            element.Name = "Test";
            const metadata = provider.GetMetadata(element, "Name");
            
            expect(metadata.IsValid).toBe(true);
            expect(metadata.ValidationMessages).toHaveLength(0);
        });

        it("should not validate required when property is read-only", () =>
        {
            provider.AddTestRule("Name", "Name", {
                IsRequired: () => true,
                IsReadOnly: () => true
            });

            element.Name = "";
            const metadata = provider.GetMetadata(element, "Name");
            
            // Read-only fields don't trigger required validation
            expect(metadata.ValidationMessages).toHaveLength(0);
        });

        it("should not validate required when property is not visible", () =>
        {
            provider.AddTestRule("Name", "Name", {
                IsRequired: () => true,
                IsVisible: () => false
            });

            element.Name = "";
            const metadata = provider.GetMetadata(element, "Name");
            
            // Hidden fields don't trigger required validation
            expect(metadata.ValidationMessages).toHaveLength(0);
        });
    });

    describe("Custom validators", () =>
    {
        it("should execute custom validators", () =>
        {
            provider.AddTestRule("Length", "Length", {
                Validators: [
                    (ctx) =>
                    {
                        if ((ctx.CurrentValue as number) > 100)
                        {
                            return {
                                PropertyID: ctx.PropertyID,
                                PropertyName: ctx.PropertyName,
                                Severity: XDesignerErrorSeverity.Warning,
                                Message: "Length should be <= 100"
                            };
                        }
                        return null;
                    }
                ]
            });

            element.Length = 50;
            expect(provider.GetMetadata(element, "Length").IsValid).toBe(true);

            element.Length = 150;
            const metadata = provider.GetMetadata(element, "Length");
            expect(metadata.IsValid).toBe(false);
            expect(metadata.ValidationMessages[0].Severity).toBe(XDesignerErrorSeverity.Warning);
        });

        it("should execute multiple validators", () =>
        {
            provider.AddTestRule("Length", "Length", {
                Validators: [
                    (ctx) =>
                    {
                        if ((ctx.CurrentValue as number) < 0)
                            return {
                                PropertyID: ctx.PropertyID,
                                PropertyName: ctx.PropertyName,
                                Severity: XDesignerErrorSeverity.Error,
                                Message: "Length cannot be negative"
                            };
                        return null;
                    },
                    (ctx) =>
                    {
                        if ((ctx.CurrentValue as number) > 8000)
                            return {
                                PropertyID: ctx.PropertyID,
                                PropertyName: ctx.PropertyName,
                                Severity: XDesignerErrorSeverity.Error,
                                Message: "Length cannot exceed 8000"
                            };
                        return null;
                    }
                ]
            });

            element.Length = -5;
            const metadata1 = provider.GetMetadata(element, "Length");
            expect(metadata1.ValidationMessages).toHaveLength(1);
            expect(metadata1.ValidationMessages[0].Message).toContain("negative");

            element.Length = 9000;
            const metadata2 = provider.GetMetadata(element, "Length");
            expect(metadata2.ValidationMessages).toHaveLength(1);
            expect(metadata2.ValidationMessages[0].Message).toContain("8000");
        });
    });

    describe("Global validators", () =>
    {
        it("should execute global validators for matching property", () =>
        {
            provider.AddTestRule("Name", "Name", {});
            provider.AddTestGlobalValidator((ctx) =>
            {
                if (ctx.PropertyID === "Name" && (ctx.CurrentValue as string).includes("test"))
                {
                    return {
                        PropertyID: ctx.PropertyID,
                        PropertyName: ctx.PropertyName,
                        Severity: XDesignerErrorSeverity.Warning,
                        Message: "Name contains 'test'"
                    };
                }
                return null;
            });

            element.Name = "TestField";
            const metadata = provider.GetMetadata(element, "Name");
            expect(metadata.ValidationMessages).toHaveLength(0);

            element.Name = "test_field";
            const metadata2 = provider.GetMetadata(element, "Name");
            expect(metadata2.ValidationMessages).toHaveLength(1);
        });
    });

    describe("Hint and Placeholder providers", () =>
    {
        it("should provide dynamic hints", () =>
        {
            provider.AddTestRule("Length", "Length", {
                HintProvider: (ctx) =>
                {
                    const dt = ctx.GetPropertyValue("DataType");
                    if (dt === "String")
                        return "Maximum number of characters";
                    return "Total digits";
                }
            });

            element.DataType = "String";
            expect(provider.GetMetadata(element, "Length").Hint).toBe("Maximum number of characters");

            element.DataType = "Numeric";
            expect(provider.GetMetadata(element, "Length").Hint).toBe("Total digits");
        });
    });

    describe("GetAllMetadata", () =>
    {
        it("should return metadata for all registered properties", () =>
        {
            provider.AddTestRule("Name", "Name", {});
            provider.AddTestRule("DataType", "Data Type", {});
            provider.AddTestRule("Length", "Length", { IsVisible: () => false });

            const allMetadata = provider.GetAllMetadata(element);

            expect(allMetadata.size).toBe(3);
            expect(allMetadata.get("Name")?.IsVisible).toBe(true);
            expect(allMetadata.get("Length")?.IsVisible).toBe(false);
        });
    });

    describe("ValidateAll", () =>
    {
        it("should collect all validation messages", () =>
        {
            provider.AddTestRule("Name", "Name", {
                IsRequired: () => true
            });
            provider.AddTestRule("Length", "Length", {
                Validators: [
                    (ctx) =>
                    {
                        if ((ctx.CurrentValue as number) < 1)
                            return {
                                PropertyID: ctx.PropertyID,
                                PropertyName: ctx.PropertyName,
                                Severity: XDesignerErrorSeverity.Error,
                                Message: "Length must be > 0"
                            };
                        return null;
                    }
                ]
            });

            element.Name = "";
            element.Length = 0;

            const results = provider.ValidateAll(element);
            expect(results).toHaveLength(2);
        });
    });
});

describe("Helper functions", () =>
{
    describe("CreateEnumValidator", () =>
    {
        it("should validate enum values", () =>
        {
            const validator = CreateEnumValidator<IMockElement>(
                "DataType",
                "Data Type",
                ["String", "Int32", "Boolean"]
            );

            const validCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "DataType",
                "Data Type",
                "String"
            );
            expect(validator(validCtx)).toBeNull();

            const invalidCtx = new MockPropertyContext(
                { Name: "", DataType: "Invalid", Length: 0, Scale: 0, IsActive: true },
                "DataType",
                "Data Type",
                "Invalid"
            );
            expect(validator(invalidCtx)).not.toBeNull();
        });
    });

    describe("CreateMinValidator", () =>
    {
        it("should validate minimum value", () =>
        {
            const validator = CreateMinValidator<IMockElement>("Length", "Length", 1);

            const validCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 5, Scale: 0, IsActive: true },
                "Length",
                "Length",
                5
            );
            expect(validator(validCtx)).toBeNull();

            const invalidCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(validator(invalidCtx)).not.toBeNull();
        });
    });

    describe("CreateMaxValidator", () =>
    {
        it("should validate maximum value", () =>
        {
            const validator = CreateMaxValidator<IMockElement>("Length", "Length", 100);

            const validCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 50, Scale: 0, IsActive: true },
                "Length",
                "Length",
                50
            );
            expect(validator(validCtx)).toBeNull();

            const invalidCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 150, Scale: 0, IsActive: true },
                "Length",
                "Length",
                150
            );
            expect(validator(invalidCtx)).not.toBeNull();
        });
    });

    describe("CreateRangeValidator", () =>
    {
        it("should validate range", () =>
        {
            const validator = CreateRangeValidator<IMockElement>("Length", "Length", 1, 100);

            const validCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 50, Scale: 0, IsActive: true },
                "Length",
                "Length",
                50
            );
            expect(validator(validCtx)).toBeNull();

            const belowCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(validator(belowCtx)).not.toBeNull();

            const aboveCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 150, Scale: 0, IsActive: true },
                "Length",
                "Length",
                150
            );
            expect(validator(aboveCtx)).not.toBeNull();
        });
    });

    describe("CreatePatternValidator", () =>
    {
        it("should validate pattern", () =>
        {
            const validator = CreatePatternValidator<IMockElement>(
                "Name",
                "Name",
                /^[a-zA-Z_][a-zA-Z0-9_]*$/
            );

            const validCtx = new MockPropertyContext(
                { Name: "ValidName", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Name",
                "Name",
                "ValidName"
            );
            expect(validator(validCtx)).toBeNull();

            const invalidCtx = new MockPropertyContext(
                { Name: "123Invalid", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Name",
                "Name",
                "123Invalid"
            );
            expect(validator(invalidCtx)).not.toBeNull();
        });

        it("should use custom message", () =>
        {
            const validator = CreatePatternValidator<IMockElement>(
                "Name",
                "Name",
                /^[a-zA-Z]+$/,
                "Only letters allowed"
            );

            const invalidCtx = new MockPropertyContext(
                { Name: "Test123", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Name",
                "Name",
                "Test123"
            );
            const result = validator(invalidCtx);
            expect(result?.Message).toBe("Only letters allowed");
        });
    });

    describe("CreateCustomValidator", () =>
    {
        it("should execute custom validation logic", () =>
        {
            const validator = CreateCustomValidator<IMockElement>(
                "Scale",
                "Scale",
                (val, ctx) =>
                {
                    const length = ctx.GetPropertyValue("Length") as number;
                    return (val as number) <= length;
                },
                "Scale cannot exceed Length"
            );

            const validCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 10, Scale: 2, IsActive: true },
                "Scale",
                "Scale",
                2
            );
            expect(validator(validCtx)).toBeNull();

            const invalidCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 5, Scale: 10, IsActive: true },
                "Scale",
                "Scale",
                10
            );
            expect(validator(invalidCtx)).not.toBeNull();
        });

        it("should support different severities", () =>
        {
            const validator = CreateCustomValidator<IMockElement>(
                "Name",
                "Name",
                () => false,
                "Test warning",
                XDesignerErrorSeverity.Warning
            );

            const ctx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Name",
                "Name",
                ""
            );
            const result = validator(ctx);
            expect(result?.Severity).toBe(XDesignerErrorSeverity.Warning);
        });
    });
});

describe("Condition helpers", () =>
{
    describe("WhenPropertyEquals", () =>
    {
        it("should check property equality", () =>
        {
            const condition = WhenPropertyEquals<IMockElement>("DataType", "String");

            const trueCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(trueCtx)).toBe(true);

            const falseCtx = new MockPropertyContext(
                { Name: "", DataType: "Int32", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(falseCtx)).toBe(false);
        });
    });

    describe("WhenPropertyIn", () =>
    {
        it("should check if property is in list", () =>
        {
            const condition = WhenPropertyIn<IMockElement>("DataType", ["String", "Text"]);

            const trueCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(trueCtx)).toBe(true);

            const falseCtx = new MockPropertyContext(
                { Name: "", DataType: "Int32", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(falseCtx)).toBe(false);
        });
    });

    describe("WhenPropertyNotIn", () =>
    {
        it("should check if property is NOT in list", () =>
        {
            const condition = WhenPropertyNotIn<IMockElement>("DataType", ["Int32", "Int64"]);

            const trueCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(trueCtx)).toBe(true);

            const falseCtx = new MockPropertyContext(
                { Name: "", DataType: "Int32", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(falseCtx)).toBe(false);
        });
    });

    describe("AllOf", () =>
    {
        it("should combine conditions with AND", () =>
        {
            const condition = AllOf(
                WhenPropertyEquals<IMockElement>("DataType", "String"),
                WhenPropertyEquals<IMockElement>("IsActive", true)
            );

            const allTrueCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(allTrueCtx)).toBe(true);

            const oneFalseCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: false },
                "Length",
                "Length",
                0
            );
            expect(condition(oneFalseCtx)).toBe(false);
        });
    });

    describe("AnyOf", () =>
    {
        it("should combine conditions with OR", () =>
        {
            const condition = AnyOf(
                WhenPropertyEquals<IMockElement>("DataType", "String"),
                WhenPropertyEquals<IMockElement>("DataType", "Text")
            );

            const firstTrueCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(firstTrueCtx)).toBe(true);

            const secondTrueCtx = new MockPropertyContext(
                { Name: "", DataType: "Text", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(secondTrueCtx)).toBe(true);

            const noneCtx = new MockPropertyContext(
                { Name: "", DataType: "Int32", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(noneCtx)).toBe(false);
        });
    });

    describe("Not", () =>
    {
        it("should invert condition", () =>
        {
            const condition = Not(WhenPropertyEquals<IMockElement>("IsActive", true));

            const trueCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 0, Scale: 0, IsActive: false },
                "Name",
                "Name",
                ""
            );
            expect(condition(trueCtx)).toBe(true);

            const falseCtx = new MockPropertyContext(
                { Name: "", DataType: "", Length: 0, Scale: 0, IsActive: true },
                "Name",
                "Name",
                ""
            );
            expect(condition(falseCtx)).toBe(false);
        });
    });

    describe("Combined conditions", () =>
    {
        it("should support complex combinations", () =>
        {
            // (DataType == String OR DataType == Text) AND IsActive == true
            const condition = AllOf(
                AnyOf(
                    WhenPropertyEquals<IMockElement>("DataType", "String"),
                    WhenPropertyEquals<IMockElement>("DataType", "Text")
                ),
                WhenPropertyEquals<IMockElement>("IsActive", true)
            );

            const validCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: true },
                "Length",
                "Length",
                0
            );
            expect(condition(validCtx)).toBe(true);

            const inactiveCtx = new MockPropertyContext(
                { Name: "", DataType: "String", Length: 0, Scale: 0, IsActive: false },
                "Length",
                "Length",
                0
            );
            expect(condition(inactiveCtx)).toBe(false);
        });
    });
});
