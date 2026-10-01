import { listCampaigns, listTemplates, listEventsForEmail } from "./actions"
import { EmailShell } from "@/components/email/EmailShell"

export const dynamic = "force-dynamic"

export default async function EmailPage() {
  const [campaigns, templates, events] = await Promise.all([
    listCampaigns(),
    listTemplates(),
    listEventsForEmail(),
  ])
  return <EmailShell initialCampaigns={campaigns} templates={templates} events={events} />
}
