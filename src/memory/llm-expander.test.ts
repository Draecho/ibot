import { describe, expect, it, vi } from "vitest";
import { createDefaultLlmQueryExpander, parseReformulations } from "./llm-expander.js";

describe("parseReformulations", () => {
  it("parses plain lines", () => {
    const result = parseReformulations("query one\nquery two\nquery three", 3);
    expect(result).toEqual(["query one", "query two", "query three"]);
  });

  it("strips numbered prefixes", () => {
    const result = parseReformulations("1. first query\n2. second query", 3);
    expect(result).toEqual(["first query", "second query"]);
  });

  it("strips bullet prefixes", () => {
    const result = parseReformulations("- first query\n* second query", 3);
    expect(result).toEqual(["first query", "second query"]);
  });

  it("skips empty lines", () => {
    const result = parseReformulations("query one\n\nquery two\n\n", 3);
    expect(result).toEqual(["query one", "query two"]);
  });

  it("respects maxCount", () => {
    const result = parseReformulations("a\nb\nc\nd", 2);
    expect(result).toEqual(["a", "b"]);
  });

  it("skips overly long lines", () => {
    const long = "x".repeat(501);
    const result = parseReformulations(`short\n${long}\nanother`, 3);
    expect(result).toEqual(["short", "another"]);
  });
});

describe("createDefaultLlmQueryExpander", () => {
  it("returns undefined when not enabled", () => {
    const expander = createDefaultLlmQueryExpander({ enabled: false }, vi.fn());
    expect(expander).toBeUndefined();
  });

  it("returns undefined when no invoker", () => {
    const expander = createDefaultLlmQueryExpander({ enabled: true });
    expect(expander).toBeUndefined();
  });

  it("returns expander function when enabled with invoker", () => {
    const invoker = vi.fn().mockResolvedValue("alt query 1\nalt query 2");
    const expander = createDefaultLlmQueryExpander({ enabled: true }, invoker);
    expect(expander).toBeDefined();
  });

  it("includes original query in results", async () => {
    const invoker = vi.fn().mockResolvedValue("alternative 1\nalternative 2");
    const expander = createDefaultLlmQueryExpander({ enabled: true }, invoker)!;
    const result = await expander("original query");
    expect(result[0]).toBe("original query");
    expect(result).toContain("alternative 1");
    expect(result).toContain("alternative 2");
  });

  it("falls back to original query on error", async () => {
    const invoker = vi.fn().mockRejectedValue(new Error("fail"));
    const expander = createDefaultLlmQueryExpander({ enabled: true }, invoker)!;
    const result = await expander("my query");
    expect(result).toEqual(["my query"]);
  });

  it("respects maxReformulations", async () => {
    const invoker = vi.fn().mockResolvedValue("a\nb\nc\nd\ne");
    const expander = createDefaultLlmQueryExpander(
      { enabled: true, maxReformulations: 2 },
      invoker,
    )!;
    const result = await expander("query");
    // original + 2 alternatives
    expect(result.length).toBe(3);
  });
});
