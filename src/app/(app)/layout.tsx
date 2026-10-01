import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRole } from '@/lib/auth/role'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = await getCurrentRole()

  return (
    <AuthProvider user={user} role={role}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}
