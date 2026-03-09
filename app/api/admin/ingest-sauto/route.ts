import { NextRequest, NextResponse } from "next/server";
import { ingestSautoPages } from "@/lib/ingest/ingestSautoSingle";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

/**
 * Spuštění lokálně:
 * curl -X POST http://localhost:3000/api/admin/ingest-sauto -H "x-admin-secret: YOUR_SECRET"
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  // 0) načtení query parametrů
  const { searchParams } = new URL(req.url);
  const pagesParam = searchParams.get("pages");
  let pagesRequested = Number(pagesParam ?? "");
  const brand = searchParams.get("brand") || null;
  const model = searchParams.get("model") || null;

  const result = await ingestSautoPages({
    pagesRequested,
    brand,
    model,
  });

  return NextResponse.json(result);
}