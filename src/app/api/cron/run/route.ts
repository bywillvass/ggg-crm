import { NextRequest, NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import {
  processEmailQueue,
  scheduleEventReminders,
  markOverdueInvoices,
  recalculateCampaignCounts,
} from "@/lib/email/sender"
import { resolveAudienceServer } from "@/lib/email/audience"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const secretHeader = request.headers.get("x-cron-secret")
  const expected = process.env.CRON_SECRET
  if (!expected || secretHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Activate scheduled campaigns whose scheduled_at <= now
  const now = new Date().toISOString()
  const { data: dueCampaigns } = await serviceClient
    .from("email_campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)

  let queued = 0
  for (const campaign of dueCampaigns ?? []) {
    await serviceClient
      .from("email_campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaign.id)

    const audience = campaign.audience as unknown
    const { contacts } = await resolveAudienceServer(audience)
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
        status: "queued",
      })
      queued++
    }
    await recalculateCampaignCounts(campaign.id)
  }

  const queueResult = await processEmailQueue(40)
  const reminderResult = await scheduleEventReminders()
  const overdueResult = await markOverdueInvoices()

  // Mark any sending campaigns with no remaining queued messages as sent
  const { data: sendingCampaigns } = await serviceClient
    .from("email_campaigns")
    .select("id")
    .eq("status", "sending")

  for (const c of sendingCampaigns ?? []) {
    const { count } = await serviceClient
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id)
      .eq("status", "queued")
    if ((count ?? 0) === 0) {
      await serviceClient
        .from("email_campaigns")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id)
    }
  }

  return NextResponse.json({
    ok: true,
    queued,
    sent: queueResult.sent,
    failed: queueResult.failed,
    skipped: queueResult.skipped,
    reminders: reminderResult.reminders,
    overdueInvoices: overdueResult.overdueInvoices,
  })
}
