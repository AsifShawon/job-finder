const DEFAULT_API_BASE = "http://localhost:8000";

function normalizeApiBase(value: string | undefined): string {
  return (value ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(
  process.env.SERVER_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL,
);
