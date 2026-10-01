import { notFound } from "next/navigation"
import { getContact } from "../actions"
import { ContactDetail } from "@/components/contacts/ContactDetail"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContact(id)

  if (!contact) {
    notFound()
  }

  return <ContactDetail contact={contact} />
}
