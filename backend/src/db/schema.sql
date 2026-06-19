-- Vendor Risk360 — PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (internal KVB staff)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN (
    'vendor_management_officer','risk_manager','compliance_officer',
    'business_owner','information_security','auditor','system_administrator'
  )),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  email VARCHAR(255),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(50),
  category VARCHAR(100) CHECK (category IN (
    'technology_cloud','it_products_software','financial_fintech',
    'outsourcing_data','professional_services','facilities_operations'
  )),
  criticality VARCHAR(20) CHECK (criticality IN ('high','medium','low')),
  status VARCHAR(50) DEFAULT 'intake_received' CHECK (status IN (
    'intake_received','under_classification','under_due_diligence',
    'under_assessment','pending_approval','active','under_review',
    'pending_reapproval','renewal_pending','suspended',
    'offboarding_initiated','offboarded','rejected'
  )),
  overall_risk_score DECIMAL(5,2),
  risk_rating VARCHAR(20),
  owner_id UUID REFERENCES users(id),
  contract_start_date DATE,
  contract_end_date DATE,
  contract_value DECIMAL(15,2),
  auto_renewal BOOLEAN DEFAULT false,
  description TEXT,
  service_description TEXT,
  incorporation_country VARCHAR(100),
  years_in_operation INTEGER,
  employee_count INTEGER,
  annual_revenue DECIMAL(15,2),
  health_status VARCHAR(10) DEFAULT 'green' CHECK (health_status IN ('green','amber','red')),
  classification_confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor portal users
CREATE TABLE IF NOT EXISTS vendor_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk scores per domain
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  cybersecurity_score DECIMAL(5,2),
  operational_score DECIMAL(5,2),
  compliance_score DECIMAL(5,2),
  financial_score DECIMAL(5,2),
  reputational_score DECIMAL(5,2),
  overall_score DECIMAL(5,2),
  risk_rating VARCHAR(20),
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  scored_by UUID REFERENCES users(id)
);

-- Questionnaire responses
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  domain VARCHAR(50),
  question_key VARCHAR(255) NOT NULL,
  question_text TEXT NOT NULL,
  answer VARCHAR(20) CHECK (answer IN ('compliant','partially_compliant','non_compliant','na')),
  notes TEXT,
  is_regulatory_tagged BOOLEAN DEFAULT false,
  regulatory_ref VARCHAR(100),
  answered_at TIMESTAMPTZ,
  review_cycle INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vendor_id, question_key)
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  valid_from DATE,
  valid_until DATE,
  is_mandatory BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  uploaded_by_vendor BOOLEAN DEFAULT true,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Findings
CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  finding_ref VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) CHECK (severity IN ('high','medium','low')),
  domain VARCHAR(50),
  status VARCHAR(30) DEFAULT 'raised' CHECK (status IN (
    'raised','assigned','in_progress','evidence_submitted','verified','closed'
  )),
  is_regulatory BOOLEAN DEFAULT false,
  regulatory_ref VARCHAR(100),
  assigned_to UUID REFERENCES users(id),
  target_date DATE,
  closed_at TIMESTAMPTZ,
  evidence_notes TEXT,
  linked_question_key VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  workflow_type VARCHAR(50) CHECK (workflow_type IN (
    'new_vendor_assessment','periodic_review','remediation',
    'renewal','non_compliance_escalation','offboarding'
  )),
  status VARCHAR(30) DEFAULT 'in_progress' CHECK (status IN (
    'in_progress','pending_approval','approved','rejected','completed','on_hold'
  )),
  current_stage VARCHAR(100),
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail (append-only)
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id),
  user_id UUID REFERENCES users(id),
  vendor_user_id UUID REFERENCES vendor_users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-contractors (fourth-party)
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  service_provided TEXT,
  geography VARCHAR(100),
  has_kvb_data_access BOOLEAN DEFAULT false,
  criticality_to_vendor VARCHAR(20),
  data_outside_india BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI summaries/analyses
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) CHECK (analysis_type IN (
    'document_summary','gap_identification','risk_summary',
    'mitigation_recommendation','audit_frequency','concentration_alert','pattern_detection'
  )),
  input_context TEXT,
  ai_output TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','edited','rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  document_id UUID REFERENCES documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  vendor_user_id UUID REFERENCES vendor_users(id),
  vendor_id UUID REFERENCES vendors(id),
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial admin user (password: Admin@123)
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@kvbank.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'System Administrator',
  'system_administrator'
) ON CONFLICT (email) DO NOTHING;

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER findings_updated_at BEFORE UPDATE ON findings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Ensure finding_ref unique constraint exists (safe to run multiple times)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'findings_finding_ref_key'
  ) THEN
    ALTER TABLE findings ADD CONSTRAINT findings_finding_ref_key UNIQUE (finding_ref);
  END IF;
END $$;
