import { NextResponse } from "next/server";
import { recordSearchMetric } from "@/lib/outbound-clicks";
import { sanitizeSearchQuery } from "@/lib/security";

const maxResultCount = 1_000_000;

function parseResultCount(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return 0;

  return Math.min(Math.trunc(numericValue), maxResultCount);
}

function noContent() {
  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = sanitizeSearchQuery(requestUrl.searchParams.get("query"), 80).toLocaleLowerCase("es-AR");
  if (query.length < 2) return noContent();

  try {
    await recordSearchMetric({
      query,
      category: sanitizeSearchQuery(requestUrl.searchParams.get("category"), 40) || "Todas",
      store: sanitizeSearchQuery(requestUrl.searchParams.get("store"), 80) || "Todas",
      resultCount: parseResultCount(requestUrl.searchParams.get("resultCount")),
    });
  } catch {
    // Analytics must stay invisible to shoppers even if the metrics database is unavailable.
  }

  return noContent();
}
