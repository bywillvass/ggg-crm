import Link from "next/link"
import { Plus, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "cn"
import { listInvoices, type InvoiceRow } from "./actions"
import type { Tables } from "@/lib/database.types"

type InvoiceStatus = Tables<"invoices">["status"]

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "part_paid", label: "Part Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
]

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

type SearchParams = {
  status?: string
  eventId?: string
  dateFrom?: string
  dateTo?: string
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const status = params.status ?? ""
  const eventId = params.eventId ?? ""
  const dateFrom = params.dateFrom ?? ""
  const dateTo = params.dateTo ?? ""

  const invoices = await listInvoices({
    status: status || undefined,
    eventId: eventId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  // Summary calculations
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_cents, 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid_cents, 0)
  const outstanding = totalInvoiced - totalPaid

  function buildUrl(overrides: Partial<SearchParams>): string {
    const p = {
      status,
      eventId,
      dateFrom,
      dateTo,
      ...overrides,
    }
    const parts: string[] = []
    if (p.status) parts.push(`status=${encodeURIComponent(p.status)}`)
    if (p.eventId) parts.push(`eventId=${encodeURIComponent(p.eventId)}`)
    if (p.dateFrom) parts.push(`dateFrom=${encodeURIComponent(p.dateFrom)}`)
    if (p.dateTo) parts.push(`dateTo=${encodeURIComponent(p.dateTo)}`)
    return `/invoices${parts.length ? `?${parts.join("&")}` : ""}`
  }

  const csvParams = new URLSearchParams()
  if (status) csvParams.set("status", status)
  if (eventId) csvParams.set("eventId", eventId)
  if (dateFrom) csvParams.set("dateFrom", dateFrom)
  if (dateTo) csvParams.set("dateTo", dateTo)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Invoices
        </h1>
        <div className="flex gap-2">
          <a href={`/api/invoices/csv?${csvParams.toString()}`}>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          </a>
          <Link href="/invoices/new">
            <Button className="bg-[#C9A227] hover:bg-[#b8911f] text-white" size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Invoiced", value: fmt(totalInvoiced), color: "text-gray-900" },
          { label: "Total Paid", value: fmt(totalPaid), color: "text-green-600" },
          {
            label: "Outstanding",
            value: fmt(outstanding),
            color: outstanding > 0 ? "text-red-600" : "text-green-600",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn("text-xl font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        {/* Status tabs */}
        <div className="flex gap-0 overflow-x-auto border-b border-gray-100">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildUrl({ status: tab.value })}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                status === tab.value
                  ? "border-[#C9A227] text-[#C9A227]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              defaultValue={dateFrom}
              name="dateFrom"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              defaultValue={dateTo}
              name="dateTo"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Link
              href={buildUrl({ dateFrom: "", dateTo: "" })}
              className="text-xs text-gray-400 hover:text-gray-600 pb-1.5"
            >
              Clear dates
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No invoices found</p>
          <Link href="/invoices/new" className="text-[#0C0F4C] hover:underline text-sm mt-2 inline-block">
            Create your first invoice
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Number</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Player</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">Event</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Issue Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Due Date</th>
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
                    <tr
                      key={inv.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
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
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell truncate max-w-[160px]">
                        {inv.events?.title ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {inv.issue_date}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {inv.due_date}
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
