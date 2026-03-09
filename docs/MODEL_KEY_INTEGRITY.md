# Model / model_key integrita

## Root cause

1. **Sauto (parse list):** Title se dělil jen prvním mezerou: `title.split(/\s+/)` → `brand = parts[0]`, `model = parts[1]`.  
   U víceslovných značek tak vznikal špatný split:  
   „Land Rover Discovery“ → brand = „Land“, model = „Rover“ (místo brand = „Land Rover“, model = „Discovery“).  
   Z toho pak vznikl `model_key = buildModelKey("Land", "Rover") = "land_rover"` – tedy jen značka, bez modelu.

2. **TipCars (URL path):** Z path segmentu typu `land-rover-discovery` se bralo:  
   `parts[0]` = „land“ → brand „Land“, `parts.slice(1).join("-")` = „rover-discovery“ → model „Rover Discovery“.  
   Druhá část názvu značky (Rover) tak končila v modelu a celý „Rover Discovery“ byl považován za model.

3. **Mercedes-Benz, Alfa Romeo:** Stejný princip – první slovo jako brand, zbytek jako model, takže `model_key` mohl skončit jako `mercedes_benz` nebo rozbitý model.

Řešení: před použitím „první slovo = brand, zbytek = model“ se kontroluje, jestli začátek textu (nebo URL segmentů) neodpovídá **víceslovné značce**. Pokud ano, jako brand se bere celá tato značka a zbytek textu/segmentů jako model.

---

## Upravené / nové soubory

| Soubor | Změna |
|--------|--------|
| **lib/cars/multiWordBrands.ts** | Nový: `splitTitleIntoBrandAndModel(title)`, `splitUrlPathIntoBrandAndModel(segments)`, `isModelLikelyBrandSuffix(brand, model)`. Seznam víceslovných značek: land_rover, mercedes_benz, alfa_romeo. |
| **lib/ingest/sauto/parseListPage.ts** | Před fallbackem (parts[0]/parts[1]) volá `splitTitleIntoBrandAndModel(title)`; při shodě použije brand + model odtud. |
| **lib/ingest/tipcars/parseTipcarsListing.ts** | V `brandModelFromUrlPath` volá `splitUrlPathIntoBrandAndModel(parts)`; při shodě vrátí brand + model odtud. |
| **lib/ingest/validateModelKey.ts** | Nový: `validateModelKey(brand, model, model_key)` – kontroluje model_key == brand_key, brand-only, model = část značky; při problému loguje warning. |
| **lib/ingest/sauto/mapSautoToObservation.ts** | Po výpočtu model_key volá `validateModelKey(brandDisplay, model, model_key)`. |
| **lib/ingest/tipcars/mapTipcarsToObservation.ts** | Stejně: volá `validateModelKey` po výpočtu model_key. |
| **lib/maintenance/auditModelKeyIntegrity.ts** | Nový: audit nad market_observations – hledá model_key == brand_key, brand-only, model = přípona značky; report po brand/model/model_key/count. |
| **lib/maintenance/repairModelKeyIntegrity.ts** | Nový: repair řádků kde model_key == brand_key nebo je brand-only; nastaví model_key = `brand_key_unknown`, model = null. Dry-run default, `--apply` zapíše. |

---

## Jak spustit audit

```bash
cd autotempest
npx tsx lib/maintenance/auditModelKeyIntegrity.ts
```

Výstup: počet prošlých řádků, souhrn po typech problému (`by_issue`), seznam podezřelých kombinací `brand | model | model_key | count | issue`.

---

## Jak spustit repair

```bash
# Jen výpis, co by se změnilo (počet řádků, rozpad po brand_key)
npx tsx lib/maintenance/repairModelKeyIntegrity.ts

# Zápis do DB: model_key → brand_key_unknown, model → null
npx tsx lib/maintenance/repairModelKeyIntegrity.ts --apply
```

Repair mění jen řádky, kde `model_key` je rovno `normalizeBrandKey(brand)` nebo je to „brand-only“ klíč (land_rover, bmw, mercedes_benz atd.). U takových řádků nastaví `model_key = "<brand_key>_unknown"` a `model = null`.

---

## Jak ověřit výsledek v DB

```sql
-- Po repair by neměly zůstat řádky, kde model_key = brand_key (např. land_rover při brand Land Rover)
SELECT brand, model, model_key, COUNT(*)
FROM market_observations
WHERE model_key = LOWER(REPLACE(REPLACE(TRIM(brand), ' ', '_'), '-', '_'))
   OR model_key IN ('land_rover', 'bmw', 'mercedes_benz')
GROUP BY brand, model, model_key;

-- Očekávané po repair: model_key u těchto značek bude *_unknown (land_rover_unknown atd.)
SELECT model_key, COUNT(*) FROM market_observations WHERE model_key LIKE '%_unknown' GROUP BY model_key;
```

---

## Normalizace při ingestu

- **Sauto:** Před splitem titulku se volá `splitTitleIntoBrandAndModel(title)`. Pokud začátek titulku odpovídá víceslovné značce (Land Rover, Mercedes-Benz, Alfa Romeo), použije se její display a zbytek řetězce jako model. Jinak zůstane původní logika (první slovo = brand, druhé = model).
- **TipCars:** V `brandModelFromUrlPath` se z segmentů path (např. `["land","rover","discovery"]`) nejdřív zkusí `splitUrlPathIntoBrandAndModel(parts)`. Pokud prefix odpovídá víceslovné značce, vrátí se její display a zbytek segmentů jako model (např. Land Rover + Discovery). Jinak se použije původní rozdělení (první segment = brand, zbytek = model).
- Po sestavení `model_key` v mapperech (Sauto/TipCars) se volá `validateModelKey(brand, model, model_key)` – při detekci problému se loguje warning (model_key == brand_key, brand-only, model = přípona značky).
