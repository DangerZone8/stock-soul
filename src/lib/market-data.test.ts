import { describe, expect, it } from "vitest";
import { marketFunctionUrl } from "./market-data";

describe("marketFunctionUrl", () => {
  it("uses the configured Supabase URL and removes trailing slashes", () => {
    expect(marketFunctionUrl("stock-chart", {
      VITE_SUPABASE_URL: "https://example.supabase.co///",
    })).toBe("https://example.supabase.co/functions/v1/stock-chart");
  });

  it("falls back to the Supabase project ID for older Lovable environments", () => {
    expect(marketFunctionUrl("stock-chart", {
      VITE_SUPABASE_PROJECT_ID: "example-project",
    })).toBe("https://example-project.supabase.co/functions/v1/stock-chart");
  });

  it("fails with a useful message when deployment configuration is missing", () => {
    expect(() => marketFunctionUrl("stock-chart", {})).toThrow(/VITE_SUPABASE_URL/);
  });

  it("rejects malformed function names", () => {
    expect(() => marketFunctionUrl("../other", {
      VITE_SUPABASE_URL: "https://example.supabase.co",
    })).toThrow(/Invalid market function name/);
  });
});
