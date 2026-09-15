import { redirect } from "next/navigation";
import { AddUserForm } from "@/app/(app)/users/add-user-form";
import { formatDateTime, PageHeader } from "@/components/log-ui";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentUser, listUsers } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users & audit — LogTrail" };

type AuditRow = { id: number; at: string; actor: string | null; action: string; detail: string | null };

export default async function UsersPage() {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/dashboard");

  const users = listUsers();
  const auditRows = getDb()
    .prepare("SELECT id, at, actor, action, detail FROM audit_log ORDER BY id DESC LIMIT 50")
    .all() as AuditRow[];

  return (
    <>
      <PageHeader title="Users & audit" description="Accounts stored in SQLite with bcrypt hashes." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>{users.length} accounts</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24">Role</TableHead>
                  <TableHead className="w-44">Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.username}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <Badge variant={row.role === "admin" ? "default" : "secondary"}>
                        {row.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(row.last_login_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add user</CardTitle>
            <CardDescription>Passwords are hashed with bcrypt (cost 12).</CardDescription>
          </CardHeader>
          <CardContent>
            <AddUserForm />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
          <CardDescription>Logins, setting changes and exports</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead className="w-32">Actor</TableHead>
                <TableHead className="w-48">Action</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(`${row.at.replace(" ", "T")}Z`)}
                  </TableCell>
                  <TableCell className="text-sm">{row.actor ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="truncate font-mono text-xs text-muted-foreground">
                    {row.detail ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
