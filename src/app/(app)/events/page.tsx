import { listEvents } from "./actions"
import { EventsShell } from "@/components/events/EventsShell"

export const dynamic = "force-dynamic"

export default async function EventsPage() {
  const events = await listEvents({ timeframe: "upcoming" })
  return <EventsShell initialEvents={events} />
}
