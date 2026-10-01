# GGG CRM - Build Progress

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
