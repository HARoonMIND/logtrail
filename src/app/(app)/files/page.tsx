import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  FileCode2,
  FileJson,
  FileText,
  FolderTree,
} from "lucide-react";
import { formatDateTime, PageHeader, SourceBanner } from "@/components/log-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes, listFiles, resolveSource, type LogFile } from "@/lib/logs";
import { buildSections, type Section } from "@/lib/sections";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Files & folders — LogTrail" };

function FileIcon({ name }: { name: string }) {
  if (name.toLowerCase().endsWith(".xml")) return <FileCode2 className="size-4 text-sky-500" />;
  if (name.toLowerCase().endsWith(".json")) return <FileJson className="size-4 text-emerald-500" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

function FileRow({ file }: { file: LogFile }) {
  const href = `/files/view?path=${encodeURIComponent(file.relativePath)}`;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
      <FileIcon name={file.name} />
      <Link href={href} className="font-mono text-xs hover:underline">
        {file.name}
      </Link>
      <Badge variant="outline" className="text-[10px] uppercase">
        {file.extension.replace(".", "") || "file"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {formatDateTime(file.nameTimestamp ?? file.modifiedAt)}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatBytes(file.sizeBytes)}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="ghost" asChild className="h-6 px-2 text-xs">
          <Link href={href}>preview</Link>
        </Button>
        <Button size="sm" variant="ghost" asChild className="h-6 px-2 text-xs">
          <Link href={`/logs?file=${encodeURIComponent(file.relativePath)}`}>entries</Link>
        </Button>
      </span>
    </li>
  );
}

function SectionCard({ section }: { section: Section }) {
  const singleCategory = section.categories.length === 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderTree className="size-4 text-amber-500" />
          {section.name}
          <Badge variant="secondary">{section.fileCount} files</Badge>
        </CardTitle>
        <CardDescription>
          {formatBytes(section.sizeBytes)} · newest {formatDateTime(section.lastModifiedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.categories.map((category) => (
          <div key={category.path} className="rounded-md border">
            {!singleCategory || category.name !== section.name ? (
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                {category.name}
                <Badge variant="outline">{category.fileCount}</Badge>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {formatBytes(category.sizeBytes)}
                </span>
              </div>
            ) : null}

            <div className="space-y-1 p-2">
              {category.days.map((day) => (
                <details key={`${category.path}-${day.label}`} open={category.days[0] === day}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <ChevronRight className="size-3.5 text-muted-foreground transition-transform [details[open]>summary_&]:rotate-90" />
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <span className="font-medium tabular-nums">{day.label}</span>
                    <Badge variant="secondary">{day.files.length}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(day.sizeBytes)}
                    </span>
                  </summary>
                  <ul className="ml-4 border-l pl-2">
                    {day.files.map((file) => (
                      <FileRow key={file.relativePath} file={file} />
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function FilesPage() {
  const settings = getSettings();
  const source = resolveSource(settings);
  const files = await listFiles(source, settings);
  const sections = buildSections(files);

  return (
    <>
      <PageHeader
        title="Files & folders"
        description={`${files.length} files in ${source.root || "no readable source"} — one section per top-level folder, grouped by day`}
      />
      <SourceBanner source={source} />

      {sections.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {sections.map((section) => (
            <SectionCard key={section.path} section={section} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No log files found under the configured path.
          </CardContent>
        </Card>
      )}
    </>
  );
}
