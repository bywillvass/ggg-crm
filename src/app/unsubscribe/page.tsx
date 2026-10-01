import { serviceClient } from "@/lib/supabase/service"
import { verifyToken } from "@/lib/tokens"
import { UnsubscribeForm } from "./UnsubscribeForm"

export const dynamic = "force-dynamic"

type TokenPayload = {
  contact_id: string
  iat: number
  exp: number
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <Page title="Invalid link" message="This unsubscribe link is missing a token." />
  }

  const payload = await verifyToken<TokenPayload>(token)
  if (!payload?.contact_id) {
    return <Page title="Invalid link" message="This unsubscribe link is invalid or has expired." />
  }

  const { data: contact } = await serviceClient
    .from("contacts")
    .select("id, first_name, last_name, email, unsubscribed_at")
    .eq("id", payload.contact_id)
    .single()

  if (!contact) {
    return <Page title="Not found" message="We could not find your contact record." />
  }

  if (contact.unsubscribed_at) {
    return (
      <Page title="Already unsubscribed" message={`You unsubscribed on ${new Date(contact.unsubscribed_at).toLocaleDateString()}. You will not receive further marketing emails.`} />
    )
  }

  return (
    <Page title="Unsubscribe" message="Click below to unsubscribe from all marketing emails. You will still receive transactional emails about your bookings and account.">
      <UnsubscribeForm token={token} email={contact.email ?? ""} />
    </Page>
  )
}

function Page({
  title,
  message,
  children,
}: {
  title: string
  message: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full overflow-hidden">
        <div className="bg-[#0C0F4C] px-6 py-4">
          <div className="text-base font-bold text-[#C9A227]">Ginga Global Group</div>
        </div>
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </div>
  )
}
