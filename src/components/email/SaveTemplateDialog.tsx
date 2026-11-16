"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { saveContentAsTemplate, type EmailTemplateRow } from "@/app/(app)/email/actions"
import { TEMPLATE_CATEGORIES } from "@/lib/email/templates"

export type TemplateContent = {
  subject: string
  format: "plain" | "html"
  body_html: string | null
  body_text: string | null
}

export function SaveTemplateDialog({
  open,
  onClose,
  content,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  content: TemplateContent | null
  onSaved?: (t: EmailTemplateRow) => void
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("general")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content) return
    if (!name.trim()) return toast.error("Template name is required")
    setSaving(true)
    const res = await saveContentAsTemplate({ ...content, name, category })
    setSaving(false)
    if (res.error || !res.data) return toast.error(res.error ?? "Could not save template")
    toast.success(`Template "${res.data.name}" saved`)
    onSaved?.(res.data)
    setName("")
    setCategory("general")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-gray-500">
            Saves the subject and message, including any merge tags like {"{{player_first_name}}"}. Recipients aren&apos;t saved.
          </p>
          <div className="space-y-1">
            <Label>Template name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
            {saving ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
