"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CheckCircle, Upload, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Requirement {
  id: string
  document_type_id: string
  required: boolean
  document_types: { id: string; name: string; description: string | null }
}

interface EventInfo {
  id: string
  title: string
  start_at: string
  end_at: string | null
  venue_name: string | null
  city: string | null
}

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png,image/heic,.heic,.pdf,.jpg,.jpeg,.png"
const MAX_SIZE = 15 * 1024 * 1024 // 15MB

export function UploadShell({
  token,
  playerId,
  playerName,
  event,
  requirements,
  uploadedDocTypeIds: initialUploaded,
}: {
  token: string
  playerId: string | null
  playerName: string
  event: EventInfo
  requirements: Requirement[]
  uploadedDocTypeIds: string[]
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<Set<string>>(new Set(initialUploaded))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  async function handleUpload(docTypeId: string, file: File) {
    if (file.size > MAX_SIZE) {
      setErrors((e) => ({ ...e, [docTypeId]: `File too large (max 15MB)` }))
      return
    }

    setErrors((e) => { const n = { ...e }; delete n[docTypeId]; return n })
    setUploading(docTypeId)

    try {
      // 1. Get presigned upload URL
      const presignRes = await fetch(`/api/upload/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          documentTypeId: docTypeId,
          fileName: file.name,
          mimeType: file.type,
        }),
      })

      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to get upload URL")
      }

      const { signedUrl, path } = await presignRes.json()

      // 2. Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      })
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`)

      // 3. Confirm upload - create document record
      const confirmRes = await fetch(`/api/upload/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          documentTypeId: docTypeId,
          playerId,
          eventId: event.id,
          filePath: path,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      })

      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to confirm upload")
      }

      setUploaded((prev) => new Set([...prev, docTypeId]))
    } catch (err) {
      setErrors((e) => ({ ...e, [docTypeId]: err instanceof Error ? err.message : "Upload failed" }))
    } finally {
      setUploading(null)
    }
  }

  const allRequired = requirements.filter((r) => r.required)
  const allRequiredDone = allRequired.every((r) => uploaded.has(r.document_type_id))

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Documents received</h1>
          <p className="text-sm text-gray-500">
            Thank you! We have received the documents for {playerName}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0C0F4C] text-white px-4 py-5 text-center">
        <div className="text-lg font-bold text-[#C9A227] mb-0.5">Ginga Global Group</div>
        <div className="text-sm text-white/70">Document Upload</div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-12">
        {/* Player + event info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-medium">Player</div>
          <div className="font-semibold text-gray-900 text-lg">{playerName}</div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-medium">Event</div>
            <div className="font-medium text-gray-800">{event.title}</div>
            <div className="text-sm text-gray-500 mt-0.5">
              {format(new Date(event.start_at), "d MMM yyyy")}
              {event.venue_name ? ` - ${event.venue_name}` : ""}
              {event.city ? `, ${event.city}` : ""}
            </div>
          </div>
        </div>

        {/* Documents */}
        {requirements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            No documents required for this event.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 px-1">Required documents</div>
            {requirements.map((req) => {
              const isUploaded = uploaded.has(req.document_type_id)
              const isUploading = uploading === req.document_type_id
              const err = errors[req.document_type_id]

              return (
                <div
                  key={req.document_type_id}
                  className={`bg-white rounded-xl border-2 p-4 transition-colors ${
                    isUploaded ? "border-green-200 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{req.document_types.name}</span>
                        {!req.required && (
                          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Optional</span>
                        )}
                      </div>
                      {req.document_types.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{req.document_types.description}</p>
                      )}
                    </div>
                    {isUploaded ? (
                      <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <div className="shrink-0">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept={ACCEPTED_TYPES}
                            className="sr-only"
                            disabled={isUploading}
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleUpload(req.document_type_id, f)
                              e.target.value = ""
                            }}
                          />
                          <div className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isUploading
                              ? "bg-gray-100 text-gray-400 cursor-wait"
                              : "bg-[#C9A227] text-white hover:bg-[#b8911f] active:scale-95"
                          }`}>
                            <Upload className="w-4 h-4" />
                            {isUploading ? "Uploading..." : "Upload"}
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                  {err && (
                    <div className="flex items-center gap-1.5 mt-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {err}
                    </div>
                  )}
                  {isUploaded && (
                    <div className="text-sm text-green-600 mt-1 font-medium">Received - thank you</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Accepted formats note */}
        <p className="text-xs text-gray-400 text-center px-2">
          Accepted formats: PDF, JPG, PNG, HEIC - max 15MB per file
        </p>

        {allRequiredDone && requirements.length > 0 && (
          <Button
            onClick={() => setDone(true)}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-semibold"
          >
            Done - all documents submitted
          </Button>
        )}
      </div>
    </div>
  )
}
