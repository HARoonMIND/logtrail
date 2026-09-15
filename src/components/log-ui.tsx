import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { LogSource } from "@/lib/logs";
import { cn } from "cn";

const LEVEL_STYLES: Record<string, string> = {
  FATAL: "bg-red-600 text-white",
  ERROR: "bg-red-500/15 text-red-600 dark:text-red-400",
  WARN: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  INFO: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  DEBUG: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  TRACE: "bg-muted text-muted-foreground",
  UNKNOWN: "bg-muted text-muted-foreground",
};

export function LevelBadge({ level, className }: { level: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", LEVEL_STYLES[level], className)}>
      {level}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function SourceBanner({ source }: { source: LogSource }) {
  if (source.exists) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle />
      <AlertTitle>Configured log path is not reachable</AlertTitle>
      <AlertDescription>
        <span>
          <code className="font-mono">{source.configuredRoot || "(not set)"}</code> could not be
          read from this host.{" "}
          {source.usingFallback
            ? `Showing the bundled sample tree at ${source.root} instead.`
            : "No fallback data is available."}{" "}
          Update it in <Link className="underline" href="/settings">Settings</Link>.
        </span>
      </AlertDescription>
    </Alert>
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").slice(0, 19);
}
