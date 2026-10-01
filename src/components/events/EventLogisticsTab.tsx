"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Phone, AlertTriangle, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { updateParticipantLogistics, type EventDetail, type ParticipantRow } from "@/app/(app)/events/actions"

type AppRole = "admin" | "coach"

function participantName(p: ParticipantRow): string {
  if (p.players) return `${p.players.first_name ?? ""} ${p.players.last_name ?? ""}`.trim()
  if (p.contacts) return `${p.contacts.first_name ?? ""} ${p.contacts.last_name ?? ""}`.trim()
  return "Unknown"
}

export function EventLogisticsTab({
  event,
  onUpdate,
  role,
}: {
  event: EventDetail
  onUpdate: (e: EventDetail) => void
  role: AppRole
}) {
  const [editing, setEditing] = useState<ParticipantRow | null>(null)
  const [flightOut, setFlightOut] = useState("")
  const [flightReturn, setFlightReturn] = useState("")
  const [room, setRoom] = useState("")
  const [shirtSize, setShirtSize] = useState("")
  const [emergencyName, setEmergencyName] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")
  const [logisticsNotes, setLogisticsNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const participants = event.participants.filter((p) =>
    ["confirmed", "attended", "invited", "contacted", "waitlisted"].includes(p.status)
  )

  function startEdit(p: ParticipantRow) {
    setEditing(p)
    setFlightOut(p.flight_out ?? "")
    setFlightReturn(p.flight_return ?? "")
    setRoom(p.room ?? "")
    setShirtSize(p.shirt_size ?? "")
    setEmergencyName(p.emergency_contact_name ?? "")
    setEmergencyPhone(p.emergency_contact_phone ?? "")
    setLogisticsNotes(p.logistics_notes ?? "")
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const { error } = await updateParticipantLogistics(editing.id, {
      flight_out: flightOut || null,
      flight_return: flightReturn || null,
      room: room || null,
      shirt_size: shirtSize || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      logistics_notes: logisticsNotes || null,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Logistics updated")
      onUpdate({
        ...event,
        participants: event.participants.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                flight_out: flightOut || null,
                flight_return: flightReturn || null,
                room: room || null,
                shirt_size: shirtSize || null,
                emergency_contact_name: emergencyName || null,
                emergency_contact_phone: emergencyPhone || null,
                logistics_notes: logisticsNotes || null,
              }
            : p
        ),
      })
      setEditing(null)
    }
    setSaving(false)
  }

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No confirmed participants to show
      </div>
    )
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Player</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flight out</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flight return</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Room</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Shirt</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Emergency contact</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Medical</th>
              {role === "admin" && <th className="px-4 py-3 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {participants.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{participantName(p)}</div>
                  {p.players?.birth_year && (
                    <div className="text-xs text-gray-400">{p.players.birth_year}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.flight_out ?? <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.flight_return ?? <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.room ?? <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.shirt_size ?? <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3">
                  {p.emergency_contact_name ? (
                    <div>
                      <div className="text-gray-600">{p.emergency_contact_name}</div>
                      {p.emergency_contact_phone && (
                        <a
                          href={`tel:${p.emergency_contact_phone}`}
                          className="text-xs text-[#0C0F4C] hover:underline"
                        >
                          {p.emergency_contact_phone}
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.players?.medical_alerts ? (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-amber-700">{p.players.medical_alerts}</span>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">None</span>
                  )}
                </td>
                {role === "admin" && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list (tour mode) */}
      <div className="md:hidden space-y-3">
        {participants.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-gray-900 text-base">{participantName(p)}</div>
                <div className="text-sm text-gray-500">
                  {p.players?.birth_year ?? ""}
                  {p.players?.position ? ` · ${p.players.position}` : ""}
                </div>
              </div>
              {role === "admin" && (
                <button onClick={() => startEdit(p)} className="text-gray-400 p-1">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {p.players?.medical_alerts && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg mb-3 border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-amber-700 font-medium">{p.players.medical_alerts}</span>
              </div>
            )}

            {p.players?.dietary_notes && (
              <div className="text-sm text-gray-600 mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase mr-1">Diet:</span>
                {p.players.dietary_notes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
              {p.room && (
                <div><span className="text-gray-400 text-xs">Room:</span> <span className="font-medium">{p.room}</span></div>
              )}
              {p.shirt_size && (
                <div><span className="text-gray-400 text-xs">Shirt:</span> <span className="font-medium">{p.shirt_size}</span></div>
              )}
              {p.flight_out && (
                <div className="col-span-2"><span className="text-gray-400 text-xs">Out:</span> <span className="font-medium">{p.flight_out}</span></div>
              )}
              {p.flight_return && (
                <div className="col-span-2"><span className="text-gray-400 text-xs">Return:</span> <span className="font-medium">{p.flight_return}</span></div>
              )}
            </div>

            {(p.emergency_contact_name || p.emergency_contact_phone) && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <div>
                  <div className="text-xs text-gray-400 font-medium mb-0.5">Emergency contact</div>
                  <div className="text-sm font-medium text-gray-900">{p.emergency_contact_name}</div>
                </div>
                {p.emergency_contact_phone && (
                  <a
                    href={`tel:${p.emergency_contact_phone}`}
                    className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0"
                  >
                    <Phone className="w-4 h-4 text-white" />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit dialog (admin only) */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Logistics - {editing ? participantName(editing) : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Flight out</Label>
              <Input value={flightOut} onChange={(e) => setFlightOut(e.target.value)} placeholder="e.g. QF17 SYD-ATH 10:30" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Flight return</Label>
              <Input value={flightReturn} onChange={(e) => setFlightReturn(e.target.value)} placeholder="e.g. QF18 ATH-SYD 14:00" />
            </div>
            <div className="space-y-1">
              <Label>Room</Label>
              <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 204" />
            </div>
            <div className="space-y-1">
              <Label>Shirt size</Label>
              <Input value={shirtSize} onChange={(e) => setShirtSize(e.target.value)} placeholder="e.g. M" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Emergency contact name</Label>
              <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Emergency contact phone</Label>
              <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+61 4xx xxx xxx" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Logistics notes</Label>
              <Textarea value={logisticsNotes} onChange={(e) => setLogisticsNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#C9A227] hover:bg-[#b8911f] text-white">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
