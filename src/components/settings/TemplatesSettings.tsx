"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/app/(app)/settings/actions"
import type { Tables } from "@/lib/database.types"
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  category: z.string().min(1, "Category is required"),
  format: z.enum(["plain", "html"]),
  body_text: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>
type Template = Tables<"email_templates">

export function TemplatesSettings({ templates: initial }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initial)
  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const addForm = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      subject: "",
      category: "general",
      format: "plain",
      body_text: "",
      body_html: "",
    },
  })

  const editForm = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function openEdit(t: Template) {
    setEditTarget(t)
    editForm.reset({
      name: t.name,
      subject: t.subject,
      category: t.category,
      format: t.format,
      body_text: t.body_text ?? "",
      body_html: t.body_html ?? "",
    })
    setEditOpen(true)
  }

  async function onAdd(values: FormValues) {
    const { error } = await createEmailTemplate({
      name: values.name,
      subject: values.subject,
      category: values.category,
      format: values.format,
      body_text: values.body_text || null,
      body_html: values.body_html || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Template created")
      addForm.reset()
      setAddOpen(false)
    }
  }

  async function onEdit(values: FormValues) {
    if (!editTarget) return
    const { error } = await updateEmailTemplate(editTarget.id, {
      name: values.name,
      subject: values.subject,
      category: values.category,
      format: values.format,
      body_text: values.body_text || null,
      body_html: values.body_html || null,
    })
    if (error) {
      toast.error(error)
    } else {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editTarget.id
            ? {
                ...t,
                name: values.name,
                subject: values.subject,
                category: values.category,
                format: values.format,
                body_text: values.body_text ?? null,
                body_html: values.body_html ?? null,
              }
            : t
        )
      )
      toast.success("Template updated")
      setEditOpen(false)
    }
  }

  async function onDelete(id: string) {
    const { error } = await deleteEmailTemplate(id)
    if (error) {
      toast.error(error)
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Template deleted")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-3.5" />
          Add template
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
                Subject
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Category
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Format
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                  {t.subject}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{t.category}</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{t.format}</td>
                <td className="px-3 py-2 text-right flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openEdit(t)}
                  >
                    <PencilIcon className="size-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDelete(t.id)}
                  >
                    <Trash2Icon className="size-3.5 text-destructive" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add email template</DialogTitle>
          </DialogHeader>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3 mt-1">
            <TemplateFormFields form={addForm} />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit email template</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-3 mt-1">
            <TemplateFormFields form={editForm} />
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

function TemplateFormFields({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const { register, watch, formState: { errors } } = form
  const format = watch("format")
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="tpl_name">Name</Label>
        <Input id="tpl_name" {...register("name")} autoFocus />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="tpl_subject">Subject</Label>
        <Input id="tpl_subject" {...register("subject")} />
        {errors.subject && (
          <p className="text-xs text-destructive">{errors.subject.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="tpl_category">Category</Label>
          <Input id="tpl_category" {...register("category")} placeholder="e.g. event, invoice" />
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl_format">Format</Label>
          <Select id="tpl_format" {...register("format")}>
            <option value="plain">Plain text</option>
            <option value="html">HTML</option>
          </Select>
        </div>
      </div>
      {format === "plain" && (
        <div className="space-y-1">
          <Label htmlFor="tpl_body_text">Body (plain text)</Label>
          <Textarea id="tpl_body_text" rows={6} {...register("body_text")} />
        </div>
      )}
      {format === "html" && (
        <div className="space-y-1">
          <Label htmlFor="tpl_body_html">Body (HTML)</Label>
          <Textarea
            id="tpl_body_html"
            rows={6}
            {...register("body_html")}
            className="font-mono text-xs"
          />
        </div>
      )}
    </>
  )
}
