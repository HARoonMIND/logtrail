import { currentUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/guard";
import { listFiles, resolveSource } from "@/lib/logs";
import { buildSections } from "@/lib/sections";
import { getSettings } from "@/lib/settings";

export async function GET() {
  if (!(await currentUser())) return unauthorizedResponse();

  const settings = getSettings();
  const files = await listFiles(resolveSource(settings), settings);

  const sections = buildSections(files).map((section) => ({
    name: section.name,
    path: section.path,
    fileCount: section.fileCount,
    categories: section.categories.map((category) => ({
      name: category.name,
      path: category.path,
      fileCount: category.fileCount,
      days: category.days.map((day) => ({ date: day.date, files: day.files.length })),
    })),
  }));

  return Response.json({ sections });
}
