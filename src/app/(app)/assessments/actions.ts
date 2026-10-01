"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin, getCurrentRole, requireAuth, getAuthUser } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { logActivity } from "@/lib/activity"
import { redirect } from "next/navigation"
import type { Tables, TablesInsert, TablesUpdate, Database } from "@/lib/database.types"

type AssessmentRecommendation = Database["public"]["Enums"]["assessment_recommendation"]

async function requireAnyRole() {
  const role = await getCurrentRole()
  if (!role) redirect("/login")
  return role
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssessmentRow = Tables<"assessments"> & {
  players: Pick<Tables<"players">, "id" | "first_name" | "last_name" | "birth_year" | "position"> | null
  events: Pick<Tables<"events">, "id" | "title" | "start_at"> | null
  profiles: Pick<Tables<"profiles">, "full_name"> | null
}

export type AssessmentInput = {
  player_id: string
  event_id: string
  position_played?: string | null
  technical?: number | null
  tactical?: number | null
  physical?: number | null
  mental?: number | null
  overall?: number | null
  strengths?: string | null
  improvements?: string | null
  notes?: string | null
  recommendation?: AssessmentRecommendation | null
}

export type EventSelectItem = Pick<Tables<"events">, "id" | "title" | "start_at">

export type PlayerSearchResult = Pick<Tables<"players">, "id" | "first_name" | "last_name" | "birth_year" | "position">

// ─── Actions ─────────────────────────────────────────────────────────────────

const _cachedAssessments = unstable_cache(
  async (): Promise<AssessmentRow[]> => {
    const { data } = await serviceClient
      .from("assessments")
      .select(`
        *,
        players:player_id(id, first_name, last_name, birth_year, position),
        events:event_id(id, title, start_at),
        profiles:assessor_id(full_name)
      `)
      .order("created_at", { ascending: false })
    return (data ?? []) as AssessmentRow[]
  },
  ["assessments"],
  { revalidate: 60, tags: ["assessments"] }
)

export async function listAssessments(filters?: {
  eventId?: string
  birthYear?: number
  recommendation?: string
  myOnly?: boolean
}): Promise<AssessmentRow[]> {
  const role = await requireAnyRole()

  let results = await _cachedAssessments()

  if (filters?.eventId) {
    results = results.filter((a) => a.event_id === filters.eventId)
  }

  if (filters?.recommendation) {
    results = results.filter(
      (a) => a.recommendation === (filters.recommendation as AssessmentRecommendation)
    )
  }

  if (filters?.myOnly) {
    const user = await getAuthUser()
    if (user) {
      results = results.filter((a) => a.assessor_id === user.id)
    }
  }

  if (filters?.birthYear) {
    results = results.filter((a) => a.players?.birth_year === filters.birthYear)
  }

  void role
  return results
}

export async function getAssessment(id: string): Promise<AssessmentRow | null> {
  await requireAnyRole()
  const supabase = await createClient()

  const { data } = await supabase
    .from("assessments")
    .select(`
      *,
      players:player_id(id, first_name, last_name, birth_year, position),
      events:event_id(id, title, start_at),
      profiles:assessor_id(full_name)
    `)
    .eq("id", id)
    .single()

  return data as AssessmentRow | null
}

export async function createAssessment(
  input: AssessmentInput
): Promise<{ data: Tables<"assessments"> | null; error: string | null }> {
  await requireAnyRole()
  const user = await requireAuth()
  const supabase = await createClient()

  const insert: TablesInsert<"assessments"> = {
    player_id: input.player_id,
    event_id: input.event_id,
    assessor_id: user.id,
    position_played: input.position_played ?? null,
    technical: input.technical ?? null,
    tactical: input.tactical ?? null,
    physical: input.physical ?? null,
    mental: input.mental ?? null,
    overall: input.overall ?? null,
    strengths: input.strengths ?? null,
    improvements: input.improvements ?? null,
    notes: input.notes ?? null,
    recommendation: input.recommendation ?? null,
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert(insert)
    .select()
    .single()

  if (data) {
    await logActivity({
      type: "assessment_added",
      player_id: data.player_id,
      event_id: data.event_id,
      body: `Assessment added`,
      created_by: user.id,
    })
  }

  updateTag("assessments")
  return { data, error: error?.message ?? null }
}

export async function updateAssessment(
  id: string,
  input: Partial<AssessmentInput>
): Promise<{ error: string | null }> {
  const role = await requireAnyRole()
  const user = await requireAuth()
  const supabase = await createClient()

  // Ownership check for coaches
  if (role === "coach") {
    const { data: existing } = await supabase
      .from("assessments")
      .select("assessor_id")
      .eq("id", id)
      .single()

    if (existing?.assessor_id !== user.id) {
      return { error: "You can only edit your own assessments" }
    }
  }

  const updates: TablesUpdate<"assessments"> = {
    updated_at: new Date().toISOString(),
  }

  if (input.position_played !== undefined) updates.position_played = input.position_played
  if (input.technical !== undefined) updates.technical = input.technical
  if (input.tactical !== undefined) updates.tactical = input.tactical
  if (input.physical !== undefined) updates.physical = input.physical
  if (input.mental !== undefined) updates.mental = input.mental
  if (input.overall !== undefined) updates.overall = input.overall
  if (input.strengths !== undefined) updates.strengths = input.strengths
  if (input.improvements !== undefined) updates.improvements = input.improvements
  if (input.notes !== undefined) updates.notes = input.notes
  if (input.recommendation !== undefined) updates.recommendation = input.recommendation

  const { error } = await supabase.from("assessments").update(updates).eq("id", id)

  updateTag("assessments")
  return { error: error?.message ?? null }
}

export async function deleteAssessment(id: string): Promise<{ error: string | null }> {
  const role = await requireAnyRole()
  const user = await requireAuth()
  const supabase = await createClient()

  // Ownership check for coaches
  if (role === "coach") {
    const { data: existing } = await supabase
      .from("assessments")
      .select("assessor_id")
      .eq("id", id)
      .single()

    if (existing?.assessor_id !== user.id) {
      return { error: "You can only delete your own assessments" }
    }
  }

  const { error } = await supabase.from("assessments").delete().eq("id", id)

  updateTag("assessments")
  return { error: error?.message ?? null }
}

export async function getEventComparison(eventId: string): Promise<AssessmentRow[]> {
  await requireAnyRole()
  const supabase = await createClient()

  const { data } = await supabase
    .from("assessments")
    .select(`
      *,
      players:player_id(id, first_name, last_name, birth_year, position),
      events:event_id(id, title, start_at),
      profiles:assessor_id(full_name)
    `)
    .eq("event_id", eventId)
    .order("overall", { ascending: false, nullsFirst: false })

  return (data ?? []) as AssessmentRow[]
}

export async function bulkAddToEvent(
  playerIds: string[],
  targetEventId: string
): Promise<{ added: number; skipped: number }> {
  await requireAdmin()
  const supabase = await createClient()

  // Get already existing participants for target event
  const { data: existing } = await supabase
    .from("event_participants")
    .select("player_id")
    .eq("event_id", targetEventId)
    .not("player_id", "is", null)

  const existingPlayerIds = new Set(
    (existing ?? []).map((e) => e.player_id).filter(Boolean) as string[]
  )

  let added = 0
  let skipped = 0

  for (const playerId of playerIds) {
    if (existingPlayerIds.has(playerId)) {
      skipped++
      continue
    }

    const { error } = await supabase.from("event_participants").insert({
      event_id: targetEventId,
      player_id: playerId,
      contact_id: null,
      status: "invited",
      status_updated_at: new Date().toISOString(),
    })

    if (!error) {
      added++
    } else {
      skipped++
    }
  }

  return { added, skipped }
}

export async function listEventsForSelect(): Promise<EventSelectItem[]> {
  await requireAnyRole()
  const supabase = await createClient()

  const { data } = await supabase
    .from("events")
    .select("id, title, start_at")
    .is("archived_at", null)
    .order("start_at", { ascending: false })

  return (data ?? []) as EventSelectItem[]
}

export async function searchPlayersForAssessment(query: string): Promise<PlayerSearchResult[]> {
  await requireAnyRole()
  const supabase = await createClient()

  let q = supabase
    .from("players")
    .select("id, first_name, last_name, birth_year, position")
    .is("archived_at", null)
    .order("last_name")
    .limit(20)

  if (query.length >= 2) {
    q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
  }

  const { data } = await q
  return (data ?? []) as PlayerSearchResult[]
}
