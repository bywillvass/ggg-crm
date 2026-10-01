"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format, isPast, isToday } from "date-fns"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AddTaskDialog } from "@/components/shared/AddTaskDialog"
import { completeTask, deleteTask, type TaskWithRelations } from "@/app/(app)/tasks/actions"
import { Check, Trash2, ExternalLink } from "lucide-react"
import { cn } from "cn"

const SUB_FILTERS = ["all", "due-today", "overdue", "upcoming", "done"] as const
type SubFilter = (typeof SUB_FILTERS)[number]

type Props = {
  myTasks: TaskWithRelations[]
  allTasks: TaskWithRelations[]
}

export function TasksShell({ myTasks, allTasks }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"my" | "all">("my")
  const [subFilter, setSubFilter] = useState<SubFilter>("all")
  const [addTaskOpen, setAddTaskOpen] = useState(false)

  const tasks = tab === "my" ? myTasks : allTasks

  const filtered = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    switch (subFilter) {
      case "due-today":
        return tasks.filter((t) => {
          if (!t.due_at || t.done_at) return false
          const d = new Date(t.due_at)
          return d >= startOfToday && d <= endOfToday
        })
      case "overdue":
        return tasks.filter((t) => {
          if (!t.due_at || t.done_at) return false
          return new Date(t.due_at) < startOfToday
        })
      case "upcoming":
        return tasks.filter((t) => {
          if (t.done_at) return false
          if (!t.due_at) return true
          return new Date(t.due_at) > endOfToday
        })
      case "done":
        return tasks.filter((t) => !!t.done_at)
      default:
        return tasks
    }
  }, [tasks, subFilter])

  async function handleComplete(id: string) {
    const result = await completeTask(id)
    if (result.error) toast.error(result.error)
    else router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this task?")) return
    const result = await deleteTask(id)
    if (result.error) toast.error(result.error)
    else router.refresh()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0C0F4C]">Tasks</h1>
          <p className="text-sm text-gray-500">{filtered.length} tasks</p>
        </div>
        <Button
          onClick={() => setAddTaskOpen(true)}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New task
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("my")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            tab === "my" ? "border-[#C9A227] text-[#C9A227]" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          My tasks ({myTasks.length})
        </button>
        <button
          onClick={() => setTab("all")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            tab === "all" ? "border-[#C9A227] text-[#C9A227]" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          All tasks ({allTasks.length})
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {SUB_FILTERS.map((sf) => (
          <button
            key={sf}
            onClick={() => setSubFilter(sf)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              subFilter === sf
                ? "bg-[#0C0F4C] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {sf === "due-today" ? "Due today" : sf.charAt(0).toUpperCase() + sf.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="w-8 px-3 py-3"></th>
              <th className="px-3 py-3 font-medium text-gray-600">Task</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Due</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Assigned to</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Context</th>
              <th className="w-8 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  No tasks
                </td>
              </tr>
            ) : (
              filtered.map((task) => {
                const isDone = !!task.done_at
                const isOverdue = task.due_at && !isDone && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at))

                return (
                  <tr key={task.id} className={`hover:bg-gray-50 ${isDone ? "opacity-60" : ""}`}>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => !isDone && handleComplete(task.id)}
                        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                          isDone
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-green-500"
                        }`}
                      >
                        {isDone && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <p className={`font-medium ${isDone ? "line-through text-gray-400" : "text-gray-700"}`}>
                        {task.title}
                      </p>
                      {task.notes && <p className="text-xs text-gray-400 mt-0.5">{task.notes}</p>}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {task.due_at ? (
                        <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                          {format(new Date(task.due_at), "d MMM yyyy")}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">No due date</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      {task.assigned_profile?.full_name ?? "Unassigned"}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {task.contacts && (
                          <Link href={`/contacts/${task.contacts.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            {task.contacts.first_name} {task.contacts.last_name}
                          </Link>
                        )}
                        {task.players && (
                          <Link href={`/players/${task.players.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            {task.players.first_name} {task.players.last_name}
                          </Link>
                        )}
                        {task.leads && (
                          <Link href={`/leads/${task.leads.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            Lead
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSave={() => router.refresh()}
      />
    </div>
  )
}
