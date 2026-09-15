import Link from "next/link";
import { ChevronRight, FileCode2, FileText, Folder } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildTree, formatBytes, type TreeNode } from "@/lib/logs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Files & folders — LogTrail" };

function TreeBranch({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "ml-4 space-y-1 border-l pl-3"}>
      {nodes.map((node) =>
        node.type === "folder" ? (
          <li key={node.path}>
            <details open={depth < 1}>
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                <ChevronRight className="size-3.5 text-muted-foreground transition-transform [details[open]>summary_&]:rotate-90" />
                <Folder className="size-4 text-amber-500" />
                <span className="font-medium">{node.name}</span>
                <Badge variant="secondary" className="ml-1">
                  {node.fileCount} files
                </Badge>
                <span className="text-xs text-muted-foreground">{formatBytes(node.sizeBytes)}</span>
              </summary>
              <TreeBranch nodes={node.children ?? []} depth={depth + 1} />
            </details>
          </li>
        ) : (
          <li key={node.path} className="flex items-center gap-2 px-1 py-1 text-sm">
            {node.name.endsWith(".xml") ? (
              <FileCode2 className="size-4 text-sky-500" />
            ) : (
              <FileText className="size-4 text-muted-foreground" />
            )}
            <Link className="font-mono text-xs hover:underline" href={`/logs?file=${encodeURIComponent(node.path)}`}>
              {node.name}
            </Link>
            <span className="text-xs text-muted-foreground">{formatBytes(node.sizeBytes)}</span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(node.nameTimestamp ?? node.modifiedAt)}
            </span>
            <Button size="sm" variant="ghost" asChild className="ml-auto h-6 px-2 text-xs">
              <a href={`/api/files/raw?path=${encodeURIComponent(node.path)}`} target="_blank" rel="noreferrer">
                raw
              </a>
            </Button>
          </li>
        ),
      )}
    </ul>
  );
}

export default async function FilesPage() {
  const { source, tree, files } = await buildTree();

  return (
    <>
      <PageHeader
        title="Files & folders"
        description={`Folder structure of ${source.root || "no readable source"}`}
      />
      <SourceBanner source={source} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Folder structure</CardTitle>
            <CardDescription>
              Expected layout: <code className="font-mono">&lt;App&gt;\&lt;YYYY&gt;\&lt;MM&gt;\&lt;DD&gt;\&lt;App&gt;_&lt;YYYYMMDD_HHmmss&gt;.xml</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tree.length ? (
              <TreeBranch nodes={tree} />
            ) : (
              <p className="text-sm text-muted-foreground">No log files found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All files</CardTitle>
            <CardDescription>
              {files.length} files · datetime parsed from the file name where available
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-40">Log datetime</TableHead>
                  <TableHead className="w-40">Modified</TableHead>
                  <TableHead className="w-24 text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.relativePath}>
                    <TableCell className="max-w-[340px] truncate font-mono text-xs">
                      <Link
                        className="hover:underline"
                        href={`/logs?file=${encodeURIComponent(file.relativePath)}`}
                      >
                        {file.relativePath}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {file.nameTimestamp ? (
                        formatDateTime(file.nameTimestamp)
                      ) : (
                        <span className="text-muted-foreground">not in name</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(file.modifiedAt)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatBytes(file.sizeBytes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
