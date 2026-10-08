import { notFound } from "next/navigation"
import { getContact } from "../actions"
import { listTemplates } from "@/app/(app)/email/actions"
import { ContactDetail } from "@/components/contacts/ContactDetail"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [contact, templates] = await Promise.all([getContact(id), listTemplates()])

  if (!contact) {
    notFound()
  }

  return <ContactDetail contact={contact} templates={templates} />
}
