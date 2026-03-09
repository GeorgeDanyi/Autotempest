import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeDeal } from "@/lib/pricing/dealScore";
import { computeNegotiation } from "@/lib/pricing/negotiation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ingestSautoDetail } from "@/lib/ingest/ingestSautoDetail";
import {
  ALL_YEAR_BUCKETS,
  bucketForYear,
  bucketForMileage,
  composeBucket,
  type Bucket,
  type MileageBucket,
} from "@/lib/pricing/buckets";

export const runtime = "nodejs";

function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing env");
  return createClient(url, anon, { auth: { persistSession: false } });
}

function percentileCont(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) {
    throw new Error("percentileCont called with empty array");
  }
  if (n === 1) {
    return sorted[0];
  }

  const index = (n - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export async function GET(req: NextRequest) {
  try {
    const urlObj = new URL(req.url);
    const { searchParams } = urlObj;

    const source = searchParams.get("source") ?? "sauto";
    const source_listing_id = searchParams.get("source_listing_id");
    const bucketParam = searchParams.get("bucket");

    if (!source_listing_id) {
      return NextResponse.json(
        { ok: false, error: "Missing source_listing_id" },
        { status: 400 },
      );
    }

    if (source !== "sauto") {
      return NextResponse.json(
        { ok: false, error: "Unsupported source" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAnon();

    // 1) Najdi poslední observation pro listing (nejnovější)
    const obsRes = await supabase
      .from("market_observations")
      .select(
        "price_czk, brand, model, model_key, year, mileage_km, fuel, transmission, location, region, observed_at",
      )
      .eq("source", source)
      .eq("source_listing_id", source_listing_id)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (obsRes.error) {
      return NextResponse.json(
        { ok: false, error: obsRes.error.message },
        { status: 500 },
      );
    }

    let obs = obsRes.data as
      | {
          price_czk: number | null;
          brand: string | null;
          model: string | null;
          model_key: string | null;
          year: number | null;
          mileage_km: number | null;
          fuel: string | null;
          transmission: string | null;
          location: string | null;
          region: string | null;
          observed_at: string;
        }
      | null;

    if (!obs) {
      const detailResult = await ingestSautoDetail({ source_listing_id });

      if (!detailResult.ok) {
        const status = detailResult.status;
        if (status === 429 || status === 403) {
          return NextResponse.json(
            {
              ok: false,
              status: "pending",
              source,
              source_listing_id,
              error: "Rate limited, retry soon",
            },
            { status: 202 },
          );
        }
        if (status === 504) {
          return NextResponse.json(
            {
              ok: false,
              status: "pending",
              source,
              source_listing_id,
              error: "Timeout, retry",
            },
            { status: 202 },
          );
        }
        if (status === 404) {
          return NextResponse.json(
            {
              ok: false,
              error: "Listing not found",
            },
            { status: 404 },
          );
        }

        return NextResponse.json(
          {
            ok: false,
            error: "Listing could not be fetched",
          },
          { status: 500 },
        );
      }

      const retryObs = await supabase
        .from("market_observations")
        .select(
          "price_czk, brand, model, model_key, year, mileage_km, fuel, transmission, location, region, observed_at",
        )
        .eq("source", source)
        .eq("source_listing_id", source_listing_id)
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (retryObs.error) {
        return NextResponse.json(
          { ok: false, error: retryObs.error.message },
          { status: 500 },
        );
      }

      obs = (retryObs.data as typeof obs) ?? null;

      if (!obs) {
        return NextResponse.json(
          {
            ok: false,
            error: "Listing could not be fetched",
          },
          { status: 500 },
        );
      }
    }
    const observation = obs;
    const observationModelKey = observation.model_key?.trim() ?? null;

    // 1) Určení bucketu:
    // - pokud query param bucket existuje -> použij ho
    // - jinak:
    //   yearBucket = bucketForYear(obs.year)
    //   mileageBucket = bucketForMileage(obs.mileage_km)
    //   pokud yearBucket === "unknown_year" -> bucket = "all"
    //   jinak bucket = composeBucket({ yearBucket, mileageBucket })
    let yearBucket: Bucket;
    let bucket: string;

    if (bucketParam) {
      bucket = bucketParam;
      const [yearPart] = bucketParam.split("__");
      const isYearBucket = ALL_YEAR_BUCKETS.includes(yearPart as (typeof ALL_YEAR_BUCKETS)[number]);
      yearBucket = yearPart === "all" || isYearBucket ? (yearPart as Bucket) : "all";
    } else {
      const inferredYear = bucketForYear(observation.year);
      if (inferredYear === "unknown_year") {
        yearBucket = "all";
        bucket = "all";
      } else {
        yearBucket = inferredYear;
        const mileageBucket: MileageBucket = bucketForMileage(observation.mileage_km);
        bucket = composeBucket({ yearBucket, mileageBucket });
      }
    }

    // 2) Najdi price index pro model_key + bucket v cache, s fallbacky na yearBucket a "all"
    if (!observationModelKey) {
      return NextResponse.json({
        ok: true,
        source,
        source_listing_id,
        bucket,
        listing: {
          brand: observation.brand,
          model: observation.model,
          model_key: observation.model_key,
          price_czk: observation.price_czk,
          year: observation.year,
          mileage_km: observation.mileage_km,
          fuel: observation.fuel,
          transmission: observation.transmission,
          region: observation.location ?? observation.region,
          observed_at: observation.observed_at,
        },
        market: null,
        negotiation: null,
        deal_score: null,
        deal_label: "unknown",
      });
    }
    let attemptedIndex = false;
    let sampleSize30d: number | null = null;
    async function fetchIndexForBucket(b: string) {
      const res = await supabase
        .from("price_index_cache")
        .select(
          "model_key, median_price_czk, p25_price_czk, p75_price_czk, sample_size, min_price_czk, max_price_czk",
        )
        .eq("model_key", observationModelKey)
        .eq("bucket", b)
        .limit(1)
        .maybeSingle();

      if (res.error) {
        console.error("price_index_cache error", res.error.message, "bucket", b);
        return null;
      }

      return res.data as
        | {
            model_key: string;
            median_price_czk: number;
            p25_price_czk: number;
            p75_price_czk: number;
            sample_size: number;
            min_price_czk: number;
            max_price_czk: number;
          }
        | null;
    }

    let idx = await fetchIndexForBucket(bucket);

    if (!idx) {
      const yearOnlyBucket =
        yearBucket === "all" || yearBucket === "unknown_year" ? null : (yearBucket as string);

      if (yearOnlyBucket && yearOnlyBucket !== bucket) {
        idx = await fetchIndexForBucket(yearOnlyBucket);
      }

      if (!idx && bucket !== "all" && yearOnlyBucket !== "all") {
        idx = await fetchIndexForBucket("all");
      }
    }

    // 3) Pokud index není ani po fallback lookupu, zkus ho spočítat on-the-fly
    if (!idx) {
      try {
        const admin = getSupabaseAdmin();

        const now = new Date();
        const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sinceIso = since.toISOString();

        attemptedIndex = true;

        const { data: pricesData, error: pricesError } = await admin
          .from("market_observations")
          .select("price_czk")
          .eq("model_key", observationModelKey)
          .gte("observed_at", sinceIso);

        if (!pricesError && pricesData) {
          const prices = (pricesData as { price_czk: number | null }[])
            .map((r) => r.price_czk)
            .filter((v): v is number => v != null && Number.isFinite(v));

          prices.sort((a, b) => a - b);

          const sample_size = prices.length;
          sampleSize30d = sample_size;

          if (sample_size >= 1) {
            let p25_price_czk: number;
            let median_price_czk: number;
            let p75_price_czk: number;
            let min_price_czk: number;
            let max_price_czk: number;

            if (sample_size >= 3) {
              p25_price_czk = percentileCont(prices, 0.25);
              median_price_czk = percentileCont(prices, 0.5);
              p75_price_czk = percentileCont(prices, 0.75);
              min_price_czk = prices[0];
              max_price_czk = prices[prices.length - 1];
            } else if (sample_size === 2) {
              const a = prices[0];
              const b = prices[1];
              min_price_czk = a;
              max_price_czk = b;
              p25_price_czk = a;
              p75_price_czk = b;
              median_price_czk = Math.round((a + b) / 2);
            } else {
              // sample_size === 1
              const a = prices[0];
              min_price_czk = a;
              max_price_czk = a;
              p25_price_czk = a;
              p75_price_czk = a;
              median_price_czk = a;
            }

            const computed_at = new Date().toISOString();

            idx = {
              model_key: observationModelKey,
              median_price_czk,
              p25_price_czk,
              p75_price_czk,
              sample_size,
              min_price_czk,
              max_price_czk,
            };

            // best-effort cache write (nepřerušíme response, když selže)
            await admin
              .from("price_index_cache")
              .upsert(
                [
                  {
                    model_key: observationModelKey,
                    bucket,
                    sample_size,
                    median_price_czk,
                    p25_price_czk,
                    p75_price_czk,
                    min_price_czk,
                    max_price_czk,
                    computed_at,
                  },
                ],
                { onConflict: "model_key,bucket" },
              );
          }
        }
      } catch (e) {
        // fallback níže vrátí unknown
        console.error("on-the-fly price index computation failed", e);
      }
    }

    // Pokud ani po on-the-fly výpočtu nemáme index, vrať listing bez marketu
    if (!idx) {
      return NextResponse.json({
        ok: true,

        source,
        source_listing_id,
        bucket,

        listing: {
          brand: observation.brand,
          model: observation.model,
          model_key: observation.model_key,
          price_czk: observation.price_czk,
          year: observation.year,
          mileage_km: observation.mileage_km,
          fuel: observation.fuel,
          transmission: observation.transmission,
          region: observation.location ?? observation.region,
          observed_at: observation.observed_at,
        },

        market: null,
        negotiation: null,

        deal_score: null,
        deal_label: "unknown",
      });
    }

    // 4) Deal score + label
    const { deal_score, deal_label } = computeDeal({
      price_czk: observation.price_czk,
      p25_price_czk: idx.p25_price_czk,
      median_price_czk: idx.median_price_czk,
      p75_price_czk: idx.p75_price_czk,
      sample_size: idx.sample_size,
    });

    // 5) Negotiation range (jen když market != null, tj. máme idx)
    const negotiation = computeNegotiation({
      median_price_czk: idx.median_price_czk,
      p25_price_czk: idx.p25_price_czk,
      p75_price_czk: idx.p75_price_czk,
    });

    return NextResponse.json({
      ok: true,

      source,
      source_listing_id,
      bucket,

      listing: {
        brand: observation.brand,
        model: observation.model,
        model_key: observation.model_key,
        price_czk: observation.price_czk,
        year: observation.year,
        mileage_km: observation.mileage_km,
        fuel: observation.fuel,
        transmission: observation.transmission,
        region: observation.location ?? observation.region,
        observed_at: observation.observed_at,
      },

      market: {
        median_price_czk: idx.median_price_czk,
        p25_price_czk: idx.p25_price_czk,
        p75_price_czk: idx.p75_price_czk,
        sample_size: idx.sample_size,
        min_price_czk: idx.min_price_czk,
        max_price_czk: idx.max_price_czk,
      },

      negotiation,

      deal_score,
      deal_label,
    });
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    const status = msg === "Missing env" ? 500 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

