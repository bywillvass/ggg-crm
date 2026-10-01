"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { GeneralSettings } from "@/components/settings/GeneralSettings"
import { BankSettings } from "@/components/settings/BankSettings"
import { InvoiceSettings } from "@/components/settings/InvoiceSettings"
import { EmailSettings } from "@/components/settings/EmailSettings"
import { UsersSettings } from "@/components/settings/UsersSettings"
import { DocumentTypesSettings } from "@/components/settings/DocumentTypesSettings"
import { FieldMappingsSettings } from "@/components/settings/FieldMappingsSettings"
import { TemplatesSettings } from "@/components/settings/TemplatesSettings"
import { IntegrationsStatus } from "@/components/settings/IntegrationsStatus"
import type { Tables } from "@/lib/database.types"
import type { IngestSourceStatus } from "./actions"
import { cn } from "cn"

const TABS = [
  { id: "general", label: "General" },
  { id: "bank", label: "Bank" },
  { id: "invoices", label: "Invoices" },
  { id: "email", label: "Email" },
  { id: "users", label: "Users" },
  { id: "document-types", label: "Document types" },
  { id: "field-mappings", label: "Field mappings" },
  { id: "templates", label: "Templates" },
  { id: "integrations", label: "Integrations" },
] as const

type TabId = (typeof TABS)[number]["id"]

function SettingsShellInner({
  settings,
  profiles,
  documentTypes,
  fieldMappings,
  emailTemplates,
  integrations,
}: {
  settings: Tables<"settings"> | null
  profiles: Tables<"profiles">[]
  documentTypes: Tables<"document_types">[]
  fieldMappings: Tables<"ingest_field_mappings">[]
  emailTemplates: Tables<"email_templates">[]
  integrations: { sources: IngestSourceStatus[]; lastBlogSync: string | null }
}) {
  const router = useRouter()
  const params = useSearchParams()
  const activeTab = (params.get("tab") ?? "general") as TabId

  function setTab(id: TabId) {
    const url = new URL(window.location.href)
    url.searchParams.set("tab", id)
    router.replace(url.pathname + url.search)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0C0F4C]">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your organisation settings and preferences.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-[#C9A227] text-[#C9A227]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "general" && <GeneralSettings settings={settings} />}
        {activeTab === "bank" && <BankSettings settings={settings} />}
        {activeTab === "invoices" && <InvoiceSettings settings={settings} />}
        {activeTab === "email" && <EmailSettings settings={settings} />}
        {activeTab === "users" && <UsersSettings profiles={profiles} />}
        {activeTab === "document-types" && (
          <DocumentTypesSettings documentTypes={documentTypes} />
        )}
        {activeTab === "field-mappings" && (
          <FieldMappingsSettings mappings={fieldMappings} />
        )}
        {activeTab === "templates" && (
          <TemplatesSettings templates={emailTemplates} />
        )}
        {activeTab === "integrations" && (
          <IntegrationsStatus
            sources={integrations.sources}
            lastBlogSync={integrations.lastBlogSync}
          />
        )}
      </div>
    </div>
  )
}

export function SettingsShell(props: {
  settings: Tables<"settings"> | null
  profiles: Tables<"profiles">[]
  documentTypes: Tables<"document_types">[]
  fieldMappings: Tables<"ingest_field_mappings">[]
  emailTemplates: Tables<"email_templates">[]
  integrations: { sources: IngestSourceStatus[]; lastBlogSync: string | null }
}) {
  return (
    <Suspense>
      <SettingsShellInner {...props} />
    </Suspense>
  )
}
