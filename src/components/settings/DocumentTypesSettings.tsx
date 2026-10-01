"use client"

import { useState, useTransition } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  createDocumentType,
  updateDocumentType,
} from "@/app/(app)/settings/actions"
import type { Tables } from "@/lib/database.types"
import { PlusIcon, PencilIcon } from "lucide-react"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  sensitive: z.boolean(),
  retention_days: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>
type DocType = Tables<"document_types">

export function DocumentTypesSettings({
  documentTypes: initial,
}: {
  documentTypes: DocType[]
}) {
  const [types, setTypes] = useState(initial)
  const [editTarget, setEditTarget] = useState<DocType | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  const addForm = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", sensitive: false, retention_days: "" },
  })

  const editForm = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", sensitive: false, retention_days: "" },
  })

  function openEdit(doc: DocType) {
    setEditTarget(doc)
    editForm.reset({
      name: doc.name,
      description: doc.description ?? "",
      sensitive: doc.sensitive,
      retention_days: doc.retention_days_after_event != null ? String(doc.retention_days_after_event) : "",
    })
    setEditOpen(true)
  }

  async function onAdd(values: FormValues) {
    const retentionNum = values.retention_days ? Number(values.retention_days) : null
    const { error } = await createDocumentType({
      name: values.name,
      description: values.description || null,
      sensitive: values.sensitive,
      retention_days_after_event: retentionNum,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Document type created")
      addForm.reset({ name: "", description: "", sensitive: false, retention_days: "" })
      setAddOpen(false)
      startTransition(() => {})
    }
  }

  async function onEdit(values: FormValues) {
    if (!editTarget) return
    const retentionNum = values.retention_days ? Number(values.retention_days) : null
    const { error } = await updateDocumentType(editTarget.id, {
      name: values.name,
      description: values.description || null,
      sensitive: values.sensitive,
      retention_days_after_event: retentionNum,
    })
    if (error) {
      toast.error(error)
    } else {
      setTypes((prev) =>
        prev.map((t) =>
          t.id === editTarget.id
            ? {
                ...t,
                name: values.name,
                description: values.description ?? null,
                sensitive: values.sensitive,
                retention_days_after_event: retentionNum,
              }
            : t
        )
      )
      toast.success("Document type updated")
      setEditOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {types.length} type{types.length !== 1 ? "s" : ""}
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-3.5" />
          Add type
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Description
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Sensitive
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Retention (days)
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((doc) => (
              <tr key={doc.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{doc.name}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                  {doc.description ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {doc.sensitive ? (
                    <Badge variant="warning">Sensitive</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {doc.retention_days_after_event ?? "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openEdit(doc)}
                  >
                    <PencilIcon className="size-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document type</DialogTitle>
          </DialogHeader>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3 mt-1">
            <DocTypeFormFields form={addForm} />
            <DialogFooter>
              <Button type="submit" disabled={addForm.formState.isSubmitting}>
                {addForm.formState.isSubmitting ? "Saving..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit document type</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-3 mt-1">
            <DocTypeFormFields form={editForm} />
            <DialogFooter>
              <Button type="submit" disabled={editForm.formState.isSubmitting}>
                {editForm.formState.isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DocTypeFormFields({ form }: { form: UseFormReturn<FormValues> }) {
  const [sensitive, setSensitive] = useState(form.getValues("sensitive"))
  const { register, setValue } = form

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="dt_name">Name</Label>
        <Input id="dt_name" {...register("name")} autoFocus />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dt_description">Description</Label>
        <Textarea id="dt_description" rows={2} {...register("description")} />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="dt_sensitive"
          checked={sensitive}
          onCheckedChange={(v) => {
            setSensitive(v)
            setValue("sensitive", v)
          }}
        />
        <Label htmlFor="dt_sensitive">Sensitive</Label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="dt_retention">Retention (days after event)</Label>
        <Input
          id="dt_retention"
          type="number"
          {...register("retention_days")}
          placeholder="Leave blank to keep forever"
        />
      </div>
    </>
  )
}
