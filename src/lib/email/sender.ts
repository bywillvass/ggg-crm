import { Resend } from "resend"
import { serviceClient } from "@/lib/supabase/service"
import { signToken } from "@/lib/tokens"
import { formatInTimeZone } from "date-fns-tz"
import type { Tables } from "@/lib/database.types"
import { FROM_ADDRESSES } from "@/lib/email/from-options"

type SettingsRow = Tables<"settings">
type EmailMessageRow = Tables<"email_messages">
type ContactRow = Tables<"contacts">
type PlayerRow = Tables<"players">
type EventRow = Tables<"events">
type EmailAttachmentRow = Tables<"email_attachments">

type MessageWithJoins = EmailMessageRow & {
  contacts: ContactRow | null
  players: Pick<PlayerRow, "id" | "first_name" | "last_name"> | null
  events: Pick<EventRow, "id" | "title" | "start_at" | "venue_name" | "address" | "timezone"> | null
  email_campaigns?: { from_name: string | null; reply_to: string | null } | null
}

type SendOverrides = {
  fromEmail?: string
  fromName?: string
  replyTo?: string
}

const SYDNEY_TZ = "Australia/Sydney"

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.gingaglobalgroup.com"
}

async function loadSettings(): Promise<SettingsRow | null> {
  const { data } = await serviceClient.from("settings").select("*").limit(1).single()
  return data
}

async function countSentToday(): Promise<number> {
  // Sydney midnight today -> next midnight (UTC bounds)
  const now = new Date()
  const sydneyDate = formatInTimeZone(now, SYDNEY_TZ, "yyyy-MM-dd")
  const startSydney = new Date(`${sydneyDate}T00:00:00+10:00`)
  // Use date-fns-tz offset-aware boundary instead
  const startIso = (() => {
    // Build start of Sydney day as UTC ISO
    const parts = sydneyDate.split("-")
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const d = parseInt(parts[2], 10)
    // Determine offset: Sydney is UTC+10 or +11; derive via formatInTimeZone
    const offsetMinutes = (() => {
      const utcDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
      const asSydney = new Date(formatInTimeZone(utcDate, SYDNEY_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"))
      return (utcDate.getTime() - asSydney.getTime()) / 60000
    })()
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMinutes * 60 * 1000)
    return start.toISOString()
  })()

  // Simpler: use pg timestamp comparison from startSydney forward
  const start = isNaN(startSydney.getTime()) ? new Date(startIso) : startSydney

  const { count } = await serviceClient
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", start.toISOString())
    .in("status", ["sent", "delivered", "opened", "clicked", "bounced", "complained"])

  return count ?? 0
}

function replaceMergeFields(
  text: string | null,
  message: MessageWithJoins
): string {
  if (!text) return ""
  const contact = message.contacts
  const player = message.players
  const event = message.events

  const contactFirst = contact?.first_name ?? "there"
  const contactLast = contact?.last_name ?? ""
  const playerFirst = player?.first_name ?? ""
  const playerLast = player?.last_name ?? ""

  let eventTitle = ""
  let eventDate = ""
  let eventTime = ""
  let eventVenue = ""
  let eventAddress = ""

  if (event) {
    eventTitle = event.title ?? ""
    eventVenue = event.venue_name ?? ""
    eventAddress = event.address ?? ""
    if (event.start_at) {
      const tz = event.timezone ?? SYDNEY_TZ
      try {
        eventDate = formatInTimeZone(new Date(event.start_at), tz, "EEE d MMM yyyy")
        eventTime = formatInTimeZone(new Date(event.start_at), tz, "h:mm a")
      } catch {
        eventDate = event.start_at
      }
    }
  }

  return text
    .replace(/\{\{\s*contact_first_name\s*\}\}/g, contactFirst)
    .replace(/\{\{\s*contact_last_name\s*\}\}/g, contactLast)
    .replace(/\{\{\s*player_first_name\s*\}\}/g, playerFirst)
    .replace(/\{\{\s*player_last_name\s*\}\}/g, playerLast)
    .replace(/\{\{\s*event_title\s*\}\}/g, eventTitle)
    .replace(/\{\{\s*event_date\s*\}\}/g, eventDate)
    .replace(/\{\{\s*event_time\s*\}\}/g, eventTime)
    .replace(/\{\{\s*event_venue\s*\}\}/g, eventVenue)
    .replace(/\{\{\s*event_address\s*\}\}/g, eventAddress)
}

function brandedWrapper(opts: {
  bodyHtml: string
  footerHtml: string | null
  unsubscribeUrl: string
  orgName: string
}): string {
  const { bodyHtml, footerHtml, unsubscribeUrl, orgName } = opts
  const footer = footerHtml ?? `<p style="margin:0;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} ${orgName}</p>`
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${orgName}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f6;font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#0C0F4C;padding:20px 24px;color:#C9A227;font-weight:700;font-size:18px;letter-spacing:-0.01em;">
                ${orgName}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:15px;line-height:1.6;color:#111827;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                ${footer}
                <p style="margin:12px 0 0 0;">
                  <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function isBuilderEmail(html: string): boolean {
  // Detect emails generated by buildStructuredEmail — they have the G logo Supabase URL
  return html.includes("G%20logo") && html.includes("iaigtvfdteagnvkljvcq.supabase.co")
}

function injectHtmlFooter(html: string, unsubscribeUrl: string, footerHtml: string | null, orgName: string): string {
  // Builder emails already have a full branded footer — only inject the unsubscribe link
  if (isBuilderEmail(html)) {
    const unsubBlock = `
    <div style="text-align:center;padding:0 0 16px 0;">
      <a href="${unsubscribeUrl}" style="color:#A9ABC8;text-decoration:underline;font-size:11px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">Unsubscribe</a>
    </div>`
    if (html.includes("</body>")) {
      return html.replace("</body>", `${unsubBlock}</body>`)
    }
    return html + unsubBlock
  }

  const footer = `
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
    <div style="font-size:12px;color:#6b7280;font-family:'DM Sans', sans-serif;">
      ${footerHtml ?? `<p style="margin:0;">&copy; ${new Date().getFullYear()} ${orgName}</p>`}
      <p style="margin:8px 0 0 0;"><a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>
    </div>
  `
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`)
  }
  return html + footer
}

function textToSimpleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return escaped
    .split(/\n\n+/)
    .map((para) => `<p style="margin:0 0 12px 0;">${para.replace(/\n/g, "<br />")}</p>`)
    .join("")
}

async function fetchAttachmentsForCampaign(campaignId: string): Promise<Array<{ filename: string; content: Buffer; contentType?: string }>> {
  const { data: rows } = await serviceClient
    .from("email_attachments")
    .select("*")
    .eq("campaign_id", campaignId)
  const atts = (rows ?? []) as EmailAttachmentRow[]
  const result: Array<{ filename: string; content: Buffer; contentType?: string }> = []
  for (const a of atts) {
    const { data } = await serviceClient.storage.from("email-attachments").download(a.file_path)
    if (!data) continue
    const arrayBuffer = await data.arrayBuffer()
    result.push({
      filename: a.file_name,
      content: Buffer.from(arrayBuffer),
      contentType: a.mime_type ?? undefined,
    })
  }
  return result
}

async function prepareMessage(
  message: MessageWithJoins,
  settings: SettingsRow,
  overrides?: SendOverrides
): Promise<{
  from: string
  to: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
  replyTo?: string
}> {
  const orgName = settings.org_name ?? "Ginga Global Group"

  // Campaign-level from/reply-to (from_name column stores the chosen email address)
  const campaignOverride = message.email_campaigns ?? null
  const campaignFromEmail = campaignOverride?.from_name ?? null
  const campaignFromName = campaignFromEmail
    ? (FROM_ADDRESSES.find(f => f.value === campaignFromEmail)?.name ?? orgName)
    : null

  const fromName = overrides?.fromName ?? campaignFromName ?? settings.email_from_name ?? orgName
  const fromEmail = overrides?.fromEmail ?? campaignFromEmail ?? settings.email_from_address ?? "noreply@gingaglobalgroup.com"
  const replyTo = overrides?.replyTo ?? campaignOverride?.reply_to ?? settings.email_reply_to ?? undefined

  const unsubscribeToken = await signToken({ contact_id: message.contact_id }, "365d")
  const unsubscribeUrl = `${appUrl()}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`

  const mergedHtml = replaceMergeFields(message.body_html, message)
  const mergedText = replaceMergeFields(message.body_text, message)
  const mergedSubject = replaceMergeFields(message.subject, message)

  // Determine format: if body_html present, treat as html; otherwise plain
  const isHtml = !!(message.body_html && message.body_html.trim().length > 0)

  let finalHtml: string
  if (isHtml) {
    finalHtml = injectHtmlFooter(mergedHtml, unsubscribeUrl, settings.email_footer_html, orgName)
  } else {
    const inner = textToSimpleHtml(mergedText || "")
    finalHtml = brandedWrapper({
      bodyHtml: inner,
      footerHtml: settings.email_footer_html,
      unsubscribeUrl,
      orgName,
    })
  }

  const finalText = mergedText || mergedHtml.replace(/<[^>]+>/g, "")
  const finalTextWithFooter = `${finalText}\n\n---\nUnsubscribe: ${unsubscribeUrl}`

  return {
    from: `${fromName} <${fromEmail}>`,
    to: message.to_email,
    subject: mergedSubject,
    html: finalHtml,
    text: finalTextWithFooter,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    replyTo,
  }
}

async function fetchQueuedMessages(limit: number): Promise<MessageWithJoins[]> {
  const { data } = await serviceClient
    .from("email_messages")
    .select(`
      *,
      contacts(*),
      players:player_id(id, first_name, last_name),
      events:event_id(id, title, start_at, venue_name, address, timezone),
      email_campaigns:campaign_id(from_name, reply_to)
    `)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit)
  return (data ?? []) as unknown as MessageWithJoins[]
}

async function markSkipped(messageId: string, reason: string): Promise<void> {
  await serviceClient
    .from("email_messages")
    .update({ status: "skipped", error: reason, updated_at: new Date().toISOString() })
    .eq("id", messageId)
}

async function markSent(messageId: string, resendId: string | null): Promise<void> {
  await serviceClient
    .from("email_messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      resend_id: resendId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
}

async function markFailed(messageId: string, error: string): Promise<void> {
  await serviceClient
    .from("email_messages")
    .update({ status: "failed", error, updated_at: new Date().toISOString() })
    .eq("id", messageId)
}

async function bumpCampaignSent(campaignIds: Set<string>): Promise<void> {
  for (const campaignId of campaignIds) {
    await recalculateCampaignCounts(campaignId)
  }
}

export async function recalculateCampaignCounts(campaignId: string): Promise<void> {
  const { data: rows } = await serviceClient
    .from("email_messages")
    .select("status")
    .eq("campaign_id", campaignId)

  const list = rows ?? []
  const total = list.length
  const sent = list.filter((r) => ["sent", "delivered", "opened", "clicked", "bounced", "complained"].includes(r.status)).length
  const delivered = list.filter((r) => ["delivered", "opened", "clicked"].includes(r.status)).length
  const opened = list.filter((r) => ["opened", "clicked"].includes(r.status)).length
  const clicked = list.filter((r) => r.status === "clicked").length
  const bounced = list.filter((r) => r.status === "bounced" || r.status === "complained").length

  await serviceClient
    .from("email_campaigns")
    .update({
      total,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
}

export async function processEmailQueue(
  limit = 40
): Promise<{ sent: number; failed: number; skipped: number; capped: boolean }> {
  const settings = await loadSettings()
  if (!settings) return { sent: 0, failed: 0, skipped: 0, capped: false }

  const cap = settings.daily_email_cap ?? 500
  const alreadySent = await countSentToday()
  if (alreadySent >= cap) {
    return { sent: 0, failed: 0, skipped: 0, capped: true }
  }

  const remaining = Math.max(0, cap - alreadySent)
  const take = Math.min(limit, remaining)
  if (take <= 0) return { sent: 0, failed: 0, skipped: 0, capped: true }

  const messages = await fetchQueuedMessages(take)
  if (messages.length === 0) return { sent: 0, failed: 0, skipped: 0, capped: false }

  const resend = getResend()
  if (!resend) {
    // Mark all as failed - no API key
    for (const m of messages) {
      await markFailed(m.id, "RESEND_API_KEY not configured")
    }
    return { sent: 0, failed: messages.length, skipped: 0, capped: false }
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  const touchedCampaigns = new Set<string>()

  // Split into skippable vs sendable
  const sendable: MessageWithJoins[] = []
  for (const m of messages) {
    const contact = m.contacts
    if (!contact) {
      await markSkipped(m.id, "No contact")
      skipped++
      if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
      continue
    }
    if (contact.unsubscribed_at) {
      await markSkipped(m.id, "Contact unsubscribed")
      skipped++
      if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
      continue
    }
    if (!m.to_email) {
      await markSkipped(m.id, "No email address")
      skipped++
      if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
      continue
    }
    sendable.push(m)
  }

  // Separate messages with attachments from those without
  const withAttachments: MessageWithJoins[] = []
  const noAttachments: MessageWithJoins[] = []
  for (const m of sendable) {
    if (m.campaign_id) {
      const { count } = await serviceClient
        .from("email_attachments")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", m.campaign_id)
      if ((count ?? 0) > 0) {
        withAttachments.push(m)
      } else {
        noAttachments.push(m)
      }
    } else {
      noAttachments.push(m)
    }
  }

  // Batch send messages without attachments (max 100 at once via Resend batch)
  if (noAttachments.length > 0) {
    const prepared = await Promise.all(noAttachments.map((m) => prepareMessage(m, settings)))
    const payload = prepared.map((p) => ({
      from: p.from,
      to: p.to,
      subject: p.subject,
      html: p.html,
      text: p.text,
      headers: p.headers,
      ...(p.replyTo ? { replyTo: p.replyTo } : {}),
    }))

    try {
      const result = await resend.batch.send(payload)
      const resultData = (result as unknown as { data?: { data?: Array<{ id: string }> } }).data?.data
      if (resultData && Array.isArray(resultData)) {
        for (let i = 0; i < noAttachments.length; i++) {
          const m = noAttachments[i]
          const resId = resultData[i]?.id ?? null
          await markSent(m.id, resId)
          sent++
          if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
        }
      } else {
        for (const m of noAttachments) {
          await markSent(m.id, null)
          sent++
          if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      for (const m of noAttachments) {
        await markFailed(m.id, errMsg)
        failed++
        if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
      }
    }
  }

  // Send attachment-bearing messages individually
  const attCache = new Map<string, Array<{ filename: string; content: Buffer; contentType?: string }>>()
  for (const m of withAttachments) {
    try {
      const prepared = await prepareMessage(m, settings)
      let attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = []
      if (m.campaign_id) {
        if (attCache.has(m.campaign_id)) {
          attachments = attCache.get(m.campaign_id)!
        } else {
          attachments = await fetchAttachmentsForCampaign(m.campaign_id)
          attCache.set(m.campaign_id, attachments)
        }
      }
      const result = await resend.emails.send({
        from: prepared.from,
        to: prepared.to,
        subject: prepared.subject,
        html: prepared.html,
        text: prepared.text,
        headers: prepared.headers,
        ...(prepared.replyTo ? { replyTo: prepared.replyTo } : {}),
        attachments,
      })
      const resId = (result as unknown as { data?: { id?: string } }).data?.id ?? null
      await markSent(m.id, resId)
      sent++
      if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await markFailed(m.id, errMsg)
      failed++
      if (m.campaign_id) touchedCampaigns.add(m.campaign_id)
    }
  }

  await bumpCampaignSent(touchedCampaigns)

  return { sent, failed, skipped, capped: false }
}

export async function sendSingleEmail(
  messageId: string,
  overrides?: SendOverrides
): Promise<{ ok: boolean; error?: string }> {
  const settings = await loadSettings()
  if (!settings) return { ok: false, error: "Settings not found" }

  const { data: m } = await serviceClient
    .from("email_messages")
    .select(`
      *,
      contacts(*),
      players:player_id(id, first_name, last_name),
      events:event_id(id, title, start_at, venue_name, address, timezone),
      email_campaigns:campaign_id(from_name, reply_to)
    `)
    .eq("id", messageId)
    .single()

  if (!m) return { ok: false, error: "Message not found" }
  const message = m as unknown as MessageWithJoins
  if (!message.contacts) {
    await markSkipped(message.id, "No contact")
    return { ok: false, error: "No contact" }
  }
  if (!message.to_email) {
    await markSkipped(message.id, "No email address")
    return { ok: false, error: "No email" }
  }

  const resend = getResend()
  if (!resend) {
    await markFailed(message.id, "RESEND_API_KEY not configured")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  try {
    const prepared = await prepareMessage(message, settings, overrides)
    let attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = []
    if (message.campaign_id) {
      attachments = await fetchAttachmentsForCampaign(message.campaign_id)
    }
    const result = await resend.emails.send({
      from: prepared.from,
      to: prepared.to,
      subject: prepared.subject,
      html: prepared.html,
      text: prepared.text,
      headers: prepared.headers,
      ...(prepared.replyTo ? { replyTo: prepared.replyTo } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    })
    const resId = (result as unknown as { data?: { id?: string } }).data?.id ?? null
    await markSent(message.id, resId)
    if (message.campaign_id) await recalculateCampaignCounts(message.campaign_id)
    return { ok: true }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await markFailed(message.id, errMsg)
    if (message.campaign_id) await recalculateCampaignCounts(message.campaign_id)
    return { ok: false, error: errMsg }
  }
}

export async function scheduleEventReminders(): Promise<{ reminders: number }> {
  // Find events with reminder_hours_before + reminder_template_id, not started, within window
  const now = new Date()
  const { data: events } = await serviceClient
    .from("events")
    .select("id, title, start_at, timezone, venue_name, address, reminder_hours_before, reminder_template_id")
    .not("reminder_hours_before", "is", null)
    .not("reminder_template_id", "is", null)
    .gte("start_at", now.toISOString())
    .is("archived_at", null)

  let reminders = 0
  for (const event of events ?? []) {
    if (!event.reminder_hours_before || !event.reminder_template_id) continue
    const startAt = new Date(event.start_at)
    const windowStart = new Date(startAt.getTime() - event.reminder_hours_before * 3600 * 1000)
    if (now < windowStart) continue
    if (now > startAt) continue

    // Fetch template
    const { data: template } = await serviceClient
      .from("email_templates")
      .select("*")
      .eq("id", event.reminder_template_id)
      .single()
    if (!template) continue

    // Confirmed participants
    const { data: participants } = await serviceClient
      .from("event_participants")
      .select(`
        id, player_id, contact_id,
        players(id, first_name, last_name, player_contacts(is_primary, contacts(id, email, unsubscribed_at)))
      `)
      .eq("event_id", event.id)
      .eq("status", "confirmed")

    for (const participant of participants ?? []) {
      const raw = participant as unknown as {
        id: string
        player_id: string | null
        contact_id: string | null
        players: {
          id: string
          first_name: string | null
          last_name: string | null
          player_contacts: {
            is_primary: boolean
            contacts: { id: string; email: string | null; unsubscribed_at: string | null } | null
          }[]
        } | null
      }

      let contactId: string | null = raw.contact_id
      let email: string | null = null
      let unsubscribed: string | null = null

      if (!contactId && raw.players) {
        const primary = raw.players.player_contacts?.find((pc) => pc.is_primary)?.contacts
        if (primary) {
          contactId = primary.id
          email = primary.email
          unsubscribed = primary.unsubscribed_at
        }
      } else if (contactId) {
        const { data: c } = await serviceClient
          .from("contacts")
          .select("email, unsubscribed_at")
          .eq("id", contactId)
          .single()
        email = c?.email ?? null
        unsubscribed = c?.unsubscribed_at ?? null
      }

      if (!contactId || !email || unsubscribed) continue

      // Check for existing non-failed reminder
      const { data: existing } = await serviceClient
        .from("email_messages")
        .select("id")
        .eq("event_id", event.id)
        .eq("contact_id", contactId)
        .is("campaign_id", null)
        .not("status", "in", "(failed,skipped)")
        .limit(1)

      if (existing && existing.length > 0) continue

      await serviceClient.from("email_messages").insert({
        contact_id: contactId,
        to_email: email,
        subject: template.subject,
        body_html: template.body_html,
        body_text: template.body_text,
        event_id: event.id,
        player_id: raw.player_id,
        status: "queued",
      })
      reminders++
    }
  }

  return { reminders }
}

export async function markOverdueInvoices(): Promise<{ overdueInvoices: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: rows } = await serviceClient
    .from("invoices")
    .select("id")
    .lt("due_date", today)
    .not("status", "in", "(paid,void,overdue)")

  const ids = (rows ?? []).map((r) => r.id)
  if (ids.length === 0) return { overdueInvoices: 0 }

  await serviceClient
    .from("invoices")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .in("id", ids)

  return { overdueInvoices: ids.length }
}
