import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const model_key = searchParams.get("model_key");

  if (!model_key) {
    return NextResponse.json({ ok: false, error: "model_key required" });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("model_key", model_key)
    .order("observed_at", { ascending: false })
    .limit(90);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    model_key,
    history: data,
  });
}

