"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateSettings } from "@/app/(app)/settings/actions"
import type { Tables } from "@/lib/database.types"

const schema = z.object({
  email_from_name: z.string().min(1, "From name is required"),
  email_from_address: z
    .string()
    .optional()
    .nullable(),
  email_reply_to: z
    .string()
    .optional()
    .nullable(),
  email_footer_html: z.string().optional().nullable(),
  daily_email_cap: z.string().refine(
    (v) => !isNaN(Number(v)) && Number(v) >= 1,
    "Must be at least 1"
  ),
})

type FormValues = z.infer<typeof schema>

export function EmailSettings({ settings }: { settings: Tables<"settings"> | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email_from_name: settings?.email_from_name ?? "",
      email_from_address: settings?.email_from_address ?? "",
      email_reply_to: settings?.email_reply_to ?? "",
      email_footer_html: settings?.email_footer_html ?? "",
      daily_email_cap: String(settings?.daily_email_cap ?? 500),
    },
  })

  async function onSubmit(values: FormValues) {
    const { error } = await updateSettings({
      email_from_name: values.email_from_name,
      email_from_address: values.email_from_address || null,
      email_reply_to: values.email_reply_to || null,
      email_footer_html: values.email_footer_html || null,
      daily_email_cap: Number(values.daily_email_cap),
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Email settings saved")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="email_from_name">From name</Label>
        <Input id="email_from_name" {...register("email_from_name")} />
        {errors.email_from_name && (
          <p className="text-xs text-destructive">
            {errors.email_from_name.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email_from_address">From address</Label>
        <Input
          id="email_from_address"
          type="email"
          {...register("email_from_address")}
        />
        {errors.email_from_address && (
          <p className="text-xs text-destructive">
            {errors.email_from_address.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email_reply_to">Reply-to address</Label>
        <Input
          id="email_reply_to"
          type="email"
          {...register("email_reply_to")}
        />
        {errors.email_reply_to && (
          <p className="text-xs text-destructive">
            {errors.email_reply_to.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email_footer_html">Email footer (HTML)</Label>
        <Textarea
          id="email_footer_html"
          rows={4}
          {...register("email_footer_html")}
          placeholder="<p>Unsubscribe | Address</p>"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="daily_email_cap">Daily email cap</Label>
        <Input
          id="daily_email_cap"
          type="number"
          {...register("daily_email_cap")}
        />
        {errors.daily_email_cap && (
          <p className="text-xs text-destructive">
            {errors.daily_email_cap.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Maximum emails sent per day across all campaigns.
        </p>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  )
}
