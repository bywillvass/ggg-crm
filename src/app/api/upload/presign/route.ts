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
  if (!body?.token || !body?.documentTypeId || !body?.fileName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { token, documentTypeId, fileName } = body as {
    token: string
    documentTypeId: string
    fileName: string
    mimeType: string
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
  if (tokenRow.used_count >= 100) {
    return NextResponse.json({ error: "Upload limit reached" }, { status: 429 })
  }

  // Get participant to get player_id
  const { data: participant } = await serviceClient
    .from("event_participants")
    .select("player_id, event_id")
    .eq("id", payload.event_participant_id)
    .single()

  if (!participant?.player_id) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 })
  }

  // Build storage path
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
  const path = `events/${participant.event_id}/${participant.player_id}/${documentTypeId}/${Date.now()}-${sanitized}`

  const { data, error } = await serviceClient.storage
    .from("documents")
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create upload URL" }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path })
}
