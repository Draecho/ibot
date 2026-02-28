import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type AuditEntry = {
  ts: string;
  toolName: string;
  toolCallId?: string;
  durationMs?: number;
  inputHash: string;
  outputHash: string;
  isError: boolean;
  sessionKey?: string;
};

type AppendInput = {
  toolName: string;
  toolCallId?: string;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
  sessionKey?: string;
};

function hashValue(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function getDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export class AuditWriter {
  private readonly baseDir: string;
  private readonly logger?: { warn?: (message: string) => void };

  constructor(outputDir: string, logger?: { warn?: (message: string) => void }) {
    this.baseDir = path.resolve(outputDir);
    this.logger = logger;
  }

  async append(input: AppendInput): Promise<void> {
    try {
      const entry: AuditEntry = {
        ts: new Date().toISOString(),
        toolName: input.toolName,
        toolCallId: input.toolCallId,
        durationMs: input.durationMs,
        inputHash: hashValue(input.params),
        outputHash: input.error ? hashValue(input.error) : hashValue(input.result),
        isError: Boolean(input.error),
        sessionKey: input.sessionKey,
      };

      const dateStr = getDateString();
      const filePath = path.join(this.baseDir, `${dateStr}.jsonl`);

      // Ensure directory exists
      await fs.mkdir(this.baseDir, { recursive: true });

      // Append line
      const line = JSON.stringify(entry) + "\n";
      await fs.appendFile(filePath, line, "utf-8");
    } catch (err) {
      // Fire-and-forget: log but don't throw
      this.logger?.warn?.(`[audit-trail] failed to write audit entry: ${String(err)}`);
    }
  }
}
