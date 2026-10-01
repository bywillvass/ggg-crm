import { notFound } from "next/navigation"
import { getLead } from "../actions"
import { LeadDetail } from "@/components/leads/LeadDetail"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const lead = await getLead(id)

  if (!lead) {
    notFound()
  }

  return <LeadDetail lead={lead} />
}
