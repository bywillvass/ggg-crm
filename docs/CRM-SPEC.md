# GGG CRM - Master Spec

Internal CRM for Ginga Global Group (GGG), a Sydney football talent agency running trials, training sessions, trial games, overseas tours, camps and community events.

Live at: https://crm.gingaglobalgroup.com
Repo: bywillvass/ggg-crm

This file is the source of truth. Build exactly what is here. If something is unclear or conflicts with the installed library versions, pick the simplest working option, note it in docs/PROGRESS.md, and keep going.

---

## 0. Working rules for Claude Code

- Build in the Parts listed in section 14, in order. One Part per session.
- At the start of every session: read this file and docs/PROGRESS.md.
- At the end of every Part: run `npm run build` and `npm run lint`, fix all errors, update docs/PROGRESS.md (what was built, files touched, anything skipped or decided, manual steps Will must do), then commit and push with a clear message.
- Never put secrets in code. Read them from environment variables.
- The Supabase service role key is only ever used server-side (route handlers, server actions). Never import it in a client component.
- Every table has Row Level Security enabled with explicit policies. No table is left open.
- All copy uses short hyphens (-), never em dashes. No italic text anywhere in the UI.
- Will is a beginner coder. When a manual step is needed (dashboard setting, command to run), write it in PROGRESS.md as exact numbered steps.
- Follow the conventions of the installed Next.js version (App Router). If the version uses `proxy.ts` instead of `middleware.ts`, use that.

---

## 1. Stack

- Next.js (App Router, TypeScript, Tailwind, src/ dir) - already scaffolded
- Supabase: Postgres, Auth, Storage, RLS, pg_cron + pg_net
- Supabase CLI for migrations: SQL files in `supabase/migrations/`, applied with `npx supabase db push`
- Hosting: Vercel Hobby (free). Do NOT rely on Vercel Cron (Hobby limits it to once a day). All scheduled jobs are triggered by Supabase pg_cron calling a secured API route.
- Keep serverless functions short. Any long job (bulk email) is processed from a queue in small batches per cron run.
- Email: Resend (`resend` npm package)
- PDF invoices: `@react-pdf/renderer`
- Rich text (blog + HTML email): Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, image, link, placeholder extensions)
- UI: shadcn/ui components + `lucide-react` icons
- Forms/validation: `react-hook-form` + `zod`
- Kanban drag and drop: `@dnd-kit/core` + `@dnd-kit/sortable`
- Dates: `date-fns` + `date-fns-tz`. Default timezone Australia/Sydney. Events store their own timezone (eg a Greece tour uses Europe/Athens).
- Phones: `libphonenumber-js`, store E.164, default country AU
- CSV import: `papaparse`
- Signed tokens (unsubscribe, RSVP, document upload links): `jose` (HS256, TOKEN_SIGNING_SECRET)
- Resend webhook verification: `svix`
- Client-side image compression before upload: `browser-image-compression` (max 1920px, webp, ~0.8 quality)

Generate DB types after each migration: `npx supabase gen types typescript --linked > src/lib/database.types.ts`

---

## 2. Environment variables

Store these in `.env.local` locally and in Vercel (Settings -> Environment Variables). Keep `.env.example` in the repo with the names only.

```
NEXT_PUBLIC_APP_URL=https://crm.gingaglobalgroup.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
INGEST_SECRET=
CRON_SECRET=
TOKEN_SIGNING_SECRET=
GITHUB_TOKEN=
GITHUB_REPO=bywillvass/ginga-global-group-site
GITHUB_BLOG_FILE=blog-posts.json
GITHUB_BRANCH=main
```

---

## 3. Brand and UI

- Colours: navy `#0C0F4C` (primary, sidebar), gold `#C9A227` (accents, primary buttons, active states), white. Neutral greys for surfaces and borders.
- Fonts: Poppins for headings, DM Sans for body. Both via `next/font/google`.
- No italics anywhere. Short hyphens only.
- Layout: left sidebar nav (collapses to a bottom nav / hamburger on mobile), top bar with search and user menu.
- Mobile first for: event check-in, tour mode, player profile, lead detail. These are used on a phone at the field and overseas.
- Every list: search, filters, sort, pagination, empty states, loading skeletons.
- Status pills use consistent colours across the app.
- Destructive actions always confirm.

---

## 4. Users and roles

Invite only. Public signups are disabled in Supabase Auth.

Roles (`app_role` enum): `admin`, `coach`.

- admin: Will and Theo. Full access to everything including settings, users, email, invoices, documents, blog.
- coach: Marcos. Can see and use:
  - Events (all), event participants (name, birth year, position, club, participation status)
  - Check-in (mark attended / no-show, add walk-ins)
  - Assessments (create, edit own, read all)
  - Player sporting profile (name, DOB, birth year, position, foot, club, level, photo)
  - Tour mode for events: medical alerts, dietary notes, emergency contact name + phone, room, flights - safety info needed on tour
  - Cannot see: leads pipeline, parent emails, invoices, payments, document files, email campaigns, blog, settings, dashboard revenue.

Implementation:
- `profiles` table keyed to `auth.users.id` with `role`.
- SQL helper `public.current_role()` (security definer) returning the caller's role, used in RLS.
- Users page (admin): invite by email + role via `supabase.auth.admin.inviteUserByEmail`, change role, deactivate.
- Bootstrap: PROGRESS.md must tell Will how to make himself admin the first time (invite himself from the Supabase dashboard, then run one SQL update).
- Login page: email + password, plus "Forgot password". Branded.
- Optional but built: TOTP MFA enrolment in the user menu (Supabase MFA). Recommended for admins.
- Coach-restricted pages redirect to the dashboard. The coach dashboard shows upcoming events and recent assessments only.

---

## 5. Data model

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz` (trigger-maintained) unless noted. Soft delete with `archived_at` on contacts, players, leads, events.

### Enums
- `app_role`: admin, coach
- `lead_source`: website, meta_instant_form, newsletter, referral, manual, import, other
- `lead_stage`: new, contacted, interested, confirmed, signed, not_interested, lost
- `consent_type`: express, inferred, none
- `event_type`: trial, training_session, trial_game, tour, camp, community_event, other
- `event_status`: draft, open, full, closed, completed, cancelled
- `participant_status`: invited, contacted, confirmed, declined, waitlisted, attended, no_show, cancelled
- `assessment_recommendation`: select, monitor, not_yet
- `invoice_status`: draft, sent, part_paid, paid, overdue, void
- `email_format`: plain, html
- `campaign_status`: draft, scheduled, sending, sent, cancelled
- `message_status`: queued, sending, sent, delivered, opened, clicked, bounced, complained, failed, skipped

### Tables

**profiles** - id (= auth.users.id), full_name, email, role, active bool default true

**contacts** - adults we communicate with: parents/guardians, newsletter subscribers, adult players, community contacts
- first_name, last_name, email (unique lower-cased, nullable), phone (E.164), suburb, state, notes
- tags text[]
- marketing_consent consent_type default 'inferred'
- unsubscribed_at timestamptz
- source lead_source
- archived_at

**players**
- first_name, last_name, dob date, birth_year int (generated from dob, or entered directly if DOB unknown)
- gender, position, secondary_position, preferred_foot, current_club, level (eg NPL, NPL2, Junior Rep), suburb, state
- photo_path (private storage)
- medical_alerts text (short, eg "asthma - carries inhaler")
- dietary_notes text
- eligibility_notes text (free text for program-specific eligibility)
- status: prospect, active, alumni
- notes, archived_at

**player_contacts** - player_id, contact_id, relationship (mother, father, guardian, self, other), is_primary bool, is_emergency bool. Unique (player_id, contact_id).

**leads** - one row per inbound enquiry
- source lead_source, form_type text (eg Contact, EliteNeonCup, CBFCTrials, Newsletter, meta form name), source_detail text (campaign / ad / page)
- external_id text unique (for idempotent ingestion)
- raw jsonb (the full original submission)
- contact_id, player_id (linked after matching)
- stage lead_stage default 'new'
- owner_id (profiles), next_follow_up_at
- interested_event_id (nullable)
- submitted_at, archived_at

**events**
- type event_type, title, slug unique, description
- start_at, end_at, timezone default 'Australia/Sydney'
- venue_name, address, city, country default 'Australia'
- birth_years int[], capacity int, price_cents int, currency default 'AUD'
- status event_status default 'draft'
- parent_event_id (nullable - sub-events: trial sessions under a trial program, matches and sessions inside a tour)
- cover_image_path
- reminder_hours_before int nullable, reminder_template_id nullable
- created_by, archived_at

**event_participants**
- event_id, player_id (nullable), contact_id (nullable - for adult/community events), at least one required
- status participant_status default 'invited', status_updated_at
- source_lead_id
- checked_in_at, checked_in_by
- logistics: flight_out text, flight_return text, room text, shirt_size text, emergency_contact_name, emergency_contact_phone, logistics_notes
- notes
- Unique (event_id, player_id) where player_id not null

**activities** - the timeline for everything
- type: note, call, sms, whatsapp, email_sent, email_opened, email_clicked, email_bounced, status_change, stage_change, lead_created, event_added, checked_in, document_uploaded, document_requested, invoice_sent, payment_recorded, assessment_added, unsubscribed, rsvp
- body text, meta jsonb
- contact_id, player_id, lead_id, event_id (any can be null)
- created_by (null = system)

**tasks** - title, notes, due_at, assigned_to, done_at, contact_id, player_id, lead_id, event_id, created_by

**assessments**
- player_id, event_id, assessor_id
- position_played
- technical, tactical, physical, mental (int 1-10 each), overall (int 1-10)
- strengths text, improvements text, notes text
- recommendation assessment_recommendation

**document_types** - name, description, sensitive bool, retention_days_after_event int nullable. Seed: Consent form, Medical form, Passport copy, Travel insurance, Flight itinerary, Photo release, Birth certificate, Other.

**event_document_requirements** - event_id, document_type_id, required bool default true, notes. Unique (event_id, document_type_id).

**documents**
- player_id, event_id (nullable = general player document), document_type_id
- file_path (private bucket `documents`), file_name, mime_type, size_bytes
- expires_on date (eg passport), notes
- uploaded_by (profile id, null if uploaded by parent via link), uploaded_via: crm or parent_link
- delete_after date nullable (set from retention rules)

**document_request_tokens** - participant-scoped upload links: event_participant_id, token_hash, expires_at, used_count, revoked_at

**invoices**
- number text unique (prefix + zero-padded sequence, eg GGG-0001, from settings)
- contact_id (bill to), player_id, event_id
- issue_date, due_date
- subtotal_cents, gst_cents, total_cents, amount_paid_cents (maintained by trigger from payments)
- status invoice_status default 'draft'
- notes, pdf_path (private bucket `invoices`)
- sent_at, voided_at

**invoice_items** - invoice_id, description, quantity numeric, unit_price_cents, amount_cents, sort_order

**payments** - invoice_id, amount_cents, paid_on date, method (bank_transfer, cash, other), reference, recorded_by, notes

**email_templates** - name, subject, format email_format, body_html, body_text, category (general, event_invite, reminder, invoice, document_request, newsletter)

**email_campaigns**
- name, subject, preheader, format, body_html, body_text
- from_name, reply_to (defaults from settings)
- audience jsonb (saved filter definition - see section 9)
- event_id (nullable - links RSVP buttons and merge fields)
- include_rsvp bool default false
- status campaign_status, scheduled_at, sent_at, created_by
- counts: total, sent, delivered, opened, clicked, bounced (cached ints)

**email_attachments** - campaign_id, file_path (private bucket `email-attachments`), file_name, mime_type, size_bytes

**email_messages** - one per recipient (campaign sends and one-off emails)
- campaign_id nullable, contact_id, to_email, subject (merged), body_html (merged), body_text (merged)
- status message_status default 'queued', resend_id, error
- sent_at, delivered_at, opened_at, clicked_at, bounced_at
- related: player_id, event_id, invoice_id (nullable)

**posts** (blog)
- title, slug unique, category (check: News, Insights, Programs, Player Development)
- tags text[], excerpt, body_html, cover_image_url
- author, seo_title, seo_description
- published bool default false, published_at
- last_synced_at, sync_error

**settings** - single row
- org_name default 'Ginga Global Group', abn, address, phone, email, website, logo_path
- bank_account_name, bank_bsb, bank_account_number, payid (all nullable - not set up yet)
- gst_registered bool default false, gst_rate numeric default 0.10
- invoice_prefix default 'GGG-', invoice_next_number int default 1, payment_terms_days int default 14, invoice_footer
- email_from_name default 'Ginga Global Group', email_from_address, email_reply_to, email_footer_html (must include org name and contact details - Spam Act sender identification)
- daily_email_cap int default 90 (keeps under the Resend free daily limit - raise when on a paid plan)
- default_timezone default 'Australia/Sydney'

**ingest_field_mappings** - source_key text (normalised), target text (one of the mapping targets in section 8), form_type nullable (null = applies to all forms)

**ingest_log** - received_at, external_id, source, form_type, status (created, merged, duplicate, error), error, lead_id

### RLS summary
- admin: full read/write on all tables.
- coach: select on events, event_participants (non-financial columns via a view `coach_event_participants`), players (sporting + safety columns via view `coach_players`), player_contacts + contacts limited to emergency contacts (name + phone only, via view `coach_emergency_contacts`), assessments (select all, insert/update own), document_types. Update on event_participants limited to status (attended/no_show), checked_in_at, checked_in_by - enforce with a security definer RPC `check_in_participant(participant_id, status)` rather than broad update rights.
- No anon access to any table. Public routes (section 12) use the service role server-side after verifying a signed token.

### Storage buckets
- `documents` - private. Access only via short-lived signed URLs (60 seconds) generated server-side for admins.
- `invoices` - private.
- `email-attachments` - private.
- `player-photos` - private, signed URLs.
- `blog-media` - public (images appear on the public website).

---

## 6. Navigation and screens

Sidebar (admin): Dashboard, Leads, Contacts, Players, Events, Email, Invoices, Blog, Tasks, Settings.
Sidebar (coach): Dashboard, Events, Players, Assessments.

Global search (top bar): contacts, players, leads, events by name, email, phone.

### 6.1 Dashboard (admin)
All figures are internal only.
- New leads this week vs last week, split by source
- Leads by stage
- Lead funnel by source: leads -> confirmed for an event -> attended -> signed
- Upcoming events: date, type, confirmed / capacity, documents outstanding (tours/camps)
- Attendance and no-show rate for recent trials
- Invoices: outstanding total, overdue total, paid this month
- My tasks due today and overdue
- Recent activity feed

### 6.2 Leads
- Two views, toggle: Board (kanban columns by stage, drag to change stage) and Table.
- Filters: source, form type, stage, owner, birth year, date range, has follow-up due, interested event.
- Bulk actions (table): change stage, assign owner, add tag to contact, add to event (pick event + participant status), send email (opens composer with these recipients), export CSV, archive.
- Lead detail (drawer on desktop, full page on mobile):
  - Summary: parent, player, birth year, source, form type, submitted time
  - Raw submission (all original fields, nicely formatted)
  - Linked contact and player (edit, or re-link / merge)
  - Quick actions: log call, log SMS/WhatsApp, add note, send email, create task, set follow-up date, add to event, tap-to-call and tap-to-WhatsApp links (wa.me with E.164)
  - Timeline of activities
- Every stage change writes an activity.
- When a linked event participant becomes confirmed, set lead stage to confirmed (if it was earlier in the flow). Signed is always manual.

### 6.3 Contacts
- List with filters: tags, consent, unsubscribed, has players, source.
- Detail: info, linked players, events (via players), emails sent with status, invoices, leads, timeline, tasks.
- Merge duplicates tool (pick master, move all relations, archive the other).

### 6.4 Players
- List with filters: birth year, position, club, level, state, status, attended event X, recommendation.
- Profile: photo, details, guardians (with tap-to-call), events history with participation status, assessments (with score trend), documents grouped by event, invoices (admin only), timeline.

### 6.5 Events
- List: upcoming / past / all, filter by type and status. Cards show date, venue, confirmed/capacity, type pill.
- Create/edit event form (all event fields, sub-event parent, document requirements for tours/camps).
- Event detail tabs:
  - Overview: details, counts by participant status, sub-events list.
  - Participants: table with status, quick status dropdown per row, bulk status change, add players (search existing), add from leads (search leads), add walk-in (quick create player + parent), email participants filtered by status (opens composer with event_id set), export CSV. Waitlist ordering when full.
  - Check-in: mobile-first full screen. Search box, big rows, tap Attended / No-show, undo. Shows birth year and position. Walk-in add button. Live counts at top. Works for coach role.
  - Documents (tour, camp, or any event with requirements): requirement checklist editor; matrix of participants x required documents (tick = uploaded, red = missing, amber = expiring before event end); upload per cell; view file (signed URL); "Request missing documents" button that emails each participant's primary contact a personal upload link (section 12.3).
  - Logistics / Tour mode: per participant flights, room, shirt size, emergency contact, medical alerts, dietary notes. Mobile view lists each player with emergency tap-to-call, medical alert badge, room. This is what Will opens on tour in Greece - only players in this event appear.
  - Assessments: list for this event, add assessment per participant (coach friendly, sliders 1-10).
  - Invoices (admin): generate invoices for all confirmed participants at the event price in one click (draft), see status per participant, send all drafts.
- Sub-events: a tour can hold matches and sessions as child events. A trial program can hold sessions by birth year (eg Melbourne trial sessions for 2011, 2012, 2013, 2014). Participants can be added to the parent and/or children.

### 6.6 Assessments (coach + admin)
- My assessments, all assessments, filter by event, birth year, recommendation.
- Player comparison for an event: table sortable by overall and each score.
- "Selected" players from an event can be bulk-added to another event (eg trial -> tour) as invited.

### 6.7 Email - see section 9
### 6.8 Invoices - see section 10
### 6.9 Blog - see section 11

### 6.10 Tasks
- My tasks / All tasks, due today, overdue, upcoming, done. Create from anywhere (lead, contact, player, event). Check off inline.

### 6.11 Settings (admin)
- Organisation details and logo
- Bank details (placeholders until set - invoices show a warning banner and the send button warns if bank details are empty)
- GST toggle, invoice prefix and next number, payment terms, invoice footer
- Email: from name, from address, reply-to, footer, daily cap
- Users and roles
- Document types and retention days
- Lead field mappings (section 8)
- Email templates (manage)
- Integration status: last ingest received per source, recent ingest_log errors, last blog sync

---

## 7. Activity logging

Write an activity for every meaningful action (create lead, stage change, participant status change, check-in, email sent/opened/clicked/bounced, document uploaded/requested, invoice sent, payment recorded, assessment added, unsubscribe, RSVP). Use a single server helper `logActivity()`. Show timelines newest first with icon per type.

---

## 8. Lead ingestion

### 8.1 API
`POST /api/ingest`
- Header `x-ingest-secret` must equal `INGEST_SECRET`, else 401.
- Body:
```json
{
  "leads": [
    {
      "external_id": "website:EliteNeonCup:42",
      "source": "website",
      "form_type": "EliteNeonCup",
      "source_detail": "/elite-neon-cup.html",
      "submitted_at": "2026-10-01T01:23:45.000Z",
      "fields": { "Parent Name": "...", "Email": "...", "Phone": "...", "Player Name": "...", "Birth Year": "2011" }
    }
  ]
}
```
- Response: `{ "ok": true, "results": [{ "external_id": "...", "status": "created|merged|duplicate|error", "lead_id": "...", "error": null }] }`
- Idempotent: same external_id never creates a second lead (return duplicate).
- Log every item to ingest_log.

### 8.2 Processing
1. Normalise field keys: lowercase, strip everything that is not a-z0-9.
2. Map to targets using ingest_field_mappings first (form-specific beats global), then built-in defaults:
   - contact_email: email, emailaddress, parentemail, guardianemail
   - contact_phone: phone, phonenumber, mobile, mobilenumber, parentphone
   - contact_full_name: fullname, parentname, guardianname, name
   - contact_first_name: firstname, parentfirstname
   - contact_last_name: lastname, parentlastname, surname
   - player_full_name: playername, childname, playerfullname, childsname
   - player_first_name, player_last_name: playerfirstname, playerlastname
   - player_dob: dob, dateofbirth, birthdate, playerdob
   - player_birth_year: birthyear, yearofbirth, playerbirthyear
   - player_club: club, currentclub
   - player_position: position, playerposition
   - player_level: level, league
   - suburb, state: suburb, city, state
   - message: message, comments, enquiry, notes
   - campaign: campaignname, adname, adsetname, formname (goes to source_detail)
   - Anything unmapped stays in raw and is shown on the lead.
3. Match contact by email (case-insensitive), then by phone. Create if not found. Fill empty fields only, never overwrite existing data.
4. If player data present: match an existing player linked to that contact by first name + birth year, else create and link (relationship guardian, is_primary true). If the submission looks like an adult player filling it for themselves (no separate parent name), link with relationship self.
5. form_type Newsletter (any case): do not create a lead. Upsert contact, set marketing_consent express, add tag newsletter, clear unsubscribed_at only if this is a new explicit signup, log activity.
6. All other forms: create lead with stage new, source, form_type, source_detail, raw.
7. Meta instant form leads: source meta_instant_form, marketing_consent inferred.

### 8.3 CSV import (Leads -> Import)
Upload CSV exported from any existing sheet, preview first 20 rows, map columns to targets (pre-filled with the defaults above), choose source + form type, import through the same processing pipeline. external_id = `import:<file hash>:<row>`. Show summary (created, merged, duplicates, errors).

### 8.4 Google Apps Script files
Create these in `integrations/` with a README of exact setup steps:

**integrations/website-Code.gs** - full replacement for the website's existing Apps Script. Keep ALL existing behaviour exactly (doPost writing to tabs by formType with the `company` honeypot, doGet for the blog, syncBlogToGitHub). Add: after a row is appended in doPost, forward the submission to `/api/ingest` with UrlFetchApp. external_id = `website:<formType>:<row number>`, source website (Newsletter included - the API handles it), source_detail = the page field if sent (eg SourcePage). Read `CRM_INGEST_URL` and `CRM_INGEST_SECRET` from Script Properties. Wrap the forward in its own try/catch so a CRM failure never breaks the sheet write or the response to the website. Use muteHttpExceptions. README must remind Will to redeploy as a New version of the existing deployment (Deploy -> Manage deployments -> edit -> New version) so the URL does not change.

Also: once the CRM blog is live (Part 10), syncBlogToGitHub must stop running so it does not overwrite CRM-published posts. README must tell Will to delete any trigger for syncBlogToGitHub. Keep the function in the file.

**integrations/meta-sheet-sync.gs** - for the separate Google Sheet that receives Meta instant form leads. Bound script with:
- `syncNewLeads()`: for every tab (skip tabs starting with `_`), read rows after the last processed row stored in Script Properties per tab, post them in batches of 50 to `/api/ingest` with source meta_instant_form, form_type = tab name, fields = header -> value. external_id = `meta:<value of id column>` if a Meta lead id column exists (id, lead_id, leadid), else `metasheet:<tab>:<row>`. Only advance the stored row after a successful response.
- `backfillAll()`: resets stored rows and resends everything (safe - API is idempotent).
- `setupTrigger()`: creates a time-driven trigger running syncNewLeads every 5 minutes (and removes duplicates first).
- Same Script Properties names as above.

---

## 9. Email

### 9.1 Sending infrastructure
- Resend, from address and name from settings. Domain gingaglobalgroup.com verified in Resend.
- Every send goes through `email_messages` rows with status queued. A processor sends them in batches:
  - Called by `/api/cron/run` (every 5 minutes) and kicked off immediately after "Send now" (process first batch inline, rest via cron).
  - Batch size 40 per run. Respect settings.daily_email_cap (count sent today in Australia/Sydney time). If the cap is hit, leave the rest queued and show "X queued - will continue tomorrow" on the campaign.
  - Use the Resend batch endpoint for messages without attachments. Check the current Resend docs: if batch does not support attachments, send messages with attachments one by one.
  - Store resend_id. On error mark failed with the error text.
- Webhook `POST /api/webhooks/resend` verified with svix and RESEND_WEBHOOK_SECRET. Update message status and timestamps for delivered, opened, clicked, bounced, complained. Bounce or complaint sets the contact's unsubscribed_at and logs an activity. Update campaign cached counts.

### 9.2 Compliance (Australian Spam Act)
- Every bulk email includes the settings footer (sender identity) and a working one-click unsubscribe link.
- Add `List-Unsubscribe` and `List-Unsubscribe-Post` headers pointing to `/api/unsubscribe?token=...`.
- Recipients with unsubscribed_at set, consent none, or no email are always skipped (message status skipped).
- One-off emails from a lead or contact page are allowed to unsubscribed contacts only if they are transactional (invoice, document request, event logistics) - the composer shows a warning.

### 9.3 Composer (Email -> New campaign, and from any bulk action)
- Step 1 Audience: choose by filters, combinable:
  - Contacts: tags, consent, source, has player in birth year(s)
  - Leads: stage, source, form type, created date range (sends to the lead's contact)
  - Event: event + participant status(es) (sends to each participant's primary contact, or the contact itself for adult participants)
  - Or a fixed list passed from a bulk action
  - Live count of recipients and skipped (unsubscribed / no email), with a preview list
  - Saved as audience jsonb; resolved to recipients at send time
- Step 2 Content:
  - Format toggle: Plain or HTML
  - Plain: textarea. Sent as a simple branded HTML wrapper (logo, white card, DM Sans-like web-safe stack) plus a text version.
  - HTML: Tiptap editor with headings, bold, links, lists, images (uploaded to blog-media bucket), buttons, plus a "Raw HTML" tab to paste custom HTML. Text version auto-generated.
  - Template picker (load) and Save as template
  - Merge fields inserter: {{contact_first_name}}, {{contact_last_name}}, {{player_first_name}}, {{player_last_name}}, {{event_title}}, {{event_date}}, {{event_time}}, {{event_venue}}, {{event_address}}. Missing values fall back to empty, and {{contact_first_name}} falls back to "there".
  - Optional RSVP block (only when event_id set): "I'll be there" / "Can't make it" buttons (section 12.2)
  - Attachments: upload files (PDF, DOCX, images, etc), total max 10MB, shown with size, removable
  - Subject and preheader
- Step 3 Review: rendered preview using a real sample recipient, recipient count, attachment list, Send test to me, Schedule (date/time, Sydney time) or Send now. Confirm dialog states the number of recipients.
- Campaign page: stats (queued, sent, delivered, opened, clicked, bounced), recipient table with per-person status, duplicate campaign.

### 9.4 One-off email
From lead, contact, player, or event participant row: compose a single email (same editor, attachments allowed), logged to the timeline.

### 9.5 Automated emails (run in /api/cron/run)
- Event reminders: for events with reminder_hours_before and reminder_template_id set, queue a reminder once per confirmed participant when the event is within that window. Never send twice (track in email_messages by event_id + template + contact).
- Invoice overdue: set status overdue when due_date passed and not fully paid. No automatic chasing email - show on dashboard (admin decides).
- Document retention: list documents past delete_after on the dashboard for admin to confirm deletion. Never auto-delete.
- Daily digest is not required.

### 9.6 Default templates (seed)
Event invite, Trial reminder, Trial follow-up (thanks for attending), Document request, Invoice email, Newsletter starter. Plain, short, on-brand, short hyphens only.

---

## 10. Invoices

- Create invoice: bill-to contact, player, event (optional), line items, issue date (today), due date (issue + payment terms), notes. Auto number from settings (atomic increment in a SQL function).
- Bulk create from an event (section 6.5).
- Title "Tax Invoice" only if settings.gst_registered is true, otherwise "Invoice". GST line only when registered (prices treated as GST-inclusive, GST = total / 11).
- PDF via @react-pdf/renderer: logo, org details, ABN, bill-to, player + event, items, totals, due date, payment instructions (account name, BSB, account number, PayID, "Use invoice number as reference"), footer. If bank details are empty the PDF shows "Payment details to follow" and the UI warns before sending.
- Send: generates PDF, stores in invoices bucket, emails the bill-to contact with the PDF attached using the Invoice template, status sent, activity logged.
- Record payment: amount, date, method, reference. Status auto: part_paid / paid. Void with reason.
- Invoice list: filters by status, event, date; totals row; export CSV.
- Event invoices tab shows paid / owing per participant.

---

## 11. Blog

- Posts list: status (draft/published), category, published date, last synced.
- Editor: title, slug (auto from title, editable), category dropdown (News, Insights, Programs, Player Development), tags, excerpt, cover image upload, Tiptap body with inline image upload, SEO title and description, author.
- Images: compressed client-side, uploaded to public bucket `blog-media` under `posts/<slug>/`, inserted by public URL.
- Publish / Unpublish / Update: saves the post, then calls `syncBlogToGitHub()` server-side:
  - Build the JSON for all published posts in EXACTLY the format the website currently reads. Before building this Part, inspect the website repo (bywillvass/ginga-global-group-site): read the current `blog-posts.json` and the site JavaScript that renders the blog, and match every field name, date format (YYYY-MM-DD) and body format it expects. If the site expects plain text or markdown in the body and the CRM stores HTML, adapt so posts render correctly on the site - update the site's render code only if unavoidable, and document it.
  - Commit to GITHUB_REPO / GITHUB_BLOG_FILE on GITHUB_BRANCH via the GitHub contents API (get sha, then PUT). Hostinger auto-deploys from GitHub.
  - Store last_synced_at or sync_error on the post and show it in the UI.
- Import: one-time "Import from current blog" that reads the live blog-posts.json from the repo and creates posts (skip existing slugs).
- After Part 10, Will must remove the old Apps Script syncBlogToGitHub trigger (section 8.4).

---

## 12. Public routes (no login)

All verify a signed JWT (jose, TOKEN_SIGNING_SECRET) and use the service role server-side. Branded, simple, mobile friendly pages.

### 12.1 Unsubscribe - `/unsubscribe?token=` and `POST /api/unsubscribe?token=`
Token holds contact_id. Page confirms and sets unsubscribed_at, logs activity. POST supports one-click (List-Unsubscribe-Post).

### 12.2 RSVP - `/rsvp?token=&answer=yes|no`
Token holds event_participant_id. Sets status confirmed or declined, logs activity, shows a confirmation with event details. Tokens expire at event end. Respect capacity: if full, set waitlisted and say so.

### 12.3 Document upload - `/upload/[token]`
Token holds event_participant_id (also stored hashed in document_request_tokens, revocable, expires in 30 days). Page shows player name, event, and each required document with status. Parent uploads files (max 15MB each, PDF/JPG/PNG/HEIC). Files go to the private documents bucket, document rows created with uploaded_via parent_link, activity logged. Already-uploaded files show as received but cannot be viewed or downloaded from this page (privacy). Rate limit uploads per token.

### 12.4 Other public endpoints
- `/api/ingest` (section 8)
- `/api/webhooks/resend` (section 9)
- `/api/cron/run` - requires header `x-cron-secret` = CRON_SECRET. Runs: email queue processing, event reminders, invoice overdue update, scheduled campaigns whose time has come. Idempotent and safe to run often. Each job time-boxed so the whole run stays well under the function limit.

### 12.5 Supabase cron
Migration enables pg_cron and pg_net and schedules a job every 5 minutes calling `https://crm.gingaglobalgroup.com/api/cron/run` with the x-cron-secret header. The secret must not be hard-coded in a migration committed to git - store it in Supabase Vault and read it in the job. PROGRESS.md gives Will the exact SQL to insert the secret into Vault.

---

## 13. Security and privacy

- The CRM holds personal data about children. Treat it accordingly.
- RLS on every table (section 5). Test coach restrictions by signing in as a coach user before Part 12 is marked done.
- Documents and photos only via short-lived signed URLs, generated after a role check.
- Never log document contents, tokens or secrets.
- Retention: documents of sensitive types get delete_after = event end + retention_days_after_event. Admin confirms deletion from the dashboard list.
- Admin can export everything for one contact (CSV/JSON) and delete a contact with all linked data (privacy requests), with a strong confirmation.
- Security headers via next.config (no framing, referrer policy, content type options).
- Disable public signups in Supabase Auth.

---

## 14. Build plan

Each Part = one Claude Code session. Finish, build, lint, update PROGRESS.md, commit, push.

1. Foundation - install all dependencies, shadcn/ui setup, Supabase clients (browser, server, service-role), auth (login, forgot/reset password, session handling, route protection), role helper, app shell (sidebar, top bar, mobile nav), brand styling, `.env.example`, `docs/PROGRESS.md`. Link the Supabase project if not already linked.
2. Database - all migrations: enums, tables, triggers (updated_at, invoice totals, amount_paid), functions (current_role, invoice numbering, check_in_participant), views for coach, RLS policies, storage buckets and storage policies, seed data (document types, templates, settings row). Push migrations, generate types. Write the admin bootstrap steps.
3. Settings and users - settings page (all sections), users page (invite, roles, deactivate), MFA enrolment.
4. Contacts, players, leads, tasks, activities - all list/detail screens, board + table, bulk actions (except email, wired in Part 9), merge tool, global search, CSV import.
5. Lead ingestion - /api/ingest with processing and mappings, ingest_log, Settings mapping UI, integration status panel, both Apps Script files + integrations/README.md.
6. Events - events list, create/edit, sub-events, participants tab with all actions, check-in mode, logistics/tour mode, waitlist.
7. Documents - requirements, matrix, uploads, signed URL viewing, request-documents flow, public upload page, retention.
8. Assessments - coach-friendly entry, lists, comparison, bulk add selected to another event, player score trend.
9. Email - templates, composer, queue processor, Resend sending, attachments, webhook, unsubscribe, RSVP, one-off emails, wire the email bulk actions from Parts 4 and 6, /api/cron/run, Supabase cron migration.
10. Invoices - create, bulk from event, PDF, send, payments, statuses, list, event tab.
11. Blog - inspect website repo format, posts list, editor, image upload, GitHub sync, import.
12. Dashboard and QA - admin and coach dashboards, then a full QA pass: build, lint, type check, test every role restriction as coach, test every public route, mobile check of check-in and tour mode, security headers, final README.md with setup and env vars. List any known gaps in PROGRESS.md.
