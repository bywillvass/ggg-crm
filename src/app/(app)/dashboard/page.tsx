import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { cn } from "cn"

export const dynamic = "force-dynamic"

function formatAUD(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function activityIcon(type: string) {
  const map: Record<string, string> = {
    note: "📝",
    call: "📞",
    sms: "💬",
    whatsapp: "📱",
    lead_created: "✨",
    lead_stage_changed: "🔄",
    document_requested: "📄",
    document_uploaded: "📤",
    rsvp: "📅",
    email_sent: "📧",
    assessment_added: "📊",
  }
  return map[type] ?? "•"
}

type ActivityRow = {
  id: string
  type: string
  body: string | null
  created_at: string
  contacts: { full_name: string | null } | null
  players: { first_name: string; last_name: string } | null
  profiles: { full_name: string | null } | null
}

type TaskRow = {
  id: string
  title: string
  due_at: string | null
  contacts: { full_name: string | null } | null
  players: { first_name: string; last_name: string } | null
}

type EventRow = {
  id: string
  title: string
  start_at: string
  type: string
  status: string
  capacity: number | null
  confirmed: number
}

export default async function DashboardPage() {
  const role = await getCurrentRole()
  if (role === "coach") redirect("/dashboard/coach")

  const supabase = await createClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    leadsThisWeekRes,
    leadsLastWeekRes,
    leadsByStageRes,
    upcomingEventsRes,
    invoiceOutstandingRes,
    invoiceOverdueRes,
    invoicePaidMonthRes,
    dueTasksRes,
    recentActivityRes,
  ] = await Promise.all([
    supabase.from("leads").select("source").gte("created_at", sevenDaysAgo),
    supabase.from("leads").select("source").gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
    supabase.from("leads").select("stage, id").is("archived_at", null),
    supabase
      .from("events")
      .select("id, title, start_at, type, status, capacity")
      .gte("start_at", now.toISOString())
      .lte("start_at", thirtyDaysFromNow)
      .order("start_at")
      .limit(6),
    supabase
      .from("invoices")
      .select("total_cents, amount_paid_cents")
      .in("status", ["sent", "part_paid"]),
    supabase
      .from("invoices")
      .select("total_cents, amount_paid_cents")
      .eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("amount_paid_cents")
      .eq("status", "paid")
      .gte("updated_at", startOfMonth),
    supabase
      .from("tasks")
      .select("*, contacts(full_name), players(first_name, last_name)")
      .is("done_at", null)
      .lte("due_at", now.toISOString())
      .order("due_at")
      .limit(10),
    supabase
      .from("activities")
      .select("*, contacts(full_name), players(first_name, last_name), profiles!activities_created_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(15),
  ])

  // Compute leads this week count
  const leadsThisWeek = leadsThisWeekRes.data?.length ?? 0
  const leadsLastWeek = leadsLastWeekRes.data?.length ?? 0
  const leadsDelta = leadsThisWeek - leadsLastWeek

  // Leads by stage
  const stageCountMap: Record<string, number> = {}
  for (const row of leadsByStageRes.data ?? []) {
    stageCountMap[row.stage] = (stageCountMap[row.stage] ?? 0) + 1
  }
  const stageOrder = ["new", "contacted", "interested", "confirmed", "signed", "not_interested", "lost"]
  const stageLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    interested: "Interested",
    confirmed: "Confirmed",
    signed: "Signed",
    not_interested: "Not Interested",
    lost: "Lost",
  }
  const maxStageCount = Math.max(1, ...stageOrder.map((s) => stageCountMap[s] ?? 0))

  // Invoice summary
  const outstandingCents = (invoiceOutstandingRes.data ?? []).reduce(
    (sum, inv) => sum + Math.max(0, inv.total_cents - inv.amount_paid_cents),
    0
  )
  const overdueCents = (invoiceOverdueRes.data ?? []).reduce(
    (sum, inv) => sum + Math.max(0, inv.total_cents - inv.amount_paid_cents),
    0
  )
  const paidThisMonthCents = (invoicePaidMonthRes.data ?? []).reduce(
    (sum, inv) => sum + inv.amount_paid_cents,
    0
  )

  // Tasks due today (due_at <= today end) vs overdue (due_at < today start)
  const allDueTasks = (dueTasksRes.data ?? []) as TaskRow[]
  const overdueTasks = allDueTasks.filter((t) => t.due_at && t.due_at < todayStart)
  const dueTodayCount = allDueTasks.length

  // Fetch confirmed counts for each upcoming event
  const upcomingEventIds = (upcomingEventsRes.data ?? []).map((e) => e.id)
  const confirmedMap: Record<string, number> = {}
  if (upcomingEventIds.length > 0) {
    const { data: participantCounts } = await supabase
      .from("event_participants")
      .select("event_id, status")
      .in("event_id", upcomingEventIds)
      .in("status", ["confirmed", "attended"])
    for (const row of participantCounts ?? []) {
      confirmedMap[row.event_id] = (confirmedMap[row.event_id] ?? 0) + 1
    }
  }

  const upcomingEvents: EventRow[] = (upcomingEventsRes.data ?? []).map((e) => ({
    ...e,
    confirmed: confirmedMap[e.id] ?? 0,
  }))

  const recentActivity = (recentActivityRes.data ?? []) as ActivityRow[]

  // Type pill colours
  const eventTypePill: Record<string, string> = {
    trial: "bg-blue-100 text-blue-800",
    training: "bg-green-100 text-green-800",
    tour: "bg-purple-100 text-purple-800",
    showcase: "bg-yellow-100 text-yellow-800",
    camp: "bg-orange-100 text-orange-800",
    other: "bg-gray-100 text-gray-700",
  }
  const eventStatusPill: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    open: "bg-green-100 text-green-700",
    closed: "bg-red-100 text-red-700",
    cancelled: "bg-red-200 text-red-800",
    completed: "bg-blue-100 text-blue-700",
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0C0F4C]">Dashboard</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* New leads this week */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">New Leads (7d)</p>
          <p className="text-3xl font-bold text-[#0C0F4C] mt-1">{leadsThisWeek}</p>
          <p className={cn("text-sm mt-1", leadsDelta >= 0 ? "text-green-600" : "text-red-500")}>
            {leadsDelta >= 0 ? "+" : ""}{leadsDelta} vs prev week
          </p>
        </div>

        {/* Outstanding invoices */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Outstanding</p>
          <p className="text-3xl font-bold text-[#0C0F4C] mt-1">{formatAUD(outstandingCents)}</p>
          <p className="text-sm text-gray-400 mt-1">sent + part paid</p>
        </div>

        {/* Overdue invoices */}
        <div className={cn("bg-white rounded-xl border p-5", overdueCents > 0 ? "border-red-300 bg-red-50" : "border-gray-200")}>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Overdue</p>
          <p className={cn("text-3xl font-bold mt-1", overdueCents > 0 ? "text-red-600" : "text-[#0C0F4C]")}>
            {formatAUD(overdueCents)}
          </p>
          <p className="text-sm text-gray-400 mt-1">Paid this month: {formatAUD(paidThisMonthCents)}</p>
        </div>

        {/* Tasks due */}
        <div className={cn("bg-white rounded-xl border p-5", overdueTasks.length > 0 ? "border-orange-300 bg-orange-50" : "border-gray-200")}>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Tasks Due</p>
          <p className={cn("text-3xl font-bold mt-1", overdueTasks.length > 0 ? "text-orange-600" : "text-[#0C0F4C]")}>
            {dueTodayCount}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "none overdue"}
          </p>
        </div>
      </div>

      {/* Second row: events + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming events */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-[#0C0F4C] mb-3">Upcoming Events (30d)</h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No events in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
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
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", eventStatusPill[ev.status] ?? "bg-gray-100 text-gray-600")}>
                        {ev.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {ev.confirmed}{ev.capacity ? `/${ev.capacity}` : ""} confirmed
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-[#0C0F4C] mb-3">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((act) => {
                const who =
                  act.contacts?.full_name ??
                  (act.players ? `${act.players.first_name} ${act.players.last_name}` : null)
                return (
                  <li key={act.id} className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5 shrink-0">{activityIcon(act.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">
                        <span className="font-medium text-[#0C0F4C]">{act.type.replace(/_/g, " ")}</span>
                        {who ? <span className="text-gray-500"> — {who}</span> : null}
                        {act.body ? <span className="text-gray-400"> · {act.body.slice(0, 60)}{act.body.length > 60 ? "…" : ""}</span> : null}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgo(act.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Third row: leads by stage + tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leads by stage */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-[#0C0F4C] mb-4">Leads by Stage</h2>
          <div className="space-y-2">
            {stageOrder.map((stage) => {
              const count = stageCountMap[stage] ?? 0
              const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 shrink-0">{stageLabels[stage]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-[#0C0F4C] h-4 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-6 text-right shrink-0">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Due tasks */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-[#0C0F4C] mb-3">Tasks Due / Overdue</h2>
          {allDueTasks.length === 0 ? (
            <p className="text-sm text-gray-400">No overdue tasks.</p>
          ) : (
            <ul className="space-y-2">
              {allDueTasks.map((task) => {
                const isOverdue = task.due_at && task.due_at < todayStart
                const linked =
                  task.contacts?.full_name ??
                  (task.players ? `${task.players.first_name} ${task.players.last_name}` : null)
                return (
                  <li key={task.id} className="flex items-start gap-2">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", isOverdue ? "bg-red-500" : "bg-orange-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                      {linked && <p className="text-xs text-gray-400">{linked}</p>}
                    </div>
                    {task.due_at && (
                      <span className={cn("text-xs shrink-0 mt-0.5", isOverdue ? "text-red-500 font-medium" : "text-gray-400")}>
                        {new Date(task.due_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                    )}
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
