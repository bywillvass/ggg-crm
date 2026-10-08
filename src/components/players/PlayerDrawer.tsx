"use client"

import { useState } from "react"
import Link from "next/link"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddActivityDialog } from "@/components/shared/AddActivityDialog"
import type { Tables } from "@/lib/database.types"

type PlayerRow = Tables<"players">

function statusVariant(status: string): "success" | "secondary" | "default" {
  if (status === "active") return "success"
  if (status === "prospect") return "secondary"
  return "default"
}

type Props = {
  player: PlayerRow | null
  onClose: () => void
  onUpdate: () => void
}

export function PlayerDrawer({ player, onClose, onUpdate }: Props) {
  const [activityOpen, setActivityOpen] = useState(false)

  return (
    <>
      <Sheet open={player !== null} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="sm:max-w-sm w-full overflow-y-auto flex flex-col gap-0 p-0">
          {player && (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b bg-white">
                <h2 className="text-lg font-semibold text-[#0C0F4C]">
                  {player.first_name} {player.last_name}
                </h2>
                <div className="mt-1.5">
                  <Badge variant={statusVariant(player.status)}>{player.status}</Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* Details */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Birth year</p>
                      <p className="text-gray-800">{player.birth_year ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Position</p>
                      <p className="text-gray-800">{player.position ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Club</p>
                      <p className="text-gray-800">{player.current_club ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">State</p>
                      <p className="text-gray-800">{player.state ?? "—"}</p>
                    </div>
                  </div>
                </section>

                {/* Quick actions */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Quick actions</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActivityOpen(true)}
                  >
                    Log activity
                  </Button>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-white mt-auto">
                <Link href={`/players/${player.id}`} className="block">
                  <Button className="w-full bg-[#0C0F4C] hover:bg-[#1a2070] text-white">
                    View full record
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {player && (
        <AddActivityDialog
          open={activityOpen}
          onClose={() => setActivityOpen(false)}
          onSave={() => { setActivityOpen(false); onUpdate() }}
          playerId={player.id}
        />
      )}
    </>
  )
}
