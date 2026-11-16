"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getSentEmailPreview } from "@/app/(app)/email/actions"

type Preview = { subject: string; html: string; from: string; replyTo: string | null }

// Shows a logged email the way its recipient received it
export function EmailPreviewDialog({
  messageId,
  toLabel,
  onClose,
}: {
  messageId: string | null
  toLabel?: string
  onClose: () => void
}) {
  const [result, setResult] = useState<{ id: string; preview: Preview | null } | null>(null)
  const loading = !!messageId && result?.id !== messageId
  const preview = result?.id === messageId ? result.preview : null

  useEffect(() => {
    if (!messageId) return
    let cancelled = false
    getSentEmailPreview(messageId).then((p) => {
      if (!cancelled) setResult({ id: messageId, preview: p })
    })
    return () => { cancelled = true }
  }, [messageId])

  return (
    <Dialog open={!!messageId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preview?.subject ?? "Email"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
        ) : !preview ? (
          <div className="py-10 text-center text-sm text-gray-400">Couldn&apos;t load this email.</div>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-500">From</dt>
              <dd className="text-gray-900 break-all">{preview.from}</dd>
              {toLabel && (
                <>
                  <dt className="text-gray-500">To</dt>
                  <dd className="text-gray-900 break-all">{toLabel}</dd>
                </>
              )}
              {preview.replyTo && (
                <>
                  <dt className="text-gray-500">Reply to</dt>
                  <dd className="text-gray-900 break-all">{preview.replyTo}</dd>
                </>
              )}
            </dl>
            <iframe
              title="Email content"
              srcDoc={preview.html}
              sandbox=""
              className="w-full h-[60vh] rounded-md border bg-white"
            />
            <p className="text-xs text-gray-400">The unsubscribe link is disabled in this preview.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
