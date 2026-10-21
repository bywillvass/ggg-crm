import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables, TablesUpdate } from "@/lib/database.types"
import { phoneSearchKey } from "@/lib/phone"

// SERVER-SIDE ONLY. Merges a duplicate player into the one being kept:
// every record pointing at the duplicate is repointed, blank profile fields on
// the keeper are filled from the duplicate, and the duplicate is archived
// (never deleted), with a note on both records.

type Client = SupabaseClient<Database>
type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

export type MergeResult = {
  moved: Record<string, number>
  contactsLinked: number
  contactsArchived: number
  fieldsFilled: string[]
}

// Simple profile fields copied onto the keeper when it has none
const FILLABLE_FIELDS = [
  "first_name", "last_name", "dob", "gender", "position", "secondary_position",
  "preferred_foot", "current_club", "level", "suburb", "state", "photo_path",
  "medical_alerts", "dietary_notes", "eligibility_notes",
] as const

// When both records are in the same event, keep the most informative status
const STATUS_RANK: Record<ParticipantStatus, number> = {
  attended: 7, no_show: 6, confirmed: 5, invited: 4, waitlisted: 3,
  to_be_invited: 2, declined: 1, cancelled: 0,
}

// Logistics columns copied onto the keeper's participant row when blank
const PARTICIPANT_FILL_FIELDS = [
  "checked_in_at", "checked_in_by", "flight_out", "flight_return", "room", "shirt_size",
  "emergency_contact_name", "emergency_contact_phone", "logistics_notes", "notes", "source_lead_id",
] as const

// Tables whose player_id can simply be repointed
const REPOINT_TABLES = [
  "leads", "activities", "tasks", "assessments", "documents", "invoices", "email_messages",
] as const

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "")
const fullName = (p: Pick<Tables<"players">, "first_name" | "last_name">) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unnamed player"

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data
}

export async function mergePlayersCore(
  db: Client,
  keepId: string,
  dupId: string,
  createdBy: string | null = null
): Promise<MergeResult> {
  if (keepId === dupId) throw new Error("Can't merge a player into itself")

  const [keep, dup] = await Promise.all([
    must(db.from("players").select("*").eq("id", keepId).single()),
    must(db.from("players").select("*").eq("id", dupId).single()),
  ])
  if (!keep || !dup) throw new Error("Player not found")
  if (keep.archived_at) throw new Error("The player you're keeping is archived")
  if (dup.archived_at) throw new Error("That duplicate is already archived")

  const result: MergeResult = { moved: {}, contactsLinked: 0, contactsArchived: 0, fieldsFilled: [] }

  // ── 1. Event entries (unique per event + player) ────────────────────────────
  const [keepEps, dupEps] = await Promise.all([
    must(db.from("event_participants").select("*").eq("player_id", keepId)),
    must(db.from("event_participants").select("*").eq("player_id", dupId)),
  ])
  let epMoved = 0
  for (const d of dupEps ?? []) {
    const k = keepEps?.find((e) => e.event_id === d.event_id)
    if (!k) {
      await must(db.from("event_participants").update({ player_id: keepId }).eq("id", d.id))
      epMoved++
      continue
    }
    const patch: TablesUpdate<"event_participants"> = { updated_at: new Date().toISOString() }
    if (STATUS_RANK[d.status] > STATUS_RANK[k.status]) {
      patch.status = d.status
      patch.status_updated_at = d.status_updated_at
    }
    for (const f of PARTICIPANT_FILL_FIELDS) {
      if (blank(k[f]) && !blank(d[f])) (patch as Record<string, unknown>)[f] = d[f]
    }
    await must(db.from("event_participants").update(patch).eq("id", k.id))
    // Document upload links hang off the participant row and cascade on delete
    await must(db.from("document_request_tokens").update({ event_participant_id: k.id }).eq("event_participant_id", d.id))
    await must(db.from("event_participants").delete().eq("id", d.id))
    epMoved++
  }
  result.moved.event_participants = epMoved

  // ── 2. Everything else that just points at the player ───────────────────────
  for (const table of REPOINT_TABLES) {
    const rows = await must(db.from(table).update({ player_id: keepId }).eq("player_id", dupId).select("id"))
    result.moved[table] = rows?.length ?? 0
  }

  // ── 3. Parent/guardian links ────────────────────────────────────────────────
  type Link = Tables<"player_contacts"> & { contacts: Tables<"contacts"> | null }
  const [keepLinks, dupLinks] = await Promise.all([
    must(db.from("player_contacts").select("*, contacts(*)").eq("player_id", keepId)) as Promise<Link[]>,
    must(db.from("player_contacts").select("*, contacts(*)").eq("player_id", dupId)) as Promise<Link[]>,
  ])
  const keepContactIds = new Set(keepLinks.map((l) => l.contact_id))
  const keepPhones = new Set(keepLinks.map((l) => l.contacts?.phone).filter(Boolean).map((p) => phoneSearchKey(p!)))
  let keepHasPrimary = keepLinks.some((l) => l.is_primary)
  const droppedContactIds: string[] = []

  for (const l of dupLinks) {
    const c = l.contacts
    // A contact adds nothing if it's already linked, or has no email and either
    // no phone or a phone the keeper's contacts already have
    const redundant =
      keepContactIds.has(l.contact_id) ||
      (!!c && !c.email && (!c.phone || keepPhones.has(phoneSearchKey(c.phone))))
    if (redundant) {
      await must(db.from("player_contacts").delete().eq("id", l.id))
      if (!keepContactIds.has(l.contact_id)) droppedContactIds.push(l.contact_id)
      continue
    }
    await must(
      db.from("player_contacts")
        .update({ player_id: keepId, is_primary: l.is_primary && !keepHasPrimary })
        .eq("id", l.id)
    )
    keepHasPrimary = keepHasPrimary || l.is_primary
    keepContactIds.add(l.contact_id)
    if (c?.phone) keepPhones.add(phoneSearchKey(c.phone))
    result.contactsLinked++
  }

  // Archive dropped contacts that nothing else uses any more
  for (const contactId of droppedContactIds) {
    const counts = await Promise.all(
      (["player_contacts", "leads", "event_participants", "invoices", "email_messages"] as const).map(async (t) => {
        const { count } = await db.from(t).select("id", { count: "exact", head: true }).eq("contact_id", contactId)
        return count ?? 0
      })
    )
    if (counts.every((n) => n === 0)) {
      await must(db.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", contactId))
      result.contactsArchived++
    }
  }

  // ── 4. Fill blanks on the keeper, then archive the duplicate ────────────────
  const now = new Date().toISOString()
  const playerPatch: TablesUpdate<"players"> = { updated_at: now }
  for (const f of FILLABLE_FIELDS) {
    if (blank(keep[f]) && !blank(dup[f])) {
      (playerPatch as Record<string, unknown>)[f] = dup[f]
      result.fieldsFilled.push(f)
    }
  }
  if (keep.status === "prospect" && dup.status !== "prospect") {
    playerPatch.status = dup.status
    result.fieldsFilled.push("status")
  }
  if (!blank(dup.notes) && dup.notes !== keep.notes) {
    playerPatch.notes = blank(keep.notes) ? dup.notes : `${keep.notes}\n\n${dup.notes}`
    result.fieldsFilled.push("notes")
  }
  await must(db.from("players").update(playerPatch).eq("id", keepId))

  const mergedNote = `Merged into ${fullName(keep)} (${keepId}) on ${now.slice(0, 10)}`
  await must(
    db.from("players")
      .update({ archived_at: now, updated_at: now, notes: blank(dup.notes) ? mergedNote : `${dup.notes}\n\n${mergedNote}` })
      .eq("id", dupId)
  )

  const movedSummary = Object.entries(result.moved).filter(([, n]) => n > 0).map(([t, n]) => `${n} ${t.replace("_", " ")}`).join(", ")
  await must(
    db.from("activities").insert({
      type: "note",
      player_id: keepId,
      created_by: createdBy,
      body: `Merged duplicate player record "${fullName(dup)}" (created ${dup.created_at.slice(0, 10)}) into this one.${movedSummary ? ` Moved: ${movedSummary}.` : ""}`,
      meta: { merged_player_id: dupId, ...result },
    })
  )

  return result
}
