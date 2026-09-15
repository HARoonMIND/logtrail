import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Link2 } from "lucide-react";
import { formatDateTime, LevelBadge, PageHeader } from "@/components/log-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readPreview } from "@/lib/file-preview";
import { findFile, formatBytes } from "@/lib/logs";
import { splitPath } from "@/lib/sections";

export const dynamic = "force-dynamic";
export const metadata = { title: "File preview — LogTrail" };

function Code({ value }: { value: string }) {
  return (
    <ScrollArea className="h-[560px] rounded-md border bg-muted/30">
      <pre className="p-4 text-xs leading-relaxed">
        <code className="font-mono">{value}</code>
      </pre>
    </ScrollArea>
  );
}

export default async function FileViewPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;
  if (!path) notFound();

  const file = await findFile(path);
  if (!file) notFound();

  const preview = await readPreview(file);
  const { section, category, date } = splitPath(file);

  return (
    <>
      <PageHeader title={file.name} description={file.relativePath}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/files">
            <ArrowLeft className="size-4" /> Back to files
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/api/files/raw?path=${encodeURIComponent(file.relativePath)}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4" /> Raw
          </a>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{section}</Badge>
        {category ? <Badge variant="secondary">{category}</Badge> : null}
        {date ? <Badge variant="outline">{date}</Badge> : null}
        <Badge variant="outline" className="uppercase">
          {preview.format}
        </Badge>
        {preview.format !== "text" ? (
          <Badge variant={preview.valid ? "secondary" : "destructive"}>
            {preview.valid ? "well-formed" : "malformed"}
          </Badge>
        ) : null}
        <span className="text-muted-foreground">
          {formatBytes(file.sizeBytes)} · log datetime{" "}
          {formatDateTime(file.nameTimestamp ?? file.modifiedAt)} · modified{" "}
          {formatDateTime(file.modifiedAt)} · {preview.entries.length} entries
        </span>
        {preview.truncated ? <Badge variant="destructive">preview truncated</Badge> : null}
      </div>

      <Tabs defaultValue="formatted">
        <TabsList>
          <TabsTrigger value="formatted">
            {preview.format === "xml" ? "Parsed XML" : preview.format === "json" ? "Parsed JSON" : "Content"}
          </TabsTrigger>
          <TabsTrigger value="entries">Entries ({preview.entries.length})</TabsTrigger>
          <TabsTrigger value="links">Links ({preview.urls.length})</TabsTrigger>
          <TabsTrigger value="json">JSON ({preview.jsonBlocks.length})</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="formatted" className="mt-4">
          <Code value={preview.pretty} />
        </TabsContent>

        <TabsContent value="entries" className="mt-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {preview.entries.length ? (
                preview.entries.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <LevelBadge level={entry.level} />
                      <span className="tabular-nums">{formatDateTime(entry.timestamp)}</span>
                      {entry.logger ? <span className="font-mono">{entry.logger}</span> : null}
                      {entry.machine ? <span>{entry.machine}</span> : null}
                    </div>
                    <p className="mt-2 text-sm">{entry.message}</p>
                    {entry.exception ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-[11px]">
                        {entry.exception}
                      </pre>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No log entries recognised in this file.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>URLs found in this file</CardTitle>
              <CardDescription>
                Request/callback endpoints extracted from the log content, with query parameters
                split out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.urls.length ? (
                preview.urls.map((hit) => (
                  <div key={hit.url} className="rounded-md border p-3">
                    <div className="flex items-start gap-2">
                      <Link2 className="mt-0.5 size-4 shrink-0 text-sky-500" />
                      <a
                        href={hit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
                      >
                        {hit.url}
                      </a>
                    </div>
                    {hit.query.length ? (
                      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        {hit.query.map((param) => (
                          <div key={`${hit.url}-${param.key}`} className="flex gap-2">
                            <dt className="font-medium text-muted-foreground">{param.key}</dt>
                            <dd className="break-all font-mono">{param.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No URLs in this file.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Embedded JSON payloads</CardTitle>
              <CardDescription>
                JSON request/response bodies found inside the log, pretty-printed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.jsonBlocks.length ? (
                preview.jsonBlocks.map((block, index) => (
                  <details key={index} open={index === 0} className="rounded-md border">
                    <summary className="cursor-pointer px-3 py-2 text-sm">
                      Payload {index + 1}{" "}
                      <span className="text-xs text-muted-foreground">({block.label})</span>
                    </summary>
                    <pre className="overflow-x-auto border-t bg-muted/30 p-3 text-xs">
                      {block.json}
                    </pre>
                  </details>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No JSON payloads detected in this file.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <Code value={preview.content} />
        </TabsContent>
      </Tabs>
    </>
  );
}
