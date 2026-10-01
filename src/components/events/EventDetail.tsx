"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import {
  ArrowLeft, Edit2, Archive, Calendar, MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "cn"
import {
  updateEvent,
  archiveEvent,
  type EventDetail as EventDetailType,
} from "@/app/(app)/events/actions"
import { EventParticipantsTab } from "./EventParticipantsTab"
import { EventCheckInTab } from "./EventCheckInTab"
import { EventLogisticsTab } from "./EventLogisticsTab"
import { EventDocumentsTab } from "./EventDocumentsTab"
import { EventAssessmentsTab } from "./EventAssessmentsTab"
import type { Database, Tables } from "@/lib/database.types"

type EventType = Database["public"]["Enums"]["event_type"]
type EventStatus = Database["public"]["Enums"]["event_status"]
type ParticipantStatus = Database["public"]["Enums"]["participant_status"]
type AppRole = "admin" | "coach"

const EVENT_TYPES: EventType[] = [
  "trial", "training_session", "trial_game", "tour", "camp", "community_event", "other",
]
const EVENT_STATUSES: EventStatus[] = [
  "draft", "open", "full", "closed", "completed", "cancelled",
]

function typeLabel(t: EventType): string {
  const map: Record<EventType, string> = {
    trial: "Trial", training_session: "Training", trial_game: "Trial game",
    tour: "Tour", camp: "Camp", community_event: "Community", other: "Other",
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

const STATUS_COUNTS: ParticipantStatus[] = [
  "invited", "contacted", "confirmed", "declined", "waitlisted", "attended", "no_show", "cancelled",
]

function participantStatusBadge(s: ParticipantStatus): "success" | "warning" | "destructive" | "secondary" | "default" {
  if (s === "confirmed" || s === "attended") return "success"
  if (s === "waitlisted") return "warning"
  if (s === "no_show" || s === "declined" || s === "cancelled") return "destructive"
  return "secondary"
}

const TIMEZONES = [
  "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
  "Australia/Perth", "Europe/Athens", "Europe/London", "America/New_York", "UTC",
]

type Tab = "overview" | "participants" | "check-in" | "logistics" | "documents" | "assessments" | "invoices"

const ADMIN_TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "participants", label: "Participants" },
  { id: "check-in", label: "Check-in" },
  { id: "logistics", label: "Logistics" },
  { id: "documents", label: "Documents" },
  { id: "assessments", label: "Assessments" },
  { id: "invoices", label: "Invoices" },
]

const COACH_TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "participants", label: "Participants" },
  { id: "check-in", label: "Check-in" },
  { id: "logistics", label: "Logistics" },
  { id: "assessments", label: "Assessments" },
]

export function EventDetail({
  event: initialEvent,
  templates,
  role,
  emailTemplates = [],
  emailEvents = [],
}: {
  event: EventDetailType
  templates: Pick<Tables<"email_templates">, "id" | "name">[]
  role: AppRole
  emailTemplates?: Tables<"email_templates">[]
  emailEvents?: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
}) {
  const router = useRouter()
  const [event, setEvent] = useState(initialEvent)
  const [tab, setTab] = useState<Tab>("overview")
  const [showEdit, setShowEdit] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState(event.title)
  const [editType, setEditType] = useState<EventType>(event.type)
  const [editStatus, setEditStatus] = useState<EventStatus>(event.status)
  const [editStartAt, setEditStartAt] = useState(event.start_at.slice(0, 16))
  const [editEndAt, setEditEndAt] = useState(event.end_at?.slice(0, 16) ?? "")
  const [editTimezone, setEditTimezone] = useState(event.timezone)
  const [editVenueName, setEditVenueName] = useState(event.venue_name ?? "")
  const [editAddress, setEditAddress] = useState(event.address ?? "")
  const [editCity, setEditCity] = useState(event.city ?? "")
  const [editCountry, setEditCountry] = useState(event.country)
  const [editCapacity, setEditCapacity] = useState(event.capacity?.toString() ?? "")
  const [editPrice, setEditPrice] = useState(event.price_cents ? (event.price_cents / 100).toFixed(2) : "")
  const [editDescription, setEditDescription] = useState(event.description ?? "")
  const [editParentId] = useState(event.parent_event_id ?? "")
  const [editReminderHours, setEditReminderHours] = useState(event.reminder_hours_before?.toString() ?? "")
  const [editReminderTemplate, setEditReminderTemplate] = useState(event.reminder_template_id ?? "")
  const [saving, setSaving] = useState(false)

  const tabs = role === "admin" ? ADMIN_TABS : COACH_TABS

  async function handleSave() {
    setSaving(true)
    const { error } = await updateEvent(event.id, {
      title: editTitle,
      type: editType,
      status: editStatus,
      start_at: new Date(editStartAt).toISOString(),
      end_at: editEndAt ? new Date(editEndAt).toISOString() : null,
      timezone: editTimezone,
      venue_name: editVenueName || null,
      address: editAddress || null,
      city: editCity || null,
      country: editCountry,
      capacity: editCapacity ? parseInt(editCapacity) : null,
      price_cents: editPrice ? Math.round(parseFloat(editPrice) * 100) : null,
      description: editDescription || null,
      parent_event_id: editParentId || null,
      reminder_hours_before: editReminderHours ? parseInt(editReminderHours) : null,
      reminder_template_id: editReminderTemplate || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Event updated")
      setEvent((e) => ({
        ...e,
        title: editTitle,
        type: editType,
        status: editStatus,
        start_at: new Date(editStartAt).toISOString(),
        end_at: editEndAt ? new Date(editEndAt).toISOString() : null,
        timezone: editTimezone,
        venue_name: editVenueName || null,
        address: editAddress || null,
        city: editCity || null,
        country: editCountry,
        capacity: editCapacity ? parseInt(editCapacity) : null,
        price_cents: editPrice ? Math.round(parseFloat(editPrice) * 100) : null,
        description: editDescription || null,
        parent_event_id: editParentId || null,
        reminder_hours_before: editReminderHours ? parseInt(editReminderHours) : null,
        reminder_template_id: editReminderTemplate || null,
      }))
      setShowEdit(false)
    }
    setSaving(false)
  }

  async function handleArchive() {
    const { error } = await archiveEvent(event.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Event archived")
      router.push("/events")
    }
    setConfirmArchive(false)
  }

  const dateStr = formatInTimeZone(new Date(event.start_at), event.timezone, "EEEE d MMMM yyyy")
  const timeStr = formatInTimeZone(new Date(event.start_at), event.timezone, "h:mm a")
  const endStr = event.end_at
    ? formatInTimeZone(new Date(event.end_at), event.timezone, "h:mm a d MMM")
    : null

  const counts = STATUS_COUNTS.reduce((acc, s) => {
    acc[s] = event.participants.filter((p) => p.status === s).length
    return acc
  }, {} as Record<ParticipantStatus, number>)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Link href="/events" className="mt-1 text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full shrink-0", typePillColor(event.type))}>
              {typeLabel(event.type)}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {event.title}
            </h1>
            <Badge variant={statusVariant(event.status)}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{dateStr} at {timeStr}</span>
            {event.venue_name && (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venue_name}{event.city ? `, ${event.city}` : ""}</span>
            )}
            {event.parent_event && (
              <Link href={`/events/${event.parent_event_id}`} className="text-[#0C0F4C] hover:underline">
                Part of: {event.parent_event.title}
              </Link>
            )}
          </div>
        </div>
        {role === "admin" && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Edit2 className="w-4 h-4 mr-1" />Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
              <Archive className="w-4 h-4 mr-1" />Archive
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                tab === id
                  ? "border-[#C9A227] text-[#C9A227]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Details card */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Event details</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <div className="text-gray-500 text-xs mb-0.5">Date</div>
                <div>{dateStr} at {timeStr}</div>
              </div>
              {endStr && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Ends</div>
                  <div>{endStr}</div>
                </div>
              )}
              <div>
                <div className="text-gray-500 text-xs mb-0.5">Timezone</div>
                <div>{event.timezone}</div>
              </div>
              {event.venue_name && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Venue</div>
                  <div>{event.venue_name}</div>
                </div>
              )}
              {event.address && (
                <div className="col-span-2">
                  <div className="text-gray-500 text-xs mb-0.5">Address</div>
                  <div>{event.address}{event.city ? `, ${event.city}` : ""}{event.country !== "Australia" ? `, ${event.country}` : ""}</div>
                </div>
              )}
              {event.capacity && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Capacity</div>
                  <div>{event.capacity} spots</div>
                </div>
              )}
              {event.price_cents && role === "admin" && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Price</div>
                  <div>${(event.price_cents / 100).toFixed(2)} {event.currency}</div>
                </div>
              )}
              {event.birth_years && event.birth_years.length > 0 && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Birth years</div>
                  <div>{event.birth_years.sort().join(", ")}</div>
                </div>
              )}
            </div>
            {event.description && (
              <div>
                <div className="text-gray-500 text-xs mb-1">Description</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          {/* Counts card */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Participants</h2>
              <div className="space-y-2">
                {STATUS_COUNTS.filter((s) => counts[s] > 0).map((s) => (
                  <div key={s} className="flex items-center justify-between text-sm">
                    <Badge variant={participantStatusBadge(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
                    </Badge>
                    <span className="font-semibold text-gray-900">{counts[s]}</span>
                  </div>
                ))}
                {Object.values(counts).every((v) => v === 0) && (
                  <p className="text-sm text-gray-400">No participants yet</p>
                )}
              </div>
              {event.capacity && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
                  <div className="flex justify-between text-gray-500 mb-1.5">
                    <span>Confirmed</span>
                    <span>{counts.confirmed + counts.attended} / {event.capacity}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-[#C9A227] rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(100, ((counts.confirmed + counts.attended) / event.capacity) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sub-events */}
            {event.sub_events.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Sub-events</h2>
                <div className="space-y-2">
                  {event.sub_events.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/events/${sub.id}`}
                      className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-gray-900 font-medium truncate">{sub.title}</span>
                      <Badge variant={statusVariant(sub.status)} className="ml-2 shrink-0">
                        {sub.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "participants" && (
        <EventParticipantsTab
          event={event}
          onUpdate={setEvent}
          role={role}
          emailTemplates={emailTemplates}
          emailEvents={emailEvents}
        />
      )}

      {tab === "check-in" && (
        <EventCheckInTab event={event} onUpdate={setEvent} />
      )}

      {tab === "logistics" && (
        <EventLogisticsTab event={event} onUpdate={setEvent} role={role} />
      )}

      {tab === "documents" && (
        <EventDocumentsTab eventId={event.id} />
      )}

      {tab === "assessments" && (
        <EventAssessmentsTab eventId={event.id} role={role} />
      )}

      {tab === "invoices" && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Invoices - coming in Part 10</p>
        </div>
      )}

      {/* Edit dialog */}
      {role === "admin" && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Title</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={editType} onChange={(e) => setEditType(e.target.value as EventType)}>
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as EventStatus)}>
                    {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Start date/time</Label>
                  <Input type="datetime-local" value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>End date/time</Label>
                  <Input type="datetime-local" value={editEndAt} onChange={(e) => setEditEndAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Timezone</Label>
                  <Select value={editTimezone} onChange={(e) => setEditTimezone(e.target.value)}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Capacity</Label>
                  <Input type="number" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} placeholder="Unlimited" />
                </div>
                <div className="space-y-1">
                  <Label>Venue name</Label>
                  <Input value={editVenueName} onChange={(e) => setEditVenueName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Country</Label>
                  <Input value={editCountry} onChange={(e) => setEditCountry(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Price (AUD)</Label>
                  <Input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Description</Label>
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label>Reminder hours before</Label>
                  <Input
                    type="number"
                    value={editReminderHours}
                    onChange={(e) => setEditReminderHours(e.target.value)}
                    placeholder="e.g. 24"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Reminder template</Label>
                  <Select value={editReminderTemplate} onChange={(e) => setEditReminderTemplate(e.target.value)}>
                    <option value="">None</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Archive confirm */}
      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive event?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This event will be hidden from the events list. You can find it by filtering archived events.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchive(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleArchive}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
