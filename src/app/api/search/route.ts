import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/auth/role"
import { phoneSearchKey, isPhoneQuery } from "@/lib/phone"

// All words in the query must appear somewhere in the combined text.
function matchesAllWords(words: string[], ...fields: (string | null | undefined)[]): boolean {
  const combined = fields.filter(Boolean).join(" ").toLowerCase()
  return words.every((w) => combined.includes(w))
}

type PrimaryContact = {
  first_name: string | null
  last_name: string | null
  phone: string | null
} | null

type LinkedPlayer = {
  id: string
  first_name: string | null
  last_name: string | null
  birth_year: number | null
} | null

export async function GET(request: NextRequest) {
  const role = await getCurrentRole()
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const raw = request.nextUrl.searchParams.get("q") ?? ""
  if (raw.length < 2) return NextResponse.json({ contacts: [], players: [], leads: [], events: [] })

  const supabase = await createClient()
  const isAdmin = role === "admin"

  const words = raw.toLowerCase().split(/\s+/).filter(Boolean)
  const firstWord = words[0]
  const phoneQ = isPhoneQuery(raw)
  const phoneKey = phoneQ ? phoneSearchKey(raw) : ""

  // ── Phase 1: players, events, contacts in parallel ──────────────────────────
  const [playersRes, eventsRes, contactsRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, birth_year, position, current_club, player_contacts(is_primary, contacts(first_name, last_name, phone))")
      .is("archived_at", null)
      .or(`first_name.ilike.%${firstWord}%,last_name.ilike.%${firstWord}%,current_club.ilike.%${firstWord}%`)
      .limit(15),

    supabase
      .from("events")
      .select("id, title, start_at, type")
      .is("archived_at", null)
      .or(`title.ilike.%${firstWord}%,venue_name.ilike.%${firstWord}%,city.ilike.%${firstWord}%`)
      .limit(8),

    isAdmin
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, contact_type, player_contacts(is_primary, players(id, first_name, last_name, birth_year))")
          .is("archived_at", null)
          .or(
            phoneQ && phoneKey.length >= 7
              ? `phone_digits.ilike.%${phoneKey}%`
              : `first_name.ilike.%${firstWord}%,last_name.ilike.%${firstWord}%,email.ilike.%${firstWord}%`
          )
          .limit(15)
      : Promise.resolve({ data: [] as never[] }),
  ])

  // ── Phase 2: leads, keyed off matched contact/player IDs ────────────────────
  const contactIds = (contactsRes.data ?? []).map((c) => c.id).slice(0, 20)
  const playerIds = (playersRes.data ?? []).map((p) => p.id).slice(0, 20)

  const leadsOrParts: string[] = []
  if (contactIds.length) leadsOrParts.push(`contact_id.in.(${contactIds.join(",")})`)
  if (playerIds.length) leadsOrParts.push(`player_id.in.(${playerIds.join(",")})`)
  leadsOrParts.push(`campaign_name.ilike.%${firstWord}%`)
  leadsOrParts.push(`form_type.ilike.%${firstWord}%`)

  const leadsRes = isAdmin
    ? await supabase
        .from("leads")
        .select("id, source, stage, form_type, campaign_name, contacts(first_name, last_name), players(first_name, last_name)")
        .is("archived_at", null)
        .or(leadsOrParts.join(","))
        .limit(12)
    : { data: [] as never[] }

  // ── Multi-word JS filter + slice to 5 ───────────────────────────────────────
  const players = (playersRes.data ?? [])
    .filter((p) => matchesAllWords(words, p.first_name, p.last_name, p.current_club))
    .slice(0, 5)
    .map((p) => {
      const primary = (p.player_contacts as { is_primary: boolean; contacts: PrimaryContact }[])
        ?.find((pc) => pc.is_primary)?.contacts ?? null
      return { id: p.id, first_name: p.first_name, last_name: p.last_name, birth_year: p.birth_year, position: p.position, parent: primary }
    })

  const contacts = (contactsRes.data ?? [])
    .filter((c) => {
      if (phoneQ && phoneKey.length >= 7) return true
      return matchesAllWords(words, c.first_name, c.last_name, c.email, c.phone)
    })
    .slice(0, 5)
    .map((c) => {
      const linkedPlayers = (c.player_contacts as { is_primary: boolean; players: LinkedPlayer }[])
        ?.map((pc) => pc.players)
        .filter(Boolean)
        .slice(0, 3) ?? []
      return { id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, contact_type: c.contact_type, players: linkedPlayers }
    })

  const leads = (leadsRes.data ?? [])
    .filter((l) => {
      const c = l.contacts as { first_name: string | null; last_name: string | null } | null
      const p = l.players as { first_name: string | null; last_name: string | null } | null
      return matchesAllWords(words, c?.first_name, c?.last_name, p?.first_name, p?.last_name, l.campaign_name, l.form_type)
    })
    .slice(0, 5)

  const events = (eventsRes.data ?? [])
    .filter((e) => matchesAllWords(words, e.title))
    .slice(0, 5)

  return NextResponse.json({ contacts, players, leads, events })
}
