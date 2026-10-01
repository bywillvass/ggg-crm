import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import JSZip from "jszip"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = request.nextUrl
  const eventId = searchParams.get("eventId")
  const playerId = searchParams.get("playerId")
  const docTypeId = searchParams.get("docTypeId")

  if (!eventId && !playerId) {
    return NextResponse.json({ error: "eventId or playerId required" }, { status: 400 })
  }

  type DocRow = {
    id: string
    file_path: string
    file_name: string
    document_types: { name: string } | null
    players: { first_name: string | null; last_name: string | null } | null
    events: { title: string } | null
  }

  let query = serviceClient
    .from("documents")
    .select("id, file_path, file_name, document_types(name), players(first_name, last_name), events(title)")

  if (eventId) query = query.eq("event_id", eventId)
  if (playerId) query = query.eq("player_id", playerId)
  if (docTypeId) query = query.eq("document_type_id", docTypeId)

  const { data: docs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: "No documents found" }, { status: 404 })
  }

  const zip = new JSZip()

  await Promise.all((docs as unknown as DocRow[]).map(async (doc) => {
    const playerName = doc.players
      ? `${doc.players.first_name ?? ""} ${doc.players.last_name ?? ""}`.trim() || "Unknown"
      : "Unknown"
    const typeName = doc.document_types?.name ?? "Unknown"
    const eventTitle = doc.events?.title ?? "Unknown event"

    // Folder structure: by event if player download, by player if event download
    const folder = playerId
      ? `${eventTitle}/${typeName}`
      : `${playerName}/${typeName}`

    const { data, error: dlErr } = await serviceClient.storage
      .from("documents")
      .download(doc.file_path)
    if (dlErr || !data) return
    const buffer = await data.arrayBuffer()
    zip.file(`${folder}/${doc.file_name}`, buffer)
  }))

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })

  let zipName = "documents"
  if (eventId) {
    const { data: event } = await serviceClient.from("events").select("title").eq("id", eventId).single()
    zipName = (event?.title ?? "event").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_")
  } else if (playerId) {
    const { data: pl } = await serviceClient.from("players").select("first_name, last_name").eq("id", playerId).single()
    zipName = pl ? `${pl.first_name ?? ""}_${pl.last_name ?? ""}`.trim().replace(/\s+/g, "_") : "player"
  }

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}_documents.zip"`,
    },
  })
}
