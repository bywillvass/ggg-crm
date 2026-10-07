"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { listEvents } from "@/app/(app)/events/actions"
import { addLeadToEvent } from "@/app/(app)/leads/actions"
import type { EventSummary } from "@/app/(app)/events/actions"
import type { Database } from "@/lib/database.types"

type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

export function AddToEventDialog({
  leadId,
  leadName,
  open,
  onClose,
  onSuccess,
}: {
  leadId: string
  leadName: string
  open: boolean
  onClose: () => void
  onSuccess: (eventTitle: string) => void
}) {
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventSearch, setEventSearch] = useState("")
  const [selectedEventId, setSelectedEventId] = useState("")
  const [status, setStatus] = useState<ParticipantStatus>("invited")
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open) { setEventSearch(""); setSelectedEventId(""); return }
    setLoadingEvents(true)
    listEvents({ timeframe: "upcoming" }).then((data) => {
      setEvents(data)
      setLoadingEvents(false)
    })
  }, [open])

  const filteredEvents = events.filter((e) =>
    e.title.toLowerCase().includes(eventSearch.toLowerCase())
  )

  async function handleAdd() {
    if (!selectedEventId) return
    setAdding(true)
    const result = await addLeadToEvent(leadId, selectedEventId, status as "invited" | "confirmed" | "waitlisted")
    setAdding(false)
    if (result.error) {
      toast.error(result.error)
    } else if (result.alreadyInEvent) {
      toast.info(`Already added to ${result.eventTitle}`)
      onClose()
    } else {
      toast.success(`Added to ${result.eventTitle}`)
      onSuccess(result.eventTitle ?? "event")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to event</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2 mb-1 truncate">{leadName}</p>

        <div className="space-y-3">
          <input
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
          />

          <div className="max-h-52 overflow-y-auto rounded-md border divide-y text-sm">
            {loadingEvents ? (
              <div className="px-3 py-6 text-center text-gray-400">Loading…</div>
            ) : filteredEvents.length === 0 ? (
              <div className="px-3 py-6 text-center text-gray-400">No upcoming events</div>
            ) : (
              filteredEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEventId(e.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors",
                    selectedEventId === e.id && "bg-[#0C0F4C]/5 border-l-2 border-[#C9A227]"
                  )}
                >
                  <p className="font-medium text-gray-900">{e.title}</p>
                  <p className="text-xs text-gray-400">{format(new Date(e.start_at), "d MMM yyyy")}</p>
                </button>
              ))
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Add as</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ParticipantStatus)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
            >
              <option value="invited">Invited</option>
              <option value="confirmed">Confirmed</option>
              <option value="waitlisted">Waitlisted</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedEventId || adding}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            {adding ? "Adding…" : "Add to event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
