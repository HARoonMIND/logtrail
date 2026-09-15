import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { cookieOptions, createSession, SESSION_COOKIE, verifyCredentials } from "@/lib/auth";
import { audit } from "@/lib/db";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Username and password are required." }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const user = verifyCredentials(username, password);

  if (!user) {
    audit(username, "auth.login_failed");
    return Response.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = createSession(
    user.id,
    request.headers.get("user-agent") ?? undefined,
    request.headers.get("x-forwarded-for") ?? undefined,
  );
  audit(user.username, "auth.login");

  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
  return Response.json({ user });
}
