"use client"

import { useState } from "react"

export function UnsubscribeForm({ token, email }: { token: string; email: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")

  async function handleUnsubscribe() {
    setStatus("loading")
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setErrorMessage(body.error ?? "Failed to unsubscribe")
        setStatus("error")
        return
      }
      setStatus("success")
    } catch {
      setErrorMessage("Network error. Please try again.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        You have been unsubscribed. {email && `We will no longer send marketing emails to ${email}.`}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {email && (
        <div className="text-sm text-gray-700">
          <span className="text-gray-500">Email: </span>
          <span className="font-medium">{email}</span>
        </div>
      )}
      <button
        onClick={handleUnsubscribe}
        disabled={status === "loading"}
        className="w-full inline-flex items-center justify-center rounded-lg bg-[#C9A227] hover:bg-[#b8911f] disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 transition-colors"
      >
        {status === "loading" ? "Unsubscribing..." : "Unsubscribe"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}
