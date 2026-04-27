"use client";

const TICKER_ITEMS = [
  { category: "প্রবাস চাকরি", text: "কানাডায় ট্রাক ড্রাইভার নিয়োগ বিজ্ঞপ্তি প্রকাশ" },
  { category: "স্কলারশিপ", text: "Erasmus Mundus ২০২৬-এর আবেদন শুরু হয়েছে" },
  { category: "ভিসা নীতি", text: "UK Skilled Worker ভিসার নতুন নিয়ম কার্যকর" },
  { category: "প্রবাস চাকরি", text: "মালয়েশিয়ায় ৫০,০০০ বাংলাদেশি কর্মী নিয়োগ চলছে" },
  { category: "সরকারি সার্কুলার", text: "BOESL এর নতুন নিবন্ধন বিজ্ঞপ্তি প্রকাশ" },
  { category: "দক্ষতা প্রশিক্ষণ", text: "জাপানে কারিগরি শিক্ষার নতুন বৃত্তি কর্মসূচি" },
  { category: "প্রবাস চাকরি", text: "জার্মানিতে Ausbildung-এর নতুন সুযোগ বাংলাদেশিদের জন্য" },
];

const categoryColors: Record<string, string> = {
  "প্রবাস চাকরি": "border-green-400 text-green-400",
  "স্কলারশিপ": "border-blue-400 text-blue-400",
  "ভিসা নীতি": "border-yellow-400 text-yellow-400",
  "সরকারি সার্কুলার": "border-purple-400 text-purple-400",
  "দক্ষতা প্রশিক্ষণ": "border-cyan-400 text-cyan-400",
};

export function NewsTicker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="overflow-hidden bg-navy text-white py-2 select-none">
      <div className="flex items-center gap-0">
        {/* Static label */}
        <span className="shrink-0 bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-white mr-4 ml-0">
          সর্বশেষ
        </span>

        {/* Scrolling track */}
        <div className="overflow-hidden flex-1">
          <div className="flex gap-8 animate-ticker whitespace-nowrap">
            {doubled.map((item, i) => (
              <span key={i} className="inline-flex shrink-0 items-center gap-2 text-sm">
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    categoryColors[item.category] ?? "border-slate-400 text-slate-400"
                  }`}
                >
                  {item.category}
                </span>
                <span className="text-slate-200">{item.text}</span>
                <span className="text-slate-500 mx-2">◆</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
