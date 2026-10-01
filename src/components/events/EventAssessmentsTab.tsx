"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, CheckSquare, Square, ChevronUp, ChevronDown, Search } from "lucide-react"
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
  getEventComparison,
  bulkAddToEvent,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  listEventsForSelect,
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

type SortKey = "player" | "overall" | "technical" | "tactical" | "physical" | "mental"
type SortDir = "asc" | "desc"

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-gray-300 inline ml-0.5" />
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-[#C9A227] inline ml-0.5" />
    : <ChevronDown className="w-3 h-3 text-[#C9A227] inline ml-0.5" />
}

function sortValue(a: AssessmentRow, key: SortKey): string | number {
  switch (key) {
    case "player":
      return `${a.players?.last_name ?? ""}${a.players?.first_name ?? ""}`.toLowerCase()
    case "overall": return a.overall ?? -1
    case "technical": return a.technical ?? -1
    case "tactical": return a.tactical ?? -1
    case "physical": return a.physical ?? -1
    case "mental": return a.mental ?? -1
  }
}

type FormState = {
  player_id: string
  player_name: string
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

export function EventAssessmentsTab({
  eventId,
  role,
}: {
  eventId: string
  role: string
}) {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("overall")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // Checkboxes for bulk add
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Assessment form dialog
  const [showForm, setShowForm] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<AssessmentRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [playerSearch, setPlayerSearch] = useState("")
  const [playerResults, setPlayerResults] = useState<PlayerSearchResult[]>([])
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Bulk add to event dialog
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [targetEvents, setTargetEvents] = useState<EventSelectItem[]>([])
  const [targetEventId, setTargetEventId] = useState("")
  const [bulkAdding, setBulkAdding] = useState(false)

  const fetchRef = useRef(false)

  const loadAssessments = useCallback(async () => {
    setLoading(true)
    const data = await getEventComparison(eventId)
    setAssessments(data)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    if (fetchRef.current) return
    fetchRef.current = true
    loadAssessments()
  }, [loadAssessments])

  // Sorted assessments
  const sorted = [...assessments].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    const dir = sortDir === "asc" ? 1 : -1
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  // Selection
  function toggle(playerId: string) {
    const next = new Set(selected)
    if (next.has(playerId)) next.delete(playerId)
    else next.add(playerId)
    setSelected(next)
  }

  function toggleAll() {
    const allIds = sorted.map((a) => a.player_id)
    if (selected.size === allIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  // Player search in form
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

  function openNewForm() {
    setEditingAssessment(null)
    setForm(EMPTY_FORM)
    setPlayerSearch("")
    setPlayerResults([])
    setShowForm(true)
  }

  function openEditForm(a: AssessmentRow) {
    setEditingAssessment(a)
    setForm(formFromAssessment(a))
    setPlayerSearch(
      a.players ? `${a.players.first_name ?? ""} ${a.players.last_name ?? ""}`.trim() : ""
    )
    setShowForm(true)
  }

  function setF(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }
  }

  async function handleSave() {
    if (!form.player_id) return toast.error("Select a player")
    setSaving(true)

    const input: AssessmentInput = {
      player_id: form.player_id,
      event_id: eventId,
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

    if (editingAssessment) {
      const { error } = await updateAssessment(editingAssessment.id, input)
      if (error) {
        toast.error(error)
      } else {
        toast.success("Assessment updated")
        setShowForm(false)
        await loadAssessments()
      }
    } else {
      const { data, error } = await createAssessment(input)
      if (error) {
        toast.error(error)
      } else if (data) {
        toast.success("Assessment saved")
        setShowForm(false)
        await loadAssessments()
      }
    }
    setSaving(false)
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
      setSelected((prev) => {
        const next = new Set(prev)
        // find player_id for this assessment
        const a = assessments.find((x) => x.id === deleteId)
        if (a) next.delete(a.player_id)
        return next
      })
    }
    setDeleteId(null)
    setDeleting(false)
  }

  async function openBulkAdd() {
    const events = await listEventsForSelect()
    setTargetEvents(events.filter((e) => e.id !== eventId))
    setTargetEventId("")
    setShowBulkAdd(true)
  }

  async function handleBulkAdd() {
    if (!targetEventId) return toast.error("Select a target event")
    const playerIds = Array.from(selected)
    setBulkAdding(true)
    const { added, skipped } = await bulkAddToEvent(playerIds, targetEventId)
    toast.success(`Added ${added} player${added !== 1 ? "s" : ""} to event${skipped > 0 ? ` (${skipped} skipped - already in event)` : ""}`)
    setShowBulkAdd(false)
    setSelected(new Set())
    setBulkAdding(false)
  }

  const selectedPlayers = sorted.filter((a) => selected.has(a.player_id))
  const allSelected = sorted.length > 0 && selected.size === sorted.length

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">Loading assessments...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={openNewForm}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add assessment
        </Button>

        {selected.size > 0 && role === "admin" && (
          <Button variant="outline" onClick={openBulkAdd}>
            Add {selected.size} selected to event
          </Button>
        )}
      </div>

      {/* Table */}
      {assessments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No assessments for this event yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {role === "admin" && (
                    <th className="w-10 px-3 py-3">
                      <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                        {allSelected
                          ? <CheckSquare className="w-4 h-4 text-[#0C0F4C]" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>
                    </th>
                  )}
                  <th
                    className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("player")}
                  >
                    Player <SortIcon col="player" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Birth yr</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Position</th>
                  <th
                    className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("technical")}
                  >
                    Tech <SortIcon col="technical" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("tactical")}
                  >
                    Tac <SortIcon col="tactical" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("physical")}
                  >
                    Phy <SortIcon col="physical" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("mental")}
                  >
                    Men <SortIcon col="mental" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("overall")}
                  >
                    Overall <SortIcon col="overall" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rec</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((a) => (
                  <tr
                    key={a.id}
                    className={cn(
                      "hover:bg-gray-50 transition-colors",
                      selected.has(a.player_id) && "bg-blue-50"
                    )}
                  >
                    {role === "admin" && (
                      <td className="px-3 py-3">
                        <button onClick={() => toggle(a.player_id)} className="text-gray-400 hover:text-gray-600">
                          {selected.has(a.player_id)
                            ? <CheckSquare className="w-4 h-4 text-[#0C0F4C]" />
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.players ? `${a.players.first_name ?? ""} ${a.players.last_name ?? ""}`.trim() : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{a.players?.birth_year ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {a.position_played ?? a.players?.position ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{a.technical ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{a.tactical ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{a.physical ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{a.mental ?? "-"}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{a.overall ?? "-"}</td>
                    <td className="px-4 py-3">
                      {a.recommendation ? (
                        <Badge variant={recVariant(a.recommendation)}>{recLabel(a.recommendation)}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditForm(a)}
                          className="text-xs text-[#0C0F4C] hover:underline"
                        >
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              {assessments.length} assessment{assessments.length !== 1 ? "s" : ""}
              {selected.size > 0 && ` · ${selected.size} selected`}
            </div>
          </div>
        </div>
      )}

      {/* Assessment form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAssessment ? "Edit assessment" : "Add assessment"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Player search */}
            <div className="space-y-1.5 relative">
              <Label>Player *</Label>
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
              {form.player_id && (
                <p className="text-xs text-green-600">Player selected</p>
              )}
            </div>

            {/* Position played */}
            <div className="space-y-1.5">
              <Label>Position played</Label>
              <Input value={form.position_played} onChange={setF("position_played")} placeholder="e.g. Striker" />
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
              <Textarea value={form.strengths} onChange={setF("strengths")} rows={2} placeholder="Key strengths..." />
            </div>
            <div className="space-y-1.5">
              <Label>Areas for improvement</Label>
              <Textarea value={form.improvements} onChange={setF("improvements")} rows={2} placeholder="Areas to work on..." />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={setF("notes")} rows={2} placeholder="Additional notes..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete assessment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This will permanently delete this assessment.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add to event dialog */}
      {role === "admin" && (
        <Dialog open={showBulkAdd} onOpenChange={setShowBulkAdd}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add {selected.size} player{selected.size !== 1 ? "s" : ""} to event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Selected players ({selectedPlayers.length}):
                </p>
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                  {selectedPlayers.map((a) => (
                    <div key={a.player_id} className="text-sm text-gray-700 flex items-center gap-2">
                      <span>{a.players ? `${a.players.first_name ?? ""} ${a.players.last_name ?? ""}`.trim() : "Unknown"}</span>
                      {a.recommendation && (
                        <Badge variant={recVariant(a.recommendation)} className="text-xs">{recLabel(a.recommendation)}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Target event *</Label>
                <Select value={targetEventId} onChange={(e) => setTargetEventId(e.target.value)}>
                  <option value="">Select event...</option>
                  {targetEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} {e.start_at ? `(${format(new Date(e.start_at), "d MMM yyyy")})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-gray-400">Players already in the target event will be skipped.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAdd(false)}>Cancel</Button>
              <Button
                onClick={handleBulkAdd}
                disabled={bulkAdding || !targetEventId}
                className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
              >
                {bulkAdding ? "Adding..." : "Add to event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
