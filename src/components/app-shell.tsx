"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  FolderTree,
  Gauge,
  LogOut,
  Radio,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { User } from "@/lib/auth";
import { cn } from "cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/logs", label: "Log explorer", icon: ScrollText },
  { href: "/files", label: "Files & folders", icon: FolderTree },
  { href: "/live", label: "Live tail", icon: Radio },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/users", label: "Users & audit", icon: Users, adminOnly: true },
];

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">LogTrail</p>
            <p className="text-xs text-muted-foreground">Log analytics</p>
          </div>
        </div>
        <Separator />

        <nav className="flex-1 space-y-1 p-2">
          {NAV.filter((item) => !item.adminOnly || user.role === "admin").map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Separator />
        <div className="flex items-center gap-2 p-3">
          <Avatar className="size-8">
            <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Activity className="size-5 text-primary" />
          <span className="font-semibold">LogTrail</span>
          <nav className="ml-auto flex gap-1 overflow-x-auto">
            {NAV.filter((item) => !item.adminOnly || user.role === "admin").map((item) => (
              <Button key={item.href} variant="ghost" size="icon" asChild aria-label={item.label}>
                <Link href={item.href}>
                  <item.icon className="size-4" />
                </Link>
              </Button>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
