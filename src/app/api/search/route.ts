import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/auth/role"

export async function GET(request: NextRequest) {
  const role = await getCurrentRole()
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q") ?? ""
  if (q.length < 2) {
    return NextResponse.json({ contacts: [], players: [], leads: [], events: [] })
  }

  const supabase = await createClient()
  const isAdmin = role === "admin"

  const [playersRes, eventsRes, contactsRes, leadsRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, birth_year, position")
      .is("archived_at", null)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(5),

    supabase
      .from("events")
      .select("id, title, start_at, type")
      .is("archived_at", null)
      .ilike("title", `%${q}%`)
      .limit(5),

    isAdmin
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .is("archived_at", null)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5)
      : Promise.resolve({ data: [] }),

    isAdmin
      ? supabase
          .from("leads")
          .select("id, source, stage, contacts(first_name, last_name), players(first_name, last_name)")
          .is("archived_at", null)
          .limit(5)
      : Promise.resolve({ data: [] }),
  ])

  return NextResponse.json({
    contacts: contactsRes.data ?? [],
    players: playersRes.data ?? [],
    leads: leadsRes.data ?? [],
    events: eventsRes.data ?? [],
  })
}
