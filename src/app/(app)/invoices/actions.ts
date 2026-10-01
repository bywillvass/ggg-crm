"use server"

import { unstable_cache, updateTag } from "next/cache"
import { requireAdmin, getCurrentRole, requireAuth } from "@/lib/auth/role"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { logActivity } from "@/lib/activity"
import { redirect } from "next/navigation"
import { Resend } from "resend"
import type { Tables } from "@/lib/database.types"

async function requireAnyRole() {
  const role = await getCurrentRole()
  if (!role) redirect("/login")
  return role
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactForInvoice = Pick<Tables<"contacts">, "id" | "first_name" | "last_name" | "email">

export type InvoiceRow = Tables<"invoices"> & {
  contacts: ContactForInvoice | null
  players: Pick<Tables<"players">, "id" | "first_name" | "last_name"> | null
  events: Pick<Tables<"events">, "id" | "title" | "start_at"> | null
}

export type InvoiceItemRow = Tables<"invoice_items">
export type PaymentRow = Tables<"payments">

export type InvoiceDetail = InvoiceRow & {
  invoice_items: InvoiceItemRow[]
  payments: PaymentRow[]
}

export type InvoiceItemInput = {
  description: string
  quantity: number
  unit_price_cents: number
  sort_order: number
}

export type InvoiceInput = {
  contact_id: string
  player_id?: string | null
  event_id?: string | null
  issue_date: string
  due_date: string
  notes?: string | null
  items: InvoiceItemInput[]
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function getSettings(): Promise<Tables<"settings"> | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single()
  return data
}

function calcTotals(
  items: InvoiceItemInput[],
  gstRegistered: boolean
): { subtotal_cents: number; gst_cents: number; total_cents: number } {
  const subtotal_cents = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_cents,
    0
  )
  const gst_cents = gstRegistered ? Math.round(subtotal_cents / 11) : 0
  const total_cents = subtotal_cents
  return { subtotal_cents, gst_cents, total_cents }
}

function contactDisplayName(c: ContactForInvoice | null | undefined): string {
  if (!c) return ""
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || ""
}

// ─── Actions ──────────────────────────────────────────────────────────────────

const _cachedInvoices = unstable_cache(
  async (): Promise<InvoiceRow[]> => {
    const { data } = await serviceClient
      .from("invoices")
      .select(`
        *,
        contacts:contact_id(id, first_name, last_name, email),
        players:player_id(id, first_name, last_name),
        events:event_id(id, title, start_at)
      `)
      .order("created_at", { ascending: false })
    return (data ?? []) as InvoiceRow[]
  },
  ["invoices"],
  { revalidate: 60, tags: ["invoices"] }
)

export async function listInvoices(filters?: {
  status?: string
  eventId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<InvoiceRow[]> {
  await requireAdmin()

  let results = await _cachedInvoices()

  if (filters?.status) {
    results = results.filter((i) => i.status === (filters.status as Tables<"invoices">["status"]))
  }
  if (filters?.eventId) {
    results = results.filter((i) => i.event_id === filters.eventId)
  }
  if (filters?.dateFrom) {
    results = results.filter((i) => i.issue_date >= filters.dateFrom!)
  }
  if (filters?.dateTo) {
    results = results.filter((i) => i.issue_date <= filters.dateTo!)
  }

  return results
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("invoices")
    .select(`
      *,
      contacts:contact_id(id, first_name, last_name, email),
      players:player_id(id, first_name, last_name),
      events:event_id(id, title, start_at),
      invoice_items(*),
      payments(*)
    `)
    .eq("id", id)
    .single()

  if (!data) return null

  const typed = data as InvoiceDetail & {
    invoice_items: InvoiceItemRow[]
    payments: PaymentRow[]
  }

  // Sort items by sort_order
  typed.invoice_items = (typed.invoice_items ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  )
  typed.payments = (typed.payments ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return typed
}

export async function createInvoice(
  input: InvoiceInput
): Promise<{ data: Tables<"invoices"> | null; error: string | null }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  // Get settings
  const settings = await getSettings()
  const prefix = settings?.invoice_prefix ?? "INV-"
  const nextNum = settings?.invoice_next_number ?? 1
  const paymentTermsDays = settings?.payment_terms_days ?? 14
  const gstRegistered = settings?.gst_registered ?? false

  const number = `${prefix}${String(nextNum).padStart(4, "0")}`

  // Calculate totals
  const { subtotal_cents, gst_cents, total_cents } = calcTotals(input.items, gstRegistered)

  // Determine dates
  const issueDate = input.issue_date || new Date().toISOString().slice(0, 10)
  const dueDate =
    input.due_date ||
    (() => {
      const d = new Date(issueDate)
      d.setDate(d.getDate() + paymentTermsDays)
      return d.toISOString().slice(0, 10)
    })()

  // Insert invoice
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      number,
      contact_id: input.contact_id,
      player_id: input.player_id ?? null,
      event_id: input.event_id ?? null,
      status: "draft",
      issue_date: issueDate,
      due_date: dueDate,
      subtotal_cents,
      gst_cents,
      total_cents,
      amount_paid_cents: 0,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error || !invoice) {
    return { data: null, error: error?.message ?? "Failed to create invoice" }
  }

  // Insert items
  if (input.items.length > 0) {
    await supabase.from("invoice_items").insert(
      input.items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        amount_cents: item.quantity * item.unit_price_cents,
        sort_order: item.sort_order,
      }))
    )
  }

  // Increment next invoice number
  await supabase
    .from("settings")
    .update({ invoice_next_number: nextNum + 1 })
    .eq("id", 1)

  await logActivity({
    type: "note",
    contact_id: input.contact_id,
    player_id: input.player_id ?? undefined,
    event_id: input.event_id ?? undefined,
    body: `Invoice ${number} created`,
    created_by: user.id,
  })

  updateTag("invoices")
  return { data: invoice, error: null }
}

export async function updateInvoice(
  id: string,
  input: InvoiceInput
): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const settings = await getSettings()
  const gstRegistered = settings?.gst_registered ?? false
  const { subtotal_cents, gst_cents, total_cents } = calcTotals(input.items, gstRegistered)

  const { error } = await supabase
    .from("invoices")
    .update({
      contact_id: input.contact_id,
      player_id: input.player_id ?? null,
      event_id: input.event_id ?? null,
      issue_date: input.issue_date,
      due_date: input.due_date,
      subtotal_cents,
      gst_cents,
      total_cents,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return { error: error.message }

  // Replace items
  await supabase.from("invoice_items").delete().eq("invoice_id", id)

  if (input.items.length > 0) {
    await supabase.from("invoice_items").insert(
      input.items.map((item) => ({
        invoice_id: id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        amount_cents: item.quantity * item.unit_price_cents,
        sort_order: item.sort_order,
      }))
    )
  }

  updateTag("invoices")
  return { error: null }
}

export async function deleteInvoice(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .single()

  if (!inv) return { error: "Invoice not found" }
  if (inv.status !== "draft") return { error: "Only draft invoices can be deleted" }

  await supabase.from("invoice_items").delete().eq("invoice_id", id)
  const { error } = await supabase.from("invoices").delete().eq("id", id)

  updateTag("invoices")
  return { error: error?.message ?? null }
}

export async function voidInvoice(id: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "void",
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  updateTag("invoices")
  return { error: error?.message ?? null }
}

export async function recordPayment(
  invoiceId: string,
  input: {
    amount_cents: number
    paid_on: string
    method: string
    reference?: string
    notes?: string
  }
): Promise<{ error: string | null }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  // Insert payment
  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount_cents: input.amount_cents,
    paid_on: input.paid_on,
    method: input.method,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    recorded_by: user.id,
  })

  if (error) return { error: error.message }

  // Recalculate total paid
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", invoiceId)

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount_cents, 0)

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_cents")
    .eq("id", invoiceId)
    .single()

  const newStatus: Tables<"invoices">["status"] =
    totalPaid >= (invoice?.total_cents ?? 0) ? "paid" : "part_paid"

  await supabase
    .from("invoices")
    .update({
      amount_paid_cents: totalPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)

  await logActivity({
    type: "payment_recorded",
    body: `Payment of $${(input.amount_cents / 100).toFixed(2)} recorded`,
    created_by: user.id,
  })

  updateTag("invoices")
  return { error: null }
}

export async function deletePayment(paymentId: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from("payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .single()

  if (!payment) return { error: "Payment not found" }

  const { error } = await supabase.from("payments").delete().eq("id", paymentId)
  if (error) return { error: error.message }

  // Recalculate
  const { data: remaining } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", payment.invoice_id)

  const totalPaid = (remaining ?? []).reduce((sum, p) => sum + p.amount_cents, 0)

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_cents")
    .eq("id", payment.invoice_id)
    .single()

  const newStatus: Tables<"invoices">["status"] =
    totalPaid === 0
      ? "sent"
      : totalPaid >= (invoice?.total_cents ?? 0)
      ? "paid"
      : "part_paid"

  await supabase
    .from("invoices")
    .update({
      amount_paid_cents: totalPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.invoice_id)

  updateTag("invoices")
  return { error: null }
}

export async function bulkCreateFromEvent(
  eventId: string
): Promise<{ created: number; error: string | null }> {
  await requireAdmin()
  const supabase = await createClient()

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("id, title, price_cents")
    .eq("id", eventId)
    .single()

  if (!event) return { created: 0, error: "Event not found" }

  // Get confirmed participants with contact_id
  const { data: participants } = await supabase
    .from("event_participants")
    .select("id, contact_id, player_id")
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .not("contact_id", "is", null)

  if (!participants?.length) return { created: 0, error: null }

  // Get existing invoices for this event
  const { data: existingInvoices } = await supabase
    .from("invoices")
    .select("contact_id")
    .eq("event_id", eventId)

  const existingContactIds = new Set(
    (existingInvoices ?? []).map((i) => i.contact_id)
  )

  const settings = await getSettings()
  const prefix = settings?.invoice_prefix ?? "INV-"
  let nextNum = settings?.invoice_next_number ?? 1
  const gstRegistered = settings?.gst_registered ?? false
  const paymentTermsDays = settings?.payment_terms_days ?? 14
  const pricePerItem = event.price_cents ?? 0

  const issueDate = new Date().toISOString().slice(0, 10)
  const dueDate = (() => {
    const d = new Date(issueDate)
    d.setDate(d.getDate() + paymentTermsDays)
    return d.toISOString().slice(0, 10)
  })()

  const subtotal_cents = pricePerItem
  const gst_cents = gstRegistered ? Math.round(subtotal_cents / 11) : 0
  const total_cents = subtotal_cents

  let created = 0

  for (const participant of participants) {
    if (!participant.contact_id) continue
    if (existingContactIds.has(participant.contact_id)) continue

    const number = `${prefix}${String(nextNum).padStart(4, "0")}`

    const { data: invoice } = await supabase
      .from("invoices")
      .insert({
        number,
        contact_id: participant.contact_id,
        player_id: participant.player_id ?? null,
        event_id: eventId,
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate,
        subtotal_cents,
        gst_cents,
        total_cents,
        amount_paid_cents: 0,
      })
      .select("id")
      .single()

    if (invoice) {
      await supabase.from("invoice_items").insert({
        invoice_id: invoice.id,
        description: `Event Attendance: ${event.title}`,
        quantity: 1,
        unit_price_cents: pricePerItem,
        amount_cents: pricePerItem,
        sort_order: 0,
      })

      nextNum++
      created++
    }
  }

  // Update next number in settings
  if (created > 0) {
    await supabase
      .from("settings")
      .update({ invoice_next_number: nextNum })
      .eq("id", 1)
  }

  updateTag("invoices")
  return { created, error: null }
}

export async function sendInvoice(
  invoiceId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const user = await requireAuth()
  const supabase = await createClient()

  const invoice = await getInvoice(invoiceId)
  if (!invoice) return { ok: false, error: "Invoice not found" }
  if (!invoice.contacts?.email) return { ok: false, error: "Contact has no email" }
  const contactEmail = invoice.contacts.email as string

  const settings = await getSettings()

  // Fetch PDF from the internal route
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.gingaglobalgroup.com"

  let pdfBuffer: Buffer | null = null
  try {
    const pdfRes = await fetch(`${appUrl}/api/invoices/pdf?invoiceId=${invoiceId}`, {
      headers: {
        "x-internal-key": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      },
    })
    if (pdfRes.ok) {
      const arrayBuf = await pdfRes.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuf)
    }
  } catch {
    // PDF generation failed; proceed without attachment
  }

  // Upload PDF to storage
  let pdfPath: string | null = null
  if (pdfBuffer) {
    const storagePath = `invoices/${invoiceId}.pdf`
    const { error: upErr } = await serviceClient.storage
      .from("invoices")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (!upErr) {
      pdfPath = storagePath
    }
  }

  // Update invoice
  await supabase
    .from("invoices")
    .update({
      pdf_path: pdfPath,
      sent_at: new Date().toISOString(),
      status: "sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)

  // Send email via Resend
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    const fromName = settings?.org_name ?? "Ginga Global Group"
    const fromEmail = settings?.email_from_address ?? "invoices@gingaglobalgroup.com"
    const contactName = contactDisplayName(invoice.contacts)

    const attachments = pdfBuffer
      ? [
          {
            filename: `Invoice-${invoice.number}.pdf`,
            content: pdfBuffer,
          },
        ]
      : []

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [contactEmail],
      subject: `Invoice ${invoice.number} from ${fromName}`,
      html: `
        <p>Hi ${contactName},</p>
        <p>Please find attached invoice <strong>${invoice.number}</strong> for <strong>$${(invoice.total_cents / 100).toFixed(2)}</strong>.</p>
        ${invoice.events ? `<p>Event: ${invoice.events.title}</p>` : ""}
        <p>Due date: ${invoice.due_date}</p>
        ${settings?.invoice_footer ? `<p>${settings.invoice_footer}</p>` : ""}
        <p>Thank you</p>
      `,
      attachments,
    })
  }

  await logActivity({
    type: "invoice_sent",
    contact_id: invoice.contact_id,
    player_id: invoice.player_id ?? undefined,
    event_id: invoice.event_id ?? undefined,
    body: `Invoice ${invoice.number} sent`,
    created_by: user.id,
  })

  updateTag("invoices")
  return { ok: true }
}

export async function getInvoiceCsvData(filters?: {
  status?: string
  eventId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<
  Array<{
    number: string
    contact: string
    email: string
    player: string
    event: string
    issue_date: string
    due_date: string
    subtotal: string
    gst: string
    total: string
    paid: string
    balance: string
    status: string
  }>
> {
  const invoices = await listInvoices(filters)
  return invoices.map((inv) => ({
    number: inv.number,
    contact: contactDisplayName(inv.contacts),
    email: inv.contacts?.email ?? "",
    player: inv.players
      ? `${inv.players.first_name} ${inv.players.last_name}`
      : "",
    event: inv.events?.title ?? "",
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    subtotal: (inv.subtotal_cents / 100).toFixed(2),
    gst: (inv.gst_cents / 100).toFixed(2),
    total: (inv.total_cents / 100).toFixed(2),
    paid: (inv.amount_paid_cents / 100).toFixed(2),
    balance: ((inv.total_cents - inv.amount_paid_cents) / 100).toFixed(2),
    status: inv.status,
  }))
}

// ─── Supporting search functions for InvoiceForm ──────────────────────────────

export async function searchContactsForInvoice(
  query: string
): Promise<ContactForInvoice[]> {
  await requireAnyRole()
  const supabase = await createClient()

  let q = supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .is("archived_at", null)
    .order("last_name")
    .limit(20)

  if (query.length >= 2) {
    q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
  }

  const { data } = await q
  return (data ?? []) as ContactForInvoice[]
}

export async function searchPlayersForInvoice(
  query: string
): Promise<Pick<Tables<"players">, "id" | "first_name" | "last_name">[]> {
  await requireAnyRole()
  const supabase = await createClient()

  let q = supabase
    .from("players")
    .select("id, first_name, last_name")
    .is("archived_at", null)
    .order("last_name")
    .limit(20)

  if (query.length >= 2) {
    q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
  }

  const { data } = await q
  return data ?? []
}

export async function searchEventsForInvoice(
  query: string
): Promise<Pick<Tables<"events">, "id" | "title" | "start_at">[]> {
  await requireAnyRole()
  const supabase = await createClient()

  let q = supabase
    .from("events")
    .select("id, title, start_at")
    .is("archived_at", null)
    .order("start_at", { ascending: false })
    .limit(20)

  if (query.length >= 2) {
    q = q.ilike("title", `%${query}%`)
  }

  const { data } = await q
  return data ?? []
}
