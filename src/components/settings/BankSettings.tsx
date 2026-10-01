"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateSettings } from "@/app/(app)/settings/actions"
import type { Tables } from "@/lib/database.types"

const schema = z.object({
  bank_account_name: z.string().optional().nullable(),
  bank_bsb: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  payid: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

export function BankSettings({ settings }: { settings: Tables<"settings"> | null }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bank_account_name: settings?.bank_account_name ?? "",
      bank_bsb: settings?.bank_bsb ?? "",
      bank_account_number: settings?.bank_account_number ?? "",
      payid: settings?.payid ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    const { error } = await updateSettings({
      bank_account_name: values.bank_account_name || null,
      bank_bsb: values.bank_bsb || null,
      bank_account_number: values.bank_account_number || null,
      payid: values.payid || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Bank details saved")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Bank details appear on invoices. Leave blank if not applicable.
      </p>
      <div className="space-y-1">
        <Label htmlFor="bank_account_name">Account name</Label>
        <Input id="bank_account_name" {...register("bank_account_name")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bank_bsb">BSB</Label>
        <Input id="bank_bsb" {...register("bank_bsb")} placeholder="XXX-XXX" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bank_account_number">Account number</Label>
        <Input id="bank_account_number" {...register("bank_account_number")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="payid">PayID</Label>
        <Input id="payid" {...register("payid")} placeholder="email or phone" />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  )
}
