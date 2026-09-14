import { NextResponse } from "next/server";
import { catalogProducts } from "@/lib/catalog";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    { products: catalogProducts },
    {
      headers: {
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
