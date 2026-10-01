"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/auth/role"
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
      .select("*, contacts(*), players(*), profiles!leads_owner_id_fkey(full_name)")
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
}): Promise<LeadWithRelations[]> {
  await requireAdmin()

  let results: LeadWithRelations[]

  if (filters?.archived === true) {
    // Archived view needs rows where archived_at IS NOT NULL — skip cache
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

  if (filters?.search) {
    const s = filters.search.toLowerCase()
    results = results.filter((l) => {
      const contactName = `${l.contacts?.first_name ?? ""} ${l.contacts?.last_name ?? ""}`.toLowerCase()
      const playerName = `${l.players?.first_name ?? ""} ${l.players?.last_name ?? ""}`.toLowerCase()
      return (
        contactName.includes(s) ||
        playerName.includes(s) ||
        (l.contacts?.email ?? "").toLowerCase().includes(s) ||
        (l.contacts?.phone ?? "").toLowerCase().includes(s)
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
