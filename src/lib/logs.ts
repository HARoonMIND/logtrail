import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  LOG_LEVELS,
  type LogEntry,
  type LogLevel,
  parseLogContent,
  timestampFromFileName,
} from "@/lib/log-parser";
import { fileExtensions, getSettings, type Settings } from "@/lib/settings";

export type LogFile = {
  name: string;
  absolutePath: string;
  relativePath: string;
  directory: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  createdAt: string;
  nameTimestamp: string | null;
};

export type LogSource = {
  root: string;
  configuredRoot: string;
  exists: boolean;
  usingFallback: boolean;
};

export type LogQuery = {
  search?: string;
  levels?: LogLevel[];
  from?: string;
  to?: string;
  logger?: string;
  file?: string;
  directory?: string;
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
};

export type LogQueryResult = {
  entries: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  scannedFiles: number;
  source: LogSource;
  truncated: boolean;
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;

type CacheItem = { mtimeMs: number; size: number; entries: LogEntry[] };
const entryCache = new Map<string, CacheItem>();

/**
 * Resolves the configured log root. The product default is a Windows path
 * (C:\MyHolidays\XMLLogs); when it is unavailable (e.g. running on Linux or the
 * share is offline) the bundled sample tree is used so the UI stays usable.
 */
export function resolveSource(settings: Settings = getSettings()): LogSource {
  const configuredRoot = settings.logRoot;
  const exists = Boolean(configuredRoot) && isReadableDir(configuredRoot);
  if (exists) {
    return { root: configuredRoot, configuredRoot, exists: true, usingFallback: false };
  }

  const fallback = process.env.LOGTRAIL_FALLBACK_ROOT ?? path.join(process.cwd(), "sample-logs");
  return {
    root: isReadableDir(fallback) ? fallback : "",
    configuredRoot,
    exists: false,
    usingFallback: isReadableDir(fallback),
  };
}

export function isReadableDir(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export async function listFiles(source: LogSource, settings: Settings): Promise<LogFile[]> {
  if (!source.root) return [];

  const extensions = fileExtensions(settings);
  const files: LogFile[] = [];

  async function walk(dir: string, depth: number) {
    if (depth > settings.maxDepth || files.length >= settings.maxFilesPerScan) return;

    let dirents;
    try {
      dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const dirent of dirents) {
      if (files.length >= settings.maxFilesPerScan) return;
      const absolutePath = path.join(dir, dirent.name);

      if (dirent.isDirectory()) {
        await walk(absolutePath, depth + 1);
        continue;
      }
      if (!extensions.includes(path.extname(dirent.name).toLowerCase())) continue;

      try {
        const stat = await fsp.stat(absolutePath);
        const relativePath = path.relative(source.root, absolutePath);
        files.push({
          name: dirent.name,
          absolutePath,
          relativePath,
          directory: path.dirname(relativePath) === "." ? "" : path.dirname(relativePath),
          extension: path.extname(dirent.name).toLowerCase(),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          createdAt: stat.birthtime.toISOString(),
          nameTimestamp: timestampFromFileName(dirent.name),
        });
      } catch {
        /* unreadable file - skip */
      }
    }
  }

  await walk(source.root, 0);
  files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return files;
}

export async function readEntries(file: LogFile): Promise<LogEntry[]> {
  if (file.sizeBytes > MAX_FILE_BYTES) return [];

  const cached = entryCache.get(file.absolutePath);
  const mtimeMs = Date.parse(file.modifiedAt);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === file.sizeBytes) {
    return cached.entries;
  }

  let content: string;
  try {
    content = await fsp.readFile(file.absolutePath, "utf8");
  } catch {
    return [];
  }

  const entries = parseLogContent(content, file.relativePath).map((entry) => ({
    ...entry,
    timestamp: entry.timestamp ?? file.nameTimestamp ?? file.modifiedAt,
  }));

  entryCache.set(file.absolutePath, { mtimeMs, size: file.sizeBytes, entries });
  return entries;
}

export async function loadEntries(
  query: LogQuery = {},
): Promise<{ entries: LogEntry[]; files: LogFile[]; source: LogSource }> {
  const settings = getSettings();
  const source = resolveSource(settings);
  const allFiles = await listFiles(source, settings);

  const files = allFiles.filter((file) => {
    if (query.file && file.relativePath !== query.file) return false;
    if (query.directory && !file.relativePath.startsWith(query.directory)) return false;
    return true;
  });

  const batches = await Promise.all(files.map(readEntries));
  return { entries: batches.flat(), files, source };
}

export function filterEntries(entries: LogEntry[], query: LogQuery): LogEntry[] {
  const search = query.search?.trim().toLowerCase();
  const levels = query.levels?.length ? new Set(query.levels) : null;
  const from = query.from ? Date.parse(query.from) : null;
  const to = query.to ? Date.parse(query.to) : null;
  const logger = query.logger?.trim().toLowerCase();

  return entries.filter((entry) => {
    if (levels && !levels.has(entry.level)) return false;
    if (logger && !(entry.logger ?? "").toLowerCase().includes(logger)) return false;

    if (from || to) {
      const at = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
      if (Number.isNaN(at)) return false;
      if (from && at < from) return false;
      if (to && at > to) return false;
    }

    if (search) {
      const haystack = [entry.message, entry.logger, entry.exception, entry.file, entry.machine]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export async function queryLogs(query: LogQuery): Promise<LogQueryResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(500, Math.max(10, query.pageSize ?? 50));
  const { entries, files, source } = await loadEntries(query);

  const filtered = filterEntries(entries, query);
  filtered.sort((a, b) => {
    const left = a.timestamp ?? "";
    const right = b.timestamp ?? "";
    return query.sort === "asc" ? left.localeCompare(right) : right.localeCompare(left);
  });

  const start = (page - 1) * pageSize;
  return {
    entries: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    scannedFiles: files.length,
    source,
    truncated: files.length >= getSettings().maxFilesPerScan,
  };
}

export type DashboardStats = {
  source: LogSource;
  totals: { entries: number; errors: number; warnings: number; files: number; sizeBytes: number };
  errorRate: number;
  last24h: { entries: number; errors: number };
  firstEntryAt: string | null;
  lastEntryAt: string | null;
  levels: { level: LogLevel; count: number }[];
  timeline: { bucket: string; total: number; error: number; warn: number; info: number }[];
  topLoggers: { logger: string; count: number }[];
  topErrors: { message: string; count: number; lastSeen: string | null }[];
  topFiles: { file: string; entries: number; errors: number; modifiedAt: string }[];
  recentErrors: LogEntry[];
};

function bucketKey(iso: string, hours: number): string {
  const date = new Date(iso);
  if (hours >= 24) return date.toISOString().slice(0, 10);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 13);
}

export async function dashboardStats(rangeHours = 24): Promise<DashboardStats> {
  const { entries, files, source } = await loadEntries();
  const now = Date.now();
  const rangeStart = now - rangeHours * 3600_000;

  const inRange = entries.filter((entry) => {
    const at = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
    return !Number.isNaN(at) && at >= rangeStart;
  });

  const levelCounts = new Map<LogLevel, number>(LOG_LEVELS.map((level) => [level, 0]));
  for (const entry of entries) {
    levelCounts.set(entry.level, (levelCounts.get(entry.level) ?? 0) + 1);
  }

  const timelineMap = new Map<string, { total: number; error: number; warn: number; info: number }>();
  for (const entry of inRange) {
    if (!entry.timestamp) continue;
    const key = bucketKey(entry.timestamp, rangeHours);
    const bucket = timelineMap.get(key) ?? { total: 0, error: 0, warn: 0, info: 0 };
    bucket.total += 1;
    if (entry.level === "ERROR" || entry.level === "FATAL") bucket.error += 1;
    else if (entry.level === "WARN") bucket.warn += 1;
    else bucket.info += 1;
    timelineMap.set(key, bucket);
  }

  const loggerCounts = new Map<string, number>();
  const errorGroups = new Map<string, { count: number; lastSeen: string | null }>();
  for (const entry of entries) {
    const logger = entry.logger ?? "(unknown)";
    loggerCounts.set(logger, (loggerCounts.get(logger) ?? 0) + 1);

    if (entry.level === "ERROR" || entry.level === "FATAL") {
      const key = entry.message.slice(0, 160);
      const group = errorGroups.get(key) ?? { count: 0, lastSeen: null };
      group.count += 1;
      if (!group.lastSeen || (entry.timestamp ?? "") > group.lastSeen) group.lastSeen = entry.timestamp;
      errorGroups.set(key, group);
    }
  }

  const perFile = new Map<string, { entries: number; errors: number }>();
  for (const entry of entries) {
    const stat = perFile.get(entry.file) ?? { entries: 0, errors: 0 };
    stat.entries += 1;
    if (entry.level === "ERROR" || entry.level === "FATAL") stat.errors += 1;
    perFile.set(entry.file, stat);
  }

  const timestamps = entries.map((e) => e.timestamp).filter(Boolean).sort() as string[];
  const errors = (levelCounts.get("ERROR") ?? 0) + (levelCounts.get("FATAL") ?? 0);

  return {
    source,
    totals: {
      entries: entries.length,
      errors,
      warnings: levelCounts.get("WARN") ?? 0,
      files: files.length,
      sizeBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    },
    errorRate: entries.length ? (errors / entries.length) * 100 : 0,
    last24h: {
      entries: inRange.length,
      errors: inRange.filter((e) => e.level === "ERROR" || e.level === "FATAL").length,
    },
    firstEntryAt: timestamps[0] ?? null,
    lastEntryAt: timestamps[timestamps.length - 1] ?? null,
    levels: LOG_LEVELS.map((level) => ({ level, count: levelCounts.get(level) ?? 0 })).filter(
      (item) => item.count > 0,
    ),
    timeline: [...timelineMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, value]) => ({ bucket, ...value })),
    topLoggers: [...loggerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([logger, count]) => ({ logger, count })),
    topErrors: [...errorGroups.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([message, value]) => ({ message, count: value.count, lastSeen: value.lastSeen })),
    topFiles: files
      .slice(0, 8)
      .map((file) => ({
        file: file.relativePath,
        entries: perFile.get(file.relativePath)?.entries ?? 0,
        errors: perFile.get(file.relativePath)?.errors ?? 0,
        modifiedAt: file.modifiedAt,
      })),
    recentErrors: entries
      .filter((entry) => entry.level === "ERROR" || entry.level === "FATAL")
      .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
      .slice(0, 10),
  };
}

export type TreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  sizeBytes: number;
  modifiedAt: string;
  fileCount: number;
  nameTimestamp?: string | null;
  children?: TreeNode[];
};

export async function buildTree(): Promise<{ source: LogSource; tree: TreeNode[]; files: LogFile[] }> {
  const settings = getSettings();
  const source = resolveSource(settings);
  const files = await listFiles(source, settings);

  const root: TreeNode[] = [];

  for (const file of files) {
    const segments = file.relativePath.split(/[\\/]/);
    let level = root;
    let walked = "";

    for (let i = 0; i < segments.length - 1; i += 1) {
      walked = walked ? `${walked}/${segments[i]}` : segments[i];
      let folder = level.find((node) => node.type === "folder" && node.name === segments[i]);
      if (!folder) {
        folder = {
          name: segments[i],
          path: walked,
          type: "folder",
          sizeBytes: 0,
          modifiedAt: file.modifiedAt,
          fileCount: 0,
          children: [],
        };
        level.push(folder);
      }
      folder.fileCount += 1;
      folder.sizeBytes += file.sizeBytes;
      if (file.modifiedAt > folder.modifiedAt) folder.modifiedAt = file.modifiedAt;
      level = folder.children!;
    }

    level.push({
      name: file.name,
      path: file.relativePath.split(/\\/).join("/"),
      type: "file",
      sizeBytes: file.sizeBytes,
      modifiedAt: file.modifiedAt,
      fileCount: 0,
      nameTimestamp: file.nameTimestamp,
    });
  }

  return { source, tree: root, files };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
