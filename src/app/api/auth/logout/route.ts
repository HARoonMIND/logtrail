import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE, userForToken } from "@/lib/auth";
import { audit } from "@/lib/db";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const user = userForToken(token);
    if (user) audit(user.username, "auth.logout");
    destroySession(token);
    store.delete(SESSION_COOKIE);
  }

  return Response.json({ ok: true });
}
