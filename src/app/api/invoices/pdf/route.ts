import { NextRequest, NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getCurrentRole } from "@/lib/auth/role"
import { Document, Page, Text, View, StyleSheet, pdf, Image, type DocumentProps } from "@react-pdf/renderer"
import React from "react"

const NAVY = "#1a1a2e"
const RED = "#e94560"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#333333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  orgName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 4,
  },
  orgDetail: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  logoBox: {
    width: 80,
    height: 80,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  logoImage: {
    width: 80,
    height: 80,
    objectFit: "contain",
  },
  titleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
  },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  invoiceMetaRight: {
    alignItems: "flex-end",
  },
  invoiceNumber: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: RED,
    marginBottom: 4,
  },
  invoiceMeta: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 2,
  },
  billToSection: {
    marginBottom: 24,
  },
  billToLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  billToName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 2,
  },
  billToDetail: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    padding: "6 8",
    marginBottom: 0,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  tableRowAlt: {
    backgroundColor: "#f8f8f8",
  },
  colDescription: {
    flex: 4,
  },
  colQty: {
    flex: 1,
    textAlign: "right",
  },
  colUnit: {
    flex: 2,
    textAlign: "right",
  },
  colAmount: {
    flex: 2,
    textAlign: "right",
  },
  cellText: {
    fontSize: 9,
    color: "#333333",
  },
  totalsSection: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
    minWidth: 200,
  },
  totalsLabel: {
    fontSize: 9,
    color: "#555555",
    width: 100,
    textAlign: "right",
    paddingRight: 8,
  },
  totalsValue: {
    fontSize: 9,
    color: "#333333",
    width: 80,
    textAlign: "right",
  },
  totalsBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
  },
  paymentSection: {
    marginTop: 30,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 4,
  },
  paymentTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
  },
  paymentDetail: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#999999",
  },
})

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

type InvItem = {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  sort_order: number
}

type InvData = {
  id: string
  number: string
  issue_date: string
  due_date: string
  status: string
  subtotal_cents: number
  gst_cents: number
  total_cents: number
  amount_paid_cents: number
  notes: string | null
  invoice_items: InvItem[]
  contacts: { first_name: string | null; last_name: string | null; email: string | null } | null
  players: { first_name: string | null; last_name: string | null } | null
  events: { title: string } | null
}

type SettingsData = {
  org_name: string
  abn: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  gst_registered: boolean
  bank_account_name: string | null
  bank_account_number: string | null
  bank_bsb: string | null
  payid: string | null
  invoice_footer: string | null
  logo_path: string | null
}

function InvoicePDF({
  invoice,
  settings,
  logoUrl,
}: {
  invoice: InvData
  settings: SettingsData
  logoUrl?: string
}) {
  const isGst = settings.gst_registered && invoice.gst_cents > 0
  const hasBankDetails = !!settings.bank_account_name

  return React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: styles.page },

      // Header
      React.createElement(
        View,
        { style: styles.header },
        // Left: org info
        React.createElement(
          View,
          { style: { flex: 1 } },
          React.createElement(Text, { style: styles.orgName }, settings.org_name),
          settings.abn
            ? React.createElement(Text, { style: styles.orgDetail }, `ABN: ${settings.abn}`)
            : null,
          settings.address
            ? React.createElement(Text, { style: styles.orgDetail }, settings.address)
            : null,
          settings.phone
            ? React.createElement(Text, { style: styles.orgDetail }, settings.phone)
            : null,
          settings.email
            ? React.createElement(Text, { style: styles.orgDetail }, settings.email)
            : null,
          settings.website
            ? React.createElement(Text, { style: styles.orgDetail }, settings.website)
            : null
        ),
        // Right: logo
        logoUrl
          ? React.createElement(
              View,
              { style: styles.logoBox },
              React.createElement(Image, { style: styles.logoImage, src: logoUrl })
            )
          : null
      ),

      // Title section
      React.createElement(
        View,
        { style: styles.titleSection },
        React.createElement(
          Text,
          { style: styles.invoiceTitle },
          isGst ? "Tax Invoice" : "Invoice"
        ),
        React.createElement(
          View,
          { style: styles.invoiceMetaRight },
          React.createElement(Text, { style: styles.invoiceNumber }, invoice.number),
          React.createElement(
            Text,
            { style: styles.invoiceMeta },
            `Issue Date: ${invoice.issue_date}`
          ),
          React.createElement(
            Text,
            { style: styles.invoiceMeta },
            `Due Date: ${invoice.due_date}`
          )
        )
      ),

      // Bill to
      React.createElement(
        View,
        { style: styles.billToSection },
        React.createElement(Text, { style: styles.billToLabel }, "Bill To"),
        invoice.contacts
          ? React.createElement(
              View,
              {},
              React.createElement(
                Text,
                { style: styles.billToName },
                [invoice.contacts.first_name, invoice.contacts.last_name].filter(Boolean).join(" ") || invoice.contacts.email || ""
              ),
              invoice.contacts.email
                ? React.createElement(
                    Text,
                    { style: styles.billToDetail },
                    invoice.contacts.email
                  )
                : null,
              invoice.players
                ? React.createElement(
                    Text,
                    { style: styles.billToDetail },
                    `Player: ${[invoice.players.first_name, invoice.players.last_name].filter(Boolean).join(" ")}`
                  )
                : null,
              invoice.events
                ? React.createElement(
                    Text,
                    { style: styles.billToDetail },
                    `Event: ${invoice.events.title}`
                  )
                : null
            )
          : null
      ),

      // Items table header
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(
          Text,
          { style: [styles.tableHeaderText, styles.colDescription] },
          "Description"
        ),
        React.createElement(
          Text,
          { style: [styles.tableHeaderText, styles.colQty] },
          "Qty"
        ),
        React.createElement(
          Text,
          { style: [styles.tableHeaderText, styles.colUnit] },
          "Unit Price"
        ),
        React.createElement(
          Text,
          { style: [styles.tableHeaderText, styles.colAmount] },
          "Amount"
        )
      ),

      // Items
      ...invoice.invoice_items.map((item, idx) =>
        React.createElement(
          View,
          {
            key: item.id,
            style: idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow,
          },
          React.createElement(
            Text,
            { style: [styles.cellText, styles.colDescription] },
            item.description
          ),
          React.createElement(
            Text,
            { style: [styles.cellText, styles.colQty] },
            String(item.quantity)
          ),
          React.createElement(
            Text,
            { style: [styles.cellText, styles.colUnit] },
            fmt(item.unit_price_cents)
          ),
          React.createElement(
            Text,
            { style: [styles.cellText, styles.colAmount] },
            fmt(item.amount_cents)
          )
        )
      ),

      // Totals
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Subtotal"),
          React.createElement(
            Text,
            { style: styles.totalsValue },
            fmt(invoice.subtotal_cents)
          )
        ),
        isGst
          ? React.createElement(
              View,
              { style: styles.totalsRow },
              React.createElement(
                Text,
                { style: styles.totalsLabel },
                "GST (included)"
              ),
              React.createElement(
                Text,
                { style: styles.totalsValue },
                fmt(invoice.gst_cents)
              )
            )
          : null,
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(
            Text,
            { style: [styles.totalsLabel, styles.totalsBold] },
            "Total"
          ),
          React.createElement(
            Text,
            { style: [styles.totalsValue, styles.totalsBold] },
            fmt(invoice.total_cents)
          )
        )
      ),

      // Payment instructions
      React.createElement(
        View,
        { style: styles.paymentSection },
        React.createElement(
          Text,
          { style: styles.paymentTitle },
          "Payment Details"
        ),
        hasBankDetails
          ? React.createElement(
              View,
              {},
              React.createElement(
                Text,
                { style: styles.paymentDetail },
                "Bank Transfer"
              ),
              React.createElement(
                Text,
                { style: styles.paymentDetail },
                `Account Name: ${settings.bank_account_name}`
              ),
              settings.bank_bsb
                ? React.createElement(
                    Text,
                    { style: styles.paymentDetail },
                    `BSB: ${settings.bank_bsb}`
                  )
                : null,
              settings.bank_account_number
                ? React.createElement(
                    Text,
                    { style: styles.paymentDetail },
                    `Account No: ${settings.bank_account_number}`
                  )
                : null,
              settings.payid
                ? React.createElement(
                    Text,
                    { style: styles.paymentDetail },
                    `PayID: ${settings.payid}`
                  )
                : null,
              React.createElement(
                Text,
                { style: styles.paymentDetail },
                `Reference: ${invoice.number}`
              )
            )
          : React.createElement(
              Text,
              { style: styles.paymentDetail },
              "Payment details to follow."
            )
      ),

      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerText },
          settings.invoice_footer ?? ""
        ),
        React.createElement(
          Text,
          { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`
          },
          ""
        )
      )
    )
  )
}

export async function GET(req: NextRequest) {
  // Check internal key first (for server-side PDF generation calls)
  const internalKey = req.headers.get("x-internal-key")
  const isInternalCall = internalKey === process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!isInternalCall) {
    // Require admin session
    const role = await getCurrentRole()
    if (role !== "admin") {
      return new NextResponse("Unauthorized", { status: 401 })
    }
  }

  const invoiceId = req.nextUrl.searchParams.get("invoiceId")
  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
  }

  // Fetch invoice data
  const { data: invoiceRaw } = await serviceClient
    .from("invoices")
    .select(`
      *,
      contacts:contact_id(first_name, last_name, email),
      players:player_id(first_name, last_name),
      events:event_id(title),
      invoice_items(*)
    `)
    .eq("id", invoiceId)
    .single()

  if (!invoiceRaw) {
    return new NextResponse("Invoice not found", { status: 404 })
  }

  const invoice = invoiceRaw as InvData & { invoice_items: InvItem[] }
  invoice.invoice_items = (invoice.invoice_items ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  )

  // Fetch settings
  const { data: settingsRaw } = await serviceClient
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single()

  const settings: SettingsData = settingsRaw ?? {
    org_name: "Ginga Global Group",
    abn: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    gst_registered: false,
    bank_account_name: null,
    bank_account_number: null,
    bank_bsb: null,
    payid: null,
    invoice_footer: null,
    logo_path: null,
  }

  // Use logo_path directly as URL (it's stored as a URL string in settings)
  const logoUrl: string | undefined = settings.logo_path ?? undefined

  // Generate PDF — collect NodeJS.ReadableStream into Buffer for NextResponse
  const nodeStream = await pdf(
    React.createElement(InvoicePDF, { invoice, settings, logoUrl }) as React.ReactElement<DocumentProps>
  ).toBuffer()

  const chunks: Buffer[] = []
  for await (const chunk of nodeStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as ArrayBuffer))
  }
  const buffer = Buffer.concat(chunks)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice-${invoice.number}.pdf"`,
    },
  })
}
