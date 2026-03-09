# Implementace: finální schéma market_observations

## C – Shrnutí změn

### SQL migrace
- **Soubor:** `supabase/migrations/20250308100000_finalize_market_observations_schema.sql`
- **Obsah:**
  - Pro zelené pole: `CREATE TABLE market_observations` se všemi sloupci (id, source, source_listing_id, source_url, brand, model, model_key, year, mileage_km, price_czk, fuel, transmission, power_kw, engine_raw, engine_key, body_type, drivetrain, title, description, location, trim, region, observed_at, first_seen_at, last_seen_at, active, created_at, updated_at).
  - Pro existující DB: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pro source_url, title, description, location, body_type, power_kw, drivetrain, first_seen_at, created_at, updated_at (a případně chybějící trim, region, observed_at, engine_raw, engine_key, last_seen_at, active).
  - Backfill: first_seen_at z observed_at, location z region, title z trim, created_at/updated_at.
  - Trigger: před UPDATE nastaví `updated_at = now()` a `first_seen_at = COALESCE(OLD.first_seen_at, NEW.first_seen_at)`.
  - Unique constraint: `(source, source_listing_id)`.
  - Indexy: source, model_key, brand, year, mileage_km, fuel, engine_key, active, last_seen_at, (active, last_seen_at), (model_key, active) WHERE active = true.

### Upravené soubory

| Soubor | Změna |
|--------|--------|
| **lib/ingest/types.ts** | NormalizedVehicleObservation: přidány power_kw, body_type, drivetrain, description; v komentáři rozlišení raw vs normalized. |
| **lib/ingest/normalizeObservation.ts** | RawObservationInput rozšířen o power_kw, body_type, drivetrain, description; normalizeObservation je doplňuje. |
| **lib/ingest/saveObservations.ts** | toDbRow zapisuje source_url, title, description, location, body_type, power_kw, drivetrain, first_seen_at; odstraněn zápis do region (zapisuje se location). Fallback loop používá typované source/sourceListingId. |
| **lib/ingest/tipcars/mapTipcarsToObservation.ts** | Do RawObservationInput doplněny power_kw, body_type, drivetrain, description z TipcarsParsedListing. |
| **lib/ingest/ingestSautoSingle.ts** | MarketObservationInsert: přidány location, source_url, title. Row z listingu: trim = listing.title, location = listing.region, source_url = listing.url, title = listing.title. |
| **lib/pricing/rebuildPriceIndex.ts** | MarketObservationRow: přidány title, engine_raw. Select bere i title, engine_raw. deriveEngineBucket používá engine_raw a title (a trim) jako fallback text. |
| **app/api/deal/route.ts** | Select přidán sloupec location; typ obs rozšířen o location. V odpovědi listing.region = obs.location ?? obs.region. |

### Co nebylo měněno
- Pricing logika (výpočty, buckety) – jen kompatibilita se schématem (select title/engine_raw, location).
- UI design.
- backfillEngineKeys / backfillMarketObservationNormalization – stále používají trim a případně sloupec „engine“; při použití pouze engine_raw je třeba je upravit zvlášť.

### Raw vs normalized (přehled)
- **Raw:** source_url, title, description, location, engine (→ engine_raw v DB).
- **Normalized:** model_key, brand, model, fuel, transmission, engine_key.
- **Číselně normalizované:** year, mileage_km, price_czk, power_kw.

Po nasazení migrace a tohoto kódu ingest ze Sauto a TipCars ukládá data do jednotné tabulky s (source, source_listing_id), first_seen_at / last_seen_at, location, title, source_url a volitelnými body_type, power_kw, drivetrain připravenými pro pricing a další rozšíření.
