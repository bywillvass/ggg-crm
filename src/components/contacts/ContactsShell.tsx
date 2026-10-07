"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { Search, Plus, Archive, Tag, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createContact,
  archiveContact,
  addTagToContact,
  type ContactWithPlayers,
} from "@/app/(app)/contacts/actions"
import { createPlayerWithParent } from "@/app/(app)/players/actions"
import { CampaignComposer } from "@/components/email/CampaignComposer"
import type { Tables, Database, TablesInsert } from "@/lib/database.types"
import type { EmailTemplateRow } from "@/app/(app)/email/actions"

type ConsentType = Database["public"]["Enums"]["consent_type"]
type LeadSource = Database["public"]["Enums"]["lead_source"]

const SOURCES: LeadSource[] = ["website", "meta_instant_form", "newsletter", "referral", "manual", "import", "other"]
const CONSENT_TYPES: ConsentType[] = ["express", "inferred", "none"]
const PAGE_SIZE = 25

export function ContactsShell({
  contacts: initialContacts,
  emailTemplates = [],
  emailEvents = [],
}: {
  contacts: ContactWithPlayers[]
  emailTemplates?: EmailTemplateRow[]
  emailEvents?: Pick<Tables<"events">, "id" | "title" | "start_at" | "timezone">[]
}) {
  const router = useRouter()
  const contacts = initialContacts
  const [search, setSearch] = useState("")
  const [filterConsent, setFilterConsent] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [filterUnsubscribed, setFilterUnsubscribed] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [bulkTag, setBulkTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const [addPlayerContactId, setAddPlayerContactId] = useState<string | null>(null)
  const [addPlayerForm, setAddPlayerForm] = useState({ first_name: "", last_name: "", birth_year: "" })
  const [savingPlayer, setSavingPlayer] = useState(false)

  const [newForm, setNewForm] = useState<Partial<TablesInsert<"contacts">>>({
    marketing_consent: "none",
    tags: [],
  })

  const filtered = useMemo(() => {
    let result = contacts

    if (search) {
      const s = search.toLowerCase()
      result = result.filter((c) =>
        `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(s)
      )
    }

    if (filterConsent) {
      result = result.filter((c) => c.marketing_consent === filterConsent)
    }

    if (filterSource) {
      result = result.filter((c) => c.source === filterSource)
    }

    if (filterUnsubscribed) {
      result = result.filter((c) => c.unsubscribed_at !== null)
    }

    return result
  }, [contacts, search, filterConsent, filterSource, filterUnsubscribed])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === paginated.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paginated.map((c) => c.id)))
    }
  }

  async function handleBulkArchive() {
    if (!confirm(`Archive ${selected.size} contact(s)?`)) return

    for (const id of selected) {
      await archiveContact(id)
    }
    toast.success(`Archived ${selected.size} contacts`)
    setSelected(new Set())
    router.refresh()
  }

  async function handleBulkTag() {
    if (!bulkTag.trim()) return

    for (const id of selected) {
      await addTagToContact(id, bulkTag.trim())
    }
    toast.success(`Tag added to ${selected.size} contacts`)
    setBulkTagDialogOpen(false)
    setBulkTag("")
    setSelected(new Set())
    router.refresh()
  }

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await createContact({ ...newForm, contact_type: "parent" } as TablesInsert<"contacts">)
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      setNewDialogOpen(false)
      setNewForm({ marketing_consent: "none", tags: [] })
      setAddPlayerContactId(result.data!.id)
    }
  }

  async function handleAddPlayer() {
    if (!addPlayerContactId || !addPlayerForm.first_name) return
    setSavingPlayer(true)
    const result = await createPlayerWithParent(
      {
        first_name: addPlayerForm.first_name,
        last_name: addPlayerForm.last_name || null,
        birth_year: addPlayerForm.birth_year ? parseInt(addPlayerForm.birth_year) : null,
        status: "prospect",
      },
      { mode: "existing", contact_id: addPlayerContactId }
    )
    setSavingPlayer(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Player added")
      setAddPlayerContactId(null)
      setAddPlayerForm({ first_name: "", last_name: "", birth_year: "" })
      router.push(`/players/${result.data?.id}`)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0C0F4C]">Contacts</h1>
          <p className="text-sm text-gray-500">{filtered.length} contacts</p>
        </div>
        <Button
          onClick={() => setNewDialogOpen(true)}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New contact
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search contacts..."
            className="pl-9"
          />
        </div>

        <select
          value={filterConsent}
          onChange={(e) => { setFilterConsent(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All consent</option>
          {CONSENT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnsubscribed}
            onChange={(e) => { setFilterUnsubscribed(e.target.checked); setPage(1) }}
            className="rounded"
          />
          Unsubscribed only
        </label>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkEmailOpen(true)}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Send email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkTagDialogOpen(true)}
          >
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Add tag
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkArchive}
            className="text-red-600 hover:text-red-700"
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Archive
          </Button>
        </div>
      )}

      {bulkEmailOpen && (
        <CampaignComposer
          open={bulkEmailOpen}
          onClose={() => setBulkEmailOpen(false)}
          templates={emailTemplates}
          events={emailEvents}
          prefilledContactIds={Array.from(selected)}
        />
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === paginated.length && paginated.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 font-medium text-gray-600">Name</th>
              <th className="px-3 py-3 font-medium text-gray-600">Email</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Phone</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Tags</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">Consent</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden xl:table-cell">Source</th>
              <th className="px-3 py-3 font-medium text-gray-600 hidden xl:table-cell">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  No contacts found
                </td>
              </tr>
            ) : (
              paginated.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      className="rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-[#0C0F4C] hover:underline"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                    {contact.player_contacts.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400">
                        {contact.player_contacts.length} player{contact.player_contacts.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="hover:underline">
                        {contact.email}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-3 text-gray-600 hidden md:table-cell">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="hover:underline">
                        {contact.phone}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags ?? []).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                      {(contact.tags ?? []).length > 3 && (
                        <span className="text-xs text-gray-400">+{contact.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <Badge variant={contact.marketing_consent === "express" ? "success" : contact.marketing_consent === "inferred" ? "warning" : "secondary"}>
                      {contact.marketing_consent}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-gray-500 hidden xl:table-cell">
                    {contact.source?.replace("_", " ") ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs hidden xl:table-cell">
                    {format(new Date(contact.created_at), "d MMM yyyy")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={newDialogOpen} onOpenChange={(o) => { if (!o) setNewDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateContact} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-first">First name</Label>
                <Input
                  id="new-first"
                  value={newForm.first_name ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-last">Last name</Label>
                <Input
                  id="new-last"
                  value={newForm.last_name ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newForm.email ?? ""}
                onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-phone">Phone</Label>
              <Input
                id="new-phone"
                value={newForm.phone ?? ""}
                onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-suburb">Suburb</Label>
                <Input
                  id="new-suburb"
                  value={newForm.suburb ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, suburb: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-state">State</Label>
                <Input
                  id="new-state"
                  value={newForm.state ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-source">Source</Label>
                <select
                  id="new-source"
                  value={newForm.source ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, source: e.target.value as LeadSource || null }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                >
                  <option value="">Unknown</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-consent">Consent</Label>
                <select
                  id="new-consent"
                  value={newForm.marketing_consent ?? "none"}
                  onChange={(e) => setNewForm((f) => ({ ...f, marketing_consent: e.target.value as ConsentType }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                >
                  {CONSENT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                {saving ? "Creating..." : "Create contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addPlayerContactId} onOpenChange={(o) => { if (!o) { setAddPlayerContactId(null); setAddPlayerForm({ first_name: "", last_name: "", birth_year: "" }); router.refresh() } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a player?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Contact created. Would you like to add a player for this parent?</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Player first name <span className="text-red-500">*</span></Label>
                <Input value={addPlayerForm.first_name} onChange={(e) => setAddPlayerForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={addPlayerForm.last_name} onChange={(e) => setAddPlayerForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Birth year</Label>
              <Input
                type="number"
                value={addPlayerForm.birth_year}
                onChange={(e) => setAddPlayerForm((f) => ({ ...f, birth_year: e.target.value }))}
                placeholder="e.g. 2012"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddPlayerContactId(null); setAddPlayerForm({ first_name: "", last_name: "", birth_year: "" }); router.refresh() }}
            >
              Skip
            </Button>
            <Button
              onClick={handleAddPlayer}
              disabled={savingPlayer || !addPlayerForm.first_name}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {savingPlayer ? "Adding..." : "Add player"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkTagDialogOpen} onOpenChange={(o) => { if (!o) setBulkTagDialogOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tag to {selected.size} contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-tag">Tag</Label>
              <Input
                id="bulk-tag"
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                placeholder="e.g. VIP, trial-2026"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBulkTag() } }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkTag} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              Add tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
