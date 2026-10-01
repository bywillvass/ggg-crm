"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin, getAuthUser } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types"

export type TaskWithRelations = Tables<"tasks"> & {
  contacts: Pick<Tables<"contacts">, "id" | "first_name" | "last_name"> | null
  players: Pick<Tables<"players">, "id" | "first_name" | "last_name"> | null
  leads: Pick<Tables<"leads">, "id" | "source" | "stage"> | null
  assigned_profile: Pick<Tables<"profiles">, "id" | "full_name"> | null
}

const _cachedTasks = unstable_cache(
  async (): Promise<TaskWithRelations[]> => {
    const { data } = await serviceClient
      .from("tasks")
      .select(`
        *,
        contacts(id, first_name, last_name),
        players(id, first_name, last_name),
        leads(id, source, stage),
        assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name)
      `)
      .order("due_at", { ascending: true, nullsFirst: false })
    return (data ?? []) as TaskWithRelations[]
  },
  ["tasks"],
  { revalidate: 60, tags: ["tasks"] }
)

export async function listTasks(filters?: {
  done?: boolean
  assigned_to?: string
  my_tasks?: boolean
  due_today?: boolean
  overdue?: boolean
}): Promise<TaskWithRelations[]> {
  await requireAdmin()

  let results = await _cachedTasks()

  if (filters?.my_tasks) {
    const user = await getAuthUser()
    if (user) {
      results = results.filter((t) => t.assigned_to === user.id)
    }
  } else if (filters?.assigned_to) {
    results = results.filter((t) => t.assigned_to === filters.assigned_to)
  }

  if (filters?.done === false) {
    results = results.filter((t) => t.done_at == null)
  } else if (filters?.done === true) {
    results = results.filter((t) => t.done_at != null)
  }

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  if (filters?.due_today) {
    results = results.filter(
      (t) =>
        t.due_at != null &&
        t.due_at >= todayStart.toISOString() &&
        t.due_at <= today.toISOString()
    )
  }

  if (filters?.overdue) {
    results = results.filter(
      (t) =>
        t.due_at != null &&
        t.due_at < todayStart.toISOString() &&
        t.done_at == null
    )
  }

  return results
}

export async function createTask(
  input: TablesInsert<"tasks">
): Promise<{ data: Tables<"tasks"> | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const user = await getAuthUser()

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...input, created_by: user?.id ?? null })
    .select()
    .single()

  updateTag("tasks")
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

  updateTag("tasks")
  return { error: error?.message ?? null }
}

export async function completeTask(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("tasks")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id)

  updateTag("tasks")
  return { error: error?.message ?? null }
}

export async function deleteTask(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase.from("tasks").delete().eq("id", id)

  updateTag("tasks")
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
