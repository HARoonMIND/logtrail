import { currentUser, type User } from "@/lib/auth";

export class Unauthorized extends Error {}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Unauthorized("Not authenticated");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Unauthorized("Admin role required");
  return user;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Not authenticated" }, { status: 401 });
}
