import { XMLParser } from "fast-xml-parser";

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "UNKNOWN";

export const LOG_LEVELS: LogLevel[] = [
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
  "UNKNOWN",
];

export type LogEntry = {
  id: string;
  timestamp: string | null;
  level: LogLevel;
  logger: string | null;
  thread: string | null;
  machine: string | null;
  user: string | null;
  message: string;
  exception: string | null;
  file: string;
  lineNumber: number | null;
};

const TIMESTAMP_KEYS = [
  "timestamp",
  "time",
  "date",
  "datetime",
  "logdate",
  "eventtime",
  "occurredat",
  "createdat",
  "when",
];
const LEVEL_KEYS = ["level", "severity", "loglevel", "priority", "type", "category"];
const MESSAGE_KEYS = ["message", "msg", "text", "description", "detail", "body"];
const LOGGER_KEYS = ["logger", "source", "component", "class", "module", "application", "app"];
const THREAD_KEYS = ["thread", "threadid", "threadname"];
const MACHINE_KEYS = ["machine", "machinename", "host", "hostname", "server"];
const USER_KEYS = ["user", "username", "identity", "account"];
const EXCEPTION_KEYS = ["exception", "stacktrace", "stack", "error", "throwable", "innerexception"];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
  textNodeName: "#text",
});

export function normalizeLevel(raw: unknown): LogLevel {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return "UNKNOWN";
  if (["FATAL", "CRITICAL", "CRIT", "EMERGENCY", "ALERT"].includes(value)) return "FATAL";
  if (["ERROR", "ERR", "SEVERE", "EXCEPTION", "FAIL", "FAILURE"].includes(value)) return "ERROR";
  if (["WARN", "WARNING"].includes(value)) return "WARN";
  if (["INFO", "INFORMATION", "INFORMATIONAL", "NOTICE"].includes(value)) return "INFO";
  if (["DEBUG", "FINE", "DIAGNOSTIC"].includes(value)) return "DEBUG";
  if (["TRACE", "VERBOSE", "FINEST", "ALL"].includes(value)) return "TRACE";
  return "UNKNOWN";
}

export function parseTimestamp(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000).toISOString();
  if (/^\d{13}$/.test(value)) return new Date(Number(value)).toISOString();

  const candidates = [
    value,
    value.replace(",", "."),
    value.replace(" ", "T"),
    value.replace(" ", "T").replace(",", "."),
    value.replace(/^(\d{4})(\d{2})(\d{2})[_T-]?(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3T$4:$5:$6"),
    value.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"),
  ];

  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() > 1980) return date.toISOString();
  }
  return null;
}

/** Extracts a datetime encoded in a log file name, e.g. App_20240115_103000.xml. */
export function timestampFromFileName(name: string): string | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})[-_ T]?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})/, (m) =>
      `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`],
    [/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})[-_ T]?(\d{2})[-_.:]?(\d{2})/, (m) =>
      `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`],
    [/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/, (m) => `${m[1]}-${m[2]}-${m[3]}T00:00:00`],
  ];

  for (const [regex, build] of patterns) {
    const match = name.match(regex);
    if (match) {
      const iso = parseTimestamp(build(match));
      if (iso) return iso;
    }
  }
  return null;
}

type XmlNode = Record<string, unknown>;

function pick(node: XmlNode, keys: string[]): string | null {
  for (const [rawKey, rawValue] of Object.entries(node)) {
    const key = rawKey.toLowerCase().replace(/[^a-z]/g, "");
    if (!keys.includes(key)) continue;
    const value = flatten(rawValue);
    if (value) return value;
  }
  return null;
}

function flatten(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(flatten).filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }
  if (typeof value === "object") {
    const node = value as XmlNode;
    if (typeof node["#text"] === "string") return String(node["#text"]).trim() || null;
    const parts = Object.entries(node)
      .filter(([key]) => key !== "#text")
      .map(([key, child]) => {
        const text = flatten(child);
        return text ? `${key}: ${text}` : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }
  return null;
}

function looksLikeEntry(node: XmlNode): boolean {
  const keys = Object.keys(node).map((k) => k.toLowerCase().replace(/[^a-z]/g, ""));
  const hasTime = keys.some((k) => TIMESTAMP_KEYS.includes(k));
  const hasBody = keys.some(
    (k) => MESSAGE_KEYS.includes(k) || LEVEL_KEYS.includes(k) || EXCEPTION_KEYS.includes(k),
  );
  return hasTime && hasBody;
}

function toEntry(node: XmlNode, file: string, index: number): LogEntry {
  const message =
    pick(node, MESSAGE_KEYS) ??
    flatten(node["#text"]) ??
    "(no message)";

  return {
    id: `${file}#${index}`,
    timestamp: parseTimestamp(pick(node, TIMESTAMP_KEYS)),
    level: normalizeLevel(pick(node, LEVEL_KEYS)),
    logger: pick(node, LOGGER_KEYS),
    thread: pick(node, THREAD_KEYS),
    machine: pick(node, MACHINE_KEYS),
    user: pick(node, USER_KEYS),
    message,
    exception: pick(node, EXCEPTION_KEYS),
    file,
    lineNumber: null,
  };
}

function collect(value: unknown, file: string, out: LogEntry[], depth = 0) {
  if (depth > 12 || value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collect(item, file, out, depth + 1);
    return;
  }

  const node = value as XmlNode;
  if (looksLikeEntry(node)) {
    out.push(toEntry(node, file, out.length));
    return;
  }

  for (const child of Object.values(node)) collect(child, file, out, depth + 1);
}

const TEXT_LINE =
  /^\s*\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*[|\-\]]?\s*\[?(TRACE|DEBUG|INFO(?:RMATION)?|WARN(?:ING)?|ERROR|FATAL|CRITICAL|VERBOSE)\]?\s*[|\-\]:]?\s*(.*)$/i;

function parseText(content: string, file: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const match = line.match(TEXT_LINE);

    if (match) {
      const rest = match[3] ?? "";
      const [loggerPart, ...messageParts] = rest.split(/\s+[-|]\s+/);
      const hasLogger = messageParts.length > 0 && /^[\w.$]+$/.test(loggerPart.trim());

      entries.push({
        id: `${file}#${index}`,
        timestamp: parseTimestamp(match[1]),
        level: normalizeLevel(match[2]),
        logger: hasLogger ? loggerPart.trim() : null,
        thread: null,
        machine: null,
        user: null,
        message: hasLogger ? messageParts.join(" - ") : rest,
        exception: null,
        file,
        lineNumber: index + 1,
      });
      return;
    }

    const previous = entries[entries.length - 1];
    if (previous && /^\s+|^\s*(at |Caused by|\.\.\.)/.test(line)) {
      previous.exception = `${previous.exception ?? ""}${line}\n`;
    }
  });

  return entries;
}

export function parseLogContent(content: string, file: string): LogEntry[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("<")) {
    const entries: LogEntry[] = [];
    const body = trimmed.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/g, "");
    try {
      collect(parser.parse(`<logtrailRoot>${body}</logtrailRoot>`), file, entries);
    } catch {
      return parseText(content, file);
    }
    if (entries.length) return entries;
  }

  return parseText(content, file);
}
