import {
  getSettings,
  getDocumentTypes,
  getFieldMappings,
  getEmailTemplates,
  getIntegrationsStatus,
} from "./actions"
import { getProfiles } from "./users/actions"
import { SettingsShell } from "./SettingsShell"

export default async function SettingsPage() {
  const [settings, profiles, documentTypes, fieldMappings, emailTemplates, integrations] =
    await Promise.all([
      getSettings(),
      getProfiles(),
      getDocumentTypes(),
      getFieldMappings(),
      getEmailTemplates(),
      getIntegrationsStatus(),
    ])

  return (
    <SettingsShell
      settings={settings}
      profiles={profiles}
      documentTypes={documentTypes}
      fieldMappings={fieldMappings}
      emailTemplates={emailTemplates}
      integrations={integrations}
    />
  )
}
