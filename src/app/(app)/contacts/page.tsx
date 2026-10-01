import { listContacts } from "./actions"
import { listTemplates, listEventsForEmail } from "@/app/(app)/email/actions"
import { ContactsShell } from "@/components/contacts/ContactsShell"

export default async function ContactsPage() {
  const [contacts, emailTemplates, emailEvents] = await Promise.all([
    listContacts(),
    listTemplates(),
    listEventsForEmail(),
  ])
  return (
    <ContactsShell
      contacts={contacts}
      emailTemplates={emailTemplates}
      emailEvents={emailEvents}
    />
  )
}
