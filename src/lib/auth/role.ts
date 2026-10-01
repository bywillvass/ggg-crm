import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export type AppRole = 'admin' | 'coach'

// Reads auth from cookie — zero network calls (middleware already verified the token)
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
})

// Role is cached across requests for 5 minutes per user
function getCachedRole(userId: string) {
  return unstable_cache(
    async () => {
      const { data } = await serviceClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      return (data?.role as AppRole) ?? null
    },
    [`user-role-${userId}`],
    { revalidate: 300 }
  )()
}

export const getCurrentRole = cache(async (): Promise<AppRole | null> => {
  const user = await getAuthUser()
  if (!user) return null
  return getCachedRole(user.id)
})

export async function requireAuth() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const role = await getCurrentRole()
  if (role !== 'admin') redirect('/dashboard')
}
