import { requireAdmin } from "@/lib/auth/role"
import { serviceClient } from "@/lib/supabase/service"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  await requireAdmin()
  const form = await request.formData()
  const file = form.get("file") as File | null
  const slug = (form.get("slug") as string) || "draft"

  if (!file || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Image required" }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 5MB" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `posts/${slug}/${filename}`

  const bytes = await file.arrayBuffer()
  const { error } = await serviceClient.storage.from("blog-media").upload(path, Buffer.from(bytes), {
    contentType: file.type,
    upsert: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = serviceClient.storage.from("blog-media").getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
