import { Suspense } from "react";
import { LogExplorer } from "@/app/(app)/logs/log-explorer";
import { PageHeader } from "@/components/log-ui";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Log explorer — LogTrail" };

export default function LogsPage() {
  return (
    <>
      <PageHeader
        title="Log explorer"
        description="Full-text search across every parsed log entry with level, time and source filters."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LogExplorer />
      </Suspense>
    </>
  );
}
