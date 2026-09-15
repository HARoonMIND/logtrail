import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/guard";
import { LOG_LEVELS, type LogLevel } from "@/lib/log-parser";
import { queryLogs, type LogQuery } from "@/lib/logs";

export function queryFromParams(params: URLSearchParams): LogQuery {
  const levels = (params.get("levels") ?? "")
    .split(",")
    .map((level) => level.trim().toUpperCase())
    .filter((level): level is LogLevel => LOG_LEVELS.includes(level as LogLevel));

  return {
    search: params.get("search") ?? undefined,
    levels,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    logger: params.get("logger") ?? undefined,
    file: params.get("file") ?? undefined,
    directory: params.get("directory") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 50),
    sort: params.get("sort") === "asc" ? "asc" : "desc",
  };
}

export async function GET(request: NextRequest) {
  if (!(await currentUser())) return unauthorizedResponse();

  const result = await queryLogs(queryFromParams(request.nextUrl.searchParams));
  return Response.json(result);
}
