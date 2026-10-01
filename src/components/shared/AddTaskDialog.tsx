"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { createTask, getProfiles } from "@/app/(app)/tasks/actions"
import type { Tables } from "@/lib/database.types"

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  leadId?: string
  contactId?: string
  playerId?: string
  eventId?: string
}

export function AddTaskDialog({ open, onClose, onSave, leadId, contactId, playerId, eventId }: Props) {
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      getProfiles().then(setProfiles).catch(() => {})
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    setSaving(true)
    const result = await createTask({
      title: title.trim(),
      notes: notes.trim() || null,
      due_at: dueAt || null,
      assigned_to: assignedTo || null,
      lead_id: leadId ?? null,
      contact_id: contactId ?? null,
      player_id: playerId ?? null,
      event_id: eventId ?? null,
    })
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Task created")
      setTitle("")
      setNotes("")
      setDueAt("")
      setAssignedTo("")
      onSave()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-assign">Assign to</Label>
              <select
                id="task-assign"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              {saving ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
