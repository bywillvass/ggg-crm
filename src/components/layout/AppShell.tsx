'use client'

import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileBottomNav } from './MobileBottomNav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  )
}
