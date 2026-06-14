"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ArrowRight, Mic, ShieldCheck, Sparkles } from "lucide-react";

import { HeroVoiceEntry } from "@/components/hero-voice-entry";
import { cn } from "@/lib/utils";
import { getLocalizedCopy, UX_COPY } from "@/lib/ux-copy";
import type { Locale } from "@/lib/i18n-shared";

const HERO_SLIDES = [
  {
    image: "/assets/images/hero/image_1.png",
    altBn: "বিদেশে কাজের সুযোগ খুঁজছেন এমন মানুষের ব্যানার",
    altEn: "Banner showing people exploring overseas work opportunities",
  },
  {
    image: "/assets/images/hero/image_2.png",
    altBn: "স্কলারশিপ ও উচ্চশিক্ষা সুযোগের প্রচ্ছদ",
    altEn: "Cover image for scholarships and higher study opportunities",
  },
  {
    image: "/assets/images/hero/image_3.png",
    altBn: "নথি হাতে প্রবাস প্রস্তুতির দৃশ্য",
    altEn: "People preparing documents for migration",
  },
  {
    image: "/assets/images/hero/image_4.png",
    altBn: "নতুন দেশের সুযোগ খোঁজার ভিজ্যুয়াল",
    altEn: "Visual of exploring opportunities by destination country",
  },
] as const;

export function HeroSlider() {
  const locale = useLocale() as Locale;
  const isEn = locale === "en";
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(-1);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setPrevIndex(activeIndex);
      setActiveIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [activeIndex, paused]);

  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="absolute inset-0 bg-gradient-to-t from-[#07152f]/90 via-[#07152f]/40 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 py-4 sm:py-6 z-10">
        <div className="relative min-h-[640px] sm:min-h-[600px] lg:h-[520px] xl:h-[560px] overflow-hidden rounded-[2rem] border border-white/10 p-4 sm:p-6 lg:p-10 flex flex-col justify-between">
          
          {/* Background Slides */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {HERO_SLIDES.map((slide, index) => {
              const isActive = activeIndex === index;
              const isExiting = prevIndex === index;

              if (!isActive && !isExiting) return null;

              return (
                <div
                  key={slide.image}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-1000",
                    isActive ? "opacity-100 z-10" : "opacity-0 z-0",
                  )}
                >
                  <div className="relative h-full w-full overflow-hidden">
                    <Image
                      src={slide.image}
                      alt={isEn ? slide.altEn : slide.altBn}
                      fill
                      priority={isActive}
                      className={cn(
                        "object-cover",
                        isActive ? "hero-slide-active" : "hero-slide-exit",
                      )}
                      sizes="(max-width: 768px) 100vw, 1280px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07152f]/95 via-[#07152f]/60 to-[#07152f]/45" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Static Content Overlay */}
          <div className="relative z-20 flex-1 flex flex-col justify-center w-full py-4 sm:py-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_480px] lg:items-center lg:gap-8 xl:gap-12">
              
              {/* Left Column: Text & CTAs */}
              <div className="space-y-4 sm:space-y-6 text-left">
                <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-300 backdrop-blur-sm">
                  {isEn ? "Verified Opportunity Platform" : "যাচাই করা সুযোগের প্ল্যাটফর্ম"}
                </span>
                
                <h1 data-testid="hero-slide-title" className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl leading-tight">
                  {getLocalizedCopy(UX_COPY.homepageHero.title, locale)}
                </h1>
                
                <p className="text-base text-slate-200 sm:text-lg md:text-xl max-w-xl leading-relaxed">
                  {getLocalizedCopy(UX_COPY.homepageHero.subtitle, locale)}
                </p>
                
                <div className="flex flex-wrap gap-2.5 pt-2 text-xs sm:text-sm text-teal-200">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-sm shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-teal-300 shrink-0" />
                    <span>{isEn ? "Verified Sources" : "সরকারি/বিশ্বস্ত উৎস"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-sm shadow-sm">
                    <Mic className="h-4 w-4 text-teal-300 shrink-0" />
                    <span>{isEn ? "Ask by Voice" : "ভয়েসে প্রশ্ন করুন"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-sm shadow-sm">
                    <Sparkles className="h-4 w-4 text-teal-300 shrink-0" />
                    <span>{isEn ? "Safe Application Guide" : "নিরাপদ আবেদন নির্দেশিকা"}</span>
                  </span>
                </div>
              </div>

              {/* Right Column: Voice Assistant */}
              <div className="w-full flex justify-center lg:justify-end">
                <HeroVoiceEntry isEn={isEn} onInteractionChange={setPaused} />
              </div>
              
            </div>
          </div>

          {/* Dots Indicators */}
          <div className="relative z-20 flex justify-center items-center gap-2 pb-2">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.image}
                type="button"
                onClick={() => {
                  setPrevIndex(activeIndex);
                  setActiveIndex(index);
                }}
                aria-current={activeIndex === index ? "true" : undefined}
                aria-label={isEn ? `View slide ${index + 1}` : `স্লাইড ${index + 1} দেখুন`}
                className={cn(
                  "h-2.5 rounded-full transition-all relative after:absolute after:-inset-4",
                  activeIndex === index ? "w-8 bg-white" : "w-2.5 bg-white/45",
                )}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
