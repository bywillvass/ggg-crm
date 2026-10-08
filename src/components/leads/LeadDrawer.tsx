"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { MapPin, CalendarCheck, Phone, Mail } from "lucide-react"
import { cn } from "cn"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import { AddToEventDialog } from "./AddToEventDialog"
import type { LeadWithRelations } from "@/app/(app)/leads/actions"

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  confirmed: "Confirmed",
  signed: "Signed",
  not_interested: "Not Interested",
  lost: "Lost",
}

const STAGE_COLOURS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  interested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  signed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  not_interested: "bg-gray-100 text-gray-600 border-gray-200",
  lost: "bg-red-100 text-red-700 border-red-200",
}

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  meta_instant_form: "Meta Ads",
  newsletter: "Newsletter",
  referral: "Referral",
  manual: "Manual",
  import: "Import",
  other: "Other",
}

const SOURCE_COLOURS: Record<string, string> = {
  website: "bg-purple-50 border-purple-200 text-purple-700",
  meta_instant_form: "bg-blue-50 border-blue-200 text-blue-700",
  newsletter: "bg-teal-50 border-teal-200 text-teal-700",
  referral: "bg-orange-50 border-orange-200 text-orange-700",
  manual: "bg-gray-50 border-gray-200 text-gray-700",
  import: "bg-slate-50 border-slate-200 text-slate-700",
  other: "bg-gray-50 border-gray-200 text-gray-500",
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 8) return null
  const e164 = digits.startsWith("0") ? `61${digits.slice(1)}` : digits
  return `https://wa.me/${e164}`
}

type Props = {
  lead: LeadWithRelations | null
  onClose: () => void
  onUpdate: () => void
}

export function LeadDrawer({ lead, onClose, onUpdate }: Props) {
  const [activityOpen, setActivityOpen] = useState(false)
  const [addToEventOpen, setAddToEventOpen] = useState(false)

  const eventParticipants = lead?.event_participants as
    | { event_id: string; events: { id: string; title: string; start_at: string } | null }[]
    | undefined

  return (
    <>
      <Sheet open={lead !== null} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto flex flex-col gap-0 p-0">
          {lead && (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b bg-white">
                <h2 className="text-lg font-semibold text-[#0C0F4C]">
                  {lead.contacts?.first_name} {lead.contacts?.last_name}
                </h2>
                <span className={cn("mt-1.5 inline-block text-xs px-2 py-0.5 rounded-full border font-medium", STAGE_COLOURS[lead.stage] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                  {STAGE_LABELS[lead.stage] ?? lead.stage}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* Contact */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Contact</p>
                  <div className="space-y-1.5 text-sm">
                    {lead.contacts?.phone && (
                      <a href={`tel:${lead.contacts.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-[#0C0F4C]">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {lead.contacts.phone}
                      </a>
                    )}
                    {lead.contacts?.email && (
                      <a href={`mailto:${lead.contacts.email}`} className="flex items-center gap-2 text-gray-700 hover:text-[#0C0F4C] break-all">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {lead.contacts.email}
                      </a>
                    )}
                    {lead.contacts?.suburb && (
                      <p className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {lead.contacts.suburb}
                        {lead.contacts.state && `, ${lead.contacts.state}`}
                      </p>
                    )}
                  </div>
                </section>

                {/* Player */}
                {lead.players && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Player</p>
                    <div className="text-sm space-y-1 text-gray-700">
                      <p className="font-medium">{lead.players.first_name} {lead.players.last_name}</p>
                      {lead.players.birth_year && <p className="text-gray-500">{lead.players.birth_year}</p>}
                      {(lead.players.position || lead.players.current_club) && (
                        <p className="text-gray-500">
                          {[lead.players.position, lead.players.current_club].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Events */}
                {eventParticipants && eventParticipants.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Events</p>
                    <div className="space-y-1">
                      {eventParticipants.map((ep) => ep.events && (
                        <p key={ep.event_id} className="text-sm text-gray-700 flex items-center gap-2">
                          <CalendarCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          {ep.events.title}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                {/* Details */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-20 shrink-0">Source</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", SOURCE_COLOURS[lead.source] ?? "bg-gray-50 border-gray-200 text-gray-600")}>
                        {SOURCE_LABELS[lead.source] ?? lead.source}
                      </span>
                    </div>
                    {lead.form_type && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-20 shrink-0">Form type</span>
                        <span className="text-gray-700">{lead.form_type}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 shrink-0">Submitted</span>
                      <span className="text-gray-700">{format(new Date(lead.created_at), "d MMM yyyy")}</span>
                    </div>
                    {lead.profiles?.full_name && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-20 shrink-0">Owner</span>
                        <span className="text-gray-700">{lead.profiles.full_name}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Quick actions */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Quick actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActivityOpen(true)}
                    >
                      Log activity
                    </Button>
                    {lead.contacts?.phone && waLink(lead.contacts.phone) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(waLink(lead.contacts!.phone)!, "_blank")}
                      >
                        WhatsApp
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddToEventOpen(true)}
                    >
                      Add to event
                    </Button>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-white mt-auto">
                <Link href={`/leads/${lead.id}`} className="block">
                  <Button className="w-full bg-[#0C0F4C] hover:bg-[#1a2070] text-white">
                    View full record
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {lead && (
        <>
          <AddActivityDialog
            open={activityOpen}
            onClose={() => setActivityOpen(false)}
            onSave={() => { setActivityOpen(false); onUpdate() }}
            leadId={lead.id}
            contactId={lead.contact_id ?? undefined}
            playerId={lead.player_id ?? undefined}
          />
          <AddToEventDialog
            open={addToEventOpen}
            leadId={lead.id}
            leadName={`${lead.contacts?.first_name ?? ""} ${lead.contacts?.last_name ?? ""}`.trim()}
            onClose={() => setAddToEventOpen(false)}
            onSuccess={() => { setAddToEventOpen(false); onUpdate() }}
          />
        </>
      )}
    </>
  )
}
