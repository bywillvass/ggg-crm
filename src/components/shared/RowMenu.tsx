"use client"

import { useState, useRef, useEffect } from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "cn"

export type RowMenuItem = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "danger"
  hidden?: boolean
}

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onOutsideClick)
    return () => document.removeEventListener("mousedown", onOutsideClick)
  }, [open])

  const visible = items.filter((i) => !i.hidden)
  if (visible.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          {visible.map((item, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick() }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors",
                item.variant === "danger"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
