import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'admin' | 'coach'

export async function getCurrentRole(): Promise<AppRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as AppRole) ?? null
}

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const role = await getCurrentRole()
  if (role !== 'admin') redirect('/dashboard')
}
