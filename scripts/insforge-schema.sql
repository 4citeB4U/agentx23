-- ============================================================
-- Agent Lee Sovereign OS — InsForge Postgres Schema
-- LEEWAY-CORE-2026 Compliant
-- InsForge Backend: https://3c4cp27v.us-west.insforge.app
-- Generated: 2026-02-21
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: agent_memory  (Layer 19 — WorldMemory)
-- Long-term cross-session knowledge store
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_memory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain          TEXT NOT NULL,
  concept         TEXT NOT NULL,
  content         TEXT NOT NULL,
  confidence      FLOAT DEFAULT 0.5,
  source_task_id  UUID,
  tags            TEXT[] DEFAULT '{}',
  access_count    INT DEFAULT 0,
  last_accessed   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_domain ON agent_memory(domain);
CREATE INDEX IF NOT EXISTS idx_agent_memory_concept ON agent_memory(concept);

-- ============================================================
-- TABLE: episodes  (Layer 20 — EpisodeLogger)
-- Every meaningful action as a structured episode
-- ============================================================
CREATE TABLE IF NOT EXISTS episodes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp         TIMESTAMPTZ DEFAULT NOW(),
  domain            TEXT NOT NULL,
  intent            TEXT NOT NULL,
  actions_taken     JSONB DEFAULT '[]',
  tools_used        TEXT[] DEFAULT '{}',
  success           BOOLEAN DEFAULT FALSE,
  mistakes          JSONB DEFAULT '[]',
  reward_score      FLOAT,
  register_mode     TEXT,
  emotion_detected  TEXT,
  layers_active     INT[] DEFAULT '{}',
  voice_event_id    UUID,
  task_id           UUID,
  parent_episode_id UUID,
  metadata          JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_episodes_domain ON episodes(domain);
CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp);
CREATE INDEX IF NOT EXISTS idx_episodes_success ON episodes(success);

-- ============================================================
-- TABLE: mistake_registry  (Layer 22 — MistakeRegistry)
-- Pattern-indexed failure prevention
-- ============================================================
CREATE TABLE IF NOT EXISTS mistake_registry (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id      TEXT UNIQUE NOT NULL,
  description     TEXT NOT NULL,
  domain          TEXT NOT NULL,
  root_cause      TEXT,
  fix_strategy    TEXT,
  frequency       INT DEFAULT 1,
  last_seen       TIMESTAMPTZ DEFAULT NOW(),
  resolved        BOOLEAN DEFAULT FALSE,
  episode_ids     UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mistake_registry_domain ON mistake_registry(domain);
CREATE INDEX IF NOT EXISTS idx_mistake_registry_pattern ON mistake_registry(pattern_id);

-- ============================================================
-- TABLE: success_patterns  (Layer 25 — SuccessPatternLibrary)
-- Verified solution templates with confidence scores
-- ============================================================
CREATE TABLE IF NOT EXISTS success_patterns (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id        TEXT UNIQUE NOT NULL,
  domain            TEXT NOT NULL,
  solution_template TEXT NOT NULL,
  conditions        JSONB DEFAULT '[]',
  confidence        FLOAT DEFAULT 0.5,
  use_count         INT DEFAULT 0,
  last_used         TIMESTAMPTZ,
  episode_ids       UUID[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_success_patterns_domain ON success_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_success_patterns_confidence ON success_patterns(confidence DESC);

-- ============================================================
-- TABLE: cross_domain_patterns  (Layer 26 — CrossDomainMapper)
-- Abstract problem → generalized solution across industries
-- ============================================================
CREATE TABLE IF NOT EXISTS cross_domain_patterns (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id           TEXT UNIQUE NOT NULL,
  domains              TEXT[] NOT NULL,
  abstract_problem     TEXT NOT NULL,
  general_solution     TEXT NOT NULL,
  similarity_threshold FLOAT DEFAULT 0.75,
  success_rate         FLOAT DEFAULT 0.5,
  use_count            INT DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cross_domain_patterns_domains ON cross_domain_patterns USING GIN(domains);

-- ============================================================
-- TABLE: call_transcripts  (Layer 34 — TelephonyBridge)
-- Every phone call record
-- ============================================================
CREATE TABLE IF NOT EXISTS call_transcripts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id      UUID REFERENCES episodes(id),
  caller_id       TEXT,
  caller_history  JSONB DEFAULT '{}',
  direction       TEXT CHECK(direction IN ('inbound', 'outbound')),
  transcript      TEXT NOT NULL,
  intent_detected TEXT,
  tasks_extracted JSONB DEFAULT '[]',
  duration_secs   INT,
  call_outcome    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_caller ON call_transcripts(caller_id);

-- ============================================================
-- TABLE: email_campaigns  (Layer 36 — EmailCampaignEngine)
-- Campaign records and performance data
-- ============================================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name    TEXT NOT NULL,
  research_doc_id  UUID,
  audience_segment JSONB DEFAULT '{}',
  subject_line     TEXT,
  body_content     TEXT,
  send_count       INT DEFAULT 0,
  open_count       INT DEFAULT 0,
  click_count      INT DEFAULT 0,
  reply_count      INT DEFAULT 0,
  status           TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sent', 'analyzing')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: adapter_performance  (Layer 24 — AdapterRouter)
-- Per-domain adapter accuracy tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS adapter_performance (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adapter_name TEXT NOT NULL,
  domain       TEXT NOT NULL,
  task_count   INT DEFAULT 0,
  success_rate FLOAT DEFAULT 0.5,
  avg_latency  FLOAT,
  avg_reward   FLOAT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_adapter_performance_unique ON adapter_performance(adapter_name, domain);

-- ============================================================
-- TABLE: voice_events  (Layer 33 — VoiceStateMachine)
-- Every voice narration event
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID,
  episode_id  UUID REFERENCES episodes(id),
  state       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  tts_engine  TEXT,
  duration_ms INT,
  success     BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_events_task ON voice_events(task_id);

-- ============================================================
-- TABLE: task_queue  (Layer 11 — ParallelNavigator)
-- Parallel task graph engine
-- ============================================================
CREATE TABLE IF NOT EXISTS task_queue (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                 TEXT NOT NULL CHECK(type IN ('research', 'build', 'phone', 'email', 'analysis', 'learning')),
  priority             INT DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
  dependencies         UUID[] DEFAULT '{}',
  status               TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'paused', 'completed', 'failed')),
  linked_memory_ids    UUID[] DEFAULT '{}',
  linked_notebook_entries UUID[] DEFAULT '{}',
  voice_summary        TEXT,
  research_doc_id      UUID,
  reward_score         FLOAT,
  context_capsule      JSONB DEFAULT '{}',
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority DESC);

-- ============================================================
-- TABLE: research_documents  (Layer 27 — ResearchEngine)
-- Structured research output per domain + task
-- ============================================================
CREATE TABLE IF NOT EXISTS research_documents (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id              UUID REFERENCES task_queue(id),
  domain               TEXT NOT NULL,
  domain_summary       TEXT,
  architectural_models TEXT[],
  risk_patterns        TEXT[],
  edge_cases           TEXT[],
  recommended_stack    TEXT[],
  confidence_score     FLOAT,
  web_search_used      BOOLEAN DEFAULT FALSE,
  sources              JSONB DEFAULT '[]',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_research_docs_domain ON research_documents(domain);

-- ============================================================
-- TABLE: telemetry_events  (Layer 47 — Telemetry)
-- System observability metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type           TEXT NOT NULL,
  layer_id             INT,
  task_id              UUID,
  latency_ms           INT,
  success              BOOLEAN,
  error_message        TEXT,
  reward_score         FLOAT,
  register_mode        TEXT,
  metadata             JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_layer ON telemetry_events(layer_id);

-- ============================================================
-- TABLE: evolution_proposals  (Layer 50 — SelfEvolutionEngine)
-- Architecture improvement proposals pending human review
-- ============================================================
CREATE TABLE IF NOT EXISTS evolution_proposals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_type   TEXT NOT NULL,
  description     TEXT NOT NULL,
  evidence        JSONB DEFAULT '{}',
  affected_layers INT[] DEFAULT '{}',
  risk_level      TEXT CHECK(risk_level IN ('low', 'medium', 'high')),
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'implemented')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
