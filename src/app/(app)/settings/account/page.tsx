import { requireAuth } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { AccountShell } from "./AccountShell"

export default async function AccountPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single()

  // Check if MFA is already enrolled
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const totpFactor = factors?.totp?.find((f) => f.status === "verified") ?? null

  return (
    <AccountShell
      email={user.email ?? profile?.email ?? ""}
      fullName={profile?.full_name ?? ""}
      role={profile?.role ?? "coach"}
      hasMfa={!!totpFactor}
      mfaFactorId={totpFactor?.id ?? null}
    />
  )
}
