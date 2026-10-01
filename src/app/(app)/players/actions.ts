"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types"

export type PlayerDetail = Tables<"players"> & {
  player_contacts: (Tables<"player_contacts"> & { contacts: Tables<"contacts"> | null })[]
  event_participants: (Tables<"event_participants"> & { events: Tables<"events"> | null })[]
  assessments: Tables<"assessments">[]
  activities: Tables<"activities">[]
  tasks: Tables<"tasks">[]
}

const _cachedPlayers = unstable_cache(
  async (): Promise<Tables<"players">[]> => {
    const { data } = await serviceClient
      .from("players")
      .select("*")
      .is("archived_at", null)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
    return data ?? []
  },
  ["players"],
  { revalidate: 60, tags: ["players"] }
)

export async function listPlayers(filters?: {
  birth_year?: number
  position?: string
  club?: string
  level?: string
  state?: string
  status?: string
  search?: string
}): Promise<Tables<"players">[]> {
  await requireAdmin()

  let results = await _cachedPlayers()

  if (filters?.birth_year) {
    results = results.filter((p) => p.birth_year === filters.birth_year)
  }

  if (filters?.position) {
    results = results.filter((p) => p.position === filters.position)
  }

  if (filters?.club) {
    const club = filters.club.toLowerCase()
    results = results.filter((p) => (p.current_club ?? "").toLowerCase().includes(club))
  }

  if (filters?.level) {
    results = results.filter((p) => p.level === filters.level)
  }

  if (filters?.state) {
    results = results.filter((p) => p.state === filters.state)
  }

  if (filters?.status) {
    results = results.filter((p) => p.status === filters.status)
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    results = results.filter(
      (p) =>
        (p.first_name ?? "").toLowerCase().includes(s) ||
        (p.last_name ?? "").toLowerCase().includes(s)
    )
  }

  return results
}

export async function getPlayer(id: string): Promise<PlayerDetail | null> {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("players")
    .select(`
      *,
      player_contacts(*, contacts(*)),
      event_participants(*, events(*)),
      assessments(*),
      activities(*),
      tasks(*)
    `)
    .eq("id", id)
    .order("created_at", { referencedTable: "assessments", ascending: false })
    .order("created_at", { referencedTable: "activities", ascending: false })
    .single()

  return data as PlayerDetail | null
}

export async function createPlayer(
  input: TablesInsert<"players">
): Promise<{ data: Tables<"players"> | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("players")
    .insert(input)
    .select()
    .single()

  updateTag("players")
  return { data, error: error?.message ?? null }
}

export async function updatePlayer(
  id: string,
  updates: TablesUpdate<"players">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("players")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("players")
  return { error: error?.message ?? null }
}

export async function archivePlayer(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("players")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("players")
  return { error: error?.message ?? null }
}

export async function linkPlayerContact(
  player_id: string,
  contact_id: string,
  relationship: string,
  is_primary: boolean,
  is_emergency: boolean
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase.from("player_contacts").upsert(
    { player_id, contact_id, relationship, is_primary, is_emergency },
    { onConflict: "player_id,contact_id" }
  )

  updateTag("players")
  return { error: error?.message ?? null }
}

export async function unlinkPlayerContact(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase.from("player_contacts").delete().eq("id", id)

  updateTag("players")
  return { error: error?.message ?? null }
}
