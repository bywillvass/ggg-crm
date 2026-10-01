"use client"

import { X, Download } from "lucide-react"
import { useEffect } from "react"

export function DocumentViewer({
  url,
  fileName,
  mimeType,
  onClose,
}: {
  url: string
  fileName: string
  mimeType: string | null
  onClose: () => void
}) {
  const isImage =
    /^image\//i.test(mimeType ?? "") ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
  const isPdf =
    mimeType === "application/pdf" || /\.pdf$/i.test(fileName)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleDownload() {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = fileName
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, "_blank")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 bg-black/60 shrink-0">
        <p className="text-white text-sm truncate flex-1 mr-4">{fileName}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="text-white/70 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileName}
            className="w-full h-full object-contain"
          />
        ) : isPdf ? (
          <iframe
            src={url}
            title={fileName}
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
            <p className="text-sm text-white/60">
              Preview not available for this file type
            </p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              <Download className="w-4 h-4" />
              Download {fileName}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
