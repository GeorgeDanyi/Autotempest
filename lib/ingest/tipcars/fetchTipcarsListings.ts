/**
 * FETCH LAYER – TipCars.
 * Stahuje HTML stránky s výpisem inzerátů (list results).
 * Žádná logika parsování ani ukládání – pouze HTTP GET a vrácení HTML.
 */

import {
  TIPCARS_BASE_URL,
  TIPCARS_LIST_PATH,
} from "./selectors";

const DEFAULT_TIMEOUT_MS = 15_000;
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

export type FetchTipcarsListingsResult = {
  html: string;
  url: string;
  ok: boolean;
  error?: string;
};

/**
 * Stáhne jednu stránku s výpisem ojetých vozů.
 * TipCars může používat paginaci (page=2, …) – rozšíření podle potřeby.
 */
export async function fetchTipcarsListPage(
  page: number = 1
): Promise<FetchTipcarsListingsResult> {
  const url = new URL(TIPCARS_LIST_PATH, TIPCARS_BASE_URL);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }
  const urlStr = url.toString();
  try {
    const html = await fetchWithTimeout(urlStr);
    return { html, url: urlStr, ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { html: "", url: urlStr, ok: false, error: message };
  }
}

/**
 * Stáhne více stránek výpisu (pages 1..n).
 * Vrací pole HTML po stránkách a seznam chyb.
 */
export async function fetchTipcarsListings(params: {
  pages: number;
}): Promise<{
  htmlPerPage: string[];
  urls: string[];
  errors: string[];
}> {
  const { pages } = params;
  const n = Math.max(1, Math.min(pages, 20));
  const htmlPerPage: string[] = [];
  const urls: string[] = [];
  const errors: string[] = [];

  for (let p = 1; p <= n; p++) {
    const result = await fetchTipcarsListPage(p);
    urls.push(result.url);
    if (result.ok) {
      htmlPerPage.push(result.html);
    } else {
      errors.push(`${result.url}: ${result.error ?? "unknown"}`);
    }
  }

  return { htmlPerPage, urls, errors };
}
