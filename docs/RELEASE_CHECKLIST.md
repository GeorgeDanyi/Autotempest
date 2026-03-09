# Release Checklist

## 1) Build
- Run `npm run build` in repo root.
- Confirm build exits with code `0`.

## 2) Smoke Test
- Homepage quick search -> `/analyze` works.
- Homepage filters (brand -> model -> apply) work.
- `/analyze` segment editor keeps URL/UI/API in sync.
- Invalid URL/range states do not crash UI.

## 3) Env Vars
- Verify Supabase envs are present in runtime:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server/admin paths)
- Confirm production env matches intended project.

## 4) Supabase Sanity
- `GET /api/analyze/filter-options` returns `ok: true`.
- `modelKeyToBrand` is consistent with `modelsByBrand`.
- No obvious cross-brand model mapping anomalies.

## 5) Ingest Sanity
- Trigger one small ingest run for each active source.
- Confirm rows are saved without spike in errors.
- Confirm `/api/price` returns non-empty data for at least one known segment.

## 6) Rollback Basics
- Keep previous deploy artifact/version ready.
- Confirm rollback command/process is documented in deployment platform.
- Confirm DB migrations (if any) are backward-safe before deploy.

## 7) Post-Release Monitoring
- Watch 5xx/error rate on API routes:
  - `/api/price`
  - `/api/deal`
  - `/api/analyze/filter-options`
- Watch client-side error events (`autotempest:client-issue`).
- Spot-check key pages after deploy: `/` and `/analyze`.
