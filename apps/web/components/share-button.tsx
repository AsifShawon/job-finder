"use client";

import { useEffect, useRef, useState } from "react";
import { Facebook, Instagram, Link2, Share2 } from "lucide-react";
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
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }

    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer");
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
        onClick={() => setOpen((current) => !current)}
        aria-label={isBn ? "শেয়ার করুন" : "Share"}
        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Share2 className="h-4 w-4" />
        <span>{isBn ? "শেয়ার" : "Share"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-card shadow-lg">
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 rounded-t-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Link2 className="h-4 w-4 text-primary" />
            <span>{isBn ? "লিংক কপি করুন" : "Copy link"}</span>
          </button>
          <button
            type="button"
            onClick={handleFacebook}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Facebook className="h-4 w-4 text-blue-600" />
            <span>{isBn ? "ফেসবুকে শেয়ার করুন" : "Share on Facebook"}</span>
          </button>
          <button
            type="button"
            onClick={handleInstagram}
            className="flex w-full items-center gap-2 rounded-b-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Instagram className="h-4 w-4 text-pink-600" />
            <span>{isBn ? "ইনস্টাগ্রামের জন্য লিংক নিন" : "Use on Instagram"}</span>
          </button>
        </div>
      )}

      {copied && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {isBn ? `${title} লিংক কপি হয়েছে` : `${title} link copied`}
        </div>
      )}

      {igToast && (
        <div className="fixed bottom-4 left-1/2 z-50 max-w-xs -translate-x-1/2 rounded-2xl bg-slate-800 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          {isBn
            ? "ইনস্টাগ্রামে শেয়ার করতে আগে লিংক কপি করে পোস্টে পেস্ট করুন।"
            : "Copy the link first, then paste it into your Instagram post."}
        </div>
      )}
    </div>
  );
}
