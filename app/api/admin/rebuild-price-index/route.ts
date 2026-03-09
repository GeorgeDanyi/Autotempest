import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rebuildPriceIndex } from "@/lib/pricing/rebuildPriceIndex";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

/**
 * POST /api/admin/rebuild-price-index
 * Header: x-admin-secret: <ADMIN_API_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  try {
    const supabase = getSupabaseAdmin();
    const result = await rebuildPriceIndex(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
