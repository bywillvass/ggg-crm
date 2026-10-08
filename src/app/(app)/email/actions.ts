"use server"

import { requireAdmin, requireAuth } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { logActivity } from "@/lib/activity"
import { processEmailQueue, sendSingleEmail, recalculateCampaignCounts } from "@/lib/email/sender"
import { resolveAudienceServer, type AudienceContact, type AudienceFilter } from "@/lib/email/audience"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types"

export type EmailCampaignRow = Tables<"email_campaigns">
export type EmailMessageRow = Tables<"email_messages">
export type EmailAttachmentRow = Tables<"email_attachments">
export type EmailTemplateRow = Tables<"email_templates">

export type CampaignDetail = EmailCampaignRow & {
  messages: EmailMessageRow[]
  attachments: EmailAttachmentRow[]
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function listCampaigns(): Promise<EmailCampaignRow[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  await requireAdmin()
  const supabase = await createClient()

  const [campaignRes, messagesRes, attachmentsRes] = await Promise.all([
    supabase.from("email_campaigns").select("*").eq("id", id).single(),
    supabase
      .from("email_messages")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("email_attachments").select("*").eq("campaign_id", id),
  ])

  if (!campaignRes.data) return null

  return {
    ...campaignRes.data,
    messages: messagesRes.data ?? [],
    attachments: attachmentsRes.data ?? [],
  }
}

export type SubscriberRow = Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "email" | "created_at" | "unsubscribed_at">

export async function listSubscribers(): Promise<SubscriberRow[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, created_at, unsubscribed_at")
    .eq("marketing_consent", "express")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function createCampaign(
  input: Partial<TablesInsert<"email_campaigns">> & { name: string; subject: string }
): Promise<{ data: EmailCampaignRow | null; error: string | null }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: input.name,
      subject: input.subject,
      preheader: input.preheader ?? null,
      format: input.format ?? "plain",
      body_html: input.body_html ?? null,
      body_text: input.body_text ?? null,
      audience: input.audience ?? null,
      event_id: input.event_id ?? null,
      include_rsvp: input.include_rsvp ?? false,
      from_name: input.from_name ?? null,
      reply_to: input.reply_to ?? null,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export async function updateCampaign(
  id: string,
  updates: TablesUpdate<"email_campaigns">
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("email_campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function deleteCampaign(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("status")
    .eq("id", id)
    .single()

  if (!campaign) return { error: "Not found" }
  if (campaign.status !== "draft") return { error: "Only draft campaigns can be deleted" }

  const { error } = await supabase.from("email_campaigns").delete().eq("id", id)
  return { error: error?.message ?? null }
}

export async function duplicateCampaign(id: string): Promise<{ data: EmailCampaignRow | null; error: string | null }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: source } = await supabase.from("email_campaigns").select("*").eq("id", id).single()
  if (!source) return { data: null, error: "Not found" }

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: `Copy of ${source.name}`,
      subject: source.subject,
      preheader: source.preheader,
      format: source.format,
      body_html: source.body_html,
      body_text: source.body_text,
      audience: source.audience,
      event_id: source.event_id,
      include_rsvp: source.include_rsvp,
      from_name: source.from_name,
      reply_to: source.reply_to,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export async function sendCampaignNow(
  id: string
): Promise<{ error: string | null; stats?: { queued: number; sent: number; failed: number; skipped: number } }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: campaign } = await supabase.from("email_campaigns").select("*").eq("id", id).single()
  if (!campaign) return { error: "Not found" }
  if (campaign.status === "sent") return { error: "Already sent" }

  const audience = campaign.audience as unknown
  const { contacts } = await resolveAudienceServer(audience)

  // Mark campaign as sending
  await supabase
    .from("email_campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id)

  // Insert queued messages
  let queued = 0
  for (const contact of contacts) {
    if (!contact.email) continue
    await serviceClient.from("email_messages").insert({
      contact_id: contact.id,
      to_email: contact.email,
      subject: campaign.subject,
      body_html: campaign.body_html,
      body_text: campaign.body_text,
      campaign_id: campaign.id,
      event_id: campaign.event_id,
      player_id: contact.player_id ?? null,
      status: "queued",
    })
    queued++
  }

  await recalculateCampaignCounts(campaign.id)

  // Process queue inline
  const result = await processEmailQueue(Math.max(40, queued))

  // Check if any remain
  const { count: remaining } = await serviceClient
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("status", "queued")

  if ((remaining ?? 0) === 0) {
    await supabase
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
  }

  return {
    error: null,
    stats: { queued, sent: result.sent, failed: result.failed, skipped: result.skipped },
  }
}

export async function scheduleCampaign(
  id: string,
  scheduledAt: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("email_campaigns")
    .update({
      status: "scheduled",
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function cancelScheduledCampaign(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("email_campaigns")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function sendTestEmail(
  campaignId: string,
  toEmail: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  await requireAuth()
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single()
  if (!campaign) return { error: "Campaign not found" }

  // Look up or create a contact for the test recipient
  let contactId: string | null = null
  const { data: existing } = await serviceClient
    .from("contacts")
    .select("id")
    .eq("email", toEmail.toLowerCase())
    .is("archived_at", null)
    .maybeSingle()

  if (existing) {
    contactId = existing.id
  } else {
    const { data: newContact } = await serviceClient
      .from("contacts")
      .insert({
        email: toEmail.toLowerCase(),
        first_name: "Test",
        last_name: "Recipient",
        marketing_consent: "express",
      })
      .select("id")
      .single()
    contactId = newContact?.id ?? null
  }

  if (!contactId) return { error: "Could not resolve test contact" }

  const { data: inserted } = await serviceClient
    .from("email_messages")
    .insert({
      contact_id: contactId,
      to_email: toEmail,
      subject: `[TEST] ${campaign.subject}`,
      body_html: campaign.body_html,
      body_text: campaign.body_text,
      event_id: campaign.event_id,
      status: "queued",
    })
    .select("id")
    .single()

  if (!inserted) return { error: "Could not create test message" }

  const result = await sendSingleEmail(inserted.id)
  if (!result.ok) return { error: result.error ?? "Failed to send" }
  return { error: null }
}

// ─── Audience ─────────────────────────────────────────────────────────────────

export async function resolveAudience(
  audience: AudienceFilter
): Promise<{ contacts: AudienceContact[]; skipped: number; total: number }> {
  // No admin requirement - used client-side during composer preview, but requires auth
  await requireAuth()
  return resolveAudienceServer(audience as unknown)
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function uploadAttachment(
  campaignId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  base64Content: string
): Promise<{ data: EmailAttachmentRow | null; error: string | null }> {
  await requireAdmin()

  const path = `campaigns/${campaignId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const buffer = Buffer.from(base64Content, "base64")

  const { error: upErr } = await serviceClient.storage
    .from("email-attachments")
    .upload(path, buffer, { contentType: mimeType, upsert: false })

  if (upErr) return { data: null, error: upErr.message }

  const { data, error } = await serviceClient
    .from("email_attachments")
    .insert({
      campaign_id: campaignId,
      file_path: path,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export async function deleteAttachment(id: string): Promise<{ error: string | null }> {
  await requireAdmin()

  const { data: att } = await serviceClient
    .from("email_attachments")
    .select("file_path")
    .eq("id", id)
    .single()

  if (att?.file_path) {
    await serviceClient.storage.from("email-attachments").remove([att.file_path])
  }

  const { error } = await serviceClient.from("email_attachments").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<EmailTemplateRow[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from("email_templates").select("*").order("name")
  return data ?? []
}

export async function saveAsTemplate(
  campaignId: string,
  name: string
): Promise<{ data: EmailTemplateRow | null; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("subject, format, body_html, body_text")
    .eq("id", campaignId)
    .single()
  if (!campaign) return { data: null, error: "Campaign not found" }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name,
      subject: campaign.subject,
      format: campaign.format,
      body_html: campaign.body_html,
      body_text: campaign.body_text,
      category: "general",
    })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export async function deleteTemplate(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("email_templates").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── One-off emails ───────────────────────────────────────────────────────────

export async function sendOneOffEmail(input: {
  contactId: string
  subject: string
  bodyHtml?: string | null
  bodyText?: string | null
  eventId?: string | null
  playerId?: string | null
  invoiceId?: string | null
}): Promise<{ error: string | null }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from("contacts")
    .select("email")
    .eq("id", input.contactId)
    .single()
  if (!contact?.email) return { error: "Contact has no email" }

  const { data: inserted } = await serviceClient
    .from("email_messages")
    .insert({
      contact_id: input.contactId,
      to_email: contact.email,
      subject: input.subject,
      body_html: input.bodyHtml ?? null,
      body_text: input.bodyText ?? null,
      event_id: input.eventId ?? null,
      player_id: input.playerId ?? null,
      invoice_id: input.invoiceId ?? null,
      status: "queued",
    })
    .select("id")
    .single()

  if (!inserted) return { error: "Could not create message" }

  const result = await sendSingleEmail(inserted.id)
  if (!result.ok) return { error: result.error ?? "Failed to send" }

  await logActivity({
    type: "email_sent",
    contact_id: input.contactId,
    player_id: input.playerId ?? undefined,
    event_id: input.eventId ?? undefined,
    body: `Email sent: ${input.subject}`,
    created_by: user.id,
  })

  return { error: null }
}

// ─── Contact-specific ─────────────────────────────────────────────────────────

export async function getContactEmails(
  contactId: string
): Promise<Array<EmailMessageRow & { email_campaigns: Pick<EmailCampaignRow, "id" | "name"> | null }>> {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("email_messages")
    .select("*, email_campaigns(id, name)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (data ?? []) as Array<EmailMessageRow & { email_campaigns: Pick<EmailCampaignRow, "id" | "name"> | null }>
}

// ─── Image uploads (Tiptap) ───────────────────────────────────────────────────

export async function getImageUploadUrl(
  path: string
): Promise<{ signedUrl: string | null; path: string | null; publicUrl: string | null; error: string | null }> {
  await requireAdmin()
  const safeName = path.replace(/[^a-zA-Z0-9._/-]/g, "_")
  const fullPath = `email/${Date.now()}-${safeName}`

  const { data, error } = await serviceClient.storage
    .from("blog-media")
    .createSignedUploadUrl(fullPath)

  if (error || !data) {
    return { signedUrl: null, path: null, publicUrl: null, error: error?.message ?? "Failed" }
  }

  const { data: pub } = serviceClient.storage.from("blog-media").getPublicUrl(fullPath)

  return { signedUrl: data.signedUrl, path: fullPath, publicUrl: pub.publicUrl, error: null }
}

// ─── Supporting lookups ───────────────────────────────────────────────────────

export async function listEventsForEmail(): Promise<Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("events")
    .select("id, title, start_at, timezone")
    .is("archived_at", null)
    .order("start_at", { ascending: false })
    .limit(100)
  return data ?? []
}

export async function listContactsForFixed(
  ids: string[]
): Promise<Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "email" | "unsubscribed_at">[]> {
  await requireAdmin()
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, unsubscribed_at")
    .in("id", ids)
  return data ?? []
}

// Keep type exports available via re-export
export type { AudienceFilter, AudienceContact }
