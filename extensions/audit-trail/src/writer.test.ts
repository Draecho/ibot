import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditWriter } from "./writer.js";

describe("AuditWriter", () => {
  let tmpDir: string;
  let auditDir: string;
  let writer: AuditWriter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
    auditDir = path.join(tmpDir, "audit");
    writer = new AuditWriter(auditDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the audit directory if it does not exist", async () => {
    await writer.append({
      toolName: "read",
      params: { path: "/foo" },
      result: "contents",
      durationMs: 42,
    });

    expect(fs.existsSync(auditDir)).toBe(true);
  });

  it("writes a JSONL entry with correct fields", async () => {
    await writer.append({
      toolName: "bash",
      toolCallId: "call_123",
      params: { command: "echo hello" },
      result: "hello\n",
      durationMs: 100,
    });

    const files = fs.readdirSync(auditDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);

    const content = fs.readFileSync(path.join(auditDir, files[0]), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.toolName).toBe("bash");
    expect(entry.toolCallId).toBe("call_123");
    expect(entry.durationMs).toBe(100);
    expect(entry.isError).toBe(false);
    expect(entry.inputHash).toMatch(/^[0-9a-f]{16}$/);
    expect(entry.outputHash).toMatch(/^[0-9a-f]{16}$/);
    expect(entry.ts).toBeTruthy();
  });

  it("marks error entries correctly", async () => {
    await writer.append({
      toolName: "bash",
      params: { command: "exit 1" },
      error: "command failed",
      durationMs: 50,
    });

    const files = fs.readdirSync(auditDir);
    const content = fs.readFileSync(path.join(auditDir, files[0]), "utf-8");
    const entry = JSON.parse(content.trim());
    expect(entry.isError).toBe(true);
  });

  it("appends multiple entries to the same file", async () => {
    await writer.append({
      toolName: "read",
      params: { path: "/a" },
      result: "a",
    });
    await writer.append({
      toolName: "write",
      params: { path: "/b" },
      result: "ok",
    });

    const files = fs.readdirSync(auditDir);
    const content = fs.readFileSync(path.join(auditDir, files[0]), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(2);
  });

  it("does not throw on write failure", async () => {
    // Use a path that can't be created
    const badWriter = new AuditWriter("/dev/null/impossible/path");
    // Should not throw
    await expect(
      badWriter.append({
        toolName: "test",
        params: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("hashes input and output deterministically", async () => {
    await writer.append({
      toolName: "read",
      params: { path: "/same" },
      result: "same result",
    });
    await writer.append({
      toolName: "read",
      params: { path: "/same" },
      result: "same result",
    });

    const files = fs.readdirSync(auditDir);
    const content = fs.readFileSync(path.join(auditDir, files[0]), "utf-8");
    const lines = content.trim().split("\n");
    const entry1 = JSON.parse(lines[0]);
    const entry2 = JSON.parse(lines[1]);
    expect(entry1.inputHash).toBe(entry2.inputHash);
    expect(entry1.outputHash).toBe(entry2.outputHash);
  });
});
