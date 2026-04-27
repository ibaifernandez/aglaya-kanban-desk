-- Migration: Create digest_logs table for audit trail
-- Purpose: Persistent logging of all digest send attempts (success/failure)
-- Created: 2026-04-27

CREATE TABLE IF NOT EXISTS digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('admin', 'user')),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_msg text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indices for common queries
CREATE INDEX idx_digest_logs_created_at ON digest_logs(created_at DESC);
CREATE INDEX idx_digest_logs_type_status ON digest_logs(type, status);
CREATE INDEX idx_digest_logs_user_id ON digest_logs(user_id);
CREATE INDEX idx_digest_logs_recipient ON digest_logs(recipient);

-- Row-Level Security (RLS)
ALTER TABLE digest_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only superadmin can read all logs
CREATE POLICY digest_logs_superadmin_read ON digest_logs
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'superadmin'
  );

-- Policy: Admins can read logs (wider than superadmin for transparency)
CREATE POLICY digest_logs_admin_read ON digest_logs
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'superadmin')
  );

-- Policy: Service role can insert (for digest functions)
CREATE POLICY digest_logs_service_insert ON digest_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update (for status transitions)
CREATE POLICY digest_logs_service_update ON digest_logs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON digest_logs TO authenticated;
GRANT INSERT, UPDATE ON digest_logs TO service_role;

COMMENT ON TABLE digest_logs IS 'Audit trail for all digest send attempts (admin + user digests)';
COMMENT ON COLUMN digest_logs.type IS 'Type of digest: admin (platform stats) or user (personal tasks)';
COMMENT ON COLUMN digest_logs.status IS 'Send status: sent (success), failed (error), pending (queued)';
COMMENT ON COLUMN digest_logs.error_msg IS 'Error message if status=failed, null otherwise';
