import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"];
const SERVICE_ROLE_KEYS = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE"];

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    null;

  if (!url) {
    const checked = URL_KEYS.map((k) => `${k}=${process.env[k] != null ? "set" : "missing"}`).join(", ");
    throw new Error(`Supabase URL not set. Checked: ${checked}`);
  }

  if (!serviceRole) {
    const checked = SERVICE_ROLE_KEYS.map((k) => `${k}=${process.env[k] != null ? "set" : "missing"}`).join(", ");
    throw new Error(`Supabase service role key not set. Checked: ${checked}`);
  }

  cached = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  return cached;
}
