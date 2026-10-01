"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import { Upload, X, FileText } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { TiptapEditor } from "./TiptapEditor"
import {
  createCampaign,
  updateCampaign,
  resolveAudience,
  sendCampaignNow,
  scheduleCampaign,
  sendTestEmail,
  uploadAttachment,
  deleteAttachment,
  saveAsTemplate,
  type AudienceFilter,
  type AudienceContact,
  type EmailTemplateRow,
  type EmailCampaignRow,
  type EmailAttachmentRow,
} from "@/app/(app)/email/actions"
import { cn } from "cn"
import type { Tables, Database } from "@/lib/database.types"

type ParticipantStatus = Database["public"]["Enums"]["participant_status"]
type ConsentType = Database["public"]["Enums"]["consent_type"]

const PARTICIPANT_STATUSES: ParticipantStatus[] = [
  "invited", "contacted", "confirmed", "declined", "waitlisted", "attended", "no_show", "cancelled",
]

const MERGE_FIELDS = [
  "contact_first_name",
  "contact_last_name",
  "player_first_name",
  "player_last_name",
  "event_title",
  "event_date",
  "event_time",
  "event_venue",
  "event_address",
]

type SourceType = "contacts" | "event" | "fixed" | "leads"

export function CampaignComposer({
  open,
  onClose,
  templates,
  events,
  initialCampaign,
  initialAttachments,
  prefilledContactIds,
  prefilledEventId,
}: {
  open: boolean
  onClose: () => void
  templates: EmailTemplateRow[]
  events: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
  initialCampaign?: EmailCampaignRow | null
  initialAttachments?: EmailAttachmentRow[]
  prefilledContactIds?: string[]
  prefilledEventId?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [campaignId, setCampaignId] = useState<string | null>(initialCampaign?.id ?? null)
  const [saving, setSaving] = useState(false)

  // Step 1: Audience
  const resolvedInitialSource: SourceType = (() => {
    if (prefilledContactIds && prefilledContactIds.length > 0) return "fixed"
    if (prefilledEventId) return "event"
    if (initialCampaign?.audience) {
      const a = initialCampaign.audience as unknown as AudienceFilter
      if (a?.type) return a.type as SourceType
    }
    return "contacts"
  })()
  const [sourceType, setSourceType] = useState<SourceType>(resolvedInitialSource)
  const [tagsInput, setTagsInput] = useState("")
  const [consent, setConsent] = useState<"" | ConsentType>("")
  const [source, setSource] = useState("")
  const [eventId, setEventId] = useState(prefilledEventId ?? initialCampaign?.event_id ?? "")
  const [statuses, setStatuses] = useState<ParticipantStatus[]>(["confirmed"])
  const [fixedIds] = useState<string[]>(prefilledContactIds ?? [])
  const [resolved, setResolved] = useState<{ contacts: AudienceContact[]; skipped: number; total: number } | null>(null)
  const [resolving, setResolving] = useState(false)

  // Step 2: Content
  const [name, setName] = useState(initialCampaign?.name ?? "")
  const [subject, setSubject] = useState(initialCampaign?.subject ?? "")
  const [preheader, setPreheader] = useState(initialCampaign?.preheader ?? "")
  const [format, setFormat] = useState<"plain" | "html">((initialCampaign?.format as "plain" | "html") ?? "plain")
  const [bodyText, setBodyText] = useState(initialCampaign?.body_text ?? "")
  const [bodyHtml, setBodyHtml] = useState(initialCampaign?.body_html ?? "")
  const [attachments, setAttachments] = useState<EmailAttachmentRow[]>(initialAttachments ?? [])
  const [includeRsvp, setIncludeRsvp] = useState(initialCampaign?.include_rsvp ?? false)
  const [saveTemplateName, setSaveTemplateName] = useState("")
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const bodyTextRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Step 3: Review / send
  const [scheduledAt, setScheduledAt] = useState("")
  const [testTo, setTestTo] = useState("")
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)

  const buildAudience = useCallback((): AudienceFilter => {
    if (sourceType === "fixed") {
      return { type: "fixed", contactIds: fixedIds }
    }
    if (sourceType === "event") {
      return {
        type: "event",
        filters: {
          event_id: eventId || undefined,
          participant_statuses: statuses,
        },
      }
    }
    if (sourceType === "leads") {
      return {
        type: "leads",
        filters: {
          source: source || undefined,
        },
      }
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    return {
      type: "contacts",
      filters: {
        tags: tags.length > 0 ? tags : undefined,
        consent: consent || undefined,
        source: source || undefined,
      },
    }
  }, [sourceType, fixedIds, eventId, statuses, source, tagsInput, consent])

  // Resolve audience on changes
  useEffect(() => {
    if (step !== 1) return
    let cancelled = false
    const run = async () => {
      setResolving(true)
      const res = await resolveAudience(buildAudience())
      if (!cancelled) {
        setResolved(res)
        setResolving(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [step, buildAudience])

  function insertMergeField(field: string) {
    const token = `{{${field}}}`
    if (format === "plain") {
      const ta = bodyTextRef.current
      if (ta) {
        const start = ta.selectionStart ?? bodyText.length
        const end = ta.selectionEnd ?? bodyText.length
        const next = bodyText.slice(0, start) + token + bodyText.slice(end)
        setBodyText(next)
        setTimeout(() => {
          ta.focus()
          ta.setSelectionRange(start + token.length, start + token.length)
        }, 0)
      } else {
        setBodyText((prev) => prev + token)
      }
    } else {
      setBodyHtml((prev) => prev + token)
    }
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setSubject(t.subject)
    setFormat(t.format as "plain" | "html")
    setBodyText(t.body_text ?? "")
    setBodyHtml(t.body_html ?? "")
  }

  async function persistDraft(): Promise<string | null> {
    const audience = buildAudience()
    if (!name.trim()) {
      toast.error("Campaign name is required")
      return null
    }
    if (!subject.trim()) {
      toast.error("Subject is required")
      return null
    }

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      preheader: preheader.trim() || null,
      format,
      body_html: format === "html" ? bodyHtml : null,
      body_text: format === "plain" ? bodyText : null,
      audience: audience as unknown as Tables<"email_campaigns">["audience"],
      event_id: sourceType === "event" ? eventId || null : null,
      include_rsvp: includeRsvp,
    }

    setSaving(true)
    try {
      if (campaignId) {
        const res = await updateCampaign(campaignId, payload)
        if (res.error) {
          toast.error(res.error)
          return null
        }
        return campaignId
      } else {
        const res = await createCampaign(payload)
        if (res.error || !res.data) {
          toast.error(res.error ?? "Failed to save")
          return null
        }
        setCampaignId(res.data.id)
        return res.data.id
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGoToStep2() {
    setStep(2)
  }

  async function handleGoToStep3() {
    const id = await persistDraft()
    if (id) setStep(3)
  }

  async function handleAttachmentUpload(file: File) {
    let id = campaignId
    if (!id) {
      id = await persistDraft()
      if (!id) return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const result = reader.result as string
      const base64 = result.split(",")[1] ?? ""
      const upload = await uploadAttachment(id!, file.name, file.type || "application/octet-stream", file.size, base64)
      if (upload.error) {
        toast.error(upload.error)
      } else if (upload.data) {
        setAttachments((prev) => [...prev, upload.data!])
        toast.success("Attachment uploaded")
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleAttachmentDelete(id: string) {
    const res = await deleteAttachment(id)
    if (res.error) {
      toast.error(res.error)
    } else {
      setAttachments((prev) => prev.filter((a) => a.id !== id))
    }
  }

  async function handleSendTest() {
    if (!testTo) {
      toast.error("Enter a test email")
      return
    }
    const id = campaignId ?? (await persistDraft())
    if (!id) return
    const res = await sendTestEmail(id, testTo)
    if (res.error) toast.error(res.error)
    else toast.success(`Test sent to ${testTo}`)
  }

  async function handleSchedule() {
    if (!scheduledAt) {
      toast.error("Pick a date/time")
      return
    }
    const id = campaignId ?? (await persistDraft())
    if (!id) return
    const iso = new Date(scheduledAt).toISOString()
    const res = await scheduleCampaign(id, iso)
    if (res.error) toast.error(res.error)
    else {
      toast.success("Campaign scheduled")
      onClose()
      router.push(`/email/${id}`)
    }
  }

  async function handleSendNow() {
    const id = campaignId ?? (await persistDraft())
    if (!id) return
    setSending(true)
    const res = await sendCampaignNow(id)
    setSending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(
      `Sent ${res.stats?.sent ?? 0}, failed ${res.stats?.failed ?? 0}, skipped ${res.stats?.skipped ?? 0}`
    )
    setConfirmSend(false)
    onClose()
    router.push(`/email/${id}`)
  }

  async function handleSaveAsTemplate() {
    if (!saveTemplateName.trim()) return
    const id = campaignId ?? (await persistDraft())
    if (!id) return
    const res = await saveAsTemplate(id, saveTemplateName.trim())
    if (res.error) toast.error(res.error)
    else {
      toast.success("Template saved")
      setShowSaveTemplate(false)
      setSaveTemplateName("")
    }
  }

  function toggleStatus(s: ParticipantStatus) {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const recipientCount = resolved?.contacts.length ?? 0
  const skippedCount = resolved?.skipped ?? 0

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {initialCampaign ? "Edit campaign" : "New campaign"} - Step {step} of 3
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            {["Audience", "Content", "Review"].map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-center",
                  step === i + 1 ? "bg-[#0C0F4C] text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Audience source</Label>
                <div className="flex gap-2 flex-wrap">
                  {(["contacts", "leads", "event", "fixed"] as SourceType[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSourceType(s)}
                      disabled={s === "fixed" && fixedIds.length === 0}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
                        sourceType === s
                          ? "bg-[#0C0F4C] text-white border-[#0C0F4C]"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                        s === "fixed" && fixedIds.length === 0 && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {s === "contacts" ? "Contacts" : s === "leads" ? "Leads" : s === "event" ? "Event participants" : `Fixed list (${fixedIds.length})`}
                    </button>
                  ))}
                </div>
              </div>

              {sourceType === "contacts" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. newsletter, VIP" />
                  </div>
                  <div className="space-y-1">
                    <Label>Consent</Label>
                    <Select value={consent} onChange={(e) => setConsent(e.target.value as "" | ConsentType)}>
                      <option value="">Any</option>
                      <option value="express">Express</option>
                      <option value="inferred">Inferred</option>
                      <option value="none">None</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Source</Label>
                    <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. website" />
                  </div>
                </div>
              )}

              {sourceType === "leads" && (
                <div className="space-y-1">
                  <Label>Source</Label>
                  <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. meta_instant_form" />
                </div>
              )}

              {sourceType === "event" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Event</Label>
                    <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                      <option value="">Select event...</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title} - {formatInTimeZone(new Date(ev.start_at), ev.timezone, "d MMM yyyy")}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Participant statuses</Label>
                    <div className="flex flex-wrap gap-2">
                      {PARTICIPANT_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleStatus(s)}
                          className={cn(
                            "px-2 py-1 text-xs rounded-md border",
                            statuses.includes(s)
                              ? "bg-[#C9A227] text-white border-[#C9A227]"
                              : "bg-white text-gray-700 border-gray-300"
                          )}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {sourceType === "fixed" && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  {fixedIds.length} contacts pre-selected
                </div>
              )}

              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Recipients</span>
                  {resolving ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : (
                    <span className="text-gray-700">
                      {recipientCount} will receive{skippedCount > 0 ? `, ${skippedCount} skipped` : ""}
                    </span>
                  )}
                </div>
                {resolved && resolved.contacts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {resolved.contacts.slice(0, 5).map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.first_name} {c.last_name}
                      </Badge>
                    ))}
                    {resolved.contacts.length > 5 && (
                      <span className="text-xs text-gray-500">+{resolved.contacts.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label>Campaign name (internal)</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jan 2026 trials announcement" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Preheader</Label>
                  <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Preview text shown next to subject" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Format</Label>
                  <div className="flex items-center rounded-md border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFormat("plain")}
                      className={cn(
                        "px-3 py-1 text-xs font-medium",
                        format === "plain" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600"
                      )}
                    >
                      Plain
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat("html")}
                      className={cn(
                        "px-3 py-1 text-xs font-medium",
                        format === "html" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600"
                      )}
                    >
                      HTML
                    </button>
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

                {format === "plain" ? (
                  <Textarea
                    ref={bodyTextRef}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={14}
                    placeholder="Hi {{contact_first_name}},..."
                  />
                ) : (
                  <TiptapEditor value={bodyHtml} onChange={setBodyHtml} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Load template</Label>
                  <Select onChange={(e) => { if (e.target.value) applyTemplate(e.target.value) }} defaultValue="">
                    <option value="">Select...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(true)}>
                    Save as template
                  </Button>
                </div>
              </div>

              {sourceType === "event" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRsvp}
                    onChange={(e) => setIncludeRsvp(e.target.checked)}
                  />
                  Include RSVP buttons
                </label>
              )}

              <div className="space-y-2">
                <Label>Attachments</Label>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleAttachmentUpload(file)
                    e.target.value = ""
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload file
                </Button>
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded border bg-white p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-gray-400" />
                          <span>{a.file_name}</span>
                          <span className="text-xs text-gray-400">
                            {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAttachmentDelete(a.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs text-gray-500 mb-1">Subject</div>
                <div className="font-medium">{subject}</div>
                {preheader && (
                  <div className="text-xs text-gray-500 mt-0.5">{preheader}</div>
                )}
              </div>

              <div className="rounded-lg border bg-white">
                <div className="border-b bg-gray-50 px-3 py-2 text-xs text-gray-500">Preview</div>
                <div className="p-4 text-sm max-h-[280px] overflow-y-auto">
                  {format === "html" ? (
                    <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{bodyText}</pre>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Recipients</span>
                  <span className="font-semibold">{recipientCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Skipped</span>
                  <span>{skippedCount}</span>
                </div>
                {attachments.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Attachments</span>
                    <span>{attachments.length}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 space-y-2">
                  <Label>Send test</Label>
                  <div className="flex gap-2">
                    <Input
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="you@example.com"
                      type="email"
                    />
                    <Button variant="outline" size="sm" onClick={handleSendTest}>
                      Send
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <Label>Schedule (Sydney time)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                    <Button variant="outline" size="sm" onClick={handleSchedule}>
                      Schedule
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <div>
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                {step === 1 && (
                  <Button
                    onClick={handleGoToStep2}
                    disabled={recipientCount === 0}
                    className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
                  >
                    Next
                  </Button>
                )}
                {step === 2 && (
                  <Button
                    onClick={handleGoToStep3}
                    disabled={saving}
                    className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
                  >
                    {saving ? "Saving..." : "Next"}
                  </Button>
                )}
                {step === 3 && (
                  <Button
                    onClick={() => setConfirmSend(true)}
                    className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
                  >
                    Send now
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveTemplate} onOpenChange={(o) => { if (!o) setShowSaveTemplate(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Template name</Label>
            <Input value={saveTemplateName} onChange={(e) => setSaveTemplateName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button onClick={handleSaveAsTemplate} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSend} onOpenChange={(o) => { if (!o) setConfirmSend(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to {recipientCount} recipients?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will immediately queue and send emails to {recipientCount} contact{recipientCount === 1 ? "" : "s"}.
            {skippedCount > 0 && ` ${skippedCount} will be skipped (unsubscribed or no email).`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSend(false)}>Cancel</Button>
            <Button
              onClick={handleSendNow}
              disabled={sending}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {sending ? "Sending..." : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
