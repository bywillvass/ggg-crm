"use client"

import {
  MessageSquare,
  Phone,
  MessageCircle,
  Mail,
  ArrowRight,
  Plus,
  CheckCircle,
  FileText,
  Receipt,
  DollarSign,
  ClipboardList,
  Activity,
} from "lucide-react"
import { format } from "date-fns"
import type { Database } from "@/lib/database.types"

type ActivityType = Database["public"]["Enums"]["activity_type"]

type ActivityItem = {
  id: string
  type: ActivityType
  body: string | null
  created_at: string
  created_by: string | null
  contact_id: string | null
  player_id: string | null
  lead_id: string | null
  event_id: string | null
}

const iconMap: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  note: MessageSquare,
  call: Phone,
  sms: MessageCircle,
  whatsapp: MessageCircle,
  email_sent: Mail,
  email_opened: Mail,
  email_clicked: Mail,
  email_bounced: Mail,
  stage_change: ArrowRight,
  status_change: ArrowRight,
  lead_created: Plus,
  event_added: Plus,
  checked_in: CheckCircle,
  document_uploaded: FileText,
  document_requested: FileText,
  invoice_sent: Receipt,
  payment_recorded: DollarSign,
  assessment_added: ClipboardList,
  unsubscribed: Activity,
  rsvp: CheckCircle,
}

const typeLabel: Record<ActivityType, string> = {
  note: "Note",
  call: "Call",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email_sent: "Email sent",
  email_opened: "Email opened",
  email_clicked: "Email clicked",
  email_bounced: "Email bounced",
  stage_change: "Stage changed",
  status_change: "Status changed",
  lead_created: "Lead created",
  event_added: "Added to event",
  checked_in: "Checked in",
  document_uploaded: "Document uploaded",
  document_requested: "Document requested",
  invoice_sent: "Invoice sent",
  payment_recorded: "Payment recorded",
  assessment_added: "Assessment added",
  unsubscribed: "Unsubscribed",
  rsvp: "RSVP",
}

export function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No activity yet
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, idx) => {
        const Icon = iconMap[activity.type] ?? Activity
        const isLast = idx === activities.length - 1

        return (
          <div key={activity.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            <div className={`pb-4 min-w-0 flex-1 ${isLast ? "" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-700">
                  {typeLabel[activity.type]}
                </span>
                <span className="text-xs text-gray-400">
                  {format(new Date(activity.created_at), "d MMM yyyy h:mm aa")}
                </span>
              </div>
              {activity.body && (
                <p className="mt-0.5 text-sm text-gray-600 whitespace-pre-wrap">
                  {activity.body}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
