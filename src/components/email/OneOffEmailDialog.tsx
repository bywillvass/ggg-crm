"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "cn"
import { sendOneOffEmail } from "@/app/(app)/email/actions"
import type { EmailTemplateRow } from "@/app/(app)/email/actions"

type BodyMode = "text" | "html"

export function OneOffEmailDialog({
  open,
  onClose,
  contactId,
  contactName,
  contactEmail,
  contactUnsubscribedAt,
  eventId,
  playerId,
  invoiceId,
  defaultSubject = "",
  defaultBody = "",
  templates = [],
  onSent,
}: {
  open: boolean
  onClose: () => void
  contactId: string
  contactName: string
  contactEmail: string | null
  contactUnsubscribedAt?: string | null
  eventId?: string
  playerId?: string
  invoiceId?: string
  defaultSubject?: string
  defaultBody?: string
  templates?: EmailTemplateRow[]
  onSent?: () => void
}) {
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [mode, setMode] = useState<BodyMode>(
    defaultBody.trimStart().startsWith("<") ? "html" : "text"
  )
  const [sending, setSending] = useState(false)

  function applyTemplate(t: EmailTemplateRow) {
    setSubject(t.subject ?? "")
    const b = t.body_html ?? t.body_text ?? ""
    setBody(b)
    setMode(b.trimStart().startsWith("<") ? "html" : "text")
  }

  async function handleSend() {
    if (!subject.trim()) return toast.error("Subject is required")
    if (!contactEmail) return toast.error("Contact has no email")
    setSending(true)
    const res = await sendOneOffEmail({
      contactId,
      subject: subject.trim(),
      bodyHtml: mode === "html" ? body : null,
      bodyText: mode === "text" ? body : null,
      eventId: eventId ?? null,
      playerId: playerId ?? null,
      invoiceId: invoiceId ?? null,
    })
    setSending(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Email sent to ${contactName}`)
      setSubject("")
      setBody("")
      setMode("text")
      onSent?.()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email {contactName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="text-sm text-gray-600">
            To: <span className="font-medium">{contactEmail ?? "No email on file"}</span>
          </div>

          {contactUnsubscribedAt && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                This contact has unsubscribed from marketing emails. Only send transactional emails (invoices, event logistics, documents).
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <div className="space-y-1">
              <Label>Template</Label>
              <Select
                value=""
                onChange={(e) => {
                  const t = templates.find((tmpl) => tmpl.id === e.target.value)
                  if (t) applyTemplate(t)
                }}
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <Label>Message</Label>
              <div className="flex rounded-md border text-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={cn(
                    "px-3 py-1 transition-colors",
                    mode === "text" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Plain text
                </button>
                <button
                  type="button"
                  onClick={() => setMode("html")}
                  className={cn(
                    "px-3 py-1 transition-colors border-l",
                    mode === "html" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  HTML
                </button>
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={mode === "html" ? 14 : 8}
              className={cn(mode === "html" && "font-mono text-xs")}
              placeholder={mode === "html" ? "Paste your HTML email here…" : "Write your message…"}
            />
            {mode === "html" && (
              <p className="text-xs text-gray-400 mt-1">
                Merge fields: {"{{"} contact_first_name {"}}"}, {"{{"} player_first_name {"}}"}, {"{{"} event_title {"}}"}, {"{{"} event_date {"}}"}, {"{{"} event_time {"}}"}, {"{{"} event_venue {"}}"}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !contactEmail}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            {sending ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
