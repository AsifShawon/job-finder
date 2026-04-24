import { CopilotForm } from "@/app/copilot/copilot-form";

export default function CopilotPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Opportunity Copilot</h1>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Copilot only uses indexed data and attached evidence metadata. No live browsing in V1.
      </p>
      <CopilotForm />
    </div>
  );
}
