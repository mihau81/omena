-- Full-text search index for lots table
-- This migration should be applied when the database is live
-- It adds a generated tsvector column and a GIN index for efficient searching

-- Add generated tsvector column to lots table
-- Combines title, artist, description, provenance, and exhibitions
-- Uses 'simple' configuration for Polish text support
ALTER TABLE lots ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(artist, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(provenance::text, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE(exhibitions::text, '')), 'D')
  ) STORED;

-- Create GIN index for efficient full-text search queries
CREATE INDEX idx_lots_search_vector ON lots USING GIN(search_vector);

-- Optional: Create additional index on search_vector with visibility for faster filtered searches
CREATE INDEX idx_lots_search_vector_visibility ON lots(visibility_override, deleted_at) INCLUDE (search_vector)
  WHERE deleted_at IS NULL;

-- Note: The 'simple' configuration was chosen because:
-- 1. It works well with Polish text without requiring custom Polish stemming dictionaries
-- 2. It's more predictable than language-specific configurations in multilingual contexts
-- 3. For Polish-specific stemming, install pg_catalog.polish after verifying PostgreSQL version
--    and use: to_tsvector('polish', ...) instead of 'simple'
