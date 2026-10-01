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

## Part 3 - Settings and users (not started)

Coming next session.
