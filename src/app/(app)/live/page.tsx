import { LiveTail } from "@/app/(app)/live/live-tail";
import { PageHeader } from "@/components/log-ui";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live tail — LogTrail" };

export default function LivePage() {
  const { refreshSeconds } = getSettings();

  return (
    <>
      <PageHeader
        title="Live tail"
        description="Streams the newest entries from the log root, refreshed on an interval."
      />
      <LiveTail refreshSeconds={refreshSeconds} />
    </>
  );
}
