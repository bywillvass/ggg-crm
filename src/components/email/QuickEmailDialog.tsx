"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Search, X, Plus, AlertTriangle } from "lucide-react"
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
import { TiptapEditor } from "./TiptapEditor"
import {
  searchEmailRecipients,
  sendQuickEmail,
  type QuickRecipient,
  type EmailTemplateRow,
} from "@/app/(app)/email/actions"
import { buildStructuredEmail } from "@/lib/email/builder"
import { FROM_ADDRESSES, DEFAULT_FROM } from "@/lib/email/from-options"

type Format = "plain" | "html" | "builder"

const MERGE_FIELDS = ["contact_first_name", "contact_last_name", "player_first_name", "player_last_name"]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Accepts "jane@x.com" or "Jane Smith <jane@x.com>"
function parseTyped(value: string): { email: string; name: string | null } | null {
  const v = value.trim()
  const m = v.match(/^(.*)<([^>]+)>$/)
  const email = (m ? m[2] : v).trim()
  if (!EMAIL_RE.test(email)) return null
  const name = m ? m[1].trim().replace(/^"|"$/g, "") || null : null
  return { email, name }
}

export function QuickEmailDialog({
  open,
  onClose,
  templates = [],
}: {
  open: boolean
  onClose: () => void
  templates?: EmailTemplateRow[]
}) {
  const [recipients, setRecipients] = useState<QuickRecipient[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<QuickRecipient[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  const [fromEmail, setFromEmail] = useState<string>(DEFAULT_FROM)
  const [replyTo, setReplyTo] = useState("")
  const [subject, setSubject] = useState("")
  const [format, setFormat] = useState<Format>("plain")
  const [bodyText, setBodyText] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  // The rich editor only reads its value on mount, so bump this to reload it
  const [htmlVersion, setHtmlVersion] = useState(0)
  const [builderEyebrow, setBuilderEyebrow] = useState("")
  const [builderHeading, setBuilderHeading] = useState("")
  const [builderSubheading, setBuilderSubheading] = useState("")
  const [builderBody, setBuilderBody] = useState("")
  const [sending, setSending] = useState(false)

  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyTextRef = useRef<HTMLTextAreaElement | null>(null)
  const builderEyebrowRef = useRef<HTMLInputElement | null>(null)
  const builderHeadingRef = useRef<HTMLInputElement | null>(null)
  const builderSubheadingRef = useRef<HTMLInputElement | null>(null)
  const builderBodyRef = useRef<HTMLTextAreaElement | null>(null)
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const typed = parseTyped(query)
  const hasRecipient = (email: string) => recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())

  function handleQuery(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    // A full email address doesn't need a search, but a name or partial email does
    if (q.length < 2 || parseTyped(q)) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const mySeq = ++seq.current
    timer.current = setTimeout(async () => {
      const res = await searchEmailRecipients(q)
      if (mySeq !== seq.current) return
      setResults(res)
      setSearching(false)
    }, 250)
  }

  function addRecipient(r: QuickRecipient) {
    if (!hasRecipient(r.email)) setRecipients((prev) => [...prev, r])
    setQuery("")
    setResults([])
  }

  function addTyped() {
    if (!typed) return
    addRecipient({ email: typed.email, name: typed.name, contactId: null, playerId: null, label: null, unsubscribed: false })
  }

  function insertMergeField(field: string) {
    const token = `{{${field}}}`
    if (format === "html" && activeRef.current !== subjectRef.current) {
      setBodyHtml((prev) => prev.replace(/(<\/p>)?\s*$/, (end) => end ? ` ${token}</p>` : `<p>${token}</p>`))
      setHtmlVersion((v) => v + 1)
      return
    }
    const el = activeRef.current ?? (format === "plain" ? bodyTextRef.current : builderBodyRef.current)
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + token + el.value.slice(end)
    if (el === subjectRef.current) setSubject(next)
    else if (el === bodyTextRef.current) setBodyText(next)
    else if (el === builderEyebrowRef.current) setBuilderEyebrow(next)
    else if (el === builderHeadingRef.current) setBuilderHeading(next)
    else if (el === builderSubheadingRef.current) setBuilderSubheading(next)
    else if (el === builderBodyRef.current) setBuilderBody(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setSubject(t.subject ?? "")
    const bt = t.body_text ?? ""
    // Builder templates keep their raw fields in body_text
    if (bt.startsWith("__builder__:")) {
      try {
        const b = JSON.parse(bt.slice("__builder__:".length))
        setBuilderEyebrow(b.eyebrow ?? "")
        setBuilderHeading(b.heading ?? "")
        setBuilderSubheading(b.subheading ?? "")
        setBuilderBody(b.body ?? "")
        setFormat("builder")
        return
      } catch { /* fall through */ }
    }
    if (t.format === "html" && t.body_html) {
      setBodyHtml(t.body_html)
      setHtmlVersion((v) => v + 1)
      setFormat("html")
    } else {
      setBodyText(bt)
      setFormat("plain")
    }
  }

  function reset() {
    setRecipients([])
    setQuery("")
    setResults([])
    setSubject("")
    setFormat("plain")
    setBodyText("")
    setBodyHtml("")
    setBuilderEyebrow("")
    setBuilderHeading("")
    setBuilderSubheading("")
    setBuilderBody("")
    setFromEmail(DEFAULT_FROM)
    setReplyTo("")
  }

  async function handleSend() {
    // Pick up an address that was typed but not added yet
    const list = typed && !hasRecipient(typed.email)
      ? [...recipients, { email: typed.email, name: typed.name, contactId: null, playerId: null, label: null, unsubscribed: false }]
      : recipients
    if (list.length === 0) return toast.error("Add at least one recipient")
    if (!subject.trim()) return toast.error("Subject is required")

    let html: string | null = null
    let text: string | null = null
    if (format === "plain") {
      if (!bodyText.trim()) return toast.error("Message is required")
      text = bodyText
    } else if (format === "html") {
      if (!bodyHtml.replace(/<[^>]+>/g, "").trim()) return toast.error("Message is required")
      html = bodyHtml
    } else {
      if (!builderHeading.trim()) return toast.error("Heading is required")
      if (!builderBody.trim()) return toast.error("Body is required")
      html = buildStructuredEmail({
        eyebrow: builderEyebrow.trim() || null,
        heading: builderHeading.trim(),
        subheading: builderSubheading.trim() || null,
        body: builderBody,
        unsubscribeUrl: "",
      })
    }

    setSending(true)
    const res = await sendQuickEmail({
      recipients: list.map((r) => ({ email: r.email, name: r.name, contactId: r.contactId, playerId: r.playerId })),
      subject: subject.trim(),
      bodyHtml: html,
      bodyText: text,
      fromEmail: fromEmail || null,
      replyTo: replyTo || null,
    })
    setSending(false)

    if (res.failed.length > 0) {
      toast.error(`${res.failed.length} failed: ${res.failed.map((f) => `${f.email} (${f.error})`).join(", ")}`)
      // Keep only the failed ones so they can be fixed and retried
      const failedEmails = new Set(res.failed.map((f) => f.email.toLowerCase()))
      setRecipients(list.filter((r) => failedEmails.has(r.email.trim().toLowerCase())))
      setQuery("")
      if (res.sent > 0) toast.success(`Sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}`)
      return
    }
    toast.success(`Email sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}`)
    reset()
    onClose()
  }

  const outsideCrm = recipients.filter((r) => !r.contactId)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick email</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>To</Label>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {recipients.map((r) => (
                  <span
                    key={r.email}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                      r.unsubscribed ? "border-yellow-300 bg-yellow-50 text-yellow-800"
                        : r.contactId ? "border-[#0C0F4C]/20 bg-[#0C0F4C]/5 text-[#0C0F4C]"
                        : "border-gray-300 bg-white text-gray-700"
                    )}
                    title={r.label ?? undefined}
                  >
                    {r.name ? `${r.name} <${r.email}>` : r.email}
                    <button type="button" onClick={() => setRecipients((prev) => prev.filter((x) => x.email !== r.email))} className="text-gray-400 hover:text-gray-700">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => handleQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && typed) {
                    e.preventDefault()
                    addTyped()
                  }
                }}
                placeholder="Search a player or contact, or type any email address"
                className="pl-8"
              />
            </div>
            {query.trim().length >= 2 && (
              <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                {typed ? (
                  <button type="button" onClick={addTyped} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                    <Plus className="h-3.5 w-3.5 text-gray-400" />
                    Add <span className="font-medium">{typed.name ? `${typed.name} <${typed.email}>` : typed.email}</span>
                  </button>
                ) : searching && results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400">Searching...</div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400">No one with an email found. You can type their email address instead.</div>
                ) : (
                  results.map((r) => (
                    <div key={`${r.contactId}-${r.playerId}`} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{r.label ?? r.name ?? r.email}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.label ? `${r.name ?? "Contact"} · ` : ""}{r.email}
                          {r.unsubscribed && <span className="text-yellow-700"> · unsubscribed</span>}
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline" disabled={hasRecipient(r.email)} onClick={() => addRecipient(r)}>
                        {hasRecipient(r.email) ? "Added" : "Add"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
            <p className="text-xs text-gray-400">Each person gets their own email. Tip: type <span className="font-mono">Name &lt;email&gt;</span> so their name fills in.</p>
            {outsideCrm.length > 0 && (
              <p className="text-xs text-gray-500">
                {outsideCrm.length} address{outsideCrm.length === 1 ? " isn't" : "es aren't"} in the CRM. If an address matches a contact it&apos;s sent as that contact, otherwise it&apos;s sent directly and won&apos;t show in any history.
              </p>
            )}
            {recipients.some((r) => r.unsubscribed) && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Someone highlighted has unsubscribed from marketing. Only send them non-marketing emails (invoices, event logistics, documents).
              </div>
            )}
          </div>

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
              <Select value="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Subject</Label>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => { activeRef.current = subjectRef.current }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Format</Label>
              <div className="flex items-center rounded-md border overflow-hidden">
                {(["plain", "html", "builder"] as const).map((f, i) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFormat(f); activeRef.current = null }}
                    className={cn(
                      "px-3 py-1 text-xs font-medium",
                      i > 0 && "border-l",
                      format === f ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600"
                    )}
                  >
                    {f === "plain" ? "Plain" : f === "html" ? "HTML" : "Builder"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 border-t pt-2">
              <span className="text-xs text-gray-500 mr-1 self-center">Insert:</span>
              {MERGE_FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => insertMergeField(f)}
                  className="text-xs rounded-md bg-gray-100 hover:bg-gray-200 px-2 py-0.5 text-gray-700"
                >
                  {`{{${f}}}`}
                </button>
              ))}
            </div>
            {outsideCrm.length > 0 && (
              <p className="text-xs text-gray-400">
                For addresses outside the CRM, contact names come from what you typed (or &quot;there&quot;) and player names are left blank.
              </p>
            )}

            {format === "plain" && (
              <Textarea
                ref={bodyTextRef}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={10}
                placeholder="Hi {{contact_first_name}},..."
                onFocus={() => { activeRef.current = bodyTextRef.current }}
              />
            )}

            {format === "html" && (
              <div onFocus={() => { activeRef.current = null }}>
                <TiptapEditor key={htmlVersion} value={bodyHtml} onChange={setBodyHtml} />
              </div>
            )}

            {format === "builder" && (
              <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <p className="text-xs text-gray-500">
                  Builds a branded Ginga Global Group email. Click a field, then click a merge tag above to insert it.
                </p>
                <div className="space-y-1">
                  <Label>Eyebrow <span className="text-gray-400 font-normal">(optional — small label above heading)</span></Label>
                  <Input
                    ref={builderEyebrowRef}
                    value={builderEyebrow}
                    onChange={(e) => setBuilderEyebrow(e.target.value)}
                    placeholder="e.g. Trial reminder"
                    onFocus={() => { activeRef.current = builderEyebrowRef.current }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Heading <span className="text-gray-400 font-normal">(required)</span></Label>
                  <Input
                    ref={builderHeadingRef}
                    value={builderHeading}
                    onChange={(e) => setBuilderHeading(e.target.value)}
                    placeholder="e.g. Your trial is coming up!"
                    onFocus={() => { activeRef.current = builderHeadingRef.current }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Subheading <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    ref={builderSubheadingRef}
                    value={builderSubheading}
                    onChange={(e) => setBuilderSubheading(e.target.value)}
                    placeholder="e.g. Here are the details for your upcoming session"
                    onFocus={() => { activeRef.current = builderSubheadingRef.current }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Body <span className="text-gray-400 font-normal">(required — blank line = new paragraph)</span></Label>
                  <Textarea
                    ref={builderBodyRef}
                    value={builderBody}
                    onChange={(e) => setBuilderBody(e.target.value)}
                    rows={10}
                    placeholder={`Hi {{contact_first_name}},\n\nWe're excited to have you join us...\n\nSee you on the pitch!`}
                    onFocus={() => { activeRef.current = builderBodyRef.current }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            {sending
              ? "Sending…"
              : `Send${recipients.length > 1 ? ` to ${recipients.length}` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
