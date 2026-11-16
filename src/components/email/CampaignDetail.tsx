"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { ArrowLeft, Copy, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CampaignComposer } from "./CampaignComposer"
import { SentLog } from "./SentLog"
import { BUILDER_PREFIX } from "@/lib/email/templates"
import {
  duplicateCampaign,
  deleteCampaign,
  getCampaignPreview,
  type CampaignDetail as CampaignDetailType,
  type EmailTemplateRow,
} from "@/app/(app)/email/actions"
import type { Tables, Database } from "@/lib/database.types"

type CampaignStatus = Database["public"]["Enums"]["campaign_status"]

function statusVariant(s: CampaignStatus): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (s === "sent") return "success"
  if (s === "scheduled" || s === "sending") return "warning"
  if (s === "cancelled") return "destructive"
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

      <CampaignContent campaign={campaign} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0C0F4C]">Recipients</h2>
          {campaign.attachments.length > 0 && (
            <span className="text-xs text-gray-500">
              Attachments: {campaign.attachments.map((a) => a.file_name).join(", ")}
            </span>
          )}
        </div>
        <SentLog campaignId={campaign.id} />
      </div>

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

// What the campaign email actually looked like. Once sent, it's rendered for the
// first recipient so merge fields show real names; drafts show the content as written.
function CampaignContent({ campaign }: { campaign: CampaignDetailType }) {
  const [rendered, setRendered] = useState<{ html: string; from: string; replyTo: string | null } | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (campaign.total === 0) return
    let cancelled = false
    getCampaignPreview(campaign.id).then((p) => { if (!cancelled) setRendered(p) })
    return () => { cancelled = true }
  }, [campaign.id, campaign.total])

  const rawText = campaign.body_text?.startsWith(BUILDER_PREFIX) ? null : campaign.body_text
  const html = rendered?.html ?? campaign.body_html ?? null

  return (
    <div className="rounded-lg border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b bg-gray-50 px-4 py-2 text-left"
      >
        <span className="text-sm font-semibold text-[#0C0F4C]">Email content</span>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="p-4 space-y-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-500">Subject</dt>
            <dd className="text-gray-900">{campaign.subject}</dd>
            {campaign.preheader && (
              <>
                <dt className="text-gray-500">Preheader</dt>
                <dd className="text-gray-900">{campaign.preheader}</dd>
              </>
            )}
            <dt className="text-gray-500">From</dt>
            <dd className="text-gray-900">{rendered?.from ?? campaign.from_name ?? "Default sender"}</dd>
            {(rendered?.replyTo ?? campaign.reply_to) && (
              <>
                <dt className="text-gray-500">Reply to</dt>
                <dd className="text-gray-900">{rendered?.replyTo ?? campaign.reply_to}</dd>
              </>
            )}
          </dl>
          {html ? (
            <iframe title="Campaign email" srcDoc={html} sandbox="" className="w-full h-[600px] rounded-md border bg-white" />
          ) : rawText ? (
            <pre className="whitespace-pre-wrap rounded-md border bg-gray-50 p-4 text-sm font-sans text-gray-800">{rawText}</pre>
          ) : (
            <p className="text-sm text-gray-400">No content yet.</p>
          )}
          {rendered && (
            <p className="text-xs text-gray-400">Shown as the first recipient received it. Click a recipient below to see their copy.</p>
          )}
        </div>
      )}
    </div>
  )
}
