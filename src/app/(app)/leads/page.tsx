import { listLeads } from "./actions"
import { getProfiles } from "@/app/(app)/tasks/actions"
import { LeadsShell } from "@/components/leads/LeadsShell"

export default async function LeadsPage() {
  const [leads, profiles] = await Promise.all([
    listLeads(),
    getProfiles(),
  ])

  return <LeadsShell leads={leads} profiles={profiles} />
}
