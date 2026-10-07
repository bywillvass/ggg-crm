"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin, getCurrentRole, requireAuth } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { logActivity } from "@/lib/activity"
import type { Tables, TablesInsert, TablesUpdate, Database } from "@/lib/database.types"
import { redirect } from "next/navigation"

type EventType = Database["public"]["Enums"]["event_type"]
type EventStatus = Database["public"]["Enums"]["event_status"]
type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

// Accessible by admin and coach
async function requireAnyRole() {
  const role = await getCurrentRole()
  if (!role) redirect("/login")
  return role
}

// ─── Type exports ────────────────────────────────────────────────────────────

export type EventSummary = Tables<"events"> & {
  event_participants: { status: ParticipantStatus }[]
}

export type ParticipantRow = Tables<"event_participants"> & {
  players: (Tables<"players"> & {
    player_contacts: (Tables<"player_contacts"> & {
      contacts: Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "email" | "phone"> | null
    })[]
  }) | null
  contacts: Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "email" | "phone"> | null
}

export type EventDetail = Tables<"events"> & {
  sub_events: Tables<"events">[]
  parent_event: Tables<"events"> | null
  participants: ParticipantRow[]
}

// ─── Events ──────────────────────────────────────────────────────────────────

const _cachedEvents = unstable_cache(
  async (): Promise<EventSummary[]> => {
    const { data } = await serviceClient
      .from("events")
      .select("*, event_participants(status)")
      .is("archived_at", null)
      .order("start_at", { ascending: false })
    return (data ?? []) as EventSummary[]
  },
  ["events"],
  { revalidate: 60, tags: ["events"] }
)

export async function listEvents(filters?: {
  type?: string
  status?: string
  timeframe?: "upcoming" | "past" | "all"
  search?: string
}): Promise<EventSummary[]> {
  await requireAnyRole()

  let results = await _cachedEvents()
  const now = new Date().toISOString()

  if (filters?.type) {
    results = results.filter((e) => e.type === (filters.type as EventType))
  }
  if (filters?.status) {
    results = results.filter((e) => e.status === (filters.status as EventStatus))
  }
  if (filters?.timeframe === "upcoming") {
    results = results.filter((e) => e.start_at >= now)
  } else if (filters?.timeframe === "past") {
    results = results.filter((e) => e.start_at < now)
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase()
    results = results.filter((e) => (e.title ?? "").toLowerCase().includes(s))
  }

  return results
}

export async function getEvent(id: string): Promise<EventDetail | null> {
  await requireAnyRole()
  const supabase = await createClient()

  const [eventRes, subEventsRes] = await Promise.all([
    supabase
      .from("events")
      .select(`
        *,
        parent_event:parent_event_id(*),
        participants:event_participants(
          *,
          players(
            *,
            player_contacts(
              *,
              contacts(id, first_name, last_name, email, phone)
            )
          ),
          contacts(id, first_name, last_name, email, phone)
        )
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("events")
      .select("*")
      .eq("parent_event_id", id)
      .is("archived_at", null)
      .order("start_at", { ascending: true }),
  ])

  if (!eventRes.data) return null

  return {
    ...eventRes.data,
    sub_events: subEventsRes.data ?? [],
    parent_event: (eventRes.data as unknown as { parent_event: Tables<"events"> | null }).parent_event,
    participants: (eventRes.data as unknown as { participants: ParticipantRow[] }).participants ?? [],
  } as EventDetail
}

export async function createEvent(
  input: TablesInsert<"events">
): Promise<{ data: Tables<"events"> | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const user = await requireAuth()

  const { data, error } = await supabase
    .from("events")
    .insert({ ...input, created_by: user.id })
    .select()
    .single()

  if (data) {
    await logActivity({
      type: "note",
      event_id: data.id,
      body: `Event created: ${data.title}`,
      created_by: user.id,
    })
  }

  updateTag("events")
  return { data, error: error?.message ?? null }
}

export async function updateEvent(
  id: string,
  updates: TablesUpdate<"events">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("events")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("events")
  return { error: error?.message ?? null }
}

export async function archiveEvent(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("events")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("events")
  return { error: error?.message ?? null }
}

// ─── Participants ─────────────────────────────────────────────────────────────

export async function addParticipant(
  eventId: string,
  playerId: string | null,
  contactId: string | null,
  status: ParticipantStatus = "invited",
  sourceLeadId?: string
): Promise<{ data: Tables<"event_participants"> | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const user = await requireAuth()

  // Check capacity and auto-waitlist
  const { data: event } = await supabase
    .from("events")
    .select("capacity")
    .eq("id", eventId)
    .single()

  if (event?.capacity) {
    const { count } = await supabase
      .from("event_participants")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", ["confirmed", "attended"])

    if ((count ?? 0) >= event.capacity && status === "confirmed") {
      status = "waitlisted"
    }
  }

  const { data, error } = await supabase
    .from("event_participants")
    .insert({
      event_id: eventId,
      player_id: playerId,
      contact_id: contactId,
      status,
      status_updated_at: new Date().toISOString(),
      source_lead_id: sourceLeadId ?? null,
    })
    .select()
    .single()

  if (data) {
    await logActivity({
      type: "event_added",
      event_id: eventId,
      player_id: playerId ?? undefined,
      contact_id: contactId ?? undefined,
      body: `Added to event`,
      created_by: user.id,
    })
  }

  return { data, error: error?.message ?? null }
}

export async function addWalkIn(
  eventId: string,
  playerData: { first_name: string; last_name: string; birth_year?: number; position?: string },
  contactData: { first_name: string; last_name: string; phone?: string; email?: string }
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const user = await requireAuth()

  // Create contact
  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .insert({
      first_name: contactData.first_name,
      last_name: contactData.last_name,
      phone: contactData.phone ?? null,
      email: contactData.email ? contactData.email.toLowerCase().trim() : null,
      source: "manual",
    })
    .select()
    .single()

  if (contactErr || !contact) return { error: contactErr?.message ?? "Failed to create contact" }

  // Create player
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .insert({
      first_name: playerData.first_name,
      last_name: playerData.last_name,
      birth_year: playerData.birth_year ?? null,
      position: playerData.position ?? null,
      status: "active",
    })
    .select()
    .single()

  if (playerErr || !player) return { error: playerErr?.message ?? "Failed to create player" }

  // Link player to contact
  await supabase.from("player_contacts").insert({
    player_id: player.id,
    contact_id: contact.id,
    relationship: "guardian",
    is_primary: true,
    is_emergency: false,
  })

  // Add as attended walk-in
  const { error: partErr } = await supabase.from("event_participants").insert({
    event_id: eventId,
    player_id: player.id,
    contact_id: contact.id,
    status: "attended",
    checked_in_at: new Date().toISOString(),
    checked_in_by: user.id,
    status_updated_at: new Date().toISOString(),
  })

  if (!partErr) {
    await logActivity({
      type: "event_added",
      event_id: eventId,
      player_id: player.id,
      body: `Walk-in added to event`,
      created_by: user.id,
    })
  }

  return { error: partErr?.message ?? null }
}

export async function updateParticipantStatus(
  participantId: string,
  status: ParticipantStatus,
  eventId: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const user = await requireAuth()

  const { error } = await supabase
    .from("event_participants")
    .update({
      status,
      status_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", participantId)

  if (!error) {
    await logActivity({
      type: "status_change",
      event_id: eventId,
      body: `Participant status changed to ${status}`,
      created_by: user.id,
    })
  }

  return { error: error?.message ?? null }
}

export async function bulkUpdateParticipantStatus(
  participantIds: string[],
  status: ParticipantStatus,
  eventId: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const user = await requireAuth()

  const { error } = await supabase
    .from("event_participants")
    .update({
      status,
      status_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", participantIds)

  if (!error) {
    await logActivity({
      type: "status_change",
      event_id: eventId,
      body: `${participantIds.length} participant(s) status changed to ${status}`,
      created_by: user.id,
    })
  }

  return { error: error?.message ?? null }
}

export async function removeParticipant(
  participantId: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("event_participants")
    .delete()
    .eq("id", participantId)

  return { error: error?.message ?? null }
}

export async function checkInParticipant(
  participantId: string,
  status: "attended" | "no_show"
): Promise<{ error: string | null }> {
  await requireAnyRole()
  const supabase = await createClient()

  const { error } = await supabase.rpc("check_in_participant", {
    p_participant_id: participantId,
    p_status: status,
  })

  return { error: error?.message ?? null }
}

export async function updateParticipantLogistics(
  participantId: string,
  data: Pick<
    TablesUpdate<"event_participants">,
    "flight_out" | "flight_return" | "room" | "shirt_size" |
    "emergency_contact_name" | "emergency_contact_phone" | "logistics_notes"
  >
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("event_participants")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", participantId)

  return { error: error?.message ?? null }
}

// Promote first waitlisted participant after a confirmation slot opens
export async function promoteWaitlist(eventId: string): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: event } = await supabase
    .from("events")
    .select("capacity")
    .eq("id", eventId)
    .single()

  if (!event?.capacity) return

  const { count: confirmedCount } = await supabase
    .from("event_participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["confirmed", "attended"])

  if ((confirmedCount ?? 0) < event.capacity) {
    const { data: next } = await supabase
      .from("event_participants")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "waitlisted")
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (next) {
      await supabase
        .from("event_participants")
        .update({
          status: "confirmed",
          status_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", next.id)
    }
  }
}

// Search players not already in event
export async function searchPlayersForEvent(
  eventId: string,
  query: string
): Promise<Tables<"players">[]> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("event_participants")
    .select("player_id")
    .eq("event_id", eventId)
    .not("player_id", "is", null)

  const existingIds = (existing ?? []).map((e) => e.player_id).filter(Boolean) as string[]

  let q = supabase
    .from("players")
    .select("*")
    .is("archived_at", null)
    .order("last_name")
    .limit(20)

  if (query) {
    q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
  }

  if (existingIds.length > 0) {
    q = q.not("id", "in", `(${existingIds.join(",")})`)
  }

  const { data } = await q
  return data ?? []
}

// Search leads to add from
export async function searchLeadsForEvent(
  eventId: string,
  query: string
): Promise<(Tables<"leads"> & { contacts: Tables<"contacts"> | null; players: Tables<"players"> | null })[]> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("event_participants")
    .select("source_lead_id")
    .eq("event_id", eventId)
    .not("source_lead_id", "is", null)

  const existingLeadIds = (existing ?? []).map((e) => e.source_lead_id).filter(Boolean) as string[]

  let q = supabase
    .from("leads")
    .select("*, contacts(*), players(*)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20)

  if (query) {
    q = q.or(
      `contacts.first_name.ilike.%${query}%,contacts.last_name.ilike.%${query}%,contacts.email.ilike.%${query}%`
    )
  }

  if (existingLeadIds.length > 0) {
    q = q.not("id", "in", `(${existingLeadIds.join(",")})`)
  }

  const { data } = await q
  return (data ?? []) as (Tables<"leads"> & { contacts: Tables<"contacts"> | null; players: Tables<"players"> | null })[]
}

// Get templates list for reminder template picker
export async function listEmailTemplates(): Promise<Pick<Tables<"email_templates">, "id" | "name">[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from("email_templates").select("id, name").order("name")
  return data ?? []
}

export type LeadForEvent = {
  id: string
  stage: string
  source: string
  form_type: string | null
  campaign_name: string | null
  player_id: string | null
  contact_id: string | null
  contacts: Pick<Tables<"contacts">, "first_name" | "last_name" | "phone" | "state"> | null
  players: Pick<Tables<"players">, "id" | "first_name" | "last_name" | "birth_year" | "state"> | null
}

export async function listLeadsForEvent(eventId: string): Promise<LeadForEvent[]> {
  await requireAdmin()
  const supabase = await createClient()

  // Get leads already linked to this event (by source_lead_id) and player_ids already in event
  const { data: existing } = await supabase
    .from("event_participants")
    .select("source_lead_id, player_id")
    .eq("event_id", eventId)

  const excludeLeadIds = (existing ?? []).map((e) => e.source_lead_id).filter(Boolean) as string[]
  const excludePlayerIds = (existing ?? []).map((e) => e.player_id).filter(Boolean) as string[]

  let q = supabase
    .from("leads")
    .select("id, stage, source, form_type, campaign_name, player_id, contact_id, contacts(first_name, last_name, phone, state), players(id, first_name, last_name, birth_year, state)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(300)

  if (excludeLeadIds.length > 0) {
    q = q.not("id", "in", `(${excludeLeadIds.join(",")})`)
  }

  const { data } = await q

  return ((data ?? []) as LeadForEvent[]).filter((l) => {
    if (!l.player_id) return true
    return !excludePlayerIds.includes(l.player_id)
  })
}
