import { notFound } from "next/navigation"
import { getEvent, listEmailTemplates } from "../actions"
import { EventDetail } from "@/components/events/EventDetail"
import { getCurrentRole } from "@/lib/auth/role"

export const dynamic = "force-dynamic"

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [event, templates, role] = await Promise.all([
    getEvent(id),
    listEmailTemplates(),
    getCurrentRole(),
  ])

  if (!event) notFound()

  return <EventDetail event={event} templates={templates} role={role ?? "coach"} />
}
