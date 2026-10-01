"use client"

import { useRouter } from "next/navigation"
import { InvoiceForm } from "@/components/invoices/InvoiceForm"

export default function NewInvoicePage() {
  const router = useRouter()

  return (
    <InvoiceForm
      onSave={(id) => router.push(`/invoices/${id}`)}
      onCancel={() => router.push("/invoices")}
    />
  )
}
