import fsp from "node:fs/promises";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parseLogContent, type LogEntry } from "@/lib/log-parser";
import type { LogFile } from "@/lib/logs";

export type UrlHit = { url: string; host: string; query: { key: string; value: string }[] };
export type JsonBlock = { label: string; json: string };

export type FilePreview = {
  format: "xml" | "json" | "text";
  valid: boolean;
  content: string;
  pretty: string;
  urls: UrlHit[];
  jsonBlocks: JsonBlock[];
  entries: LogEntry[];
  truncated: boolean;
};

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: false,
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
});

/** Re-indents XML without reordering or dropping anything. */
export function formatXml(input: string): string {
  const tokens = input
    .replace(/\r\n/g, "\n")
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let depth = 0;
  return tokens
    .map((token) => {
      if (/^<\/[^>]+>$/.test(token)) depth = Math.max(0, depth - 1);
      const line = `${"  ".repeat(depth)}${token}`;
      const opens =
        /^<[^!?/][^>]*>$/.test(token) && !/\/>$/.test(token) && !/^<[^>]+>[^<]*<\/[^>]+>$/.test(token);
      if (opens) depth += 1;
      return line;
    })
    .join("\n");
}

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&amp;": "&",
};

/** XML nodes often carry escaped URLs and JSON payloads; decode before scanning them. */
export function decodeEntities(value: string): string {
  return value.replace(/&(lt|gt|quot|apos|#39|amp);/g, (match) => ENTITIES[match] ?? match);
}

export function extractUrls(content: string): UrlHit[] {
  const seen = new Map<string, UrlHit>();

  for (const match of content.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) {
    const raw = match[0].replace(/[.,;]+$/, "");
    if (seen.has(raw)) continue;

    try {
      const url = new URL(raw);
      seen.set(raw, {
        url: raw,
        host: url.host,
        query: [...url.searchParams.entries()].map(([key, value]) => ({ key, value })),
      });
    } catch {
      seen.set(raw, { url: raw, host: "", query: [] });
    }
  }

  return [...seen.values()];
}

/** Finds JSON documents embedded in text or XML nodes (payloads, request/response bodies). */
export function extractJsonBlocks(content: string, limit = 12): JsonBlock[] {
  const blocks: JsonBlock[] = [];
  const openers = new Set(["{", "["]);

  for (let i = 0; i < content.length && blocks.length < limit; i += 1) {
    const char = content[i];
    if (!openers.has(char)) continue;

    const closer = char === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let j = i; j < content.length && j - i < 200_000; j += 1) {
      const current = content[j];

      if (inString) {
        if (escaped) escaped = false;
        else if (current === "\\") escaped = true;
        else if (current === '"') inString = false;
        continue;
      }

      if (current === '"') inString = true;
      else if (current === char) depth += 1;
      else if (current === closer) {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end < 0) continue;
    const candidate = content.slice(i, end + 1);
    if (candidate.length < 20) continue;

    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        blocks.push({
          label: `${Object.keys(parsed as object).length} keys · ${candidate.length} chars`,
          json: JSON.stringify(parsed, null, 2),
        });
        i = end;
      }
    } catch {
      /* not JSON - keep scanning */
    }
  }

  return blocks;
}

export function detectFormat(content: string): "xml" | "json" | "text" {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("<")) return "xml";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  return "text";
}

export async function readPreview(file: LogFile): Promise<FilePreview> {
  const handle = await fsp.open(file.absolutePath, "r");
  let content: string;
  try {
    const buffer = Buffer.alloc(Math.min(file.sizeBytes, MAX_PREVIEW_BYTES));
    await handle.read(buffer, 0, buffer.length, 0);
    content = buffer.toString("utf8");
  } finally {
    await handle.close();
  }

  const truncated = file.sizeBytes > MAX_PREVIEW_BYTES;
  const format = detectFormat(content);

  let pretty = content;
  let valid = true;

  if (format === "xml") {
    valid = XMLValidator.validate(content) === true;
    pretty = formatXml(content);
    if (valid) {
      try {
        xmlParser.parse(content);
      } catch {
        valid = false;
      }
    }
  } else if (format === "json") {
    try {
      pretty = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      valid = false;
    }
  }

  const scannable = format === "xml" ? decodeEntities(content) : content;

  return {
    format,
    valid,
    content,
    pretty,
    urls: extractUrls(scannable),
    jsonBlocks: format === "json" ? [] : extractJsonBlocks(scannable),
    entries: parseLogContent(content, file.relativePath),
    truncated,
  };
}
