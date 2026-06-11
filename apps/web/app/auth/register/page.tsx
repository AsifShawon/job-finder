import Link from "next/link";
import { CheckCircle } from "lucide-react";

import { RegisterForm } from "@/app/auth/register/register-form";
import { getLocale } from "@/lib/i18n";

const BENEFITS = [
  "সংরক্ষিত চাকরি ও বৃত্তির তালিকা তৈরি করুন",
  "পছন্দের বিষয়ে স্বয়ংক্রিয় সতর্কতা পান",
  "AI Copilot দিয়ে সুযোগ বিশ্লেষণ করুন",
  "ড্যাশবোর্ড থেকে সব অ্যাক্টিভিটি ট্র্যাক করুন",
  "আবেদনের শেষ তারিখের রিমাইন্ডার পান",
];

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";
  const next = params.next;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* Left: Value */}
          <div className="hidden lg:block space-y-8 pt-4">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-base">
                  সু
                </div>
                <span className="text-lg font-bold text-foreground">সুযোগ বিডি</span>
              </Link>
              <h1 className="text-3xl font-bold leading-snug text-foreground">
                {isEn
                  ? "Create your free account"
                  : "বিনামূল্যে অ্যাকাউন্ট তৈরি করুন"}
              </h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {isEn
                  ? "Join thousands of Bangladeshis discovering verified overseas opportunities."
                  : "হাজার হাজার বাংলাদেশির সাথে যোগ দিন যারা বিদেশি সুযোগ খুঁজছেন।"}
              </p>
            </div>

            <div className="space-y-3">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-2.5">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <p className="text-sm text-foreground">{b}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
              <p className="text-sm font-semibold text-foreground">
                ১০০% বিনামূল্যে
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                কোনো ক্রেডিট কার্ড বা পেমেন্ট তথ্যের প্রয়োজন নেই। তাৎক্ষণিক
                অ্যাক্সেস পান।
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {isEn ? "Create your account" : "ফ্রি অ্যাকাউন্ট তৈরি করুন"}
              </h2>
              {next && !isEn ? (
                <p className="mt-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary leading-relaxed">
                  আপনার প্রশ্নটি আমরা মনে রাখছি। রেজিস্ট্রেশন শেষ হলে উত্তর দেখানো হবে।
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {isEn
                    ? "Get started in seconds."
                    : "কয়েক সেকেন্ডেই শুরু করুন।"}
                </p>
              )}
            </div>

            <RegisterForm />

            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
              {isEn ? "Already have an account?" : "ইতিমধ্যে অ্যাকাউন্ট আছে?"}{" "}
              <Link
                href={next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
                className="font-semibold text-primary hover:underline"
              >
                {isEn ? "Sign in" : "প্রবেশ করুন"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
