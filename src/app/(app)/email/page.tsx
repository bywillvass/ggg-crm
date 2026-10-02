import { listCampaigns, listTemplates, listEventsForEmail, listSubscribers } from "./actions"
import { EmailShell } from "@/components/email/EmailShell"

export const dynamic = "force-dynamic"

export default async function EmailPage() {
  const [campaigns, templates, events, subscribers] = await Promise.all([
    listCampaigns(),
    listTemplates(),
    listEventsForEmail(),
    listSubscribers(),
  ])
  return <EmailShell initialCampaigns={campaigns} templates={templates} events={events} subscribers={subscribers} />
}
