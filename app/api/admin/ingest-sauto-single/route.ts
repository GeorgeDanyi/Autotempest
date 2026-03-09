import { NextRequest, NextResponse } from "next/server";
import { ingestSautoSingle } from "@/lib/ingest/ingestSautoSingle";
import { ingestSautoDetail } from "@/lib/ingest/ingestSautoDetail";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  const source_listing_id = searchParams.get("source_listing_id");

  if (!source_listing_id) {
    return NextResponse.json(
      { ok: false, error: "source_listing_id required" },
      { status: 400 },
    );
  }

  const detailResult = await ingestSautoDetail({ source_listing_id });

  if (detailResult.ok) {
    return NextResponse.json({ ok: true });
  }

  const detailError = detailResult.error;
  const detailStatus = detailResult.status;
  const detailLower = detailError.toLowerCase();

  let finalOk = false;
  let finalError = detailError;
  let finalStatus = detailStatus ?? 500;

  if (
    detailStatus === 404 ||
    detailLower.includes("not found on detail") ||
    detailLower.includes("could not parse listing")
  ) {
    const listResult = await ingestSautoSingle({ source_listing_id });
    if (listResult.ok) {
      return NextResponse.json({ ok: true });
    }
    finalOk = false;
    finalError = listResult.error;
    const lr = listResult.error.toLowerCase();
    if (lr.includes("timeout")) {
      finalStatus = 504;
    } else if (lr.includes("not found")) {
      finalStatus = 404;
    } else {
      finalStatus = 500;
    }
  } else if (detailStatus === 504 || detailLower.includes("timeout")) {
    finalStatus = 504;
  } else if (detailStatus === 429 || detailStatus === 403) {
    finalStatus = detailStatus;
  }

  return NextResponse.json(
    { ok: finalOk, error: finalError },
    { status: finalStatus },
  );
}

