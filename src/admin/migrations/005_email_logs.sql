-- Email Logs table for tracking all email sends
-- Captures success/failure, template usage, and recipient data for reporting

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email text NOT NULL,
  recipient_domain text GENERATED ALWAYS AS (split_part(recipient_email, '@', 2)) STORED,
  template_key text,
  template_category text,
  subject text,
  status text NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
  error_message text,
  smtp_message_id text,
  order_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for report queries
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_key ON email_logs (template_key);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_domain ON email_logs (recipient_domain);

-- RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) gets full access
CREATE POLICY "Service role full access to email_logs" ON email_logs
  FOR ALL USING (true)
  WITH CHECK (true);

-- Admin users can read logs
CREATE POLICY "Admin read access to email_logs" ON email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );
