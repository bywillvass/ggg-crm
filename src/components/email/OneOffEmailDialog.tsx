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
import { buildStructuredEmail } from "@/lib/email/builder"
import { FROM_ADDRESSES, DEFAULT_FROM } from "@/lib/email/from-options"

type BodyMode = "text" | "html" | "builder"

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

  // From / reply-to
  const [fromEmail, setFromEmail] = useState<string>(DEFAULT_FROM)
  const [replyTo, setReplyTo] = useState<string>("")

  // Builder fields
  const [builderEyebrow, setBuilderEyebrow] = useState("")
  const [builderHeading, setBuilderHeading] = useState("")
  const [builderSubheading, setBuilderSubheading] = useState("")
  const [builderBody, setBuilderBody] = useState("")

  function applyTemplate(t: EmailTemplateRow) {
    setSubject(t.subject ?? "")
    const b = t.body_html ?? t.body_text ?? ""
    setBody(b)
    setMode(b.trimStart().startsWith("<") ? "html" : "text")
  }

  async function handleSend() {
    if (!subject.trim()) return toast.error("Subject is required")
    if (!contactEmail) return toast.error("Contact has no email")

    if (mode === "builder") {
      if (!builderHeading.trim()) return toast.error("Heading is required")
      if (!builderBody.trim()) return toast.error("Body is required")
    }

    setSending(true)

    let bodyHtml: string | null = null
    let bodyText: string | null = null

    if (mode === "html") {
      bodyHtml = body
    } else if (mode === "text") {
      bodyText = body
    } else {
      // builder mode — generate HTML
      bodyHtml = buildStructuredEmail({
        eyebrow: builderEyebrow.trim() || null,
        heading: builderHeading.trim(),
        subheading: builderSubheading.trim() || null,
        body: builderBody,
        unsubscribeUrl: "",
      })
    }

    const res = await sendOneOffEmail({
      contactId,
      subject: subject.trim(),
      bodyHtml,
      bodyText,
      eventId: eventId ?? null,
      playerId: playerId ?? null,
      invoiceId: invoiceId ?? null,
      fromEmail: fromEmail || null,
      replyTo: replyTo || null,
    })
    setSending(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Email sent to ${contactName}`)
      setSubject("")
      setBody("")
      setMode("text")
      setFromEmail(DEFAULT_FROM)
      setReplyTo("")
      setBuilderEyebrow("")
      setBuilderHeading("")
      setBuilderSubheading("")
      setBuilderBody("")
      onSent?.()
      onClose()
    }
  }

  const MERGE_HINT = `Merge fields: {{contact_first_name}}, {{player_first_name}}, {{event_title}}, {{event_date}}`

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

          {/* From / Reply-to row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Select value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}>
                {FROM_ADDRESSES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reply to</Label>
              <Select value={replyTo} onChange={(e) => setReplyTo(e.target.value)}>
                <option value="">Same as from</option>
                {FROM_ADDRESSES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </div>
          </div>

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
                <button
                  type="button"
                  onClick={() => setMode("builder")}
                  className={cn(
                    "px-3 py-1 transition-colors border-l",
                    mode === "builder" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Builder
                </button>
              </div>
            </div>

            {mode === "text" && (
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your message…"
              />
            )}

            {mode === "html" && (
              <>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                  placeholder="Paste your HTML email here…"
                />
                <p className="text-xs text-gray-400 mt-1">{MERGE_HINT}</p>
              </>
            )}

            {mode === "builder" && (
              <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <p className="text-xs text-gray-500">
                  Builds a branded Ginga Global Group email. Supports merge fields like {`{{contact_first_name}}`}.
                </p>
                <div className="space-y-1">
                  <Label>Eyebrow <span className="text-gray-400 font-normal">(optional — small label above heading)</span></Label>
                  <Input
                    value={builderEyebrow}
                    onChange={(e) => setBuilderEyebrow(e.target.value)}
                    placeholder="e.g. Trial reminder"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Heading <span className="text-gray-400 font-normal">(required)</span></Label>
                  <Input
                    value={builderHeading}
                    onChange={(e) => setBuilderHeading(e.target.value)}
                    placeholder="e.g. Your trial is coming up!"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Subheading <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    value={builderSubheading}
                    onChange={(e) => setBuilderSubheading(e.target.value)}
                    placeholder="e.g. Here are the details for your upcoming session"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Body <span className="text-gray-400 font-normal">(required — blank line = new paragraph)</span></Label>
                  <Textarea
                    value={builderBody}
                    onChange={(e) => setBuilderBody(e.target.value)}
                    rows={8}
                    placeholder={`Hi {{contact_first_name}},\n\nWe're excited to have you join us...\n\nSee you on the pitch!`}
                  />
                </div>
                <p className="text-xs text-gray-400">{MERGE_HINT}</p>
              </div>
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
