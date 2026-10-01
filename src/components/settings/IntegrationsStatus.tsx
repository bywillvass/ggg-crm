import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import type { IngestSourceStatus } from "@/app/(app)/settings/actions"

export function IntegrationsStatus({
  sources,
  lastBlogSync,
}: {
  sources: IngestSourceStatus[]
  lastBlogSync: string | null
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h3 className="font-medium mb-3">Ingest sources</h3>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ingest data received yet.
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Source
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Last received
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Recent errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{s.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.last_received
                        ? formatDistanceToNow(new Date(s.last_received), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </td>
                    <td className="px-3 py-2">
                      {s.recent_errors.length > 0 ? (
                        <Badge variant="destructive">
                          {s.recent_errors.length} error
                          {s.recent_errors.length !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-3">Blog sync</h3>
        <p className="text-sm text-muted-foreground">
          {lastBlogSync
            ? `Last synced ${formatDistanceToNow(new Date(lastBlogSync), { addSuffix: true })}`
            : "No blog posts have been synced yet."}
        </p>
      </section>

      <section>
        <h3 className="font-medium mb-2">Recent ingest errors</h3>
        {sources.flatMap((s) => s.recent_errors).length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent errors.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Source
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .flatMap((s) =>
                    s.recent_errors.map((e) => ({ ...e, source: s.source }))
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.received_at).getTime() -
                      new Date(a.received_at).getTime()
                  )
                  .slice(0, 10)
                  .map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{e.source}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(e.received_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="px-3 py-2 text-destructive max-w-xs truncate">
                        {e.error ?? "Unknown error"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
