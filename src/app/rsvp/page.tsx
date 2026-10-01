import { serviceClient } from "@/lib/supabase/service"
import { verifyToken } from "@/lib/tokens"
import { formatInTimeZone } from "date-fns-tz"

export const dynamic = "force-dynamic"

type TokenPayload = {
  event_participant_id: string
  iat: number
  exp: number
}

export default async function RsvpPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; answer?: string }>
}) {
  const { token, answer } = await searchParams

  if (!token) {
    return <Page title="Invalid link" message="This RSVP link is missing a token." />
  }

  const payload = await verifyToken<TokenPayload>(token)
  if (!payload?.event_participant_id) {
    return <Page title="Invalid link" message="This RSVP link is invalid or has expired." />
  }

  const { data: participantRaw } = await serviceClient
    .from("event_participants")
    .select(`
      id, status, event_id,
      events(id, title, start_at, timezone, venue_name, address, city, capacity),
      players(first_name, last_name),
      contacts(first_name, last_name)
    `)
    .eq("id", payload.event_participant_id)
    .single()

  if (!participantRaw) {
    return <Page title="Not found" message="We could not find your RSVP record." />
  }

  const participant = participantRaw as unknown as {
    id: string
    status: string
    event_id: string
    events: {
      id: string
      title: string
      start_at: string
      timezone: string
      venue_name: string | null
      address: string | null
      city: string | null
      capacity: number | null
    } | null
    players: { first_name: string | null; last_name: string | null } | null
    contacts: { first_name: string | null; last_name: string | null } | null
  }

  const event = participant.events
  if (!event) {
    return <Page title="Not found" message="This event is no longer available." />
  }

  const guestName = participant.players
    ? `${participant.players.first_name ?? ""} ${participant.players.last_name ?? ""}`.trim()
    : participant.contacts
      ? `${participant.contacts.first_name ?? ""} ${participant.contacts.last_name ?? ""}`.trim()
      : "Guest"

  const dateStr = formatInTimeZone(new Date(event.start_at), event.timezone, "EEEE d MMMM yyyy")
  const timeStr = formatInTimeZone(new Date(event.start_at), event.timezone, "h:mm a")

  // If answer is set, apply it
  let confirmationMessage: string | null = null
  if (answer === "yes" || answer === "no") {
    const now = new Date().toISOString()
    if (answer === "yes") {
      // Check capacity
      let newStatus: "confirmed" | "waitlisted" = "confirmed"
      if (event.capacity) {
        const { count } = await serviceClient
          .from("event_participants")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id)
          .in("status", ["confirmed", "attended"])
        if ((count ?? 0) >= event.capacity) {
          newStatus = "waitlisted"
        }
      }
      await serviceClient
        .from("event_participants")
        .update({ status: newStatus, status_updated_at: now, updated_at: now })
        .eq("id", participant.id)
      await serviceClient.from("activities").insert({
        type: "rsvp",
        event_id: event.id,
        body: `RSVP yes - ${guestName} (${newStatus})`,
        created_by: null,
      })
      confirmationMessage = newStatus === "waitlisted"
        ? `This event is at capacity. We have added ${guestName} to the waitlist and will contact you if a spot opens.`
        : `Thanks ${guestName}. Your attendance has been confirmed.`
    } else {
      await serviceClient
        .from("event_participants")
        .update({ status: "declined", status_updated_at: now, updated_at: now })
        .eq("id", participant.id)
      await serviceClient.from("activities").insert({
        type: "rsvp",
        event_id: event.id,
        body: `RSVP no - ${guestName}`,
        created_by: null,
      })
      confirmationMessage = `Thanks for letting us know. We have marked ${guestName} as declined.`
    }
  }

  return (
    <Page title={event.title} message="">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-2">{event.title}</div>
          <div className="text-gray-700">{dateStr}</div>
          <div className="text-gray-700">at {timeStr}</div>
          {event.venue_name && (
            <div className="text-gray-600 mt-1">
              {event.venue_name}{event.city ? `, ${event.city}` : ""}
            </div>
          )}
          {event.address && (
            <div className="text-gray-500 text-xs mt-0.5">{event.address}</div>
          )}
        </div>

        {confirmationMessage ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {confirmationMessage}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-700 mb-3">
              Hi {guestName}, please confirm whether you can attend this event.
            </p>
            <div className="flex gap-2">
              <a
                href={`/rsvp?token=${encodeURIComponent(token)}&answer=yes`}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-[#C9A227] hover:bg-[#b8911f] text-white font-medium text-sm px-4 py-2.5"
              >
                Yes, attending
              </a>
              <a
                href={`/rsvp?token=${encodeURIComponent(token)}&answer=no`}
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm px-4 py-2.5"
              >
                Cannot attend
              </a>
            </div>
          </div>
        )}
      </div>
    </Page>
  )
}

function Page({
  title,
  message,
  children,
}: {
  title: string
  message: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full overflow-hidden">
        <div className="bg-[#0C0F4C] px-6 py-4">
          <div className="text-base font-bold text-[#C9A227]">Ginga Global Group</div>
        </div>
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
          {message && <p className="text-sm text-gray-600 leading-relaxed">{message}</p>}
          {children && <div className={message ? "mt-6" : ""}>{children}</div>}
        </div>
      </div>
    </div>
  )
}
