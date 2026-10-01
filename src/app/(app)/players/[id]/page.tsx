import { notFound } from "next/navigation"
import { getPlayer } from "../actions"
import { PlayerDetail } from "@/components/players/PlayerDetail"

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const player = await getPlayer(id)

  if (!player) {
    notFound()
  }

  return <PlayerDetail player={player} />
}
