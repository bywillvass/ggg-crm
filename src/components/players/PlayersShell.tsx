"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { createPlayer } from "@/app/(app)/players/actions"
import type { Tables, TablesInsert } from "@/lib/database.types"

const PAGE_SIZE = 25

type PlayerRow = Tables<"players">

function statusVariant(status: string): "success" | "secondary" | "default" {
  if (status === "active") return "success"
  if (status === "prospect") return "secondary"
  return "default"
}

export function PlayersShell({ players: initialPlayers }: { players: PlayerRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterPosition, setFilterPosition] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterState, setFilterState] = useState("")
  const [page, setPage] = useState(1)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState<Partial<TablesInsert<"players">>>({ status: "prospect" })

  const filtered = useMemo(() => {
    let result = initialPlayers

    if (search) {
      const s = search.toLowerCase()
      result = result.filter((p) =>
        `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(s)
      )
    }

    if (filterYear) {
      result = result.filter((p) => p.birth_year === parseInt(filterYear))
    }

    if (filterPosition) {
      result = result.filter((p) => p.position === filterPosition)
    }

    if (filterStatus) {
      result = result.filter((p) => p.status === filterStatus)
    }

    if (filterState) {
      result = result.filter((p) => p.state === filterState)
    }

    return result
  }, [initialPlayers, search, filterYear, filterPosition, filterStatus, filterState])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const positions = [...new Set(initialPlayers.map((p) => p.position).filter(Boolean))].sort() as string[]
  const states = [...new Set(initialPlayers.map((p) => p.state).filter(Boolean))].sort() as string[]
  const years = [...new Set(initialPlayers.map((p) => p.birth_year).filter(Boolean))].sort((a, b) => (b as number) - (a as number)) as number[]

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await createPlayer(newForm as TablesInsert<"players">)
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player created")
      setNewDialogOpen(false)
      setNewForm({ status: "prospect" })
      router.push(`/players/${result.data?.id}`)
    }
  }

  function getInitials(player: PlayerRow) {
    return `${(player.first_name ?? "?")[0]}${(player.last_name ?? "?")[0]}`.toUpperCase()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0C0F4C]">Players</h1>
          <p className="text-sm text-gray-500">{filtered.length} players</p>
        </div>
        <Button
          onClick={() => setNewDialogOpen(true)}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New player
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search players..."
            className="pl-9"
          />
        </div>

        <select
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>

        <select
          value={filterPosition}
          onChange={(e) => { setFilterPosition(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All positions</option>
          {positions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All statuses</option>
          <option value="prospect">Prospect</option>
          <option value="active">Active</option>
          <option value="alumni">Alumni</option>
        </select>

        <select
          value={filterState}
          onChange={(e) => { setFilterState(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-3 font-medium text-gray-600 w-10"></th>
              <th className="px-3 py-3 font-medium text-gray-600">Name</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Birth year</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Position</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Club</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">State</th>
              <th className="px-3 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No players found
                </td>
              </tr>
            ) : (
              paginated.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="h-8 w-8 rounded-full bg-[#0C0F4C] text-white flex items-center justify-center text-xs font-bold">
                      {getInitials(player)}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/players/${player.id}`}
                      className="font-medium text-[#0C0F4C] hover:underline"
                    >
                      {player.first_name} {player.last_name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-gray-600 hidden md:table-cell">{player.birth_year ?? "-"}</td>
                  <td className="px-3 py-3 text-gray-600 hidden md:table-cell">{player.position ?? "-"}</td>
                  <td className="px-3 py-3 text-gray-600 hidden lg:table-cell">{player.current_club ?? "-"}</td>
                  <td className="px-3 py-3 text-gray-600 hidden lg:table-cell">{player.state ?? "-"}</td>
                  <td className="px-3 py-3">
                    <Badge variant={statusVariant(player.status)}>{player.status}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {page} of {pageCount}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={newDialogOpen} onOpenChange={(o) => { if (!o) setNewDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New player</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input value={newForm.first_name ?? ""} onChange={(e) => setNewForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={newForm.last_name ?? ""} onChange={(e) => setNewForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Birth year</Label>
                <Input
                  type="number"
                  value={newForm.birth_year ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, birth_year: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="e.g. 2012"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <Input value={newForm.position ?? ""} onChange={(e) => setNewForm((f) => ({ ...f, position: e.target.value }))} placeholder="e.g. GK, CB, ST" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Club</Label>
                <Input value={newForm.current_club ?? ""} onChange={(e) => setNewForm((f) => ({ ...f, current_club: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={newForm.state ?? ""} onChange={(e) => setNewForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={newForm.status ?? "prospect"}
                onChange={(e) => setNewForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
              >
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="alumni">Alumni</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                {saving ? "Creating..." : "Create player"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
