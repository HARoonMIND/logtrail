import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { audit, getDb } from "@/lib/db";

export const SESSION_COOKIE = "logtrail_session";
const SESSION_DAYS = 7;

export type User = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "viewer";
  created_at: string;
  last_login_at: string | null;
};

type UserRow = User & { password_hash: string };

export function verifyCredentials(usernameOrEmail: string, password: string): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE username = ? OR email = ?")
    .get(usernameOrEmail, usernameOrEmail) as UserRow | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export function createSession(userId: number, userAgent?: string, ip?: string): string {
  const token = randomBytes(32).toString("hex");
  getDb()
    .prepare(
      `INSERT INTO sessions (token, user_id, expires_at, user_agent, ip)
       VALUES (?, ?, datetime('now', ?), ?, ?)`,
    )
    .run(token, userId, `+${SESSION_DAYS} days`, userAgent ?? null, ip ?? null);

  getDb()
    .prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
    .run(userId);

  return token;
}

export function destroySession(token: string) {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userForToken(token: string | undefined): User | null {
  if (!token) return null;

  const row = getDb()
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .get(token) as User | undefined;

  return row ?? null;
}

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  return userForToken(store.get(SESSION_COOKIE)?.value);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function createUser(
  username: string,
  email: string,
  password: string,
  role: "admin" | "viewer",
  actor: string,
): User {
  const info = getDb()
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(username, email, bcrypt.hashSync(password, 12), role);

  audit(actor, "user.create", `${username} (${role})`);

  return getDb()
    .prepare("SELECT id, username, email, role, created_at, last_login_at FROM users WHERE id = ?")
    .get(info.lastInsertRowid) as User;
}

export function changePassword(userId: number, newPassword: string, actor: string) {
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(bcrypt.hashSync(newPassword, 12), userId);
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  audit(actor, "user.password_change", `user_id=${userId}`);
}

export function listUsers(): User[] {
  return getDb()
    .prepare(
      "SELECT id, username, email, role, created_at, last_login_at FROM users ORDER BY id",
    )
    .all() as User[];
}
