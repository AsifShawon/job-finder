import { SudokkhoChatShell } from "@/app/copilot/sudokkho-chat-shell";
import { getLocale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/server-auth-fetch";
import { redirect } from "next/navigation";

export default async function CopilotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.mode) query.set("mode", params.mode);
    if (params.autoSpeak) query.set("autoSpeak", params.autoSpeak);
    const next = `/copilot${query.toString() ? `?${query.toString()}` : ""}`;
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }
  const initialQuestion = params.q ?? "";
  const initialMode = params.mode === "voice" ? "voice" : "text";
  const initialAutoSpeak = params.autoSpeak === "1";

  return (
    <SudokkhoChatShell
      initialQuestion={initialQuestion}
      initialMode={initialMode}
      initialAutoSpeak={initialAutoSpeak}
      initialLocale={locale === "en" ? "en" : "bn"}
    />
  );
}
