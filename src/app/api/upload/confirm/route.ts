import { NextRequest, NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { verifyToken, hashToken } from "@/lib/tokens"

interface TokenPayload {
  event_participant_id: string
  iat: number
  exp: number
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.token || !body?.documentTypeId || !body?.filePath) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { token, documentTypeId, playerId, eventId, filePath, fileName, mimeType, sizeBytes } = body as {
    token: string
    documentTypeId: string
    playerId: string | null
    eventId: string
    filePath: string
    fileName: string
    mimeType: string
    sizeBytes: number
  }

  // Verify JWT
  const payload = await verifyToken<TokenPayload>(token)
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  // Look up token record
  const tokenHash = hashToken(token)
  const { data: tokenRow } = await serviceClient
    .from("document_request_tokens")
    .select("id, revoked_at, expires_at, used_count, event_participant_id")
    .eq("token_hash", tokenHash)
    .single()

  if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token invalid or expired" }, { status: 401 })
  }

  if (!playerId) {
    return NextResponse.json({ error: "No player associated with this participant" }, { status: 400 })
  }

  // Compute delete_after for sensitive types
  let deleteAfter: string | null = null
  const { data: docType } = await serviceClient
    .from("document_types")
    .select("sensitive, retention_days_after_event")
    .eq("id", documentTypeId)
    .single()

  if (docType?.sensitive && docType.retention_days_after_event) {
    const { data: event } = await serviceClient
      .from("events")
      .select("end_at")
      .eq("id", eventId)
      .single()
    if (event?.end_at) {
      const d = new Date(event.end_at)
      d.setDate(d.getDate() + docType.retention_days_after_event)
      deleteAfter = d.toISOString().slice(0, 10)
    }
  }

  // Create document record
  const { error: docErr } = await serviceClient.from("documents").insert({
    player_id: playerId,
    event_id: eventId,
    document_type_id: documentTypeId,
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType || null,
    size_bytes: sizeBytes,
    uploaded_via: "parent_link",
    delete_after: deleteAfter,
  })

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 })
  }

  // Increment used_count
  await serviceClient
    .from("document_request_tokens")
    .update({ used_count: (tokenRow.used_count ?? 0) + 1 })
    .eq("id", tokenRow.id)

  // Log activity
  await serviceClient.from("activities").insert({
    type: "document_uploaded",
    player_id: playerId,
    event_id: eventId,
    body: `Document uploaded via parent link: ${fileName}`,
    created_by: null,
  })

  return NextResponse.json({ ok: true })
}
