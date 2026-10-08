'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Contact2,
  UserRound,
  Calendar,
  Mail,
  Receipt,
  FileText,
  CheckSquare,
  Settings,
  ClipboardList,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = { label: string; items: NavItem[] }
type NavSection = NavItem | NavGroup

function isGroup(section: NavSection): section is NavGroup {
  return 'items' in section
}

const adminNavSections: NavSection[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'PEOPLE',
    items: [
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/players', label: 'Players', icon: UserRound },
      { href: '/contacts', label: 'Parents', icon: Contact2 },
    ],
  },
  {
    label: 'EVENTS',
    items: [
      { href: '/events', label: 'Events', icon: Calendar },
    ],
  },
  {
    label: 'COMMS',
    items: [
      { href: '/email', label: 'Email', icon: Mail },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/blog', label: 'Blog', icon: FileText },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const coachNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/players', label: 'Players', icon: UserRound },
  { href: '/assessments', label: 'Assessments', icon: ClipboardList },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useAuth()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function renderItem(item: NavItem) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
          active
            ? 'bg-[#C9A227] text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {item.label}
      </Link>
    )
  }

  if (role === 'coach') {
    return (
      <div className="flex flex-col h-full bg-[#0C0F4C] w-64">
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/dashboard">
            <img
              src="/GGG-logo-crm.png"
              alt="Ginga Global Group"
              className="h-16 w-auto object-contain"
            />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {coachNav.map(renderItem)}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0C0F4C] w-64">
      <div className="px-5 py-5 border-b border-white/10">
        <Link href="/dashboard">
          <img
            src="/GGG-logo-crm.png"
            alt="Ginga Global Group"
            className="h-16 w-auto object-contain"
          />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {adminNavSections.map((section, i) => {
          if (!isGroup(section)) {
            return renderItem(section)
          }
          return (
            <div key={section.label}>
              {i > 0 && (
                <p className="text-white/40 text-xs uppercase tracking-wide px-3 pb-1 pt-3 font-medium">
                  {section.label}
                </p>
              )}
              {section.items.map(renderItem)}
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )
}
