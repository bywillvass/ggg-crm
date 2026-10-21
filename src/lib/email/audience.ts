import { serviceClient } from "@/lib/supabase/service"
import type { Tables, Database } from "@/lib/database.types"

type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

export type AudienceContact = Pick<
  Tables<"contacts">,
  "id" | "first_name" | "last_name" | "email" | "unsubscribed_at" | "marketing_consent" | "tags"
> & { player_id?: string | null }

export type AudienceFilter = {
  type: "contacts" | "leads" | "event" | "fixed" | "players"
  filters?: {
    tags?: string[]
    consent?: string
    source?: string
    stage?: string
    event_id?: string
    participant_statuses?: ParticipantStatus[]
  }
  contactIds?: string[]
  playerIds?: string[]
}

function isAudienceFilter(x: unknown): x is AudienceFilter {
  return !!x && typeof x === "object" && "type" in (x as Record<string, unknown>)
}

// Fills player_id from player_contacts for contacts that don't already have one
async function attachPrimaryPlayers(contacts: AudienceContact[]): Promise<AudienceContact[]> {
  const ids = contacts.filter((c) => !c.player_id).map((c) => c.id)
  if (ids.length === 0) return contacts
  // Fetch all player_contacts, primary first; take first match per contact
  const { data } = await serviceClient
    .from("player_contacts")
    .select("contact_id, player_id, is_primary")
    .in("contact_id", ids)
    .order("is_primary", { ascending: false })
  const map = new Map<string, string>()
  for (const r of data ?? []) {
    if (!map.has(r.contact_id)) map.set(r.contact_id, r.player_id)
  }
  return contacts.map((c) => ({ ...c, player_id: c.player_id ?? map.get(c.id) ?? null }))
}

export async function resolveAudienceServer(
  rawAudience: unknown
): Promise<{ contacts: AudienceContact[]; skipped: number; total: number }> {
  if (!isAudienceFilter(rawAudience)) {
    return { contacts: [], skipped: 0, total: 0 }
  }
  const audience = rawAudience

  let candidates: AudienceContact[] = []
  // Selected players with no linked contact at all — counted as skipped
  let unreachable = 0

  if (audience.type === "fixed") {
    const ids = audience.contactIds ?? []
    if (ids.length === 0) return { contacts: [], skipped: 0, total: 0 }
    const { data } = await serviceClient
      .from("contacts")
      .select("id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags")
      .in("id", ids)
      .is("archived_at", null)
    candidates = (data ?? []) as AudienceContact[]
    candidates = await attachPrimaryPlayers(candidates)
  } else if (audience.type === "contacts") {
    let q = serviceClient
      .from("contacts")
      .select("id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags")
      .is("archived_at", null)

    const filters = audience.filters ?? {}
    if (filters.tags && filters.tags.length > 0) {
      q = q.overlaps("tags", filters.tags)
    }
    if (filters.consent) {
      q = q.eq("marketing_consent", filters.consent as Database["public"]["Enums"]["consent_type"])
    }
    if (filters.source) {
      q = q.eq("source", filters.source as Database["public"]["Enums"]["lead_source"])
    }
    const { data } = await q
    candidates = (data ?? []) as AudienceContact[]
    candidates = await attachPrimaryPlayers(candidates)
  } else if (audience.type === "leads") {
    const filters = audience.filters ?? {}
    let q = serviceClient
      .from("leads")
      .select("contact_id, player_id, contacts(id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags)")
      .is("archived_at", null)
      .not("contact_id", "is", null)

    if (filters.stage) {
      q = q.eq("stage", filters.stage as Database["public"]["Enums"]["lead_stage"])
    }
    if (filters.source) {
      q = q.eq("source", filters.source as Database["public"]["Enums"]["lead_source"])
    }

    const { data } = await q
    const uniq = new Map<string, AudienceContact>()
    for (const row of data ?? []) {
      const r = row as unknown as { player_id: string | null; contacts: AudienceContact | null }
      if (r.contacts && !uniq.has(r.contacts.id)) {
        uniq.set(r.contacts.id, { ...r.contacts, player_id: r.player_id ?? null })
      }
    }
    candidates = await attachPrimaryPlayers(Array.from(uniq.values()))
  } else if (audience.type === "players") {
    // One email per selected player, sent to their primary guardian (or any
    // linked contact). Siblings sharing a parent each get their own email.
    const ids = audience.playerIds ?? []
    if (ids.length === 0) return { contacts: [], skipped: 0, total: 0 }
    const { data } = await serviceClient
      .from("player_contacts")
      .select("player_id, is_primary, contacts(id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags, archived_at)")
      .in("player_id", ids)
      .order("is_primary", { ascending: false })
    const byPlayer = new Map<string, AudienceContact>()
    for (const row of data ?? []) {
      const r = row as unknown as { player_id: string; contacts: (AudienceContact & { archived_at: string | null }) | null }
      if (!r.contacts || r.contacts.archived_at || byPlayer.has(r.player_id)) continue
      const c = r.contacts
      byPlayer.set(r.player_id, {
        id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email,
        unsubscribed_at: c.unsubscribed_at, marketing_consent: c.marketing_consent, tags: c.tags,
        player_id: r.player_id,
      })
    }
    candidates = Array.from(byPlayer.values())
    unreachable = ids.length - candidates.length
  } else if (audience.type === "event") {
    const filters = audience.filters ?? {}
    if (!filters.event_id) return { contacts: [], skipped: 0, total: 0 }

    let q = serviceClient
      .from("event_participants")
      .select(`
        contact_id,
        player_id,
        contacts(id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags),
        players(player_contacts(is_primary, contacts(id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags)))
      `)
      .eq("event_id", filters.event_id)

    if (filters.participant_statuses && filters.participant_statuses.length > 0) {
      q = q.in("status", filters.participant_statuses)
    }

    const { data } = await q
    const uniq = new Map<string, AudienceContact>()
    for (const row of data ?? []) {
      const r = row as unknown as {
        contact_id: string | null
        player_id: string | null
        players: {
          player_contacts: {
            is_primary: boolean
            contacts: AudienceContact | null
          }[]
        } | null
        contacts: AudienceContact | null
      }
      // Prefer direct contact if present
      if (r.contacts && !uniq.has(r.contacts.id)) {
        uniq.set(r.contacts.id, { ...r.contacts, player_id: r.player_id ?? null })
      }
      // Also include primary player_contact (the parent), linked to the same player
      if (r.players) {
        const primary = r.players.player_contacts?.find((pc) => pc.is_primary)?.contacts
        if (primary && !uniq.has(primary.id)) {
          uniq.set(primary.id, { ...primary, player_id: r.player_id ?? null })
        }
      }
    }
    candidates = await attachPrimaryPlayers(Array.from(uniq.values()))
  }

  const total = candidates.length + unreachable
  const valid = candidates.filter((c) => c.email && !c.unsubscribed_at)
  const skipped = total - valid.length

  return { contacts: valid, skipped, total }
}
