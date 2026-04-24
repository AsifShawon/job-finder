import Link from "next/link";

import { OpportunityCard } from "@/components/opportunity-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getOpportunity, getSimilar } from "@/lib/api";
import { formatDate, humanizeSlug } from "@/lib/utils";

interface OpportunityDetailProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({ params }: OpportunityDetailProps) {
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  const similar = await getSimilar(id);

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Opportunity detail</p>
            <h1 className="font-display text-3xl font-bold">{opportunity.title}</h1>
          </div>
          <div className="flex gap-2">
            <Badge>{humanizeSlug(opportunity.record_type)}</Badge>
            <Badge>Trust {opportunity.trust_score.toFixed(2)}</Badge>
          </div>
        </div>
        <p className="max-w-4xl text-slate-700 dark:text-slate-200">{opportunity.summary ?? "No summary available."}</p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p>Country: {opportunity.country ?? "Unknown"}</p>
          <p>City: {opportunity.city ?? "Unknown"}</p>
          <p>Employer/Org: {opportunity.employer ?? opportunity.organization ?? "Unknown"}</p>
          <p>Deadline: {opportunity.deadline ? formatDate(opportunity.deadline) : "Open"}</p>
          <p>Visa support: {String(opportunity.visa_support ?? "unknown")}</p>
          <p>Extraction confidence: {opportunity.extraction_confidence.toFixed(2)}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-800">
            <p className="font-semibold">Requirements checklist</p>
            <ul className="list-disc space-y-1 pl-4">
              {(opportunity.requirements_json?.items ?? []).map((item: string, idx: number) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-800">
            <p className="font-semibold">Benefits and support</p>
            <ul className="list-disc space-y-1 pl-4">
              {(opportunity.benefits_json?.items ?? []).map((item: string, idx: number) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="font-semibold">Actionability</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{opportunity.actionability_score.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="font-semibold">Freshness</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{opportunity.freshness_score.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="font-semibold">Overall rank</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{opportunity.overall_rank_score.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={opportunity.application_url ?? opportunity.source_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Apply or visit source
          </a>
          <a
            href={opportunity.source_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
          >
            View source
          </a>
          <Link href="/copilot" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
            Ask Copilot
          </Link>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Similar opportunities</h2>
        {(similar.items ?? []).map((item) => (
          <OpportunityCard key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}
