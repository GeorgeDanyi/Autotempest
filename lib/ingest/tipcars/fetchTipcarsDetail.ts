/**
 * FETCH LAYER – TipCars detail page.
 * Stahuje HTML jedné detail stránky inzerátu (pro enrichment).
 */

import { TIPCARS_BASE_URL } from "./selectors";

const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "AutotempestBot/0.1 (ingest; contact: dev@autotempest.local)";

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export type FetchTipcarsDetailResult = {
  html: string;
  url: string;
  ok: boolean;
  error?: string;
};

/**
 * Stáhne HTML detail stránky inzerátu.
 * url musí být plná URL na tipcars.com (např. z listingu).
 */
export async function fetchTipcarsDetail(
  url: string
): Promise<FetchTipcarsDetailResult> {
  let resolved = url;
  try {
    resolved = new URL(url, TIPCARS_BASE_URL).toString();
  } catch {
    // leave as-is
  }
  try {
    const html = await fetchWithTimeout(resolved);
    return { html, url: resolved, ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { html: "", url: resolved, ok: false, error: message };
  }
}
