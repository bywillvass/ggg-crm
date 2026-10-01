import { NextRequest, NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/role"
import { getInvoiceCsvData } from "@/app/(app)/invoices/actions"

export async function GET(req: NextRequest) {
  const role = await getCurrentRole()
  if (role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? undefined
  const eventId = sp.get("eventId") ?? undefined
  const dateFrom = sp.get("dateFrom") ?? undefined
  const dateTo = sp.get("dateTo") ?? undefined

  const rows = await getInvoiceCsvData({ status, eventId, dateFrom, dateTo })

  const headers = [
    "Number", "Contact", "Email", "Player", "Event",
    "Issue Date", "Due Date", "Subtotal", "GST", "Total",
    "Paid", "Balance", "Status",
  ]

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.number,
        `"${row.contact.replace(/"/g, '""')}"`,
        row.email,
        `"${row.player.replace(/"/g, '""')}"`,
        `"${row.event.replace(/"/g, '""')}"`,
        row.issue_date,
        row.due_date,
        row.subtotal,
        row.gst,
        row.total,
        row.paid,
        row.balance,
        row.status,
      ].join(",")
    ),
  ]

  const csv = csvRows.join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
