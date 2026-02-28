/**
 * Content-type-aware truncation for tool results.
 *
 * This module detects whether a tool result is JSON, an error/stack trace,
 * or plain text, and applies a truncation strategy that preserves the most
 * useful information within a character budget.
 */

export type ContentType = "json" | "error" | "text";

/**
 * Detect the content type of a tool result string.
 */
export function detectContentType(text: string): ContentType {
  const trimmed = text.trimStart();

  // JSON heuristic: starts with { or [
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Might be partial/invalid JSON but still JSON-like
      if (trimmed.length > 20 && (trimmed.includes('"') || trimmed.includes(":"))) {
        return "json";
      }
    }
  }

  // Error/stack trace heuristic
  if (
    /^(Error|TypeError|RangeError|SyntaxError|ReferenceError|Traceback|Exception|FAIL|FAILED|panic)/m.test(
      trimmed,
    ) ||
    /^\s+at\s+/m.test(trimmed) ||
    /File ".*", line \d+/m.test(trimmed)
  ) {
    return "error";
  }

  return "text";
}

/**
 * Truncate JSON content preserving structure.
 * Parses the JSON, keeps all keys, and truncates long string values.
 */
export function truncateJson(text: string, maxChars: number): string {
  try {
    const parsed = JSON.parse(text);
    const truncated = truncateJsonValue(parsed, maxChars);
    const result = JSON.stringify(truncated, null, 2);
    if (result.length <= maxChars) return result;
    // If still too long after value truncation, fall back to text truncation
    return truncateText(result, maxChars);
  } catch {
    // Invalid JSON — fall back to text truncation
    return truncateText(text, maxChars);
  }
}

function truncateJsonValue(value: unknown, budget: number, depth = 0): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const maxLeaf = Math.max(200, Math.floor(budget / 10));
    if (value.length > maxLeaf) {
      return value.slice(0, maxLeaf) + `... [truncated ${value.length - maxLeaf} chars]`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (depth > 4) return `[Array(${value.length})]`;
    const maxItems = Math.min(value.length, 50);
    const items = value.slice(0, maxItems).map((v) => truncateJsonValue(v, budget, depth + 1));
    if (value.length > maxItems) {
      items.push(`... ${value.length - maxItems} more items`);
    }
    return items;
  }

  if (typeof value === "object" && value !== null) {
    if (depth > 4) return "[Object]";
    const entries = Object.entries(value);
    const maxKeys = Math.min(entries.length, 100);
    const result: Record<string, unknown> = {};
    for (let i = 0; i < maxKeys; i++) {
      result[entries[i][0]] = truncateJsonValue(entries[i][1], budget, depth + 1);
    }
    if (entries.length > maxKeys) {
      result["__truncated__"] = `${entries.length - maxKeys} more keys`;
    }
    return result;
  }

  return String(value);
}

/**
 * Truncate error/stack trace content.
 * Keeps the full error message and trims the stack trace.
 */
export function truncateError(text: string, maxChars: number): string {
  // Short enough — keep it all
  if (text.length <= maxChars) return text;

  const lines = text.split("\n");

  // Find where the stack trace starts
  let stackStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s+at\s+/.test(lines[i]) || /^\s+File "/.test(lines[i])) {
      stackStart = i;
      break;
    }
  }

  if (stackStart === -1) {
    // No clear stack trace — use text truncation
    return truncateText(text, maxChars);
  }

  // Keep the error message (before stack) fully
  const errorMsg = lines.slice(0, stackStart).join("\n");
  const stackLines = lines.slice(stackStart);

  // Budget for stack
  const stackBudget = maxChars - errorMsg.length - 50; // 50 for separator
  if (stackBudget <= 0) {
    return errorMsg + "\n  [stack trace truncated]";
  }

  // Keep first 3 + last 5 stack frames
  const headCount = Math.min(3, stackLines.length);
  const tailCount = Math.min(5, Math.max(0, stackLines.length - headCount));
  const head = stackLines.slice(0, headCount);
  const tail = tailCount > 0 ? stackLines.slice(-tailCount) : [];
  const skipped = stackLines.length - headCount - tailCount;

  const parts = [...head];
  if (skipped > 0) {
    parts.push(`    ... ${skipped} frames omitted ...`);
  }
  parts.push(...tail);

  const result = errorMsg + "\n" + parts.join("\n");
  if (result.length <= maxChars) return result;
  return truncateText(result, maxChars);
}

/**
 * Truncate plain text: head 60% + marker + tail 20%.
 */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = Math.floor(maxChars * 0.2);
  const omitted = text.length - headSize - tailSize;
  const marker = `\n\n[... truncated ${omitted} characters ...]\n\n`;

  return text.slice(0, headSize) + marker + text.slice(-tailSize);
}

/**
 * Main entry point: detect content type and apply appropriate truncation.
 */
export function truncateToolResult(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const contentType = detectContentType(text);

  switch (contentType) {
    case "json":
      return truncateJson(text, maxChars);
    case "error":
      return truncateError(text, maxChars);
    case "text":
      return truncateText(text, maxChars);
  }
}
