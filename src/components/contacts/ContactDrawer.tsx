"use client"

import { useState } from "react"
import Link from "next/link"
import { Phone, Mail } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import type { ContactWithPlayers } from "@/app/(app)/contacts/actions"

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 8) return null
  const e164 = digits.startsWith("0") ? `61${digits.slice(1)}` : digits
  return `https://wa.me/${e164}`
}

type Props = {
  contact: ContactWithPlayers | null
  onClose: () => void
  onUpdate: () => void
}

export function ContactDrawer({ contact, onClose, onUpdate }: Props) {
  const [activityOpen, setActivityOpen] = useState(false)

  return (
    <>
      <Sheet open={contact !== null} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="sm:max-w-sm w-full overflow-y-auto flex flex-col gap-0 p-0">
          {contact && (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b bg-white">
                <h2 className="text-lg font-semibold text-[#0C0F4C]">
                  {contact.first_name} {contact.last_name}
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* Details */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Contact</p>
                  <div className="space-y-1.5 text-sm">
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-[#0C0F4C]">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-gray-700 hover:text-[#0C0F4C] break-all">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {contact.email}
                      </a>
                    )}
                    {(contact.suburb || contact.state) && (
                      <p className="text-gray-600">
                        {[contact.suburb, contact.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </section>

                {/* Tags */}
                {(contact.tags ?? []).length > 0 && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Players */}
                {contact.player_contacts && contact.player_contacts.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Players</p>
                    <div className="flex flex-wrap gap-1.5">
                      {contact.player_contacts.map((pc) => (
                        <Link key={pc.player_id} href={`/players/${pc.player_id}`} className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-full px-2.5 py-1 transition-colors">
                          Player
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

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
                    {contact.phone && waLink(contact.phone) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(waLink(contact.phone)!, "_blank")}
                      >
                        WhatsApp
                      </Button>
                    )}
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-white mt-auto">
                <Link href={`/contacts/${contact.id}`} className="block">
                  <Button className="w-full bg-[#0C0F4C] hover:bg-[#1a2070] text-white">
                    View full record
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {contact && (
        <AddActivityDialog
          open={activityOpen}
          onClose={() => setActivityOpen(false)}
          onSave={() => { setActivityOpen(false); onUpdate() }}
          contactId={contact.id}
        />
      )}
    </>
  )
}
