import { RegisterForm } from "@/app/auth/register/register-form";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Join the platform</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Create a workspace for search, alerts, and operations.</h1>
        <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
          Your account lets you save opportunities, define recurring alerts, and, for admins, operate source ingestion and crawl monitoring.
        </p>
      </section>
      <Card className="mx-auto w-full max-w-md space-y-4">
        <h2 className="font-display text-2xl font-bold">Create account</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Start with a member account and promote admins separately.</p>
        <RegisterForm />
      </Card>
    </div>
  );
}
