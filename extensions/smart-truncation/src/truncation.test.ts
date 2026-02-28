import { describe, expect, it } from "vitest";
import {
  detectContentType,
  truncateJson,
  truncateError,
  truncateText,
  truncateToolResult,
} from "./truncation.js";

describe("detectContentType", () => {
  it("detects JSON objects", () => {
    expect(detectContentType('{"key": "value"}')).toBe("json");
  });

  it("detects JSON arrays", () => {
    expect(detectContentType("[1, 2, 3]")).toBe("json");
  });

  it("detects error stack traces", () => {
    expect(detectContentType("Error: something broke\n  at foo (bar.ts:1:2)")).toBe("error");
  });

  it("detects Python tracebacks", () => {
    expect(
      detectContentType('Traceback (most recent call last):\n  File "foo.py", line 1'),
    ).toBe("error");
  });

  it("defaults to text", () => {
    expect(detectContentType("Hello world")).toBe("text");
  });

  it("handles leading whitespace", () => {
    expect(detectContentType('  {"key": "value"}')).toBe("json");
  });
});

describe("truncateJson", () => {
  it("returns small JSON unchanged", () => {
    const json = JSON.stringify({ a: 1, b: "hello" });
    expect(truncateJson(json, 1000)).toBe(JSON.stringify({ a: 1, b: "hello" }, null, 2));
  });

  it("truncates long string values", () => {
    const long = "x".repeat(5000);
    const json = JSON.stringify({ data: long });
    const result = truncateJson(json, 1000);
    expect(result.length).toBeLessThan(json.length);
    expect(result).toContain("truncated");
  });

  it("truncates large arrays", () => {
    const arr = Array.from({ length: 200 }, (_, i) => ({ id: i }));
    const json = JSON.stringify(arr);
    const result = truncateJson(json, 5000);
    expect(result).toContain("more items");
  });
});

describe("truncateError", () => {
  it("keeps short errors intact", () => {
    const err = "Error: short";
    expect(truncateError(err, 1000)).toBe(err);
  });

  it("truncates long stack traces", () => {
    const lines = ["Error: something failed"];
    for (let i = 0; i < 100; i++) {
      lines.push(`  at func${i} (file.ts:${i}:0)`);
    }
    const text = lines.join("\n");
    const result = truncateError(text, 500);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result).toContain("Error: something failed");
    expect(result).toContain("frames omitted");
  });
});

describe("truncateText", () => {
  it("returns short text unchanged", () => {
    expect(truncateText("hello", 100)).toBe("hello");
  });

  it("truncates long text with head/tail", () => {
    const text = "A".repeat(500) + "B".repeat(500);
    const result = truncateText(text, 200);
    expect(result.length).toBeLessThanOrEqual(250); // allow for marker
    expect(result).toContain("truncated");
    expect(result.startsWith("A")).toBe(true);
    expect(result.endsWith("B")).toBe(true);
  });
});

describe("truncateToolResult", () => {
  it("passes through short content", () => {
    expect(truncateToolResult("hello", 100)).toBe("hello");
  });

  it("detects and truncates JSON", () => {
    const big = JSON.stringify({ data: "x".repeat(5000) });
    const result = truncateToolResult(big, 1000);
    expect(result.length).toBeLessThan(big.length);
  });

  it("detects and truncates errors", () => {
    const lines = ["TypeError: cannot read property 'x' of undefined"];
    for (let i = 0; i < 50; i++) lines.push(`  at f${i} (m.js:${i}:0)`);
    const text = lines.join("\n");
    const result = truncateToolResult(text, 500);
    expect(result).toContain("TypeError");
  });

  it("falls back to text truncation", () => {
    const text = "hello world ".repeat(1000);
    const result = truncateToolResult(text, 500);
    expect(result).toContain("truncated");
  });
});
