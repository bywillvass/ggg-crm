"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Mail, Phone, Archive, Edit2, UserPlus, GitMerge, X, Check, Send } from "lucide-react"
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
import { MergeContactsDialog } from "@/components/contacts/MergeContactsDialog"
import { OneOffEmailDialog } from "@/components/email/OneOffEmailDialog"
import {
  updateContact,
  archiveContact,
  addTagToContact,
  removeTagFromContact,
  type ContactDetail as ContactDetailType,
} from "@/app/(app)/contacts/actions"
import { linkPlayerContact } from "@/app/(app)/players/actions"
import { completeTask, deleteTask } from "@/app/(app)/tasks/actions"
import type { Tables } from "@/lib/database.types"
import { cn } from "cn"

const TABS = ["Overview", "Players", "Leads", "Emails", "Timeline", "Tasks"] as const
type Tab = (typeof TABS)[number]

type Props = {
  contact: ContactDetailType
}

export function ContactDetail({ contact: initial }: Props) {
  const router = useRouter()
  const contact = initial
  const [activeTab, setActiveTab] = useState<Tab>("Overview")
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    suburb: contact.suburb ?? "",
    state: contact.state ?? "",
    notes: contact.notes ?? "",
    marketing_consent: contact.marketing_consent,
    source: contact.source ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [newTag, setNewTag] = useState("")
  const [addActivityOpen, setAddActivityOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [linkPlayerOpen, setLinkPlayerOpen] = useState(false)
  const [linkForm, setLinkForm] = useState({ player_id: "", relationship: "parent", is_primary: false, is_emergency: false })
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = await updateContact(contact.id, {
      first_name: editForm.first_name || null,
      last_name: editForm.last_name || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      suburb: editForm.suburb || null,
      state: editForm.state || null,
      notes: editForm.notes || null,
      marketing_consent: editForm.marketing_consent,
      source: (editForm.source as Tables<"contacts">["source"]) || null,
    })
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Contact updated")
      setEditing(false)
      router.refresh()
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this contact?")) return
    const result = await archiveContact(contact.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Contact archived")
      router.push("/contacts")
    }
  }

  async function handleAddTag() {
    if (!newTag.trim()) return
    const result = await addTagToContact(contact.id, newTag.trim())
    if (result.error) {
      toast.error(result.error)
    } else {
      setNewTag("")
      router.refresh()
    }
  }

  async function handleRemoveTag(tag: string) {
    const result = await removeTagFromContact(contact.id, tag)
    if (result.error) {
      toast.error(result.error)
    } else {
      router.refresh()
    }
  }

  async function handleLinkPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!linkForm.player_id) return
    const result = await linkPlayerContact(
      linkForm.player_id,
      contact.id,
      linkForm.relationship,
      linkForm.is_primary,
      linkForm.is_emergency
    )
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player linked")
      setLinkPlayerOpen(false)
      router.refresh()
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

  const taskItems = (contact.tasks ?? []).map((t) => ({
    ...t,
    contacts: null,
    players: null,
    leads: null,
    assigned_profile: null,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#0C0F4C]">
            {contact.first_name} {contact.last_name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {contact.phone}
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(contact.tags ?? []).map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="h-6 text-xs w-24 px-2"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag() } }}
              />
              {newTag && (
                <button onClick={handleAddTag} className="text-xs text-blue-600 hover:underline">Add</button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            disabled={!contact.email}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Send email
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
            <GitMerge className="h-3.5 w-3.5 mr-1.5" />
            Merge
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

      {activeTab === "Overview" && (
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
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Suburb</Label>
                  <Input value={editForm.suburb} onChange={(e) => setEditForm((f) => ({ ...f, suburb: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Consent</Label>
                  <select
                    value={editForm.marketing_consent}
                    onChange={(e) => setEditForm((f) => ({ ...f, marketing_consent: e.target.value as typeof f.marketing_consent }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                  >
                    <option value="none">None</option>
                    <option value="inferred">Inferred</option>
                    <option value="express">Express</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Input value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
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
              <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{contact.email ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{contact.phone ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Suburb</dt><dd className="font-medium">{contact.suburb ?? "-"}</dd></div>
              <div><dt className="text-gray-500">State</dt><dd className="font-medium">{contact.state ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Consent</dt><dd className="font-medium">{contact.marketing_consent}</dd></div>
              <div><dt className="text-gray-500">Source</dt><dd className="font-medium">{contact.source?.replace("_", " ") ?? "-"}</dd></div>
              <div><dt className="text-gray-500">Added</dt><dd className="font-medium">{format(new Date(contact.created_at), "d MMM yyyy")}</dd></div>
              {contact.unsubscribed_at && (
                <div><dt className="text-gray-500">Unsubscribed</dt><dd className="font-medium text-red-600">{format(new Date(contact.unsubscribed_at), "d MMM yyyy")}</dd></div>
              )}
              {contact.notes && (
                <div className="col-span-2"><dt className="text-gray-500">Notes</dt><dd className="font-medium whitespace-pre-wrap">{contact.notes}</dd></div>
              )}
            </dl>
          )}
        </div>
      )}

      {activeTab === "Players" && (
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinkPlayerOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Link player
          </Button>

          {(contact.player_contacts ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No linked players</p>
          ) : (
            <div className="space-y-2">
              {contact.player_contacts.map((pc) => (
                <div key={pc.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                  <div>
                    <Link href={`/players/${pc.player_id}`} className="font-medium text-[#0C0F4C] hover:underline">
                      {pc.players?.first_name} {pc.players?.last_name}
                    </Link>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{pc.relationship}</span>
                      {pc.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                      {pc.is_emergency && <Badge variant="warning" className="text-xs">Emergency</Badge>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {pc.players?.birth_year} - {pc.players?.position ?? "No position"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "Leads" && (
        <div className="space-y-2">
          {(contact.leads ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No leads</p>
          ) : (
            contact.leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                <div>
                  <Link href={`/leads/${lead.id}`} className="font-medium text-[#0C0F4C] hover:underline">
                    {lead.source.replace("_", " ")} - {lead.form_type ?? "No form type"}
                  </Link>
                  <p className="text-xs text-gray-500">{format(new Date(lead.created_at), "d MMM yyyy")}</p>
                </div>
                <Badge variant={lead.stage === "signed" ? "success" : lead.stage === "lost" || lead.stage === "not_interested" ? "destructive" : "secondary"}>
                  {lead.stage}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Emails" && (
        <div className="space-y-2">
          {(contact.email_messages ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No emails sent</p>
          ) : (
            contact.email_messages.map((msg) => (
              <div key={msg.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                <div>
                  <p className="font-medium text-sm">{msg.subject}</p>
                  {msg.email_campaigns && <p className="text-xs text-gray-500">{msg.email_campaigns.name}</p>}
                </div>
                <div className="text-right">
                  <Badge variant={msg.status === "delivered" ? "success" : msg.status === "bounced" ? "destructive" : "secondary"}>
                    {msg.status}
                  </Badge>
                  {msg.sent_at && <p className="text-xs text-gray-400 mt-0.5">{format(new Date(msg.sent_at), "d MMM yyyy")}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Timeline" && (
        <ActivityTimeline activities={contact.activities ?? []} />
      )}

      {activeTab === "Tasks" && (
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddTaskOpen(true)}
          >
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
        contactId={contact.id}
      />

      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSave={() => router.refresh()}
        contactId={contact.id}
      />

      <MergeContactsDialog
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onMerged={() => router.refresh()}
        masterContact={{ ...contact, player_contacts: contact.player_contacts.map((pc) => ({ player_id: pc.player_id })) }}
      />

      <OneOffEmailDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        contactId={contact.id}
        contactName={`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Contact"}
        contactEmail={contact.email}
        contactUnsubscribedAt={contact.unsubscribed_at}
        onSent={() => router.refresh()}
      />

      <Dialog open={linkPlayerOpen} onOpenChange={(o) => { if (!o) setLinkPlayerOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link player</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLinkPlayer} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Player ID</Label>
              <Input
                value={linkForm.player_id}
                onChange={(e) => setLinkForm((f) => ({ ...f, player_id: e.target.value }))}
                placeholder="Player UUID"
                required
              />
              <p className="text-xs text-gray-400">Enter the player ID from the players list</p>
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
                Primary contact
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkForm.is_emergency}
                  onChange={(e) => setLinkForm((f) => ({ ...f, is_emergency: e.target.checked }))}
                />
                Emergency contact
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkPlayerOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#C9A227] hover:bg-[#b8911f] text-white">Link player</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
