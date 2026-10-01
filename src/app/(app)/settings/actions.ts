"use server"

import { requireAdmin } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types"

// ---- Settings ----

export async function getSettings(): Promise<Tables<"settings"> | null> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single()
  return data
}

export async function updateSettings(
  updates: TablesUpdate<"settings">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("settings")
    .update(updates)
    .eq("id", 1)
  return { error: error?.message ?? null }
}

// ---- Document Types ----

export async function getDocumentTypes(): Promise<Tables<"document_types">[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("document_types")
    .select("*")
    .order("name")
  return data ?? []
}

export async function createDocumentType(
  input: TablesInsert<"document_types">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("document_types").insert(input)
  return { error: error?.message ?? null }
}

export async function updateDocumentType(
  id: string,
  updates: TablesUpdate<"document_types">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("document_types")
    .update(updates)
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ---- Field Mappings ----

export async function getFieldMappings(): Promise<
  Tables<"ingest_field_mappings">[]
> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("ingest_field_mappings")
    .select("*")
    .order("source_key")
  return data ?? []
}

export async function createFieldMapping(
  input: TablesInsert<"ingest_field_mappings">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("ingest_field_mappings").insert(input)
  return { error: error?.message ?? null }
}

export async function updateFieldMapping(
  id: string,
  updates: TablesUpdate<"ingest_field_mappings">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("ingest_field_mappings")
    .update(updates)
    .eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteFieldMapping(
  id: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("ingest_field_mappings")
    .delete()
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ---- Email Templates ----

export async function getEmailTemplates(): Promise<Tables<"email_templates">[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .order("name")
  return data ?? []
}

export async function createEmailTemplate(
  input: TablesInsert<"email_templates">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("email_templates").insert(input)
  return { error: error?.message ?? null }
}

export async function updateEmailTemplate(
  id: string,
  updates: TablesUpdate<"email_templates">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("email_templates")
    .update(updates)
    .eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteEmailTemplate(
  id: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ---- Integrations ----

export type IngestSourceStatus = {
  source: string
  last_received: string | null
  recent_errors: { id: string; received_at: string; error: string | null }[]
}

export async function getIntegrationsStatus(): Promise<{
  sources: IngestSourceStatus[]
  lastBlogSync: string | null
}> {
  await requireAdmin()
  const supabase = await createClient()

  // Last received per source
  const { data: sourcesData } = await supabase
    .from("ingest_log")
    .select("source, received_at")
    .order("received_at", { ascending: false })

  const sourceMap: Record<string, string> = {}
  for (const row of sourcesData ?? []) {
    if (row.source && !sourceMap[row.source]) {
      sourceMap[row.source] = row.received_at
    }
  }

  // Recent errors (last 10 failed)
  const { data: errorsData } = await supabase
    .from("ingest_log")
    .select("id, received_at, error, source")
    .eq("status", "error")
    .order("received_at", { ascending: false })
    .limit(10)

  // Group errors by source
  const errorsBySource: Record<
    string,
    { id: string; received_at: string; error: string | null }[]
  > = {}
  for (const row of errorsData ?? []) {
    if (row.source) {
      errorsBySource[row.source] = errorsBySource[row.source] ?? []
      errorsBySource[row.source].push({
        id: row.id,
        received_at: row.received_at,
        error: row.error,
      })
    }
  }

  const sources: IngestSourceStatus[] = Object.entries(sourceMap).map(
    ([source, last_received]) => ({
      source,
      last_received,
      recent_errors: errorsBySource[source] ?? [],
    })
  )

  // Last blog sync
  const { data: blogData } = await supabase
    .from("posts")
    .select("last_synced_at")
    .not("last_synced_at", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastBlogSync = blogData?.last_synced_at ?? null

  return { sources, lastBlogSync }
}
