import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/database.types'

export async function logActivity(
  input: Omit<TablesInsert<'activities'>, 'id' | 'created_at'>
) {
  const supabase = await createClient()
  await supabase.from('activities').insert(input)
}
