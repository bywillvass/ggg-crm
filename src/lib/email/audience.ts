import { serviceClient } from "@/lib/supabase/service"
import type { Tables, Database } from "@/lib/database.types"

type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

export type AudienceContact = Pick<
  Tables<"contacts">,
  "id" | "first_name" | "last_name" | "email" | "unsubscribed_at" | "marketing_consent" | "tags"
>

export type AudienceFilter = {
  type: "contacts" | "leads" | "event" | "fixed"
  filters?: {
    tags?: string[]
    consent?: string
    source?: string
    stage?: string
    event_id?: string
    participant_statuses?: ParticipantStatus[]
  }
  contactIds?: string[]
}

function isAudienceFilter(x: unknown): x is AudienceFilter {
  return !!x && typeof x === "object" && "type" in (x as Record<string, unknown>)
}

export async function resolveAudienceServer(
  rawAudience: unknown
): Promise<{ contacts: AudienceContact[]; skipped: number; total: number }> {
  if (!isAudienceFilter(rawAudience)) {
    return { contacts: [], skipped: 0, total: 0 }
  }
  const audience = rawAudience

  let candidates: AudienceContact[] = []

  if (audience.type === "fixed") {
    const ids = audience.contactIds ?? []
    if (ids.length === 0) return { contacts: [], skipped: 0, total: 0 }
    const { data } = await serviceClient
      .from("contacts")
      .select("id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags")
      .in("id", ids)
      .is("archived_at", null)
    candidates = (data ?? []) as AudienceContact[]
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
  } else if (audience.type === "leads") {
    const filters = audience.filters ?? {}
    let q = serviceClient
      .from("leads")
      .select("contact_id, contacts(id, first_name, last_name, email, unsubscribed_at, marketing_consent, tags)")
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
      const r = row as unknown as { contacts: AudienceContact | null }
      if (r.contacts && !uniq.has(r.contacts.id)) {
        uniq.set(r.contacts.id, r.contacts)
      }
    }
    candidates = Array.from(uniq.values())
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
        uniq.set(r.contacts.id, r.contacts)
      }
      // Also include primary player_contact
      if (r.players) {
        const primary = r.players.player_contacts?.find((pc) => pc.is_primary)?.contacts
        if (primary && !uniq.has(primary.id)) {
          uniq.set(primary.id, primary)
        }
      }
    }
    candidates = Array.from(uniq.values())
  }

  const total = candidates.length
  const valid = candidates.filter((c) => c.email && !c.unsubscribed_at)
  const skipped = total - valid.length

  return { contacts: valid, skipped, total }
}
