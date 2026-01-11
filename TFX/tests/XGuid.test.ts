import { describe, it, expect, vi } from "vitest";
import { XGuid, XGuidFormat } from "../src/Core/XGuid.js";

describe("XGuid", () =>
{
    describe("XGuid.Empty and XGuid.EmptyValue", () =>
    {
        it("should have correct empty value", () =>
        {
            expect(XGuid.EmptyValue).toBe("00000000-0000-0000-0000-000000000000");
        });

        it("should have correct length", () =>
        {
            expect(XGuid.EmptyValue.length).toBe(36);
        });

        it("should be valid format", () =>
        {
            expect(XGuid.IsValid(XGuid.EmptyValue)).toBe(true);
        });

        it("should have Empty instance equal to EmptyValue", () =>
        {
            expect(XGuid.Empty.Value).toBe(XGuid.EmptyValue);
        });

        it("should have IsEmpty true for Empty instance", () =>
        {
            expect(XGuid.Empty.IsEmpty).toBe(true);
        });

        it("should have IsFull false for Empty instance", () =>
        {
            expect(XGuid.Empty.IsFull).toBe(false);
        });
    });

    describe("XGuid.IsEmptyValue", () =>
    {
        it("should return true for EmptyValue", () =>
        {
            expect(XGuid.IsEmptyValue(XGuid.EmptyValue)).toBe(true);
        });

        it("should return true for null", () =>
        {
            expect(XGuid.IsEmptyValue(null)).toBe(true);
        });

        it("should return true for undefined", () =>
        {
            expect(XGuid.IsEmptyValue(undefined)).toBe(true);
        });

        it("should return false for valid GUID", () =>
        {
            expect(XGuid.IsEmptyValue("12345678-1234-1234-1234-123456789012")).toBe(false);
        });
    });

    describe("XGuid.IsFullValue", () =>
    {
        it("should return false for EmptyValue", () =>
        {
            expect(XGuid.IsFullValue(XGuid.EmptyValue)).toBe(false);
        });

        it("should return false for null", () =>
        {
            expect(XGuid.IsFullValue(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            expect(XGuid.IsFullValue(undefined)).toBe(false);
        });

        it("should return true for valid GUID", () =>
        {
            expect(XGuid.IsFullValue("12345678-1234-1234-1234-123456789012")).toBe(true);
        });

        it("should return true for any non-empty string", () =>
        {
            expect(XGuid.IsFullValue("some-value")).toBe(true);
        });
    });

    describe("XGuid.NewValue", () =>
    {
        it("should return a non-empty GUID", () =>
        {
            const guid = XGuid.NewValue();
            expect(XGuid.IsFullValue(guid)).toBe(true);
        });

        it("should return unique values on each call", () =>
        {
            const guid1 = XGuid.NewValue();
            const guid2 = XGuid.NewValue();
            expect(guid1).not.toBe(guid2);
        });

        it("should return string type", () =>
        {
            const guid = XGuid.NewValue();
            expect(typeof guid).toBe("string");
        });

        it("should return a valid UUID format", () =>
        {
            const guid = XGuid.NewValue();
            expect(XGuid.IsValid(guid)).toBe(true);
        });

        it("should have correct length of 36 characters", () =>
        {
            const guid = XGuid.NewValue();
            expect(guid.length).toBe(36);
        });

        it("should have version 4 marker at position 14", () =>
        {
            const guid = XGuid.NewValue();
            expect(guid[14]).toBe("4");
        });

        it("should have variant marker at position 19", () =>
        {
            const guid = XGuid.NewValue();
            expect(["8", "9", "a", "b"]).toContain(guid[19]);
        });

        it("should generate 1000 unique GUIDs", () =>
        {
            const guids = new Set<string>();
            for (let i = 0; i < 1000; i++)
                guids.add(XGuid.NewValue());
            expect(guids.size).toBe(1000);
        });
    });

    describe("XGuid.New", () =>
    {
        it("should create a new valid GUID", () =>
        {
            const guid = XGuid.New();
            expect(XGuid.IsValid(guid.Value)).toBe(true);
        });

        it("should create unique GUIDs", () =>
        {
            const guid1 = XGuid.New();
            const guid2 = XGuid.New();
            expect(guid1.Value).not.toBe(guid2.Value);
        });

        it("should create a GUID that is not empty", () =>
        {
            const guid = XGuid.New();
            expect(guid.IsEmpty).toBe(false);
            expect(guid.IsFull).toBe(true);
        });

        it("should have version 4 marker", () =>
        {
            const guid = XGuid.New();
            expect(guid.Value[14]).toBe("4");
        });

        it("should have correct variant marker", () =>
        {
            const guid = XGuid.New();
            expect(["8", "9", "a", "b"]).toContain(guid.Value[19]);
        });

        it("should prefer crypto.randomUUID when available", () =>
        {
            const originalCrypto = globalThis.crypto;
            vi.stubGlobal("crypto", { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as unknown as Crypto);

            try
            {
                const guid = XGuid.New();
                expect(guid.Value).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
            }
            finally
            {
                vi.stubGlobal("crypto", originalCrypto as unknown as Crypto);
            }
        });

        it("should fall back when crypto.randomUUID is missing", () =>
        {
            const originalCrypto = globalThis.crypto;
            vi.stubGlobal("crypto", {} as unknown as Crypto);

            try
            {
                const guid = XGuid.New();
                expect(XGuid.IsValid(guid.Value)).toBe(true);
                expect(guid.IsEmpty).toBe(false);
            }
            finally
            {
                vi.stubGlobal("crypto", originalCrypto as unknown as Crypto);
            }
        });
    });

    describe("XGuid.NewFallback", () =>
    {
        it("should return a valid UUID format", () =>
        {
            const guid = XGuid.NewFallback();
            expect(XGuid.IsValid(guid.Value)).toBe(true);
        });

        it("should have correct length of 36 characters", () =>
        {
            const guid = XGuid.NewFallback();
            expect(guid.Value.length).toBe(36);
        });

        it("should have version 4 marker at position 14", () =>
        {
            const guid = XGuid.NewFallback();
            expect(guid.Value[14]).toBe("4");
        });

        it("should have variant marker at position 19", () =>
        {
            const guid = XGuid.NewFallback();
            expect(["8", "9", "a", "b"]).toContain(guid.Value[19]);
        });

        it("should return unique values", () =>
        {
            const guid1 = XGuid.NewFallback();
            const guid2 = XGuid.NewFallback();
            expect(guid1.Value).not.toBe(guid2.Value);
        });

        it("should have dashes at correct positions", () =>
        {
            const guid = XGuid.NewFallback();
            expect(guid.Value[8]).toBe("-");
            expect(guid.Value[13]).toBe("-");
            expect(guid.Value[18]).toBe("-");
            expect(guid.Value[23]).toBe("-");
        });

        it("should use crypto.getRandomValues when available", () =>
        {
            const originalCrypto = globalThis.crypto;

            vi.stubGlobal(
                "crypto",
                {
                    getRandomValues: (pArr: Uint8Array) =>
                    {
                        pArr[0] = 0xab;
                        return pArr;
                    }
                } as unknown as Crypto
            );

            try
            {
                const guid = XGuid.NewFallback();
                expect(guid.Value).toBe("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
            }
            finally
            {
                vi.stubGlobal("crypto", originalCrypto as unknown as Crypto);
            }
        });

        it("should generate 100 unique GUIDs", () =>
        {
            const guids = new Set<string>();
            for (let i = 0; i < 100; i++)
                guids.add(XGuid.NewFallback().Value);
            expect(guids.size).toBe(100);
        });

        it("should be parseable", () =>
        {
            const guid = XGuid.NewFallback();
            const parsed = XGuid.Parse(guid.Value);
            expect(parsed.Value).toBe(guid.Value);
        });
    });

    describe("XGuid.IsValid", () =>
    {
        it("should return true for standard format with dashes", () =>
        {
            expect(XGuid.IsValid("12345678-1234-1234-1234-123456789012")).toBe(true);
        });

        it("should return true for format without dashes", () =>
        {
            expect(XGuid.IsValid("12345678123412341234123456789012")).toBe(true);
        });

        it("should return true for uppercase", () =>
        {
            expect(XGuid.IsValid("12345678-1234-1234-1234-123456789ABC")).toBe(true);
        });

        it("should return true for mixed case", () =>
        {
            expect(XGuid.IsValid("12345678-1234-1234-1234-123456789aBc")).toBe(true);
        });

        it("should return true for EmptyValue", () =>
        {
            expect(XGuid.IsValid(XGuid.EmptyValue)).toBe(true);
        });

        it("should return false for null", () =>
        {
            expect(XGuid.IsValid(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            expect(XGuid.IsValid(undefined)).toBe(false);
        });

        it("should return false for empty string", () =>
        {
            expect(XGuid.IsValid("")).toBe(false);
        });

        it("should return false for invalid characters", () =>
        {
            expect(XGuid.IsValid("12345678-1234-1234-1234-12345678901g")).toBe(false);
        });

        it("should return false for wrong length", () =>
        {
            expect(XGuid.IsValid("12345678-1234-1234-1234-12345678901")).toBe(false);
        });

        it("should return false for wrong dash positions", () =>
        {
            expect(XGuid.IsValid("1234567-81234-1234-1234-123456789012")).toBe(false);
        });

        it("should return false for arbitrary string", () =>
        {
            expect(XGuid.IsValid("not-a-guid")).toBe(false);
        });
    });

    describe("XGuid.Parse", () =>
    {
        it("should parse standard format", () =>
        {
            const guid = XGuid.Parse("12345678-1234-5678-9ABC-DEF012345678");
            expect(guid.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should parse format without dashes", () =>
        {
            const guid = XGuid.Parse("12345678123456789ABCDEF012345678");
            expect(guid.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should parse braced format", () =>
        {
            const guid = XGuid.Parse("{12345678-1234-5678-9ABC-DEF012345678}");
            expect(guid.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should parse parenthesized format", () =>
        {
            const guid = XGuid.Parse("(12345678-1234-5678-9ABC-DEF012345678)");
            expect(guid.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should handle whitespace", () =>
        {
            const guid = XGuid.Parse("  12345678-1234-5678-9ABC-DEF012345678  ");
            expect(guid.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should normalize to lowercase", () =>
        {
            const guid = XGuid.Parse("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE");
            expect(guid.Value).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        });

        it("should throw for null", () =>
        {
            expect(() => XGuid.Parse(null as unknown as string)).toThrow();
        });

        it("should throw for empty string", () =>
        {
            expect(() => XGuid.Parse("")).toThrow();
        });

        it("should throw for invalid format", () =>
        {
            expect(() => XGuid.Parse("not-a-guid")).toThrow();
        });

        it("should throw for wrong length", () =>
        {
            expect(() => XGuid.Parse("12345678-1234-1234")).toThrow();
        });
    });

    describe("XGuid.TryParse", () =>
    {
        it("should return parsed GUID for valid input", () =>
        {
            const guid = XGuid.TryParse("12345678-1234-5678-9ABC-DEF012345678");
            expect(guid).not.toBeNull();
            expect(guid!.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should return null for null input", () =>
        {
            expect(XGuid.TryParse(null)).toBeNull();
        });

        it("should return null for undefined input", () =>
        {
            expect(XGuid.TryParse(undefined)).toBeNull();
        });

        it("should return null for empty string", () =>
        {
            expect(XGuid.TryParse("")).toBeNull();
        });

        it("should return null for invalid format", () =>
        {
            expect(XGuid.TryParse("invalid")).toBeNull();
        });

        it("should parse format without dashes", () =>
        {
            const guid = XGuid.TryParse("12345678123456789ABCDEF012345678");
            expect(guid).not.toBeNull();
            expect(guid!.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should parse braced format", () =>
        {
            const guid = XGuid.TryParse("{12345678-1234-5678-9ABC-DEF012345678}");
            expect(guid).not.toBeNull();
            expect(guid!.Value).toBe("12345678-1234-5678-9abc-def012345678");
        });
    });

    describe("XGuid.EqualsValue", () =>
    {
        it("should return true for identical GUIDs", () =>
        {
            const guid = "12345678-1234-5678-9abc-def012345678";
            expect(XGuid.EqualsValue(guid, guid)).toBe(true);
        });

        it("should return true for same GUID different case", () =>
        {
            expect(XGuid.EqualsValue(
                "12345678-1234-5678-9abc-def012345678",
                "12345678-1234-5678-9ABC-DEF012345678"
            )).toBe(true);
        });

        it("should return false for different GUIDs", () =>
        {
            expect(XGuid.EqualsValue(
                "12345678-1234-5678-9abc-def012345678",
                "87654321-4321-8765-cba9-fedcba987654"
            )).toBe(false);
        });

        it("should return true for both null", () =>
        {
            expect(XGuid.EqualsValue(null, null)).toBe(true);
        });

        it("should return true for both undefined", () =>
        {
            expect(XGuid.EqualsValue(undefined, undefined)).toBe(true);
        });

        it("should return true for null and undefined", () =>
        {
            expect(XGuid.EqualsValue(null, undefined)).toBe(true);
        });

        it("should return false for null and valid GUID", () =>
        {
            expect(XGuid.EqualsValue(null, "12345678-1234-5678-9abc-def012345678")).toBe(false);
        });

        it("should return false for valid GUID and null", () =>
        {
            expect(XGuid.EqualsValue("12345678-1234-5678-9abc-def012345678", null)).toBe(false);
        });

        it("should return true for two EmptyValue", () =>
        {
            expect(XGuid.EqualsValue(XGuid.EmptyValue, XGuid.EmptyValue)).toBe(true);
        });
    });

    describe("XGuid.CompareValue", () =>
    {
        it("should return 0 for identical GUIDs", () =>
        {
            const guid = "12345678-1234-5678-9abc-def012345678";
            expect(XGuid.CompareValue(guid, guid)).toBe(0);
        });

        it("should return 0 for same GUID different case", () =>
        {
            expect(XGuid.CompareValue(
                "12345678-1234-5678-9abc-def012345678",
                "12345678-1234-5678-9ABC-DEF012345678"
            )).toBe(0);
        });

        it("should return negative for lesser GUID", () =>
        {
            expect(XGuid.CompareValue(
                "00000000-0000-0000-0000-000000000001",
                "ffffffff-ffff-ffff-ffff-ffffffffffff"
            )).toBeLessThan(0);
        });

        it("should return positive for greater GUID", () =>
        {
            expect(XGuid.CompareValue(
                "ffffffff-ffff-ffff-ffff-ffffffffffff",
                "00000000-0000-0000-0000-000000000001"
            )).toBeGreaterThan(0);
        });

        it("should return 0 for both null", () =>
        {
            expect(XGuid.CompareValue(null, null)).toBe(0);
        });

        it("should return negative for null vs valid", () =>
        {
            expect(XGuid.CompareValue(null, "12345678-1234-5678-9abc-def012345678")).toBeLessThan(0);
        });

        it("should return positive for valid vs null", () =>
        {
            expect(XGuid.CompareValue("12345678-1234-5678-9abc-def012345678", null)).toBeGreaterThan(0);
        });

        it("should sort GUIDs correctly", () =>
        {
            const guids = [
                "cccccccc-cccc-cccc-cccc-cccccccccccc",
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
            ];
            const sorted = [...guids].sort(XGuid.CompareValue);
            expect(sorted[0]).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
            expect(sorted[1]).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
            expect(sorted[2]).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
        });
    });

    describe("XGuid.ToStringValue", () =>
    {
        it("should format D (default) with dashes", () =>
        {
            expect(XGuid.ToStringValue("12345678-1234-5678-9abc-def012345678")).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should format N without dashes", () =>
        {
            expect(XGuid.ToStringValue("12345678-1234-5678-9abc-def012345678", XGuidFormat.N)).toBe("12345678123456789abcdef012345678");
        });

        it("should format B with braces", () =>
        {
            expect(XGuid.ToStringValue("12345678-1234-5678-9abc-def012345678", XGuidFormat.B)).toBe("{12345678-1234-5678-9abc-def012345678}");
        });

        it("should format P with parentheses", () =>
        {
            expect(XGuid.ToStringValue("12345678-1234-5678-9abc-def012345678", XGuidFormat.P)).toBe("(12345678-1234-5678-9abc-def012345678)");
        });

        it("should handle uppercase input", () =>
        {
            expect(XGuid.ToStringValue("12345678-1234-5678-9ABC-DEF012345678")).toBe("12345678-1234-5678-9abc-def012345678");
        });

        it("should handle null value", () =>
        {
            expect(XGuid.ToStringValue(null)).toBe(XGuid.EmptyValue);
        });

        it("should handle undefined value", () =>
        {
            expect(XGuid.ToStringValue(undefined)).toBe(XGuid.EmptyValue);
        });

        it("should handle EmptyValue", () =>
        {
            expect(XGuid.ToStringValue(XGuid.EmptyValue)).toBe(XGuid.EmptyValue);
        });
    });

    describe("XGuid.ToBytesValue", () =>
    {
        it("should convert GUID to 16 bytes", () =>
        {
            const bytes = XGuid.ToBytesValue("12345678-1234-5678-9abc-def012345678");
            expect(bytes.length).toBe(16);
        });

        it("should convert correctly", () =>
        {
            const bytes = XGuid.ToBytesValue("01020304-0506-0708-090a-0b0c0d0e0f10");
            expect(bytes[0]).toBe(0x01);
            expect(bytes[1]).toBe(0x02);
            expect(bytes[14]).toBe(0x0f);
            expect(bytes[15]).toBe(0x10);
        });

        it("should handle EmptyValue", () =>
        {
            const bytes = XGuid.ToBytesValue(XGuid.EmptyValue);
            expect(bytes.every(b => b === 0)).toBe(true);
        });

        it("should handle max values", () =>
        {
            const bytes = XGuid.ToBytesValue("ffffffff-ffff-ffff-ffff-ffffffffffff");
            expect(bytes.every(b => b === 255)).toBe(true);
        });
    });

    describe("XGuid.FromBytesValue", () =>
    {
        it("should convert 16 bytes to GUID string", () =>
        {
            const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]);
            const guid = XGuid.FromBytesValue(bytes);
            expect(guid).toBe("01020304-0506-0708-090a-0b0c0d0e0f10");
        });

        it("should produce EmptyValue from zero bytes", () =>
        {
            const bytes = new Uint8Array(16);
            expect(XGuid.FromBytesValue(bytes)).toBe(XGuid.EmptyValue);
        });

        it("should round-trip with ToBytesValue", () =>
        {
            const original = "12345678-1234-5678-9abc-def012345678";
            const bytes = XGuid.ToBytesValue(original);
            const restored = XGuid.FromBytesValue(bytes);
            expect(restored).toBe(original);
        });

        it("should handle max values", () =>
        {
            const bytes = new Uint8Array(16).fill(255);
            expect(XGuid.FromBytesValue(bytes)).toBe("ffffffff-ffff-ffff-ffff-ffffffffffff");
        });
    });

    describe("XGuid.FromBytes", () =>
    {
        it("should throw for wrong length", () =>
        {
            expect(() => XGuid.FromBytes(new Uint8Array(15))).toThrow();
            expect(() => XGuid.FromBytes(new Uint8Array(17))).toThrow();
        });
    });

    describe("XGuid instance methods", () =>
    {
        describe("constructor", () =>
        {
            it("should create from string value", () =>
            {
                const guid = new XGuid("12345678-1234-5678-9ABC-DEF012345678");
                expect(guid.Value).toBe("12345678-1234-5678-9abc-def012345678");
            });

            it("should create empty GUID with no argument", () =>
            {
                const guid = new XGuid();
                expect(guid.Value).toBe(XGuid.EmptyValue);
            });
        });

        describe("Value property", () =>
        {
            it("should return lowercase GUID", () =>
            {
                const guid = new XGuid("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE");
                expect(guid.Value).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
            });
        });

        describe("IsEmpty property", () =>
        {
            it("should return true for empty GUID", () =>
            {
                const guid = new XGuid(XGuid.EmptyValue);
                expect(guid.IsEmpty).toBe(true);
            });

            it("should return false for non-empty GUID", () =>
            {
                const guid = XGuid.New();
                expect(guid.IsEmpty).toBe(false);
            });
        });

        describe("IsFull property", () =>
        {
            it("should return false for empty GUID", () =>
            {
                const guid = new XGuid(XGuid.EmptyValue);
                expect(guid.IsFull).toBe(false);
            });

            it("should return true for non-empty GUID", () =>
            {
                const guid = XGuid.New();
                expect(guid.IsFull).toBe(true);
            });
        });

        describe("Equals method", () =>
        {
            it("should return true for equal GUIDs", () =>
            {
                const guid1 = XGuid.Parse("12345678-1234-5678-9ABC-DEF012345678");
                const guid2 = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid1.Equals(guid2)).toBe(true);
            });

            it("should return false for different GUIDs", () =>
            {
                const guid1 = XGuid.New();
                const guid2 = XGuid.New();
                expect(guid1.Equals(guid2)).toBe(false);
            });

            it("should return false for null", () =>
            {
                const guid = XGuid.New();
                expect(guid.Equals(null)).toBe(false);
            });

            it("should return false for undefined", () =>
            {
                const guid = XGuid.New();
                expect(guid.Equals(undefined)).toBe(false);
            });
        });

        describe("CompareTo method", () =>
        {
            it("should return 0 for equal GUIDs", () =>
            {
                const guid1 = XGuid.Parse("12345678-1234-5678-9ABC-DEF012345678");
                const guid2 = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid1.CompareTo(guid2)).toBe(0);
            });

            it("should sort GUIDs correctly", () =>
            {
                const guids = [
                    XGuid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                    XGuid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    XGuid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
                ];
                const sorted = [...guids].sort((a, b) => a.CompareTo(b));
                expect(sorted[0].Value).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
                expect(sorted[1].Value).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
                expect(sorted[2].Value).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
            });

            it("should compare against null and undefined", () =>
            {
                const guid = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(typeof guid.CompareTo(null)).toBe("number");
                expect(typeof guid.CompareTo(undefined)).toBe("number");
            });
        });

        describe("ToString method", () =>
        {
            it("should format D (default) with dashes", () =>
            {
                const guid = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid.ToString()).toBe("12345678-1234-5678-9abc-def012345678");
                expect(guid.ToString(XGuidFormat.D)).toBe("12345678-1234-5678-9abc-def012345678");
            });

            it("should format N without dashes", () =>
            {
                const guid = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid.ToString(XGuidFormat.N)).toBe("12345678123456789abcdef012345678");
            });

            it("should format B with braces", () =>
            {
                const guid = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid.ToString(XGuidFormat.B)).toBe("{12345678-1234-5678-9abc-def012345678}");
            });

            it("should format P with parentheses", () =>
            {
                const guid = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid.ToString(XGuidFormat.P)).toBe("(12345678-1234-5678-9abc-def012345678)");
            });

            it("should return original value when normalized length is not 32", () =>
            {
                const guid = new XGuid("invalid-guid");
                expect(guid.ToString()).toBe("invalid-guid");
            });
        });

        describe("ToBytes method", () =>
        {
            it("should convert to bytes", () =>
            {
                const guid = XGuid.Parse("01020304-0506-0708-090a-0b0c0d0e0f10");
                const bytes = guid.ToBytes();
                expect(bytes.length).toBe(16);
                expect(bytes[0]).toBe(0x01);
                expect(bytes[15]).toBe(0x10);
            });

            it("should round-trip correctly", () =>
            {
                const original = XGuid.New();
                const bytes = original.ToBytes();
                const restored = XGuid.FromBytes(bytes);
                expect(restored.Equals(original)).toBe(true);
            });
        });

        describe("GetHashCode method", () =>
        {
            it("should return a number", () =>
            {
                const guid = XGuid.New();
                expect(typeof guid.GetHashCode()).toBe("number");
            });

            it("should return same hash for equal GUIDs", () =>
            {
                const guid1 = XGuid.Parse("12345678-1234-5678-9ABC-DEF012345678");
                const guid2 = XGuid.Parse("12345678-1234-5678-9abc-def012345678");
                expect(guid1.GetHashCode()).toBe(guid2.GetHashCode());
            });

            it("should return integer", () =>
            {
                const guid = XGuid.New();
                expect(Number.isInteger(guid.GetHashCode())).toBe(true);
            });
        });
    });

    describe("Integration Tests", () =>
    {
        it("should create, format, parse and compare GUIDs", () =>
        {
            const guid1 = XGuid.NewValue();
            const guid2 = XGuid.ToStringValue(guid1, XGuidFormat.B);
            const guid3 = XGuid.Parse(guid2);
            expect(XGuid.EqualsValue(guid1, guid3.Value)).toBe(true);
        });

        it("should serialize to bytes and back", () =>
        {
            const original = XGuid.NewValue();
            const bytes = XGuid.ToBytesValue(original);
            const restored = XGuid.FromBytesValue(bytes);
            expect(restored).toBe(original);
        });

        it("should handle all format round-trips", () =>
        {
            const original = XGuid.NewValue();

            const formatD = XGuid.ToStringValue(original, XGuidFormat.D);
            const formatN = XGuid.ToStringValue(original, XGuidFormat.N);
            const formatB = XGuid.ToStringValue(original, XGuidFormat.B);
            const formatP = XGuid.ToStringValue(original, XGuidFormat.P);

            expect(XGuid.Parse(formatD).Value).toBe(original);
            expect(XGuid.Parse(formatN).Value).toBe(original);
            expect(XGuid.Parse(formatB).Value).toBe(original);
            expect(XGuid.Parse(formatP).Value).toBe(original);
        });
    });
});
