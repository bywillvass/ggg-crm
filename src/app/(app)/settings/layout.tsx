import { requireAdmin } from "@/lib/auth/role"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return <>{children}</>
}
