"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ArrowRight } from "lucide-react";

import { HeroVoiceEntry } from "@/components/hero-voice-entry";
import { cn } from "@/lib/utils";

const HERO_SLIDES = [
  {
    image: "/assets/images/hero/image_1.png",
    altBn: "বিদেশে কাজের সুযোগ খুঁজছেন এমন মানুষের ব্যানার",
    altEn: "Banner showing people exploring overseas work opportunities",
    titleBn: "বিদেশে কাজের সুযোগ খুঁজুন",
    titleEn: "Find Your Overseas Opportunity",
    subtitleBn: "সরকারি যাচাই করা চাকরি, বৃত্তি ও ভিসা আপডেট এক জায়গায়",
    subtitleEn: "Verified jobs, scholarships, and visa updates in one place",
    cta: "/search",
  },
  {
    image: "/assets/images/hero/image_2.png",
    altBn: "স্কলারশিপ ও উচ্চশিক্ষা সুযোগের প্রচ্ছদ",
    altEn: "Cover image for scholarships and higher study opportunities",
    titleBn: "স্কলারশিপ ও প্রশিক্ষণের পথ জানুন",
    titleEn: "Discover Scholarships and Training Paths",
    subtitleBn: "বাংলাদেশি আবেদনকারীদের জন্য উপযোগী তথ্য আগে দেখুন",
    subtitleEn: "See the most relevant options for Bangladeshi applicants first",
    cta: "/search?record_type=scholarship",
  },
  {
    image: "/assets/images/hero/image_3.png",
    altBn: "নথি হাতে প্রবাস প্রস্তুতির দৃশ্য",
    altEn: "People preparing documents for migration",
    titleBn: "আবেদনের আগে নিরাপদ তথ্য যাচাই করুন",
    titleEn: "Verify Safe Information Before You Apply",
    subtitleBn: "সরকারি উৎস, ট্রাস্ট ব্যাজ, এবং আবেদনযোগ্যতার তথ্য স্পষ্টভাবে দেখুন",
    subtitleEn: "Check official sources, trust badges, and eligibility at a glance",
    cta: "/search?trust_tier=official_gov",
  },
  {
    image: "/assets/images/hero/image_4.png",
    altBn: "নতুন দেশের সুযোগ খোঁজার ভিজ্যুয়াল",
    altEn: "Visual of exploring opportunities by destination country",
    titleBn: "দেশভিত্তিক সুযোগ এখন আরও সহজে",
    titleEn: "Country-Based Opportunities Made Simpler",
    subtitleBn: "কানাডা, মালয়েশিয়া, জার্মানি, সৌদি আরবসহ জনপ্রিয় গন্তব্য একসাথে",
    subtitleEn: "Browse popular destinations like Canada, Malaysia, Germany, and Saudi Arabia",
    cta: "/search",
  },
] as const;

export function HeroSlider() {
  const locale = useLocale();
  const isEn = locale === "en";
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPrevIndex(activeIndex);
      setActiveIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [activeIndex]);

  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="absolute inset-0 bg-gradient-to-t from-[#07152f]/90 via-[#07152f]/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 py-4 sm:py-6">
        <div className="relative h-[420px] overflow-hidden rounded-[2rem] border border-white/10 sm:h-[520px]">
          {HERO_SLIDES.map((slide, index) => {
            const isActive = activeIndex === index;
            const isExiting = prevIndex === index;

            if (!isActive && !isExiting) return null;

            return (
              <div
                key={slide.image}
                className={cn(
                  "absolute inset-0",
                  isActive ? "z-10" : "z-0",
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
                  {isActive && (
                    <div className="absolute inset-0 z-30 pointer-events-none bg-primary hero-wipe-active" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07152f]/90 via-[#07152f]/35 to-transparent" />
                </div>
                
                {isActive && (
                  <div className="absolute inset-x-0 bottom-0 z-20 p-5 sm:p-8 lg:p-10">
                    <div className="grid gap-5 fade-up lg:grid-cols-[minmax(0,1fr)_520px] lg:items-end">
                      <div className="max-w-2xl space-y-4">
                      <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                        {isEn ? "Verified Opportunity Platform" : "যাচাই করা সুযোগের প্ল্যাটফর্ম"}
                      </span>
                      <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                        {isEn ? slide.titleEn : slide.titleBn}
                      </h1>
                      <p className="max-w-xl text-base text-slate-100 sm:text-lg">
                        {isEn ? slide.subtitleEn : slide.subtitleBn}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={slide.cta}
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        >
                          <span>{isEn ? "Explore Opportunities" : "সুযোগ খুঁজুন"}</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                          href="/auth/register"
                          className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
                        >
                          {isEn ? "Free Account" : "ফ্রি অ্যাকাউন্ট"}
                        </Link>
                      </div>
                      </div>
                      <HeroVoiceEntry isEn={isEn} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.image}
                type="button"
                onClick={() => {
                  setPrevIndex(activeIndex);
                  setActiveIndex(index);
                }}
                aria-label={isEn ? `View slide ${index + 1}` : `স্লাইড ${index + 1} দেখুন`}
                className={cn(
                  "h-2.5 rounded-full transition-all",
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
