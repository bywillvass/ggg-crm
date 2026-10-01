"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import { Plus, Search, Calendar, MapPin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import { createEvent, listEvents, type EventSummary } from "@/app/(app)/events/actions"
import type { Database } from "@/lib/database.types"

type EventType = Database["public"]["Enums"]["event_type"]
type EventStatus = Database["public"]["Enums"]["event_status"]
type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

const EVENT_TYPES: EventType[] = [
  "trial", "training_session", "trial_game", "tour", "camp", "community_event", "other",
]
const EVENT_STATUSES: EventStatus[] = [
  "draft", "open", "full", "closed", "completed", "cancelled",
]

function typeLabel(t: EventType): string {
  const map: Record<EventType, string> = {
    trial: "Trial",
    training_session: "Training",
    trial_game: "Trial game",
    tour: "Tour",
    camp: "Camp",
    community_event: "Community",
    other: "Other",
  }
  return map[t] ?? t
}

function typePillColor(t: EventType): string {
  const map: Record<EventType, string> = {
    trial: "bg-blue-100 text-blue-800",
    training_session: "bg-green-100 text-green-800",
    trial_game: "bg-purple-100 text-purple-800",
    tour: "bg-amber-100 text-amber-800",
    camp: "bg-orange-100 text-orange-800",
    community_event: "bg-teal-100 text-teal-800",
    other: "bg-gray-100 text-gray-700",
  }
  return map[t] ?? "bg-gray-100 text-gray-700"
}

function statusVariant(s: EventStatus): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (s === "open") return "success"
  if (s === "draft") return "secondary"
  if (s === "full" || s === "closed") return "warning"
  if (s === "cancelled") return "destructive"
  return "default"
}

function confirmedCount(ep: { status: ParticipantStatus }[]): number {
  return ep.filter((p) => p.status === "confirmed" || p.status === "attended").length
}

export function EventsShell({ initialEvents }: { initialEvents: EventSummary[] }) {
  const router = useRouter()
  const [events, setEvents] = useState<EventSummary[]>(initialEvents)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [timeframe, setTimeframe] = useState<"upcoming" | "past" | "all">("upcoming")
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // New event form
  const [title, setTitle] = useState("")
  const [type, setType] = useState<EventType>("trial")
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [timezone, setTimezone] = useState("Australia/Sydney")
  const [venueName, setVenueName] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("Australia")
  const [capacity, setCapacity] = useState("")
  const [priceCents, setPriceCents] = useState("")
  const [description, setDescription] = useState("")
  const [newStatus, setNewStatus] = useState<EventStatus>("draft")
  const [saving, setSaving] = useState(false)

  async function applyFilters(tf: "upcoming" | "past" | "all", type?: string, status?: string) {
    setLoading(true)
    const data = await listEvents({ timeframe: tf, type: type || undefined, status: status || undefined })
    setEvents(data)
    setLoading(false)
  }

  function handleTimeframeChange(tf: "upcoming" | "past" | "all") {
    setTimeframe(tf)
    applyFilters(tf, filterType, filterStatus)
  }

  function handleTypeChange(v: string) {
    setFilterType(v)
    applyFilters(timeframe, v, filterStatus)
  }

  function handleStatusChange(v: string) {
    setFilterStatus(v)
    applyFilters(timeframe, filterType, v)
  }

  async function handleCreate() {
    if (!title || !startAt || !type) return toast.error("Title, start date, and type are required")
    setSaving(true)

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now()

    const { data, error } = await createEvent({
      title,
      slug,
      type,
      status: newStatus,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      timezone,
      venue_name: venueName || null,
      address: address || null,
      city: city || null,
      country,
      capacity: capacity ? parseInt(capacity) : null,
      price_cents: priceCents ? Math.round(parseFloat(priceCents) * 100) : null,
      description: description || null,
    })

    if (error) {
      toast.error(error)
      setSaving(false)
      return
    }

    toast.success("Event created")
    setSaving(false)
    setShowNew(false)
    router.push(`/events/${data!.id}`)
  }

  const filtered = useMemo(() => {
    if (!search) return events
    const s = search.toLowerCase()
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(s) ||
        (e.venue_name ?? "").toLowerCase().includes(s) ||
        (e.city ?? "").toLowerCase().includes(s)
    )
  }, [events, search])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
          Events
        </h1>
        <Button onClick={() => setShowNew(true)} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
          <Plus className="w-4 h-4 mr-2" />
          New event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(["upcoming", "past", "all"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                timeframe === tf
                  ? "bg-[#0C0F4C] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterType} onChange={(e) => handleTypeChange(e.target.value)} className="w-40">
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </Select>

        <Select value={filterStatus} onChange={(e) => handleStatusChange(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-1">No events found</p>
          <p className="text-sm">Create your first event to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => {
            const confirmed = confirmedCount(event.event_participants)
            const dateStr = formatInTimeZone(
              new Date(event.start_at),
              event.timezone,
              "EEE d MMM yyyy"
            )
            const timeStr = formatInTimeZone(
              new Date(event.start_at),
              event.timezone,
              "h:mm a"
            )

            return (
              <div
                key={event.id}
                onClick={() => router.push(`/events/${event.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-[#C9A227] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", typePillColor(event.type))}>
                    {typeLabel(event.type)}
                  </span>
                  <Badge variant={statusVariant(event.status)}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </Badge>
                </div>

                <h3 className="font-semibold text-gray-900 text-base mb-2 leading-snug">{event.title}</h3>

                <div className="space-y-1.5 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{dateStr} at {timeStr}</span>
                  </div>
                  {event.venue_name && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{event.venue_name}{event.city ? `, ${event.city}` : ""}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {confirmed} confirmed
                      {event.capacity ? ` / ${event.capacity}` : ""}
                    </span>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* New event dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Elite Neon Cup Trials 2025"
                />
              </div>
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select value={type} onChange={(e) => setType(e.target.value as EventType)}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as EventStatus)}>
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start date/time *</Label>
                <Input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>End date/time</Label>
                <Input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                  <option value="Australia/Melbourne">Australia/Melbourne</option>
                  <option value="Australia/Brisbane">Australia/Brisbane</option>
                  <option value="Australia/Perth">Australia/Perth</option>
                  <option value="Europe/Athens">Europe/Athens</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="UTC">UTC</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Leave blank for unlimited"
                />
              </div>
              <div className="space-y-1">
                <Label>Venue name</Label>
                <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Heffron Park" />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Sydney" />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Price (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={priceCents}
                  onChange={(e) => setPriceCents(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {saving ? "Creating..." : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
