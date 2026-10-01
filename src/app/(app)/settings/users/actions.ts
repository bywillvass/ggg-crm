"use server"

import { requireAdmin } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import type { Tables } from "@/lib/database.types"

export async function getProfiles(): Promise<Tables<"profiles">[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
  return data ?? []
}

export async function inviteUser(
  email: string,
  fullName: string,
  role: "admin" | "coach"
): Promise<{ error: string | null }> {
  await requireAdmin()
  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
  })
  return { error: error?.message ?? null }
}

export async function updateUserRole(
  id: string,
  role: "admin" | "coach"
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id)
  return { error: error?.message ?? null }
}

export async function toggleUserActive(
  id: string,
  active: boolean
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
  return { error: error?.message ?? null }
}
