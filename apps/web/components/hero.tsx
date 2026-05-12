"use client";

import { Search, MapPin, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Hero({ isEn }: { isEn: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (country) params.set("country", country);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <section className="relative bg-white py-16 lg:py-24 overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-4 relative z-10">
        <div className="max-w-3xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {isEn ? (
                <>Find Your <span className="text-primary">Trusted</span> Overseas Opportunity</>
              ) : (
                <>আপনার জন্য <span className="text-primary">নিরাপদ</span> বিদেশি চাকরি খুঁজুন</>
              )}
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl max-w-2xl">
              {isEn 
                ? "Access verified jobs, scholarships, and official visa updates from trusted sources for Bangladeshi citizens."
                : "বাংলাদেশি নাগরিকদের জন্য সরকারি যাচাই করা চাকরি, স্কলারশিপ এবং ভিসা সংক্রান্ত সঠিক তথ্য সব একসাথে।"}
            </p>
          </div>

          <form 
            onSubmit={handleSearch}
            className="flex flex-col gap-3 p-2 bg-card border border-border shadow-xl rounded-2xl sm:flex-row sm:items-center lg:p-3"
          >
            <div className="flex-1 flex items-center gap-3 px-4 py-3">
              <Briefcase className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={isEn ? "Job title or keyword" : "চাকরির নাম বা কীওয়ার্ড"}
                className="w-full bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            
            <div className="hidden sm:block w-px h-8 bg-border" />
            
            <div className="flex-1 flex items-center gap-3 px-4 py-3">
              <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={isEn ? "Country" : "দেশ"}
                className="w-full bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="bg-primary text-white font-bold py-4 px-8 rounded-xl transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              <Search className="h-5 w-5" />
              <span>{isEn ? "Search" : "খুঁজুন"}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>{isEn ? "Popular:" : "জনপ্রিয়:"}</span>
            <div className="flex flex-wrap gap-2">
              {["Saudi Arabia", "Malaysia", "Canada", "Romania"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCountry(c)}
                  className="px-3 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {isEn ? c : c} {/* TODO: Map to BN if needed */}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
