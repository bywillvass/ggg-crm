-- Log every email sent through the CRM, including quick emails to addresses
-- that aren't contacts, and record where each one came from.

ALTER TABLE email_messages ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE email_messages
  ADD COLUMN source text NOT NULL DEFAULT 'campaign'
    CHECK (source IN ('campaign', 'quick', 'one_off', 'test', 'reminder', 'document_request')),
  ADD COLUMN to_name text,
  ADD COLUMN from_address text,
  ADD COLUMN reply_to text,
  ADD COLUMN sent_by uuid REFERENCES profiles(id);

-- Backfill source for existing rows
UPDATE email_messages SET source = 'test' WHERE campaign_id IS NULL AND subject LIKE '[TEST]%';
UPDATE email_messages SET source = 'document_request' WHERE campaign_id IS NULL AND source = 'campaign' AND subject LIKE 'Documents required -%';
UPDATE email_messages SET source = 'one_off' WHERE campaign_id IS NULL AND source = 'campaign';

CREATE INDEX IF NOT EXISTS email_messages_created_at_idx ON email_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_source_idx ON email_messages (source);
