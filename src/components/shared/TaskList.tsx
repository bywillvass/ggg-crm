"use client"

import { format, isPast, isToday } from "date-fns"
import { Check, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { TaskWithRelations } from "@/app/(app)/tasks/actions"

type Props = {
  tasks: TaskWithRelations[]
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

export function TaskList({ tasks, onComplete, onDelete }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        No tasks
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const isDone = !!task.done_at
        const isOverdue = task.due_at && !isDone && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at))

        return (
          <div
            key={task.id}
            className={`flex items-start gap-3 rounded-lg border p-3 ${isDone ? "bg-gray-50 opacity-60" : "bg-white"}`}
          >
            <button
              onClick={() => !isDone && onComplete(task.id)}
              className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors ${
                isDone
                  ? "bg-green-500 border-green-500 text-white"
                  : "border-gray-300 hover:border-green-500"
              }`}
              aria-label={isDone ? "Completed" : "Mark complete"}
            >
              {isDone && <Check className="h-3 w-3" />}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-700"}`}>
                {task.title}
              </p>

              {task.notes && (
                <p className="text-xs text-gray-500 mt-0.5">{task.notes}</p>
              )}

              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {task.due_at && (
                  <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                    Due {format(new Date(task.due_at), "d MMM yyyy")}
                    {isOverdue && " - overdue"}
                  </span>
                )}

                {task.contacts && (
                  <Link
                    href={`/contacts/${task.contacts.id}`}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {task.contacts.first_name} {task.contacts.last_name}
                  </Link>
                )}

                {task.players && (
                  <Link
                    href={`/players/${task.players.id}`}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {task.players.first_name} {task.players.last_name}
                  </Link>
                )}

                {task.leads && (
                  <Link
                    href={`/leads/${task.leads.id}`}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Lead
                  </Link>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(task.id)}
              className="shrink-0 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
