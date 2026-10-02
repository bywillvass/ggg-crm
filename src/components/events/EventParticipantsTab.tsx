"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import Papa from "papaparse"
import { format } from "date-fns"
import {
  Search, Plus, Download, UserPlus, Trash2, CheckSquare, Square, Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "cn"
import {
  addParticipant,
  addWalkIn,
  updateParticipantStatus,
  bulkUpdateParticipantStatus,
  removeParticipant,
  searchPlayersForEvent,
  searchLeadsForEvent,
  promoteWaitlist,
  type EventDetail,
  type ParticipantRow,
} from "@/app/(app)/events/actions"
import { CampaignComposer } from "@/components/email/CampaignComposer"
import type { EmailTemplateRow } from "@/app/(app)/email/actions"
import type { Database, Tables } from "@/lib/database.types"

type ParticipantStatus = Database["public"]["Enums"]["participant_status"]
type AppRole = "admin" | "coach"

const ALL_STATUSES: ParticipantStatus[] = [
  "to_be_invited", "invited", "confirmed", "declined", "waitlisted", "attended", "no_show", "cancelled",
]

function statusVariant(s: ParticipantStatus): "success" | "warning" | "destructive" | "secondary" | "default" {
  if (s === "confirmed" || s === "attended") return "success"
  if (s === "waitlisted") return "warning"
  if (s === "no_show" || s === "declined" || s === "cancelled") return "destructive"
  return "secondary"
}

function participantName(p: ParticipantRow): string {
  if (p.players) return `${p.players.first_name ?? ""} ${p.players.last_name ?? ""}`.trim()
  if (p.contacts) return `${p.contacts.first_name ?? ""} ${p.contacts.last_name ?? ""}`.trim()
  return "Unknown"
}

function primaryContact(p: ParticipantRow): Tables<"contacts"> | null {
  if (p.contacts) return p.contacts as Tables<"contacts">
  if (p.players?.player_contacts?.length) {
    return (p.players.player_contacts[0]?.contacts as Tables<"contacts">) ?? null
  }
  return null
}

export function EventParticipantsTab({
  event,
  onUpdate,
  role,
  emailTemplates = [],
  emailEvents = [],
}: {
  event: EventDetail
  onUpdate: (e: EventDetail) => void
  role: AppRole
  emailTemplates?: EmailTemplateRow[]
  emailEvents?: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
}) {
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<ParticipantStatus | "">("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<ParticipantStatus | "">("")

  // Add player dialog
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [playerSearch, setPlayerSearch] = useState("")
  const [playerResults, setPlayerResults] = useState<Tables<"players">[]>([])
  const [searchingPlayers, setSearchingPlayers] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null)
  const [addStatus, setAddStatus] = useState<ParticipantStatus>("invited")

  // Add from lead dialog
  const [showAddLead, setShowAddLead] = useState(false)
  const [leadSearch, setLeadSearch] = useState("")
  const [leadResults, setLeadResults] = useState<
    (Tables<"leads"> & { contacts: Tables<"contacts"> | null; players: Tables<"players"> | null })[]
  >([])
  const [searchingLeads, setSearchingLeads] = useState(false)

  // Walk-in dialog
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [wiPlayerFirst, setWiPlayerFirst] = useState("")
  const [wiPlayerLast, setWiPlayerLast] = useState("")
  const [wiPlayerBirthYear, setWiPlayerBirthYear] = useState("")
  const [wiPlayerPosition, setWiPlayerPosition] = useState("")
  const [wiContactFirst, setWiContactFirst] = useState("")
  const [wiContactLast, setWiContactLast] = useState("")
  const [wiContactPhone, setWiContactPhone] = useState("")
  const [wiContactEmail, setWiContactEmail] = useState("")
  const [savingWalkIn, setSavingWalkIn] = useState(false)

  // Remove confirm
  const [removeId, setRemoveId] = useState<string | null>(null)

  const participants = event.participants

  const filtered = useMemo(() => {
    let list = participants
    if (filterStatus) list = list.filter((p) => p.status === filterStatus)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((p) => {
        const name = participantName(p).toLowerCase()
        const contact = primaryContact(p)
        return (
          name.includes(s) ||
          (contact?.email ?? "").toLowerCase().includes(s) ||
          (contact?.phone ?? "").toLowerCase().includes(s)
        )
      })
    }
    return list
  }, [participants, filterStatus, search])

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((p) => p.id)))
    }
  }

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function handleBulkStatus() {
    if (!bulkStatus || selected.size === 0) return
    const { error } = await bulkUpdateParticipantStatus(
      Array.from(selected),
      bulkStatus,
      event.id
    )
    if (error) {
      toast.error(error)
    } else {
      toast.success(`${selected.size} participant(s) updated`)
      onUpdate({
        ...event,
        participants: event.participants.map((p) =>
          selected.has(p.id) ? { ...p, status: bulkStatus } : p
        ),
      })
      setSelected(new Set())
      setBulkStatus("")
    }
  }

  async function handleStatusChange(participantId: string, newStatus: ParticipantStatus) {
    const prev = event.participants.find((p) => p.id === participantId)?.status
    onUpdate({
      ...event,
      participants: event.participants.map((p) =>
        p.id === participantId ? { ...p, status: newStatus } : p
      ),
    })
    const { error } = await updateParticipantStatus(participantId, newStatus, event.id)
    if (error) {
      toast.error(error)
      onUpdate({
        ...event,
        participants: event.participants.map((p) =>
          p.id === participantId ? { ...p, status: prev! } : p
        ),
      })
    }
    // Promote waitlist if a slot opened
    if ((prev === "confirmed" || prev === "attended") && newStatus !== "confirmed" && newStatus !== "attended") {
      await promoteWaitlist(event.id)
    }
  }

  async function handleRemove() {
    if (!removeId) return
    const { error } = await removeParticipant(removeId)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Participant removed")
      onUpdate({
        ...event,
        participants: event.participants.filter((p) => p.id !== removeId),
      })
    }
    setRemoveId(null)
  }

  async function handlePlayerSearch() {
    setSearchingPlayers(true)
    const results = await searchPlayersForEvent(event.id, playerSearch)
    setPlayerResults(results)
    setSearchingPlayers(false)
  }

  async function handleAddPlayer(playerId: string) {
    setAddingPlayer(playerId)
    const { data, error } = await addParticipant(event.id, playerId, null, addStatus)
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success("Participant added")
      const player = playerResults.find((p) => p.id === playerId)
      onUpdate({
        ...event,
        participants: [
          ...event.participants,
          {
            ...data,
            players: player
              ? { ...player, player_contacts: [] }
              : null,
            contacts: null,
          } as ParticipantRow,
        ],
      })
      setShowAddPlayer(false)
      setPlayerSearch("")
      setPlayerResults([])
    }
    setAddingPlayer(null)
  }

  async function handleLeadSearch() {
    setSearchingLeads(true)
    const results = await searchLeadsForEvent(event.id, leadSearch)
    setLeadResults(results)
    setSearchingLeads(false)
  }

  async function handleAddFromLead(lead: typeof leadResults[number]) {
    const { data, error } = await addParticipant(
      event.id,
      lead.player_id,
      lead.contact_id,
      "invited",
      lead.id
    )
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success("Added from lead")
      onUpdate({
        ...event,
        participants: [
          ...event.participants,
          {
            ...data,
            players: lead.players
              ? { ...lead.players, player_contacts: [] }
              : null,
            contacts: lead.contacts,
          } as ParticipantRow,
        ],
      })
      setShowAddLead(false)
      setLeadSearch("")
      setLeadResults([])
    }
  }

  async function handleWalkIn() {
    if (!wiPlayerFirst || !wiContactFirst || !wiContactLast) {
      return toast.error("Player first name and contact name are required")
    }
    setSavingWalkIn(true)
    const { error } = await addWalkIn(
      event.id,
      {
        first_name: wiPlayerFirst,
        last_name: wiPlayerLast,
        birth_year: wiPlayerBirthYear ? parseInt(wiPlayerBirthYear) : undefined,
        position: wiPlayerPosition || undefined,
      },
      {
        first_name: wiContactFirst,
        last_name: wiContactLast,
        phone: wiContactPhone || undefined,
        email: wiContactEmail || undefined,
      }
    )
    if (error) {
      toast.error(error)
    } else {
      toast.success("Walk-in added")
      setShowWalkIn(false)
      // Refresh the page to get new participant
      window.location.reload()
    }
    setSavingWalkIn(false)
  }

  function exportCSV() {
    const rows = filtered.map((p) => {
      const contact = primaryContact(p)
      return {
        "Player name": participantName(p),
        "Birth year": p.players?.birth_year ?? "",
        "Position": p.players?.position ?? "",
        "Club": p.players?.current_club ?? "",
        "Status": p.status,
        "Contact name": contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "",
        "Contact email": contact?.email ?? "",
        "Contact phone": contact?.phone ?? "",
        "Checked in": p.checked_in_at ? format(new Date(p.checked_in_at), "d MMM yyyy HH:mm") : "",
      }
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-participants.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search participants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ParticipantStatus | "")}
          className="w-40"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>
          ))}
        </Select>

        {role === "admin" && (
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEmailComposer(true)}>
              <Mail className="w-4 h-4 mr-1" />Email participants
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddPlayer(true)}>
              <Plus className="w-4 h-4 mr-1" />Add player
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddLead(true)}>
              <UserPlus className="w-4 h-4 mr-1" />From lead
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWalkIn(true)}>
              <UserPlus className="w-4 h-4 mr-1" />Walk-in
            </Button>
          </>
        )}
      </div>

      {showEmailComposer && (
        <CampaignComposer
          open={showEmailComposer}
          onClose={() => setShowEmailComposer(false)}
          templates={emailTemplates}
          events={emailEvents.length > 0 ? emailEvents : [{ id: event.id, title: event.title, start_at: event.start_at, timezone: event.timezone }]}
          prefilledEventId={event.id}
        />
      )}

      {/* Bulk actions (admin only) */}
      {role === "admin" && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-[#0C0F4C]/5 rounded-lg">
          <span className="text-sm font-medium text-gray-700">{selected.size} selected</span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as ParticipantStatus | "")}
            className="w-48"
          >
            <option value="">Change status to...</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>
            ))}
          </Select>
          <Button size="sm" onClick={handleBulkStatus} disabled={!bulkStatus} className="bg-[#0C0F4C] text-white">
            Apply
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No participants found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {role === "admin" && (
                  <th className="w-10 px-4 py-3">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                      {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Birth year</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Position</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                {role === "admin" && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => {
                const contact = primaryContact(p)
                return (
                  <tr key={p.id} className={cn("hover:bg-gray-50 transition-colors", selected.has(p.id) && "bg-blue-50")}>
                    {role === "admin" && (
                      <td className="px-4 py-3">
                        <button onClick={() => toggle(p.id)} className="text-gray-400 hover:text-gray-600">
                          {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-[#0C0F4C]" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-gray-900">{participantName(p)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.players?.birth_year ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.players?.position ?? "-"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {contact ? (
                        <span className="text-gray-500">{contact.first_name} {contact.last_name}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {role === "admin" ? (
                        <Select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p.id, e.target.value as ParticipantStatus)}
                          className="text-xs py-1 h-7 w-32"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge variant={statusVariant(p.status)}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1).replace(/_/g, " ")}
                        </Badge>
                      )}
                    </td>
                    {role === "admin" && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setRemoveId(p.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            {filtered.length} participant{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Add player dialog */}
      <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add player</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePlayerSearch()}
                className="flex-1"
              />
              <Button onClick={handlePlayerSearch} disabled={searchingPlayers}>
                {searchingPlayers ? "..." : "Search"}
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Add with status</Label>
              <Select value={addStatus} onChange={(e) => setAddStatus(e.target.value as ParticipantStatus)}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            {playerResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {playerResults.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium">{player.first_name} {player.last_name}</div>
                      <div className="text-xs text-gray-500">{player.birth_year ?? "?"} · {player.position ?? "No position"} · {player.current_club ?? ""}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddPlayer(player.id)}
                      disabled={addingPlayer === player.id}
                      className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
                    >
                      {addingPlayer === player.id ? "..." : "Add"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlayer(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add from lead dialog */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add from lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or email..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLeadSearch()}
                className="flex-1"
              />
              <Button onClick={handleLeadSearch} disabled={searchingLeads}>
                {searchingLeads ? "..." : "Search"}
              </Button>
            </div>
            {leadResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {leadResults.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {lead.contacts?.first_name} {lead.contacts?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Player: {lead.players?.first_name} {lead.players?.last_name ?? ""} · {lead.form_type}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddFromLead(lead)}
                      className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLead(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-in dialog */}
      <Dialog open={showWalkIn} onOpenChange={setShowWalkIn}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add walk-in</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Player</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First name *</Label>
                  <Input value={wiPlayerFirst} onChange={(e) => setWiPlayerFirst(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Last name</Label>
                  <Input value={wiPlayerLast} onChange={(e) => setWiPlayerLast(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Birth year</Label>
                  <Input type="number" value={wiPlayerBirthYear} onChange={(e) => setWiPlayerBirthYear(e.target.value)} placeholder="e.g. 2012" />
                </div>
                <div className="space-y-1">
                  <Label>Position</Label>
                  <Input value={wiPlayerPosition} onChange={(e) => setWiPlayerPosition(e.target.value)} placeholder="e.g. Midfielder" />
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parent / contact</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First name *</Label>
                  <Input value={wiContactFirst} onChange={(e) => setWiContactFirst(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Last name *</Label>
                  <Input value={wiContactLast} onChange={(e) => setWiContactLast(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={wiContactPhone} onChange={(e) => setWiContactPhone(e.target.value)} placeholder="+61 4xx xxx xxx" />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={wiContactEmail} onChange={(e) => setWiContactEmail(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalkIn(false)}>Cancel</Button>
            <Button
              onClick={handleWalkIn}
              disabled={savingWalkIn}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {savingWalkIn ? "Adding..." : "Add walk-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove participant?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This will remove the participant from this event. The player and contact records will not be deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
