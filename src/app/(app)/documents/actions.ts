"use server"

import { requireAdmin, requireAuth } from "@/lib/auth/role"
import { serviceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { signToken, hashToken } from "@/lib/tokens"
import type { Tables, TablesInsert } from "@/lib/database.types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentTypeRow = Tables<"document_types">

export type RequirementRow = Tables<"event_document_requirements"> & {
  document_types: DocumentTypeRow
}

export type DocumentRow = Tables<"documents"> & {
  document_types: DocumentTypeRow
}

export type MatrixParticipant = {
  participant_id: string
  player_id: string | null
  player_name: string
  documents: Record<
    string,
    {
      document_id: string
      file_name: string
      uploaded_via: string
      expires_on: string | null
      expiring_soon: boolean
    } | null
  >
}

export type DocumentMatrix = {
  requirements: RequirementRow[]
  participants: MatrixParticipant[]
}

// ─── Requirements ─────────────────────────────────────────────────────────────

export async function getEventDocumentMatrix(eventId: string): Promise<DocumentMatrix> {
  await requireAdmin()
  const supabase = await createClient()

  const [reqRes, participantsRes] = await Promise.all([
    supabase
      .from("event_document_requirements")
      .select("*, document_types(*)")
      .eq("event_id", eventId)
      .order("created_at"),

    supabase
      .from("event_participants")
      .select(`
        id, player_id, contact_id,
        players(id, first_name, last_name),
        contacts(id, first_name, last_name)
      `)
      .eq("event_id", eventId)
      .not("status", "in", '("declined","cancelled")'),
  ])

  const requirements = (reqRes.data ?? []) as RequirementRow[]
  const participantRows = participantsRes.data ?? []

  if (requirements.length === 0 || participantRows.length === 0) {
    return { requirements, participants: [] }
  }

  // Get the event's end_at for expiry check
  const { data: event } = await supabase
    .from("events")
    .select("end_at")
    .eq("id", eventId)
    .single()
  const eventEnd = event?.end_at ? new Date(event.end_at) : null

  // Fetch all documents for this event
  const playerIds = participantRows
    .map((p) => (p as unknown as { player_id: string | null }).player_id)
    .filter(Boolean) as string[]

  let docRows: DocumentRow[] = []
  if (playerIds.length > 0) {
    const { data } = await supabase
      .from("documents")
      .select("*, document_types(*)")
      .eq("event_id", eventId)
      .in("player_id", playerIds)
    docRows = (data ?? []) as DocumentRow[]
  }

  const participants: MatrixParticipant[] = participantRows.map((p) => {
    const raw = p as unknown as {
      id: string
      player_id: string | null
      contact_id: string | null
      players: { id: string; first_name: string | null; last_name: string | null } | null
      contacts: { id: string; first_name: string | null; last_name: string | null } | null
    }

    const playerName = raw.players
      ? `${raw.players.first_name ?? ""} ${raw.players.last_name ?? ""}`.trim()
      : raw.contacts
      ? `${raw.contacts.first_name ?? ""} ${raw.contacts.last_name ?? ""}`.trim()
      : "Unknown"

    const docMap: MatrixParticipant["documents"] = {}
    for (const req of requirements) {
      const doc = docRows.find(
        (d) => d.document_type_id === req.document_type_id && d.player_id === raw.player_id
      )
      if (doc) {
        const expiresOn = doc.expires_on ? new Date(doc.expires_on) : null
        const expiringSoon = expiresOn && eventEnd ? expiresOn < eventEnd : false
        docMap[req.document_type_id] = {
          document_id: doc.id,
          file_name: doc.file_name,
          uploaded_via: doc.uploaded_via,
          expires_on: doc.expires_on,
          expiring_soon: expiringSoon,
        }
      } else {
        docMap[req.document_type_id] = null
      }
    }

    return {
      participant_id: raw.id,
      player_id: raw.player_id,
      player_name: playerName,
      documents: docMap,
    }
  })

  return { requirements, participants }
}

export async function addRequirement(
  eventId: string,
  documentTypeId: string,
  required: boolean,
  notes: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase.from("event_document_requirements").insert({
    event_id: eventId,
    document_type_id: documentTypeId,
    required,
    notes: notes || null,
  })

  return { error: error?.message ?? null }
}

export async function removeRequirement(
  eventId: string,
  documentTypeId: string
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("event_document_requirements")
    .delete()
    .eq("event_id", eventId)
    .eq("document_type_id", documentTypeId)

  return { error: error?.message ?? null }
}

export async function listDocumentTypes(): Promise<DocumentTypeRow[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from("document_types").select("*").order("name")
  return data ?? []
}

// ─── Document CRUD ───────────────────────────────────────────────────────────

export async function recordDocument(
  input: Omit<TablesInsert<"documents">, "uploaded_by">
): Promise<{ data: Tables<"documents"> | null; error: string | null }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  // Set retention delete_after if sensitive type
  let deleteAfter: string | null = null
  if (input.event_id) {
    const { data: docType } = await supabase
      .from("document_types")
      .select("sensitive, retention_days_after_event")
      .eq("id", input.document_type_id)
      .single()

    if (docType?.sensitive && docType.retention_days_after_event) {
      const { data: event } = await supabase
        .from("events")
        .select("end_at")
        .eq("id", input.event_id)
        .single()

      if (event?.end_at) {
        const d = new Date(event.end_at)
        d.setDate(d.getDate() + docType.retention_days_after_event)
        deleteAfter = d.toISOString().slice(0, 10)
      }
    }
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({ ...input, uploaded_by: user.id, uploaded_via: "crm", delete_after: deleteAfter })
    .select()
    .single()

  if (data) {
    await logActivity({
      type: "document_uploaded",
      player_id: input.player_id ?? undefined,
      event_id: input.event_id ?? undefined,
      body: `Document uploaded: ${input.file_name}`,
      created_by: user.id,
    })
  }

  return { data, error: error?.message ?? null }
}

export async function deleteDocument(documentId: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .single()

  if (doc) {
    await serviceClient.storage.from("documents").remove([doc.file_path])
  }

  const { error } = await supabase.from("documents").delete().eq("id", documentId)
  return { error: error?.message ?? null }
}

export async function getDocumentSignedUrl(filePath: string): Promise<{ url: string | null; error: string | null }> {
  await requireAdmin()
  const { data, error } = await serviceClient.storage
    .from("documents")
    .createSignedUrl(filePath, 60)
  return { url: data?.signedUrl ?? null, error: error?.message ?? null }
}

// ─── Player documents ─────────────────────────────────────────────────────────

export type PlayerDocumentRow = Tables<"documents"> & {
  document_types: DocumentTypeRow
  events: { id: string; title: string; start_at: string } | null
}

export async function getPlayerDocuments(playerId: string): Promise<PlayerDocumentRow[]> {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("documents")
    .select("*, document_types(*), events(id, title, start_at)")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
  return (data ?? []) as PlayerDocumentRow[]
}

// ─── Admin upload presign ──────────────────────────────────────────────────────

export async function getAdminUploadPresignedUrl(
  path: string
): Promise<{ signedUrl: string | null; error: string | null }> {
  await requireAdmin()
  const { data, error } = await serviceClient.storage
    .from("documents")
    .createSignedUploadUrl(path)
  return { signedUrl: data?.signedUrl ?? null, error: error?.message ?? null }
}

// ─── Request missing documents ───────────────────────────────────────────────

export async function requestMissingDocuments(
  eventId: string
): Promise<{ tokens: { participantId: string; playerName: string; url: string }[]; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  // Get event details
  const { data: event } = await supabase
    .from("events")
    .select("title, end_at")
    .eq("id", eventId)
    .single()

  if (!event) return { tokens: [], error: "Event not found" }

  // Get participants with missing documents
  const matrix = await getEventDocumentMatrix(eventId)
  const participantsWithMissing = matrix.participants.filter((p) =>
    matrix.requirements.some(
      (req) => req.required && matrix.participants
        .find((mp) => mp.participant_id === p.participant_id)
        ?.documents[req.document_type_id] === null
    )
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.gingaglobalgroup.com"
  const tokens: { participantId: string; playerName: string; url: string }[] = []

  for (const participant of participantsWithMissing) {
    // Check if there's already a valid non-revoked token
    const { data: existingTokens } = await supabase
      .from("document_request_tokens")
      .select("*")
      .eq("event_participant_id", participant.participant_id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)

    let uploadToken: string

    if (existingTokens && existingTokens.length > 0) {
      // Re-use existing token - we can't recover the original JWT from the hash,
      // so generate a new one and update the hash
      uploadToken = await signToken({ event_participant_id: participant.participant_id }, "30d")
      const tokenHash = hashToken(uploadToken)
      await supabase
        .from("document_request_tokens")
        .update({ token_hash: tokenHash, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", existingTokens[0].id)
    } else {
      uploadToken = await signToken({ event_participant_id: participant.participant_id }, "30d")
      const tokenHash = hashToken(uploadToken)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      await supabase.from("document_request_tokens").insert({
        event_participant_id: participant.participant_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used_count: 0,
      })
    }

    const uploadUrl = `${appUrl}/upload/${encodeURIComponent(uploadToken)}`
    tokens.push({ participantId: participant.participant_id, playerName: participant.player_name, url: uploadUrl })

    // Queue email to primary contact
    const { data: participantData } = await supabase
      .from("event_participants")
      .select(`
        player_id,
        players(player_contacts(is_primary, contacts(id, first_name, email)))
      `)
      .eq("id", participant.participant_id)
      .single()

    if (participantData) {
      const pd = participantData as unknown as {
        players: {
          player_contacts: {
            is_primary: boolean
            contacts: { id: string; first_name: string | null; email: string | null } | null
          }[]
        } | null
      }
      const primaryContact = pd.players?.player_contacts?.find((pc) => pc.is_primary)?.contacts

      if (primaryContact?.email) {
        const greeting = primaryContact.first_name ? `Hi ${primaryContact.first_name},` : "Hello,"
        const bodyHtml = `<p>${greeting}</p>
<p>We need you to upload some documents for <strong>${participant.player_name}</strong> for <strong>${event.title}</strong>.</p>
<p>Please click the link below to upload the required documents:</p>
<p><a href="${uploadUrl}">${uploadUrl}</a></p>
<p>This link expires in 30 days.</p>`

        await supabase.from("email_messages").insert({
          contact_id: primaryContact.id,
          to_email: primaryContact.email,
          subject: `Documents required - ${event.title}`,
          body_html: bodyHtml,
          body_text: `${greeting}\n\nPlease upload documents for ${participant.player_name} for ${event.title}:\n\n${uploadUrl}\n\nThis link expires in 30 days.`,
          event_id: eventId,
          player_id: participant.player_id ?? undefined,
          status: "queued",
        })
      }
    }

    await logActivity({
      type: "document_requested",
      event_id: eventId,
      player_id: participant.player_id ?? undefined,
      body: `Document upload requested for ${participant.player_name}`,
    })
  }

  return { tokens, error: null }
}
