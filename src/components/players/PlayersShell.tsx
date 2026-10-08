"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Search, Plus, Archive, ExternalLink, Phone, MessageSquare, StickyNote, CheckSquare,
  MessageCircle, User, CalendarPlus,
} from "lucide-react"
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
import { createPlayerWithParent, archivePlayer, bulkArchivePlayers } from "@/app/(app)/players/actions"
import { listEvents, addParticipant, type EventSummary } from "@/app/(app)/events/actions"
import { searchContacts } from "@/app/(app)/contacts/actions"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import { RowMenu } from "@/components/shared/RowMenu"
import { PlayerDrawer } from "./PlayerDrawer"
import { cn } from "cn"
import { format } from "date-fns"
import type { Tables, TablesInsert, Database } from "@/lib/database.types"

type ParticipantStatus = Database["public"]["Enums"]["participant_status"]

type ContactResult = Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "email" | "phone">

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState<Partial<TablesInsert<"players">>>({ status: "prospect" })
  const [parentMode, setParentMode] = useState<"new" | "existing">("new")
  const [parentForm, setParentForm] = useState({ first_name: "", last_name: "", phone: "", email: "" })
  const [parentSearch, setParentSearch] = useState("")
  const [parentResults, setParentResults] = useState<ContactResult[]>([])
  const [parentSearching, setParentSearching] = useState(false)
  const [selectedParent, setSelectedParent] = useState<ContactResult | null>(null)
  const [addToEventPlayer, setAddToEventPlayer] = useState<{ id: string; name: string } | null>(null)
  const [addToEventEvents, setAddToEventEvents] = useState<EventSummary[]>([])
  const [addToEventSearch, setAddToEventSearch] = useState("")
  const [addToEventEventId, setAddToEventEventId] = useState("")
  const [addToEventStatus, setAddToEventStatus] = useState<ParticipantStatus>("invited")
  const [addToEventAdding, setAddToEventAdding] = useState(false)
  const [activityPlayer, setActivityPlayer] = useState<{ id: string } | null>(null)
  const [drawerPlayer, setDrawerPlayer] = useState<PlayerRow | null>(null)

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

  async function handleParentSearch() {
    if (!parentSearch.trim()) return
    setParentSearching(true)
    const results = await searchContacts(parentSearch)
    setParentResults(results)
    setParentSearching(false)
  }

  function resetDialog() {
    setNewForm({ status: "prospect" })
    setParentMode("new")
    setParentForm({ first_name: "", last_name: "", phone: "", email: "" })
    setParentSearch("")
    setParentResults([])
    setSelectedParent(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (parentMode === "new" && !parentForm.first_name) {
      return toast.error("Parent first name is required")
    }
    if (parentMode === "existing" && !selectedParent) {
      return toast.error("Please select a parent contact")
    }
    setSaving(true)
    const result = await createPlayerWithParent(
      newForm as TablesInsert<"players">,
      parentMode === "existing"
        ? { mode: "existing", contact_id: selectedParent!.id }
        : { mode: "new", first_name: parentForm.first_name, last_name: parentForm.last_name || null, phone: parentForm.phone || null, email: parentForm.email || null }
    )
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player created")
      setNewDialogOpen(false)
      resetDialog()
      router.push(`/players/${result.data?.id}`)
    }
  }

  async function handleBulkArchive() {
    if (!confirm(`Archive ${selected.size} player(s)?`)) return
    const result = await bulkArchivePlayers(Array.from(selected))
    if (result.error) toast.error(result.error)
    else { toast.success(`Archived ${selected.size} players`); setSelected(new Set()); router.refresh() }
  }

  async function handleRowArchive(player: PlayerRow) {
    if (!confirm(`Archive ${player.first_name ?? "this player"}?`)) return
    const result = await archivePlayer(player.id)
    if (result.error) toast.error(result.error)
    else { toast.success("Player archived"); router.refresh() }
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

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-blue-50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={handleBulkArchive} className="text-red-600 hover:text-red-700">
            <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
          </Button>
        </div>
      )}

      {selected.size > 0 && selected.size === paginated.length && selected.size < filtered.length && (
        <div className="text-center text-sm text-gray-600 bg-blue-50 rounded-lg py-2 px-4">
          All {paginated.length} on this page selected.{" "}
          <button
            className="text-[#0C0F4C] font-medium hover:underline"
            onClick={() => setSelected(new Set(filtered.map((p) => p.id)))}
          >
            Select all {filtered.length} players matching this filter
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={paginated.length > 0 && paginated.every((p) => selected.has(p.id))}
                  onChange={() => {
                    const pageIds = paginated.map((p) => p.id)
                    const allPageSelected = pageIds.every((id) => selected.has(id))
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
                      else pageIds.forEach((id) => next.add(id))
                      return next
                    })
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 font-medium text-gray-600 w-10"></th>
              <th className="px-3 py-3 font-medium text-gray-600">Name</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Birth year</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Position</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Club</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">State</th>
              <th className="px-3 py-3 font-medium text-gray-600">Status</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No players found
                </td>
              </tr>
            ) : (
              paginated.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDrawerPlayer(player)}>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(player.id)}
                      onChange={() => setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(player.id)) next.delete(player.id)
                        else next.add(player.id)
                        return next
                      })}
                      className="rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
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
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <RowMenu items={[
                      { label: "Open", icon: <ExternalLink className="h-4 w-4" />, onClick: () => router.push(`/players/${player.id}`) },
                      { label: "Add to event", icon: <CalendarPlus className="h-4 w-4" />, onClick: () => {
        setAddToEventPlayer({ id: player.id, name: `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() })
        setAddToEventSearch(""); setAddToEventEventId(""); setAddToEventStatus("invited")
        listEvents({ timeframe: "upcoming" }).then(setAddToEventEvents)
      }},
                      { label: "Log call", icon: <Phone className="h-4 w-4" />, onClick: () => setActivityPlayer({ id: player.id }) },
                      { label: "Log SMS", icon: <MessageSquare className="h-4 w-4" />, onClick: () => setActivityPlayer({ id: player.id }) },
                      { label: "Add note", icon: <StickyNote className="h-4 w-4" />, onClick: () => setActivityPlayer({ id: player.id }) },
                      { label: "Archive", icon: <Archive className="h-4 w-4" />, onClick: () => handleRowArchive(player), variant: "danger" },
                    ]} />
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

      <Dialog open={newDialogOpen} onOpenChange={(o) => { if (!o) { setNewDialogOpen(false); resetDialog() } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

            <div className="pt-1 border-t">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Parent / guardian <span className="text-red-500">*</span></p>
                <div className="flex rounded-md border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => { setParentMode("new"); setSelectedParent(null) }}
                    className={`px-3 py-1 ${parentMode === "new" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() => setParentMode("existing")}
                    className={`px-3 py-1 ${parentMode === "existing" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    Existing
                  </button>
                </div>
              </div>

              {parentMode === "new" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First name <span className="text-red-500">*</span></Label>
                      <Input value={parentForm.first_name} onChange={(e) => setParentForm((f) => ({ ...f, first_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last name</Label>
                      <Input value={parentForm.last_name} onChange={(e) => setParentForm((f) => ({ ...f, last_name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input value={parentForm.phone} onChange={(e) => setParentForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+61 4xx xxx xxx" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={parentForm.email} onChange={(e) => setParentForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {parentMode === "existing" && (
                <div className="space-y-2">
                  {selectedParent ? (
                    <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{selectedParent.first_name} {selectedParent.last_name}</p>
                        <p className="text-xs text-gray-500">{selectedParent.email ?? selectedParent.phone ?? ""}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedParent(null)} className="text-xs text-gray-400 hover:text-red-500">Change</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search by name or email..."
                          value={parentSearch}
                          onChange={(e) => setParentSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleParentSearch())}
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleParentSearch} disabled={parentSearching}>
                          {parentSearching ? "..." : "Search"}
                        </Button>
                      </div>
                      {parentResults.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                          {parentResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedParent(c); setParentResults([]) }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            >
                              <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                              <p className="text-xs text-gray-500">{c.email ?? c.phone ?? ""}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewDialogOpen(false); resetDialog() }}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                {saving ? "Creating..." : "Create player"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addToEventPlayer !== null} onOpenChange={(o) => { if (!o) setAddToEventPlayer(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add to event</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 -mt-2 mb-1 truncate">{addToEventPlayer?.name}</p>
          <div className="space-y-3">
            <input
              value={addToEventSearch}
              onChange={(e) => setAddToEventSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
            />
            <div className="max-h-52 overflow-y-auto rounded-md border divide-y text-sm">
              {addToEventEvents.length === 0 ? (
                <div className="px-3 py-6 text-center text-gray-400">No upcoming events</div>
              ) : (
                addToEventEvents
                  .filter((e) => e.title.toLowerCase().includes(addToEventSearch.toLowerCase()))
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setAddToEventEventId(e.id)}
                      className={cn("w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors", addToEventEventId === e.id && "bg-[#0C0F4C]/5 border-l-2 border-[#C9A227]")}
                    >
                      <p className="font-medium text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-400">{format(new Date(e.start_at), "d MMM yyyy")}</p>
                    </button>
                  ))
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Add as</label>
              <select value={addToEventStatus} onChange={(e) => setAddToEventStatus(e.target.value as ParticipantStatus)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="invited">Invited</option>
                <option value="confirmed">Confirmed</option>
                <option value="waitlisted">Waitlisted</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToEventPlayer(null)}>Cancel</Button>
            <Button
              disabled={!addToEventEventId || addToEventAdding}
              onClick={async () => {
                if (!addToEventPlayer || !addToEventEventId) return
                setAddToEventAdding(true)
                const { error } = await addParticipant(addToEventEventId, addToEventPlayer.id, null, addToEventStatus)
                setAddToEventAdding(false)
                if (error) toast.error(error)
                else {
                  const eventTitle = addToEventEvents.find((e) => e.id === addToEventEventId)?.title ?? "event"
                  toast.success(`Added to ${eventTitle}`)
                  setAddToEventPlayer(null)
                  router.refresh()
                }
              }}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {addToEventAdding ? "Adding…" : "Add to event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddActivityDialog
        open={activityPlayer !== null}
        onClose={() => setActivityPlayer(null)}
        onSave={() => { setActivityPlayer(null); router.refresh() }}
        playerId={activityPlayer?.id}
      />

      <PlayerDrawer
        player={drawerPlayer}
        onClose={() => setDrawerPlayer(null)}
        onUpdate={() => router.refresh()}
      />
    </div>
  )
}
