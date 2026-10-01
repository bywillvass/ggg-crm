"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { logManualActivity } from "@/app/(app)/activities/actions"
import type { Database } from "@/lib/database.types"

type ActivityType = Database["public"]["Enums"]["activity_type"]

const MANUAL_TYPES: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
]

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  leadId?: string
  contactId?: string
  playerId?: string
}

export function AddActivityDialog({ open, onClose, onSave, leadId, contactId, playerId }: Props) {
  const [type, setType] = useState<ActivityType>("note")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const result = await logManualActivity({
      type,
      body: body.trim() || undefined,
      lead_id: leadId,
      contact_id: contactId,
      player_id: playerId,
    })

    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Activity logged")
      setBody("")
      setType("note")
      onSave()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="act-type">Type</Label>
            <select
              id="act-type"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
            >
              {MANUAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="act-body">Notes</Label>
            <Textarea
              id="act-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              {saving ? "Saving..." : "Log activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
