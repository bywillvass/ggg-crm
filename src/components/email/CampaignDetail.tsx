"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { ArrowLeft, Copy, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CampaignComposer } from "./CampaignComposer"
import {
  duplicateCampaign,
  deleteCampaign,
  type CampaignDetail as CampaignDetailType,
  type EmailTemplateRow,
} from "@/app/(app)/email/actions"
import type { Tables, Database } from "@/lib/database.types"

type CampaignStatus = Database["public"]["Enums"]["campaign_status"]
type MessageStatus = Database["public"]["Enums"]["message_status"]

function statusVariant(s: CampaignStatus): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (s === "sent") return "success"
  if (s === "scheduled" || s === "sending") return "warning"
  if (s === "cancelled") return "destructive"
  return "secondary"
}

function messageStatusVariant(s: MessageStatus): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (s === "delivered" || s === "opened" || s === "clicked") return "success"
  if (s === "sent") return "default"
  if (s === "queued" || s === "sending") return "warning"
  if (s === "bounced" || s === "complained" || s === "failed") return "destructive"
  return "secondary"
}

export function CampaignDetail({
  campaign,
  templates,
  events,
}: {
  campaign: CampaignDetailType
  templates: EmailTemplateRow[]
  events: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
}) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  async function handleDuplicate() {
    const result = await duplicateCampaign(campaign.id)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      toast.success("Duplicated")
      router.push(`/email/${result.data.id}`)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete campaign "${campaign.name}"?`)) return
    const res = await deleteCampaign(campaign.id)
    if (res.error) toast.error(res.error)
    else {
      toast.success("Deleted")
      router.push("/email")
    }
  }

  const sentPct = campaign.total > 0 ? Math.round((campaign.sent / campaign.total) * 100) : 0
  const deliveredPct = campaign.sent > 0 ? Math.round((campaign.delivered / campaign.sent) * 100) : 0
  const openedPct = campaign.sent > 0 ? Math.round((campaign.opened / campaign.sent) * 100) : 0
  const clickedPct = campaign.sent > 0 ? Math.round((campaign.clicked / campaign.sent) * 100) : 0
  const bouncedPct = campaign.sent > 0 ? Math.round((campaign.bounced / campaign.sent) * 100) : 0

  const paginated = campaign.messages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(campaign.messages.length / PAGE_SIZE))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/email" className="mt-1 text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[#0C0F4C]">{campaign.name}</h1>
            <Badge variant={statusVariant(campaign.status)}>
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Badge>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {campaign.subject}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Created {format(new Date(campaign.created_at), "d MMM yyyy")}
            {campaign.sent_at && ` - Sent ${format(new Date(campaign.sent_at), "d MMM yyyy")}`}
            {campaign.scheduled_at && !campaign.sent_at && ` - Scheduled ${format(new Date(campaign.scheduled_at), "d MMM yyyy h:mm a")}`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Duplicate
          </Button>
          {campaign.status === "draft" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Sent" value={campaign.sent} pct={sentPct} total={campaign.total} />
        <StatCard label="Delivered" value={campaign.delivered} pct={deliveredPct} />
        <StatCard label="Opened" value={campaign.opened} pct={openedPct} />
        <StatCard label="Clicked" value={campaign.clicked} pct={clickedPct} />
        <StatCard label="Bounced" value={campaign.bounced} pct={bouncedPct} tone="danger" />
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <div className="border-b bg-gray-50 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
          <span>Recipients ({campaign.messages.length} shown of {campaign.total})</span>
          {campaign.attachments.length > 0 && (
            <span>{campaign.attachments.length} attachment{campaign.attachments.length === 1 ? "" : "s"}</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-2 font-medium text-gray-600">Email</th>
              <th className="px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 font-medium text-gray-600 hidden md:table-cell">Sent</th>
              <th className="px-3 py-2 font-medium text-gray-600 hidden lg:table-cell">Opened</th>
              <th className="px-3 py-2 font-medium text-gray-600 hidden lg:table-cell">Clicked</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  No recipients yet
                </td>
              </tr>
            ) : (
              paginated.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{m.to_email}</td>
                  <td className="px-3 py-2">
                    <Badge variant={messageStatusVariant(m.status)}>{m.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs hidden md:table-cell">
                    {m.sent_at ? format(new Date(m.sent_at), "d MMM, h:mm a") : "-"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs hidden lg:table-cell">
                    {m.opened_at ? format(new Date(m.opened_at), "d MMM, h:mm a") : "-"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs hidden lg:table-cell">
                    {m.clicked_at ? format(new Date(m.clicked_at), "d MMM, h:mm a") : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {page} of {pageCount}</span>
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

      {showEdit && (
        <CampaignComposer
          open={showEdit}
          onClose={() => { setShowEdit(false); router.refresh() }}
          templates={templates}
          events={events}
          initialCampaign={campaign}
          initialAttachments={campaign.attachments}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  pct,
  total,
  tone,
}: {
  label: string
  value: number
  pct: number
  total?: number
  tone?: "danger"
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${tone === "danger" && value > 0 ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-400">
        {total !== undefined ? `${pct}% of ${total}` : `${pct}%`}
      </div>
    </div>
  )
}
