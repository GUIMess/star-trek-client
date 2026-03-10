CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  canon_weight NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  canon_tier TEXT NOT NULL DEFAULT 'screen',
  threat_level TEXT,
  diplomatic_posture TEXT,
  era TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  profile JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  UNIQUE (entity_id, alias)
);

CREATE TABLE IF NOT EXISTS facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  value_text TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 50,
  confidence NUMERIC(4,2) NOT NULL DEFAULT 0.80
);

CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  relation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 50,
  confidence NUMERIC(4,2) NOT NULL DEFAULT 0.80
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  era_label TEXT NOT NULL,
  sort_key INTEGER NOT NULL,
  headline TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias_lower ON entity_aliases(LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_facts_entity_id ON facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source_entity ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target_entity ON relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entity_sort ON timeline_events(entity_id, sort_key);
