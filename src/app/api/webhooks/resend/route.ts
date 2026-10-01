import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { serviceClient } from "@/lib/supabase/service"
import { recalculateCampaignCounts } from "@/lib/email/sender"

export const dynamic = "force-dynamic"

type ResendEvent = {
  type: string
  created_at: string
  data: {
    email_id?: string
    to?: string | string[]
    subject?: string
    created_at?: string
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const svixId = request.headers.get("svix-id")
  const svixTimestamp = request.headers.get("svix-timestamp")
  const svixSignature = request.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await request.text()

  let event: ResendEvent
  try {
    const wh = new Webhook(secret)
    const verified = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    })
    event = verified as unknown as ResendEvent
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const emailId = event.data?.email_id
  if (!emailId) {
    return NextResponse.json({ ok: true, note: "no email_id" })
  }

  const { data: message } = await serviceClient
    .from("email_messages")
    .select("id, campaign_id, contact_id")
    .eq("resend_id", emailId)
    .single()

  if (!message) {
    return NextResponse.json({ ok: true, note: "message not found" })
  }

  const now = new Date().toISOString()

  switch (event.type) {
    case "email.delivered":
      await serviceClient
        .from("email_messages")
        .update({ status: "delivered", delivered_at: now, updated_at: now })
        .eq("id", message.id)
      break
    case "email.opened":
      await serviceClient
        .from("email_messages")
        .update({ status: "opened", opened_at: now, updated_at: now })
        .eq("id", message.id)
      break
    case "email.clicked":
      await serviceClient
        .from("email_messages")
        .update({ status: "clicked", clicked_at: now, updated_at: now })
        .eq("id", message.id)
      break
    case "email.bounced":
    case "email.complained": {
      const status = event.type === "email.bounced" ? "bounced" : "complained"
      await serviceClient
        .from("email_messages")
        .update({ status, bounced_at: now, updated_at: now })
        .eq("id", message.id)
      // Unsubscribe contact
      await serviceClient
        .from("contacts")
        .update({ unsubscribed_at: now, updated_at: now })
        .eq("id", message.contact_id)
      await serviceClient.from("activities").insert({
        type: "unsubscribed",
        contact_id: message.contact_id,
        body: event.type === "email.bounced" ? "Email bounced" : "Marked as spam",
        created_by: null,
      })
      break
    }
    default:
      // Unknown event type, ignore
      break
  }

  if (message.campaign_id) {
    await recalculateCampaignCounts(message.campaign_id)
  }

  return NextResponse.json({ ok: true })
}
