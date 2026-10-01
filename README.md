# GGG CRM

Internal CRM for Ginga Global Group.

## Setup

### Prerequisites
- Node.js 18+
- Supabase project (linked)
- Resend account
- GitHub PAT (for blog sync)

### Install
```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (never expose to client) |
| TOKEN_SIGNING_SECRET | 32+ char secret for JWT tokens (openssl rand -hex 32) |
| CRON_SECRET | Secret for /api/cron/run (openssl rand -hex 32) |
| RESEND_API_KEY | Resend API key |
| RESEND_WEBHOOK_SECRET | Resend webhook signing secret |
| GITHUB_TOKEN | GitHub PAT with repo write access (for blog sync) |
| GITHUB_REPO | GitHub repo for blog (e.g. bywillvass/ginga-global-group-site) |
| GITHUB_BLOG_FILE | Path to blog JSON in repo (e.g. blog-posts.json) |
| GITHUB_BRANCH | Branch to commit blog to (e.g. main) |

### Database

Push migrations:
```bash
npx supabase db push
```

Generate types:
```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

### First admin user

1. Go to Supabase dashboard → Authentication → Users → Invite user (use your email)
2. Accept invite, set password
3. Run this SQL in Supabase SQL editor:
```sql
UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

### Cron job (Supabase)

The cron migration sets this up automatically on `db push`. To store the secret in Vault manually:
```sql
SELECT vault.create_secret('your-cron-secret-here', 'cron_secret');
```
Replace `your-cron-secret-here` with the value of `CRON_SECRET` from your `.env.local`.

### Blog sync

After blog is live, delete the `syncBlogToGitHub` trigger in your Google Apps Script (Apps Script → Triggers). Keep the function but remove the time-based trigger so the CRM controls publishing.

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```
