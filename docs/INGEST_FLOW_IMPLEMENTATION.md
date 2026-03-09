# Implementace: sjednocený ingest flow (krok 2)

## A. Stručný audit (před změnami)

- **Sauto:** fetch list → parse → pro každý listing vlastní upsert (upsertMarketObservationFromParsedListing). Nepoužíval normalizeObservation ani saveObservations. Při update se měnilo jen last_seen_at, active, engine_raw.
- **TipCars:** fetch list → parse → enrich (detail) → map → normalize → saveObservations → quality summary. Jednotný model.
- **Nekonzistence:** Dva způsoby zápisu; různé quality summary (Sauto bez pricing_ready, TipCars s usable_for_pricing); saveObservations nevracel inserted/updated; cleanup bez filtru podle source.

Viz **docs/INGEST_FLOW_AUDIT.md**.

---

## B. Co bylo sjednoceno / doplněno

1. **Jednotný mentální model pro oba zdroje**  
   A. fetch list pages → B. parse list items → C. fetch detail (jen TipCars) → D. parse detail → E. merge list + detail → F. normalize do NormalizedVehicleObservation → G. saveObservations() → H. quality summary → I. pricing-ready v summary.

2. **Sauto převeden na stejný flow**  
   Sauto nyní: runSautoFetchAndParse (fetch + parse, bez zápisu) → mapSautoToObservation → normalizeObservation → saveObservations. Žádný vlastní upsert v hlavním běhu.

3. **Lifecycle**  
   - Nový záznam: saveObservations nastaví first_seen_at (observed_at), last_seen_at, active = true; trigger v DB nepřepisuje first_seen_at při update.  
   - Znovu nalezený: upsert aktualizuje last_seen_at, active a všechna pole (kromě first_seen_at).  
   - Stale: cleanupInactiveListings(source?, staleDays, deleteAfterDays?) označí neviděné X dní jako active = false, volitelně smaže starší záznamy.

4. **Pricing-ready**  
   - isObservationPricingReady(obs): vyžaduje model_key, price_czk, year, mileage_km (platné hodnoty).  
   - getIngestQualitySummary(supabase, source): total, pricing_ready_count, pricing_ready_ratio, missing_*, top_brands, top_models, top_engine_keys.  
   - Stejný formát pro Sauto i TipCars (logIngestQualitySummary).

5. **inserted / updated**  
   saveObservations vrací { saved, skipped, inserted, updated }. Před upsertem se načtou existující (source, source_listing_id) a po upsertu se z toho spočítají inserted a updated.

6. **Cleanup helper**  
   cleanupInactiveListings(supabase, { source?, staleDays?, deleteAfterDays? }) – označí inactive, volitelně smaže; lze omezit na jeden source.

---

## C. Konkrétní změny

### Nové soubory
- **lib/ingest/pricingReady.ts** – isObservationPricingReady(obs), missingPricingRequiredCount(obs).
- **lib/ingest/ingestQualitySummary.ts** – getIngestQualitySummary(supabase, source), logIngestQualitySummary(summary), typ IngestQualitySummary.
- **lib/ingest/sauto/mapSautoToObservation.ts** – mapSautoToObservation(listing) → RawObservationInput.
- **lib/maintenance/cleanupInactiveListings.ts** – cleanupInactiveListings(supabase, options), CLI s --source, --stale-days, --delete-after-days.
- **docs/INGEST_FLOW_AUDIT.md** – audit stavu před úpravami.
- **docs/INGEST_FLOW_IMPLEMENTATION.md** – tento dokument.

### Upravené soubory
- **lib/ingest/saveObservations.ts** – vrací inserted, updated; před upsertem načte existující (source, source_listing_id) pro každý source v dávce.
- **lib/ingest/ingestSautoBulk.ts** – přidán runSautoFetchAndParse(options) (pouze fetch + parse, vrací uniqueListings); runSautoBulkIngest používá runSautoFetchAndParse a dál per-row upsert (pro přímé volání skriptu).
- **lib/ingest/sources/sauto.ts** – runSautoIngest(supabase): runSautoFetchAndParse → filter (min cena, brand, model) → mapSautoToObservation → normalizeObservation → saveObservations → getIngestQualitySummary + log. Vrací saved, inserted, updated, errors.
- **lib/ingest/sources/tipcars.ts** – používá getIngestQualitySummary a logIngestQualitySummary místo getTipcarsQualitySummary; vrací inserted, updated.
- **lib/ingest/runIngest.ts** – odstraněn getSautoQualitySummary; loguje saved, new (inserted), updated pro oba zdroje.

### Jak spustit ingest
```bash
# Všechny zdroje (sauto + tipcars), pak rebuildPriceIndex
npm run ingest

# Jen jeden zdroj
npx tsx lib/ingest/runIngest.ts --source=sauto
npx tsx lib/ingest/runIngest.ts --source=tipcars
```

### Jak spustit cleanup
```bash
# Označit inactive (last_seen_at starší než 7 dní), všechny zdroje
npx tsx lib/maintenance/cleanupInactiveListings.ts

# Jen Sauto, interval 7 dní
npx tsx lib/maintenance/cleanupInactiveListings.ts --source=sauto --stale-days=7

# Označit inactive 7 dní + smazat starší 30 dní
npx tsx lib/maintenance/cleanupInactiveListings.ts --stale-days=7 --delete-after-days=30
```

### Jak ověřit pricing_ready_count v DB
- Po ingestu se v konzoli vypíše quality summary včetně `pricing_ready_count` a `pricing_ready_ratio` pro daný source.
- V SQL (Supabase):
```sql
SELECT source, COUNT(*) AS pricing_ready_count
FROM market_observations
WHERE model_key IS NOT NULL AND model_key != ''
  AND price_czk IS NOT NULL AND price_czk > 0
  AND year IS NOT NULL
  AND mileage_km IS NOT NULL
GROUP BY source;
```

### Zápis do schématu (oba zdroje)
- Oba procházejí NormalizedVehicleObservation a saveObservations, tedy zapisují stejné sloupce: source, source_listing_id, source_url, title, model_key, brand, model, price_czk, year, mileage_km, fuel, transmission, power_kw, engine_raw, engine_key, body_type, drivetrain, location, description, observed_at, first_seen_at, last_seen_at, active.
- Sauto z listu nemá: power_kw, body_type, drivetrain, description (zůstávají null). TipCars má power_kw a body_type z detailu; description zatím null.
