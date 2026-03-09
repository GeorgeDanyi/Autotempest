# Audit: aktuální ingest flow (před sjednocením – krok 2)

## 1. runIngest.ts
- Spouští zdroje (sauto, tipcars) podle `--source` filtru.
- Po každém zdroji volal `getSautoQualitySummary` jen pro Sauto; TipCars logoval quality uvnitř.
- Na závěr volá `rebuildPriceIndex`.
- **Problém:** Dva odlišné způsoby quality summary; žádné inserted/updated.

## 2. saveObservations.ts
- Přijímá `NormalizedVehicleObservation[]`, mapuje na DB řádek, upsert podle `(source, source_listing_id)`.
- Životní cyklus: `first_seen_at` = observed_at (při insertu), trigger v DB nepřepisuje; `last_seen_at` = now, `active` = true při každém upsertu.
- **Problém:** Nevracel inserted vs updated (jen saved, skipped).

## 3. sources/sauto.ts (před úpravou)
- Volal pouze `runSautoBulkIngest({ brands: true, pages: 3 })`.
- `runSautoBulkIngest` si sám bral `getSupabaseAdmin()` a pro každý listing volal `upsertMarketObservationFromParsedListing` (vlastní upsert, ne saveObservations).
- **Problém:** Sauto neprocházel normalizeObservation ani saveObservations; jiný zápis než TipCars (jiná pole při update, žádný společný model).

## 4. sources/tipcars.ts
- Fetch list → parse list → enrich (detail) → mapTipcarsToObservation → normalizeObservation → saveObservations → getTipcarsQualitySummary, logTipcarsQualitySummary.
- **Hotové:** Kroky A–H; chybělo pouze sjednocení quality summary a vrácení inserted/updated.

## 5. Sauto list/detail pipeline
- **List:** fetchSautoPages (URL po značkách) → parseSautoList(html) → SautoParsedListing[].
- **Detail:** Nepoužívá se v bulk; pouze v ingestSautoSingle / deal route pro jeden inzerát (ingestSautoDetail).
- **Uložení:** Původně upsertMarketObservationRow (existuje → update jen last_seen_at, active, engine_raw; jinak insert celého řádku včetně trim, region, observed_day).
- **Problém:** Žádný detail krok v bulk; zápis přes vlastní insert/update, ne přes NormalizedVehicleObservation.

## 6. TipCars list/detail pipeline
- **List:** fetchTipcarsListings → parseTipcarsListPages → TipcarsParsedListing[].
- **Detail:** enrichTipcarsListings pro každý listing (fetch detail, parseTipcarsDetail, merge do listingu).
- **Uložení:** mapTipcarsToObservation → normalizeObservation → saveObservations.
- **Hotové:** Jednotný model až do DB.

## 7. Nekonzistence mezi Sauto a TipCars
| Aspekt | Sauto (před) | TipCars |
|--------|---------------|---------|
| Zápis | upsertMarketObservationFromParsedListing (vlastní) | saveObservations |
| Normalizace | buildModelKey + normalizeModelKey v ingestSautoSingle | normalizeObservation |
| Při update | Jen last_seen_at, active, engine_raw | Celý řádek (všechna pole) |
| first_seen_at | Nebyl nastavován (DB default/trigger) | saveObservations posílá observed_at jako first_seen_at |
| Quality summary | getSautoQualitySummary (jiný tvar) | getTipcarsQualitySummary (usable_for_pricing, top_brands, …) |
| inserted/updated | inserted vs skippedExisting | Jen saved |

## 8. Lifecycle
- **Nový inzerát:** Oba zdroje nastavují active = true; first_seen_at při insertu (saveObservations nebo trigger).
- **Znovu nalezený:** Sauto pouze refresh last_seen_at + active (+ engine_raw); TipCars přepisuje celý řádek (lepší data).
- **Stale cleanup:** cleanupStaleListings (7 dní → active = false; 30 dní → delete). Chyběla možnost filtru podle source a konfigurovatelného intervalu.

## 9. Pricing-ready
- TipCars: getTipcarsQualitySummary měl `usable_for_pricing` (model_key + price_czk + year + mileage_km not null).
- Sauto: getSautoQualitySummary neměl ekvivalent.
- Nebyl společný helper isObservationPricingReady(obs).

## 10. Shrnutí
- **Hotové:** TipCars má kompletní flow včetně detailu a saveObservations; Sauto má fetch+parse a per-row upsert.
- **Nekonzistentní:** Způsob zápisu (Sauto vlastní, TipCars saveObservations); tvar quality summary; chybějící inserted/updated.
- **Chybějící:** Jednotný quality summary pro oba zdroje; pricing-ready helper; Sauto přes normalize + saveObservations; cleanup helper s filtrem source a intervalem.
