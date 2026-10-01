"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  inviteUser,
  updateUserRole,
  toggleUserActive,
} from "@/app/(app)/settings/users/actions"
import type { Tables } from "@/lib/database.types"
import { UserPlusIcon } from "lucide-react"

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  full_name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "coach"]),
})

type InviteValues = z.infer<typeof inviteSchema>

export function UsersSettings({
  profiles: initialProfiles,
}: {
  profiles: Tables<"profiles">[]
}) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", full_name: "", role: "coach" },
  })

  async function onInvite(values: InviteValues) {
    const { error } = await inviteUser(values.email, values.full_name, values.role)
    if (error) {
      toast.error(error)
    } else {
      toast.success(`Invite sent to ${values.email}`)
      reset()
      setDialogOpen(false)
    }
  }

  function handleRoleChange(id: string, role: "admin" | "coach") {
    startTransition(async () => {
      const { error } = await updateUserRole(id, role)
      if (error) {
        toast.error(error)
      } else {
        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? { ...p, role } : p))
        )
        toast.success("Role updated")
      }
    })
  }

  function handleToggleActive(id: string, active: boolean) {
    startTransition(async () => {
      const { error } = await toggleUserActive(id, active)
      if (error) {
        toast.error(error)
      } else {
        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? { ...p, active } : p))
        )
        toast.success(active ? "User reactivated" : "User deactivated")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-muted-foreground">
          {profiles.length} user{profiles.length !== 1 ? "s" : ""}
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <UserPlusIcon className="size-3.5" />
          Invite user
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a user</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onInvite)} className="space-y-3 mt-1">
              <div className="space-y-1">
                <Label htmlFor="invite_email">Email</Label>
                <Input
                  id="invite_email"
                  type="email"
                  {...register("email")}
                  autoFocus
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite_full_name">Full name</Label>
                <Input id="invite_full_name" {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-xs text-destructive">
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite_role">Role</Label>
                <Select id="invite_role" {...register("role")}>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send invite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Email
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Role
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">
                  {profile.full_name ?? "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {profile.email ?? "-"}
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={profile.role}
                    onChange={(e) =>
                      handleRoleChange(
                        profile.id,
                        e.target.value as "admin" | "coach"
                      )
                    }
                    disabled={isPending}
                    className="h-7 w-24"
                  >
                    <option value="admin">Admin</option>
                    <option value="coach">Coach</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  {profile.active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isPending}
                    onClick={() =>
                      handleToggleActive(profile.id, !profile.active)
                    }
                  >
                    {profile.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
