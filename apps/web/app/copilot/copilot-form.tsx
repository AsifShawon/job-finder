"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function CopilotForm() {
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
      setAnswer(data.answer ?? "No answer");
      setCitations(data.citations ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about visa-supported jobs, scholarships, or policy changes" />
        <Button onClick={handleAsk} disabled={loading || !question.trim()}>{loading ? "Thinking..." : "Ask"}</Button>
      </div>
      <Card>
        <p className="text-sm whitespace-pre-wrap">{answer || "Copilot answers from indexed records only."}</p>
      </Card>
      {citations.length > 0 && (
        <Card className="space-y-2">
          <p className="font-semibold">Evidence citations</p>
          {citations.map((c) => (
            <div key={c.opportunity_id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-semibold">{c.title}</p>
              <p>Trust: {c.trust_tier} | Confidence: {Number(c.extraction_confidence).toFixed(2)}</p>
              <a href={c.source_url} className="text-primary underline">{c.source_url}</a>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
