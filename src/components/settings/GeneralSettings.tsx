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
  org_name: z.string().min(1, "Organisation name is required"),
  abn: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  website: z.string().optional().nullable(),
  logo_path: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

export function GeneralSettings({ settings }: { settings: Tables<"settings"> | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      org_name: settings?.org_name ?? "",
      abn: settings?.abn ?? "",
      address: settings?.address ?? "",
      phone: settings?.phone ?? "",
      email: settings?.email ?? "",
      website: settings?.website ?? "",
      logo_path: settings?.logo_path ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    const { error } = await updateSettings({
      org_name: values.org_name,
      abn: values.abn || null,
      address: values.address || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      logo_path: values.logo_path || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Organisation details saved")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="org_name">Organisation name</Label>
        <Input id="org_name" {...register("org_name")} />
        {errors.org_name && (
          <p className="text-xs text-destructive">{errors.org_name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="abn">ABN</Label>
        <Input id="abn" {...register("abn")} placeholder="XX XXX XXX XXX" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...register("address")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" {...register("phone")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="website">Website</Label>
        <Input id="website" {...register("website")} placeholder="https://" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="logo_path">Logo URL</Label>
        <Input
          id="logo_path"
          {...register("logo_path")}
          placeholder="https://example.com/logo.png"
        />
        <p className="text-xs text-muted-foreground">
          Paste a public URL or upload to Supabase storage (blog-media bucket,
          org/logo path) and paste the URL here.
        </p>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  )
}
