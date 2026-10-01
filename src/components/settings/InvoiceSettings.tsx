"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateSettings } from "@/app/(app)/settings/actions"
import type { Tables } from "@/lib/database.types"

const schema = z.object({
  invoice_prefix: z.string().min(1, "Prefix is required"),
  invoice_next_number: z.string().min(1).refine((v) => !isNaN(Number(v)) && Number(v) >= 1, "Must be at least 1"),
  gst_rate: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, "Must be 0-100"),
  payment_terms_days: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Must be 0 or more"),
  invoice_footer: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

export function InvoiceSettings({ settings }: { settings: Tables<"settings"> | null }) {
  const [gstRegistered, setGstRegistered] = useState(
    settings?.gst_registered ?? false
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoice_prefix: settings?.invoice_prefix ?? "INV",
      invoice_next_number: String(settings?.invoice_next_number ?? 1),
      gst_rate: String(settings?.gst_rate ?? 10),
      payment_terms_days: String(settings?.payment_terms_days ?? 14),
      invoice_footer: settings?.invoice_footer ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    const { error } = await updateSettings({
      invoice_prefix: values.invoice_prefix,
      invoice_next_number: Number(values.invoice_next_number),
      gst_registered: gstRegistered,
      gst_rate: Number(values.gst_rate),
      payment_terms_days: Number(values.payment_terms_days),
      invoice_footer: values.invoice_footer || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Invoice settings saved")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <Switch
          id="gst_registered"
          checked={gstRegistered}
          onCheckedChange={setGstRegistered}
        />
        <Label htmlFor="gst_registered">GST registered</Label>
      </div>
      {gstRegistered && (
        <div className="space-y-1">
          <Label htmlFor="gst_rate">GST rate (%)</Label>
          <Input
            id="gst_rate"
            type="number"
            step="0.01"
            {...register("gst_rate")}
          />
          {errors.gst_rate && (
            <p className="text-xs text-destructive">{errors.gst_rate.message}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="invoice_prefix">Invoice prefix</Label>
          <Input id="invoice_prefix" {...register("invoice_prefix")} />
          {errors.invoice_prefix && (
            <p className="text-xs text-destructive">
              {errors.invoice_prefix.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoice_next_number">Next number</Label>
          <Input
            id="invoice_next_number"
            type="number"
            {...register("invoice_next_number")}
          />
          {errors.invoice_next_number && (
            <p className="text-xs text-destructive">
              {errors.invoice_next_number.message}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
        <Input
          id="payment_terms_days"
          type="number"
          {...register("payment_terms_days")}
        />
        {errors.payment_terms_days && (
          <p className="text-xs text-destructive">
            {errors.payment_terms_days.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="invoice_footer">Invoice footer</Label>
        <Textarea
          id="invoice_footer"
          rows={3}
          {...register("invoice_footer")}
          placeholder="Payment instructions, thank you note, etc."
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  )
}
