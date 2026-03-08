-- LEEWAY HEADER BLOCK
-- File: deployments/vercel-memory/schema.sql
-- Purpose: Canonical Vercel Postgres schema for Agent Lee Memory Lake
-- Security: LEEWAY-CORE-2026 compliant
-- Performance: Indexed relational memory for episodes, graph nodes, and learning corpus

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS nodes (
  node_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edges (
  edge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_node UUID REFERENCES nodes(node_id) ON DELETE CASCADE,
  to_node UUID REFERENCES nodes(node_id) ON DELETE CASCADE,
  relation TEXT,
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID REFERENCES nodes(node_id) ON DELETE CASCADE,
  r2_key TEXT,
  mime TEXT,
  size BIGINT,
  checksum TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS episodes (
  episode_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent TEXT,
  analysis TEXT,
  plan JSONB,
  final_answer TEXT,
  confidence FLOAT,
  reward FLOAT,
  source TEXT,
  domain TEXT,
  adapter TEXT,
  execution_mode TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS synthetic_corpus (
  sample_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id UUID REFERENCES episodes(episode_id) ON DELETE SET NULL,
  prompt TEXT,
  response TEXT,
  reward FLOAT,
  variant_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  mission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  priority INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adapters (
  adapter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT,
  path TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  performance_score FLOAT,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embeddings (
  embed_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID REFERENCES nodes(node_id) ON DELETE CASCADE,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_tags ON nodes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_edges_from_to ON edges(from_node, to_node);
CREATE INDEX IF NOT EXISTS idx_episodes_created_at ON episodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_status_priority ON missions(status, priority DESC, created_at ASC);
