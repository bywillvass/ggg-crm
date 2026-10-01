-- Performance indexes for all frequently queried columns.
-- Without these every query is a full table scan.

-- leads
CREATE INDEX IF NOT EXISTS leads_archived_at_idx ON leads (archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads (stage);
CREATE INDEX IF NOT EXISTS leads_owner_id_idx ON leads (owner_id);
CREATE INDEX IF NOT EXISTS leads_contact_id_idx ON leads (contact_id);
CREATE INDEX IF NOT EXISTS leads_player_id_idx ON leads (player_id);

-- contacts
CREATE INDEX IF NOT EXISTS contacts_archived_at_idx ON contacts (archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_last_name_idx ON contacts (last_name);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (email);
CREATE INDEX IF NOT EXISTS contacts_marketing_consent_idx ON contacts (marketing_consent);

-- players
CREATE INDEX IF NOT EXISTS players_archived_at_idx ON players (archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS players_last_name_idx ON players (last_name);
CREATE INDEX IF NOT EXISTS players_status_idx ON players (status);
CREATE INDEX IF NOT EXISTS players_birth_year_idx ON players (birth_year);

-- events
CREATE INDEX IF NOT EXISTS events_start_at_idx ON events (start_at);
CREATE INDEX IF NOT EXISTS events_archived_at_idx ON events (archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS events_status_idx ON events (status);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type);

-- event_participants
CREATE INDEX IF NOT EXISTS event_participants_event_id_idx ON event_participants (event_id);
CREATE INDEX IF NOT EXISTS event_participants_player_id_idx ON event_participants (player_id);
CREATE INDEX IF NOT EXISTS event_participants_contact_id_idx ON event_participants (contact_id);
CREATE INDEX IF NOT EXISTS event_participants_status_idx ON event_participants (status);

-- activities
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_lead_id_idx ON activities (lead_id);
CREATE INDEX IF NOT EXISTS activities_contact_id_idx ON activities (contact_id);
CREATE INDEX IF NOT EXISTS activities_player_id_idx ON activities (player_id);

-- tasks
CREATE INDEX IF NOT EXISTS tasks_done_at_idx ON tasks (done_at) WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON tasks (due_at);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_lead_id_idx ON tasks (lead_id);
CREATE INDEX IF NOT EXISTS tasks_contact_id_idx ON tasks (contact_id);
CREATE INDEX IF NOT EXISTS tasks_player_id_idx ON tasks (player_id);

-- invoices
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_contact_id_idx ON invoices (contact_id);
CREATE INDEX IF NOT EXISTS invoices_player_id_idx ON invoices (player_id);
CREATE INDEX IF NOT EXISTS invoices_event_id_idx ON invoices (event_id);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices (created_at DESC);

-- posts
CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts (slug);
CREATE INDEX IF NOT EXISTS posts_published_idx ON posts (published);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);

-- assessments
CREATE INDEX IF NOT EXISTS assessments_player_id_idx ON assessments (player_id);
CREATE INDEX IF NOT EXISTS assessments_event_id_idx ON assessments (event_id);
CREATE INDEX IF NOT EXISTS assessments_assessor_id_idx ON assessments (assessor_id);
CREATE INDEX IF NOT EXISTS assessments_created_at_idx ON assessments (created_at DESC);

-- player_contacts
CREATE INDEX IF NOT EXISTS player_contacts_player_id_idx ON player_contacts (player_id);
CREATE INDEX IF NOT EXISTS player_contacts_contact_id_idx ON player_contacts (contact_id);
