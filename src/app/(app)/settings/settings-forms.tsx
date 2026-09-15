"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  saveSettings,
  updateOwnPassword,
  type ActionState,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/settings";

function useToastState(state: ActionState) {
  useEffect(() => {
    if (state.ok) toast.success(state.ok);
    if (state.error) toast.error(state.error);
  }, [state]);
}

export function SettingsForm({
  settings,
  readOnly,
}: {
  settings: Settings;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettings, {} as ActionState);
  useToastState(state);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="logRoot">Log folder path</Label>
        <Input
          id="logRoot"
          name="logRoot"
          defaultValue={settings.logRoot}
          placeholder="C:\MyHolidays\XMLLogs"
          className="font-mono"
          disabled={readOnly}
        />
        <p className="text-xs text-muted-foreground">
          UNC paths (\\server\share\XMLLogs) and POSIX paths are supported.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="filePatterns">File extensions</Label>
          <Input
            id="filePatterns"
            name="filePatterns"
            defaultValue={settings.filePatterns}
            className="font-mono"
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Display timezone</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={settings.timezone}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxDepth">Max folder depth</Label>
          <Input
            id="maxDepth"
            name="maxDepth"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.maxDepth}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxFilesPerScan">Max files per scan</Label>
          <Input
            id="maxFilesPerScan"
            name="maxFilesPerScan"
            type="number"
            min={10}
            max={20000}
            defaultValue={settings.maxFilesPerScan}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="retentionDays">Retention (days)</Label>
          <Input
            id="retentionDays"
            name="retentionDays"
            type="number"
            min={1}
            max={3650}
            defaultValue={settings.retentionDays}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refreshSeconds">Live tail interval (seconds)</Label>
          <Input
            id="refreshSeconds"
            name="refreshSeconds"
            type="number"
            min={5}
            max={600}
            defaultValue={settings.refreshSeconds}
            disabled={readOnly}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending || readOnly}>
        Save settings
      </Button>
      {readOnly ? (
        <p className="text-xs text-muted-foreground">Only admins can change these settings.</p>
      ) : null}
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updateOwnPassword, {} as ActionState);
  useToastState(state);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Update password
      </Button>
    </form>
  );
}
