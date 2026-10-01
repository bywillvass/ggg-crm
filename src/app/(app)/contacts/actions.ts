"use server"

import { requireAdmin } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import type { Tables, TablesInsert, TablesUpdate, Database } from "@/lib/database.types"

type ConsentType = Database["public"]["Enums"]["consent_type"]
type LeadSource = Database["public"]["Enums"]["lead_source"]

export type ContactWithPlayers = Tables<"contacts"> & {
  player_contacts: { player_id: string }[]
}

export async function listContacts(filters?: {
  tags?: string[]
  consent?: string
  unsubscribed?: boolean
  hasPlayers?: boolean
  source?: string
  search?: string
  archived?: boolean
}): Promise<ContactWithPlayers[]> {
  await requireAdmin()
  const supabase = await createClient()

  let query = supabase
    .from("contacts")
    .select("*, player_contacts(player_id)")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (!filters?.archived) {
    query = query.is("archived_at", null)
  }

  if (filters?.search) {
    const s = filters.search
    query = query.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`
    )
  }

  if (filters?.consent) {
    query = query.eq("marketing_consent", filters.consent as ConsentType)
  }

  if (filters?.unsubscribed) {
    query = query.not("unsubscribed_at", "is", null)
  }

  if (filters?.source) {
    query = query.eq("source", filters.source as LeadSource)
  }

  if (filters?.tags?.length) {
    query = query.overlaps("tags", filters.tags)
  }

  const { data } = await query
  let results = (data ?? []) as ContactWithPlayers[]

  if (filters?.hasPlayers) {
    results = results.filter((c) => c.player_contacts.length > 0)
  }

  return results
}

export type ContactDetail = Tables<"contacts"> & {
  player_contacts: (Tables<"player_contacts"> & { players: Tables<"players"> | null })[]
  leads: Tables<"leads">[]
  activities: Tables<"activities">[]
  tasks: Tables<"tasks">[]
  email_messages: (Pick<Tables<"email_messages">, "id" | "subject" | "status" | "sent_at"> & {
    email_campaigns: Pick<Tables<"email_campaigns">, "name"> | null
  })[]
}

export async function getContact(id: string): Promise<ContactDetail | null> {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("contacts")
    .select(`
      *,
      player_contacts(*, players(*)),
      leads(*),
      activities(*),
      tasks(*),
      email_messages(id, subject, status, sent_at, email_campaigns(name))
    `)
    .eq("id", id)
    .order("created_at", { referencedTable: "activities", ascending: false })
    .single()

  return data as ContactDetail | null
}

export async function createContact(
  input: TablesInsert<"contacts">
): Promise<{ data: Tables<"contacts"> | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .insert(input)
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export async function updateContact(
  id: string,
  updates: TablesUpdate<"contacts">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("contacts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function archiveContact(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function mergeContacts(
  masterId: string,
  duplicateId: string
): Promise<{ error: string | null }> {
  await requireAdmin()

  const tables = [
    "player_contacts",
    "leads",
    "activities",
    "tasks",
    "email_messages",
  ] as const

  for (const table of tables) {
    await serviceClient
      .from(table)
      .update({ contact_id: masterId } as never)
      .eq("contact_id", duplicateId)
  }

  await serviceClient
    .from("contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", duplicateId)

  return { error: null }
}

export async function addTagToContact(
  id: string,
  tag: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from("contacts")
    .select("tags")
    .eq("id", id)
    .single()

  if (!contact) return { error: "Contact not found" }

  const tags = contact.tags ?? []
  if (tags.includes(tag)) return { error: null }

  const { error } = await supabase
    .from("contacts")
    .update({ tags: [...tags, tag] })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function removeTagFromContact(
  id: string,
  tag: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from("contacts")
    .select("tags")
    .eq("id", id)
    .single()

  if (!contact) return { error: "Contact not found" }

  const { error } = await supabase
    .from("contacts")
    .update({ tags: (contact.tags ?? []).filter((t) => t !== tag) })
    .eq("id", id)

  return { error: error?.message ?? null }
}
