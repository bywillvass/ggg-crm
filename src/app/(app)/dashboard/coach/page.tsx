import { redirect } from "next/navigation"
import { getCurrentRole, getAuthUser } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { cn } from "cn"

export const dynamic = "force-dynamic"

const eventTypePill: Record<string, string> = {
  trial: "bg-blue-100 text-blue-800",
  training: "bg-green-100 text-green-800",
  tour: "bg-purple-100 text-purple-800",
  showcase: "bg-yellow-100 text-yellow-800",
  camp: "bg-orange-100 text-orange-800",
  other: "bg-gray-100 text-gray-700",
}

const recommendationBadge: Record<string, string> = {
  sign: "bg-green-100 text-green-800",
  monitor: "bg-yellow-100 text-yellow-800",
  pass: "bg-gray-100 text-gray-600",
}

export default async function CoachDashboardPage() {
  const role = await getCurrentRole()
  if (role === "admin") redirect("/dashboard")

  const user = await getAuthUser()
  if (!user) redirect("/login")
  const supabase = await createClient()

  const [profileRes, upcomingEventsRes, recentAssessmentsRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("events")
      .select("id, title, start_at, type, status, capacity")
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(10),
    supabase
      .from("assessments")
      .select("*, players(first_name, last_name), events(title, start_at)")
      .eq("assessor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const coachName = profileRes.data?.full_name ?? "Coach"
  const upcomingEvents = upcomingEventsRes.data ?? []
  const recentAssessments = recentAssessmentsRes.data ?? []

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#0C0F4C]">Welcome back, {coachName}</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s coming up and your recent assessments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming events */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-[#0C0F4C] mb-3">Upcoming Events</h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming events.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3">
                  <div className="w-10 text-center shrink-0">
                    <p className="text-xs text-gray-400 leading-none">
                      {new Date(ev.start_at).toLocaleDateString("en-AU", { month: "short" })}
                    </p>
                    <p className="text-lg font-bold text-[#0C0F4C] leading-tight">
                      {new Date(ev.start_at).getDate()}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", eventTypePill[ev.type] ?? "bg-gray-100 text-gray-600")}>
                        {ev.type}
                      </span>
                      <span className="text-xs text-gray-400">{ev.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent assessments */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-[#0C0F4C] mb-3">My Recent Assessments</h2>
          {recentAssessments.length === 0 ? (
            <p className="text-sm text-gray-400">No assessments yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentAssessments.map((a) => {
                const playerName = a.players
                  ? `${a.players.first_name} ${a.players.last_name}`
                  : "Unknown player"
                const eventTitle = a.events?.title ?? "Unknown event"
                return (
                  <li key={a.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{playerName}</p>
                        <p className="text-xs text-gray-400 truncate">{eventTitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.overall !== null && (
                          <span className="text-sm font-bold text-[#0C0F4C]">{a.overall}/10</span>
                        )}
                        {a.recommendation && (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", recommendationBadge[a.recommendation] ?? "bg-gray-100 text-gray-600")}>
                            {a.recommendation}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
