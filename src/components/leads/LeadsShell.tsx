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
  ArrowLeft,
  ChevronRight,
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
import { cn } from "cn"
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
type ViewMode = "overview" | "board" | "table"

const STAGES: LeadStage[] = ["new", "contacted", "interested", "confirmed", "signed", "not_interested", "lost"]
const SOURCES: LeadSource[] = ["website", "meta_instant_form", "newsletter", "referral", "manual", "import", "other"]

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  meta_instant_form: "Meta Ads",
  newsletter: "Newsletter",
  referral: "Referral",
  manual: "Manual",
  import: "Import",
  other: "Other",
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  confirmed: "Confirmed",
  signed: "Signed",
  not_interested: "Not Interested",
  lost: "Lost",
}

const STAGE_COLOURS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  interested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  signed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  not_interested: "bg-gray-100 text-gray-600 border-gray-200",
  lost: "bg-red-100 text-red-700 border-red-200",
}

const SOURCE_COLOURS: Record<string, string> = {
  website: "bg-purple-50 border-purple-200 text-purple-700",
  meta_instant_form: "bg-blue-50 border-blue-200 text-blue-700",
  newsletter: "bg-teal-50 border-teal-200 text-teal-700",
  referral: "bg-orange-50 border-orange-200 text-orange-700",
  manual: "bg-gray-50 border-gray-200 text-gray-700",
  import: "bg-slate-50 border-slate-200 text-slate-700",
  other: "bg-gray-50 border-gray-200 text-gray-500",
}

const PAGE_SIZE = 50

function stageBadgeVariant(stage: LeadStage): "secondary" | "default" | "warning" | "success" | "destructive" {
  const map: Record<LeadStage, "secondary" | "default" | "warning" | "success" | "destructive"> = {
    new: "secondary", contacted: "default", interested: "warning",
    confirmed: "success", signed: "success", not_interested: "destructive", lost: "destructive",
  }
  return map[stage]
}

// ─── Kanban helpers ───────────────────────────────────────────────────────────

function SortableLeadCard({ lead, onClick }: { lead: LeadWithRelations; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
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
        <Badge variant="secondary" className="text-xs">{SOURCE_LABELS[lead.source] ?? lead.source}</Badge>
        {lead.next_follow_up_at && (
          <span className="text-xs text-orange-600">
            Follow-up: {format(new Date(lead.next_follow_up_at), "d MMM")}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">{format(new Date(lead.created_at), "d MMM yyyy")}</p>
    </div>
  )
}

function KanbanColumn({ stage, leads, onCardClick }: { stage: LeadStage; leads: LeadWithRelations[]; onCardClick: (l: LeadWithRelations) => void }) {
  return (
    <div className="flex-1 min-w-56 max-w-72">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{STAGE_LABELS[stage]}</span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{leads.length}</span>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-16">
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = { leads: LeadWithRelations[]; profiles: Tables<"profiles">[] }

export function LeadsShell({ leads: initialLeads, profiles }: Props) {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>("overview")
  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [filterStage, setFilterStage] = useState("")
  const [filterOwner, setFilterOwner] = useState("")
  const [filterFormType, setFilterFormType] = useState("")
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
    source: "manual" as LeadSource, form_type: "", stage: "new" as LeadStage, owner_id: "",
    contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "",
    player_first_name: "", player_last_name: "", player_birth_year: "", player_position: "", player_club: "", notes: "",
  })

  // Derived stats
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  const recentLeads = useMemo(() =>
    leads.filter((l) => new Date(l.created_at).getTime() > thirtyDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [leads, thirtyDaysAgo]
  )

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) counts[l.source] = (counts[l.source] ?? 0) + 1
    return SOURCES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({ source: s, count: counts[s] ?? 0 }))
  }, [leads])

  const formTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) {
      const ft = l.form_type ?? "unknown"
      counts[ft] = (counts[ft] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [leads])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1
    return counts
  }, [leads])

  const newThisWeek = useMemo(() =>
    leads.filter((l) => new Date(l.created_at).getTime() > sevenDaysAgo).length,
    [leads, sevenDaysAgo]
  )

  const followUpsDue = useMemo(() =>
    leads.filter((l) => l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() <= now).length,
    [leads, now]
  )

  // Filtered list for table/board
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
    if (filterFormType) result = result.filter((l) => (l.form_type ?? "unknown") === filterFormType)
    return result
  }, [leads, search, filterSource, filterStage, filterOwner])

  const boardLeads = useMemo(() => {
    const cols: Record<LeadStage, LeadWithRelations[]> = {
      new: [], contacted: [], interested: [], confirmed: [], signed: [], not_interested: [], lost: [],
    }
    for (const l of filtered) cols[l.stage].push(l)
    return cols
  }, [filtered])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function drillIntoSource(source: string) {
    setFilterSource(source); setFilterStage(""); setFilterFormType(""); setSearch(""); setPage(1); setView("table")
  }

  function drillIntoStage(stage: string) {
    setFilterStage(stage); setFilterSource(""); setFilterFormType(""); setSearch(""); setPage(1); setView("table")
  }

  function drillIntoFormType(ft: string) {
    setFilterFormType(ft); setFilterSource(""); setFilterStage(""); setSearch(""); setPage(1); setView("table")
  }

  function goToOverview() {
    setFilterSource(""); setFilterStage(""); setFilterFormType(""); setSearch(""); setPage(1); setView("overview")
  }

  // Kanban drag
  function handleDragStart(event: DragStartEvent) {
    setActiveDrag(leads.find((l) => l.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const lead = leads.find((l) => l.id === active.id)
    if (!lead) return
    const newStage = over.id as LeadStage
    if (!STAGES.includes(newStage) || lead.stage === newStage) return
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: newStage } : l))
    const result = await updateLeadStage(lead.id, newStage)
    if (result.error) {
      toast.error(result.error)
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: lead.stage } : l))
    }
  }

  // Bulk actions
  async function handleBulkStage() {
    const result = await bulkUpdateStage(Array.from(selected), bulkStage)
    if (result.error) { toast.error(result.error) } else {
      toast.success(`Stage updated for ${selected.size} leads`)
      setBulkStageOpen(false); setSelected(new Set()); router.refresh()
    }
  }

  async function handleBulkOwner() {
    const result = await bulkAssignOwner(Array.from(selected), bulkOwner)
    if (result.error) { toast.error(result.error) } else {
      toast.success(`Owner assigned to ${selected.size} leads`)
      setBulkOwnerOpen(false); setSelected(new Set()); router.refresh()
    }
  }

  async function handleBulkArchive() {
    if (!confirm(`Archive ${selected.size} lead(s)?`)) return
    const result = await bulkArchive(Array.from(selected))
    if (result.error) { toast.error(result.error) } else {
      toast.success(`Archived ${selected.size} leads`)
      setSelected(new Set()); router.refresh()
    }
  }

  function handleExportCSV() {
    const csv = Papa.unparse(filtered.map((l) => ({
      contact_name: `${l.contacts?.first_name ?? ""} ${l.contacts?.last_name ?? ""}`.trim(),
      contact_email: l.contacts?.email ?? "", contact_phone: l.contacts?.phone ?? "",
      player_name: `${l.players?.first_name ?? ""} ${l.players?.last_name ?? ""}`.trim(),
      player_birth_year: l.players?.birth_year ?? "", source: l.source,
      form_type: l.form_type ?? "", stage: l.stage, owner: l.profiles?.full_name ?? "",
      submitted: l.created_at ? format(new Date(l.created_at), "d MMM yyyy") : "",
      follow_up: l.next_follow_up_at ? format(new Date(l.next_follow_up_at), "d MMM yyyy") : "",
    })))
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `leads-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let contactId: string | null = null
    let playerId: string | null = null
    if (newForm.contact_email || newForm.contact_first_name || newForm.contact_phone) {
      const r = await createContact({ first_name: newForm.contact_first_name || null, last_name: newForm.contact_last_name || null, email: newForm.contact_email || null, phone: newForm.contact_phone || null, source: newForm.source, marketing_consent: "none" })
      if (r.error) { toast.error(`Contact error: ${r.error}`); setSaving(false); return }
      contactId = r.data?.id ?? null
    }
    if (newForm.player_first_name || newForm.player_last_name) {
      const r = await createPlayer({ first_name: newForm.player_first_name || null, last_name: newForm.player_last_name || null, birth_year: newForm.player_birth_year ? parseInt(newForm.player_birth_year) : null, position: newForm.player_position || null, current_club: newForm.player_club || null, status: "prospect" })
      if (r.error) { toast.error(`Player error: ${r.error}`); setSaving(false); return }
      playerId = r.data?.id ?? null
    }
    const r = await createLead({ source: newForm.source, form_type: newForm.form_type || null, stage: newForm.stage, owner_id: newForm.owner_id || null, contact_id: contactId, player_id: playerId })
    setSaving(false)
    if (r.error) { toast.error(r.error) } else { toast.success("Lead created"); setNewDialogOpen(false); router.refresh() }
  }

  // ─── Shared header ──────────────────────────────────────────────────────────

  const activeFilterLabel = filterSource ? SOURCE_LABELS[filterSource] ?? filterSource
    : filterStage ? STAGE_LABELS[filterStage] ?? filterStage
    : filterFormType ? filterFormType
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {view !== "overview" && (
            <button onClick={goToOverview} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Overview
            </button>
          )}
          <h1 className="text-xl font-semibold text-gray-900">
            {view === "overview" ? "Leads" : activeFilterLabel ? `Leads — ${activeFilterLabel}` : "All Leads"}
          </h1>
          <span className="text-sm text-gray-400">{leads.length.toLocaleString()} total</span>
        </div>
        <div className="flex items-center gap-2">
          {view !== "overview" && (
            <div className="flex rounded-lg border overflow-hidden">
              <button onClick={() => setView("board")} className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors", view === "board" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
              <button onClick={() => setView("table")} className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors", view === "table" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          )}
          <Button onClick={() => setNewDialogOpen(true)} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
            <Plus className="h-4 w-4 mr-1.5" /> New lead
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── OVERVIEW ── */}
        {view === "overview" && (
          <div className="px-6 py-5 space-y-6">

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Active</p>
                <p className="text-3xl font-bold text-[#0C0F4C] mt-1">{leads.length.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">New This Week</p>
                <p className="text-3xl font-bold text-[#0C0F4C] mt-1">{newThisWeek}</p>
              </div>
              <div className={cn("rounded-xl border px-5 py-4", followUpsDue > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200")}>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Follow-ups Due</p>
                <p className={cn("text-3xl font-bold mt-1", followUpsDue > 0 ? "text-orange-600" : "text-[#0C0F4C]")}>{followUpsDue}</p>
              </div>
            </div>

            {/* Stage pipeline */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Pipeline</h2>
              <div className="grid grid-cols-7 gap-2">
                {STAGES.map((stage) => {
                  const count = stageCounts[stage] ?? 0
                  const pct = leads.length > 0 ? (count / leads.length) * 100 : 0
                  return (
                    <button
                      key={stage}
                      onClick={() => drillIntoStage(stage)}
                      className="group bg-white rounded-xl border border-gray-200 p-3 text-center hover:border-[#0C0F4C] hover:shadow-sm transition-all"
                    >
                      <p className="text-2xl font-bold text-[#0C0F4C] group-hover:text-[#C9A227] transition-colors">{count}</p>
                      <div className={cn("mt-2 text-xs font-medium px-2 py-0.5 rounded-full border inline-block", STAGE_COLOURS[stage])}>
                        {STAGE_LABELS[stage]}
                      </div>
                      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0C0F4C] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Source breakdown */}
            {sourceBreakdown.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">By Source</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sourceBreakdown.map(({ source, count }) => (
                    <button
                      key={source}
                      onClick={() => drillIntoSource(source)}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border px-4 py-3 hover:shadow-sm transition-all text-left",
                        SOURCE_COLOURS[source] ?? "bg-gray-50 border-gray-200 text-gray-700"
                      )}
                    >
                      <div>
                        <p className="font-semibold text-lg leading-none">{count}</p>
                        <p className="text-xs mt-1 opacity-80">{SOURCE_LABELS[source] ?? source}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-80 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Form type breakdown */}
            {formTypeBreakdown.length > 1 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">By Form Type</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {formTypeBreakdown.map(([ft, count]) => (
                    <button
                      key={ft}
                      onClick={() => drillIntoFormType(ft)}
                      className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-[#0C0F4C] hover:shadow-sm transition-all text-left"
                    >
                      <div>
                        <p className="font-semibold text-lg leading-none text-[#0C0F4C]">{count}</p>
                        <p className="text-xs mt-1 text-gray-500 capitalize">{ft === "unknown" ? "No form type" : ft.replace(/_/g, " ")}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-80 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent leads */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Recent Leads <span className="text-gray-400 font-normal">(last 30 days)</span></h2>
                <button onClick={() => { setFilterSource(""); setFilterStage(""); setView("table") }} className="text-xs text-[#0C0F4C] hover:underline">
                  View all →
                </button>
              </div>
              {recentLeads.length === 0 ? (
                <p className="text-sm text-gray-400">No leads in the last 30 days.</p>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Contact</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Player</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Source</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Stage</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentLeads.slice(0, 20).map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/leads/${lead.id}`} className="font-medium text-[#0C0F4C] hover:underline">
                              {lead.contacts?.first_name} {lead.contacts?.last_name}
                            </Link>
                            {lead.contacts?.phone && <p className="text-xs text-gray-400">{lead.contacts.phone}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">
                            {lead.players ? `${lead.players.first_name} ${lead.players.last_name}${lead.players.birth_year ? ` (${lead.players.birth_year})` : ""}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", SOURCE_COLOURS[lead.source] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                              {SOURCE_LABELS[lead.source] ?? lead.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STAGE_COLOURS[lead.stage])}>
                              {STAGE_LABELS[lead.stage]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                            {format(new Date(lead.created_at), "d MMM yyyy")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {recentLeads.length > 20 && (
                    <div className="px-4 py-3 border-t bg-gray-50 text-center">
                      <button onClick={() => { setFilterSource(""); setFilterStage(""); setView("table") }} className="text-xs text-[#0C0F4C] hover:underline">
                        +{recentLeads.length - 20} more — view all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TABLE / BOARD views ── */}
        {view !== "overview" && (
          <div className="px-6 py-4 space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search leads..." className="pl-9" />
              </div>
              <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setPage(1) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="">All sources</option>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
              </select>
              <select value={filterStage} onChange={(e) => { setFilterStage(e.target.value); setPage(1) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="">All stages</option>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <select value={filterOwner} onChange={(e) => { setFilterOwner(e.target.value); setPage(1) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="">All owners</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              {formTypeBreakdown.length > 1 && (
                <select value={filterFormType} onChange={(e) => { setFilterFormType(e.target.value); setPage(1) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All form types</option>
                  {formTypeBreakdown.map(([ft]) => <option key={ft} value={ft}>{ft === "unknown" ? "No form type" : ft.replace(/_/g, " ")}</option>)}
                </select>
              )}
              <span className="self-center text-sm text-gray-400">{filtered.length.toLocaleString()} leads</span>
            </div>

            {/* Board view */}
            {view === "board" && (
              <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {STAGES.map((stage) => (
                    <KanbanColumn key={stage} stage={stage} leads={boardLeads[stage]} onCardClick={(l) => router.push(`/leads/${l.id}`)} />
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

            {/* Table view */}
            {view === "table" && (
              <>
                {selected.size > 0 && (
                  <div className="flex items-center gap-3 rounded-lg border bg-blue-50 px-4 py-2">
                    <span className="text-sm font-medium">{selected.size} selected</span>
                    <Button size="sm" variant="outline" onClick={() => setBulkStageOpen(true)}>Change stage</Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkOwnerOpen(true)}>
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Assign owner
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkArchive} className="text-red-600 hover:text-red-700">
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportCSV} className="ml-auto">
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                    </Button>
                    <Link href="/leads/import"><Button size="sm" variant="outline"><Upload className="h-3.5 w-3.5 mr-1.5" /> Import</Button></Link>
                  </div>
                )}
                {selected.size === 0 && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV</Button>
                    <Link href="/leads/import"><Button size="sm" variant="outline"><Upload className="h-3.5 w-3.5 mr-1.5" /> Import</Button></Link>
                  </div>
                )}

                <div className="rounded-lg border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="w-8 px-3 py-3">
                          <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0}
                            onChange={() => selected.size === paginated.length ? setSelected(new Set()) : setSelected(new Set(paginated.map((l) => l.id)))}
                            className="rounded" />
                        </th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Contact</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Player</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Source</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Stage</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden xl:table-cell">Owner</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden xl:table-cell">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginated.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No leads found</td></tr>
                      ) : (
                        paginated.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-3 py-3">
                              <input type="checkbox" checked={selected.has(lead.id)}
                                onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(lead.id) ? n.delete(lead.id) : n.add(lead.id); return n })}
                                className="rounded" onClick={(e) => e.stopPropagation()} />
                            </td>
                            <td className="px-3 py-3">
                              <Link href={`/leads/${lead.id}`} className="font-medium text-[#0C0F4C] hover:underline">
                                {lead.contacts?.first_name} {lead.contacts?.last_name}
                              </Link>
                              {lead.contacts?.phone && <p className="text-xs text-gray-400">{lead.contacts.phone}</p>}
                            </td>
                            <td className="px-3 py-3 text-gray-600 hidden md:table-cell">
                              {lead.players ? (
                                <Link href={`/players/${lead.player_id}`} className="hover:underline text-sm">
                                  {lead.players.first_name} {lead.players.last_name}
                                  {lead.players.birth_year && <span className="text-gray-400"> ({lead.players.birth_year})</span>}
                                </Link>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", SOURCE_COLOURS[lead.source] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                                {SOURCE_LABELS[lead.source] ?? lead.source}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={stageBadgeVariant(lead.stage)}>{STAGE_LABELS[lead.stage]}</Badge>
                            </td>
                            <td className="px-3 py-3 text-gray-500 text-xs hidden xl:table-cell">{lead.profiles?.full_name ?? "—"}</td>
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
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={newDialogOpen} onOpenChange={(o) => { if (!o) setNewDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateLead} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Lead details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Source *</Label>
                  <select value={newForm.source} onChange={(e) => setNewForm((f) => ({ ...f, source: e.target.value as LeadSource }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                    {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <select value={newForm.stage} onChange={(e) => setNewForm((f) => ({ ...f, stage: e.target.value as LeadStage }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>First name</Label><Input value={newForm.contact_first_name} onChange={(e) => setNewForm((f) => ({ ...f, contact_first_name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Last name</Label><Input value={newForm.contact_last_name} onChange={(e) => setNewForm((f) => ({ ...f, contact_last_name: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5 mt-2"><Label>Email</Label><Input type="email" value={newForm.contact_email} onChange={(e) => setNewForm((f) => ({ ...f, contact_email: e.target.value }))} /></div>
              <div className="space-y-1.5 mt-2"><Label>Phone</Label><Input value={newForm.contact_phone} onChange={(e) => setNewForm((f) => ({ ...f, contact_phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Player</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>First name</Label><Input value={newForm.player_first_name} onChange={(e) => setNewForm((f) => ({ ...f, player_first_name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Last name</Label><Input value={newForm.player_last_name} onChange={(e) => setNewForm((f) => ({ ...f, player_last_name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="space-y-1.5"><Label>Birth year</Label><Input value={newForm.player_birth_year} onChange={(e) => setNewForm((f) => ({ ...f, player_birth_year: e.target.value }))} placeholder="2012" /></div>
                <div className="space-y-1.5"><Label>Position</Label><Input value={newForm.player_position} onChange={(e) => setNewForm((f) => ({ ...f, player_position: e.target.value }))} placeholder="GK" /></div>
                <div className="space-y-1.5"><Label>Club</Label><Input value={newForm.player_club} onChange={(e) => setNewForm((f) => ({ ...f, player_club: e.target.value }))} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">{saving ? "Creating..." : "Create lead"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkStageOpen} onOpenChange={(o) => { if (!o) setBulkStageOpen(false) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change stage for {selected.size} leads</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>New stage</Label>
            <select value={bulkStage} onChange={(e) => setBulkStage(e.target.value as LeadStage)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
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
          <DialogHeader><DialogTitle>Assign owner to {selected.size} leads</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <select value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
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
