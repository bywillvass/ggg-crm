"use server"

import { requireAdmin, getAuthUser } from "@/lib/auth/role"
import { logActivity } from "@/lib/activity"
import type { Database } from "@/lib/database.types"

type ActivityType = Database["public"]["Enums"]["activity_type"]

export async function logManualActivity(input: {
  type: ActivityType
  body?: string
  lead_id?: string
  contact_id?: string
  player_id?: string
  event_id?: string
}): Promise<{ error: string | null }> {
  await requireAdmin()
  const user = await getAuthUser()

  await logActivity({
    type: input.type,
    body: input.body ?? null,
    lead_id: input.lead_id ?? null,
    contact_id: input.contact_id ?? null,
    player_id: input.player_id ?? null,
    event_id: input.event_id ?? null,
    created_by: user?.id ?? null,
  })

  return { error: null }
}
