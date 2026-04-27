"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function CopilotForm() {
  const isEn = useLocale() === "en";
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<any[]>([]);

  const handleAsk = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/copilot/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer ?? (isEn ? "No answer was returned." : "উত্তর পাওয়া যায়নি"));
      setCitations(data.citations ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={isEn ? "Ask about jobs with visa support, scholarships, or policy changes" : "ভিসা সহায়তাসহ চাকরি, বৃত্তি বা নীতি পরিবর্তন সম্পর্কে জিজ্ঞাসা করুন"}
        />
        <Button onClick={handleAsk} disabled={loading || !question.trim()}>{loading ? (isEn ? "Thinking..." : "ভাবছে...") : (isEn ? "Ask" : "জিজ্ঞাসা করুন")}</Button>
      </div>
      <Card>
        <p className="text-sm whitespace-pre-wrap">{answer || (isEn ? "The assistant only answers from indexed records." : "সহকারী শুধু ইনডেক্স করা রেকর্ড থেকে উত্তর দেয়।")}</p>
      </Card>
      {citations.length > 0 && (
        <Card className="space-y-2">
          <p className="font-semibold">{isEn ? "Evidence" : "প্রমাণসূত্র"}</p>
          {citations.map((c) => (
            <div key={c.opportunity_id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-semibold">{c.title}</p>
              <p>{isEn ? "Trust tier" : "বিশ্বাসযোগ্যতা"}: {c.trust_tier} | {isEn ? "Confidence" : "আস্থা"}: {Number(c.extraction_confidence).toFixed(2)}</p>
              <a href={c.source_url} className="text-primary underline">{c.source_url}</a>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
