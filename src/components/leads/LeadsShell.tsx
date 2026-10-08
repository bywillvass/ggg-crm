"use client"

import { useState, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
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
  MapPin,
  CalendarPlus,
  CalendarCheck,
  Mail,
  Tag,
  ExternalLink,
  Phone,
  MessageSquare,
  StickyNote,
  CheckSquare,
  MessageCircle,
  User,
  Users,
  MoreHorizontal,
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
  archiveLead,
  createLead,
  bulkAddTagToLeads,
  type LeadWithRelations,
} from "@/app/(app)/leads/actions"
import { createContact } from "@/app/(app)/contacts/actions"
import { createPlayer } from "@/app/(app)/players/actions"
import type { Database, Tables } from "@/lib/database.types"
import { phoneSearchKey, isPhoneQuery } from "@/lib/phone"
import { AddToEventDialog } from "./AddToEventDialog"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import { LeadDrawer } from "./LeadDrawer"
import { CampaignComposer } from "@/components/email/CampaignComposer"
import { RowMenu } from "@/components/shared/RowMenu"
import type { EmailTemplateRow } from "@/app/(app)/email/actions"

type LeadStage = Database["public"]["Enums"]["lead_stage"]
type LeadSource = Database["public"]["Enums"]["lead_source"]
type ViewMode = "board" | "table"

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

// ─── City normalisation ───────────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string> = {
  // Melbourne
  melbourne: "Melbourne", melb: "Melbourne", mel: "Melbourne", melbournecbd: "Melbourne",
  // Sydney
  sydney: "Sydney", syd: "Sydney", sydneycbd: "Sydney",
  // Brisbane
  brisbane: "Brisbane", bris: "Brisbane",
  // Gold Coast
  goldcoast: "Gold Coast", gc: "Gold Coast",
  // Perth
  perth: "Perth",
  // Adelaide
  adelaide: "Adelaide", adl: "Adelaide",
  // Canberra
  canberra: "Canberra", cbr: "Canberra",
  // Newcastle
  newcastle: "Newcastle",
  // Wollongong
  wollongong: "Wollongong",
  // Geelong
  geelong: "Geelong",
  // Hobart
  hobart: "Hobart",
}

function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const key = raw.toLowerCase().replace(/[^a-z]/g, "")
  if (CITY_ALIASES[key]) return CITY_ALIASES[key]
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase())
}

function getCityFromLead(lead: LeadWithRelations): string | null {
  if (lead.contacts?.suburb) return normalizeCity(lead.contacts.suburb)
  const raw = lead.raw as Record<string, unknown> | null
  if (raw) {
    for (const key of ["city", "suburb", "location", "City", "Suburb"]) {
      const val = raw[key]
      if (val && typeof val === "string" && val.trim()) return normalizeCity(val)
    }
  }
  return null
}

function getStateFromLead(lead: LeadWithRelations): string | null {
  if (lead.contacts?.state) return lead.contacts.state
  if (lead.players?.state) return lead.players.state
  const raw = lead.raw as Record<string, unknown> | null
  if (raw) {
    for (const key of ["state", "State", "province", "Province", "region"]) {
      const val = raw[key]
      if (val && typeof val === "string" && val.trim()) return val.trim()
    }
  }
  return null
}

function getLocationLabel(lead: LeadWithRelations): string | null {
  const city = getCityFromLead(lead)
  const state = getStateFromLead(lead)
  if (city && state) return `${city}, ${state}`
  return city ?? state ?? null
}

const FORM_TYPE_LABELS: Record<string, string> = {
  contact: "Contact Form",
  eoi: "Expression of Interest",
  newsletter: "Newsletter",
}

function formatFormType(ft: string): string {
  if (FORM_TYPE_LABELS[ft.toLowerCase()]) return FORM_TYPE_LABELS[ft.toLowerCase()]
  return ft.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

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

type Props = {
  leads: LeadWithRelations[]
  profiles: Tables<"profiles">[]
  emailTemplates?: EmailTemplateRow[]
  emailEvents?: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
}

export function LeadsShell({ leads: initialLeads, profiles, emailTemplates = [], emailEvents = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [view, setView] = useState<ViewMode>(() => {
    const v = searchParams.get("view")
    return v === "board" ? "board" : "table"
  })
  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")
  const [filterSource, setFilterSource] = useState(() => {
    const f = searchParams.get("form") ?? ""
    return f.includes("|||") ? (f.split("|||")[1] ?? "") : ""
  })
  const [filterStage, setFilterStage] = useState(() => searchParams.get("stage") ?? "")
  const [filterOwner, setFilterOwner] = useState(() => searchParams.get("owner") ?? "")
  const [filterFormType, setFilterFormType] = useState(() => {
    const f = searchParams.get("form") ?? ""
    return f.includes("|||") ? (f.split("|||")[0] ?? "") : ""
  })
  const [filterCity, setFilterCity] = useState(() => searchParams.get("city") ?? "")
  const [filterBirthYear, setFilterBirthYear] = useState(() => searchParams.get("year") ?? "")
  const [filterSquad, setFilterSquad] = useState(() => searchParams.get("squad") ?? "")
  const [filterState, setFilterState] = useState(() => searchParams.get("st") ?? "")
  const [filterLevel, setFilterLevel] = useState(() => searchParams.get("level") ?? "")
  const [filterCampaign, setFilterCampaign] = useState(() => searchParams.get("campaign") ?? "")
  const [filterHasPlayer, setFilterHasPlayer] = useState(() => searchParams.get("player") ?? "")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeDrag, setActiveDrag] = useState<LeadWithRelations | null>(null)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [bulkStageOpen, setBulkStageOpen] = useState(false)
  const [bulkOwnerOpen, setBulkOwnerOpen] = useState(false)
  const [bulkStage, setBulkStage] = useState<LeadStage>("contacted")
  const [bulkOwner, setBulkOwner] = useState("")
  const [saving, setSaving] = useState(false)
  const [addToEventLead, setAddToEventLead] = useState<{ id: string; name: string } | null>(null)
  const [bulkAddEventOpen, setBulkAddEventOpen] = useState(false)
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [bulkTagValue, setBulkTagValue] = useState("")
  const [activityLead, setActivityLead] = useState<{ id: string; contactId?: string; playerId?: string } | null>(null)
  const [rowChangeStageLead, setRowChangeStageLead] = useState<{ id: string } | null>(null)
  const [drawerLead, setDrawerLead] = useState<LeadWithRelations | null>(null)
  const [rowChangeStageValue, setRowChangeStageValue] = useState<LeadStage>("contacted")
  const [newForm, setNewForm] = useState({
    source: "manual" as LeadSource, form_type: "", stage: "new" as LeadStage, owner_id: "",
    contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "",
    player_first_name: "", player_last_name: "", player_birth_year: "", player_position: "", player_club: "", notes: "",
  })

  function updateURL(overrides: Partial<{
    q: string; stage: string; owner: string; city: string; form: string
    year: string; squad: string; st: string; level: string; campaign: string; player: string; view: string
  }>) {
    const cur = {
      q: search, stage: filterStage, owner: filterOwner, city: filterCity,
      form: filterFormType || filterSource ? `${filterFormType}|||${filterSource}` : "",
      year: filterBirthYear, squad: filterSquad, st: filterState,
      level: filterLevel, campaign: filterCampaign, player: filterHasPlayer,
      view: view,
    }
    const merged = { ...cur, ...overrides }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const availableBirthYears = useMemo(() =>
    [...new Set(leads.flatMap(l => l.players?.birth_year ? [l.players.birth_year] : []))].sort((a, b) => b - a),
    [leads]
  )
  const availableSquads = useMemo(() =>
    [...new Set(leads.flatMap(l => l.players?.squad ? [l.players.squad] : []))].sort(),
    [leads]
  )
  const availableStates = useMemo(() =>
    [...new Set(leads.flatMap(l => {
      const s: string[] = []
      if (l.contacts?.state) s.push(l.contacts.state)
      if (l.players?.state) s.push(l.players.state)
      return s
    }))].sort(),
    [leads]
  )
  const availableLevels = useMemo(() =>
    [...new Set(leads.flatMap(l => l.players?.level ? [l.players.level] : []))].sort(),
    [leads]
  )
  const availableCampaigns = useMemo(() =>
    [...new Set(leads.flatMap(l => l.campaign_name ? [l.campaign_name] : []))].sort(),
    [leads]
  )

  // Derived stats
  const now = Date.now()

  type FormCard = { key: string; formType: string; source: string; count: number; cities: [string, number][] }
  const formBreakdown = useMemo((): FormCard[] => {
    const map: Record<string, { formType: string; source: string; count: number; cities: Record<string, number> }> = {}
    for (const l of leads) {
      const ft = l.form_type ?? "unknown"
      const key = `${ft}|||${l.source}`
      if (!map[key]) map[key] = { formType: ft, source: l.source, count: 0, cities: {} }
      map[key].count++
      const city = getCityFromLead(l)
      if (city) map[key].cities[city] = (map[key].cities[city] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([key, v]) => ({ key, ...v, cities: Object.entries(v.cities).sort((a, b) => b[1] - a[1]) }))
      .sort((a, b) => b.count - a.count)
  }, [leads])

  const cityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) {
      const city = getCityFromLead(l)
      if (city) counts[city] = (counts[city] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [leads])

  // All filters EXCEPT stage
  const filteredBase = useMemo(() => {
    let result = leads
    if (search) {
      if (isPhoneQuery(search)) {
        const phoneKey = phoneSearchKey(search)
        result = result.filter((l) => {
          const digits = (l.contacts?.phone ?? "").replace(/\D/g, "")
          return phoneKey.length >= 7 && digits.includes(phoneKey)
        })
      } else {
        const words = search.toLowerCase().split(/\s+/).filter(Boolean)
        result = result.filter((l) => {
          const combined = [
            l.contacts?.first_name, l.contacts?.last_name, l.contacts?.email, l.contacts?.phone,
            l.players?.first_name, l.players?.last_name,
            l.campaign_name, l.form_type,
          ].filter(Boolean).join(" ").toLowerCase()
          return words.every((w) => combined.includes(w))
        })
      }
    }
    if (filterSource) result = result.filter((l) => l.source === filterSource)
    if (filterOwner) result = result.filter((l) => l.owner_id === filterOwner)
    if (filterFormType) result = result.filter((l) => (l.form_type ?? "unknown") === filterFormType)
    if (filterCity) result = result.filter((l) => getCityFromLead(l) === filterCity)
    if (filterBirthYear) result = result.filter((l) => l.players?.birth_year === parseInt(filterBirthYear))
    if (filterSquad) result = result.filter((l) => l.players?.squad === filterSquad)
    if (filterState) {
      const st = filterState.toLowerCase()
      result = result.filter((l) =>
        (l.contacts?.state ?? "").toLowerCase() === st ||
        (l.players?.state ?? "").toLowerCase() === st
      )
    }
    if (filterLevel) result = result.filter((l) => l.players?.level === filterLevel)
    if (filterCampaign) result = result.filter((l) => (l.campaign_name ?? "").toLowerCase().includes(filterCampaign.toLowerCase()))
    if (filterHasPlayer === "yes") result = result.filter((l) => l.player_id != null)
    if (filterHasPlayer === "no") result = result.filter((l) => l.player_id == null)
    return result
  }, [leads, search, filterSource, filterOwner, filterFormType, filterCity, filterBirthYear, filterSquad, filterState, filterLevel, filterCampaign, filterHasPlayer])

  // Stage counts from filteredBase (so they reflect other active filters)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of filteredBase) counts[l.stage] = (counts[l.stage] ?? 0) + 1
    return counts
  }, [filteredBase])

  // Final filtered = filteredBase + stage tab filter
  const filtered = useMemo(() => {
    if (!filterStage) return filteredBase
    return filteredBase.filter((l) => l.stage === filterStage)
  }, [filteredBase, filterStage])

  const boardLeads = useMemo(() => {
    const cols: Record<LeadStage, LeadWithRelations[]> = {
      new: [], contacted: [], interested: [], confirmed: [], signed: [], not_interested: [], lost: [],
    }
    for (const l of filtered) cols[l.stage].push(l)
    return cols
  }, [filtered])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

  async function handleBulkTag() {
    if (!bulkTagValue.trim()) return
    const result = await bulkAddTagToLeads(Array.from(selected), bulkTagValue.trim())
    if (result.error) { toast.error(result.error) } else {
      toast.success(`Tag added to ${selected.size} leads`)
      setBulkTagOpen(false); setBulkTagValue(""); setSelected(new Set()); router.refresh()
    }
  }

  async function handleRowArchive(lead: LeadWithRelations) {
    if (!confirm(`Archive lead for ${lead.contacts?.first_name ?? "this contact"}?`)) return
    const result = await archiveLead(lead.id)
    if (result.error) toast.error(result.error)
    else { toast.success("Lead archived"); router.refresh() }
  }

  async function handleRowChangeStage() {
    if (!rowChangeStageLead) return
    const result = await updateLeadStage(rowChangeStageLead.id, rowChangeStageValue)
    if (result.error) toast.error(result.error)
    else { toast.success("Stage updated"); setRowChangeStageLead(null); router.refresh() }
  }

  function waLink(phone: string | null | undefined): string | null {
    if (!phone) return null
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 8) return null
    const e164 = digits.startsWith("0") ? `61${digits.slice(1)}` : digits
    return `https://wa.me/${e164}`
  }

  function exportSelected() {
    const toExport = selected.size > 0
      ? leads.filter((l) => selected.has(l.id))
      : filtered
    const csv = Papa.unparse(toExport.map((l) => ({
      contact_name: `${l.contacts?.first_name ?? ""} ${l.contacts?.last_name ?? ""}`.trim(),
      contact_email: l.contacts?.email ?? "", contact_phone: l.contacts?.phone ?? "",
      city: getCityFromLead(l) ?? "",
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

  function bulkContactIds(): string[] {
    return leads.filter((l) => selected.has(l.id) && l.contact_id).map((l) => l.contact_id!)
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

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <span className="text-sm text-gray-400">{leads.length.toLocaleString()} total</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => { setView("board"); updateURL({ view: "board" }) }} className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors", view === "board" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button onClick={() => { setView("table"); updateURL({ view: "table" }) }} className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors", view === "table" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
              <List className="h-3.5 w-3.5" /> Table
            </button>
          </div>
          <Button onClick={() => setNewDialogOpen(true)} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
            <Plus className="h-4 w-4 mr-1.5" /> New lead
          </Button>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 flex-wrap">
        {[{ key: "", label: "All", count: filteredBase.length }, ...STAGES.map(s => ({ key: s, label: STAGE_LABELS[s], count: stageCounts[s] ?? 0 }))].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setFilterStage(key); setPage(1); updateURL({ stage: key }) }}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
              filterStage === key
                ? "bg-[#0C0F4C] text-white"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {label}
            <span className={cn("text-xs rounded-full px-1.5 py-0.5 font-medium", filterStage === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── TABLE / BOARD views ── */}
        <div className="px-6 py-4 space-y-4">
          {/* Filter bar */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); updateURL({ q: e.target.value }) }} placeholder="Search leads..." className="pl-9" />
              </div>
              {formBreakdown.length > 1 && (
                <select
                  value={`${filterFormType}|||${filterSource}`}
                  onChange={(e) => {
                    const [ft, src] = e.target.value.split("|||")
                    const newFt = ft === "" ? "" : ft
                    const newSrc = src === "" ? "" : src
                    setFilterFormType(newFt); setFilterSource(newSrc); setPage(1)
                    updateURL({ form: newFt || newSrc ? `${newFt}|||${newSrc}` : "" })
                  }}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                >
                  <option value="|||">All forms</option>
                  {formBreakdown.map(({ key, formType, source }) => (
                    <option key={key} value={key}>
                      {formType === "unknown" ? "No form type" : formatFormType(formType)} — {SOURCE_LABELS[source] ?? source}
                    </option>
                  ))}
                </select>
              )}
              <select value={filterStage} onChange={(e) => { setFilterStage(e.target.value); setPage(1); updateURL({ stage: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="">All stages</option>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <select value={filterOwner} onChange={(e) => { setFilterOwner(e.target.value); setPage(1); updateURL({ owner: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="">All owners</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              {cityBreakdown.length > 1 && (
                <select value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setPage(1); updateURL({ city: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All cities</option>
                  {cityBreakdown.map(([city]) => <option key={city} value={city}>{city}</option>)}
                </select>
              )}
              {availableBirthYears.length > 0 && (
                <select value={filterBirthYear} onChange={(e) => { setFilterBirthYear(e.target.value); setPage(1); updateURL({ year: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All years</option>
                  {availableBirthYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              )}
              {availableSquads.length > 0 && (
                <select value={filterSquad} onChange={(e) => { setFilterSquad(e.target.value); setPage(1); updateURL({ squad: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All squads</option>
                  {availableSquads.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {availableStates.length > 1 && (
                <select value={filterState} onChange={(e) => { setFilterState(e.target.value); setPage(1); updateURL({ st: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All states</option>
                  {availableStates.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {availableLevels.length > 0 && (
                <select value={filterLevel} onChange={(e) => { setFilterLevel(e.target.value); setPage(1); updateURL({ level: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All levels</option>
                  {availableLevels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
              {availableCampaigns.length > 0 && (
                <select value={filterCampaign} onChange={(e) => { setFilterCampaign(e.target.value); setPage(1); updateURL({ campaign: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                  <option value="">All campaigns</option>
                  {availableCampaigns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <select value={filterHasPlayer} onChange={(e) => { setFilterHasPlayer(e.target.value); setPage(1); updateURL({ player: e.target.value }) }} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="">Any player</option>
                <option value="yes">Has player</option>
                <option value="no">No player</option>
              </select>
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
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-blue-50 px-4 py-2">
                    <span className="text-sm font-medium">{selected.size} selected</span>
                    <Button size="sm" variant="outline" onClick={() => setBulkStageOpen(true)}>Change stage</Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkOwnerOpen(true)}>
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Assign owner
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkAddEventOpen(true)}>
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Add to event
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkEmailOpen(true)}>
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Send email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkTagOpen(true)}>
                      <Tag className="h-3.5 w-3.5 mr-1.5" /> Add tag
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkArchive} className="text-red-600 hover:text-red-700">
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportSelected} className="ml-auto">
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Export selected
                    </Button>
                    <Link href="/leads/import"><Button size="sm" variant="outline"><Upload className="h-3.5 w-3.5 mr-1.5" /> Import</Button></Link>
                  </div>
                )}
                {/* Select all filtered banner */}
                {selected.size > 0 && selected.size === paginated.length && selected.size < filtered.length && (
                  <div className="text-center text-sm text-gray-600 bg-blue-50 rounded-lg py-2 px-4">
                    All {paginated.length} on this page selected.{" "}
                    <button
                      className="text-[#0C0F4C] font-medium hover:underline"
                      onClick={() => setSelected(new Set(filtered.map((l) => l.id)))}
                    >
                      Select all {filtered.length} leads matching this filter
                    </button>
                  </div>
                )}
                {selected.size === 0 && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={exportSelected}><Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV</Button>
                    <Link href="/leads/import"><Button size="sm" variant="outline"><Upload className="h-3.5 w-3.5 mr-1.5" /> Import</Button></Link>
                  </div>
                )}

                <div className="rounded-lg border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="w-8 px-3 py-3">
                          <input type="checkbox"
                            checked={paginated.length > 0 && paginated.every((l) => selected.has(l.id))}
                            onChange={() => {
                              const pageIds = paginated.map((l) => l.id)
                              const allPageSelected = pageIds.every((id) => selected.has(id))
                              setSelected((prev) => {
                                const next = new Set(prev)
                                if (allPageSelected) pageIds.forEach((id) => next.delete(id))
                                else pageIds.forEach((id) => next.add(id))
                                return next
                              })
                            }}
                            className="rounded" />
                        </th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Contact</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Player</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Location</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Source</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">Stage</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden xl:table-cell">Owner</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide hidden xl:table-cell">Submitted</th>
                        <th className="w-10 px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginated.length === 0 ? (
                        <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No leads found</td></tr>
                      ) : (
                        paginated.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDrawerLead(lead)}>
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selected.has(lead.id)}
                                onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(lead.id) ? n.delete(lead.id) : n.add(lead.id); return n })}
                                className="rounded" onClick={(e) => e.stopPropagation()} />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-[#0C0F4C]">
                                {lead.contacts?.first_name} {lead.contacts?.last_name}
                              </p>
                              {lead.contacts?.phone && <p className="text-xs text-gray-400">{lead.contacts.phone}</p>}
                            </td>
                            <td className="px-3 py-3 text-gray-600 hidden md:table-cell">
                              {lead.players ? (
                                <span className="text-sm">
                                  {lead.players.first_name} {lead.players.last_name}
                                  {lead.players.birth_year && <span className="text-gray-400"> ({lead.players.birth_year})</span>}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                              {(lead.event_participants?.length ?? 0) > 0 && (
                                <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                  <CalendarCheck className="h-3 w-3" />
                                  {(lead.event_participants as { event_id: string; events: { title: string } | null }[])[0]?.events?.title}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              {getLocationLabel(lead) ? (
                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                                  {getLocationLabel(lead)}
                                </span>
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
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <RowMenu items={[
                                { label: "Open", icon: <ExternalLink className="h-4 w-4" />, onClick: () => router.push(`/leads/${lead.id}`) },
                                { label: "Change stage", icon: <CheckSquare className="h-4 w-4" />, onClick: () => { setRowChangeStageLead({ id: lead.id }); setRowChangeStageValue(lead.stage) } },
                                { label: "Add to event", icon: <CalendarPlus className="h-4 w-4" />, onClick: () => setAddToEventLead({ id: lead.id, name: `${lead.contacts?.first_name ?? ""} ${lead.contacts?.last_name ?? ""}`.trim() }) },
                                { label: "Log call", icon: <Phone className="h-4 w-4" />, onClick: () => setActivityLead({ id: lead.id, contactId: lead.contact_id ?? undefined, playerId: lead.player_id ?? undefined }) },
                                { label: "Log SMS", icon: <MessageSquare className="h-4 w-4" />, onClick: () => setActivityLead({ id: lead.id, contactId: lead.contact_id ?? undefined, playerId: lead.player_id ?? undefined }) },
                                { label: "Add note", icon: <StickyNote className="h-4 w-4" />, onClick: () => setActivityLead({ id: lead.id, contactId: lead.contact_id ?? undefined, playerId: lead.player_id ?? undefined }) },
                                { label: "WhatsApp parent", icon: <MessageCircle className="h-4 w-4" />, onClick: () => { const url = waLink(lead.contacts?.phone); if (url) window.open(url, "_blank"); else toast.error("No phone number on file") }, hidden: !lead.contact_id },
                                { label: "View player", icon: <User className="h-4 w-4" />, onClick: () => router.push(`/players/${lead.player_id}`), hidden: !lead.player_id },
                                { label: "View parent", icon: <Users className="h-4 w-4" />, onClick: () => router.push(`/contacts/${lead.contact_id}`), hidden: !lead.contact_id },
                                { label: "Archive", icon: <Archive className="h-4 w-4" />, onClick: () => handleRowArchive(lead), variant: "danger" },
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
              </>
            )}
          </div>
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

      <AddToEventDialog
        leadId={addToEventLead?.id ?? ""}
        leadName={addToEventLead?.name ?? ""}
        open={addToEventLead !== null}
        onClose={() => setAddToEventLead(null)}
        onSuccess={(title) => { toast.success(`Added to ${title}`); setAddToEventLead(null); router.refresh() }}
      />

      {/* Bulk: add to event — uses first selected lead's dialog for now; opens multi-select */}
      {bulkAddEventOpen && selected.size > 0 && (
        <AddToEventDialog
          leadId={Array.from(selected)[0]}
          leadName={`${selected.size} leads`}
          open={bulkAddEventOpen}
          onClose={() => setBulkAddEventOpen(false)}
          onSuccess={(title) => { toast.success(`Added ${selected.size} leads to ${title}`); setBulkAddEventOpen(false); setSelected(new Set()); router.refresh() }}
          bulkLeadIds={Array.from(selected)}
        />
      )}

      {bulkEmailOpen && (
        <CampaignComposer
          open={bulkEmailOpen}
          onClose={() => setBulkEmailOpen(false)}
          templates={emailTemplates}
          events={emailEvents}
          prefilledContactIds={bulkContactIds()}
        />
      )}

      <Dialog open={bulkTagOpen} onOpenChange={(o) => { if (!o) setBulkTagOpen(false) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add tag to {selected.size} leads</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Tag</Label>
            <Input value={bulkTagValue} onChange={(e) => setBulkTagValue(e.target.value)} placeholder="e.g. VIP, trial-2026" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBulkTag() } }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkTag} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Add tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddActivityDialog
        open={activityLead !== null}
        onClose={() => setActivityLead(null)}
        onSave={() => { setActivityLead(null); router.refresh() }}
        leadId={activityLead?.id}
        contactId={activityLead?.contactId}
        playerId={activityLead?.playerId}
      />

      <Dialog open={rowChangeStageLead !== null} onOpenChange={(o) => { if (!o) setRowChangeStageLead(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change stage</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>New stage</Label>
            <select value={rowChangeStageValue} onChange={(e) => setRowChangeStageValue(e.target.value as LeadStage)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]">
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowChangeStageLead(null)}>Cancel</Button>
            <Button onClick={handleRowChangeStage} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadDrawer
        lead={drawerLead}
        onClose={() => setDrawerLead(null)}
        onUpdate={() => router.refresh()}
      />
    </div>
  )
}
