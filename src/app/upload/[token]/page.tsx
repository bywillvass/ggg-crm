import { serviceClient } from "@/lib/supabase/service"
import { verifyToken, hashToken } from "@/lib/tokens"
import { UploadShell } from "./UploadShell"

export const dynamic = "force-dynamic"

interface TokenPayload {
  event_participant_id: string
  iat: number
  exp: number
}

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params
  const token = decodeURIComponent(rawToken)

  // Verify JWT
  const payload = await verifyToken<TokenPayload>(token)
  if (!payload) {
    return <ErrorPage message="This link is invalid or has expired." />
  }

  // Look up token record by hash
  const tokenHash = hashToken(token)
  const { data: tokenRow } = await serviceClient
    .from("document_request_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .single()

  if (!tokenRow) {
    return <ErrorPage message="This upload link was not found." />
  }
  if (tokenRow.revoked_at) {
    return <ErrorPage message="This upload link has been revoked." />
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return <ErrorPage message="This upload link has expired." />
  }
  if (tokenRow.used_count >= 100) {
    return <ErrorPage message="This upload link has reached its usage limit." />
  }

  // Load participant data
  const { data: participant } = await serviceClient
    .from("event_participants")
    .select(`
      id, player_id,
      events(id, title, start_at, end_at, venue_name, city),
      players(first_name, last_name)
    `)
    .eq("id", payload.event_participant_id)
    .single()

  if (!participant) {
    return <ErrorPage message="Participant not found." />
  }

  const p = participant as unknown as {
    id: string
    player_id: string | null
    events: { id: string; title: string; start_at: string; end_at: string | null; venue_name: string | null; city: string | null } | null
    players: { first_name: string | null; last_name: string | null } | null
  }

  if (!p.events) {
    return <ErrorPage message="Event not found." />
  }

  // Load requirements
  const { data: requirements } = await serviceClient
    .from("event_document_requirements")
    .select("*, document_types(*)")
    .eq("event_id", p.events.id)
    .order("created_at")

  // Load already-uploaded documents for this player + event
  let uploadedDocs: { document_type_id: string; file_name: string }[] = []
  if (p.player_id) {
    const { data: docs } = await serviceClient
      .from("documents")
      .select("document_type_id, file_name")
      .eq("player_id", p.player_id)
      .eq("event_id", p.events.id)
    uploadedDocs = docs ?? []
  }

  const playerName = p.players
    ? `${p.players.first_name ?? ""} ${p.players.last_name ?? ""}`.trim()
    : "Player"

  return (
    <UploadShell
      token={token}
      playerId={p.player_id}
      playerName={playerName}
      event={p.events}
      requirements={(requirements ?? []) as {
        id: string
        document_type_id: string
        required: boolean
        document_types: { id: string; name: string; description: string | null }
      }[]}
      uploadedDocTypeIds={uploadedDocs.map((d) => d.document_type_id)}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Link not valid</h1>
        <p className="text-sm text-gray-500">{message}</p>
        <p className="text-sm text-gray-400 mt-4">
          Contact Ginga Global Group for a new link.
        </p>
      </div>
    </div>
  )
}
