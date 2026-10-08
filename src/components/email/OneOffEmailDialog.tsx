"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
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
import { sendOneOffEmail } from "@/app/(app)/email/actions"

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
  onSent?: () => void
}) {
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!contactEmail) {
      toast.error("Contact has no email")
      return
    }
    setSending(true)
    const isHtml = body.trimStart().startsWith("<")
    const res = await sendOneOffEmail({
      contactId,
      subject: subject.trim(),
      bodyHtml: isHtml ? body : null,
      bodyText: isHtml ? null : body,
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
      onSent?.()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl">
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

          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !contactEmail}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            {sending ? "Sending..." : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
