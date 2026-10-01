"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Download,
  Upload,
  Archive,
  UserCheck,
} from "lucide-react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Papa from "papaparse"
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
import {
  updateLeadStage,
  bulkUpdateStage,
  bulkAssignOwner,
  bulkArchive,
  createLead,
  type LeadWithRelations,
} from "@/app/(app)/leads/actions"
import { createContact } from "@/app/(app)/contacts/actions"
import { createPlayer } from "@/app/(app)/players/actions"
import type { Database, Tables } from "@/lib/database.types"

type LeadStage = Database["public"]["Enums"]["lead_stage"]
type LeadSource = Database["public"]["Enums"]["lead_source"]

const STAGES: LeadStage[] = ["new", "contacted", "interested", "confirmed", "signed", "not_interested", "lost"]
const SOURCES: LeadSource[] = ["website", "meta_instant_form", "newsletter", "referral", "manual", "import", "other"]

const PAGE_SIZE = 25

function stageBadge(stage: LeadStage): "secondary" | "default" | "warning" | "success" | "destructive" {
  const map: Record<LeadStage, "secondary" | "default" | "warning" | "success" | "destructive"> = {
    new: "secondary",
    contacted: "default",
    interested: "warning",
    confirmed: "success",
    signed: "success",
    not_interested: "destructive",
    lost: "destructive",
  }
  return map[stage]
}

function SortableLeadCard({ lead, onClick }: { lead: LeadWithRelations; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <p className="font-medium text-sm text-[#0C0F4C] truncate">
        {lead.contacts?.first_name} {lead.contacts?.last_name}
      </p>
      {lead.players && (
        <p className="text-xs text-gray-500 truncate">
          {lead.players.first_name} {lead.players.last_name}
          {lead.players.birth_year && ` (${lead.players.birth_year})`}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <Badge variant="secondary" className="text-xs">{lead.source.replace("_", " ")}</Badge>
        {lead.next_follow_up_at && (
          <span className="text-xs text-orange-600">
            Follow-up: {format(new Date(lead.next_follow_up_at), "d MMM")}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {format(new Date(lead.created_at), "d MMM yyyy")}
      </p>
    </div>
  )
}

function KanbanColumn({
  stage,
  leads,
  onCardClick,
}: {
  stage: LeadStage
  leads: LeadWithRelations[]
  onCardClick: (lead: LeadWithRelations) => void
}) {
  return (
    <div className="flex-1 min-w-56 max-w-72">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stage.replace("_", " ")}</span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{leads.length}</span>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-16">
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onCardClick(lead)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

type Props = {
  leads: LeadWithRelations[]
  profiles: Tables<"profiles">[]
}

export function LeadsShell({ leads: initialLeads, profiles }: Props) {
  const router = useRouter()
  const [view, setView] = useState<"board" | "table">("board")
  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [filterStage, setFilterStage] = useState("")
  const [filterOwner, setFilterOwner] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeDrag, setActiveDrag] = useState<LeadWithRelations | null>(null)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [bulkStageOpen, setBulkStageOpen] = useState(false)
  const [bulkOwnerOpen, setBulkOwnerOpen] = useState(false)
  const [bulkStage, setBulkStage] = useState<LeadStage>("contacted")
  const [bulkOwner, setBulkOwner] = useState("")
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState({
    source: "manual" as LeadSource,
    form_type: "",
    stage: "new" as LeadStage,
    owner_id: "",
    contact_first_name: "",
    contact_last_name: "",
    contact_email: "",
    contact_phone: "",
    player_first_name: "",
    player_last_name: "",
    player_birth_year: "",
    player_position: "",
    player_club: "",
    notes: "",
  })

  const filtered = useMemo(() => {
    let result = leads

    if (search) {
      const s = search.toLowerCase()
      result = result.filter((l) => {
        const cn = `${l.contacts?.first_name ?? ""} ${l.contacts?.last_name ?? ""} ${l.contacts?.email ?? ""}`.toLowerCase()
        const pn = `${l.players?.first_name ?? ""} ${l.players?.last_name ?? ""}`.toLowerCase()
        return cn.includes(s) || pn.includes(s)
      })
    }

    if (filterSource) result = result.filter((l) => l.source === filterSource)
    if (filterStage) result = result.filter((l) => l.stage === filterStage)
    if (filterOwner) result = result.filter((l) => l.owner_id === filterOwner)

    return result
  }, [leads, search, filterSource, filterStage, filterOwner])

  const boardLeads = useMemo(() => {
    const cols: Record<LeadStage, LeadWithRelations[]> = {
      new: [], contacted: [], interested: [], confirmed: [], signed: [], not_interested: [], lost: [],
    }
    for (const lead of filtered) {
      cols[lead.stage].push(lead)
    }
    return cols
  }, [filtered])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id)
    setActiveDrag(lead ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const lead = leads.find((l) => l.id === active.id)
    if (!lead) return

    const newStage = over.id as LeadStage
    if (!STAGES.includes(newStage)) return
    if (lead.stage === newStage) return

    setLeads((prev) =>
      prev.map((l) => l.id === lead.id ? { ...l, stage: newStage } : l)
    )

    const result = await updateLeadStage(lead.id, newStage)
    if (result.error) {
      toast.error(result.error)
      setLeads((prev) =>
        prev.map((l) => l.id === lead.id ? { ...l, stage: lead.stage } : l)
      )
    }
  }

  async function handleBulkStage() {
    const result = await bulkUpdateStage(Array.from(selected), bulkStage)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Stage updated for ${selected.size} leads`)
      setBulkStageOpen(false)
      setSelected(new Set())
      router.refresh()
    }
  }

  async function handleBulkOwner() {
    const result = await bulkAssignOwner(Array.from(selected), bulkOwner)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Owner assigned to ${selected.size} leads`)
      setBulkOwnerOpen(false)
      setSelected(new Set())
      router.refresh()
    }
  }

  async function handleBulkArchive() {
    if (!confirm(`Archive ${selected.size} lead(s)?`)) return
    const result = await bulkArchive(Array.from(selected))
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Archived ${selected.size} leads`)
      setSelected(new Set())
      router.refresh()
    }
  }

  function handleExportCSV() {
    const rows = filtered.map((l) => ({
      contact_name: `${l.contacts?.first_name ?? ""} ${l.contacts?.last_name ?? ""}`.trim(),
      contact_email: l.contacts?.email ?? "",
      contact_phone: l.contacts?.phone ?? "",
      player_name: `${l.players?.first_name ?? ""} ${l.players?.last_name ?? ""}`.trim(),
      player_birth_year: l.players?.birth_year ?? "",
      source: l.source,
      form_type: l.form_type ?? "",
      stage: l.stage,
      owner: l.profiles?.full_name ?? "",
      submitted: l.created_at ? format(new Date(l.created_at), "d MMM yyyy") : "",
      follow_up: l.next_follow_up_at ? format(new Date(l.next_follow_up_at), "d MMM yyyy") : "",
    }))

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    let contactId: string | null = null
    let playerId: string | null = null

    if (newForm.contact_email || newForm.contact_first_name || newForm.contact_phone) {
      const contactResult = await createContact({
        first_name: newForm.contact_first_name || null,
        last_name: newForm.contact_last_name || null,
        email: newForm.contact_email || null,
        phone: newForm.contact_phone || null,
        source: newForm.source,
        marketing_consent: "none",
      })
      if (contactResult.error) {
        toast.error(`Contact error: ${contactResult.error}`)
        setSaving(false)
        return
      }
      contactId = contactResult.data?.id ?? null
    }

    if (newForm.player_first_name || newForm.player_last_name) {
      const playerResult = await createPlayer({
        first_name: newForm.player_first_name || null,
        last_name: newForm.player_last_name || null,
        birth_year: newForm.player_birth_year ? parseInt(newForm.player_birth_year) : null,
        position: newForm.player_position || null,
        current_club: newForm.player_club || null,
        status: "prospect",
      })
      if (playerResult.error) {
        toast.error(`Player error: ${playerResult.error}`)
        setSaving(false)
        return
      }
      playerId = playerResult.data?.id ?? null
    }

    const leadResult = await createLead({
      source: newForm.source,
      form_type: newForm.form_type || null,
      stage: newForm.stage,
      owner_id: newForm.owner_id || null,
      contact_id: contactId,
      player_id: playerId,
    })

    setSaving(false)

    if (leadResult.error) {
      toast.error(leadResult.error)
    } else {
      toast.success("Lead created")
      setNewDialogOpen(false)
      router.refresh()
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0C0F4C]">Leads</h1>
          <p className="text-sm text-gray-500">{filtered.length} leads</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView("board")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === "board" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === "table" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
          </div>
          <Button
            onClick={() => setNewDialogOpen(true)}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New lead
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search leads..."
            className="pl-9"
          />
        </div>

        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>

        <select
          value={filterStage}
          onChange={(e) => { setFilterStage(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>

        <select
          value={filterOwner}
          onChange={(e) => { setFilterOwner(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All owners</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      {view === "board" && (
        <DndContext
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                leads={boardLeads[stage]}
                onCardClick={(lead) => router.push(`/leads/${lead.id}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDrag && (
              <div className="bg-white rounded-lg border p-3 shadow-xl w-56">
                <p className="font-medium text-sm text-[#0C0F4C] truncate">
                  {activeDrag.contacts?.first_name} {activeDrag.contacts?.last_name}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {view === "table" && (
        <>
          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-blue-50 px-4 py-2">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => setBulkStageOpen(true)}>
                Change stage
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkOwnerOpen(true)}>
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                Assign owner
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkArchive} className="text-red-600 hover:text-red-700">
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archive
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCSV} className="ml-auto">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Link href="/leads/import">
                <Button size="sm" variant="outline">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </Button>
              </Link>
            </div>
          )}

          {selected.size === 0 && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Link href="/leads/import">
                <Button size="sm" variant="outline">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </Button>
              </Link>
            </div>
          )}

          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === paginated.length && paginated.length > 0}
                      onChange={() => {
                        if (selected.size === paginated.length) setSelected(new Set())
                        else setSelected(new Set(paginated.map((l) => l.id)))
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600">Contact</th>
                  <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Player</th>
                  <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Source</th>
                  <th className="px-3 py-3 font-medium text-gray-600">Stage</th>
                  <th className="px-3 py-3 font-medium text-gray-600 hidden xl:table-cell">Owner</th>
                  <th className="px-3 py-3 font-medium text-gray-600 hidden xl:table-cell">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">No leads found</td>
                  </tr>
                ) : (
                  paginated.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (next.has(lead.id)) next.delete(lead.id)
                              else next.add(lead.id)
                              return next
                            })
                          }}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-[#0C0F4C] hover:underline">
                          {lead.contacts?.first_name} {lead.contacts?.last_name}
                        </Link>
                        {lead.contacts?.phone && (
                          <p className="text-xs text-gray-400">{lead.contacts.phone}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 hidden md:table-cell">
                        {lead.players ? (
                          <Link href={`/players/${lead.player_id}`} className="hover:underline">
                            {lead.players.first_name} {lead.players.last_name}
                            {lead.players.birth_year && <span className="text-gray-400"> ({lead.players.birth_year})</span>}
                          </Link>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{lead.source.replace("_", " ")}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={stageBadge(lead.stage)}>{lead.stage.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs hidden xl:table-cell">
                        {lead.profiles?.full_name ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs hidden xl:table-cell">
                        {format(new Date(lead.created_at), "d MMM yyyy")}
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
        </>
      )}

      <Dialog open={newDialogOpen} onOpenChange={(o) => { if (!o) setNewDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLead} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Lead details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Source *</Label>
                  <select
                    value={newForm.source}
                    onChange={(e) => setNewForm((f) => ({ ...f, source: e.target.value as LeadSource }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                  >
                    {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <select
                    value={newForm.stage}
                    onChange={(e) => setNewForm((f) => ({ ...f, stage: e.target.value as LeadStage }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                  >
                    {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={newForm.contact_first_name} onChange={(e) => setNewForm((f) => ({ ...f, contact_first_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={newForm.contact_last_name} onChange={(e) => setNewForm((f) => ({ ...f, contact_last_name: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                <Label>Email</Label>
                <Input type="email" value={newForm.contact_email} onChange={(e) => setNewForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div className="space-y-1.5 mt-2">
                <Label>Phone</Label>
                <Input value={newForm.contact_phone} onChange={(e) => setNewForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Player</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={newForm.player_first_name} onChange={(e) => setNewForm((f) => ({ ...f, player_first_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={newForm.player_last_name} onChange={(e) => setNewForm((f) => ({ ...f, player_last_name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label>Birth year</Label>
                  <Input value={newForm.player_birth_year} onChange={(e) => setNewForm((f) => ({ ...f, player_birth_year: e.target.value }))} placeholder="2012" />
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Input value={newForm.player_position} onChange={(e) => setNewForm((f) => ({ ...f, player_position: e.target.value }))} placeholder="GK" />
                </div>
                <div className="space-y-1.5">
                  <Label>Club</Label>
                  <Input value={newForm.player_club} onChange={(e) => setNewForm((f) => ({ ...f, player_club: e.target.value }))} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                {saving ? "Creating..." : "Create lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkStageOpen} onOpenChange={(o) => { if (!o) setBulkStageOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change stage for {selected.size} leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New stage</Label>
            <select
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value as LeadStage)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
            >
              {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStageOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkStage} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Update stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOwnerOpen} onOpenChange={(o) => { if (!o) setBulkOwnerOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign owner to {selected.size} leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <select
              value={bulkOwner}
              onChange={(e) => setBulkOwner(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOwnerOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkOwner} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
