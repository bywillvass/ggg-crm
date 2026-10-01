"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { X } from "lucide-react"
import { cn } from "cn"
import { BlogTiptapEditor } from "./BlogTiptapEditor"
import {
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  syncBlogToGitHub,
  type PostRow,
  type PostInput,
} from "@/app/(app)/blog/actions"

const CATEGORIES = ["News", "Insights", "Programs", "Player Development", "Tours"]

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function PostEditor({ post }: { post?: PostRow }) {
  const router = useRouter()
  const isNew = !post

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [category, setCategory] = useState(post?.category ?? "News")
  const [tagsInput, setTagsInput] = useState((post?.tags ?? []).join(", "))
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [bodyHtml, setBodyHtml] = useState(post?.body_html ?? "")
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url ?? "")
  const [author, setAuthor] = useState(post?.author ?? "")
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "")
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "")
  const [saving, setSaving] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; error?: string } | null>(null)

  // Track whether user has manually edited the slug
  const slugManualRef = useRef(!!post)

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugManualRef.current) {
      setSlug(slugify(val))
    }
  }

  function handleSlugChange(val: string) {
    slugManualRef.current = true
    setSlug(val)
  }

  function parseTags(): string[] {
    return tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  }

  function removeTag(tag: string) {
    const tags = parseTags().filter((t) => t !== tag)
    setTagsInput(tags.join(", "))
  }

  function buildInput(): PostInput {
    return {
      title,
      slug,
      category,
      tags: parseTags(),
      excerpt: excerpt || null,
      body_html: bodyHtml || null,
      cover_image_url: coverImageUrl || null,
      author: author || null,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
    }
  }

  async function handleSaveDraft() {
    if (!title.trim()) { toast.error("Title is required"); return }
    if (!slug.trim()) { toast.error("Slug is required"); return }

    setSaving(true)
    try {
      if (isNew) {
        const created = await createPost(buildInput())
        toast.success("Draft saved")
        router.push(`/blog/${created.id}`)
      } else {
        const result = await updatePost(post.id, buildInput())
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Post saved")
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!post) { toast.error("Save draft first"); return }
    setSaving(true)
    // Save latest changes first
    await updatePost(post.id, buildInput())
    const result = await publishPost(post.id)
    setSyncResult(result)
    if (result.ok) {
      toast.success("Published and synced to GitHub")
    } else {
      toast.error(result.error ?? "Publish failed")
    }
    setSaving(false)
    router.refresh()
  }

  async function handleUnpublish() {
    if (!post) return
    setSaving(true)
    const result = await unpublishPost(post.id)
    setSyncResult(result)
    if (result.ok) {
      toast.success("Unpublished and synced to GitHub")
    } else {
      toast.error(result.error ?? "Unpublish failed")
    }
    setSaving(false)
    router.refresh()
  }

  async function handleSync() {
    setSaving(true)
    const result = await syncBlogToGitHub()
    setSyncResult(result)
    if (result.ok) {
      toast.success("Synced to GitHub")
    } else {
      toast.error(result.error ?? "Sync failed")
    }
    setSaving(false)
  }

  async function handleCoverImageUpload(file: File) {
    const form = new FormData()
    form.append("file", file)
    form.append("slug", slug || "draft")
    const res = await fetch("/api/blog/image", { method: "POST", body: form })
    if (!res.ok) { toast.error("Image upload failed"); return }
    const data = await res.json() as { url: string }
    setCoverImageUrl(data.url)
  }

  const isPublished = post?.published ?? false

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isNew ? "New Post" : "Edit Post"}
          </h1>
          {isPublished && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 mt-1">
              Published
            </span>
          )}
        </div>
        <Link
          href="/blog"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back to Blog
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-auto">
        {/* Main area (2/3) */}
        <div className="flex-1 min-w-0 p-6 space-y-4 overflow-auto">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Post title"
              className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 border-gray-200 focus:border-[#0C0F4C] outline-none py-2 placeholder:text-gray-300 transition-colors"
            />
          </div>

          {/* Slug */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 shrink-0">Slug:</span>
            <span className="text-sm text-gray-400">/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="post-slug"
              className="text-sm text-gray-600 bg-transparent border-0 border-b border-gray-200 focus:border-[#0C0F4C] outline-none py-0.5 flex-1"
            />
          </div>

          {/* Body editor */}
          <BlogTiptapEditor
            value={bodyHtml}
            onChange={setBodyHtml}
            slug={slug || "draft"}
          />
        </div>

        {/* Sidebar (1/3) */}
        <div className="w-80 shrink-0 border-l bg-gray-50 p-5 space-y-5 overflow-auto">
          {/* Publish actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>

            {!isNew && (
              <>
                {isPublished ? (
                  <button
                    type="button"
                    onClick={handleUnpublish}
                    disabled={saving}
                    className="w-full px-4 py-2 text-sm font-medium rounded-md bg-yellow-50 border border-yellow-300 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving}
                    className="w-full px-4 py-2 text-sm font-medium rounded-md bg-[#0C0F4C] text-white hover:bg-[#0C0F4C]/90 disabled:opacity-50 transition-colors"
                  >
                    Publish
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSync}
                  disabled={saving}
                  className="w-full px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Sync to GitHub
                </button>
              </>
            )}

            {/* Sync status */}
            {syncResult && (
              <p
                className={cn(
                  "text-xs mt-1",
                  syncResult.ok ? "text-green-600" : "text-red-500"
                )}
              >
                {syncResult.ok ? "Synced successfully" : syncResult.error}
              </p>
            )}

            {/* Existing sync error */}
            {post?.sync_error && !syncResult && (
              <p className="text-xs text-red-500 mt-1">{post.sync_error}</p>
            )}

            {/* Last synced */}
            {post?.last_synced_at && !syncResult && (
              <p className="text-xs text-gray-400 mt-1">
                Last synced:{" "}
                {new Date(post.last_synced_at).toLocaleString("en-AU", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Category */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C0F4C]/20 focus:border-[#0C0F4C]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Author */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author name"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C0F4C]/20 focus:border-[#0C0F4C]"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
              Tags / Series
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tag1, Tag2"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C0F4C]/20 focus:border-[#0C0F4C]"
            />
            {parseTags().length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {parseTags().map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Excerpt */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
              Excerpt
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="Short summary…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0C0F4C]/20 focus:border-[#0C0F4C]"
            />
          </div>

          {/* Cover image */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
              Cover Image
            </label>
            {coverImageUrl && (
              <div className="relative rounded-md overflow-hidden mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt="Cover"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl("")}
                  className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 text-white hover:bg-black/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCoverImageUpload(file)
                e.target.value = ""
              }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          <hr className="border-gray-200" />

          {/* SEO */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">SEO</p>
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">Title</label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="SEO title"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C0F4C]/20 focus:border-[#0C0F4C]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">
                Description{" "}
                <span className={cn("tabular-nums", seoDescription.length > 160 ? "text-red-500" : "text-gray-400")}>
                  ({seoDescription.length}/160)
                </span>
              </label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder="SEO description (≤160 chars)"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0C0F4C]/20 focus:border-[#0C0F4C]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
