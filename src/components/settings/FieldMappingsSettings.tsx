"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createFieldMapping,
  updateFieldMapping,
  deleteFieldMapping,
} from "@/app/(app)/settings/actions"
import type { Tables } from "@/lib/database.types"
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react"

const schema = z.object({
  source_key: z.string().min(1, "Source key is required"),
  target: z.string().min(1, "Target field is required"),
  form_type: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>
type Mapping = Tables<"ingest_field_mappings">

export function FieldMappingsSettings({
  mappings: initial,
}: {
  mappings: Mapping[]
}) {
  const [mappings, setMappings] = useState(initial)
  const [editTarget, setEditTarget] = useState<Mapping | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const addForm = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source_key: "", target: "", form_type: "" },
  })

  const editForm = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function openEdit(m: Mapping) {
    setEditTarget(m)
    editForm.reset({
      source_key: m.source_key,
      target: m.target,
      form_type: m.form_type ?? "",
    })
    setEditOpen(true)
  }

  async function onAdd(values: FormValues) {
    const { error } = await createFieldMapping({
      source_key: values.source_key,
      target: values.target,
      form_type: values.form_type || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Mapping created")
      addForm.reset()
      setAddOpen(false)
      // Optimistic add with temp id
      setMappings((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          source_key: values.source_key,
          target: values.target,
          form_type: values.form_type || null,
          created_at: new Date().toISOString(),
          updated_at: null,
        },
      ])
    }
  }

  async function onEdit(values: FormValues) {
    if (!editTarget) return
    const { error } = await updateFieldMapping(editTarget.id, {
      source_key: values.source_key,
      target: values.target,
      form_type: values.form_type || null,
    })
    if (error) {
      toast.error(error)
    } else {
      setMappings((prev) =>
        prev.map((m) =>
          m.id === editTarget.id
            ? {
                ...m,
                source_key: values.source_key,
                target: values.target,
                form_type: values.form_type ?? null,
              }
            : m
        )
      )
      toast.success("Mapping updated")
      setEditOpen(false)
    }
  }

  async function onDelete(id: string) {
    const { error } = await deleteFieldMapping(id)
    if (error) {
      toast.error(error)
    } else {
      setMappings((prev) => prev.filter((m) => m.id !== id))
      toast.success("Mapping deleted")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {mappings.length} mapping{mappings.length !== 1 ? "s" : ""}
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-3.5" />
          Add mapping
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Source key
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Target field
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Form type
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{m.source_key}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.target}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {m.form_type ?? "-"}
                </td>
                <td className="px-3 py-2 text-right flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openEdit(m)}
                  >
                    <PencilIcon className="size-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDelete(m.id)}
                  >
                    <Trash2Icon className="size-3.5 text-destructive" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No mappings yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add field mapping</DialogTitle>
          </DialogHeader>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3 mt-1">
            <MappingFormFields form={addForm} />
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
            <DialogTitle>Edit field mapping</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-3 mt-1">
            <MappingFormFields form={editForm} />
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

function MappingFormFields({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const { register, formState: { errors } } = form
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="fm_source_key">Source key</Label>
        <Input id="fm_source_key" {...register("source_key")} placeholder="e.g. First Name" autoFocus />
        {errors.source_key && (
          <p className="text-xs text-destructive">{errors.source_key.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="fm_target">Target field</Label>
        <Input id="fm_target" {...register("target")} placeholder="e.g. contact.first_name" />
        {errors.target && (
          <p className="text-xs text-destructive">{errors.target.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="fm_form_type">Form type (optional)</Label>
        <Input id="fm_form_type" {...register("form_type")} placeholder="e.g. trial_registration" />
      </div>
    </>
  )
}
