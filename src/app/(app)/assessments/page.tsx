import { listAssessments, listEventsForSelect } from "./actions"
import { AssessmentsShell } from "@/components/assessments/AssessmentsShell"
import { requireAuth } from "@/lib/auth/role"

export const dynamic = "force-dynamic"

export default async function AssessmentsPage() {
  const [assessments, events, user] = await Promise.all([
    listAssessments(),
    listEventsForSelect(),
    requireAuth(),
  ])

  return (
    <AssessmentsShell
      initialAssessments={assessments}
      events={events}
      currentUserId={user.id}
    />
  )
}
