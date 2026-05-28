-- ============================================================
-- TechFlow Database Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS node_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  node_type VARCHAR(50) NOT NULL DEFAULT 'Process',
  description TEXT DEFAULT '',
  icon VARCHAR(50) DEFAULT '⚙',
  color VARCHAR(20) DEFAULT '#3b82f6',
  default_input_params JSONB DEFAULT '{}',
  default_validation TEXT DEFAULT '',
  default_process_logic TEXT DEFAULT '',
  default_output_template JSONB DEFAULT '{}',
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  version VARCHAR(20) DEFAULT 'v1.0',
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT flows_status_check CHECK (status IN ('active', 'draft', 'archived'))
);

CREATE TABLE IF NOT EXISTS flow_nodes (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES node_templates(id) ON DELETE SET NULL,
  label VARCHAR(255) NOT NULL,
  node_type VARCHAR(50) NOT NULL DEFAULT 'Process',
  icon VARCHAR(50) DEFAULT '⚙',
  color VARCHAR(20) DEFAULT '#3b82f6',
  pos_x FLOAT DEFAULT 0,
  pos_y FLOAT DEFAULT 100,
  input_params JSONB DEFAULT '{}',
  validation_rules TEXT DEFAULT '',
  process_logic TEXT DEFAULT '',
  output_template JSONB DEFAULT '{}',
  condition_expression TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_connections (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  source_node_id INTEGER NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  branch_label VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulations (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  input_data JSONB DEFAULT '{}',
  total_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT simulations_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS node_executions (
  id SERIAL PRIMARY KEY,
  simulation_id INTEGER NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  flow_node_id INTEGER REFERENCES flow_nodes(id) ON DELETE SET NULL,
  node_label VARCHAR(255) NOT NULL,
  node_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'waiting',
  input_data JSONB DEFAULT '{}',
  output_data JSONB,
  message TEXT,
  duration_ms INTEGER,
  executed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_conns_flow ON flow_connections(flow_id);
CREATE INDEX IF NOT EXISTS idx_simulations_flow ON simulations(flow_id);
CREATE INDEX IF NOT EXISTS idx_node_exec_sim ON node_executions(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulations_created ON simulations(created_at DESC);
