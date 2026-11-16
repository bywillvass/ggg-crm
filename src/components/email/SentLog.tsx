"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { EmailPreviewDialog } from "./EmailPreviewDialog"
import { listSentEmails, type EmailSource, type SentLogRow } from "@/app/(app)/email/actions"
import type { Database } from "@/lib/database.types"

type MessageStatus = Database["public"]["Enums"]["message_status"]

const SOURCE_LABELS: Record<EmailSource, string> = {
  campaign: "Campaign",
  quick: "Quick email",
  one_off: "One-off",
  test: "Test",
  reminder: "Reminder",
  document_request: "Document request",
}

const PAGE_SIZE = 50

function statusVariant(s: MessageStatus): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (s === "delivered" || s === "opened" || s === "clicked") return "success"
  if (s === "sent") return "default"
  if (s === "queued" || s === "sending") return "warning"
  if (s === "bounced" || s === "complained" || s === "failed") return "destructive"
  return "secondary"
}

function recipientName(r: SentLogRow): string | null {
  if (r.contacts) return [r.contacts.first_name, r.contacts.last_name].filter(Boolean).join(" ") || null
  return r.to_name
}

// With campaignId, lists that campaign's recipients instead of the whole log
export function SentLog({ campaignId }: { campaignId?: string } = {}) {
  const [rows, setRows] = useState<SentLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [source, setSource] = useState<EmailSource | "">("")
  // Key of the request the current rows came from; loading while it differs
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [open, setOpen] = useState<SentLogRow | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestKey = JSON.stringify([page, query, source, campaignId])
  const loading = loadedKey !== requestKey

  useEffect(() => {
    let cancelled = false
    listSentEmails({ page, pageSize: PAGE_SIZE, search: query, source, campaignId }).then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setTotal(res.total)
      setLoadedKey(JSON.stringify([page, query, source, campaignId]))
    })
    return () => { cancelled = true }
  }, [page, query, source, campaignId])

  function handleSearch(value: string) {
    setSearch(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setPage(1)
      setQuery(value)
    }, 300)
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {campaignId
            ? "Click a recipient to see the email exactly as they got it."
            : "Every email sent from the CRM: campaigns, quick emails, one-offs, tests and reminders. Click one to see exactly what was sent."}
        </p>
        <div className="flex items-center gap-2">
          {!campaignId && <Select value={source} onChange={(e) => { setPage(1); setSource(e.target.value as EmailSource | "") }} className="w-44">
            <option value="">All types</option>
            {(Object.keys(SOURCE_LABELS) as EmailSource[]).map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </Select>}
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search recipient or subject..."
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#C9A227] w-60"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-3 font-medium text-gray-600">When</th>
              <th className="px-3 py-3 font-medium text-gray-600">To</th>
              <th className="px-3 py-3 font-medium text-gray-600">Subject</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">From</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Sent by</th>
              <th className="px-3 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                  {query || source ? "No emails match." : "No emails sent yet."}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const name = recipientName(r)
                return (
                  <tr key={r.id} onClick={() => setOpen(r)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(r.sent_at ?? r.created_at), "d MMM yyyy, h:mm a")}
                    </td>
                    <td className="px-3 py-2.5">
                      {name && <div className="font-medium text-[#0C0F4C]">{name}</div>}
                      <div className="text-xs text-gray-500">
                        {r.to_email}
                        {!r.contact_id && <span className="text-gray-400"> · not in CRM</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate">{r.subject}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {r.campaign_id && r.email_campaigns ? (
                        <Link
                          href={`/email/${r.campaign_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-[#0C0F4C] hover:underline"
                        >
                          {r.email_campaigns.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-600">{SOURCE_LABELS[r.source as EmailSource] ?? r.source}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 hidden lg:table-cell">{r.from_address ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 hidden lg:table-cell">{r.profiles?.full_name ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={statusVariant(r.status)} title={r.error ?? undefined}>{r.status}</Badge>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {page} of {pageCount} · {total} emails</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>
              Next
            </Button>
          </div>
        </div>
      )}

      <EmailPreviewDialog
        messageId={open?.id ?? null}
        toLabel={open ? (recipientName(open) ? `${recipientName(open)} <${open.to_email}>` : open.to_email) : undefined}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
