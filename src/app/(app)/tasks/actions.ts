"use server"

import { requireAdmin } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types"

export type TaskWithRelations = Tables<"tasks"> & {
  contacts: Pick<Tables<"contacts">, "id" | "first_name" | "last_name"> | null
  players: Pick<Tables<"players">, "id" | "first_name" | "last_name"> | null
  leads: Pick<Tables<"leads">, "id" | "source" | "stage"> | null
  assigned_profile: Pick<Tables<"profiles">, "id" | "full_name"> | null
}

export async function listTasks(filters?: {
  done?: boolean
  assigned_to?: string
  my_tasks?: boolean
  due_today?: boolean
  overdue?: boolean
}): Promise<TaskWithRelations[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from("tasks")
    .select(`
      *,
      contacts(id, first_name, last_name),
      players(id, first_name, last_name),
      leads(id, source, stage),
      assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name)
    `)
    .order("due_at", { ascending: true, nullsFirst: false })

  if (filters?.my_tasks && user) {
    query = query.eq("assigned_to", user.id)
  } else if (filters?.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to)
  }

  if (filters?.done === false) {
    query = query.is("done_at", null)
  } else if (filters?.done === true) {
    query = query.not("done_at", "is", null)
  }

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  if (filters?.due_today) {
    query = query
      .gte("due_at", todayStart.toISOString())
      .lte("due_at", today.toISOString())
  }

  if (filters?.overdue) {
    query = query
      .lt("due_at", todayStart.toISOString())
      .is("done_at", null)
  }

  const { data } = await query
  return (data ?? []) as TaskWithRelations[]
}

export async function createTask(
  input: TablesInsert<"tasks">
): Promise<{ data: Tables<"tasks"> | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...input, created_by: user?.id ?? null })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export async function updateTask(
  id: string,
  updates: TablesUpdate<"tasks">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function completeTask(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("tasks")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function deleteTask(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase.from("tasks").delete().eq("id", id)

  return { error: error?.message ?? null }
}

export async function getProfiles(): Promise<Tables<"profiles">[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .order("full_name")
  return data ?? []
}
