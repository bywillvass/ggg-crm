"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { mergeContacts, listContacts, type ContactWithPlayers } from "@/app/(app)/contacts/actions"

type Props = {
  open: boolean
  onClose: () => void
  onMerged: () => void
  masterContact: ContactWithPlayers
}

export function MergeContactsDialog({ open, onClose, onMerged, masterContact }: Props) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<ContactWithPlayers[]>([])
  const [selected, setSelected] = useState<ContactWithPlayers | null>(null)
  const [merging, setMerging] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSearch("")
        setResults([])
        setSelected(null)
      }, 0)
    }
  }, [open])

  useEffect(() => {
    if (search.length < 2) {
      setTimeout(() => setResults([]), 0)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const data = await listContacts({ search })
      setResults(data.filter((c) => c.id !== masterContact.id))
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, masterContact.id])

  async function handleMerge() {
    if (!selected) return
    if (!confirm(`Merge "${selected.first_name} ${selected.last_name}" into "${masterContact.first_name} ${masterContact.last_name}"? This cannot be undone.`)) return

    setMerging(true)
    const result = await mergeContacts(masterContact.id, selected.id)
    setMerging(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Contacts merged successfully")
      onMerged()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge duplicate contact</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-blue-50 p-3">
            <p className="text-xs text-gray-500 mb-1">Master (kept)</p>
            <p className="font-medium">{masterContact.first_name} {masterContact.last_name}</p>
            <p className="text-sm text-gray-500">{masterContact.email} - {masterContact.phone}</p>
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
                placeholder="Search for duplicate..."
                className="pl-9"
              />
            </div>

            {loading && <p className="text-sm text-gray-400 text-center py-2">Searching...</p>}

            {results.length > 0 && !selected && (
              <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                {results.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelected(contact)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm">{contact.first_name} {contact.last_name}</p>
                    <p className="text-xs text-gray-500">{contact.email} - {contact.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="rounded-lg border bg-orange-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Duplicate (will be archived)</p>
              <p className="font-medium">{selected.first_name} {selected.last_name}</p>
              <p className="text-sm text-gray-500">{selected.email} - {selected.phone}</p>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Change selection
              </button>
            </div>
          )}

          {selected && (
            <p className="text-xs text-gray-500">
              All records (players, leads, activities, tasks, emails) from the duplicate will be moved to the master contact. The duplicate will be archived.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleMerge}
            disabled={!selected || merging}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {merging ? "Merging..." : "Merge contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
