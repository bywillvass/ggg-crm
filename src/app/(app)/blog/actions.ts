"use server"

import { requireAdmin } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { logActivity } from "@/lib/activity"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types"

export type PostRow = Tables<"posts">

export type PostInput = {
  title: string
  slug: string
  category: string
  tags: string[]
  excerpt?: string | null
  body_html?: string | null
  cover_image_url?: string | null
  author?: string | null
  seo_title?: string | null
  seo_description?: string | null
}

// ─── HTML ↔ Plain text converters ────────────────────────────────────────────

function htmlToPlainText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, "[img:$1]")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function plainTextToHtml(text: string): string {
  return (text || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\[img:(.+?)\]$/)
      if (m) return `<img src="${m[1]}" alt="" />`
      return `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    })
    .join("")
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listPosts(): Promise<PostRow[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
  return (data ?? []) as PostRow[]
}

export async function getPost(id: string): Promise<PostRow | null> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from("posts").select("*").eq("id", id).single()
  return data as PostRow | null
}

export async function createPost(input: PostInput): Promise<PostRow> {
  await requireAdmin()
  const supabase = await createClient()

  const insert: TablesInsert<"posts"> = {
    title: input.title,
    slug: input.slug,
    category: input.category,
    tags: input.tags,
    excerpt: input.excerpt ?? null,
    body_html: input.body_html ?? null,
    cover_image_url: input.cover_image_url ?? null,
    author: input.author ?? null,
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    published: false,
  }

  const { data, error } = await supabase.from("posts").insert(insert).select().single()
  if (error) throw new Error(error.message)

  await logActivity({
    type: "note",
    body: `Blog post created: "${input.title}"`,
  })

  return data as PostRow
}

export async function updatePost(id: string, input: PostInput): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const updates: TablesUpdate<"posts"> = {
    title: input.title,
    slug: input.slug,
    category: input.category,
    tags: input.tags,
    excerpt: input.excerpt ?? null,
    body_html: input.body_html ?? null,
    cover_image_url: input.cover_image_url ?? null,
    author: input.author ?? null,
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("posts").update(updates).eq("id", id)

  if (!error) {
    await logActivity({
      type: "note",
      body: `Blog post updated: "${input.title}"`,
    })
  }

  return { error: error?.message ?? null }
}

export async function deletePost(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("posts")
    .select("published")
    .eq("id", id)
    .single()

  if (existing?.published) {
    return { error: "Cannot delete a published post. Unpublish it first." }
  }

  const { error } = await supabase.from("posts").delete().eq("id", id)
  return { error: error?.message ?? null }
}

export async function publishPost(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("posts")
    .select("published_at")
    .eq("id", id)
    .single()

  const updates: TablesUpdate<"posts"> = {
    published: true,
    updated_at: new Date().toISOString(),
  }
  if (!existing?.published_at) {
    updates.published_at = new Date().toISOString()
  }

  const { error } = await supabase.from("posts").update(updates).eq("id", id)
  if (error) return { ok: false, error: error.message }

  return syncBlogToGitHub()
}

export async function unpublishPost(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("posts")
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }

  return syncBlogToGitHub()
}

// ─── GitHub Sync ──────────────────────────────────────────────────────────────

export async function syncBlogToGitHub(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  try {
    // 1. Get all published posts ordered by published_at desc
    const { data: posts, error: fetchError } = await serviceClient
      .from("posts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })

    if (fetchError) throw new Error(fetchError.message)

    // 2. Build JSON array
    const jsonArray = (posts ?? []).map((post) => ({
      Title: post.title,
      Slug: post.slug,
      Date: post.published_at ? post.published_at.slice(0, 10) : "",
      Tag: post.category,
      Series: post.tags?.[0] ?? "",
      Excerpt: post.excerpt ?? "",
      Content: htmlToPlainText(post.body_html ?? ""),
      Image: post.cover_image_url ?? "",
      ImagePosition: "",
      Published: true,
    }))

    // 3. GET current file to extract SHA
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO
    const file = process.env.GITHUB_BLOG_FILE
    const branch = process.env.GITHUB_BRANCH

    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${file}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )

    if (!getRes.ok) {
      const body = await getRes.text()
      throw new Error(`GitHub GET failed: ${getRes.status} ${body}`)
    }

    const fileData = await getRes.json() as { sha: string }
    const sha = fileData.sha

    // 4. PUT updated content
    const content = Buffer.from(JSON.stringify(jsonArray, null, 2)).toString("base64")
    const putRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${file}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "chore: sync blog posts from CRM",
          content,
          sha,
          branch,
        }),
      }
    )

    if (!putRes.ok) {
      const body = await putRes.text()
      throw new Error(`GitHub PUT failed: ${putRes.status} ${body}`)
    }

    // 5. Update last_synced_at for all published posts
    await serviceClient
      .from("posts")
      .update({ last_synced_at: new Date().toISOString(), sync_error: null })
      .eq("published", true)

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // 6. Update sync_error for all published posts
    await serviceClient
      .from("posts")
      .update({ sync_error: message })
      .eq("published", true)

    return { ok: false, error: message }
  }
}

// ─── Import from GitHub ───────────────────────────────────────────────────────

export async function importFromGitHub(): Promise<{ imported: number; skipped: number; error?: string }> {
  await requireAdmin()

  try {
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO
    const file = process.env.GITHUB_BLOG_FILE
    const branch = process.env.GITHUB_BRANCH

    // 1. GET blog-posts.json from GitHub
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${file}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )

    if (!getRes.ok) {
      const body = await getRes.text()
      throw new Error(`GitHub GET failed: ${getRes.status} ${body}`)
    }

    const fileData = await getRes.json() as { content: string }
    const decoded = Buffer.from(fileData.content, "base64").toString("utf-8")
    const jsonArray = JSON.parse(decoded) as Array<{
      Title: string
      Slug: string
      Date: string
      Tag: string
      Series: string
      Excerpt: string
      Content: string
      Image: string
      ImagePosition: string
      Published: boolean
    }>

    // 2. Get existing slugs
    const supabase = await createClient()
    const { data: existing } = await supabase.from("posts").select("slug")
    const existingSlugs = new Set((existing ?? []).map((p) => p.slug))

    // 3. Import posts not already in DB
    let imported = 0
    let skipped = 0
    for (const post of jsonArray) {
      if (!post.Published) continue
      if (existingSlugs.has(post.Slug)) { skipped++; continue }

      const insert: TablesInsert<"posts"> = {
        title: post.Title,
        slug: post.Slug,
        category: post.Tag || "News",
        tags: post.Series ? [post.Series] : [],
        excerpt: post.Excerpt || null,
        body_html: plainTextToHtml(post.Content),
        cover_image_url: post.Image || null,
        published: true,
        published_at: post.Date ? new Date(post.Date).toISOString() : new Date().toISOString(),
      }

      const { error } = await supabase.from("posts").insert(insert)
      if (!error) imported++
    }

    return { imported, skipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { imported: 0, skipped: 0, error: message }
  }
}
