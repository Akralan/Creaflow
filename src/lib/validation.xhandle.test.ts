import { describe, expect, it } from "vitest";
import { xHandleSchema } from "./validation";

describe("xHandleSchema", () => {
  it("accepts a handle with or without the @ and stores it without", () => {
    expect(xHandleSchema.parse("@alix_dev")).toBe("alix_dev");
    expect(xHandleSchema.parse("alix_dev")).toBe("alix_dev");
    expect(xHandleSchema.parse("  @Alix  ")).toBe("Alix");
  });

  it("turns an empty value into null, which clears the handle", () => {
    expect(xHandleSchema.parse("")).toBeNull();
    expect(xHandleSchema.parse("@")).toBeNull();
    expect(xHandleSchema.parse("   ")).toBeNull();
  });

  it("refuses what X would not allow", () => {
    expect(xHandleSchema.safeParse("@@alix").success).toBe(false);
    expect(xHandleSchema.safeParse("a".repeat(16)).success).toBe(false);
    expect(xHandleSchema.safeParse("alix dev").success).toBe(false);
    expect(xHandleSchema.safeParse("alix.dev").success).toBe(false);
    expect(xHandleSchema.safeParse("élodie").success).toBe(false);
    expect(xHandleSchema.safeParse("https://x.com/alix").success).toBe(false);
  });
});
