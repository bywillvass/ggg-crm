'use client'

import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AppRole } from '@/lib/auth/role'

interface AuthContextValue {
  user: User
  role: AppRole | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  user,
  role,
  children,
}: {
  user: User
  role: AppRole | null
  children: React.ReactNode
}) {
  return (
    <AuthContext.Provider value={{ user, role }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
