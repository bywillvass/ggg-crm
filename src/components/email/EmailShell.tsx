"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Copy, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CampaignComposer } from "./CampaignComposer"
import {
  duplicateCampaign,
  deleteCampaign,
  type EmailCampaignRow,
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

export function EmailShell({
  initialCampaigns,
  templates,
  events,
}: {
  initialCampaigns: EmailCampaignRow[]
  templates: EmailTemplateRow[]
  events: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
}) {
  const router = useRouter()
  const [campaigns] = useState<EmailCampaignRow[]>(initialCampaigns)
  const [showComposer, setShowComposer] = useState(false)

  async function handleDuplicate(id: string) {
    const result = await duplicateCampaign(id)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      toast.success("Campaign duplicated")
      router.push(`/email/${result.data.id}`)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete campaign "${name}"?`)) return
    const result = await deleteCampaign(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Campaign deleted")
      router.refresh()
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0C0F4C]">Email</h1>
          <p className="text-sm text-gray-500">{campaigns.length} campaigns</p>
        </div>
        <Button
          onClick={() => setShowComposer(true)}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New campaign
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-3 font-medium text-gray-600">Name</th>
              <th className="px-3 py-3 font-medium text-gray-600">Status</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Subject</th>
              <th className="px-3 py-3 font-medium text-gray-600 text-right">Recipients</th>
              <th className="px-3 py-3 font-medium text-gray-600 text-right hidden lg:table-cell">Sent</th>
              <th className="px-3 py-3 font-medium text-gray-600 text-right hidden lg:table-cell">Delivered</th>
              <th className="px-3 py-3 font-medium text-gray-600 text-right hidden lg:table-cell">Opened</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden xl:table-cell">When</th>
              <th className="px-3 py-3 font-medium text-gray-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-gray-400">
                  No campaigns yet. Create your first campaign.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <Link href={`/email/${c.id}`} className="font-medium text-[#0C0F4C] hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={statusVariant(c.status)}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-gray-600 hidden md:table-cell truncate max-w-xs">
                    {c.subject}
                  </td>
                  <td className="px-3 py-3 text-right">{c.total}</td>
                  <td className="px-3 py-3 text-right hidden lg:table-cell">{c.sent}</td>
                  <td className="px-3 py-3 text-right hidden lg:table-cell">{c.delivered}</td>
                  <td className="px-3 py-3 text-right hidden lg:table-cell">{c.opened}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs hidden xl:table-cell">
                    {c.sent_at
                      ? format(new Date(c.sent_at), "d MMM yyyy")
                      : c.scheduled_at
                        ? `Scheduled ${format(new Date(c.scheduled_at), "d MMM yyyy")}`
                        : format(new Date(c.created_at), "d MMM yyyy")}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/email/${c.id}`} className="text-gray-400 hover:text-gray-700">
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDuplicate(c.id)}
                        className="text-gray-400 hover:text-gray-700"
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {c.status === "draft" && (
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showComposer && (
        <CampaignComposer
          open={showComposer}
          onClose={() => setShowComposer(false)}
          templates={templates}
          events={events}
        />
      )}
    </div>
  )
}
