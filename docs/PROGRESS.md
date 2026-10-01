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
- **Gotham font not set up yet.** The website repo does not have an Adobe Fonts kit URL (it uses Poppins as a placeholder). DM Sans is used everywhere for now. Once Will gets the Adobe Fonts kit, add the `<link>` tag inside the `<head>` in src/app/layout.tsx and the Gotham variable to globals.css.
- **profiles table queried in getCurrentRole** - this will work once the database migration runs in Part 2. Until then, getCurrentRole returns null (user is treated as no role).
- **No dark mode** - removed @custom-variant dark from globals.css since this is an internal tool.

---

## Manual steps Will must do BEFORE the next Part (Part 2 - Database)

### Step 1 - Set up Vercel and connect the repo

1. Go to https://vercel.com and sign in
2. Click "Add New Project"
3. Import the GitHub repo: bywillvass/ggg-crm
4. On the Configure Project page, open "Environment Variables" and add all variables from .env.example with their real values (copy from your local .env.local)
5. Click Deploy

### Step 2 - Add the custom domain in Vercel

1. In your Vercel project, go to Settings -> Domains
2. Add: crm.gingaglobalgroup.com
3. Follow Vercel's instructions to add a CNAME or A record in your DNS provider

### Step 3 - Set up Adobe Fonts (Gotham) - do this when ready

1. Go to https://fonts.adobe.com and open your existing kit
2. Add `crm.gingaglobalgroup.com` and `localhost` to the kit's allowed domains
3. Copy the kit embed link (looks like: https://use.typekit.net/XXXXXXX.css)
4. Open src/app/layout.tsx and replace the TODO comment with:
   `<link rel="stylesheet" href="https://use.typekit.net/XXXXXXX.css" />`
5. In src/app/globals.css, update `--font-sans: var(--font-sans)` in @theme to use the Gotham variable if needed

### Step 4 - Make yourself admin (do AFTER Part 2 database is pushed)

1. Go to your Supabase project: https://supabase.com/dashboard/project/iaigtvfdteagnvkljvcq
2. Go to Authentication -> Users
3. Click "Invite user"
4. Enter your email: williamvass6@gmail.com
5. Click "Send invite" - you will receive an email, click the link and set your password
6. Now go to SQL Editor in Supabase and run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'williamvass6@gmail.com';
   ```
7. Sign in to the CRM at https://crm.gingaglobalgroup.com/login with your email and password

### Step 5 - Disable public signups in Supabase Auth

1. Go to Authentication -> Configuration -> Auth Providers
2. Under Email, uncheck "Enable email confirmations" if you want invite-only flow
3. Go to Authentication -> Configuration -> General
4. Make sure "Enable email confirmations" is set appropriately
5. To fully disable signups: go to Authentication -> Policies and ensure there is no policy allowing INSERT on auth.users for anon

Note: The cleanest way is to go to Authentication -> Configuration -> General and set "Disable Signup" to ON.

---

## Part 2 - Database (not started)

Coming next session.
