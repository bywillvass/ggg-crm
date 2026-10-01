import { NextRequest, NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { verifyToken } from "@/lib/tokens"

export const dynamic = "force-dynamic"

type TokenPayload = {
  contact_id: string
  iat: number
  exp: number
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  const payload = await verifyToken<TokenPayload>(body.token)
  if (!payload?.contact_id) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  const { data: contact } = await serviceClient
    .from("contacts")
    .select("id, unsubscribed_at")
    .eq("id", payload.contact_id)
    .single()

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  if (contact.unsubscribed_at) {
    return NextResponse.json({ ok: true, alreadyUnsubscribed: true })
  }

  const now = new Date().toISOString()
  await serviceClient
    .from("contacts")
    .update({ unsubscribed_at: now, updated_at: now })
    .eq("id", contact.id)

  await serviceClient.from("activities").insert({
    type: "unsubscribed",
    contact_id: contact.id,
    body: "Unsubscribed via email link",
    created_by: null,
  })

  return NextResponse.json({ ok: true })
}
