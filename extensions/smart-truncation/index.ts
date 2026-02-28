import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { truncateToolResult } from "./src/truncation.js";

type SmartTruncationConfig = {
  maxChars?: number;
};

const DEFAULT_MAX_CHARS = 80_000;

export default function register(api: OpenClawPluginApi) {
  const cfg = (api.pluginConfig ?? {}) as SmartTruncationConfig;
  const maxChars = cfg.maxChars ?? DEFAULT_MAX_CHARS;

  api.on(
    "tool_result_persist",
    (event, _ctx) => {
      const msg = event.message;
      // Only process toolResult messages with text content
      // oxlint-disable-next-line typescript/no-explicit-any
      if ((msg as any).role !== "toolResult") return;

      // oxlint-disable-next-line typescript/no-explicit-any
      const content = (msg as any).content;
      if (!Array.isArray(content)) return;

      let modified = false;
      // oxlint-disable-next-line typescript/no-explicit-any
      const newContent = content.map((block: any) => {
        if (block.type !== "text" || typeof block.text !== "string") return block;
        if (block.text.length <= maxChars) return block;

        modified = true;
        return { ...block, text: truncateToolResult(block.text, maxChars) };
      });

      if (!modified) return;

      // oxlint-disable-next-line typescript/no-explicit-any
      return { message: { ...msg, content: newContent } as any };
    },
    { priority: 5 },
  );
}
