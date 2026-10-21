"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Search, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  searchPlayersForMerge,
  mergePlayers,
  type PlayerMergeOption,
  type PlayerDetail,
} from "@/app/(app)/players/actions"
import { cn } from "cn"

function toOption(p: PlayerDetail): PlayerMergeOption {
  return {
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed player",
    dob: p.dob,
    club: p.current_club,
    createdAt: p.created_at,
    eventCount: p.event_participants?.length ?? 0,
    parents: p.player_contacts
      .slice()
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .flatMap((pc) => pc.contacts ? [{
        name: [pc.contacts.first_name, pc.contacts.last_name].filter(Boolean).join(" ") || "Unnamed",
        email: pc.contacts.email,
        phone: pc.contacts.phone,
      }] : []),
  }
}

// Rough "how complete is this record" score, used to suggest which one to keep
function richness(p: PlayerMergeOption) {
  return (p.dob ? 2 : 0) + (p.club ? 1 : 0) + (p.parents.some((x) => x.email) ? 3 : 0) +
    (p.parents.some((x) => x.phone) ? 1 : 0) + p.eventCount
}

function PlayerSummary({ p }: { p: PlayerMergeOption }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
      <div className="text-xs text-gray-500 truncate">
        {p.dob ? `DOB ${format(new Date(p.dob), "d MMM yyyy")}` : "No DOB"}
        {p.club ? ` · ${p.club}` : ""}
        {` · ${p.eventCount} event${p.eventCount === 1 ? "" : "s"}`}
        {` · added ${format(new Date(p.createdAt), "d MMM")}`}
      </div>
      {p.parents.length === 0 ? (
        <div className="text-xs text-amber-600">No guardian linked</div>
      ) : (
        p.parents.map((par, i) => (
          <div key={i} className={cn("text-xs truncate", par.email ? "text-gray-500" : "text-amber-600")}>
            {par.name} · {par.email ?? "no email"}{par.phone ? ` · ${par.phone}` : ""}
          </div>
        ))
      )}
    </div>
  )
}

export function MergePlayerDialog({
  open,
  onClose,
  player,
}: {
  open: boolean
  onClose: () => void
  player: PlayerDetail
}) {
  const router = useRouter()
  const current = toOption(player)
  // Start with this player's name so likely duplicates show straight away
  const initialQuery = current.name === "Unnamed player" ? "" : current.name
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PlayerMergeOption[]>([])
  const [searching, setSearching] = useState(initialQuery.length >= 2)
  const [other, setOther] = useState<PlayerMergeOption | null>(null)
  const [keepId, setKeepId] = useState<string>(player.id)
  const [merging, setMerging] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  function runSearch(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const mySeq = ++seq.current
    timer.current = setTimeout(async () => {
      const res = await searchPlayersForMerge(player.id, q)
      if (mySeq !== seq.current) return
      setResults(res)
      setSearching(false)
    }, 250)
  }

  useEffect(() => {
    if (!open || initialQuery.length < 2) return
    const mySeq = ++seq.current
    searchPlayersForMerge(player.id, initialQuery).then((res) => {
      if (mySeq !== seq.current) return
      setResults(res)
      setSearching(false)
    })
  }, [open, player.id, initialQuery])

  function handleOpenChange(o: boolean) {
    if (o) return
    setOther(null)
    setQuery(initialQuery)
    setSearching(initialQuery.length >= 2)
    onClose()
  }

  function choose(p: PlayerMergeOption) {
    setOther(p)
    setKeepId(richness(p) > richness(current) ? p.id : current.id)
  }

  async function handleMerge() {
    if (!other) return
    const dupId = keepId === current.id ? other.id : current.id
    setMerging(true)
    const { error, result } = await mergePlayers(keepId, dupId)
    setMerging(false)
    if (error) {
      toast.error(error)
      return
    }
    const moved = Object.values(result?.moved ?? {}).reduce((a, b) => a + b, 0)
    toast.success(`Players merged${moved ? ` - ${moved} record${moved === 1 ? "" : "s"} moved across` : ""}`)
    handleOpenChange(false)
    if (keepId === current.id) router.refresh()
    else router.push(`/players/${keepId}`)
  }

  const keep = other && (keepId === current.id ? current : other)
  const dup = other && (keepId === current.id ? other : current)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge duplicate player</DialogTitle>
        </DialogHeader>

        {!other ? (
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Find the duplicate of {current.name}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Search players..." className="pl-8" />
              </div>
            </div>
            {query.trim().length >= 2 && (
              <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                {searching && results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400">Searching...</div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400">No other players found</div>
                ) : (
                  results.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <PlayerSummary p={p} />
                      <Button type="button" size="sm" variant="outline" onClick={() => choose(p)}>Select</Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <button type="button" onClick={() => setOther(null)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
              <ArrowLeft className="h-3 w-3" /> Pick a different player
            </button>
            <Label>Which record do you want to keep?</Label>
            <div className="space-y-2">
              {[current, other].map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 cursor-pointer",
                    keepId === p.id ? "border-[#0C0F4C] bg-[#0C0F4C]/5" : "border-gray-200"
                  )}
                >
                  <input type="radio" name="keep" className="mt-1" checked={keepId === p.id} onChange={() => setKeepId(p.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
                      {p.id === current.id ? "This profile" : "Other profile"}
                    </div>
                    <PlayerSummary p={p} />
                  </div>
                </label>
              ))}
            </div>
            {keep && dup && (
              <div className="rounded-md bg-gray-50 border p-3 text-xs text-gray-600 space-y-1">
                <p>Events, leads, emails, invoices, documents, assessments, tasks and notes from <b>{dup.name}</b> move to the record you keep.</p>
                <p>Guardians with new contact details are added; empty or repeated ones are dropped. Blank details (DOB, club, etc.) are filled in.</p>
                <p>The other record is archived, not deleted.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          {other && (
            <Button onClick={handleMerge} disabled={merging} className="bg-[#0C0F4C] hover:bg-[#1a1e6b] text-white">
              {merging ? "Merging..." : "Merge players"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
