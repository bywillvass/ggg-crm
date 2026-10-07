-- Part 1: Lead ingestion schema additions
-- 2026-10-07
--
-- Adds:
--   contacts.contact_type   text  ('parent' | 'player' | 'other')
--   players.squad           text  generated from birth_year ('2011' | '2013' | null)
--   players.out_of_age_range bool  generated — true when birth_year outside 2011-2014
--   leads.campaign_name     text  filterable Meta campaign name
--   leads.adset_name        text  filterable Meta ad set name
--
-- No data deleted. No existing rows changed except contact_type defaults to 'parent'.

-- contacts: contact_type
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_type text DEFAULT 'parent'
  CONSTRAINT contacts_contact_type_check CHECK (contact_type IN ('parent', 'player', 'other'));

-- players: squad (derived from birth_year, stored so it can be indexed)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS squad text
  GENERATED ALWAYS AS (
    CASE
      WHEN birth_year IN (2011, 2012) THEN '2011'
      WHEN birth_year IN (2013, 2014) THEN '2013'
      ELSE NULL
    END
  ) STORED;

-- players: out_of_age_range flag
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS out_of_age_range bool
  GENERATED ALWAYS AS (
    birth_year IS NOT NULL AND birth_year NOT BETWEEN 2011 AND 2014
  ) STORED;

-- leads: separate campaign and ad-set columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS campaign_name text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS adset_name text;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_leads_campaign_name   ON public.leads  (campaign_name)   WHERE campaign_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_adset_name      ON public.leads  (adset_name)      WHERE adset_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_squad         ON public.players(squad)            WHERE squad IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON public.contacts(contact_type);
