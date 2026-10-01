import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/role"
import { listTasks } from "./actions"
import { TasksShell } from "@/components/tasks/TasksShell"

export default async function TasksPage() {
  const role = await getCurrentRole()
  if (role !== "admin") redirect("/dashboard")

  const [myTasks, allTasks] = await Promise.all([
    listTasks({ my_tasks: true, done: false }),
    listTasks({ done: false }),
  ])

  return (
    <TasksShell
      myTasks={myTasks}
      allTasks={allTasks}
    />
  )
}
