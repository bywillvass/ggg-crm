export function PageSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="h-6 w-44 bg-gray-200 rounded" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-gray-200 rounded-md" />
          <div className="h-8 w-28 bg-gray-200 rounded-md" />
        </div>
      </div>
      <div className="px-6 py-4">
        <div className="h-10 w-full max-w-lg bg-gray-100 rounded-lg mb-4" />
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="h-10 bg-gray-100 border-b border-gray-200" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="h-4 bg-gray-200 rounded flex-1" />
              <div className="h-4 bg-gray-100 rounded w-20" />
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-4 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
