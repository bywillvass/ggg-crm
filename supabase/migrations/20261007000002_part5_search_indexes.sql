-- Enable pg_trgm for fast trigram-based partial/fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Normalised phone digits column — strips all non-numeric chars.
-- Lets us match 0403358404, +61403358404, 04 03 35 84 04 via the last 9 digits.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_digits text
  GENERATED ALWAYS AS (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) STORED;

-- Trigram indexes on all searched fields for sub-100ms partial matching
CREATE INDEX IF NOT EXISTS contacts_first_name_trgm   ON public.contacts USING gin (first_name   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_last_name_trgm    ON public.contacts USING gin (last_name    gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_email_trgm        ON public.contacts USING gin (email        gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_phone_digits_trgm ON public.contacts USING gin (phone_digits gin_trgm_ops);

CREATE INDEX IF NOT EXISTS players_first_name_trgm    ON public.players  USING gin (first_name   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS players_last_name_trgm     ON public.players  USING gin (last_name    gin_trgm_ops);
CREATE INDEX IF NOT EXISTS players_current_club_trgm  ON public.players  USING gin (current_club gin_trgm_ops);

CREATE INDEX IF NOT EXISTS leads_campaign_name_trgm   ON public.leads    USING gin (campaign_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_form_type_trgm       ON public.leads    USING gin (form_type    gin_trgm_ops);

CREATE INDEX IF NOT EXISTS events_title_trgm          ON public.events   USING gin (title        gin_trgm_ops);
CREATE INDEX IF NOT EXISTS events_venue_name_trgm     ON public.events   USING gin (venue_name   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS events_city_trgm           ON public.events   USING gin (city         gin_trgm_ops);
