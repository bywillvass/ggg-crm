"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Phone, Archive, Edit2, Check, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import { AddTaskDialog } from "@/components/shared/AddTaskDialog"
import { TaskList } from "@/components/shared/TaskList"
import {
  updatePlayer,
  archivePlayer,
  linkPlayerContact,
  unlinkPlayerContact,
  type PlayerDetail as PlayerDetailType,
} from "@/app/(app)/players/actions"
import { completeTask, deleteTask } from "@/app/(app)/tasks/actions"
import { cn } from "cn"
import type { Database } from "@/lib/database.types"

type AssessmentRec = Database["public"]["Enums"]["assessment_recommendation"]

const TABS = ["Profile", "Guardians", "Events", "Assessments", "Timeline", "Tasks"] as const
type Tab = (typeof TABS)[number]

function recBadge(rec: AssessmentRec | null) {
  if (rec === "select") return <Badge variant="success">Select</Badge>
  if (rec === "monitor") return <Badge variant="warning">Monitor</Badge>
  if (rec === "not_yet") return <Badge variant="destructive">Not yet</Badge>
  return null
}

function statusVariant(status: string): "success" | "secondary" | "default" {
  if (status === "active") return "success"
  if (status === "prospect") return "secondary"
  return "default"
}

function participantBadge(status: string): "success" | "warning" | "destructive" | "secondary" | "default" {
  if (status === "confirmed" || status === "attended") return "success"
  if (status === "waitlisted") return "warning"
  if (status === "no_show" || status === "declined" || status === "cancelled") return "destructive"
  return "secondary"
}

export function PlayerDetail({ player: initial }: { player: PlayerDetailType }) {
  const router = useRouter()
  const [player] = useState(initial)
  const [activeTab, setActiveTab] = useState<Tab>("Profile")
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: player.first_name ?? "",
    last_name: player.last_name ?? "",
    birth_year: player.birth_year ?? null as number | null,
    dob: player.dob ?? "",
    position: player.position ?? "",
    secondary_position: player.secondary_position ?? "",
    current_club: player.current_club ?? "",
    level: player.level ?? "",
    state: player.state ?? "",
    suburb: player.suburb ?? "",
    gender: player.gender ?? "",
    preferred_foot: player.preferred_foot ?? "",
    status: player.status,
    notes: player.notes ?? "",
    medical_alerts: player.medical_alerts ?? "",
    dietary_notes: player.dietary_notes ?? "",
    eligibility_notes: player.eligibility_notes ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [addActivityOpen, setAddActivityOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [linkGuardianOpen, setLinkGuardianOpen] = useState(false)
  const [linkForm, setLinkForm] = useState({ contact_id: "", relationship: "parent", is_primary: false, is_emergency: false })

  async function handleSave() {
    setSaving(true)
    const result = await updatePlayer(player.id, {
      first_name: editForm.first_name || null,
      last_name: editForm.last_name || null,
      birth_year: editForm.birth_year,
      dob: editForm.dob || null,
      position: editForm.position || null,
      secondary_position: editForm.secondary_position || null,
      current_club: editForm.current_club || null,
      level: editForm.level || null,
      state: editForm.state || null,
      suburb: editForm.suburb || null,
      gender: editForm.gender || null,
      preferred_foot: editForm.preferred_foot || null,
      status: editForm.status,
      notes: editForm.notes || null,
      medical_alerts: editForm.medical_alerts || null,
      dietary_notes: editForm.dietary_notes || null,
      eligibility_notes: editForm.eligibility_notes || null,
    })
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player updated")
      setEditing(false)
      router.refresh()
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this player?")) return
    const result = await archivePlayer(player.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player archived")
      router.push("/players")
    }
  }

  async function handleLinkGuardian(e: React.FormEvent) {
    e.preventDefault()
    if (!linkForm.contact_id) return
    const result = await linkPlayerContact(
      player.id,
      linkForm.contact_id,
      linkForm.relationship,
      linkForm.is_primary,
      linkForm.is_emergency
    )
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Guardian linked")
      setLinkGuardianOpen(false)
      router.refresh()
    }
  }

  async function handleUnlink(id: string) {
    if (!confirm("Remove this guardian link?")) return
    const result = await unlinkPlayerContact(id)
    if (result.error) toast.error(result.error)
    else router.refresh()
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

  const initials = `${(player.first_name ?? "?")[0]}${(player.last_name ?? "?")[0]}`.toUpperCase()

  const taskItems = (player.tasks ?? []).map((t) => ({
    ...t,
    contacts: null,
    players: null,
    leads: null,
    assigned_profile: null,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-[#0C0F4C] text-white flex items-center justify-center text-lg font-bold shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#0C0F4C]">
            {player.first_name} {player.last_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {player.birth_year && <span className="text-sm text-gray-500">{player.birth_year}</span>}
            {player.position && <span className="text-sm text-gray-500">{player.position}</span>}
            {player.current_club && <span className="text-sm text-gray-500">{player.current_club}</span>}
            <Badge variant={statusVariant(player.status)}>{player.status}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            className="text-red-600 hover:text-red-700"
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Archive
          </Button>
        </div>
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

      {activeTab === "Profile" && (
        <div className="rounded-lg border bg-white p-4 space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Birth year</Label>
                  <Input
                    type="number"
                    value={editForm.birth_year ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, birth_year: e.target.value ? parseInt(e.target.value) : null }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    value={editForm.dob}
                    onChange={(e) => setEditForm((f) => ({ ...f, dob: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Secondary position</Label>
                  <Input value={editForm.secondary_position} onChange={(e) => setEditForm((f) => ({ ...f, secondary_position: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Club</Label>
                  <Input value={editForm.current_club} onChange={(e) => setEditForm((f) => ({ ...f, current_club: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Input value={editForm.level} onChange={(e) => setEditForm((f) => ({ ...f, level: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Input value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred foot</Label>
                  <select
                    value={editForm.preferred_foot}
                    onChange={(e) => setEditForm((f) => ({ ...f, preferred_foot: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                  >
                    <option value="">Unknown</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="alumni">Alumni</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Medical alerts</Label>
                <Textarea value={editForm.medical_alerts} onChange={(e) => setEditForm((f) => ({ ...f, medical_alerts: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Dietary notes</Label>
                <Textarea value={editForm.dietary_notes} onChange={(e) => setEditForm((f) => ({ ...f, dietary_notes: e.target.value }))} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                  <Check className="h-4 w-4 mr-1.5" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-gray-500">Birth year</dt><dd className="font-medium">{player.birth_year ?? "-"}</dd></div>
              <div><dt className="text-gray-500">DOB</dt><dd className="font-medium">{player.dob ? format(new Date(player.dob), "d MMM yyyy") : "-"}</dd></div>
              <div><dt className="text-gray-500">Position</dt><dd className="font-medium">{player.position ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Secondary</dt><dd className="font-medium">{player.secondary_position ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Club</dt><dd className="font-medium">{player.current_club ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Level</dt><dd className="font-medium">{player.level ?? "-"}</dd></div>
              <div><dt className="text-gray-500">State</dt><dd className="font-medium">{player.state ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Gender</dt><dd className="font-medium">{player.gender ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Preferred foot</dt><dd className="font-medium">{player.preferred_foot ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd><Badge variant={statusVariant(player.status)}>{player.status}</Badge></dd></div>
              {player.notes && <div className="col-span-2"><dt className="text-gray-500">Notes</dt><dd className="whitespace-pre-wrap">{player.notes}</dd></div>}
              {player.medical_alerts && <div className="col-span-2"><dt className="text-gray-500 font-medium text-orange-600">Medical alerts</dt><dd className="text-orange-700 font-medium whitespace-pre-wrap">{player.medical_alerts}</dd></div>}
              {player.dietary_notes && <div className="col-span-2"><dt className="text-gray-500">Dietary notes</dt><dd className="whitespace-pre-wrap">{player.dietary_notes}</dd></div>}
              {player.eligibility_notes && <div className="col-span-2"><dt className="text-gray-500">Eligibility notes</dt><dd className="whitespace-pre-wrap">{player.eligibility_notes}</dd></div>}
            </dl>
          )}
        </div>
      )}

      {activeTab === "Guardians" && (
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setLinkGuardianOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add guardian
          </Button>

          {player.player_contacts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No guardians linked</p>
          ) : (
            <div className="space-y-2">
              {player.player_contacts.map((pc) => (
                <div key={pc.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                  <div>
                    <Link href={`/contacts/${pc.contact_id}`} className="font-medium text-[#0C0F4C] hover:underline">
                      {pc.contacts?.first_name} {pc.contacts?.last_name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{pc.relationship}</span>
                      {pc.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                      {pc.is_emergency && <Badge variant="warning" className="text-xs">Emergency</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pc.contacts?.phone && (
                      <a
                        href={`tel:${pc.contacts.phone}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {pc.contacts.phone}
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleUnlink(pc.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      x
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "Events" && (
        <div className="space-y-2">
          {player.event_participants.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No events</p>
          ) : (
            player.event_participants.map((ep) => (
              <div key={ep.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                <div>
                  <p className="font-medium text-sm">{ep.events?.title ?? "Unknown event"}</p>
                  {ep.events?.start_at && (
                    <p className="text-xs text-gray-500">{format(new Date(ep.events.start_at), "d MMM yyyy")}</p>
                  )}
                </div>
                <Badge variant={participantBadge(ep.status)}>{ep.status}</Badge>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Assessments" && (
        <div className="space-y-2">
          {player.assessments.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No assessments</p>
          ) : (
            player.assessments.map((a) => (
              <div key={a.id} className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{format(new Date(a.created_at), "d MMM yyyy")}</p>
                  {recBadge(a.recommendation)}
                </div>
                {a.overall !== null && (
                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>Overall: <strong>{a.overall}</strong></span>
                    {a.technical !== null && <span>Technical: <strong>{a.technical}</strong></span>}
                    {a.tactical !== null && <span>Tactical: <strong>{a.tactical}</strong></span>}
                    {a.physical !== null && <span>Physical: <strong>{a.physical}</strong></span>}
                    {a.mental !== null && <span>Mental: <strong>{a.mental}</strong></span>}
                  </div>
                )}
                {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Timeline" && (
        <ActivityTimeline activities={player.activities ?? []} />
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
        playerId={player.id}
      />

      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSave={() => router.refresh()}
        playerId={player.id}
      />

      <Dialog open={linkGuardianOpen} onOpenChange={(o) => { if (!o) setLinkGuardianOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add guardian</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLinkGuardian} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Contact ID</Label>
              <Input
                value={linkForm.contact_id}
                onChange={(e) => setLinkForm((f) => ({ ...f, contact_id: e.target.value }))}
                placeholder="Contact UUID"
                required
              />
              <p className="text-xs text-gray-400">Enter the contact ID from the contacts list</p>
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <select
                value={linkForm.relationship}
                onChange={(e) => setLinkForm((f) => ({ ...f, relationship: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
              >
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
                <option value="self">Self</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkForm.is_primary}
                  onChange={(e) => setLinkForm((f) => ({ ...f, is_primary: e.target.checked }))}
                />
                Primary
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkForm.is_emergency}
                  onChange={(e) => setLinkForm((f) => ({ ...f, is_emergency: e.target.checked }))}
                />
                Emergency
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkGuardianOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Link guardian</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
