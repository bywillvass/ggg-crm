"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Phone, MessageCircle, Mail, StickyNote, Archive, Check, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import { AddTaskDialog } from "@/components/shared/AddTaskDialog"
import { TaskList } from "@/components/shared/TaskList"
import {
  updateLead,
  updateLeadStage,
  archiveLead,
  createAndLinkPlayer,
  type LeadDetail as LeadDetailType,
} from "@/app/(app)/leads/actions"
import { completeTask, deleteTask } from "@/app/(app)/tasks/actions"
import type { Database, Json } from "@/lib/database.types"
import { cn } from "cn"

type LeadStage = Database["public"]["Enums"]["lead_stage"]

const STAGES: LeadStage[] = ["new", "contacted", "interested", "confirmed", "signed", "not_interested", "lost"]

// Mirror of ingest BUILTIN player keys — used to detect player data in raw
const PLAYER_FULL_KEYS = new Set(["playername","playersname","playerfullname","playersfullname","childname","childsname","childfullname","childsfullname","kidname","kidsname","kidfullname","kidsfullname","athletename","athletefullname"])
const PLAYER_FIRST_KEYS = new Set(["playerfirstname","playersfirstname","playerfirst","childfirstname","childsfirstname","kidfirstname","athletefirstname"])
const PLAYER_LAST_KEYS = new Set(["playerlastname","playerslastname","playerlast","childlastname","childslastname","kidlastname","athletelastname"])
const PLAYER_BIRTH_KEYS = new Set(["birthyear","yearofbirth","playerbirthyear","playersbirthyear"])
const PLAYER_CLUB_KEYS = new Set(["club","currentclub","playerclub","team","currentteam","playerteam"])

function nkDetect(k: string) { return k.toLowerCase().replace(/[^a-z0-9]/g, "") }

function detectPlayerFromRaw(raw: Record<string, unknown> | null) {
  if (!raw) return null
  let firstName: string | null = null
  let lastName: string | null = null
  let birthYear: number | null = null
  let club: string | null = null

  for (const [k, v] of Object.entries(raw)) {
    const nk = nkDetect(k)
    const val = v ? String(v).trim() : ""
    if (!val) continue
    if (PLAYER_FULL_KEYS.has(nk) && !firstName) {
      const parts = val.split(/\s+/)
      firstName = parts[0] ?? null
      lastName = parts.slice(1).join(" ") || null
    }
    if (PLAYER_FIRST_KEYS.has(nk) && !firstName) firstName = val
    if (PLAYER_LAST_KEYS.has(nk) && !lastName) lastName = val
    if (PLAYER_BIRTH_KEYS.has(nk) && !birthYear) { const n = parseInt(val); if (!isNaN(n)) birthYear = n }
    if (PLAYER_CLUB_KEYS.has(nk) && !club) club = val
  }

  if (!firstName && !lastName) return null
  return { firstName, lastName, birthYear, club }
}

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

const TABS = ["Summary", "Raw data", "Timeline", "Tasks"] as const
type Tab = (typeof TABS)[number]

export function LeadDetail({ lead: initial }: { lead: LeadDetailType }) {
  const router = useRouter()
  const [lead, setLead] = useState(initial)
  const [activeTab, setActiveTab] = useState<Tab>("Summary")
  const [stage, setStage] = useState<LeadStage>(lead.stage)
  const [followUpDate, setFollowUpDate] = useState(lead.next_follow_up_at?.slice(0, 10) ?? "")
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    form_type: lead.form_type ?? "",
    source_detail: lead.source_detail ?? "",
  })
  const [addActivityOpen, setAddActivityOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [creatingPlayer, setCreatingPlayer] = useState(false)
  const [playerDismissed, setPlayerDismissed] = useState(false)

  async function handleStageChange(newStage: LeadStage) {
    setStage(newStage)
    const result = await updateLeadStage(lead.id, newStage)
    if (result.error) {
      toast.error(result.error)
      setStage(lead.stage)
    } else {
      toast.success(`Stage updated to ${newStage}`)
      setLead((l) => ({ ...l, stage: newStage }))
    }
  }

  async function handleSaveFollowUp() {
    setSavingFollowUp(true)
    const result = await updateLead(lead.id, {
      next_follow_up_at: followUpDate ? new Date(followUpDate).toISOString() : null,
    })
    setSavingFollowUp(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Follow-up date saved")
    }
  }

  async function handleSaveEdit() {
    const result = await updateLead(lead.id, {
      form_type: editForm.form_type || null,
      source_detail: editForm.source_detail || null,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Lead updated")
      setEditing(false)
      router.refresh()
    }
  }

  async function handleCreatePlayer() {
    const detected = detectPlayerFromRaw(lead.raw as Record<string, unknown> | null)
    if (!detected) return
    setCreatingPlayer(true)
    const result = await createAndLinkPlayer(lead.id, {
      first_name: detected.firstName,
      last_name: detected.lastName,
      birth_year: detected.birthYear,
      current_club: detected.club,
      position: null,
    })
    setCreatingPlayer(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player created and linked")
      router.refresh()
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this lead?")) return
    const result = await archiveLead(lead.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Lead archived")
      router.push("/leads")
    }
  }

  async function handleCompleteTask(id: string) {
    const result = await completeTask(id)
    if (result.error) toast.error(result.error)
    else router.refresh()
  }

  async function handleDeleteTask(id: string) {
    if (!confirm("Delete this task?")) return
    const result = await deleteTask(id)
    if (result.error) toast.error(result.error)
    else router.refresh()
  }

  const taskItems = (lead.tasks ?? []).map((t) => ({
    ...t,
    contacts: null,
    players: null,
    leads: null,
    assigned_profile: null,
  }))

  const phone = lead.contacts?.phone
  const whatsappUrl = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}`
    : null

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors -mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </button>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#0C0F4C]">
            {lead.contacts?.first_name} {lead.contacts?.last_name}
          </h1>
          {lead.players && (
            <p className="text-sm text-gray-500 mt-0.5">
              Player: {lead.players.first_name} {lead.players.last_name}
              {lead.players.birth_year && ` (${lead.players.birth_year})`}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </a>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-green-600 hover:underline">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            )}
            {lead.contacts?.email && (
              <a href={`mailto:${lead.contacts.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {lead.contacts.email}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={stage}
            onChange={(e) => handleStageChange(e.target.value as LeadStage)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
          >
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            className="text-red-600 hover:text-red-700"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAddActivityOpen(true) }}
        >
          <Phone className="h-3.5 w-3.5 mr-1.5" />
          Log call
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAddActivityOpen(true) }}
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
          Log SMS
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAddActivityOpen(true) }}
        >
          <StickyNote className="h-3.5 w-3.5 mr-1.5" />
          Add note
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddTaskOpen(true)}
        >
          Add task
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
        <Label htmlFor="followup" className="shrink-0 text-sm">Follow-up date</Label>
        <Input
          id="followup"
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleSaveFollowUp}
          disabled={savingFollowUp}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white shrink-0"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "border-[#C9A227] text-[#C9A227]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Summary" && (
        <div className="space-y-4">
          {/* Form submission — all fields the person filled out */}
          {(() => {
            const raw = lead.raw as Record<string, unknown> | null
            // Skip internal/system keys that aren't useful to display
            const SKIP = new Set(["external_id", "id", "source", "form_type", "submitted_at", "page_url", "ip", "user_agent"])
            const entries = raw
              ? Object.entries(raw).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && String(v).trim() !== "")
              : []
            // Fall back to contacts.notes if no raw data
            const fallbackNote = !entries.length && lead.contacts?.notes ? lead.contacts.notes : null
            if (!entries.length && !fallbackNote) return null
            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
                  {lead.form_type === "contact" ? "Contact form submission" : lead.form_type === "eoi" ? "EOI form submission" : "Form submission"}
                </p>
                {fallbackNote ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{fallbackNote}</p>
                ) : (
                  <dl className="space-y-2">
                    {entries.map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[160px_1fr] gap-2 text-sm">
                        <dt className="text-blue-700 font-medium truncate">{key}</dt>
                        <dd className="text-gray-800 whitespace-pre-wrap break-words">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })()}

          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-600">Lead details</p>
              <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                Edit
              </Button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Form type</Label>
                  <Input value={editForm.form_type} onChange={(e) => setEditForm((f) => ({ ...f, form_type: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Source detail</Label>
                  <Input value={editForm.source_detail} onChange={(e) => setEditForm((f) => ({ ...f, source_detail: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">Source</dt><dd className="font-medium capitalize">{lead.source.replace(/_/g, " ")}</dd></div>
                <div><dt className="text-gray-500">Stage</dt><dd><Badge variant={stageBadge(lead.stage)}>{lead.stage.replace(/_/g, " ")}</Badge></dd></div>
                <div>
                  <dt className="text-gray-500">Form type</dt>
                  <dd>
                    {lead.form_type
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#0C0F4C]/10 text-[#0C0F4C] border border-[#0C0F4C]/20">{lead.form_type}</span>
                      : <span className="text-gray-400">—</span>}
                  </dd>
                </div>
                <div><dt className="text-gray-500">Owner</dt><dd className="font-medium">{lead.profiles?.full_name ?? "Unassigned"}</dd></div>
                <div><dt className="text-gray-500">Submitted</dt><dd className="font-medium">{format(new Date(lead.created_at), "d MMM yyyy h:mm aa")}</dd></div>
                {lead.next_follow_up_at && (
                  <div><dt className="text-gray-500">Follow-up</dt><dd className="font-medium text-orange-600">{format(new Date(lead.next_follow_up_at), "d MMM yyyy")}</dd></div>
                )}
              </dl>
            )}
          </div>

          {lead.contacts && (
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-semibold text-gray-600 mb-3">Contact</p>
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/contacts/${lead.contact_id}`} className="font-medium text-[#0C0F4C] hover:underline">
                    {lead.contacts.first_name} {lead.contacts.last_name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{lead.contacts.email} - {lead.contacts.phone}</p>
                  {lead.contacts.suburb && <p className="text-xs text-gray-400">{lead.contacts.suburb}, {lead.contacts.state}</p>}
                </div>
              </div>
            </div>
          )}

          {lead.players ? (
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-semibold text-gray-600 mb-3">Player</p>
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/players/${lead.player_id}`} className="font-medium text-[#0C0F4C] hover:underline">
                    {lead.players.first_name} {lead.players.last_name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lead.players.birth_year} - {lead.players.position ?? "No position"} - {lead.players.current_club ?? "No club"}
                  </p>
                </div>
              </div>
            </div>
          ) : !playerDismissed && lead.form_type !== "contact" && (() => {
            const detected = detectPlayerFromRaw(lead.raw as Record<string, unknown> | null)
            if (!detected) return null
            return (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Player detected in form</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      {[detected.firstName, detected.lastName].filter(Boolean).join(" ")}
                      {detected.birthYear && ` · Born ${detected.birthYear}`}
                      {detected.club && ` · ${detected.club}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={handleCreatePlayer}
                      disabled={creatingPlayer}
                      className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
                    >
                      {creatingPlayer ? "Creating…" : "Create player"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPlayerDismissed(true)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === "Raw data" && (
        <div className="rounded-lg border bg-white p-4">
          {lead.raw ? (
            <div className="space-y-2">
              {Object.entries(lead.raw as Record<string, Json>).map(([key, value]) => (
                <div key={key} className="flex gap-3 text-sm border-b pb-2 last:border-b-0">
                  <span className="font-medium text-gray-600 min-w-32 shrink-0">{key}</span>
                  <span className="text-gray-800 break-all">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No raw submission data</p>
          )}
        </div>
      )}

      {activeTab === "Timeline" && (
        <ActivityTimeline activities={lead.activities ?? []} />
      )}

      {activeTab === "Tasks" && (
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setAddTaskOpen(true)}>
            Add task
          </Button>
          <TaskList
            tasks={taskItems}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteTask}
          />
        </div>
      )}

      <AddActivityDialog
        open={addActivityOpen}
        onClose={() => setAddActivityOpen(false)}
        onSave={() => router.refresh()}
        leadId={lead.id}
        contactId={lead.contact_id ?? undefined}
      />

      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSave={() => router.refresh()}
        leadId={lead.id}
        contactId={lead.contact_id ?? undefined}
      />
    </div>
  )
}
