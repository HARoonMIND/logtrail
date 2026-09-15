"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Download, Loader2, RotateCw, Search } from "lucide-react";
import { formatDateTime, LevelBadge, SourceBanner } from "@/components/log-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOG_LEVELS, type LogEntry, type LogLevel } from "@/lib/log-parser";
import type { LogQueryResult } from "@/lib/logs";
import { cn } from "cn";

const PAGE_SIZES = [25, 50, 100, 250];
const ALL = "__all__";

type SectionOption = { label: string; path: string; fileCount: number };

export function LogExplorer() {
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [levels, setLevels] = useState<LogLevel[]>(
    (params.get("levels") ?? "")
      .split(",")
      .filter((level): level is LogLevel => LOG_LEVELS.includes(level as LogLevel)),
  );
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [file, setFile] = useState(params.get("file") ?? "");
  const [directory, setDirectory] = useState(params.get("directory") ?? "");
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [result, setResult] = useState<LogQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (levels.length) query.set("levels", levels.join(","));
    if (from) query.set("from", new Date(from).toISOString());
    if (to) query.set("to", new Date(to).toISOString());
    if (file) query.set("file", file);
    if (directory) query.set("directory", directory);
    query.set("sort", sort);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
    return query.toString();
  }, [search, levels, from, to, file, directory, sort, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/logs?${queryString}`);
    if (response.ok) setResult((await response.json()) as LogQueryResult);
    setLoading(false);
  }, [queryString]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    fetch("/api/sections")
      .then((response) => (response.ok ? response.json() : { sections: [] }))
      .then((data: { sections: { name: string; path: string; fileCount: number; categories: { name: string; path: string; fileCount: number }[] }[] }) => {
        if (!active) return;
        const options: SectionOption[] = [];
        for (const section of data.sections) {
          options.push({ label: section.name, path: section.path, fileCount: section.fileCount });
          for (const category of section.categories) {
            if (category.path === section.path) continue;
            options.push({
              label: `${section.name} / ${category.name}`,
              path: category.path,
              fileCount: category.fileCount,
            });
          }
        }
        setSections(options);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function toggleLevel(level: LogLevel) {
    setPage(1);
    setLevels((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <>
      {result ? <SourceBanner source={result.source} /> : null}

      <Card className="mb-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="search"
                  className="pl-8"
                  placeholder="message, logger, stack trace, machine…"
                  value={search}
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="datetime-local"
                value={from}
                onChange={(event) => {
                  setPage(1);
                  setFrom(event.target.value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="datetime-local"
                value={to}
                onChange={(event) => {
                  setPage(1);
                  setTo(event.target.value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={directory || ALL}
                onValueChange={(value) => {
                  setPage(1);
                  setDirectory(value === ALL ? "" : value);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.path} value={section.path}>
                      {section.label} ({section.fileCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sort</Label>
              <Select value={sort} onValueChange={(value) => setSort(value as "asc" | "desc")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest first</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Rows</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPage(1);
                  setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              Refresh
            </Button>

            <Button variant="outline" asChild>
              <a href={`/api/logs/export?${queryString}&format=csv`}>
                <Download className="size-4" />
                CSV
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Levels:</span>
            {LOG_LEVELS.map((level) => (
              <button key={level} type="button" onClick={() => toggleLevel(level)}>
                <LevelBadge
                  level={level}
                  className={cn(
                    "cursor-pointer",
                    levels.length && !levels.includes(level) && "opacity-40",
                  )}
                />
              </button>
            ))}
            {file ? (
              <Badge variant="secondary" className="ml-2 gap-1">
                file: {file}
                <button type="button" onClick={() => setFile("")} aria-label="Clear file filter">
                  ×
                </button>
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
            <span>
              {result
                ? `${result.total.toLocaleString()} matching entries across ${result.scannedFiles} files`
                : "Loading…"}
            </span>
            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Prev
              </Button>
              <span>
                Page {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </span>
          </div>

          <div className="divide-y">
            {result?.entries.length === 0 && !loading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No entries match the current filters.
              </p>
            ) : null}

            {result?.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                open={expanded === entry.id}
                onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                onFilterFile={() => {
                  setPage(1);
                  setFile(entry.file);
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function EntryRow({
  entry,
  open,
  onToggle,
  onFilterFile,
}: {
  entry: LogEntry;
  open: boolean;
  onToggle: () => void;
  onFilterFile: () => void;
}) {
  return (
    <div className="px-3 py-2 text-sm hover:bg-muted/50">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={onToggle}>
        {open ? (
          <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="w-44 shrink-0 font-mono text-xs text-muted-foreground">
          {formatDateTime(entry.timestamp)}
        </span>
        <LevelBadge level={entry.level} className="shrink-0" />
        <span className="w-56 shrink-0 truncate font-mono text-xs text-muted-foreground">
          {entry.logger ?? "—"}
        </span>
        <span className={cn("min-w-0 flex-1 font-mono text-xs", !open && "truncate")}>
          {entry.message}
        </span>
      </button>

      {open ? (
        <div className="mt-2 ml-7 space-y-2 rounded-md bg-muted/60 p-3 text-xs">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <Detail label="Machine" value={entry.machine} />
            <Detail label="Thread" value={entry.thread} />
            <Detail label="User" value={entry.user} />
            <Detail label="Line" value={entry.lineNumber ? String(entry.lineNumber) : null} />
          </dl>
          <div>
            <span className="text-muted-foreground">File: </span>
            <button type="button" className="font-mono underline" onClick={onFilterFile}>
              {entry.file}
            </button>
          </div>
          {entry.exception ? (
            <pre className="max-h-64 overflow-auto rounded bg-background p-2 font-mono text-[11px]">
              {entry.exception}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{value ?? "—"}</dd>
    </div>
  );
}
