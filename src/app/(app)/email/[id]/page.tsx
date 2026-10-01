import { notFound } from "next/navigation"
import { getCampaign, listTemplates, listEventsForEmail } from "../actions"
import { CampaignDetail } from "@/components/email/CampaignDetail"

export const dynamic = "force-dynamic"

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [campaign, templates, events] = await Promise.all([
    getCampaign(id),
    listTemplates(),
    listEventsForEmail(),
  ])

  if (!campaign) notFound()

  return <CampaignDetail campaign={campaign} templates={templates} events={events} />
}
