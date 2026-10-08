import { notFound } from "next/navigation"
import { getPlayer } from "../actions"
import { listTemplates } from "@/app/(app)/email/actions"
import { PlayerDetail } from "@/components/players/PlayerDetail"

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [player, templates] = await Promise.all([getPlayer(id), listTemplates()])

  if (!player) {
    notFound()
  }

  return <PlayerDetail player={player} templates={templates} />
}
