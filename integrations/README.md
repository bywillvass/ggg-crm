# GGG CRM - Integrations

These files connect external lead sources to the CRM ingest API (`POST /api/ingest`).

---

## website-Code.gs - Website form handler

**What it does:**
- Receives POST requests from your website contact forms.
- Checks the `company` honeypot field to block spam bots.
- Appends submissions to a Google Sheet tab named after the `formType` field.
- Forwards every submission to the CRM at `/api/ingest`.
- `doGet` serves the current blog posts JSON to the website.
- `syncBlogToGitHub` pushes blog posts from a "BlogPosts" sheet tab to GitHub.

**IMPORTANT - about your existing script:**

The `website-Code.gs` file was written based on the spec description of your existing script. Before deploying, compare it with your actual script and make sure the sheet-writing logic in `appendSubmission()` matches your existing column structure. If you have custom columns, tab names, or sheet logic, update `appendSubmission()` to match.

**Setup steps:**

1. Open your website's Google Sheet.
2. Go to **Extensions -> Apps Script**.
3. Replace the existing Code.gs contents with the contents of `website-Code.gs`.
4. Open **Project Settings** (gear icon on the left) -> **Script properties**.
5. Add these properties (click "Add property" for each):
   - `CRM_INGEST_URL` = `https://crm.gingaglobalgroup.com/api/ingest`
   - `CRM_INGEST_SECRET` = your `INGEST_SECRET` value from `.env.local`
   - `GITHUB_TOKEN` = your GitHub personal access token (repo scope)
   - `GITHUB_REPO` = `bywillvass/ginga-global-group-site`
   - `GITHUB_BLOG_FILE` = `blog-posts.json`
   - `GITHUB_BRANCH` = `main`
6. Click **Deploy -> Manage deployments**.
7. Click the pencil icon next to your existing deployment.
8. Under Version, choose **"New version"** (do NOT create a new deployment - the URL must stay the same).
9. Click **Deploy**.

**After CRM blog (Part 10) is live:**

Delete the time-driven trigger for `syncBlogToGitHub` so the CRM controls the blog:
1. In Apps Script, click the clock icon on the left (Triggers).
2. Find the trigger for `syncBlogToGitHub`.
3. Click the three-dot menu -> **Delete trigger**.

---

## meta-sheet-sync.gs - Meta instant form sync

**What it does:**
- Runs every 5 minutes on a time-driven trigger.
- Reads new rows from every non-underscore tab in the Meta leads sheet.
- Posts them to the CRM as `meta_instant_form` leads in batches of 50.
- Only advances the row pointer after a successful API response (safe to retry).
- `backfillAll()` resets all pointers and resends everything (safe - API is idempotent).

**Setup steps:**

1. Open the Google Sheet that receives Meta instant form leads.
2. Go to **Extensions -> Apps Script**.
3. Click the **+** next to Files to add a new script file, name it `meta-sheet-sync`.
4. Paste the contents of `meta-sheet-sync.gs` into it.
5. Open **Project Settings -> Script properties** and add:
   - `CRM_INGEST_URL` = `https://crm.gingaglobalgroup.com/api/ingest`
   - `CRM_INGEST_SECRET` = your `INGEST_SECRET` value from `.env.local`
6. In the function dropdown at the top, select `setupTrigger` and click **Run**.
   - This creates the 5-minute trigger. You only need to do this once.
7. To send all existing rows now: select `backfillAll` and click **Run**.

**Tab naming:**
- Each Meta ad form's leads should be on a tab named after the form (e.g. "EliteNeonCup2025Leads").
- Tabs starting with `_` are skipped - use `_Config`, `_Notes` etc for housekeeping tabs.

---

## CRM ingest API

`POST /api/ingest` with header `x-ingest-secret: <INGEST_SECRET>`

**Request:**
```json
{
  "leads": [
    {
      "external_id": "website:EliteNeonCup:42",
      "source": "website",
      "form_type": "EliteNeonCup",
      "source_detail": "/elite-neon-cup.html",
      "submitted_at": "2026-10-01T01:23:45.000Z",
      "fields": {
        "Parent Name": "John Smith",
        "Email": "john@example.com",
        "Phone": "0412 345 678",
        "Player Name": "Sam Smith",
        "Birth Year": "2011"
      }
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "results": [
    {
      "external_id": "website:EliteNeonCup:42",
      "status": "created",
      "lead_id": "uuid...",
      "error": null
    }
  ]
}
```

**Status values:**
- `created` - new contact and lead created
- `merged` - lead created for an existing contact
- `duplicate` - same `external_id` already processed (idempotent)
- `error` - processing failed (see `error` field)

**Field mapping:**
The API automatically maps common field names to CRM fields (e.g. "Email" -> contact email, "Player Name" -> player name). You can add custom mappings in the CRM at **Settings -> Field Mappings**.
