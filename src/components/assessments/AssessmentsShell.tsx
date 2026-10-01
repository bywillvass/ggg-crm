"use client"

import { useState, useMemo, useRef } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Trash2, Edit2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "cn"
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  searchPlayersForAssessment,
  type AssessmentRow,
  type AssessmentInput,
  type EventSelectItem,
  type PlayerSearchResult,
} from "@/app/(app)/assessments/actions"
import type { Database } from "@/lib/database.types"

type AssessmentRec = Database["public"]["Enums"]["assessment_recommendation"]

const RECOMMENDATIONS: { value: AssessmentRec; label: string }[] = [
  { value: "select", label: "Select" },
  { value: "monitor", label: "Monitor" },
  { value: "not_yet", label: "Not yet" },
]

function recVariant(rec: AssessmentRec | null): "success" | "warning" | "destructive" | "secondary" {
  if (rec === "select") return "success"
  if (rec === "monitor") return "warning"
  if (rec === "not_yet") return "destructive"
  return "secondary"
}

function recLabel(rec: AssessmentRec | null): string {
  if (rec === "select") return "Select"
  if (rec === "monitor") return "Monitor"
  if (rec === "not_yet") return "Not yet"
  return "-"
}

type FormState = {
  player_id: string
  player_name: string
  event_id: string
  position_played: string
  technical: string
  tactical: string
  physical: string
  mental: string
  overall: string
  strengths: string
  improvements: string
  notes: string
  recommendation: AssessmentRec | ""
}

const EMPTY_FORM: FormState = {
  player_id: "",
  player_name: "",
  event_id: "",
  position_played: "",
  technical: "",
  tactical: "",
  physical: "",
  mental: "",
  overall: "",
  strengths: "",
  improvements: "",
  notes: "",
  recommendation: "",
}

function formFromAssessment(a: AssessmentRow): FormState {
  return {
    player_id: a.player_id,
    player_name: a.players
      ? `${a.players.first_name ?? ""} ${a.players.last_name ?? ""}`.trim()
      : "",
    event_id: a.event_id,
    position_played: a.position_played ?? "",
    technical: a.technical?.toString() ?? "",
    tactical: a.tactical?.toString() ?? "",
    physical: a.physical?.toString() ?? "",
    mental: a.mental?.toString() ?? "",
    overall: a.overall?.toString() ?? "",
    strengths: a.strengths ?? "",
    improvements: a.improvements ?? "",
    notes: a.notes ?? "",
    recommendation: a.recommendation ?? "",
  }
}

function parseScore(val: string): number | null {
  const n = parseInt(val)
  if (isNaN(n)) return null
  return Math.max(1, Math.min(10, n))
}

function formToInput(form: FormState): AssessmentInput {
  return {
    player_id: form.player_id,
    event_id: form.event_id,
    position_played: form.position_played || null,
    technical: parseScore(form.technical),
    tactical: parseScore(form.tactical),
    physical: parseScore(form.physical),
    mental: parseScore(form.mental),
    overall: parseScore(form.overall),
    strengths: form.strengths || null,
    improvements: form.improvements || null,
    notes: form.notes || null,
    recommendation: (form.recommendation as AssessmentRec) || null,
  }
}

// ─── Assessment form dialog ───────────────────────────────────────────────────

function AssessmentFormInner({
  open,
  onOpenChange,
  events,
  editingAssessment,
  initialForm,
  initialPlayerSearch,
  playerLocked = false,
  eventLocked = false,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  events: EventSelectItem[]
  editingAssessment?: AssessmentRow | null
  initialForm: FormState
  initialPlayerSearch: string
  playerLocked?: boolean
  eventLocked?: boolean
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [saving, setSaving] = useState(false)
  const [playerSearch, setPlayerSearch] = useState(initialPlayerSearch)
  const [playerResults, setPlayerResults] = useState<PlayerSearchResult[]>([])
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handlePlayerSearchChange(val: string) {
    setPlayerSearch(val)
    setForm((f) => ({ ...f, player_id: "", player_name: val }))
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (val.length < 2) {
      setPlayerResults([])
      setShowPlayerDropdown(false)
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchPlayersForAssessment(val)
      setPlayerResults(results)
      setShowPlayerDropdown(true)
    }, 300)
  }

  function selectPlayer(p: PlayerSearchResult) {
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
    setForm((f) => ({ ...f, player_id: p.id, player_name: name }))
    setPlayerSearch(name)
    setShowPlayerDropdown(false)
  }

  function setF(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }
  }

  async function handleSave() {
    if (!form.player_id) return toast.error("Select a player")
    if (!form.event_id) return toast.error("Select an event")
    setSaving(true)

    const input = formToInput(form)

    if (editingAssessment) {
      const { error } = await updateAssessment(editingAssessment.id, input)
      if (error) {
        toast.error(error)
      } else {
        toast.success("Assessment updated")
        onSaved()
        onOpenChange(false)
      }
    } else {
      const { data, error } = await createAssessment(input)
      if (error) {
        toast.error(error)
      } else if (data) {
        toast.success("Assessment saved")
        onSaved()
        onOpenChange(false)
      }
    }
    setSaving(false)
  }

  const isPlayerLocked = playerLocked
  const isEventLocked = eventLocked

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAssessment ? "Edit assessment" : "New assessment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Player search */}
          <div className="space-y-1.5 relative">
            <Label>Player *</Label>
            {isPlayerLocked ? (
              <Input value={playerSearch} disabled />
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    value={playerSearch}
                    onChange={(e) => handlePlayerSearchChange(e.target.value)}
                    placeholder="Search by name..."
                    className="pl-9"
                    onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 150)}
                  />
                </div>
                {showPlayerDropdown && playerResults.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {playerResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        onMouseDown={() => selectPlayer(p)}
                      >
                        <span className="font-medium">{p.first_name} {p.last_name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.birth_year ?? "?"} · {p.position ?? "No position"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {form.player_id && !isPlayerLocked && (
              <p className="text-xs text-green-600">Player selected</p>
            )}
          </div>

          {/* Event */}
          <div className="space-y-1.5">
            <Label>Event *</Label>
            {isEventLocked ? (
              <Input value={events.find((e) => e.id === form.event_id)?.title ?? form.event_id} disabled />
            ) : (
              <Select value={form.event_id} onChange={setF("event_id")}>
                <option value="">Select event...</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} {e.start_at ? `(${format(new Date(e.start_at), "d MMM yyyy")})` : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Position played */}
          <div className="space-y-1.5">
            <Label>Position played</Label>
            <Input
              value={form.position_played}
              onChange={setF("position_played")}
              placeholder="e.g. Striker"
            />
          </div>

          {/* Scores */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scores (1–10)</div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {(["technical", "tactical", "physical", "mental", "overall"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs capitalize">{field}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={form[field]}
                    onChange={setF(field)}
                    placeholder="-"
                    className="text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="space-y-1.5">
            <Label>Recommendation</Label>
            <Select value={form.recommendation} onChange={setF("recommendation")}>
              <option value="">None</option>
              {RECOMMENDATIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>

          {/* Text fields */}
          <div className="space-y-1.5">
            <Label>Strengths</Label>
            <Textarea
              value={form.strengths}
              onChange={setF("strengths")}
              rows={2}
              placeholder="Key strengths observed..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Areas for improvement</Label>
            <Textarea
              value={form.improvements}
              onChange={setF("improvements")}
              rows={2}
              placeholder="Areas to work on..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={setF("notes")}
              rows={2}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            {saving ? "Saving..." : editingAssessment ? "Update" : "Save assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Wrapper that computes initial state and uses key to reset inner form
function AssessmentFormDialog({
  open,
  onOpenChange,
  events,
  editingAssessment,
  prefillPlayerId,
  prefillPlayerName,
  prefillEventId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  events: EventSelectItem[]
  editingAssessment?: AssessmentRow | null
  prefillPlayerId?: string
  prefillPlayerName?: string
  prefillEventId?: string
  onSaved: () => void
}) {
  const initialForm = editingAssessment
    ? formFromAssessment(editingAssessment)
    : { ...EMPTY_FORM, player_id: prefillPlayerId ?? "", player_name: prefillPlayerName ?? "", event_id: prefillEventId ?? "" }
  const initialPlayerSearch = editingAssessment
    ? (editingAssessment.players ? `${editingAssessment.players.first_name ?? ""} ${editingAssessment.players.last_name ?? ""}`.trim() : "")
    : (prefillPlayerName ?? "")
  const formKey = editingAssessment?.id ?? `new-${prefillPlayerId ?? ""}-${open}`

  return (
    <AssessmentFormInner
      key={formKey}
      open={open}
      onOpenChange={onOpenChange}
      events={events}
      editingAssessment={editingAssessment}
      initialForm={initialForm}
      initialPlayerSearch={initialPlayerSearch}
      playerLocked={!!prefillPlayerId && !editingAssessment}
      eventLocked={!!prefillEventId && !editingAssessment}
      onSaved={onSaved}
    />
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function AssessmentsShell({
  initialAssessments,
  events,
  currentUserId,
}: {
  initialAssessments: AssessmentRow[]
  events: EventSelectItem[]
  currentUserId: string
}) {
  const [assessments, setAssessments] = useState(initialAssessments)
  const [activeTab, setActiveTab] = useState<"all" | "mine">("all")
  const [filterEventId, setFilterEventId] = useState("")
  const [filterBirthYear, setFilterBirthYear] = useState("")
  const [filterRecommendation, setFilterRecommendation] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<AssessmentRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    let list = assessments

    if (activeTab === "mine") {
      list = list.filter((a) => a.assessor_id === currentUserId)
    }

    if (filterEventId) {
      list = list.filter((a) => a.event_id === filterEventId)
    }

    if (filterBirthYear) {
      const year = parseInt(filterBirthYear)
      if (!isNaN(year)) {
        list = list.filter((a) => a.players?.birth_year === year)
      }
    }

    if (filterRecommendation) {
      list = list.filter((a) => a.recommendation === filterRecommendation)
    }

    return list
  }, [assessments, activeTab, filterEventId, filterBirthYear, filterRecommendation, currentUserId])

  function handleSaved() {
    window.location.reload()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await deleteAssessment(deleteId)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Assessment deleted")
      setAssessments((prev) => prev.filter((a) => a.id !== deleteId))
    }
    setDeleteId(null)
    setDeleting(false)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0C0F4C]">Assessments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Player assessments across all events</p>
        </div>
        <Button
          onClick={() => { setEditingAssessment(null); setShowForm(true) }}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New assessment
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["all", "mine"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-[#C9A227] text-[#C9A227]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === "all" ? "All assessments" : "My assessments"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterEventId}
          onChange={(e) => setFilterEventId(e.target.value)}
          className="w-56"
        >
          <option value="">All events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </Select>

        <Input
          type="number"
          placeholder="Birth year..."
          value={filterBirthYear}
          onChange={(e) => setFilterBirthYear(e.target.value)}
          className="w-32"
        />

        <Select
          value={filterRecommendation}
          onChange={(e) => setFilterRecommendation(e.target.value)}
          className="w-40"
        >
          <option value="">All recommendations</option>
          {RECOMMENDATIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>

        {(filterEventId || filterBirthYear || filterRecommendation) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setFilterEventId(""); setFilterBirthYear(""); setFilterRecommendation("") }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No assessments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Player</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Birth yr</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Event</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">Position</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">O</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden xl:table-cell">T</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden xl:table-cell">Ta</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden xl:table-cell">P</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden xl:table-cell">M</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rec</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.players ? `${a.players.first_name ?? ""} ${a.players.last_name ?? ""}`.trim() : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{a.players?.birth_year ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-36 truncate">
                      {a.events?.title ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {format(new Date(a.created_at), "d MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {a.position_played ?? a.players?.position ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">
                      {a.overall ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden xl:table-cell">{a.technical ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden xl:table-cell">{a.tactical ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden xl:table-cell">{a.physical ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden xl:table-cell">{a.mental ?? "-"}</td>
                    <td className="px-4 py-3">
                      {a.recommendation ? (
                        <Badge variant={recVariant(a.recommendation)}>{recLabel(a.recommendation)}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingAssessment(a); setShowForm(true) }}
                          className="p-1.5 text-gray-400 hover:text-[#0C0F4C] transition-colors rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              {filtered.length} assessment{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Assessment form dialog */}
      <AssessmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        events={events}
        editingAssessment={editingAssessment}
        onSaved={handleSaved}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete assessment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This will permanently delete this assessment. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
