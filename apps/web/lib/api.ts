import type { OpportunityDetail, SearchResponse, SimilarOpportunityResponse } from "@/lib/types";

import { API_BASE } from "@/lib/api-base";

export async function searchOpportunities(params: URLSearchParams): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/api/v1/opportunities/search?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch opportunities");
  }
  return response.json();
}

export async function getOpportunity(id: string): Promise<OpportunityDetail> {
  const response = await fetch(`${API_BASE}/api/v1/opportunities/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Opportunity not found");
  }
  return response.json();
}

export async function getSimilar(id: string): Promise<SimilarOpportunityResponse> {
  const response = await fetch(`${API_BASE}/api/v1/opportunities/${id}/similar`, { cache: "no-store" });
  if (!response.ok) {
    return { items: [] };
  }
  return response.json();
}
