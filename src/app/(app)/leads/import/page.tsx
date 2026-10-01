"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { toast } from "sonner"
import Papa from "papaparse"
import { Upload, ChevronRight, ChevronLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { importCSVLeads } from "@/app/(app)/leads/actions"
import type { Database } from "@/lib/database.types"

type LeadSource = Database["public"]["Enums"]["lead_source"]

const SOURCES: LeadSource[] = ["website", "meta_instant_form", "newsletter", "referral", "manual", "import", "other"]

const TARGET_OPTIONS = [
  { value: "skip", label: "(Skip)" },
  { value: "contact_email", label: "Contact email" },
  { value: "contact_phone", label: "Contact phone" },
  { value: "contact_full_name", label: "Contact full name" },
  { value: "contact_first_name", label: "Contact first name" },
  { value: "contact_last_name", label: "Contact last name" },
  { value: "player_full_name", label: "Player full name" },
  { value: "player_first_name", label: "Player first name" },
  { value: "player_last_name", label: "Player last name" },
  { value: "player_dob", label: "Player DOB" },
  { value: "player_birth_year", label: "Player birth year" },
  { value: "player_club", label: "Player club" },
  { value: "player_position", label: "Player position" },
  { value: "player_level", label: "Player level" },
  { value: "suburb", label: "Suburb" },
  { value: "state", label: "State" },
  { value: "message", label: "Message" },
  { value: "campaign", label: "Campaign" },
]

function guessTarget(col: string): string {
  const lower = col.toLowerCase().replace(/[\s_-]/g, "")
  if (lower.includes("email")) return "contact_email"
  if (lower.includes("phone") || lower.includes("mobile")) return "contact_phone"
  if (lower.includes("firstname") || lower.includes("fname")) return "contact_first_name"
  if (lower.includes("lastname") || lower.includes("lname") || lower.includes("surname")) return "contact_last_name"
  if (lower.includes("fullname") || lower.includes("name")) return "contact_full_name"
  if (lower.includes("playerfirst")) return "player_first_name"
  if (lower.includes("playerlast")) return "player_last_name"
  if (lower.includes("playername") || lower.includes("childname") || lower.includes("kidname")) return "player_full_name"
  if (lower.includes("dob") || lower.includes("birthdate") || lower.includes("dateofbirth")) return "player_dob"
  if (lower.includes("birthyear") || lower.includes("yearofbirth") || lower.includes("yob")) return "player_birth_year"
  if (lower.includes("club")) return "player_club"
  if (lower.includes("position") || lower.includes("pos")) return "player_position"
  if (lower.includes("level")) return "player_level"
  if (lower.includes("suburb")) return "suburb"
  if (lower.includes("state")) return "state"
  if (lower.includes("message") || lower.includes("notes")) return "message"
  return "skip"
}

type Step = 1 | 2 | 3 | 4

export default function LeadsImportPage() {
  const [step, setStep] = useState<Step>(1)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [source, setSource] = useState<LeadSource>("import")
  const [formType, setFormType] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    created: number
    merged: number
    duplicates: number
    errors: number
    details: string[]
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows = results.data
        const cols = results.meta.fields ?? []

        const initialMap: Record<string, string> = {}
        for (const col of cols) {
          initialMap[col] = guessTarget(col)
        }

        setRows(parsedRows)
        setColumns(cols)
        setColumnMap(initialMap)
        setStep(2)
      },
      error: (err) => {
        toast.error(`Parse error: ${err.message}`)
      },
    })
  }

  async function handleImport() {
    setImporting(true)
    try {
      const importResult = await importCSVLeads(rows, source, formType, columnMap)
      setResult(importResult)
      setStep(4)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0C0F4C]">Import leads</h1>
        <p className="text-sm text-gray-500">Upload a CSV file to import leads in bulk</p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3, 4] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-[#C9A227] text-white" : "bg-gray-200 text-gray-500"}`}>
              {step > s ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            <span className={step === s ? "font-medium text-[#0C0F4C]" : "text-gray-400"}>
              {["Upload", "Map columns", "Confirm", "Results"][idx]}
            </span>
            {idx < 3 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
          <p className="text-sm font-medium text-gray-700 mb-1">Upload a CSV file</p>
          <p className="text-xs text-gray-400 mb-4">Exported from any spreadsheet or form tool</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
          >
            Choose file
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <p className="font-medium text-sm">Preview (first 3 rows)</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map((col) => (
                      <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 border">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {columns.map((col) => (
                        <td key={col} className="px-2 py-1 border text-gray-600 max-w-28 truncate">{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 space-y-3">
            <p className="font-medium text-sm">Map columns to targets</p>
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-48 shrink-0 truncate font-mono">{col}</span>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                  <select
                    value={columnMap[col] ?? "skip"}
                    onChange={(e) => setColumnMap((m) => ({ ...m, [col]: e.target.value }))}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                  >
                    {TARGET_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <Button onClick={() => setStep(3)} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              Continue
              <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-4">
            <p className="font-medium text-sm">Import settings</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]"
                >
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Form type</Label>
                <Input
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g. trial-registration"
                />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium">Ready to import</p>
              <p className="text-sm text-gray-500 mt-1">{rows.length} rows will be processed</p>
              <p className="text-xs text-gray-400 mt-2">
                Duplicate detection uses email and phone. Existing contacts and players will be matched and updated.
              </p>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-[#C9A227] hover:bg-[#b8911f] text-white"
            >
              {importing ? "Importing..." : `Import ${rows.length} rows`}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6 space-y-4">
            <p className="font-medium text-lg text-[#0C0F4C]">Import complete</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600">Created</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.merged}</p>
                <p className="text-xs text-blue-600">Merged</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{result.duplicates}</p>
                <p className="text-xs text-yellow-600">Duplicates</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                <p className="text-xs text-red-600">Errors</p>
              </div>
            </div>

            {result.details.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Error details</p>
                <div className="max-h-48 overflow-y-auto rounded bg-gray-50 p-3 space-y-1">
                  {result.details.map((d, i) => (
                    <p key={i} className="text-xs text-red-600">{d}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1)
                setRows([])
                setColumns([])
                setColumnMap({})
                setResult(null)
              }}
            >
              Import another file
            </Button>
            <Link href="/leads">
              <Button className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
                View leads
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
