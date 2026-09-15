import { Suspense } from "react";
import { Activity } from "lucide-react";
import { LoginForm } from "@/app/login/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Sign in — LogTrail" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">LogTrail</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to the log analytics console
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
