'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  UserRound,
  ClipboardList,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'

const adminMobileNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/players', label: 'Players', icon: UserRound },
]

const coachMobileNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/players', label: 'Players', icon: UserRound },
  { href: '/assessments', label: 'Assessments', icon: ClipboardList },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { role } = useAuth()
  const nav = role === 'coach' ? coachMobileNav : adminMobileNav

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-30 flex">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 py-2 gap-1 text-xs font-medium transition-colors',
              active ? 'text-[#C9A227]' : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
