import Link from "next/link";
import { ShieldCheck, Bell, Sparkles } from "lucide-react";

import { LoginForm } from "@/app/auth/login/login-form";
import { getLocale } from "@/lib/i18n";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "যাচাই করা সুযোগ",
    body: "সরকারি ও অফিসিয়াল উৎস থেকে আসা বিশ্বস্ত চাকরি ও বৃত্তি খুঁজুন।",
  },
  {
    icon: Bell,
    title: "সতর্কতা সেটআপ",
    body: "পছন্দের ক্যাটাগরি ও দেশ অনুযায়ী স্বয়ংক্রিয় সতর্কতা চালু রাখুন।",
  },
  {
    icon: Sparkles,
    title: "AI Copilot সহায়তা",
    body: "আপনার প্রোফাইল অনুযায়ী সবচেয়ে প্রাসঙ্গিক সুযোগ খুঁজে পান।",
  },
];

export default async function LoginPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* Left: Value proposition */}
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
                  ? "Your trusted gateway to overseas opportunities"
                  : "বিদেশি সুযোগের বিশ্বস্ত প্ল্যাটফর্মে স্বাগতম"}
              </h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {isEn
                  ? "One account for verified jobs, scholarships, visa policy updates, and alerts."
                  : "যাচাই করা চাকরি, স্কলারশিপ, ভিসা আপডেট ও সতর্কতার জন্য একটি অ্যাকাউন্ট।"}
              </p>
            </div>

            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                ⚠️ কোনো অর্থ লেনদেনের আগে সরকারি বা অফিসিয়াল উৎস যাচাই করুন।
                আমাদের প্ল্যাটফর্ম শুধু তথ্য সংকলন করে — সরাসরি নিয়োগকর্তা নই।
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {isEn ? "Sign in to your account" : "আপনার অ্যাকাউন্টে প্রবেশ করুন"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isEn
                  ? "Continue where you left off."
                  : "আপনার সেশন থেকে যেখানে ছেড়েছিলেন সেখান থেকে শুরু করুন।"}
              </p>
            </div>

            <LoginForm />

            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
              {isEn ? "Don't have an account?" : "অ্যাকাউন্ট নেই?"}{" "}
              <Link
                href="/auth/register"
                className="font-semibold text-primary hover:underline"
              >
                {isEn ? "Create one free" : "বিনামূল্যে তৈরি করুন"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
