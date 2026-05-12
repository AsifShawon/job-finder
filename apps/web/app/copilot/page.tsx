import { CopilotForm } from "@/app/copilot/copilot-form";
import { getLocale } from "@/lib/i18n";
import { requireCurrentUser } from "@/lib/server-auth-fetch";

export default async function CopilotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireCurrentUser();
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const initialQuestion = params.q ?? "";

  return (
    <div className="min-h-screen bg-background">
      <CopilotForm initialQuestion={initialQuestion} initialLocale={locale === "en" ? "en" : "bn"} />
    </div>
  );
}
