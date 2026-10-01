"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Upload, Eye, Send, Check, AlertTriangle, Clock, X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  getEventDocumentMatrix,
  addRequirement,
  removeRequirement,
  listDocumentTypes,
  recordDocument,
  deleteDocument,
  getDocumentSignedUrl,
  getAdminUploadPresignedUrl,
  requestMissingDocuments,
  type DocumentMatrix,
  type DocumentTypeRow,
} from "@/app/(app)/documents/actions"
import { DocumentViewer } from "@/components/shared/DocumentViewer"

export function EventDocumentsTab({ eventId }: { eventId: string }) {
  const [matrix, setMatrix] = useState<DocumentMatrix | null>(null)
  const [docTypes, setDocTypes] = useState<DocumentTypeRow[]>([])
  const [loading, setLoading] = useState(true)

  // Add requirement dialog
  const [showAddReq, setShowAddReq] = useState(false)
  const [addDocTypeId, setAddDocTypeId] = useState("")
  const [addRequired, setAddRequired] = useState(true)
  const [addReqNotes, setAddReqNotes] = useState("")
  const [savingReq, setSavingReq] = useState(false)

  // Upload dialog
  const [uploadCell, setUploadCell] = useState<{ participantId: string; playerId: string | null; docTypeId: string; playerName: string } | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [expiresOn, setExpiresOn] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Request tokens dialog
  const [requestTokens, setRequestTokens] = useState<{ participantId: string; playerName: string; url: string }[]>([])
  const [showTokens, setShowTokens] = useState(false)
  const [requesting, setRequesting] = useState(false)

  // Document viewer
  const [viewerDoc, setViewerDoc] = useState<{ url: string; fileName: string; mimeType: string | null } | null>(null)

  // Bulk download filter
  const [downloadTypeId, setDownloadTypeId] = useState("")
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function load() {
      const [m, types] = await Promise.all([
        getEventDocumentMatrix(eventId),
        listDocumentTypes(),
      ])
      setMatrix(m)
      setDocTypes(types)
      setLoading(false)
    }
    load()
  }, [eventId])

  async function handleAddRequirement() {
    if (!addDocTypeId) return toast.error("Select a document type")
    setSavingReq(true)
    const { error } = await addRequirement(eventId, addDocTypeId, addRequired, addReqNotes)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Requirement added")
      const m = await getEventDocumentMatrix(eventId)
      setMatrix(m)
      setShowAddReq(false)
      setAddDocTypeId("")
      setAddReqNotes("")
    }
    setSavingReq(false)
  }

  async function handleRemoveRequirement(documentTypeId: string) {
    const { error } = await removeRequirement(eventId, documentTypeId)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Requirement removed")
      const m = await getEventDocumentMatrix(eventId)
      setMatrix(m)
    }
  }

  async function handleUpload() {
    if (!uploadCell || !uploadFile) return toast.error("No file selected")
    if (!uploadCell.playerId) return toast.error("Document uploads require a player")
    setUploading(true)

    try {
      const ext = uploadFile.name.split(".").pop() ?? "bin"
      const path = `events/${eventId}/${uploadCell.playerId}/${uploadCell.docTypeId}/${Date.now()}.${ext}`

      const { signedUrl, error: presignErr } = await getAdminUploadPresignedUrl(path)
      if (presignErr || !signedUrl) throw new Error(presignErr ?? "Failed to get upload URL")

      const res = await fetch(signedUrl, {
        method: "PUT",
        body: uploadFile,
        headers: { "Content-Type": uploadFile.type || "application/octet-stream" },
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

      const { error: recordErr } = await recordDocument({
        player_id: uploadCell.playerId,
        event_id: eventId,
        document_type_id: uploadCell.docTypeId,
        file_path: path,
        file_name: uploadFile.name,
        mime_type: uploadFile.type || null,
        size_bytes: uploadFile.size,
        expires_on: expiresOn || null,
        uploaded_via: "crm",
      })

      if (recordErr) throw new Error(recordErr)

      toast.success("Document uploaded")
      const m = await getEventDocumentMatrix(eventId)
      setMatrix(m)
      setUploadCell(null)
      setUploadFile(null)
      setExpiresOn("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm("Delete this document?")) return
    const { error } = await deleteDocument(documentId)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Document deleted")
      const m = await getEventDocumentMatrix(eventId)
      setMatrix(m)
    }
  }

  async function handleView(filePath: string, fileName: string, mimeType: string | null) {
    const { url, error } = await getDocumentSignedUrl(filePath)
    if (error || !url) {
      toast.error(error ?? "Failed to generate link")
    } else {
      setViewerDoc({ url, fileName, mimeType })
    }
  }

  async function handleRequestDocuments() {
    setRequesting(true)
    const { tokens, error } = await requestMissingDocuments(eventId)
    if (error) {
      toast.error(error)
    } else {
      setRequestTokens(tokens)
      setShowTokens(true)
      toast.success(`${tokens.length} upload link${tokens.length !== 1 ? "s" : ""} created`)
    }
    setRequesting(false)
  }

  async function handleDownloadZip() {
    setDownloading(true)
    const params = new URLSearchParams({ eventId })
    if (downloadTypeId) params.set("docTypeId", downloadTypeId)
    const res = await fetch(`/api/documents/download?${params}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? "Download failed")
      setDownloading(false)
      return
    }
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "documents.zip"
    a.click()
    URL.revokeObjectURL(a.href)
    setDownloading(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
  if (!matrix) return <div className="text-center py-12 text-gray-400 text-sm">Error loading documents</div>

  const unusedTypes = docTypes.filter(
    (dt) => !matrix.requirements.some((r) => r.document_type_id === dt.id)
  )

  const hasMissing = matrix.participants.some((p) =>
    matrix.requirements.some((r) => r.required && p.documents[r.document_type_id] === null)
  )

  const hasAnyDocs = matrix.participants.some((p) =>
    Object.values(p.documents).some(Boolean)
  )

  return (
    <div>
      {viewerDoc && (
        <DocumentViewer
          url={viewerDoc.url}
          fileName={viewerDoc.fileName}
          mimeType={viewerDoc.mimeType}
          onClose={() => setViewerDoc(null)}
        />
      )}

      {/* Requirement editor + actions */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex flex-wrap gap-2 flex-1">
          {matrix.requirements.map((req) => (
            <div
              key={req.document_type_id}
              className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{req.document_types.name}</span>
              {!req.required && <span className="text-gray-400 text-xs">(optional)</span>}
              <button
                onClick={() => handleRemoveRequirement(req.document_type_id)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {matrix.requirements.length === 0 && (
            <span className="text-sm text-gray-400">No document requirements set</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {hasAnyDocs && (
            <div className="flex items-center gap-1.5">
              <select
                value={downloadTypeId}
                onChange={(e) => setDownloadTypeId(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#C9A227]"
              >
                <option value="">All types</option>
                {matrix.requirements.map((req) => (
                  <option key={req.document_type_id} value={req.document_type_id}>
                    {req.document_types.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadZip}
                disabled={downloading}
              >
                <Download className="w-4 h-4 mr-1" />
                {downloading ? "Zipping..." : "Download zip"}
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAddReq(true)} disabled={unusedTypes.length === 0}>
            <Plus className="w-4 h-4 mr-1" />Add requirement
          </Button>
          {hasMissing && (
            <Button
              size="sm"
              onClick={handleRequestDocuments}
              disabled={requesting}
              className="bg-[#0C0F4C] hover:bg-[#0a0d3f] text-white"
            >
              <Send className="w-4 h-4 mr-1" />
              {requesting ? "Requesting..." : "Request missing"}
            </Button>
          )}
        </div>
      </div>

      {/* Matrix */}
      {matrix.requirements.length === 0 || matrix.participants.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-sm">
            {matrix.requirements.length === 0
              ? "Add document requirements above to see the upload matrix."
              : "No participants to show."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 min-w-40">Participant</th>
                {matrix.requirements.map((req) => (
                  <th key={req.document_type_id} className="px-4 py-3 text-center font-medium text-gray-600 min-w-32">
                    {req.document_types.name}
                    {!req.required && <span className="text-gray-400 font-normal ml-1 text-xs">(opt)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {matrix.participants.map((participant) => (
                <tr key={participant.participant_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{participant.player_name}</td>
                  {matrix.requirements.map((req) => {
                    const doc = participant.documents[req.document_type_id]
                    return (
                      <td key={req.document_type_id} className="px-4 py-3 text-center">
                        {doc ? (
                          <div className="flex items-center justify-center gap-1">
                            {doc.expiring_soon ? (
                              <span title="Expires before event end" className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                              </span>
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              </span>
                            )}
                            <button
                              onClick={() => handleView(doc.file_path, doc.file_name, doc.mime_type)}
                              className="text-gray-400 hover:text-[#0C0F4C] transition-colors"
                              title="View document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.document_id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            {req.required ? (
                              <button
                                onClick={() => setUploadCell({
                                  participantId: participant.participant_id,
                                  playerId: participant.player_id,
                                  docTypeId: req.document_type_id,
                                  playerName: participant.player_name,
                                })}
                                className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors text-xs"
                                title="Missing - click to upload"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <Upload className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setUploadCell({
                                  participantId: participant.participant_id,
                                  playerId: participant.player_id,
                                  docTypeId: req.document_type_id,
                                  playerName: participant.player_name,
                                })}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                                title="Click to upload"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 inline-flex items-center justify-center"><Check className="w-2 h-2 text-green-600" /></span> Uploaded</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-100 inline-flex items-center justify-center"><Clock className="w-2 h-2 text-amber-600" /></span> Expiring before event end</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Missing (required)</span>
          </div>
        </div>
      )}

      {/* Add requirement dialog */}
      <Dialog open={showAddReq} onOpenChange={setShowAddReq}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add document requirement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Document type</Label>
              <select
                value={addDocTypeId}
                onChange={(e) => setAddDocTypeId(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
              >
                <option value="">Select...</option>
                {unusedTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="req-required"
                checked={addRequired}
                onChange={(e) => setAddRequired(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="req-required">Required</Label>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <input
                type="text"
                value={addReqNotes}
                onChange={(e) => setAddReqNotes(e.target.value)}
                placeholder="e.g. Must be valid during the event"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReq(false)}>Cancel</Button>
            <Button onClick={handleAddRequirement} disabled={savingReq} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              {savingReq ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={!!uploadCell} onOpenChange={(open) => !open && setUploadCell(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
          {uploadCell && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Uploading for <strong>{uploadCell.playerName}</strong>:{" "}
                {matrix?.requirements.find((r) => r.document_type_id === uploadCell.docTypeId)?.document_types.name}
              </p>
              <div className="space-y-1">
                <Label>File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#C9A227] file:text-white hover:file:bg-[#b8911f] cursor-pointer"
                />
                {uploadFile && (
                  <p className="text-xs text-gray-500">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Document expiry date (e.g. for passport)</Label>
                <input
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadCell(null)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request tokens dialog */}
      <Dialog open={showTokens} onOpenChange={setShowTokens}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload links created</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Upload links have been created. Emails are queued and will be sent automatically.
              You can also copy and share these links directly:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {requestTokens.map(({ participantId, playerName, url }) => (
                <div key={participantId} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium mb-1">{playerName}</div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={url}
                      className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-600"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied") }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTokens(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
