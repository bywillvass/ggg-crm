'use client'

import { Menu, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter()
  const { user } = useAuth()

  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'U'

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-14 border-b bg-white flex items-center px-4 gap-3 shrink-0">
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 max-w-md">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-400">
          <Search className="w-4 h-4 shrink-0" />
          <span>Search...</span>
        </div>
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus:ring-2 focus:ring-[#C9A227]">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-[#0C0F4C] text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings/account')}>
              My account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-red-600">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
