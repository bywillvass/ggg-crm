"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin, getAuthUser } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { logActivity } from "@/lib/activity"
import type { Tables, TablesInsert, TablesUpdate, Database } from "@/lib/database.types"

type LeadStage = Database["public"]["Enums"]["lead_stage"]
type LeadSource = Database["public"]["Enums"]["lead_source"]

export type LeadWithRelations = Tables<"leads"> & {
  contacts: Tables<"contacts"> | null
  players: Tables<"players"> | null
  profiles: Pick<Tables<"profiles">, "full_name"> | null
  event_participants: { event_id: string; events: Pick<Tables<"events">, "id" | "title" | "start_at"> | null }[]
}

export type LeadDetail = Tables<"leads"> & {
  contacts: Tables<"contacts"> | null
  players: Tables<"players"> | null
  profiles: Pick<Tables<"profiles">, "full_name"> | null
  activities: Tables<"activities">[]
  tasks: Tables<"tasks">[]
}

const _cachedLeads = unstable_cache(
  async (): Promise<LeadWithRelations[]> => {
    const { data } = await serviceClient
      .from("leads")
      .select("*, contacts(*), players(*), profiles!leads_owner_id_fkey(full_name), event_participants!source_lead_id(event_id, events(id, title, start_at))")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
    return (data ?? []) as LeadWithRelations[]
  },
  ["leads"],
  { revalidate: 60, tags: ["leads"] }
)

export async function listLeads(filters?: {
  source?: string
  form_type?: string
  stage?: string
  owner_id?: string
  search?: string
  archived?: boolean
  campaign_name?: string
  adset_name?: string
  has_player?: boolean
  squad?: string
  birth_year?: number
  state?: string
}): Promise<LeadWithRelations[]> {
  await requireAdmin()

  let results: LeadWithRelations[]

  if (filters?.archived === true) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("leads")
      .select("*, contacts(*), players(*), profiles!leads_owner_id_fkey(full_name)")
      .order("created_at", { ascending: false })
    results = (data ?? []) as LeadWithRelations[]
  } else {
    results = await _cachedLeads()
  }

  if (filters?.source) {
    results = results.filter((l) => l.source === (filters.source as LeadSource))
  }

  if (filters?.form_type) {
    const ft = filters.form_type.toLowerCase()
    results = results.filter((l) => (l.form_type ?? "").toLowerCase().includes(ft))
  }

  if (filters?.stage) {
    results = results.filter((l) => l.stage === (filters.stage as LeadStage))
  }

  if (filters?.owner_id) {
    results = results.filter((l) => l.owner_id === filters.owner_id)
  }

  if (filters?.campaign_name) {
    const cn = filters.campaign_name.toLowerCase()
    results = results.filter((l) => (l.campaign_name ?? "").toLowerCase().includes(cn))
  }

  if (filters?.adset_name) {
    const an = filters.adset_name.toLowerCase()
    results = results.filter((l) => (l.adset_name ?? "").toLowerCase().includes(an))
  }

  if (filters?.has_player === true) {
    results = results.filter((l) => l.player_id !== null)
  } else if (filters?.has_player === false) {
    results = results.filter((l) => l.player_id === null)
  }

  if (filters?.squad) {
    results = results.filter((l) => l.players?.squad === filters.squad)
  }

  if (filters?.birth_year) {
    results = results.filter((l) => l.players?.birth_year === filters.birth_year)
  }

  if (filters?.state) {
    const st = filters.state.toLowerCase()
    results = results.filter(
      (l) =>
        (l.contacts?.state ?? "").toLowerCase() === st ||
        (l.players?.state ?? "").toLowerCase() === st
    )
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    results = results.filter((l) => {
      const contactName = `${l.contacts?.first_name ?? ""} ${l.contacts?.last_name ?? ""}`.toLowerCase()
      const playerName = `${l.players?.first_name ?? ""} ${l.players?.last_name ?? ""}`.toLowerCase()
      return (
        contactName.includes(s) ||
        playerName.includes(s) ||
        (l.contacts?.email ?? "").toLowerCase().includes(s) ||
        (l.contacts?.phone ?? "").toLowerCase().includes(s) ||
        (l.campaign_name ?? "").toLowerCase().includes(s) ||
        (l.form_type ?? "").toLowerCase().includes(s)
      )
    })
  }

  return results
}

export async function getLead(id: string): Promise<LeadDetail | null> {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("leads")
    .select(`
      *,
      contacts(*),
      players(*),
      profiles!leads_owner_id_fkey(full_name),
      activities(*),
      tasks(*)
    `)
    .eq("id", id)
    .order("created_at", { referencedTable: "activities", ascending: false })
    .single()

  return data as LeadDetail | null
}

export async function createLead(
  input: TablesInsert<"leads">
): Promise<{ data: Tables<"leads"> | null; error: string | null }> {
  await requireAdmin()
  const [user, supabase] = await Promise.all([getAuthUser(), createClient()])

  const { data, error } = await supabase
    .from("leads")
    .insert(input)
    .select()
    .single()

  if (data) {
    await logActivity({
      type: "lead_created",
      lead_id: data.id,
      contact_id: data.contact_id ?? null,
      player_id: data.player_id ?? null,
      created_by: user?.id ?? null,
    })
  }

  updateTag("leads")
  return { data, error: error?.message ?? null }
}

export async function updateLead(
  id: string,
  updates: TablesUpdate<"leads">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("leads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function updateLeadStage(
  id: string,
  newStage: LeadStage
): Promise<{ error: string | null }> {
  await requireAdmin()
  const [user, supabase] = await Promise.all([getAuthUser(), createClient()])

  const { error } = await supabase
    .from("leads")
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (!error) {
    await logActivity({
      type: "stage_change",
      lead_id: id,
      body: `Stage changed to ${newStage}`,
      created_by: user?.id ?? null,
    })
  }

  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function archiveLead(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function createAndLinkPlayer(
  leadId: string,
  playerData: {
    first_name: string | null
    last_name: string | null
    birth_year: number | null
    current_club: string | null
    position: string | null
  }
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  // Get the lead to find the contact
  const { data: lead } = await supabase
    .from("leads")
    .select("contact_id")
    .eq("id", leadId)
    .single()

  if (!lead) return { error: "Lead not found" }

  // Create the player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ ...playerData, status: "prospect" })
    .select("id")
    .single()

  if (playerError) return { error: playerError.message }

  // Link player to contact if contact exists
  if (lead.contact_id) {
    await supabase.from("player_contacts").insert({
      player_id: player.id,
      contact_id: lead.contact_id,
      relationship: "guardian",
      is_primary: true,
      is_emergency: false,
    })
  }

  // Link player to lead
  const { error: linkError } = await supabase
    .from("leads")
    .update({ player_id: player.id, updated_at: new Date().toISOString() })
    .eq("id", leadId)

  updateTag("leads")
  return { error: linkError?.message ?? null }
}

export async function bulkUpdateStage(
  ids: string[],
  stage: LeadStage
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("leads")
    .update({ stage, updated_at: new Date().toISOString() })
    .in("id", ids)

  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function bulkAssignOwner(
  ids: string[],
  owner_id: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("leads")
    .update({ owner_id, updated_at: new Date().toISOString() })
    .in("id", ids)

  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function bulkArchive(ids: string[]): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .in("id", ids)

  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function importCSVLeads(
  rows: Record<string, string>[],
  source: string,
  formType: string,
  columnMap: Record<string, string>
): Promise<{
  created: number
  merged: number
  duplicates: number
  errors: number
  details: string[]
}> {
  await requireAdmin()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const ingestSecret = process.env.INGEST_SECRET ?? ""

  const fileHash = `${rows.length}-${Object.keys(rows[0] ?? {}).join(",")}`

  let created = 0
  let merged = 0
  let duplicates = 0
  let errors = 0
  const details: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const fields: Record<string, string> = {}

    for (const [csvCol, target] of Object.entries(columnMap)) {
      if (target && target !== "skip" && row[csvCol] !== undefined) {
        fields[target] = row[csvCol]
      }
    }

    const externalId = `import:${fileHash}:${i}`

    try {
      const res = await fetch(`${appUrl}/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ingest-secret": ingestSecret,
        },
        body: JSON.stringify({
          source: source as LeadSource,
          form_type: formType,
          external_id: externalId,
          fields,
        }),
      })

      if (res.ok) {
        const result = await res.json() as { status?: string }
        if (result.status === "created") created++
        else if (result.status === "merged") merged++
        else if (result.status === "duplicate") duplicates++
        else created++
      } else {
        errors++
        details.push(`Row ${i + 1}: HTTP ${res.status}`)
      }
    } catch (err) {
      errors++
      details.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  return { created, merged, duplicates, errors, details }
}

// Player field detection for raw form data (same key set as LeadDetail)
const _PLAYER_FULL = new Set(["playername","playersname","playerfullname","playersfullname","childname","childsname","childfullname","childsfullname","kidname","kidsname","kidfullname","kidsfullname","athletename","athletefullname"])
const _PLAYER_FIRST = new Set(["playerfirstname","playersfirstname","playerfirst","childfirstname","childsfirstname","kidfirstname","athletefirstname"])
const _PLAYER_LAST = new Set(["playerlastname","playerslastname","playerlast","childlastname","childslastname","kidlastname","athletelastname"])
const _PLAYER_BIRTH = new Set(["birthyear","yearofbirth","playerbirthyear","playersbirthyear"])
function _nk(k: string) { return k.toLowerCase().replace(/[^a-z0-9]/g, "") }

export async function addLeadToEvent(
  leadId: string,
  eventId: string,
  status: "invited" | "confirmed" | "waitlisted" = "invited"
): Promise<{ error: string | null; alreadyInEvent?: boolean; eventTitle?: string }> {
  await requireAdmin()
  const [user, supabase] = await Promise.all([getAuthUser(), createClient()])

  // Fetch lead + event in parallel
  const [leadRes, eventRes] = await Promise.all([
    supabase.from("leads").select("*, contacts(*), players(*)").eq("id", leadId).single(),
    supabase.from("events").select("id, title, capacity").eq("id", eventId).single(),
  ])
  if (!leadRes.data) return { error: "Lead not found" }
  if (!eventRes.data) return { error: "Event not found" }
  const lead = leadRes.data as Tables<"leads"> & { contacts: Tables<"contacts"> | null; players: Tables<"players"> | null }
  const event = eventRes.data

  let playerId: string | null = lead.player_id
  const contactId: string | null = lead.contact_id

  // If no player, try to create one from raw form data
  if (!playerId) {
    const raw = lead.raw as Record<string, unknown> | null
    if (raw) {
      let firstName: string | null = null; let lastName: string | null = null; let birthYear: number | null = null
      for (const [k, v] of Object.entries(raw)) {
        const nk = _nk(k); const val = v ? String(v).trim() : ""
        if (!val) continue
        if (_PLAYER_FULL.has(nk) && !firstName) { const p = val.split(/\s+/); firstName = p[0] ?? null; lastName = p.slice(1).join(" ") || null }
        if (_PLAYER_FIRST.has(nk) && !firstName) firstName = val
        if (_PLAYER_LAST.has(nk) && !lastName) lastName = val
        if (_PLAYER_BIRTH.has(nk) && !birthYear) { const n = parseInt(val); if (!isNaN(n)) birthYear = n }
      }
      if (firstName || lastName) {
        const { data: newPlayer } = await supabase
          .from("players")
          .insert({ first_name: firstName, last_name: lastName, birth_year: birthYear, status: "prospect" })
          .select("id").single()
        if (newPlayer) {
          playerId = newPlayer.id
          if (contactId) {
            await supabase.from("player_contacts").insert({ player_id: playerId, contact_id: contactId, relationship: "guardian", is_primary: true, is_emergency: false })
          }
          await supabase.from("leads").update({ player_id: playerId, updated_at: new Date().toISOString() }).eq("id", leadId)
        }
      }
    }
  }

  // Check if this lead is already linked to this event
  const [leadCheck, playerCheck] = await Promise.all([
    supabase.from("event_participants").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("source_lead_id", leadId),
    playerId
      ? supabase.from("event_participants").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("player_id", playerId)
      : Promise.resolve({ count: 0 }),
  ])
  if ((leadCheck.count ?? 0) > 0 || ((playerCheck as { count: number | null }).count ?? 0) > 0) {
    return { error: null, alreadyInEvent: true, eventTitle: event.title }
  }

  // Auto-waitlist if event is at capacity
  let finalStatus: typeof status = status
  if (event.capacity && status === "confirmed") {
    const { count } = await supabase
      .from("event_participants").select("id", { count: "exact", head: true })
      .eq("event_id", eventId).in("status", ["confirmed", "attended"])
    if ((count ?? 0) >= event.capacity) finalStatus = "waitlisted"
  }

  const { error: partErr } = await supabase.from("event_participants").insert({
    event_id: eventId, player_id: playerId, contact_id: contactId,
    status: finalStatus, status_updated_at: new Date().toISOString(), source_lead_id: leadId,
  })
  if (partErr) return { error: partErr.message }

  await logActivity({
    type: "event_added", lead_id: leadId, event_id: eventId,
    contact_id: contactId ?? undefined, player_id: playerId ?? undefined,
    body: `Added to event: ${event.title}`, created_by: user?.id ?? null,
  })

  updateTag("leads")
  updateTag("events")
  return { error: null, eventTitle: event.title }
}

export async function bulkAddLeadsToEvent(
  leadIds: string[],
  eventId: string,
  status: "invited" | "confirmed" | "waitlisted" = "invited"
): Promise<{ added: number; skipped: number; error: string | null }> {
  await requireAdmin()
  let added = 0; let skipped = 0
  for (const leadId of leadIds) {
    const r = await addLeadToEvent(leadId, eventId, status)
    if (r.error) return { added, skipped, error: r.error }
    if (r.alreadyInEvent) skipped++
    else added++
  }
  return { added, skipped, error: null }
}

export async function addTagToLead(id: string, tag: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: lead } = await supabase.from("leads").select("contact_id").eq("id", id).single()
  if (!lead?.contact_id) return { error: null }
  const { data: contact } = await supabase.from("contacts").select("tags").eq("id", lead.contact_id).single()
  const existing: string[] = (contact?.tags as string[]) ?? []
  if (existing.includes(tag)) return { error: null }
  const { error } = await supabase.from("contacts").update({ tags: [...existing, tag] }).eq("id", lead.contact_id)
  updateTag("leads")
  return { error: error?.message ?? null }
}

export async function bulkAddTagToLeads(ids: string[], tag: string): Promise<{ error: string | null }> {
  await requireAdmin()
  for (const id of ids) {
    const r = await addTagToLead(id, tag)
    if (r.error) return r
  }
  return { error: null }
}
