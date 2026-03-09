# Model-specific beta seeding

Obecný režim pro budování silných modelových segmentů pro beta test. **Není to hack pro jeden model** – platí pro jakýkoliv deep ingest s explicitním `--brand` a `--model`.

## Princip

- Běží-li **deep ingest** s explicitním `--brand` a `--model` (zdroj/flow je model-specific),
- použije se **canonical model_key z kontextu běhu** jako strong override pro všechny observation z tohoto běhu.
- **Ne** v běžném plošném ingestu (bez brand/model) – tam zůstává čistá inferencia z titulku.

## Kdy se override aplikuje

- `runSautoIngest(supabase, { brand: "volkswagen", model: "passat", pages: 50 })` → všechny řádky z běhu dostanou `model_key = volkswagen_passat`.
- Stejně pro jiné dvojice: `brand + model` → `buildModelKey(brand, model)`.

## Jak používat

### Sauto (runIngest)

```bash
# Passat
npx tsx lib/ingest/runIngest.ts --source=sauto --brand=volkswagen --model=passat --pages=50

# Golf
npx tsx lib/ingest/runIngest.ts --source=sauto --brand=volkswagen --model=golf --pages=50

# Škoda Superb
npx tsx lib/ingest/runIngest.ts --source=sauto --brand=skoda --model=superb --pages=50

# Škoda Fabia
npx tsx lib/ingest/runIngest.ts --source=sauto --brand=skoda --model=fabia --pages=50
```

### Dedikované flow (Passat)

```bash
npx tsx lib/maintenance/runPassatNormalizationFlow.ts --pages=50
```

(Passat flow volá `runSautoIngest` s brand/model, takže override se aplikuje automaticky.)

### Benchmark pro Golf, Superb, Fabia (beta seeding katalog)

```bash
npx tsx lib/maintenance/runModelSpecificBetaSeedingBenchmark.ts
npx tsx lib/maintenance/runModelSpecificBetaSeedingBenchmark.ts --pages=30
```

Spustí deep ingest pro volkswagen_golf, skoda_superb, skoda_fabia (50 stránek každý), report per model a souhrnnou tabulku. Price index se rebuilduje jednou na konci.

### Název režimu

- V kódu: **model-specific deep ingest** (když `options.brand != null && options.model != null`).
- Pro beta data: **model-specific beta seeding** – stejný princip, použití pro budování segmentů.

## Doporučené modely pro beta seeding

| model_key           | Příkaz (brand + model)     |
|---------------------|----------------------------|
| volkswagen_passat   | volkswagen, passat         |
| volkswagen_golf     | volkswagen, golf           |
| skoda_superb        | skoda, superb              |
| skoda_fabia         | skoda, fabia               |

Běžný globální ingest **neměň** – ten nebere `--brand`/`--model`, takže override se nepoužije.
