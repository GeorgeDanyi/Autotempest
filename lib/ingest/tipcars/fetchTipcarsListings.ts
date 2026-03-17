/**
 * FETCH LAYER – TipCars.
 * Stahuje HTML stránky s výpisem inzerátů (list results).
 * Žádná logika parsování ani ukládání – pouze HTTP GET a vrácení HTML.
 */

import {
  TIPCARS_BASE_URL,
  TIPCARS_LIST_PATH,
  TIPCARS_MODEL_LIST_PATH,
} from "./selectors";

const DEFAULT_TIMEOUT_MS = 25_000;
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
 * Při brand parametru použije query param znacka na globálním výpisu.
 */
export async function fetchTipcarsListPage(
  page: number = 1,
  brand?: string
): Promise<FetchTipcarsListingsResult> {
  const url = new URL(TIPCARS_LIST_PATH, TIPCARS_BASE_URL);
  if (brand) url.searchParams.set("znacka", brand);
  if (page > 1) url.searchParams.set("page", String(page));
  const urlStr = url.toString();
  try {
    const html = await fetchWithTimeout(urlStr);
    console.log("[tipcars][fetch] url:", urlStr, "html length:", html.length);
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
  brand?: string;
}): Promise<{
  htmlPerPage: string[];
  urls: string[];
  errors: string[];
}> {
  const { pages, brand } = params;
  const n = Math.max(1, Math.min(pages, 200));
  const htmlPerPage: string[] = [];
  const urls: string[] = [];
  const errors: string[] = [];

  for (let p = 1; p <= n; p++) {
    const result = await fetchTipcarsListPage(p, brand);
    urls.push(result.url);
    if (result.ok) {
      htmlPerPage.push(result.html);
    } else {
      errors.push(`${result.url}: ${result.error ?? "unknown"}`);
    }
  }

  return { htmlPerPage, urls, errors };
}

export async function fetchTipcarsModelListings(params: {
  brand: string;
  model: string;
  pages: number;
}): Promise<{
  htmlPerPage: string[];
  urls: string[];
  errors: string[];
}> {
  const { brand, model, pages } = params;
  const n = Math.max(1, Math.min(pages, 50));
  const basePath = TIPCARS_MODEL_LIST_PATH(brand, model);
  const htmlPerPage: string[] = [];
  const urls: string[] = [];
  const errors: string[] = [];

  for (let p = 1; p <= n; p++) {
    // TipCars model stránky: /skoda-octavia/ojete/ pro stránku 1
    // stránka 2+: /skoda-octavia/ojete/?page=2 (vyzkoušíme)
    const url = new URL(basePath, TIPCARS_BASE_URL);
    if (p > 1) url.searchParams.set("page", String(p));
    const urlStr = url.toString();

    try {
      const html = await fetchWithTimeout(urlStr, 25_000);
      const linkCount =
        html.match(/href="[^"]*-(\d{6,})\.html"/g)?.length ?? 0;
      console.log(
        `[tipcars][fetch] url: ${urlStr} html: ${html.length} links: ${linkCount}`,
      );

      if (linkCount === 0 && p > 1) {
        console.log(
          `[tipcars][fetch] žádné výsledky na stránce ${p}, ukončuji`,
        );
        break;
      }

      htmlPerPage.push(html);
      urls.push(urlStr);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${urlStr}: ${message}`);
      if (p === 1) break;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return { htmlPerPage, urls, errors };
}
