import { Sparkles, AlertTriangle } from "lucide-react";

import { CopilotForm } from "@/app/copilot/copilot-form";
import { getLocale } from "@/lib/i18n";

const SUGGESTED_PROMPTS = [
  "আমার জন্য কানাডার কোন চাকরিগুলো সবচেয়ে ভালো?",
  "জার্মানিতে Ausbildung সুযোগ খুঁজে দাও",
  "আমার CV অনুযায়ী স্কলারশিপ সাজেস্ট করো",
  "UK Skilled Worker ভিসার নতুন নিয়ম কী?",
  "মালয়েশিয়ায় বাংলাদেশিদের জন্য কী কী সুযোগ আছে?",
  "কোরিয়া EPS প্রোগ্রামে আবেদন করতে কী লাগে?",
];

export default async function CopilotPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                AI Opportunity Copilot
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEn
                  ? "Powered by indexed data — answers only from verified sources."
                  : "ইনডেক্স করা ডেটা থেকে — শুধু যাচাই করা উৎস থেকে উত্তর দেয়।"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main chat area */}
          <div className="space-y-4">
            {/* Disclaimer */}
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isEn
                  ? "AI Copilot answers are based on indexed data only and do not browse live. Always verify important details from the original source before taking any action."
                  : "AI Copilot শুধু ইনডেক্স করা ডেটা ব্যবহার করে, লাইভ ব্রাউজিং করে না। গুরুত্বপূর্ণ সিদ্ধান্ত নেওয়ার আগে মূল উৎস থেকে যাচাই করুন।"}
              </p>
            </div>

            {/* Chat form */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <CopilotForm />
            </div>
          </div>

          {/* Suggested prompts sidebar */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold text-foreground section-underline">
                {isEn ? "Suggested prompts" : "পরামর্শকৃত প্রশ্ন"}
              </h3>
              <div className="space-y-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="block w-full rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-xs text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
                    onClick={() => {
                      const input = document.querySelector<HTMLTextAreaElement>("textarea");
                      if (input) {
                        input.value = prompt;
                        input.focus();
                      }
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold text-foreground">
                {isEn ? "What can I ask?" : "কী জিজ্ঞেস করতে পারি?"}
              </h3>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {[
                  isEn ? "Find jobs by country or sector" : "দেশ বা সেক্টর অনুযায়ী চাকরি খুঁজুন",
                  isEn ? "Compare scholarship deadlines" : "স্কলারশিপের শেষ তারিখ তুলনা করুন",
                  isEn ? "Explain visa policy changes" : "ভিসা নীতির পরিবর্তন বুঝুন",
                  isEn ? "Assess job safety / legitimacy" : "চাকরির বৈধতা যাচাই করুন",
                  isEn ? "Skill gap analysis" : "দক্ষতার ঘাটতি বিশ্লেষণ করুন",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
