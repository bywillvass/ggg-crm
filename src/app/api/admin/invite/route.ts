import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/role"
import { serviceClient } from "@/lib/supabase/service"

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 })
  }

  const body = await req.json()
  const { email, full_name, role } = body as {
    email?: string
    full_name?: string
    role?: "admin" | "coach"
  }

  if (!email || !full_name || !role) {
    return NextResponse.json(
      { error: "email, full_name and role are required" },
      { status: 400 }
    )
  }

  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
