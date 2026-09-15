import { HardDrive } from "lucide-react";
import { PasswordForm, SettingsForm } from "@/app/(app)/settings/settings-forms";
import { PageHeader } from "@/components/log-ui";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentUser } from "@/lib/auth";
import { DB_FILE } from "@/lib/db";
import { resolveSource } from "@/lib/logs";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — LogTrail" };

export default async function SettingsPage() {
  const user = await currentUser();
  const settings = getSettings();
  const source = resolveSource(settings);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Log source, scanning limits and account security."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Log source</CardTitle>
            <CardDescription>
              Stored in SQLite and applied to every scan, chart and search.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm settings={settings} readOnly={user?.role !== "admin"} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="size-4" />
                Source status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Configured path</span>
                <code className="font-mono text-xs">{settings.logRoot}</code>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Reachable</span>
                {source.exists ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600">yes</Badge>
                ) : (
                  <Badge variant="destructive">no</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Active root</span>
                <code className="max-w-[55%] truncate font-mono text-xs">{source.root || "—"}</code>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">SQLite database</span>
                <code className="max-w-[55%] truncate font-mono text-xs">{DB_FILE}</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change your password</CardTitle>
              <CardDescription>Hashed with bcrypt and stored in SQLite.</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
