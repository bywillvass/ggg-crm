"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, RefreshCw, Download } from "lucide-react"
import { cn } from "cn"
import {
  publishPost,
  unpublishPost,
  deletePost,
  importFromGitHub,
  type PostRow,
} from "@/app/(app)/blog/actions"

export function BlogList({ initialPosts }: { initialPosts: PostRow[] }) {
  const router = useRouter()
  const [posts, setPosts] = useState(initialPosts)
  const [importing, startImport] = useTransition()
  const [syncing, setSyncing] = useState<string | null>(null)

  async function handleImport() {
    startImport(async () => {
      const result = await importFromGitHub()
      if (result.error) {
        toast.error(`Import failed: ${result.error}`)
      } else {
        const parts = [`${result.imported} imported`]
        if (result.skipped > 0) parts.push(`${result.skipped} already existed`)
        toast.success(parts.join(", "))
        router.refresh()
      }
    })
  }

  async function handlePublish(id: string) {
    setSyncing(id)
    const result = await publishPost(id)
    setSyncing(null)
    if (result.ok) {
      toast.success("Published and synced")
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to publish")
    }
  }

  async function handleUnpublish(id: string) {
    setSyncing(id)
    const result = await unpublishPost(id)
    setSyncing(null)
    if (result.ok) {
      toast.success("Unpublished and synced")
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to unpublish")
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    const result = await deletePost(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Post deleted")
      setPosts((prev) => prev.filter((p) => p.id !== id))
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <h1 className="text-xl font-semibold text-gray-900">Blog Posts</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            {importing ? "Importing…" : "Import from GitHub"}
          </button>
          <Link
            href="/blog/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-[#0C0F4C] text-white hover:bg-[#0C0F4C]/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Post
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No blog posts yet.</p>
            <Link
              href="/blog/new"
              className="mt-2 inline-block text-sm text-[#0C0F4C] hover:underline"
            >
              Create your first post
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Tags
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Published
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Sync
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/blog/${post.id}`}
                        className="font-medium text-gray-900 hover:text-[#0C0F4C] hover:underline line-clamp-1"
                      >
                        {post.title}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">/{post.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          post.published
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        )}
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{post.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(post.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString("en-AU", {
                            dateStyle: "medium",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {post.sync_error ? (
                        <span className="text-xs text-red-500 line-clamp-1" title={post.sync_error}>
                          Error
                        </span>
                      ) : post.last_synced_at ? (
                        <span className="text-xs text-gray-400">
                          {new Date(post.last_synced_at).toLocaleDateString("en-AU", {
                            dateStyle: "short",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/blog/${post.id}`}
                          className="text-xs font-medium text-[#0C0F4C] hover:underline"
                        >
                          Edit
                        </Link>

                        {post.published ? (
                          <button
                            type="button"
                            onClick={() => handleUnpublish(post.id)}
                            disabled={syncing === post.id}
                            className="text-xs font-medium text-yellow-600 hover:underline disabled:opacity-50"
                          >
                            {syncing === post.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin inline" />
                            ) : (
                              "Unpublish"
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePublish(post.id)}
                            disabled={syncing === post.id}
                            className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                          >
                            {syncing === post.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin inline" />
                            ) : (
                              "Publish"
                            )}
                          </button>
                        )}

                        {!post.published && (
                          <button
                            type="button"
                            onClick={() => handleDelete(post.id, post.title)}
                            className="text-xs font-medium text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
