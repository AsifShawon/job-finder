import { LoginForm } from "@/app/auth/login/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Access your workspace</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Sign in to manage your search pipeline.</h1>
        <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
          Return to your dashboard, saved shortlist, alert rules, and admin tools from a single account.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="space-y-2 p-4">
            <p className="font-semibold">Dashboard</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Track saved items and alert coverage.</p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="font-semibold">Alerts</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Automate discovery through scheduled searches.</p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="font-semibold">Admin</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Operate source registry and crawl workflows.</p>
          </Card>
        </div>
      </section>
      <Card className="mx-auto w-full max-w-md space-y-4">
        <h2 className="font-display text-2xl font-bold">Sign in</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Use the account you created for search, alerts, and admin access.</p>
        <LoginForm />
      </Card>
    </div>
  );
}
