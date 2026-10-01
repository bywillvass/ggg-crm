# GGG CRM - Build Progress

## Part 9 - Email (2026-10-01)

### What was built

- Email sender library at `src/lib/email/sender.ts`:
  - `processEmailQueue(limit)` - loads settings, enforces daily cap in Sydney tz, fetches queued messages, replaces merge fields, wraps plain text in branded HTML, injects footer and List-Unsubscribe headers into HTML, batches via Resend `batch.send` when no attachments, falls back to `emails.send` for attachment-bearing messages (fetched from `email-attachments` storage bucket), returns `{ sent, failed, skipped, capped }`
  - `sendSingleEmail(messageId)` - same logic for one message (used for tests and one-off transactional emails)
  - `scheduleEventReminders()` - scans events with `reminder_hours_before` and `reminder_template_id` set, queues one `email_messages` row per confirmed participant (skips if an existing non-failed reminder is already present for that event+contact+campaign-null)
  - `markOverdueInvoices()` - updates invoices with past due date and status not in paid/void/overdue
  - `recalculateCampaignCounts(campaignId)` - recomputes total/sent/delivered/opened/clicked/bounced on `email_campaigns`
- Audience resolver at `src/lib/email/audience.ts`: `resolveAudienceServer(audience)` handling `fixed | contacts | leads | event`; returns `{ contacts, skipped, total }` with unsubscribed/no-email filtered out of the valid list
- Public endpoints:
  - `GET /api/cron/run` - secret-gated via `x-cron-secret`; activates due scheduled campaigns (resolves audience + inserts `email_messages`), processes queue, schedules event reminders, marks overdue invoices, closes any `sending` campaign with no remaining queued messages
  - `POST /api/webhooks/resend` - svix-verified; handles `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`; bounce/complaint auto-unsubscribes contact and logs activity; recalculates campaign counts
  - `POST /api/unsubscribe` - token-verified unsubscribe; sets `unsubscribed_at` and logs activity
  - `/unsubscribe?token=...` - branded page with client-side form that POSTs to `/api/unsubscribe`
  - `/rsvp?token=...&answer=yes|no` - branded page; sets participant to confirmed/waitlisted (auto-waitlist on capacity) or declined; logs `rsvp` activity
- Server actions at `src/app/(app)/email/actions.ts`:
  - CRUD: `listCampaigns`, `getCampaign` (with messages + attachments), `createCampaign`, `updateCampaign`, `deleteCampaign` (draft only), `duplicateCampaign`
  - Sending: `sendCampaignNow` (resolves audience, inserts messages, calls `processEmailQueue` inline, closes campaign), `scheduleCampaign`, `cancelScheduledCampaign`, `sendTestEmail`
  - Attachments: `uploadAttachment` (base64 to `email-attachments` bucket + DB row), `deleteAttachment`
  - Templates: `listTemplates`, `saveAsTemplate`, `deleteTemplate`
  - One-off/transactional: `sendOneOffEmail`
  - Lookups: `listEventsForEmail`, `listContactsForFixed`, `getContactEmails`
  - Image uploads for Tiptap: `getImageUploadUrl` returns presigned URL to `blog-media` bucket plus the public URL
- Email list page `src/app/(app)/email/page.tsx` and campaign detail page `src/app/(app)/email/[id]/page.tsx`
- Components:
  - `EmailShell` - campaigns table with status badges, duplicate/delete actions, new-campaign button
  - `CampaignComposer` - 3-step wizard: 1) audience (contacts/leads/event/fixed) with live resolved count and preview chips, 2) content (name/subject/preheader + plain or HTML body with Tiptap, merge-field insert buttons, template load, save-as-template, attachments), 3) review (rendered preview, recipient summary, send-test, schedule, send-now with confirmation)
  - `TiptapEditor` - Editor and Raw-HTML tabs; toolbar for bold/italic/H2/H3/link/bullet/numbered/image/HR; image upload via server action `getImageUploadUrl` into `blog-media` bucket
  - `CampaignDetail` - stats bar (sent/delivered/opened/clicked/bounced with percentages), paginated recipients table, duplicate/edit/delete
  - `OneOffEmailDialog` - subject + text body, yellow warning banner if contact unsubscribed, sends via `sendOneOffEmail`
- Wiring:
  - `ContactDetail` - "Send email" button in header + `OneOffEmailDialog`; existing Emails tab unchanged (`contact.email_messages` already in `getContact`)
  - `ContactsShell` - bulk "Send email" action in selection bar opens `CampaignComposer` with pre-filled contact IDs; page passes templates and events
  - `EventParticipantsTab` - "Email participants" button (admin only) opens `CampaignComposer` with event audience pre-filled; `EventDetail` and the event page thread the email templates/events down

### Files created

- `src/lib/email/sender.ts`
- `src/lib/email/audience.ts`
- `src/app/api/cron/run/route.ts`
- `src/app/api/webhooks/resend/route.ts`
- `src/app/api/unsubscribe/route.ts`
- `src/app/unsubscribe/page.tsx`
- `src/app/unsubscribe/UnsubscribeForm.tsx`
- `src/app/rsvp/page.tsx`
- `src/app/(app)/email/actions.ts`
- `src/app/(app)/email/page.tsx`
- `src/app/(app)/email/[id]/page.tsx`
- `src/components/email/EmailShell.tsx`
- `src/components/email/CampaignComposer.tsx`
- `src/components/email/CampaignDetail.tsx`
- `src/components/email/TiptapEditor.tsx`
- `src/components/email/OneOffEmailDialog.tsx`

### Files modified

- `src/components/contacts/ContactDetail.tsx` - "Send email" button + `OneOffEmailDialog`
- `src/components/contacts/ContactsShell.tsx` - bulk "Send email" action, templates/events props
- `src/app/(app)/contacts/page.tsx` - fetch templates and events for the shell
- `src/components/events/EventParticipantsTab.tsx` - "Email participants" button + `CampaignComposer`
- `src/components/events/EventDetail.tsx` - accept and forward `emailTemplates`/`emailEvents`
- `src/app/(app)/events/[id]/page.tsx` - fetch and pass email templates/events

### Decisions made

- Resend batch send is used for messages with no attachments (one Resend call per queue tick, up to 40 at a time). Messages with attachments go through `resend.emails.send` one at a time because Resend's batch API does not support attachments.
- Daily cap is enforced in Sydney time by counting all `email_messages` with `sent_at >=` Sydney midnight and status in sent/delivered/opened/clicked/bounced/complained.
- Unsubscribe tokens are signed with `signToken({ contact_id }, "365d")` - unsubscribe links don't need DB rows, verification is purely JWT.
- RSVP tokens use `signToken({ event_participant_id }, ...)` - RSVP pages use `serviceClient` (no auth session), consistent with the document upload flow.
- Merge fields are substituted at send time (not when queued) so changes to contact/player/event records between queueing and sending are reflected.
- Plain-format emails get wrapped in a branded HTML shell (navy header, white card, DM Sans stack, gray footer with Unsubscribe link). HTML-format emails get the footer injected before `</body>` so the sender keeps full control of the body design.
- `email_campaigns.audience` is stored as JSON matching the `AudienceFilter` type (`{ type, filters?, contactIds? }`). `resolveAudienceServer` is exported from `src/lib/email/audience.ts` and called by both server actions and the cron route.
- `sendTestEmail` always creates/reuses a `[Test Recipient]` contact for the provided email with `marketing_consent: "express"`. The test subject gets `[TEST]` prefix.
- Webhook event parsing: svix returns `unknown` so we cast through `unknown as ResendEvent`. Unknown event types are silently acknowledged.
- `requireAnyRole` was not needed in email actions (every surface is admin-only except `resolveAudience` which requires auth only since it's used during composer preview).
- Attachment upload is server-side via base64 payload (small files from Composer dialog). Larger uploads would need a presigned URL flow; the Composer currently reads via `FileReader.readAsDataURL`.

### Manual steps needed

Database:
- A `email-attachments` storage bucket must exist in Supabase. Create via Dashboard -> Storage -> New bucket -> name `email-attachments`, private.
- The `blog-media` bucket (used by Tiptap image uploads) must exist and be set to public (so inlined email images are reachable).

Environment variables (add to Vercel + local `.env.local`):
- `RESEND_API_KEY` - from https://resend.com dashboard
- `RESEND_WEBHOOK_SECRET` - from Resend Webhooks page (whsec_...)
- `CRON_SECRET` - any random string; pass as `x-cron-secret` header from the cron service
- `NEXT_PUBLIC_APP_URL` - already in use for document upload links

Resend setup:
1. Verify sending domain in Resend (DKIM/SPF/DMARC)
2. Set `settings.email_from_address` and `settings.email_from_name` in the CRM (or SQL update)
3. Create a webhook in Resend pointing to `https://<app-url>/api/webhooks/resend` with events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`. Copy the signing secret to `RESEND_WEBHOOK_SECRET`.
4. Add tracking - in Resend domain settings enable click/open tracking.

Cron setup (choose one):
- Vercel Cron: add `vercel.json` with a job hitting `GET /api/cron/run` every 5 min and set `headers: { "x-cron-secret": "<CRON_SECRET>" }` via `crons` config.
- External scheduler (EasyCron, cron-job.org, GitHub Actions): schedule GET to `/api/cron/run` every 5 minutes with header `x-cron-secret`.

Smoke test flow:
1. Go to `/email` -> New campaign -> Audience Fixed or Contacts filter -> Content: plain body with `{{contact_first_name}}` -> Review -> Send test to your email
2. Verify branded wrapper, correct merge fields, unsubscribe link
3. Click Send now -> watch campaign stats populate on `/email/[id]`
4. Click the unsubscribe link in the received email -> `/unsubscribe` page -> Unsubscribe -> verify `contacts.unsubscribed_at` set and activity row created
5. Configure an event with `reminder_hours_before=24` and a reminder template, confirm a participant, trigger `/api/cron/run` -> verify a queued email_message appears
6. For RSVP: generate a signed token with `signToken({ event_participant_id: "..." })` and open `/rsvp?token=...&answer=yes`
7. Verify webhook: send a test email, open it in Gmail, confirm `email.opened` fires and `email_messages.status` becomes `opened`

---

## Part 8 - Assessments (2026-10-01)

### What was built

- Server actions at `src/app/(app)/assessments/actions.ts`:
  - `listAssessments` with filters (eventId, birthYear, recommendation, myOnly)
  - `getAssessment` - single assessment with player/event/assessor joins
  - `createAssessment` - sets assessor_id to current user, logs `assessment_added` activity
  - `updateAssessment` - coaches can only edit their own; admins can edit any
  - `deleteAssessment` - same ownership rule as update
  - `getEventComparison` - all assessments for an event sorted by overall score desc
  - `bulkAddToEvent` - admin only; adds selected players as "invited" to target event, skips existing
  - `listEventsForSelect` - non-archived events for dropdowns
  - `searchPlayersForAssessment` - debounced player search by name
- Assessments page at `/assessments` (server component + shell)
- `AssessmentsShell` client component: tabbed (All/My), filters (event, birth year, recommendation), sortable table, add/edit/delete dialogs with player name search autocomplete
- `EventAssessmentsTab` client component: comparison table sortable by all score columns, add/edit/delete assessment, bulk-add selected players to another event (admin only)
- Wired `EventAssessmentsTab` into `EventDetail.tsx` replacing the placeholder
- Updated `PlayerDetail.tsx`: added "Add assessment" button in Assessments tab, dialog pre-filled with player, event select, score fields, recommendation. Added score trend (last 5 overall scores as colored dots).

### Files created

- `src/app/(app)/assessments/actions.ts`
- `src/app/(app)/assessments/page.tsx`
- `src/components/assessments/AssessmentsShell.tsx`
- `src/components/events/EventAssessmentsTab.tsx`

### Files modified

- `src/components/events/EventDetail.tsx` - import and wire EventAssessmentsTab
- `src/components/players/PlayerDetail.tsx` - add assessment dialog + score trend

### Decisions made

- `requireAnyRole()` defined locally in assessments/actions.ts (same pattern as events/actions.ts; it is not exported from `@/lib/auth/role`)
- `AssessmentFormInner` is a separate component from `AssessmentFormDialog` to avoid calling setState in useEffect (ESLint react-hooks/set-state-in-effect). The wrapper computes initial state and passes a `key` to reset.
- Birth year filtering in `listAssessments` is done in JS after the DB query (requires join to players table; Supabase doesn't support filtering on joined columns via the JS client simply)
- Assessments are fetched fresh in `EventAssessmentsTab` on mount via `getEventComparison`; no SSR props needed
- The `/assessments` page reloads on save (window.location.reload) since the server component needs to re-fetch; a future optimisation could do optimistic updates

### Manual steps needed

No database migrations needed. All tables from Part 2.

1. Start dev server and test: `npm run dev`
2. Go to `/assessments` - should show all assessments list with add/edit/delete
3. Go to an event and click "Assessments" tab - should show comparison table
4. Go to a player and click "Assessments" tab - should show "Add assessment" button and trend dots
5. Verify coach access: a coach user should be able to create assessments but only edit/delete their own

---

## Part 1 - Foundation (2026-10-01)

### What was built

- Installed all spec dependencies (see package.json)
- shadcn/ui v4 initialised with Tailwind v4 CSS-based config, using @base-ui/react (new shadcn default)
- Added shadcn components: button, input, label, card, separator, avatar, dropdown-menu, sheet, dialog, sonner
- Supabase clients: browser (client.ts), server (server.ts via @supabase/ssr), service-role (service.ts)
- Role helper: getCurrentRole, requireAuth, requireAdmin
- Auth pages: /login, /forgot-password, /reset-password
- Auth callback route: /api/auth/callback
- Route protection: src/proxy.ts (Next.js 16 renamed middleware -> proxy)
- App shell: AppShell, Sidebar, TopBar, MobileBottomNav
- AuthProvider context (user + role)
- Authenticated layout at src/app/(app)/layout.tsx
- Dashboard placeholder at /dashboard
- Brand styling: navy #0C0F4C, gold #C9A227, DM Sans body font
- Security headers in next.config.ts (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- .env.example with all variable names
- Root / redirects to /dashboard

### Files created/modified

**New files:**
- src/lib/supabase/client.ts
- src/lib/supabase/server.ts
- src/lib/supabase/service.ts
- src/lib/auth/role.ts
- src/proxy.ts
- src/app/(auth)/layout.tsx
- src/app/(auth)/login/page.tsx
- src/app/(auth)/forgot-password/page.tsx
- src/app/(auth)/reset-password/page.tsx
- src/app/api/auth/callback/route.ts
- src/app/(app)/layout.tsx
- src/app/(app)/dashboard/page.tsx
- src/components/layout/AppShell.tsx
- src/components/layout/Sidebar.tsx
- src/components/layout/TopBar.tsx
- src/components/layout/MobileBottomNav.tsx
- src/components/providers/AuthProvider.tsx
- .env.example
- src/components/ui/* (shadcn generated)
- src/lib/utils.ts (shadcn generated)

**Modified files:**
- src/app/layout.tsx - DM Sans font, GGG metadata
- src/app/globals.css - shadcn variables + brand colors (navy, gold)
- src/app/page.tsx - redirects to /dashboard
- next.config.ts - security headers
- package.json - all new dependencies

### Decisions made

- **shadcn/ui v4 uses @base-ui/react** not Radix UI. DropdownMenuTrigger has no asChild prop - used className on the trigger directly.
- **profiles table queried in getCurrentRole** - this will work once the database migration runs in Part 2. Until then, getCurrentRole returns null (user is treated as no role).
- **No dark mode** - removed @custom-variant dark from globals.css since this is an internal tool.

---

## Part 2 - Database (2026-10-01) - spec update + Part 2

### Spec update

Updated CRM-SPEC.md section 3: fonts changed from Gotham/Adobe Fonts to Poppins (headings) + DM Sans (body), both via next/font/google. Applied to app: src/app/layout.tsx now loads both fonts, globals.css uses --font-heading: var(--font-heading).

### What was built

- One migration file: supabase/migrations/20261001000000_initial_schema.sql
- Supabase re-initialised and linked in the project directory (supabase/ dir)
- Migration pushed to live database: `npx supabase db push`
- TypeScript types generated: src/lib/database.types.ts
- Supabase clients (client.ts, server.ts, service.ts) updated to use Database generic type

**Migration includes:**

Extensions: pg_cron, pg_net

Enums: app_role, lead_source, lead_stage, consent_type, event_type, event_status, participant_status, assessment_recommendation, invoice_status, email_format, campaign_status, message_status, activity_type

Tables (25 total): profiles, contacts, players, player_contacts, leads, events, event_participants, activities, tasks, assessments, document_types, event_document_requirements, documents, document_request_tokens, invoices, invoice_items, payments, email_templates, email_campaigns, email_attachments, email_messages, posts, settings, ingest_field_mappings, ingest_log

Triggers:
- set_updated_at() applied to all tables with updated_at column
- sync_birth_year() on players: derives birth_year from dob on insert/update
- recalculate_invoice_paid() on payments: keeps invoices.amount_paid_cents accurate, auto-sets status to part_paid/paid
- handle_new_user() on auth.users: auto-creates a profiles row on invite/signup

Functions:
- public.current_role() - security definer, returns caller's app_role from profiles
- next_invoice_number() - security definer, atomically increments settings.invoice_next_number, returns formatted string (eg GGG-0001)
- check_in_participant(participant_id, status) - security definer RPC for coach check-in (only allows attended/no_show)

Views (SECURITY INVOKER - respect caller's RLS):
- coach_event_participants: event_participants without financial/lead columns
- coach_players: players with sporting + safety columns only (excludes notes, eligibility_notes)
- coach_emergency_contacts: player_contacts joined to contacts, emergency contacts only, name + phone only

RLS: Enabled on all 25 tables. Admin has full read/write everywhere. Coach has SELECT on events, event_participants, players, player_contacts, document_types; SELECT on emergency contacts only; SELECT+INSERT+UPDATE own on assessments. No anon access to any table.

Storage buckets: documents (private, 15MB limit), invoices (private), email-attachments (private), player-photos (private), blog-media (public). Storage RLS policies set for admin/coach access.

Seed data: 1 settings row, 8 document types, 6 email templates (event invite, trial reminder, trial follow-up, document request, invoice email, newsletter starter)

Cron job: pg_cron job "run-crm-jobs" scheduled every 5 minutes, calls https://crm.gingaglobalgroup.com/api/cron/run with x-cron-secret read from Supabase Vault (name: 'cron_secret'). Will must add the secret to Vault before the job works - see manual steps below.

### Files created/modified

**New files:**
- supabase/config.toml
- supabase/.gitignore
- supabase/migrations/20261001000000_initial_schema.sql
- src/lib/database.types.ts (generated)

**Modified files:**
- src/app/layout.tsx - added Poppins font
- src/app/globals.css - --font-heading now points to Poppins variable
- src/lib/supabase/client.ts - typed with Database generic
- src/lib/supabase/server.ts - typed with Database generic
- src/lib/supabase/service.ts - typed with Database generic
- docs/CRM-SPEC.md - section 3 updated (Poppins instead of Gotham/Adobe Fonts)

### Decisions made

- **activity_type added as an enum** (not in spec's enum list but the type field values are enumerable). This gives type safety on the activities table.
- **birth_year**: regular int column with BEFORE trigger deriving it from dob when dob is set. If dob is null, birth_year can be entered directly.
- **profiles default role is 'coach'**: safe default for invites. Will's admin role is set via SQL after first invite (see manual steps). The Users UI in Part 3 will pass role in user_metadata so handle_new_user() picks it up.
- **coach_event_participants excludes**: source_lead_id (lead info, admin only). All logistics columns included (coaches need them for tour mode).
- **Cron job references Vault**: secret never hard-coded in migration. Job will silently fail auth until secret is added to Vault.
- **pg_cron/pg_net**: these extensions must be enabled by Supabase project settings before the migration runs. They are available on all Supabase projects by default. Migration uses `CREATE EXTENSION IF NOT EXISTS` to be safe.

---

## Manual steps Will must do BEFORE the next Part (Part 3 - Settings and users)

### Step 1 - Set up Vercel and connect the repo (if not done yet)

1. Go to https://vercel.com and sign in
2. Click "Add New Project"
3. Import the GitHub repo: bywillvass/ggg-crm
4. On the Configure Project page, open "Environment Variables" and add all variables from .env.example with their real values (copy from your local .env.local)
5. Click Deploy

### Step 2 - Add the custom domain in Vercel (if not done yet)

1. In your Vercel project, go to Settings -> Domains
2. Add: crm.gingaglobalgroup.com
3. Follow Vercel's instructions to add a CNAME or A record in your DNS provider

### Step 3 - Disable public signups in Supabase Auth (IMPORTANT - do this now)

1. Go to: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq/auth/configuration
2. Under "User Signups", toggle "Disable Signup" to ON
3. Click Save

### Step 4 - Make yourself admin (do this now)

1. Go to: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq/auth/users
2. Click "Invite user"
3. Enter your email: williamvass6@gmail.com
4. Click "Send invite" - check your email and click the link, then set a password
5. Go to: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq/sql
6. Run this SQL:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'williamvass6@gmail.com';
   ```
7. Sign in to the CRM at http://localhost:3000/login (or the Vercel URL) to confirm it works

### Step 5 - Add CRON_SECRET to Supabase Vault (so the cron job can call the API)

1. Go to: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq/sql
2. Run this SQL (replace YOUR_CRON_SECRET with the value from your .env.local):
   ```sql
   SELECT vault.create_secret('YOUR_CRON_SECRET', 'cron_secret', 'CRM cron job secret');
   ```
   For example, if your CRON_SECRET is `8007e11d61a76...`:
   ```sql
   SELECT vault.create_secret('8007e11d61a76240c44e0e08ebd7b6b19b03c5eac5147f9080e7cfcd44b8139e', 'cron_secret', 'CRM cron job secret');
   ```
3. The cron job will now send the correct secret header when calling /api/cron/run

### Step 6 - Verify pg_cron is running (optional check)

1. Go to: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq/sql
2. Run:
   ```sql
   SELECT jobname, schedule, command FROM cron.job;
   ```
3. You should see a row with jobname "run-crm-jobs" and schedule "*/5 * * * *"

---

## Part 3 - Settings and users (2026-10-01)

### What was built

Settings page (`/settings`) - admin only, tabbed interface with 9 tabs:
1. General - org_name, abn, address, phone, email, website, logo URL
2. Bank - account name, BSB, account number, PayID
3. Invoices - GST toggle, GST rate, prefix, next number, payment terms, footer
4. Email - from name/address, reply-to, footer HTML, daily cap
5. Users - list all profiles, invite by email+name+role, change role, deactivate/reactivate
6. Document types - list/add/edit document_types rows
7. Field mappings - list/add/edit/delete ingest_field_mappings rows
8. Templates - list/add/edit/delete email_templates rows
9. Integrations - last ingest received per source, recent errors, last blog sync

Account page (`/settings/account`) - any logged-in user:
- Shows email, name, role badge
- Password reset via email link
- MFA: enrol TOTP (QR code + secret + verification code), or unenrol if already enrolled

New UI components:
- `src/components/ui/textarea.tsx` - native textarea styled
- `src/components/ui/switch.tsx` - styled toggle switch (button with role="switch")
- `src/components/ui/select.tsx` - native select styled
- `src/components/ui/badge.tsx` - inline badge with default/success/warning/destructive/secondary variants

### Files created

- src/components/ui/textarea.tsx
- src/components/ui/switch.tsx
- src/components/ui/select.tsx
- src/components/ui/badge.tsx
- src/app/(app)/settings/layout.tsx
- src/app/(app)/settings/page.tsx
- src/app/(app)/settings/SettingsShell.tsx
- src/app/(app)/settings/actions.ts
- src/app/(app)/settings/users/actions.ts
- src/app/(app)/settings/account/page.tsx
- src/app/(app)/settings/account/AccountShell.tsx
- src/app/api/admin/invite/route.ts
- src/components/settings/GeneralSettings.tsx
- src/components/settings/BankSettings.tsx
- src/components/settings/InvoiceSettings.tsx
- src/components/settings/EmailSettings.tsx
- src/components/settings/UsersSettings.tsx
- src/components/settings/DocumentTypesSettings.tsx
- src/components/settings/FieldMappingsSettings.tsx
- src/components/settings/TemplatesSettings.tsx
- src/components/settings/IntegrationsStatus.tsx

### Decisions made

- **Zod v4 coerce.number() + hookform resolvers**: The `@hookform/resolvers/zod` resolver infers `unknown` for `z.coerce.number()` types in zod v4 at the TypeScript level. Fixed by using `z.string()` for number input fields and converting to numbers manually in the submit handler.
- **DialogTrigger asChild**: base-ui Dialog.Trigger doesn't support `asChild` prop. Used controlled open state (`dialogOpen` + `setDialogOpen`) and a plain Button with `onClick` instead of wrapping in DialogTrigger.
- **Logo upload**: Spec mentions logo upload; implemented as URL field instead since no dedicated storage bucket was set up. Will can paste a Supabase storage URL from the blog-media bucket.
- **Settings page tab routing**: uses `useSearchParams()` + `router.replace()` wrapped in Suspense (required by Next.js 16 for `useSearchParams` in client components).
- **Account page MFA**: uses browser Supabase client (must be client-side). QR code rendered via Next.js Image component with `unoptimized` since it's a data URL.
- **API route for invite**: `/api/admin/invite` exists as a REST endpoint using `serviceClient`. The server action in `users/actions.ts` calls `serviceClient` directly (server action, so safe). The API route provides an alternative HTTP interface.
- **IntegrationsStatus errors**: queries `ingest_log` with `status = 'error'` (not 'failed') to match the seed/schema enum values used in the migration.
- **Database trigger**: The `handle_new_user` trigger from Part 2 is confirmed correct - it creates a profiles row on every new auth.users insert, defaulting role to 'coach'. No new migration needed.

---

## Manual steps Will must do BEFORE the next Part (Part 4 - Contacts, players, leads, tasks, activities)

### Step 1 - Complete the Part 2 manual steps first (if not done)

If you haven't already done Steps 1-6 from the Part 2 manual steps above, do those first. In particular:
- Disable public signups (Step 3)
- Make yourself admin (Step 4)
- Add CRON_SECRET to Vault (Step 5)

### Step 2 - Verify settings page works

1. Start the dev server: `npm run dev`
2. Sign in at http://localhost:3000/login
3. Go to http://localhost:3000/settings
4. Confirm all 9 tabs are visible: General, Bank, Invoices, Email, Users, Document Types, Field Mappings, Templates, Integrations
5. On the General tab, fill in your org details and click Save

### Step 3 - Invite Theo and Marcos (when ready)

1. Go to http://localhost:3000/settings?tab=users (or the deployed URL)
2. Click "Invite user"
3. Enter their email, name, and role (admin for Theo, coach for Marcos)
4. They will receive an invite email - they click the link, set a password, and can sign in

### Step 4 - Set up your email settings (required for email to work in Part 9)

1. Go to http://localhost:3000/settings?tab=email
2. Fill in the From Name, From Address (must be a verified Resend domain), and Reply-To
3. Click Save

### Step 5 - MFA (recommended for admins)

1. Go to http://localhost:3000/settings/account
2. Under "Two-factor authentication", click "Enrol authenticator"
3. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
4. Enter the 6-digit code to verify and complete enrolment

---

## Part 4 - Contacts, players, leads, tasks, activities (2026-10-01)

### What was built

**Infrastructure:**
- `src/lib/activity.ts` - `logActivity()` helper used by all server actions to write to the activities table
- `src/app/(app)/activities/actions.ts` - `logManualActivity` server action for notes, calls, SMS, WhatsApp from the UI

**Server actions (all admin-gated via requireAdmin()):**
- `src/app/(app)/contacts/actions.ts` - listContacts (with search/filter), getContact (with all relations), createContact, updateContact, archiveContact, mergeContacts (service-role, moves all relations), addTagToContact, removeTagFromContact
- `src/app/(app)/players/actions.ts` - listPlayers, getPlayer (with all relations), createPlayer, updatePlayer, archivePlayer, linkPlayerContact, unlinkPlayerContact
- `src/app/(app)/leads/actions.ts` - listLeads, getLead, createLead (with activity log), updateLead, updateLeadStage (with activity log), archiveLead, bulkUpdateStage, bulkAssignOwner, bulkArchive, importCSVLeads (POSTs to /api/ingest - works once Part 5 is done)
- `src/app/(app)/tasks/actions.ts` - listTasks, createTask, updateTask, completeTask, deleteTask, getProfiles

**API:**
- `src/app/api/search/route.ts` - GET /api/search?q= - searches contacts, players, leads, events. Role-aware: coaches skip contacts and leads.

**Shared components:**
- `src/components/shared/ActivityTimeline.tsx` - shows activities list with icons per type, newest first
- `src/components/shared/AddActivityDialog.tsx` - controlled dialog to log note/call/SMS/WhatsApp
- `src/components/shared/AddTaskDialog.tsx` - controlled dialog to create a task
- `src/components/shared/TaskList.tsx` - checkable task list with context links and delete

**Contacts:**
- `src/components/contacts/ContactsShell.tsx` - table with search + filters (consent, source, unsubscribed), bulk select + bulk actions (add tag, archive), new contact dialog, pagination (25/page)
- `src/components/contacts/ContactDetail.tsx` - 6-tab detail view: Overview (editable), Players, Leads, Emails, Timeline, Tasks. Header has archive + merge buttons.
- `src/components/contacts/MergeContactsDialog.tsx` - pick duplicate, preview side-by-side, merge

**Players:**
- `src/components/players/PlayersShell.tsx` - table with filters (birth year, position, club, level, state, status), new player dialog, pagination
- `src/components/players/PlayerDetail.tsx` - 8-tab profile: Profile (editable), Guardians (tap-to-call), Events, Assessments, Documents (placeholder), Invoices (placeholder), Timeline, Tasks

**Leads:**
- `src/components/leads/LeadsShell.tsx` - Board (kanban with @dnd-kit drag-drop, 7 stage columns) + Table toggle. Filters: source, form type, stage, owner, date range, follow-up due. Bulk actions: stage, owner, archive, CSV export. New lead dialog. Import link.
- `src/components/leads/LeadDetailSheet.tsx` - Sheet drawer for desktop
- `src/components/leads/LeadDetail.tsx` - detail content (summary, raw submission, quick actions, timeline, stage selector). Shared by sheet and [id] page.

**Leads import:**
- `src/app/(app)/leads/import/page.tsx` - 4-step CSV wizard: upload, preview 20 rows, map columns to targets, choose source/form type, import via /api/ingest, show summary

**Tasks:**
- `src/components/tasks/TasksShell.tsx` - My tasks / All tasks tabs, sub-filters (due today, overdue, upcoming, done), inline check-off, new task dialog

**TopBar updated:**
- Global search: debounced input hits /api/search, shows grouped dropdown (Contacts, Players, Leads, Events), navigates on click

**Pages created:**
- `/contacts` - contacts list
- `/contacts/[id]` - contact detail
- `/players` - players list
- `/players/[id]` - player profile
- `/leads` - board + table view
- `/leads/[id]` - lead detail (full page, same content as sheet)
- `/leads/import` - CSV import wizard
- `/tasks` - tasks list (admin only)

### Decisions made

- **CSV import calls /api/ingest**: The import server action POSTs to /api/ingest. This will return 404 until Part 5 builds that endpoint. The UI is fully built; it just won't complete until Part 5 is deployed.
- **Contacts list is client-side filtered**: Contacts are fetched server-side (all matching archived=false) and filtered in the browser. Fine for typical agency scale (hundreds of contacts). Avoids extra API calls on each filter change.
- **Leads board is client-side filtered from initial server fetch**: Same approach as contacts. On drag-end, the stage update calls the server action and the local state updates optimistically.
- **mergeContacts uses service role**: Needed to bypass RLS when re-assigning all relations from the duplicate contact to the master.
- **Invoices and Documents tabs on player detail are placeholders**: They render a "Coming in Part 7/10" message. Wired properly once those Parts are built.
- **Tasks page is admin-only**: Coach is redirected to /dashboard. Coach tasks are visible in the detail pages (lead, contact, player) but the standalone /tasks page is admin.
- **importCSVLeads uses field alias targets as column values**: The UI maps CSV column headers to target names (e.g. "contact_email"). The server action passes these mapped field names directly in the `fields` object. Part 5's /api/ingest normalises them to built-in defaults.

---

## Manual steps Will must do BEFORE the next Part (Part 5 - Lead ingestion)

### Step 1 - Complete all previous manual steps first

Make sure you have done all steps from Part 2 and Part 3 manual sections (especially: admin account, disable public signups, Vault secret).

### Step 2 - Test Part 4 screens

1. Start the dev server: `npm run dev`
2. Sign in and verify these pages load without errors:
   - http://localhost:3000/contacts
   - http://localhost:3000/players
   - http://localhost:3000/leads
   - http://localhost:3000/tasks
3. Create a test contact: go to /contacts, click "New contact", fill in the form, click Save
4. Create a test player and link it to the contact from the player's Guardians tab
5. Create a test lead from /leads -> "New lead"
6. Test the kanban board: drag a lead card between stage columns
7. Test global search: type a name in the top bar search
8. The CSV import (/leads/import) is fully built but the actual import won't complete until Part 5 (the /api/ingest endpoint). The upload and column-mapping steps will work; clicking "Import" will show an error until Part 5.

### Step 3 - No database migrations needed for Part 4

Part 4 is all UI and server actions using the existing schema from Part 2. No new migrations are required.

---

## Part 5 - Lead ingestion (2026-10-01)

### What was built

**API:**
- `src/app/api/ingest/route.ts` - POST /api/ingest with the full processing pipeline from spec section 8.2.

Processing pipeline in detail:
1. Validates `x-ingest-secret` header against `INGEST_SECRET` env var (401 if missing/wrong).
2. Parses JSON body: `{ leads: [...] }`.
3. Loads custom `ingest_field_mappings` rows from the DB once per request (shared across all leads in the batch).
4. For each lead:
   - **Idempotency**: checks `ingest_log` for the `external_id` - returns `duplicate` if found.
   - **Normalises** field keys (lowercase, strip non-a-z0-9).
   - **Maps fields** to targets: custom mappings (form-specific beats global), then built-in defaults.
   - **Newsletter** form type: upserts the contact with `marketing_consent = 'express'`, adds tag `newsletter`, clears `unsubscribed_at` (explicit re-subscribe), logs a note activity, writes `ingest_log`. No lead row created.
   - **All other forms**: finds or creates a contact (match by email first, then phone; fills empty fields only, never overwrites). Finds or creates a player and links to the contact if player fields are present (match by first name + birth year; `relationship = guardian` if parent-specific field detected, else `self`). Creates a lead row with stage `new`. Logs `lead_created` activity. Writes `ingest_log` with status `created` (new contact) or `merged` (existing contact).
   - Errors are caught per-lead: the batch continues, the error is written to `ingest_log` with status `error`.

Phone numbers normalised to E.164 (AU default) using `libphonenumber-js`.

**Integration scripts:**
- `integrations/website-Code.gs` - full replacement for the website Apps Script:
  - `doPost`: honeypot (`company` field), formType routing, appends to sheet tab by formType, forwards to CRM with `external_id = website:<formType>:<row>`, source `website`.
  - `doGet`: fetches and returns `blog-posts.json` from GitHub for the website's blog section.
  - `syncBlogToGitHub`: reads from a "BlogPosts" sheet tab and commits to GitHub. Keep this function but delete its trigger once the CRM blog (Part 10) goes live.
  - Reads `CRM_INGEST_URL` and `CRM_INGEST_SECRET` from Script Properties. CRM forward is wrapped in its own try/catch so failures never break the sheet write or the website response. Uses `muteHttpExceptions: true`.
- `integrations/meta-sheet-sync.gs` - bound to the Meta leads Google Sheet:
  - `syncNewLeads()`: reads new rows per tab, posts in batches of 50 to `/api/ingest`, advances row pointer only on success. Skips tabs starting with `_`.
  - `backfillAll()`: resets all row pointers and resends everything.
  - `setupTrigger()`: creates a 5-minute time-driven trigger (removes duplicates first).
  - Uses `external_id = meta:<id column value>` or `metasheet:<tab>:<row>`.
- `integrations/README.md` - exact setup steps for both scripts.

**Settings and status (already built in Part 3, fully wired):**
- `FieldMappingsSettings.tsx` - UI to add/edit/delete `ingest_field_mappings` rows. Works via Part 3 server actions.
- `IntegrationsStatus.tsx` - shows last received timestamp per source and recent errors from `ingest_log`. Data from `getIntegrationsStatus()` in settings/actions.ts.

### Files created/modified

**New files:**
- src/app/api/ingest/route.ts
- integrations/website-Code.gs
- integrations/meta-sheet-sync.gs
- integrations/README.md

**No files modified** (Settings mapping UI and integration status panel were fully built in Part 3 and require no changes.)

### Decisions made

- **newsletter form type check is case-insensitive** (`formType?.toLowerCase() === 'newsletter'`). Any capitalisation works.
- **Newsletter always clears unsubscribed_at**: if someone fills out a newsletter form they are explicitly opting in - clears the previous unsubscribe. If you want to not re-subscribe previously unsubscribed contacts, you can remove the `unsubscribed_at: null` line from `upsertNewsletterContact` in the route.
- **Player relationship detection**: checks if any parent-specific field (parentname, guardianemail, etc.) was present in the submission. If yes, `relationship = guardian`; if no, `relationship = self`. This handles adult players filling in their own form.
- **source_detail priority**: payload-level `source_detail` field (set by the Apps Script) takes precedence over the `campaign` field-mapping target. This matches the spec intent (website sets source_detail directly as the page URL; campaign names from Meta form fields use the campaign mapping).
- **website-Code.gs uses the actual existing script**: The user provided their real Apps Script after the initial build. The file has been updated to match it exactly (ES6 syntax, `doGet` reads from a 'Blog' sheet tab, `syncBlogToGitHub` reads from a 'Blog' tab). One fix was applied: the `external_id` had a timestamp appended (`':' + new Date().getTime()`) which would break idempotency - removed so it is `website:<formType>:<row>` exactly as the spec requires.
- **No new DB migrations**: all tables (ingest_log, ingest_field_mappings, contacts, players, leads, activities) were created in Part 2.

---

## Manual steps Will must do BEFORE the next Part (Part 6 - Events)

### Step 1 - Set up website-Code.gs

The `website-Code.gs` file matches your actual existing script exactly, with one fix: the `external_id` no longer includes a timestamp (which would have broken idempotency). Everything else is identical to your existing code. Follow these steps:

1. Open your website's Google Sheet.
2. Go to Extensions -> Apps Script.
3. Replace the Code.gs contents with the contents of `integrations/website-Code.gs`.
4. Go to Project Settings (gear icon) -> Script properties. Add:
   - `CRM_INGEST_URL` = `https://crm.gingaglobalgroup.com/api/ingest`
   - `CRM_INGEST_SECRET` = your `INGEST_SECRET` from `.env.local`
   - `GITHUB_TOKEN` = your GitHub personal access token (repo scope)
   - `GITHUB_REPO` = `bywillvass/ginga-global-group-site`
   - `GITHUB_BLOG_FILE` = `blog-posts.json`
   - `GITHUB_BRANCH` = `main`
5. Click Deploy -> Manage deployments.
6. Click the pencil icon next to your existing deployment.
7. Under Version, choose "New version" (NOT a new deployment - the URL must stay the same).
8. Click Deploy.
9. Test by submitting one of your website forms and checking that a new lead appears in the CRM at https://crm.gingaglobalgroup.com/leads.

### Step 2 - Set up meta-sheet-sync.gs

1. Open the Google Sheet that receives Meta instant form leads.
2. Go to Extensions -> Apps Script.
3. Click + next to Files, name the new file `meta-sheet-sync`.
4. Paste the contents of `integrations/meta-sheet-sync.gs`.
5. Go to Project Settings -> Script properties. Add the same `CRM_INGEST_URL` and `CRM_INGEST_SECRET` as above.
6. In the function dropdown, select `setupTrigger` and click Run. Approve the permissions popup.
7. To send all existing rows now: select `backfillAll` and click Run.

### Step 3 - Verify the ingest API directly (optional)

1. From your terminal, run:
   ```
   curl -X POST https://crm.gingaglobalgroup.com/api/ingest \
     -H "x-ingest-secret: <your INGEST_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"leads":[{"external_id":"test:001","source":"website","form_type":"Test","fields":{"Parent Name":"Test Parent","Email":"test@example.com","Player Name":"Test Player","Birth Year":"2012"}}]}'
   ```
2. You should get `{"ok":true,"results":[{"external_id":"test:001","status":"created",...}]}`.
3. Check the CRM at /leads to see the new lead, and /contacts for the new contact.

### Step 4 - No database migrations needed for Part 5

All tables were created in Part 2. No new migrations are required.

---

## Part 6 - Events (2026-10-01)

### What was built

**Server actions** (`src/app/(app)/events/actions.ts`):
- `listEvents` - with filters: type, status, timeframe (upcoming/past/all), search. Accessible by admin and coach.
- `getEvent` - full event with participants (including player + contact relations), sub-events (separate query to avoid self-referential FK issues), and parent event. Accessible by admin and coach.
- `createEvent` - admin only, logs activity.
- `updateEvent` - admin only.
- `archiveEvent` - admin only.
- `addParticipant` - add player or contact to event. Auto-waitlists when at capacity. Admin only.
- `addWalkIn` - create player + contact inline and add as attended. Admin only.
- `updateParticipantStatus` - admin only, with activity log.
- `bulkUpdateParticipantStatus` - admin only.
- `removeParticipant` - admin only.
- `checkInParticipant` - calls `check_in_participant` RPC (security definer). Accessible by admin and coach.
- `updateParticipantLogistics` - admin only.
- `promoteWaitlist` - auto-promotes first waitlisted participant when a slot opens.
- `searchPlayersForEvent` - search players not already in event.
- `searchLeadsForEvent` - search leads not already added.
- `listEmailTemplates` - for reminder template picker.

**Pages:**
- `/events` - events list (server component, passes data to EventsShell)
- `/events/[id]` - event detail (server component, passes data to EventDetail)

**Components:**
- `src/components/events/EventsShell.tsx` - events list with timeframe toggle (upcoming/past/all), search, type and status filters. Card grid showing date, venue, confirmed/capacity, type pill, status badge. New event dialog with all fields.
- `src/components/events/EventDetail.tsx` - tabbed detail. Admin tabs: Overview, Participants, Check-in, Logistics, Documents (placeholder), Assessments (placeholder), Invoices (placeholder). Coach tabs: Overview, Participants, Check-in, Logistics, Assessments. Edit dialog and archive confirm (admin only). Shows parent event link and sub-events list in Overview.
- `src/components/events/EventParticipantsTab.tsx` - full participants table with search/status filter. Admin: status dropdown per row, bulk status change, add player (search dialog), add from lead (search dialog), add walk-in (inline form), remove, export CSV. Coach: read-only badges.
- `src/components/events/EventCheckInTab.tsx` - mobile-first check-in. Live counts (attended/confirmed/total). Search box, big rows with In/Out buttons. Walk-in dialog. Undo button (note: full undo via Participants tab). Works for admin and coach.
- `src/components/events/EventLogisticsTab.tsx` - logistics/tour mode. Desktop: table with flights, room, shirt, emergency contact, medical alerts. Mobile: card list with emergency tap-to-call, medical alert banner, dietary notes, room. Edit dialog (admin only).

**Player detail update:**
- Events tab in PlayerDetail now links to event detail pages.

### Files created/modified

**New files:**
- src/app/(app)/events/actions.ts
- src/app/(app)/events/page.tsx
- src/app/(app)/events/[id]/page.tsx
- src/components/events/EventsShell.tsx
- src/components/events/EventDetail.tsx
- src/components/events/EventParticipantsTab.tsx
- src/components/events/EventCheckInTab.tsx
- src/components/events/EventLogisticsTab.tsx

**Modified files:**
- src/components/players/PlayerDetail.tsx - Events tab now links to event detail pages

### Decisions made

- **Self-referential FK for sub-events**: Supabase's PostgREST self-join syntax `events!parent_event_id(*)` is ambiguous for sub-events. Used a separate query to fetch sub-events (where `parent_event_id = event.id`) to avoid this issue. Parent event still uses `parent_event:parent_event_id(*)` which works correctly (follows FK from child to parent).
- **check_in_participant RPC for all check-ins**: Both admin and coach use the `check_in_participant` RPC (security definer) for check-ins. This enforces the coach restriction at the DB level (can only set attended/no_show).
- **Undo check-in is UX-only note**: The check-in tab shows an undo button but notes that full undo requires the Participants tab. The RPC only allows attended/no_show - reverting to confirmed is an admin action done via the Participants tab.
- **Walk-in is immediately "attended"**: Walk-ins created from check-in mode are added with status "attended" and checked_in_at set to now. This matches the real-world use case.
- **Waitlist auto-promotion**: When a participant is removed or their status changes away from confirmed/attended, `promoteWaitlist` is called to auto-promote the first waitlisted entry (by created_at).
- **Document requirements for events**: The Documents tab is a placeholder - will be wired in Part 7. The `event_document_requirements` table is already in the schema from Part 2.
- **Email participants button**: Not yet wired (email is Part 9). The spec mentions "email participants filtered by status (opens composer with event_id set)" - this will be added in Part 9 when the composer is built.
- **No new DB migrations**: All tables (events, event_participants, etc.) were created in Part 2.

---

## Manual steps Will must do BEFORE the next Part (Part 7 - Documents)

### Step 1 - Complete all previous manual steps first

Make sure all steps from Parts 2, 3, 4, and 5 are done.

### Step 2 - Test Part 6

1. Start the dev server: `npm run dev`
2. Go to http://localhost:3000/events
3. Create a test event using the "New event" button
4. Open the event and verify all tabs load: Overview, Participants, Check-in, Logistics
5. Add a player to the Participants tab (use "Add player" and search)
6. Go to the Check-in tab and tap "In" for the player - verify the count updates
7. Go to the Logistics tab and click Edit to add flight and room details
8. Test on mobile: open the Check-in tab on a phone, verify the large tap targets and live counts work

### Step 3 - No database migrations needed for Part 6

All tables were created in Part 2. No new migrations are required.

---

## Part 7 - Documents (2026-10-01)

### What was built

**Token utilities** (`src/lib/tokens.ts`):
- `signToken(payload, expiresIn)` - signs HS256 JWT using `TOKEN_SIGNING_SECRET` env var
- `verifyToken<T>(token)` - verifies and decodes JWT, returns null on failure
- `hashToken(token)` - SHA-256 hex hash of token (for DB storage)

**Server actions** (`src/app/(app)/documents/actions.ts`):
- `getEventDocumentMatrix(eventId)` - returns requirements array + participants matrix. Each participant has a `documents` record keyed by `document_type_id`: null (missing) or `{ document_id, file_name, uploaded_via, expires_on, expiring_soon }`. `expiring_soon` is true when `expires_on < event.end_at`.
- `addRequirement / removeRequirement` - manage `event_document_requirements`
- `listDocumentTypes` - all document types ordered by name
- `recordDocument` - inserts document, auto-sets `delete_after` for sensitive types (`event.end_at + retention_days_after_event`)
- `deleteDocument` - removes file from Supabase Storage + deletes DB row
- `getDocumentSignedUrl` - service role `createSignedUrl(path, 60)` - 60 second expiry
- `getAdminUploadPresignedUrl` - service role `createSignedUploadUrl` for admin browser uploads
- `getPlayerDocuments` - all documents for a player with event and document type info, ordered newest first
- `requestMissingDocuments(eventId)` - for each participant with missing required docs: signs JWT, hashes it, upserts `document_request_tokens` row, queues `email_messages` row (status='queued', Part 9 will send them), logs `document_requested` activity. Returns `{ tokens, error }`.

**Event documents tab** (`src/components/events/EventDocumentsTab.tsx`):
- Loads matrix + doc types on mount
- Requirements displayed as removable chips (X button removes requirement)
- "Add requirement" button opens dialog with type select + required checkbox + notes
- Matrix table: rows are participants, columns are requirement types
  - Green check + eye + trash = uploaded (admin can view + delete)
  - Amber clock = expiring before event end
  - Red warning = missing required (shows upload icon for admin)
  - Gray upload = missing optional
- Upload flow: `getAdminUploadPresignedUrl` → `PUT` signedUrl (browser direct upload to Supabase S3) → `recordDocument`
- View: `getDocumentSignedUrl` → opens in new tab
- "Request missing" button → `requestMissingDocuments` → shows copyable upload links dialog

**Public upload page** (`src/app/upload/[token]/page.tsx` + `UploadShell.tsx`):
- Server-rendered page validates JWT + token row (not revoked, not expired, used_count < 100)
- Fetches participant's event + player info, requirements, and already-uploaded doc type IDs
- Branded header: navy + gold "Ginga Global Group" + Document Upload
- Player + event info card
- Per-requirement upload rows: file input (accepts PDF/JPG/PNG/HEIC, max 15MB)
- Three-step upload: `POST /api/upload/presign` → `PUT` signedUrl → `POST /api/upload/confirm`
- Green check + "Received - thank you" state once uploaded per doc
- "Done - all documents submitted" button when all required docs uploaded → success screen

**API routes (public, token-gated)**:
- `POST /api/upload/presign` - verifies JWT + token row, builds storage path, returns `{ signedUrl, path }` from `createSignedUploadUrl`
- `POST /api/upload/confirm` - verifies JWT + token row, computes `delete_after` for sensitive types, inserts `documents` row with `uploaded_via: "parent_link"`, increments `used_count`, logs activity

**Player documents tab** (`src/components/players/PlayerDetail.tsx` updated):
- Added "Documents" tab to player detail (between Events and Assessments)
- Lazy loads documents on first tab visit via `getPlayerDocuments`
- Groups documents by event with event title + date header
- Each document: file icon, file name, type name, view button (opens signed URL), delete button
- Delete removes from both Storage and DB

### Files created/modified

**New files:**
- src/lib/tokens.ts
- src/app/(app)/documents/actions.ts
- src/components/events/EventDocumentsTab.tsx
- src/app/upload/[token]/page.tsx
- src/app/upload/[token]/UploadShell.tsx
- src/app/api/upload/presign/route.ts
- src/app/api/upload/confirm/route.ts

**Modified files:**
- src/components/events/EventDetail.tsx - Documents tab wired to `<EventDocumentsTab>`
- src/components/players/PlayerDetail.tsx - Documents tab added with lazy load + view/delete

### Decisions made

- **Browser-direct upload via presigned URLs**: Files go from browser → Supabase Storage (S3) directly, never through the Next.js server function. Avoids Vercel Hobby plan's 4.5MB serverless body limit.
- **Token hash stored in DB, not raw JWT**: `document_request_tokens.token_hash` stores SHA-256(token). The raw JWT is only ever in URLs. This prevents token exposure from a DB breach.
- **used_count rate limit (max 100)**: Each token can confirm up to 100 uploads. Prevents runaway usage while allowing the family to upload multiple doc versions.
- **Email queued, not sent**: `requestMissingDocuments` creates `email_messages` rows with `status = 'queued'`. Part 9 builds the email processor that will send them via Resend.
- **No new DB migrations**: All tables (documents, document_request_tokens, email_messages, document_types, event_document_requirements) were created in Part 2.
- **verifyToken constraint relaxed to `object`**: Changed `T extends Record<string, unknown>` to `T extends object` so named interfaces like `TokenPayload` can be passed as the generic.

---

## Manual steps Will must do BEFORE the next Part (Part 8)

### Step 1 - Add TOKEN_SIGNING_SECRET to .env.local and Vercel

1. Generate a secret (e.g. `openssl rand -hex 32`)
2. Add to `.env.local`: `TOKEN_SIGNING_SECRET=<your_secret>`
3. In Vercel project Settings → Environment Variables, add `TOKEN_SIGNING_SECRET=<your_secret>`
4. Redeploy (or it will pick up on next deploy)

### Step 2 - Create the Supabase Storage "documents" bucket (if not already done in Part 2)

1. Go to: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq/storage/buckets
2. Confirm the "documents" bucket exists and is set to Private
3. If not, create it: name `documents`, toggle Private, set 15MB file size limit

### Step 3 - Test the Event Documents tab

1. Start the dev server: `npm run dev`
2. Go to an event: http://localhost:3000/events/[event-id]
3. Click the "Documents" tab
4. Add a requirement (e.g. "Passport", required)
5. Upload a file using the upload icon in the matrix
6. Verify the green check and eye/trash icons appear
7. Click the eye icon to view the file (should open signed URL in new tab)
8. Click "Request missing" to generate upload links for participants with missing docs

### Step 4 - Test the public upload page

1. From Step 3's "Request missing", copy one of the generated upload links
2. Open it in an incognito browser window (not logged in to the CRM)
3. Verify the page shows the player name and event correctly
4. Upload a test document
5. Verify the green check appears and the file is visible in the CRM event documents tab

### Step 5 - No database migrations needed for Part 7

All tables were created in Part 2. No new migrations are required.
