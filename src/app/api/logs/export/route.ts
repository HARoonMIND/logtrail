import type { NextRequest } from "next/server";
import { queryFromParams } from "@/app/api/logs/route";
import { currentUser } from "@/lib/auth";
import { audit } from "@/lib/db";
import { unauthorizedResponse } from "@/lib/guard";
import { queryLogs } from "@/lib/logs";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "json" ? "json" : "csv";
  const result = await queryLogs({ ...queryFromParams(params), page: 1, pageSize: 500 });
  audit(user.username, "logs.export", `${format} · ${result.entries.length} rows`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  if (format === "json") {
    return new Response(JSON.stringify(result.entries, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="logtrail-${stamp}.json"`,
      },
    });
  }

  return new Response(toCsv(result.entries as unknown as Record<string, unknown>[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="logtrail-${stamp}.csv"`,
    },
  });
}
