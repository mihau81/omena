-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0004: All new features (consolidated)
-- Settings, Artists, Settlements, Push, Timer, Search, Condition Reports,
-- Multi-currency, Livestream, Categories, PDF Catalog
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── New ENUM types ─────────────────────────────────────────────────────────

CREATE TYPE "condition_grade" AS ENUM ('mint', 'excellent', 'very_good', 'good', 'fair', 'poor');
CREATE TYPE "settlement_status" AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE "lot_category" AS ENUM (
  'malarstwo', 'rzezba', 'grafika', 'fotografia',
  'rzemiosto', 'design', 'bizuteria', 'inne'
);

-- Add 'condition' to existing media_type enum
ALTER TYPE "media_type" ADD VALUE IF NOT EXISTS 'condition';

-- ─── Settings table ─────────────────────────────────────────────────────────

CREATE TABLE "settings" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key"         varchar(100) NOT NULL UNIQUE,
  "value"       text NOT NULL DEFAULT '',
  "category"    varchar(50) NOT NULL,
  "label"       varchar(200) NOT NULL,
  "description" text DEFAULT '',
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_by"  uuid REFERENCES "admins"("id")
);

CREATE INDEX "settings_category_idx" ON "settings" ("category");
CREATE INDEX "settings_key_idx" ON "settings" ("key");

-- ─── Artists table ──────────────────────────────────────────────────────────

CREATE TABLE "artists" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug"        varchar(255) NOT NULL UNIQUE,
  "name"        varchar(255) NOT NULL,
  "nationality" varchar(100),
  "birth_year"  integer,
  "death_year"  integer,
  "bio"         text,
  "image_url"   text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  "deleted_at"  timestamptz
);

CREATE INDEX "artists_slug_idx" ON "artists" ("slug");
CREATE INDEX "artists_name_idx" ON "artists" ("name");
CREATE INDEX "artists_deleted_at_idx" ON "artists" ("deleted_at");

-- ─── Settlements tables ─────────────────────────────────────────────────────

CREATE TABLE "settlements" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "consignor_id"      uuid NOT NULL REFERENCES "consignors"("id"),
  "auction_id"        uuid NOT NULL REFERENCES "auctions"("id"),
  "total_hammer"      integer NOT NULL DEFAULT 0,
  "commission_amount" integer NOT NULL DEFAULT 0,
  "net_payout"        integer NOT NULL DEFAULT 0,
  "status"            "settlement_status" NOT NULL DEFAULT 'pending',
  "paid_at"           timestamptz,
  "bank_reference"    text,
  "notes"             text DEFAULT '',
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "updated_at"        timestamptz NOT NULL DEFAULT now(),
  "created_by"        uuid REFERENCES "admins"("id")
);

CREATE INDEX "settlements_consignor_idx" ON "settlements" ("consignor_id");
CREATE INDEX "settlements_auction_idx" ON "settlements" ("auction_id");
CREATE INDEX "settlements_status_idx" ON "settlements" ("status");

CREATE TABLE "settlement_items" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "settlement_id"     uuid NOT NULL REFERENCES "settlements"("id"),
  "lot_id"            uuid NOT NULL REFERENCES "lots"("id"),
  "hammer_price"      integer NOT NULL,
  "commission_rate"   numeric(5,4) NOT NULL,
  "commission_amount" integer NOT NULL
);

CREATE INDEX "settlement_items_settlement_idx" ON "settlement_items" ("settlement_id");
CREATE INDEX "settlement_items_lot_idx" ON "settlement_items" ("lot_id");

-- ─── Push subscriptions table ───────────────────────────────────────────────

CREATE TABLE "push_subscriptions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint"   text NOT NULL UNIQUE,
  "p256dh"     text NOT NULL,
  "auth"       text NOT NULL,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "push_subs_user_idx" ON "push_subscriptions" ("user_id");
CREATE INDEX "push_subs_endpoint_idx" ON "push_subscriptions" ("endpoint");

-- ─── Auctions table alterations ─────────────────────────────────────────────

ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "livestream_url" text;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "catalog_pdf_url" text;

-- ─── Lots table alterations ─────────────────────────────────────────────────

ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "closing_at" timestamptz;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "timer_duration" integer DEFAULT 120;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "condition_grade" "condition_grade";
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "category" "lot_category";
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "artist_id" uuid REFERENCES "artists"("id");

CREATE INDEX IF NOT EXISTS "lots_category_idx" ON "lots" ("category");
CREATE INDEX IF NOT EXISTS "lots_artist_id_idx" ON "lots" ("artist_id");

-- ─── Users table alterations ────────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_currency" varchar(3) DEFAULT 'PLN';

-- ─── Full-text search (tsvector + trigram) ──────────────────────────────────

-- Drop old generated search_vector column if it exists (from 0002_search_index.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE lots DROP COLUMN search_vector;
  END IF;
END;
$$;

DROP INDEX IF EXISTS idx_lots_search_vector;
DROP INDEX IF EXISTS idx_lots_search_vector_visibility;

-- Add search_vector as a trigger-maintained column
ALTER TABLE lots ADD COLUMN search_vector tsvector;

CREATE INDEX idx_lots_search_vector ON lots USING GIN(search_vector);
CREATE INDEX idx_lots_title_trgm ON lots USING GIN(title gin_trgm_ops);
CREATE INDEX idx_lots_artist_trgm ON lots USING GIN(artist gin_trgm_ops);

-- Trigger: auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION lots_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.artist, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lots_search_vector_trigger ON lots;
CREATE TRIGGER lots_search_vector_trigger
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION lots_search_vector_update();

-- Backfill existing lots
UPDATE lots SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(artist, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B');
