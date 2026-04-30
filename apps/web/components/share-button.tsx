"use client";

import { useState, useEffect, useRef } from "react";
import { Share2, Link2, Facebook, Instagram } from "lucide-react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  title: string;
  className?: string;
}

export function ShareButton({ url, title, className }: ShareButtonProps) {
  const locale = useLocale() as "bn" | "en";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [igToast, setIgToast] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isBn = locale === "bn";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleInstagram = () => {
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    setOpen(false);
    setIgToast(true);
    setTimeout(() => setIgToast(false), 4000);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isBn ? "শেয়ার করুন" : "Share"}
        className="text-muted-foreground/50 hover:text-primary transition-colors"
      >
        <Share2 className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-52 rounded-xl border border-border bg-card shadow-lg">
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors rounded-t-xl"
          >
            <Link2 className="h-4 w-4 text-primary" />
            {isBn ? "লিংক কপি করুন" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleFacebook}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Facebook className="h-4 w-4 text-blue-600" />
            {isBn ? "ফেসবুকে শেয়ার করুন" : "Share on Facebook"}
          </button>
          <button
            type="button"
            onClick={handleInstagram}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors rounded-b-xl"
          >
            <Instagram className="h-4 w-4 text-pink-600" />
            {isBn ? "ইনস্টাগ্রামে শেয়ার করুন" : "Share on Instagram"}
          </button>
        </div>
      )}

      {copied && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {isBn ? "লিংক কপি হয়েছে!" : "Link copied!"}
        </div>
      )}

      {igToast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 max-w-xs rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg text-center">
          {isBn
            ? "ইনস্টাগ্রামে শেয়ার করতে লিংকটি কপি করুন এবং পোস্টে পেস্ট করুন"
            : "To share on Instagram, copy the link and paste it in your post"}
        </div>
      )}
    </div>
  );
}
