# Passat normalizace – dry-run report

## Změny (co se po úpravě změní)

### 1. Model-specific deep ingest (hlavní fix)

| Situace | Před | Po |
|--------|------|-----|
| Běh ingest s `brand=volkswagen`, `model=passat` | `model_key` = výsledek normalizace z title (často bez "Passat" → např. volkswagen_2_0) | `model_key` = **volkswagen_passat** pro všechny řádky z tohoto běhu |

**Důvod:** Na Sauto stránce pro Passat může být v titulku např. jen "Volkswagen 2.0 TDI" – parser dá model = "2.0", normalizace nedá passat. Protože crawl byl cílený na Passat, všechny listingy z této stránky dostanou cílový model_key.

### 2. Rozšíření aliasů (passat b7)

| Pattern / title sample | Current output model_key | Proposed output model_key |
|------------------------|--------------------------|---------------------------|
| model = "Passat B7", title obsahuje "Passat B7" | volkswagen_passat_b7 (nebo buildModelKey fallback) | **volkswagen_passat** |
| model = "Passat", "Passat Variant", "Passat B8" | volkswagen_passat | volkswagen_passat (beze změny) |

**Přidaný alias:** `passat b7` v `modelAliases.ts` pod `passat`.

### 3. Co zůstalo oddělené (záměrně)

- **Passat Alltrack** – nesléváme do volkswagen_passat (může být cenově jinde).
- Ostatní VW modely (Golf, Tiguan, …) – beze změny.

---

## Jak ověřit po úpravě

1. **Audit (včetně posledních řádků):**
   ```bash
   npx tsx lib/maintenance/auditPassatOutputModelKeys.ts --source=sauto
   ```
   Sekce (3) ukáže poslední řádky podle `last_seen_at` – po novém Passat crawl by měly být nové Passaty pod `volkswagen_passat`.

2. **Spustit Passat deep ingest a zkontrolovat počet:**
   ```bash
   npx tsx lib/maintenance/runPassatNormalizationFlow.ts --pages=2
   ```
   Po běhu by měl počet uložených Passatů (v funnelu / v DB pod volkswagen_passat) odpovídat počtu listingů z crawl (všechny pod volkswagen_passat).

3. **Backfill (volitelně) pro varianty typu passat_b8 / passat_variant:**
   ```bash
   npx tsx lib/maintenance/backfillPassatModelKey.ts --dry-run
   npx tsx lib/maintenance/backfillPassatModelKey.ts --apply
   ```

4. **Kvalita a pricing:**
   ```bash
   npx tsx lib/ingest/runIngest.ts --source=sauto --quality-model=volkswagen_passat
   ```
   Ověřit, že `total_rows` a `pricing_ready_rows` pro volkswagen_passat rostou.

---

## Model-specific override (beta seeding)

Při deep ingest s `--brand` a `--model` se všem řádkům z běhu nastaví cílový model_key z kontextu; neplatí v plošném ingestu. Viz **MODEL_SPECIFIC_BETA_SEEDING.md**.
