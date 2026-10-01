"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { LeadDetail } from "@/components/leads/LeadDetail"
import type { LeadDetail as LeadDetailType } from "@/app/(app)/leads/actions"

type Props = {
  open: boolean
  onClose: () => void
  lead: LeadDetailType
}

export function LeadDetailSheet({ open, onClose, lead }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <LeadDetail lead={lead} />
      </SheetContent>
    </Sheet>
  )
}
