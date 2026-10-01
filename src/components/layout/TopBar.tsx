'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

type SearchResult = {
  contacts: { id: string; first_name: string | null; last_name: string | null; email: string | null }[]
  players: { id: string; first_name: string | null; last_name: string | null; birth_year: number | null; position: string | null }[]
  leads: { id: string; source: string; stage: string; contacts: { first_name: string | null; last_name: string | null } | null }[]
  events: { id: string; title: string; start_at: string }[]
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'U'

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null)
      setOpen(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json() as SearchResult
        setResults(data)
        setOpen(true)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(q), 250)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(href: string) {
    setOpen(false)
    setQuery('')
    setResults(null)
    router.push(href)
  }

  const hasResults = results && (
    results.contacts.length > 0 ||
    results.players.length > 0 ||
    results.leads.length > 0 ||
    results.events.length > 0
  )

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

      <div className="flex-1 max-w-md relative" ref={containerRef}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#C9A227] transition-all">
          <Search className="w-4 h-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onFocus={() => { if (results && query.length >= 2) setOpen(true) }}
            placeholder="Search..."
            className="flex-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
          />
          {loading && (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-[#C9A227] animate-spin shrink-0" />
          )}
        </div>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border shadow-lg z-50 overflow-hidden max-h-96 overflow-y-auto">
            {!hasResults ? (
              <p className="px-4 py-3 text-sm text-gray-400">No results for &quot;{query}&quot;</p>
            ) : (
              <>
                {results.contacts.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">Contacts</p>
                    {results.contacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(`/contacts/${c.id}`)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="h-6 w-6 rounded-full bg-[#0C0F4C] text-white text-xs flex items-center justify-center shrink-0">
                          {((c.first_name ?? '?')[0] + (c.last_name ?? '?')[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                          {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {results.players.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">Players</p>
                    {results.players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelect(`/players/${p.id}`)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="h-6 w-6 rounded-full bg-[#0C0F4C] text-white text-xs flex items-center justify-center shrink-0">
                          {((p.first_name ?? '?')[0] + (p.last_name ?? '?')[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-gray-400">
                            {p.birth_year && `${p.birth_year} - `}{p.position ?? 'No position'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {results.leads.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">Leads</p>
                    {results.leads.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => handleSelect(`/leads/${l.id}`)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        <p className="text-sm font-medium">
                          {l.contacts?.first_name} {l.contacts?.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{l.source.replace('_', ' ')} - {l.stage}</p>
                      </button>
                    ))}
                  </div>
                )}

                {results.events.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">Events</p>
                    {results.events.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => handleSelect(`/events/${e.id}`)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        <p className="text-sm font-medium">{e.title}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
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
