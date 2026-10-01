"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Trash2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import {
  createInvoice,
  updateInvoice,
  getSettings,
  searchContactsForInvoice,
  searchPlayersForInvoice,
  searchEventsForInvoice,
  type InvoiceDetail,
  type InvoiceItemInput,
  type ContactForInvoice,
} from "@/app/(app)/invoices/actions"
import type { Tables } from "@/lib/database.types"

type ContactResult = ContactForInvoice
type PlayerResult = Pick<Tables<"players">, "id" | "first_name" | "last_name">
type EventResult = Pick<Tables<"events">, "id" | "title" | "start_at">

type LineItem = {
  id: string
  description: string
  quantity: string
  unit_price: string
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "" }
}

function centsFromDollars(val: string): number {
  const n = parseFloat(val)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

function contactDisplayName(c: ContactResult | null | undefined): string {
  if (!c) return ""
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || ""
}

function playerDisplayName(p: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!p) return ""
  return [p.first_name, p.last_name].filter(Boolean).join(" ")
}

type Props = {
  invoice?: InvoiceDetail
  onSave: (id: string) => void
  onCancel: () => void
}

export function InvoiceForm({ invoice, onSave, onCancel }: Props) {
  const [settings, setSettings] = useState<Tables<"settings"> | null>(null)

  // Contact
  const [contactId, setContactId] = useState(invoice?.contact_id ?? "")
  const [contactName, setContactName] = useState(
    contactDisplayName(invoice?.contacts)
  )
  const [contactSearch, setContactSearch] = useState(
    contactDisplayName(invoice?.contacts)
  )
  const [contactResults, setContactResults] = useState<ContactResult[]>([])
  const [showContactDrop, setShowContactDrop] = useState(false)

  // Player (optional)
  const [playerId, setPlayerId] = useState(invoice?.player_id ?? "")
  const [playerName, setPlayerName] = useState(playerDisplayName(invoice?.players))
  const [playerSearch, setPlayerSearch] = useState(playerDisplayName(invoice?.players))
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([])
  const [showPlayerDrop, setShowPlayerDrop] = useState(false)

  // Event (optional)
  const [eventId, setEventId] = useState(invoice?.event_id ?? "")
  const [eventTitle, setEventTitle] = useState(invoice?.events?.title ?? "")
  const [eventSearch, setEventSearch] = useState(invoice?.events?.title ?? "")
  const [eventResults, setEventResults] = useState<EventResult[]>([])
  const [showEventDrop, setShowEventDrop] = useState(false)

  // Dates
  const today = new Date().toISOString().slice(0, 10)
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? today)
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "")

  // Notes
  const [notes, setNotes] = useState(invoice?.notes ?? "")

  // Line items
  const [items, setItems] = useState<LineItem[]>(() => {
    if (invoice?.invoice_items?.length) {
      return invoice.invoice_items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: String(item.quantity),
        unit_price: dollarsFromCents(item.unit_price_cents),
      }))
    }
    return [newLineItem()]
  })

  const [saving, setSaving] = useState(false)

  const contactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsLoadedRef = useRef(false)

  const loadSettings = useCallback(async () => {
    const s = await getSettings()
    setSettings(s)
    if (!invoice && s?.payment_terms_days) {
      const d = new Date()
      d.setDate(d.getDate() + s.payment_terms_days)
      setDueDate(d.toISOString().slice(0, 10))
    }
  }, [invoice])

  useEffect(() => {
    if (settingsLoadedRef.current) return
    settingsLoadedRef.current = true
    loadSettings()
  }, [loadSettings])

  void contactName

  // Contact search
  function handleContactSearch(val: string) {
    setContactSearch(val)
    setContactId("")
    setContactName("")
    if (contactTimerRef.current) clearTimeout(contactTimerRef.current)
    if (val.length < 2) {
      setContactResults([])
      setShowContactDrop(false)
      return
    }
    contactTimerRef.current = setTimeout(async () => {
      const results = await searchContactsForInvoice(val)
      setContactResults(results)
      setShowContactDrop(true)
    }, 300)
  }

  function selectContact(c: ContactResult) {
    const name = contactDisplayName(c)
    setContactId(c.id)
    setContactName(name)
    setContactSearch(name)
    setShowContactDrop(false)
  }

  // Player search
  function handlePlayerSearch(val: string) {
    setPlayerSearch(val)
    setPlayerId("")
    setPlayerName("")
    if (playerTimerRef.current) clearTimeout(playerTimerRef.current)
    if (val.length < 2) {
      setPlayerResults([])
      setShowPlayerDrop(false)
      return
    }
    playerTimerRef.current = setTimeout(async () => {
      const results = await searchPlayersForInvoice(val)
      setPlayerResults(results)
      setShowPlayerDrop(true)
    }, 300)
  }

  function selectPlayer(p: PlayerResult) {
    const name = playerDisplayName(p)
    setPlayerId(p.id)
    setPlayerName(name)
    setPlayerSearch(name)
    setShowPlayerDrop(false)
  }

  // Event search
  function handleEventSearch(val: string) {
    setEventSearch(val)
    setEventId("")
    setEventTitle("")
    if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
    if (val.length < 2) {
      setEventResults([])
      setShowEventDrop(false)
      return
    }
    eventTimerRef.current = setTimeout(async () => {
      const results = await searchEventsForInvoice(val)
      setEventResults(results)
      setShowEventDrop(true)
    }, 300)
  }

  function selectEvent(e: EventResult) {
    setEventId(e.id)
    setEventTitle(e.title)
    setEventSearch(e.title)
    setShowEventDrop(false)
  }

  // Line items
  function updateItem(id: string, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  function addItem() {
    setItems((prev) => [...prev, newLineItem()])
  }

  // Totals calculation
  const subtotalCents = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 0
    const price = centsFromDollars(item.unit_price)
    return sum + qty * price
  }, 0)

  const gstCents =
    settings?.gst_registered ? Math.round(subtotalCents / 11) : 0

  async function handleSave() {
    if (!contactId) return toast.error("Select a contact")
    if (items.length === 0) return toast.error("Add at least one line item")

    const invoiceItems: InvoiceItemInput[] = items.map((item, idx) => ({
      description: item.description,
      quantity: parseInt(item.quantity) || 1,
      unit_price_cents: centsFromDollars(item.unit_price),
      sort_order: idx,
    }))

    setSaving(true)

    if (invoice) {
      const { error } = await updateInvoice(invoice.id, {
        contact_id: contactId,
        player_id: playerId || null,
        event_id: eventId || null,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes || null,
        items: invoiceItems,
      })
      if (error) {
        toast.error(error)
        setSaving(false)
        return
      }
      toast.success("Invoice updated")
      onSave(invoice.id)
    } else {
      const { data, error } = await createInvoice({
        contact_id: contactId,
        player_id: playerId || null,
        event_id: eventId || null,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes || null,
        items: invoiceItems,
      })
      if (error || !data) {
        toast.error(error ?? "Failed to create invoice")
        setSaving(false)
        return
      }
      toast.success("Invoice created")
      onSave(data.id)
    }
    setSaving(false)
  }

  void playerName
  void eventTitle

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
        {invoice ? "Edit Invoice" : "New Invoice"}
      </h2>

      {/* Contact */}
      <div className="space-y-1.5 relative">
        <Label>Contact *</Label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            value={contactSearch}
            onChange={(e) => handleContactSearch(e.target.value)}
            placeholder="Search contact..."
            className="pl-9"
            onBlur={() => setTimeout(() => setShowContactDrop(false), 150)}
          />
        </div>
        {showContactDrop && contactResults.length > 0 && (
          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {contactResults.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                onMouseDown={() => selectContact(c)}
              >
                <span className="font-medium">{contactDisplayName(c)}</span>
                {c.email && <span className="text-gray-400 ml-2 text-xs">{c.email}</span>}
              </button>
            ))}
          </div>
        )}
        {contactId && (
          <p className="text-xs text-green-600">Contact selected</p>
        )}
      </div>

      {/* Player (optional) */}
      <div className="space-y-1.5 relative">
        <Label>Player (optional)</Label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            value={playerSearch}
            onChange={(e) => handlePlayerSearch(e.target.value)}
            placeholder="Search player..."
            className="pl-9"
            onBlur={() => setTimeout(() => setShowPlayerDrop(false), 150)}
          />
        </div>
        {showPlayerDrop && playerResults.length > 0 && (
          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {playerResults.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                onMouseDown={() => selectPlayer(p)}
              >
                <span className="font-medium">{playerDisplayName(p)}</span>
              </button>
            ))}
          </div>
        )}
        {playerId && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-green-600">Player selected</p>
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-600"
              onClick={() => {
                setPlayerId("")
                setPlayerName("")
                setPlayerSearch("")
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Event (optional) */}
      <div className="space-y-1.5 relative">
        <Label>Event (optional)</Label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            value={eventSearch}
            onChange={(e) => handleEventSearch(e.target.value)}
            placeholder="Search event..."
            className="pl-9"
            onBlur={() => setTimeout(() => setShowEventDrop(false), 150)}
          />
        </div>
        {showEventDrop && eventResults.length > 0 && (
          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {eventResults.map((e) => (
              <button
                key={e.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                onMouseDown={() => selectEvent(e)}
              >
                <span className="font-medium">{e.title}</span>
                {e.start_at && (
                  <span className="text-gray-400 ml-2 text-xs">
                    {format(new Date(e.start_at), "d MMM yyyy")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {eventId && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-green-600">Event selected</p>
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-600"
              onClick={() => {
                setEventId("")
                setEventTitle("")
                setEventSearch("")
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Issue Date</Label>
          <Input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Line Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add item
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 w-20">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 w-28">Unit Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 w-24">Amount</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const qty = parseInt(item.quantity) || 0
                const price = centsFromDollars(item.unit_price)
                const amount = qty * price
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="Description..."
                        className="border-0 shadow-none px-0 focus-visible:ring-0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        className="border-0 shadow-none px-0 text-right focus-visible:ring-0 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-gray-400 text-xs">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, "unit_price", e.target.value)}
                          placeholder="0.00"
                          className="pl-5 border-0 shadow-none focus-visible:ring-0 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      ${(amount / 100).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals preview */}
        <div className="flex justify-end">
          <div className="space-y-1 min-w-[200px]">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            {settings?.gst_registered && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>GST (included)</span>
                <span>${(gstCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className={cn(
              "flex justify-between text-sm font-bold border-t border-gray-200 pt-1",
              "text-gray-900"
            )}>
              <span>Total</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          {saving ? "Saving..." : invoice ? "Update invoice" : "Create invoice"}
        </Button>
      </div>
    </div>
  )
}
