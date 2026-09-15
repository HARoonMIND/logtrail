import fsp from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/guard";
import { resolveSource } from "@/lib/logs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(request: NextRequest) {
  if (!(await currentUser())) return unauthorizedResponse();

  const relative = request.nextUrl.searchParams.get("path");
  if (!relative) return Response.json({ error: "path is required" }, { status: 400 });

  const source = resolveSource();
  if (!source.root) return Response.json({ error: "No readable log source" }, { status: 404 });

  const absolute = path.resolve(source.root, relative);
  if (!absolute.startsWith(path.resolve(source.root))) {
    return Response.json({ error: "Path outside of the log root" }, { status: 403 });
  }

  try {
    const stat = await fsp.stat(absolute);
    if (stat.size > MAX_BYTES) {
      return Response.json({ error: "File too large to preview" }, { status: 413 });
    }
    const content = await fsp.readFile(absolute, "utf8");
    return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
