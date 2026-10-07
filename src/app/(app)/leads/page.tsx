import { Suspense } from "react"
import { listLeads } from "./actions"
import { getProfiles } from "@/app/(app)/tasks/actions"
import { LeadsShell } from "@/components/leads/LeadsShell"

async function LeadsContent() {
  const [leads, profiles] = await Promise.all([
    listLeads(),
    getProfiles(),
  ])
  return <LeadsShell leads={leads} profiles={profiles} />
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>}>
      <LeadsContent />
    </Suspense>
  )
}
