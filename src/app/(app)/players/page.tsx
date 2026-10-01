import { listPlayers } from "./actions"
import { PlayersShell } from "@/components/players/PlayersShell"

export default async function PlayersPage() {
  const players = await listPlayers()
  return <PlayersShell players={players} />
}
