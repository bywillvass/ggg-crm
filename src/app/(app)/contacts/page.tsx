import { listContacts } from "./actions"
import { ContactsShell } from "@/components/contacts/ContactsShell"

export default async function ContactsPage() {
  const contacts = await listContacts()
  return <ContactsShell contacts={contacts} />
}
