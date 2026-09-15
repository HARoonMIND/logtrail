import Link from "next/link";
import { AlertOctagon, Database, FileStack, Percent, TriangleAlert } from "lucide-react";
import { LevelsChart, LoggersChart, VolumeChart } from "@/components/dashboard-charts";
import { formatDateTime, LevelBadge, PageHeader, SourceBanner } from "@/components/log-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardStats, formatBytes } from "@/lib/logs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — LogTrail" };

const RANGES = [
  { hours: 24, label: "24h" },
  { hours: 24 * 7, label: "7d" },
  { hours: 24 * 30, label: "30d" },
];

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const rangeHours = Number(Array.isArray(params.range) ? params.range[0] : params.range) || 24;
  const stats = await dashboardStats(rangeHours);
  const rangeLabel = RANGES.find((r) => r.hours === rangeHours)?.label ?? `${rangeHours}h`;

  const kpis = [
    {
      label: "Total entries",
      value: stats.totals.entries.toLocaleString(),
      hint: `${stats.totals.files} files · ${formatBytes(stats.totals.sizeBytes)}`,
      icon: Database,
    },
    {
      label: "Errors & fatals",
      value: stats.totals.errors.toLocaleString(),
      hint: `${stats.last24h.errors.toLocaleString()} in last ${rangeLabel}`,
      icon: AlertOctagon,
    },
    {
      label: "Warnings",
      value: stats.totals.warnings.toLocaleString(),
      hint: `${stats.last24h.entries.toLocaleString()} entries in last ${rangeLabel}`,
      icon: TriangleAlert,
    },
    {
      label: "Error rate",
      value: `${stats.errorRate.toFixed(2)}%`,
      hint: `Last entry ${formatDateTime(stats.lastEntryAt)}`,
      icon: Percent,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Analytics over ${stats.totals.files} log files in ${stats.source.root || "no source"}`}
      >
        {RANGES.map((range) => (
          <Button
            key={range.hours}
            size="sm"
            variant={range.hours === rangeHours ? "default" : "outline"}
            asChild
          >
            <Link href={`/dashboard?range=${range.hours}`}>{range.label}</Link>
          </Button>
        ))}
      </PageHeader>

      <SourceBanner source={stats.source} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <kpi.icon className="size-4" />
                {kpi.label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Log volume</CardTitle>
            <CardDescription>Entries per {rangeHours > 48 ? "day" : "hour"} over the last {rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeChart data={stats.timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severity mix</CardTitle>
            <CardDescription>All entries by level</CardDescription>
          </CardHeader>
          <CardContent>
            <LevelsChart data={stats.levels} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top sources</CardTitle>
            <CardDescription>Busiest loggers / components</CardDescription>
          </CardHeader>
          <CardContent>
            <LoggersChart data={stats.topLoggers} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top errors</CardTitle>
            <CardDescription>Grouped by normalised message</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-20 text-right">Count</TableHead>
                  <TableHead className="w-44">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topErrors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No errors recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.topErrors.map((error) => (
                    <TableRow key={error.message}>
                      <TableCell className="max-w-[420px] truncate font-mono text-xs">
                        <Link
                          className="hover:underline"
                          href={`/logs?search=${encodeURIComponent(error.message.slice(0, 60))}`}
                        >
                          {error.message}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{error.count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(error.lastSeen)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most recent files</CardTitle>
            <CardDescription>Newest log files by modified time</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="w-24 text-right">Entries</TableHead>
                  <TableHead className="w-20 text-right">Errors</TableHead>
                  <TableHead className="w-44">Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topFiles.map((file) => (
                  <TableRow key={file.file}>
                    <TableCell className="max-w-[320px] truncate font-mono text-xs">
                      <Link
                        className="hover:underline"
                        href={`/logs?file=${encodeURIComponent(file.file)}`}
                      >
                        {file.file}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{file.entries}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {file.errors ? (
                        <Badge variant="destructive">{file.errors}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(file.modifiedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Latest errors</CardTitle>
              <CardDescription>Newest ERROR / FATAL entries</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/logs?levels=ERROR,FATAL">Open in explorer</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors recorded.</p>
            ) : (
              stats.recentErrors.map((entry) => (
                <div key={entry.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LevelBadge level={entry.level} />
                    <span>{formatDateTime(entry.timestamp)}</span>
                    <span className="truncate">{entry.logger}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs">{entry.message}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{entry.file}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <FileStack className="size-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Oldest entry {formatDateTime(stats.firstEntryAt)} · newest {formatDateTime(stats.lastEntryAt)} ·
          source <code className="font-mono">{stats.source.root || "—"}</code>
        </p>
      </div>
    </>
  );
}
