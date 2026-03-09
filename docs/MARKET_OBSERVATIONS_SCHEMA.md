# Finální schéma: market_observations

Produkční datový základ pro reálné inzeráty ze Sauto a TipCars. Jedna tabulka, více zdrojů, upsert podle (source, source_listing_id).

---

## Skupiny sloupců

### A. Identita a zdroj
| Sloupec | Typ | Required | Raw/Normalized | Účel |
|---------|-----|----------|----------------|------|
| **id** | uuid | auto | - | PK, default gen_random_uuid(). |
| **source** | text | ano | normalized | Zdroj: `sauto`, `tipcars`. Pro filtry a unique. |
| **source_listing_id** | text | ano | raw | ID inzerátu u zdroje. Unique spolu se source. |
| **source_url** | text | ne | raw | URL inzerátu. Pro odkaz z UI a re-crawl. |

### B. Základní data o vozidle
| Sloupec | Typ | Required | Raw/Normalized | Účel |
|---------|-----|----------|----------------|------|
| **brand** | text | ne | semi-normalized | Značka (zobrazení i pricing). |
| **model** | text | ne | semi-normalized | Model (zobrazení). |
| **model_key** | text | ano | normalized | Klíč pro segmentaci a pricing (např. skoda_octavia). |
| **year** | smallint | ne | normalized | Rok výroby. Pricing, filtry. |
| **mileage_km** | integer | ne | normalized | Nájezd v km. Pricing, filtry. |
| **price_czk** | integer | ano | normalized | Cena v Kč. Jádro pricing. |

### C. Technické parametry
| Sloupec | Typ | Required | Raw/Normalized | Účel |
|---------|-----|----------|----------------|------|
| **fuel** | text | ne | normalized | Palivo: Benzín, Diesel, Hybrid, … |
| **transmission** | text | ne | normalized | Manuál, Automat. |
| **power_kw** | smallint | ne | normalized | Výkon v kW (TipCars). |
| **engine_raw** | text | ne | raw | Surový text motoru/označení. Ingest quality, fallback engine_key. |
| **engine_key** | text | ne | normalized | Klíč pro segmentaci motoru (pricing). |
| **body_type** | text | ne | raw/semi | Karoserie (TipCars). |
| **drivetrain** | text | ne | normalized | Pohon: 4×4, FWD, … (budoucí). |

### D. Raw texty
| Sloupec | Typ | Required | Raw/Normalized | Účel |
|---------|-----|----------|----------------|------|
| **title** | text | ne | raw | Nadpis inzerátu. UI, fallback pro engine. |
| **description** | text | ne | raw | Popis (až bude z detailu). |
| **location** | text | ne | raw | Lokace / region. UI, statistiky. |

### E. Stav a timestamps
| Sloupec | Typ | Required | Raw/Normalized | Účel |
|---------|-----|----------|----------------|------|
| **first_seen_at** | timestamptz | ne | - | První vidění v systému. Neměnit při update. |
| **last_seen_at** | timestamptz | ano | - | Poslední vidění. Při každém ingestu refresh. |
| **active** | boolean | ano | - | true = viděn nedávno; false = stale (cleanup). Pricing jen active = true. |
| **created_at** | timestamptz | auto | - | Vytvoření záznamu. |
| **updated_at** | timestamptz | auto | - | Poslední úprava (application nebo trigger). |

Pole **observed_at** zůstává pro zpětnou kompatibilitu (filtry „za posledních 30 dní“); lze ho rovnat first_seen_at nebo ho postupně nahradit za first_seen_at v kódu.

### F. Pomocné / legacy (minimalizovat)
- **trim**: ponecháno pro zpětnou kompatibilitu; nový kód používá **title**. rebuildPriceIndex může používat title nebo engine_raw místo trim.
- **region**: ponecháno jako alias za location; nový kód zapisuje a čte **location**.

---

## Důležité pole – shrnutí

- **id** – PK.
- **source, source_listing_id** – required, unique; identifikace inzerátu napříč zdroji.
- **source_url** – nullable, raw; odkaz na inzerát.
- **model_key** – required; hlavní segment pro pricing a filtry.
- **brand, model** – semi-normalized; UI a rozšíření model_key.
- **year, mileage_km, price_czk** – jádro pricing; nullable kromě price_czk.
- **fuel, engine_key** – segmentace cen; engine_key preferovaný před engine_raw.
- **engine_raw** – raw; kvalita ingestu a fallback pro engine_key.
- **title, location** – raw; UI a doplňkové filtry.
- **first_seen_at** – pouze při insertu (ne přepisovat při update).
- **last_seen_at, active** – životní cyklus; cleanup nastavuje active = false.
- **created_at, updated_at** – audit.

---

## Indexy (návrh)

- Unique: `(source, source_listing_id)`.
- Indexy: `source`, `model_key`, `brand`, `year`, `mileage_km`, `fuel`, `engine_key`, `active`, `last_seen_at`.
- Složené pro pricing: např. `(model_key, active, last_seen_at)` nebo `(model_key, active, year)` podle typických dotazů (price API filtruje model_key, active, observed_at >= since, year, mileage_km, engine_key, fuel).

Indexy budou v migraci nastaveny tak, aby pokryly tyto dotazy bez zbytečného overengineeringu.
