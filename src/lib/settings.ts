import { audit, getDb } from "@/lib/db";

export type Settings = {
  logRoot: string;
  filePatterns: string;
  maxDepth: number;
  retentionDays: number;
  refreshSeconds: number;
  maxFilesPerScan: number;
  timezone: string;
};

export function getSettings(): Settings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    logRoot: map.logRoot ?? "",
    filePatterns: map.filePatterns ?? ".xml,.log,.txt",
    maxDepth: Number(map.maxDepth ?? 6),
    retentionDays: Number(map.retentionDays ?? 90),
    refreshSeconds: Number(map.refreshSeconds ?? 15),
    maxFilesPerScan: Number(map.maxFilesPerScan ?? 500),
    timezone: map.timezone ?? "local",
  };
}

export function updateSettings(patch: Partial<Record<keyof Settings, string>>, actor: string) {
  const stmt = getDb().prepare(
    `INSERT INTO settings (key, value, updated_at, updated_by)
     VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_at = excluded.updated_at,
                                    updated_by = excluded.updated_by`,
  );

  const tx = getDb().transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      stmt.run(key, value, actor);
    }
  });
  tx();

  audit(actor, "settings.update", JSON.stringify(patch));
}

export function fileExtensions(settings: Settings): string[] {
  return settings.filePatterns
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .map((p) => (p.startsWith(".") ? p : `.${p}`));
}
