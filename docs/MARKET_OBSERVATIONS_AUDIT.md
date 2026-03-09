# Audit: market_observations – aktuální stav

## 1. Aktuální schéma (odvozené z migrací a kódu)

Tabulka `market_observations` nemá v repozitáři inicializační `CREATE TABLE`; vznikla pravděpodobně ručně nebo v jiném repu. Z migrací a použití v kódu vyplývají tyto sloupce:

| Sloupec | Typ (odhad) | Zdroj | Poznámka |
|---------|-------------|--------|----------|
| id | (PK) | implicitní | |
| source | text | migrace unique | sauto, tipcars |
| source_listing_id | text | migrace unique | ID inzerátu u zdroje |
| brand | text | ingest | |
| model | text | ingest | |
| model_key | text | ingest | normalizovaný (brand_model) |
| trim | text | ingestSautoSingle, rebuildPriceIndex | Sauto: title jako trim |
| fuel | text | ingest | |
| transmission | text | ingest | |
| engine_raw | text | add_engine_raw_column, ingest | surový text motoru |
| engine_key | text | migrace 20250306 | normalizovaný klíč motoru |
| year | int | ingest | |
| mileage_km | int | ingest | |
| price_czk | int/numeric | ingest | |
| region | text | saveObservations (mapováno z location) | |
| observed_at | timestamptz/date | ingest | první záznam / den |
| observed_day | text | ingestSautoSingle | YYYY-MM-DD, legacy |
| last_seen_at | timestamptz | migrace 20250305 | refresh při každém ingestu |
| active | boolean | migrace 20250305 | false když >7 dní neviděn |
| title | text? | backfillEngineKeys | ne vždy zapisován |
| engine | text? | backfillEngineKeys (select) | starý název? |

**Chybí v DB (pouze v typech / zdrojích):** source_url, first_seen_at, created_at, updated_at, description, body_type, power_kw, drivetrain, location (místo toho je region).

**Komentář v saveObservations:** „Sloupce source_url a title v aktuálním schématu nemusí existovat – zapisujeme jen pole, která market_observations má.“  
→ saveObservations aktuálně **nezapisuje** source_url ani title.

---

## 2. Co používá ingest

### saveObservations (TipCars + jednotný normalizovaný vstup)
- Zapisuje: source, source_listing_id, model_key, brand, model, price_czk, year, mileage_km, fuel, transmission, **engine_raw** (z obs.engine), engine_key, **region** (z obs.location), observed_at, last_seen_at, active.
- Nezapisuje: source_url, title.

### ingestSautoSingle / ingestSautoBulk (Sauto)
- Vlastní upsert: existuje → update pouze last_seen_at, active, engine_raw; jinak insert celého řádku.
- Insert obsahuje: source, brand, model, model_key, **trim** (listing.title), fuel, transmission, engine_key, engine_raw, year, mileage_km, price_czk, **region**, source_listing_id, observed_at, observed_day, last_seen_at, active.
- Nezapisuje: title, source_url (v insertu není).

### mapTipcarsToObservation → normalizeObservation → saveObservations
- TipCars posílá: source_url, title, body_type, power_kw (v parseTipcarsListing), ale **mapTipcarsToObservation je neposílá** do RawObservationInput (typ je nemá). Do DB se tedy nedostanou body_type ani power_kw.

---

## 3. Co používá pricing API (price/route, rebuildPriceIndex)

- **price/route.ts:** select `price_czk, source`; filtry: model_key, active, observed_at >= since, year, mileage_km, engine_key, fuel.
- **rebuildPriceIndex.ts:** select `model_key, price_czk, year, mileage_km, fuel, trim, engine_key`; filtry: active, observed_at >= since.  
  - **trim** se používá v `deriveEngineBucket()` jako fallback při chybějícím engine_key (kombinace fuel + trim).
- **modelYearRange, modelBrandValid:** select year resp. brand podle model_key.

---

## 4. Co používá analyze / UI

- **filter-options/route.ts:** select `brand, model_key, model` z market_observations.
- **deal/route.ts:** select `price_czk, brand, model, model_key, year, mileage_km, fuel, transmission, region, observed_at`.
- **mileage-scatter/route.ts:** select `mileage_km, price_czk, year, engine_key, fuel`.
- **admin/recent-listings:** select `source, source_listing_id, model_key, price_czk, year, mileage_km, observed_at`.

---

## 5. Rozpor a nekonzistence

| Problém | Detail |
|--------|--------|
| region vs location | Typ má `location`, saveObservations mapuje na `region`. Deal/route a další čtou `region`. |
| title vs trim | Sauto ukládá nadpis jako `trim`, TipCars má `title` v typu ale saveObservations title neukládá. |
| first_seen_at chybí | Pouze observed_at a last_seen_at; první vidění není explicitní. |
| source_url chybí | V typu je, do DB se nezapisuje. |
| title se nezapisuje | saveObservations title neposílá; backfillEngineKeys předpokládá title v DB. |
| body_type, power_kw | TipCars je má v parsed listing, ale neprocházejí do NormalizedVehicleObservation ani do DB. |
| created_at / updated_at | Chybí. |
| trim v rebuildPriceIndex | Používá trim pro engine bucket fallback; pokud bude jen title, je třeba použít title nebo engine_raw. |
| Dva ingest cesty | Sauto: ingestSautoSingle (vlastní upsert, trim, region). TipCars: saveObservations (region, bez title/source_url). Unifikace až po finálním schématu. |

---

## 6. Raw vs normalizované (aktuální stav)

- **Raw (ze zdroje):** title (ne v DB), engine_raw, region/location, popis (není).
- **Normalizované:** model_key, brand (částečně), fuel, transmission, engine_key.
- **Polo-normalizované:** model, year, mileage_km, price_czk (číselně normalizované, sémanticky ze zdroje).

Po finální úpravě bude v dokumentu schématu explicitně uvedeno, které pole je raw a které normalized.
