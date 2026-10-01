"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "cn"
import {
  listInvoices,
  bulkCreateFromEvent,
  type InvoiceRow,
} from "@/app/(app)/invoices/actions"
import type { Tables } from "@/lib/database.types"

type InvoiceStatus = Tables<"invoices">["status"]

function statusVariant(
  s: InvoiceStatus
): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (s === "paid") return "success"
  if (s === "part_paid") return "warning"
  if (s === "sent") return "default"
  if (s === "overdue") return "destructive"
  if (s === "void") return "secondary"
  return "secondary"
}

function statusLabel(s: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    part_paid: "Part Paid",
    paid: "Paid",
    overdue: "Overdue",
    void: "Void",
  }
  return map[s] ?? s
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

type Props = {
  eventId: string
}

export function EventInvoicesTab({ eventId }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkCreating, setBulkCreating] = useState(false)

  const fetchRef = useRef(false)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const data = await listInvoices({ eventId })
    setInvoices(data)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    if (fetchRef.current) return
    fetchRef.current = true
    loadInvoices()
  }, [loadInvoices])

  async function handleBulkCreate() {
    setBulkCreating(true)
    const { created, error } = await bulkCreateFromEvent(eventId)
    if (error) {
      toast.error(error)
    } else if (created === 0) {
      toast.info("No new invoices to create — all confirmed participants with contacts already have invoices")
    } else {
      toast.success(
        `Created ${created} invoice${created !== 1 ? "s" : ""} for confirmed participants`
      )
      fetchRef.current = false
      await loadInvoices()
    }
    setBulkCreating(false)
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">Loading invoices...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleBulkCreate}
          disabled={bulkCreating}
          className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {bulkCreating ? "Creating..." : "Bulk Create Invoices"}
        </Button>
        <Link href={`/invoices/new`}>
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-1.5" />
            New Invoice
          </Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No invoices for this event yet</p>
          <p className="text-xs mt-1">
            Use &ldquo;Bulk Create Invoices&rdquo; to generate invoices for all confirmed participants
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Player</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 hidden sm:table-cell">Paid</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 hidden sm:table-cell">Balance</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv: InvoiceRow) => {
                  const bal = inv.total_cents - inv.amount_paid_cents
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium text-[#0C0F4C] hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {inv.contacts
                          ? [inv.contacts.first_name, inv.contacts.last_name].filter(Boolean).join(" ") || inv.contacts.email || "—"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {inv.players
                          ? [inv.players.first_name, inv.players.last_name].filter(Boolean).join(" ") || "—"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {fmt(inv.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 hidden sm:table-cell">
                        {fmt(inv.amount_paid_cents)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right hidden sm:table-cell",
                          bal > 0 ? "text-red-500" : "text-green-600"
                        )}
                      >
                        {fmt(bal)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(inv.status)}>
                          {statusLabel(inv.status)}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
