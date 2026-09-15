import { currentUser, type User } from "@/lib/auth";

export { changePassword, createUser, listUsers } from "@/lib/auth";

export async function requireUserOrThrow(role?: "admin"): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");
  if (role && user.role !== role) throw new Error("Admin role required");
  return user;
}
