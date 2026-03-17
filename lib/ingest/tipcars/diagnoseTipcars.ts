/**
 * Diagnostika TipCars - spusť: npx tsx lib/ingest/tipcars/diagnoseTipcars.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const TIPCARS_BASE = "https://www.tipcars.com";
const UA = "AutotempestBot/0.1 (contact: dev@autotempest.local)";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  // Test 1: Základní URL
  console.log("\n=== TEST 1: Základní URL ===");
  const html1 = await fetchHtml(`${TIPCARS_BASE}/hledam/ojete-vozy/`);
  console.log("html length:", html1.length);

  // Najdi všechny href obsahující číslo (listing ID)
  const linkMatches1 = html1.match(/href="[^"]*-(\d{6,})\.html"/g) ?? [];
  console.log("listing links found:", linkMatches1.length);
  console.log("první 3:", linkMatches1.slice(0, 3));

  // Test 2: Stránka 2 s různými parametry
  console.log("\n=== TEST 2: Různé paginační parametry ===");
  const urls = [
    `${TIPCARS_BASE}/hledam/ojete-vozy/?page=2`,
    `${TIPCARS_BASE}/hledam/ojete-vozy/?strana=2`,
    `${TIPCARS_BASE}/hledam/ojete-vozy/2/`,
    `${TIPCARS_BASE}/hledam/ojete-vozy/?offset=20`,
    `${TIPCARS_BASE}/hledam/ojete-vozy/?from=20`,
  ];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const links = html.match(/href="[^"]*-(\d{6,})\.html"/g) ?? [];
      // Zkontroluj jestli jsou jiné IDs než stránka 1
      const ids = links
        .map((l) => l.match(/-(\d{6,})\.html/)?.[1])
        .filter(Boolean);
      console.log(`\n${url}`);
      console.log(`  html length: ${html.length}, links: ${links.length}`);
      console.log(`  první 2 IDs: ${ids.slice(0, 2).join(", ")}`);
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Test 3: Zkontroluj HTML strukturu pro listing regex
  console.log("\n=== TEST 3: HTML struktura listingů ===");
  const html3 = await fetchHtml(`${TIPCARS_BASE}/hledam/ojete-vozy/`);

  // Najdi různé formáty href
  const allHrefs = html3.match(/href="[^"]{10,100}"/g) ?? [];
  const carHrefs = allHrefs.filter(
    (h) =>
      h.includes("html") &&
      !h.includes("javascript") &&
      !h.includes("mailto"),
  );
  console.log("Car-like hrefs (první 10):");
  carHrefs.slice(0, 10).forEach((h) => console.log(" ", h));

  // Test současného regexu
  const currentRegex =
    /<a[^>]+href="((?:https?:\/\/[^"]*tipcars\.com)?\/[^"]*-(\d+)\.html)"[^>]*>/gi;
  const currentMatches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = currentRegex.exec(html3)) !== null) {
    currentMatches.push(m[1]);
  }
  console.log("\nSoučasný regex matches:", currentMatches.length);
  console.log("První 3:", currentMatches.slice(0, 3));

  // Test 4: Model-specific URL
  console.log("\n=== TEST 4: Model-specific URL ===");
  const modelUrls = [
    `${TIPCARS_BASE}/skoda-octavia/ojete/`,
    `${TIPCARS_BASE}/volkswagen-golf/ojete/`,
    `${TIPCARS_BASE}/bmw-rada-3/ojete/`,
  ];
  for (const url of modelUrls) {
    try {
      const html = await fetchHtml(url);
      const links = html.match(/href="[^"]*-(\d{6,})\.html"/g) ?? [];
      const ids = links
        .map((l) => l.match(/-(\d{6,})\.html/)?.[1])
        .filter(Boolean);
      const uniqueIds = [...new Set(ids)];
      console.log(`\n${url}`);
      console.log(
        `  html: ${html.length}, links: ${links.length}, unique IDs: ${uniqueIds.length}`,
      );
      console.log(
        `  první 3 IDs: ${uniqueIds.slice(0, 3).join(", ")}`,
      );
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch(console.error);

