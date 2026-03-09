-- Přidání sloupce engine_raw pro ukládání surového textu motoru/technického označení.
-- Spusť v Supabase SQL Editoru nebo přes migrace.
ALTER TABLE market_observations
ADD COLUMN IF NOT EXISTS engine_raw text;
