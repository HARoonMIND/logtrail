"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatDateTime, LevelBadge } from "@/components/log-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LogEntry } from "@/lib/log-parser";
import type { LogQueryResult } from "@/lib/logs";

const INTERVALS = [5, 10, 15, 30, 60];

export function LiveTail({ refreshSeconds }: { refreshSeconds: number }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [interval, setIntervalSeconds] = useState(
    INTERVALS.includes(refreshSeconds) ? refreshSeconds : 15,
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (paused) return;
      const query = new URLSearchParams({ pageSize: "100", sort: "desc" });
      if (filter) query.set("search", filter);

      const response = await fetch(`/api/logs?${query.toString()}`);
      if (!response.ok || cancelled) return;
      const result = (await response.json()) as LogQueryResult;
      setEntries(result.entries);
      setLastUpdated(new Date().toISOString());
    }

    poll();
    const timer = setInterval(poll, interval * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [paused, interval, filter]);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={paused ? "default" : "outline"} onClick={() => setPaused(!paused)}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>

          <Input
            className="max-w-xs"
            placeholder="Filter stream…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />

          <Select
            value={String(interval)}
            onValueChange={(value) => setIntervalSeconds(Number(value))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  Every {seconds}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">
            {paused ? "Paused" : "Streaming"} · last update {formatDateTime(lastUpdated)}
          </span>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-md border bg-background font-mono text-xs">
          {entries.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Waiting for entries…</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex gap-3 border-b px-3 py-1.5 last:border-b-0">
                <span className="w-40 shrink-0 text-muted-foreground">
                  {formatDateTime(entry.timestamp)}
                </span>
                <LevelBadge level={entry.level} className="shrink-0" />
                <span className="w-52 shrink-0 truncate text-muted-foreground">
                  {entry.logger ?? "—"}
                </span>
                <span className="min-w-0 flex-1 break-words">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
