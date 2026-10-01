"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { ArrowLeft, Download, Send, Trash2, XCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "cn"
import {
  getInvoice,
  getSettings,
  recordPayment,
  deletePayment,
  deleteInvoice,
  voidInvoice,
  sendInvoice,
  type InvoiceDetail as InvoiceDetailType,
} from "@/app/(app)/invoices/actions"
import { InvoiceForm } from "./InvoiceForm"
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
  return "secondary" // draft
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

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
]

type Props = {
  invoiceId: string
}

export function InvoiceDetail({ invoiceId }: Props) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<InvoiceDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Tables<"settings"> | null>(null)
  const [editing, setEditing] = useState(false)

  // Action states
  const [sending, setSending] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)

  // Payment dialog
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState("bank_transfer")
  const [payRef, setPayRef] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [recordingPay, setRecordingPay] = useState(false)

  const fetchRef = useRef(false)

  const loadInvoice = useCallback(async () => {
    setLoading(true)
    const [inv, s] = await Promise.all([getInvoice(invoiceId), getSettings()])
    setInvoice(inv)
    setSettings(s)
    setLoading(false)
  }, [invoiceId])

  useEffect(() => {
    if (fetchRef.current) return
    fetchRef.current = true
    loadInvoice()
  }, [loadInvoice])

  async function handleSend() {
    if (!invoice) return
    setSending(true)
    const { ok, error } = await sendInvoice(invoice.id)
    if (!ok || error) {
      toast.error(error ?? "Failed to send invoice")
    } else {
      toast.success("Invoice sent")
      fetchRef.current = false
      await loadInvoice()
    }
    setSending(false)
  }

  async function handleVoid() {
    if (!invoice) return
    setVoiding(true)
    const { error } = await voidInvoice(invoice.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Invoice voided")
      fetchRef.current = false
      await loadInvoice()
    }
    setVoiding(false)
    setShowVoidConfirm(false)
  }

  async function handleDelete() {
    if (!invoice) return
    setDeleting(true)
    const { error } = await deleteInvoice(invoice.id)
    if (error) {
      toast.error(error)
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }
    toast.success("Invoice deleted")
    router.push("/invoices")
  }

  async function handleRecordPayment() {
    if (!invoice) return
    if (!payAmount) return toast.error("Enter a payment amount")
    setRecordingPay(true)
    const { error } = await recordPayment(invoice.id, {
      amount_cents: Math.round(parseFloat(payAmount) * 100),
      paid_on: payDate,
      method: payMethod,
      reference: payRef || undefined,
      notes: payNotes || undefined,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Payment recorded")
      setShowPayment(false)
      setPayAmount("")
      setPayRef("")
      setPayNotes("")
      fetchRef.current = false
      await loadInvoice()
    }
    setRecordingPay(false)
  }

  async function handleDeletePayment(paymentId: string) {
    const { error } = await deletePayment(paymentId)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Payment removed")
      fetchRef.current = false
      await loadInvoice()
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Invoice not found</p>
          <Link href="/invoices" className="text-[#0C0F4C] hover:underline text-sm mt-2 inline-block">
            Back to invoices
          </Link>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <InvoiceForm
        invoice={invoice}
        onSave={async (id) => {
          setEditing(false)
          fetchRef.current = false
          await loadInvoice()
          void id
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const balance = invoice.total_cents - invoice.amount_paid_cents
  const hasBankDetails = !!settings?.bank_account_name
  const showBankWarning =
    (invoice.status === "draft" || invoice.status === "sent") && !hasBankDetails

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-gray-400 text-sm">Invoices</span>
      </div>

      {/* Bank warning */}
      {showBankWarning && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Bank details not configured</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Add bank details in{" "}
              <Link href="/settings" className="underline">Settings</Link>{" "}
              before sending this invoice.
            </p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {invoice.number}
              </h1>
              <Badge
                variant={statusVariant(invoice.status)}
                className={cn(invoice.status === "void" && "line-through")}
              >
                {statusLabel(invoice.status)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              Issue: {invoice.issue_date} &middot; Due: {invoice.due_date}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/invoices/pdf?invoiceId=${invoice.id}`)}
            >
              <Download className="w-4 h-4 mr-1.5" />
              PDF
            </Button>

            {invoice.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}

            {(invoice.status === "draft" || invoice.status === "sent") && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending}
                className="bg-[#0C0F4C] hover:bg-[#1a1f6e] text-white"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {sending ? "Sending..." : "Send"}
              </Button>
            )}

            {invoice.status !== "void" && invoice.status !== "paid" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVoidConfirm(true)}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Void
              </Button>
            )}

            {invoice.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bill to */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Bill To</h2>
        <div className="space-y-1 text-sm">
          {invoice.contacts && (
            <>
              <p className="font-medium text-gray-900">
                {[invoice.contacts.first_name, invoice.contacts.last_name].filter(Boolean).join(" ") || invoice.contacts.email}
              </p>
              {invoice.contacts.email && (
                <p className="text-gray-500">{invoice.contacts.email}</p>
              )}
            </>
          )}
          {invoice.players && (
            <p className="text-gray-600">
              Player: {[invoice.players.first_name, invoice.players.last_name].filter(Boolean).join(" ")}
            </p>
          )}
          {invoice.events && (
            <p className="text-gray-600">
              Event: {invoice.events.title}
              {invoice.events.start_at && (
                <span className="text-gray-400 ml-1">
                  ({format(new Date(invoice.events.start_at), "d MMM yyyy")})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-16">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.invoice_items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-700">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(item.unit_price_cents)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(item.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex justify-end">
            <div className="space-y-1.5 min-w-[220px]">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{fmt(invoice.subtotal_cents)}</span>
              </div>
              {invoice.gst_cents > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST (included)</span>
                  <span>{fmt(invoice.gst_cents)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1.5">
                <span>Total</span>
                <span>{fmt(invoice.total_cents)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Amount Paid</span>
                <span className="text-green-600">{fmt(invoice.amount_paid_cents)}</span>
              </div>
              <div
                className={cn(
                  "flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5",
                  balance > 0 ? "text-red-600" : "text-green-600"
                )}
              >
                <span>Balance Due</span>
                <span>{fmt(balance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Payments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Payments</h2>
          {invoice.status !== "void" && invoice.status !== "paid" && (
            <Button
              size="sm"
              onClick={() => setShowPayment(true)}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              Record Payment
            </Button>
          )}
        </div>

        {invoice.payments.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {invoice.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{fmt(p.amount_cents)}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-gray-600">{p.paid_on}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-gray-600 capitalize">{p.method.replace(/_/g, " ")}</span>
                  {p.reference && (
                    <>
                      <span className="text-gray-400 mx-2">·</span>
                      <span className="text-gray-500">Ref: {p.reference}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => handleDeletePayment(p.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-3"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record payment dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Amount (AUD) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Transaction ID, cheque no..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordingPay}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {recordingPay ? "Recording..." : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void confirm */}
      <Dialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Void invoice?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will mark the invoice as void. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVoidConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding}>
              {voiding ? "Voiding..." : "Void invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete invoice?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will permanently delete this draft invoice.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
