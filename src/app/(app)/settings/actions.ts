"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changePassword, createUser, requireUserOrThrow } from "@/lib/server-actions";
import { isReadableDir, resolveSource } from "@/lib/logs";
import { updateSettings } from "@/lib/settings";

export type ActionState = { ok?: string; error?: string };

const settingsSchema = z.object({
  logRoot: z.string().min(1, "Log path is required"),
  filePatterns: z.string().min(1),
  maxDepth: z.coerce.number().int().min(1).max(20),
  retentionDays: z.coerce.number().int().min(1).max(3650),
  refreshSeconds: z.coerce.number().int().min(5).max(600),
  maxFilesPerScan: z.coerce.number().int().min(10).max(20000),
  timezone: z.string().min(1),
});

export async function saveSettings(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserOrThrow("admin");

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  const values = parsed.data;
  updateSettings(
    {
      logRoot: values.logRoot,
      filePatterns: values.filePatterns,
      maxDepth: String(values.maxDepth),
      retentionDays: String(values.retentionDays),
      refreshSeconds: String(values.refreshSeconds),
      maxFilesPerScan: String(values.maxFilesPerScan),
      timezone: values.timezone,
    },
    user.username,
  );

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  const reachable = isReadableDir(values.logRoot);
  return {
    ok: reachable
      ? "Settings saved. Log path is reachable."
      : `Settings saved. ${values.logRoot} is not reachable from this host — the bundled sample tree (${resolveSource().root}) is used until it is.`,
  };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Passwords do not match",
  });

export async function updateOwnPassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserOrThrow();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  changePassword(user.id, parsed.data.password, user.username);
  return { ok: "Password updated. Other sessions were signed out." };
}

const userSchema = z.object({
  username: z.string().min(3),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "viewer"]),
});

export async function addUser(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUserOrThrow("admin");
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  try {
    createUser(
      parsed.data.username,
      parsed.data.email,
      parsed.data.password,
      parsed.data.role,
      admin.username,
    );
  } catch {
    return { error: "Username or email already exists." };
  }

  revalidatePath("/users");
  return { ok: `User ${parsed.data.username} created.` };
}
