-- ============================================================
-- GGG CRM - Initial Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE app_role AS ENUM ('admin', 'coach');
CREATE TYPE lead_source AS ENUM ('website', 'meta_instant_form', 'newsletter', 'referral', 'manual', 'import', 'other');
CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'interested', 'confirmed', 'signed', 'not_interested', 'lost');
CREATE TYPE consent_type AS ENUM ('express', 'inferred', 'none');
CREATE TYPE event_type AS ENUM ('trial', 'training_session', 'trial_game', 'tour', 'camp', 'community_event', 'other');
CREATE TYPE event_status AS ENUM ('draft', 'open', 'full', 'closed', 'completed', 'cancelled');
CREATE TYPE participant_status AS ENUM ('invited', 'contacted', 'confirmed', 'declined', 'waitlisted', 'attended', 'no_show', 'cancelled');
CREATE TYPE assessment_recommendation AS ENUM ('select', 'monitor', 'not_yet');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'part_paid', 'paid', 'overdue', 'void');
CREATE TYPE email_format AS ENUM ('plain', 'html');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'cancelled');
CREATE TYPE message_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'skipped');
CREATE TYPE activity_type AS ENUM (
  'note', 'call', 'sms', 'whatsapp',
  'email_sent', 'email_opened', 'email_clicked', 'email_bounced',
  'status_change', 'stage_change', 'lead_created', 'event_added',
  'checked_in', 'document_uploaded', 'document_requested',
  'invoice_sent', 'payment_recorded', 'assessment_added',
  'unsubscribed', 'rsvp'
);

-- ============================================================
-- updated_at TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLES (in dependency order)
-- ============================================================

-- email_templates (referenced by events)
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  format email_format NOT NULL DEFAULT 'plain',
  body_html text,
  body_text text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'event_invite', 'reminder', 'invoice', 'document_request', 'newsletter')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- profiles (keyed to auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  role app_role NOT NULL DEFAULT 'coach',
  active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- contacts
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  suburb text,
  state text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  marketing_consent consent_type NOT NULL DEFAULT 'inferred',
  unsubscribed_at timestamptz,
  source lead_source,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE UNIQUE INDEX contacts_email_lower_unique ON contacts (LOWER(email)) WHERE email IS NOT NULL;

CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- players
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  dob date,
  birth_year int,
  gender text,
  position text,
  secondary_position text,
  preferred_foot text,
  current_club text,
  level text,
  suburb text,
  state text,
  photo_path text,
  medical_alerts text,
  dietary_notes text,
  eligibility_notes text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'alumni')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE OR REPLACE FUNCTION sync_birth_year()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dob IS NOT NULL THEN
    NEW.birth_year := EXTRACT(YEAR FROM NEW.dob)::int;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER players_sync_birth_year BEFORE INSERT OR UPDATE OF dob ON players
  FOR EACH ROW EXECUTE FUNCTION sync_birth_year();

CREATE TRIGGER players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- events (references email_templates and self)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type event_type NOT NULL,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  venue_name text,
  address text,
  city text,
  country text NOT NULL DEFAULT 'Australia',
  birth_years int[],
  capacity int,
  price_cents int,
  currency text NOT NULL DEFAULT 'AUD',
  status event_status NOT NULL DEFAULT 'draft',
  parent_event_id uuid REFERENCES events(id),
  cover_image_path text,
  reminder_hours_before int,
  reminder_template_id uuid REFERENCES email_templates(id),
  created_by uuid REFERENCES profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- leads (references contacts, players, profiles, events)
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source lead_source NOT NULL,
  form_type text,
  source_detail text,
  external_id text UNIQUE,
  raw jsonb,
  contact_id uuid REFERENCES contacts(id),
  player_id uuid REFERENCES players(id),
  stage lead_stage NOT NULL DEFAULT 'new',
  owner_id uuid REFERENCES profiles(id),
  next_follow_up_at timestamptz,
  interested_event_id uuid REFERENCES events(id),
  submitted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- player_contacts
CREATE TABLE player_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('mother', 'father', 'guardian', 'self', 'other')),
  is_primary bool NOT NULL DEFAULT false,
  is_emergency bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, contact_id)
);

-- event_participants
CREATE TABLE event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id),
  contact_id uuid REFERENCES contacts(id),
  status participant_status NOT NULL DEFAULT 'invited',
  status_updated_at timestamptz,
  source_lead_id uuid REFERENCES leads(id),
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES profiles(id),
  flight_out text,
  flight_return text,
  room text,
  shirt_size text,
  emergency_contact_name text,
  emergency_contact_phone text,
  logistics_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT ep_at_least_one_participant CHECK (player_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE UNIQUE INDEX ep_event_player_uniq ON event_participants(event_id, player_id) WHERE player_id IS NOT NULL;

CREATE TRIGGER event_participants_updated_at BEFORE UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- activities (timeline)
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type activity_type NOT NULL,
  body text,
  meta jsonb,
  contact_id uuid REFERENCES contacts(id),
  player_id uuid REFERENCES players(id),
  lead_id uuid REFERENCES leads(id),
  event_id uuid REFERENCES events(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- tasks
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  notes text,
  due_at timestamptz,
  assigned_to uuid REFERENCES profiles(id),
  done_at timestamptz,
  contact_id uuid REFERENCES contacts(id),
  player_id uuid REFERENCES players(id),
  lead_id uuid REFERENCES leads(id),
  event_id uuid REFERENCES events(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- assessments
CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id),
  event_id uuid NOT NULL REFERENCES events(id),
  assessor_id uuid NOT NULL REFERENCES profiles(id),
  position_played text,
  technical int CHECK (technical BETWEEN 1 AND 10),
  tactical int CHECK (tactical BETWEEN 1 AND 10),
  physical int CHECK (physical BETWEEN 1 AND 10),
  mental int CHECK (mental BETWEEN 1 AND 10),
  overall int CHECK (overall BETWEEN 1 AND 10),
  strengths text,
  improvements text,
  notes text,
  recommendation assessment_recommendation,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER assessments_updated_at BEFORE UPDATE ON assessments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- document_types
CREATE TABLE document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sensitive bool NOT NULL DEFAULT false,
  retention_days_after_event int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER document_types_updated_at BEFORE UPDATE ON document_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- event_document_requirements
CREATE TABLE event_document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES document_types(id),
  required bool NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, document_type_id)
);

-- documents
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id),
  event_id uuid REFERENCES events(id),
  document_type_id uuid NOT NULL REFERENCES document_types(id),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes int,
  expires_on date,
  notes text,
  uploaded_by uuid REFERENCES profiles(id),
  uploaded_via text NOT NULL DEFAULT 'crm' CHECK (uploaded_via IN ('crm', 'parent_link')),
  delete_after date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- document_request_tokens
CREATE TABLE document_request_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_participant_id uuid NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_count int NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- invoices
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  player_id uuid REFERENCES players(id),
  event_id uuid REFERENCES events(id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  subtotal_cents int NOT NULL DEFAULT 0,
  gst_cents int NOT NULL DEFAULT 0,
  total_cents int NOT NULL DEFAULT 0,
  amount_paid_cents int NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  pdf_path text,
  sent_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- invoice_items
CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cents int NOT NULL,
  amount_cents int NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER invoice_items_updated_at BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- payments
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents int NOT NULL,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer', 'cash', 'other')),
  reference text,
  recorded_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- email_campaigns
CREATE TABLE email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  preheader text,
  format email_format NOT NULL DEFAULT 'plain',
  body_html text,
  body_text text,
  from_name text,
  reply_to text,
  audience jsonb,
  event_id uuid REFERENCES events(id),
  include_rsvp bool NOT NULL DEFAULT false,
  status campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  total int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  opened int NOT NULL DEFAULT 0,
  clicked int NOT NULL DEFAULT 0,
  bounced int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- email_attachments
CREATE TABLE email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- email_messages
CREATE TABLE email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id),
  contact_id uuid NOT NULL REFERENCES contacts(id),
  to_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  status message_status NOT NULL DEFAULT 'queued',
  resend_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  player_id uuid REFERENCES players(id),
  event_id uuid REFERENCES events(id),
  invoice_id uuid REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER email_messages_updated_at BEFORE UPDATE ON email_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- posts (blog)
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('News', 'Insights', 'Programs', 'Player Development')),
  tags text[] NOT NULL DEFAULT '{}',
  excerpt text,
  body_html text,
  cover_image_url text,
  author text,
  seo_title text,
  seo_description text,
  published bool NOT NULL DEFAULT false,
  published_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- settings (single row enforced by CHECK id = 1)
CREATE TABLE settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  org_name text NOT NULL DEFAULT 'Ginga Global Group',
  abn text,
  address text,
  phone text,
  email text,
  website text,
  logo_path text,
  bank_account_name text,
  bank_bsb text,
  bank_account_number text,
  payid text,
  gst_registered bool NOT NULL DEFAULT false,
  gst_rate numeric NOT NULL DEFAULT 0.10,
  invoice_prefix text NOT NULL DEFAULT 'GGG-',
  invoice_next_number int NOT NULL DEFAULT 1,
  payment_terms_days int NOT NULL DEFAULT 14,
  invoice_footer text,
  email_from_name text NOT NULL DEFAULT 'Ginga Global Group',
  email_from_address text,
  email_reply_to text,
  email_footer_html text,
  daily_email_cap int NOT NULL DEFAULT 90,
  default_timezone text NOT NULL DEFAULT 'Australia/Sydney',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ingest_field_mappings
CREATE TABLE ingest_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  target text NOT NULL,
  form_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TRIGGER ingest_field_mappings_updated_at BEFORE UPDATE ON ingest_field_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ingest_log
CREATE TABLE ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  external_id text,
  source text,
  form_type text,
  status text NOT NULL CHECK (status IN ('created', 'merged', 'duplicate', 'error')),
  error text,
  lead_id uuid REFERENCES leads(id)
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- public.current_role() - security definer, returns caller's app_role
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND active = true;
$$;

-- next_invoice_number() - atomically increments and returns formatted number
CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_num int;
BEGIN
  UPDATE settings
  SET invoice_next_number = invoice_next_number + 1
  RETURNING invoice_prefix, invoice_next_number - 1 INTO v_prefix, v_num;

  RETURN v_prefix || LPAD(v_num::text, 4, '0');
END;
$$;

-- check_in_participant() - security definer RPC for coach check-in
CREATE OR REPLACE FUNCTION check_in_participant(
  p_participant_id uuid,
  p_status participant_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('attended'::participant_status, 'no_show'::participant_status) THEN
    RAISE EXCEPTION 'Invalid check-in status: %. Must be attended or no_show.', p_status;
  END IF;

  IF public.current_role() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE event_participants
  SET
    status = p_status,
    status_updated_at = now(),
    checked_in_at = CASE WHEN p_status = 'attended'::participant_status THEN now() ELSE checked_in_at END,
    checked_in_by = auth.uid(),
    updated_at = now()
  WHERE id = p_participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;
END;
$$;

-- Trigger: recalculate invoice amount_paid from payments
CREATE OR REPLACE FUNCTION recalculate_invoice_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid int;
  v_total_cents int;
BEGIN
  v_invoice_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_paid
  FROM payments WHERE invoice_id = v_invoice_id;

  SELECT total_cents INTO v_total_cents FROM invoices WHERE id = v_invoice_id;

  UPDATE invoices
  SET
    amount_paid_cents = v_total_paid,
    status = CASE
      WHEN status IN ('draft'::invoice_status, 'void'::invoice_status) THEN status
      WHEN v_total_paid = 0 THEN status
      WHEN v_total_paid >= v_total_cents THEN 'paid'::invoice_status
      ELSE 'part_paid'::invoice_status
    END,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER payments_recalculate_invoice
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_paid();

-- Trigger: auto-create profile row on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::app_role,
      'coach'::app_role
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- COACH VIEWS (SECURITY INVOKER - respects caller's RLS)
-- ============================================================

CREATE OR REPLACE VIEW coach_event_participants
WITH (security_invoker = true)
AS
SELECT
  id,
  event_id,
  player_id,
  contact_id,
  status,
  status_updated_at,
  checked_in_at,
  checked_in_by,
  flight_out,
  flight_return,
  room,
  shirt_size,
  emergency_contact_name,
  emergency_contact_phone,
  logistics_notes,
  notes,
  created_at,
  updated_at
FROM event_participants;

CREATE OR REPLACE VIEW coach_players
WITH (security_invoker = true)
AS
SELECT
  id,
  first_name,
  last_name,
  dob,
  birth_year,
  gender,
  position,
  secondary_position,
  preferred_foot,
  current_club,
  level,
  suburb,
  state,
  photo_path,
  medical_alerts,
  dietary_notes,
  status,
  archived_at,
  created_at
FROM players;

CREATE OR REPLACE VIEW coach_emergency_contacts
WITH (security_invoker = true)
AS
SELECT
  pc.id,
  pc.player_id,
  pc.is_emergency,
  pc.relationship,
  c.first_name,
  c.last_name,
  c.phone
FROM player_contacts pc
JOIN contacts c ON c.id = pc.contact_id
WHERE pc.is_emergency = true;

GRANT SELECT ON coach_event_participants TO authenticated;
GRANT SELECT ON coach_players TO authenticated;
GRANT SELECT ON coach_emergency_contacts TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON profiles FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "self_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "self_update_name" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- contacts (admin full, coach emergency-contacts only)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON contacts FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_emergency_select" ON contacts FOR SELECT TO authenticated
  USING (
    public.current_role() = 'coach' AND
    EXISTS (
      SELECT 1 FROM player_contacts pc
      WHERE pc.contact_id = contacts.id AND pc.is_emergency = true
    )
  );

-- players (admin full, coach select all)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON players FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_select" ON players FOR SELECT TO authenticated
  USING (public.current_role() = 'coach');

-- player_contacts (admin full, coach select)
ALTER TABLE player_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON player_contacts FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_select" ON player_contacts FOR SELECT TO authenticated
  USING (public.current_role() = 'coach');

-- leads (admin only)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON leads FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- events (admin full, coach select)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON events FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_select" ON events FOR SELECT TO authenticated
  USING (public.current_role() = 'coach');

-- event_participants (admin full, coach select)
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON event_participants FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_select" ON event_participants FOR SELECT TO authenticated
  USING (public.current_role() = 'coach');

-- activities (admin only)
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON activities FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- tasks (admin only)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON tasks FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- assessments (admin full, coach select all + insert/update own)
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON assessments FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_select" ON assessments FOR SELECT TO authenticated
  USING (public.current_role() = 'coach');
CREATE POLICY "coach_insert_own" ON assessments FOR INSERT TO authenticated
  WITH CHECK (public.current_role() = 'coach' AND assessor_id = auth.uid());
CREATE POLICY "coach_update_own" ON assessments FOR UPDATE TO authenticated
  USING (public.current_role() = 'coach' AND assessor_id = auth.uid())
  WITH CHECK (public.current_role() = 'coach' AND assessor_id = auth.uid());

-- document_types (admin full, coach select)
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON document_types FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
CREATE POLICY "coach_select" ON document_types FOR SELECT TO authenticated
  USING (public.current_role() = 'coach');

-- event_document_requirements (admin only)
ALTER TABLE event_document_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON event_document_requirements FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- documents (admin only)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON documents FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- document_request_tokens (admin only)
ALTER TABLE document_request_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON document_request_tokens FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- invoices (admin only)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON invoices FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- invoice_items (admin only)
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON invoice_items FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- payments (admin only)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON payments FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- email_templates (admin only)
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON email_templates FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- email_campaigns (admin only)
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON email_campaigns FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- email_attachments (admin only)
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON email_attachments FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- email_messages (admin only)
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON email_messages FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- posts (admin only)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON posts FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- settings (admin only)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON settings FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- ingest_field_mappings (admin only)
ALTER TABLE ingest_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON ingest_field_mappings FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- ingest_log (admin only)
ALTER TABLE ingest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON ingest_log FOR ALL TO authenticated
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('documents', 'documents', false, 15728640),
  ('invoices', 'invoices', false, 10485760),
  ('email-attachments', 'email-attachments', false, 10485760),
  ('player-photos', 'player-photos', false, 5242880),
  ('blog-media', 'blog-media', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
-- documents: admin only (signed URLs generated server-side)
CREATE POLICY "documents_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.current_role() = 'admin')
  WITH CHECK (bucket_id = 'documents' AND public.current_role() = 'admin');

-- invoices: admin only
CREATE POLICY "invoices_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'invoices' AND public.current_role() = 'admin')
  WITH CHECK (bucket_id = 'invoices' AND public.current_role() = 'admin');

-- email-attachments: admin only
CREATE POLICY "email_attachments_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'email-attachments' AND public.current_role() = 'admin')
  WITH CHECK (bucket_id = 'email-attachments' AND public.current_role() = 'admin');

-- player-photos: admin write, coach read (signed URLs for both)
CREATE POLICY "player_photos_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'player-photos' AND public.current_role() = 'admin')
  WITH CHECK (bucket_id = 'player-photos' AND public.current_role() = 'admin');
CREATE POLICY "player_photos_coach_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-photos' AND public.current_role() = 'coach');

-- blog-media: public read (via public bucket), admin write
CREATE POLICY "blog_media_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-media' AND public.current_role() = 'admin');
CREATE POLICY "blog_media_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-media' AND public.current_role() = 'admin')
  WITH CHECK (bucket_id = 'blog-media' AND public.current_role() = 'admin');
CREATE POLICY "blog_media_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blog-media' AND public.current_role() = 'admin');

-- ============================================================
-- SEED DATA
-- ============================================================

-- Settings row (single row)
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Document types
INSERT INTO document_types (name, description, sensitive) VALUES
  ('Consent form', 'Participant consent and waiver form', false),
  ('Medical form', 'Medical information and conditions form', true),
  ('Passport copy', 'Copy of valid passport', true),
  ('Travel insurance', 'Travel insurance certificate', false),
  ('Flight itinerary', 'Flight booking confirmation', false),
  ('Photo release', 'Photography and media release consent', false),
  ('Birth certificate', 'Copy of birth certificate', true),
  ('Other', 'Other document', false);

-- Default email templates (plain, short, on-brand, short hyphens only)
INSERT INTO email_templates (name, subject, format, body_text, category) VALUES
(
  'Event invite',
  'Invitation: {{event_title}}',
  'plain',
  'Hi {{contact_first_name}},

We would like to invite {{player_first_name}} to {{event_title}}.

Date: {{event_date}}
Time: {{event_time}}
Venue: {{event_venue}}

If you have any questions, reply to this email.

Regards,
Ginga Global Group',
  'event_invite'
),
(
  'Trial reminder',
  'Reminder: {{event_title}} is coming up',
  'plain',
  'Hi {{contact_first_name}},

Just a reminder that {{player_first_name}} is registered for {{event_title}}.

Date: {{event_date}}
Time: {{event_time}}
Venue: {{event_venue}}

Please arrive 10 minutes early. Bring appropriate football gear.

See you there,
Ginga Global Group',
  'reminder'
),
(
  'Trial follow-up',
  'Thanks for attending {{event_title}}',
  'plain',
  'Hi {{contact_first_name}},

Thank you for bringing {{player_first_name}} to {{event_title}}. It was great to see them out on the field.

We will be in touch soon with next steps.

Regards,
Ginga Global Group',
  'general'
),
(
  'Document request',
  'Documents required: {{event_title}}',
  'plain',
  'Hi {{contact_first_name}},

We need a few documents from you before {{event_title}}.

Please upload the required documents using the link below. It only takes a few minutes and the link is personal to you.

{{upload_link}}

If you have any trouble, reply to this email.

Thanks,
Ginga Global Group',
  'document_request'
),
(
  'Invoice email',
  'Invoice {{invoice_number}} from Ginga Global Group',
  'plain',
  'Hi {{contact_first_name}},

Please find your invoice attached.

Invoice: {{invoice_number}}
Amount: {{invoice_total}}
Due: {{invoice_due_date}}

Payment details are on the invoice. Please use the invoice number as your payment reference.

Thanks,
Ginga Global Group',
  'invoice'
),
(
  'Newsletter starter',
  'News from Ginga Global Group',
  'plain',
  'Hi {{contact_first_name}},

Welcome to our newsletter. We will keep you updated on trials, programs and news from Ginga Global Group.

If you no longer wish to receive these emails, you can unsubscribe below.

Regards,
Ginga Global Group',
  'newsletter'
);

-- ============================================================
-- SUPABASE CRON JOB (reads CRON_SECRET from Vault)
-- NOTE: Will must insert the secret into Vault FIRST using the
-- SQL in PROGRESS.md before this job will authenticate correctly.
-- ============================================================

SELECT cron.schedule(
  'run-crm-jobs',
  '*/5 * * * *',
  $$
    SELECT extensions.http_post(
      url := 'https://crm.gingaglobalgroup.com/api/cron/run',
      params := '{}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_secret'
          LIMIT 1
        )
      )
    )
  $$
);
