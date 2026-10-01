"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { useState, useRef } from "react"
import { toast } from "sonner"
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  ListOrdered,
  Image as ImageIcon,
  Minus,
} from "lucide-react"
import { cn } from "cn"
import { getImageUploadUrl } from "@/app/(app)/email/actions"

export function TiptapEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const [mode, setMode] = useState<"editor" | "raw">("editor")
  const [rawHtml, setRawHtml] = useState(value)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const openFilePicker = () => {
    fileRef.current?.click()
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, linkOnPaste: true } }),
      Image,
      Placeholder.configure({ placeholder: "Write your email..." }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setRawHtml(html)
      onChange(html)
    },
  })

  function switchMode(next: "editor" | "raw") {
    if (!editor) {
      setMode(next)
      return
    }
    if (next === "raw") {
      setRawHtml(editor.getHTML())
    } else if (editor.getHTML() !== rawHtml) {
      editor.commands.setContent(rawHtml || "", { emitUpdate: false })
    }
    setMode(next)
  }

  async function handleUploadImage(file: File) {
    try {
      const result = await getImageUploadUrl(file.name)
      if (!result.signedUrl || !result.publicUrl) {
        toast.error(result.error ?? "Upload failed")
        return
      }
      const uploadRes = await fetch(result.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!uploadRes.ok) {
        toast.error(`Upload failed (${uploadRes.status})`)
        return
      }
      editor?.chain().focus().setImage({ src: result.publicUrl }).run()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    }
  }

  function promptLink() {
    if (!editor) return
    const prev = editor.getAttributes("link").href ?? ""
    const url = window.prompt("Link URL", prev)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  function tbBtn(
    active: boolean,
    onClick: () => void,
    children: React.ReactNode,
    title: string
  ) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
          "p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          active && "bg-gray-200 text-gray-900"
        )}
      >
        {children}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-input bg-background overflow-hidden">
      <div className="flex items-center justify-between border-b bg-gray-50 px-2 py-1">
        <div className="flex items-center gap-0.5">
          {editor && mode === "editor" && (
            <>
              {tbBtn(
                editor.isActive("bold"),
                () => editor.chain().focus().toggleBold().run(),
                <BoldIcon className="h-3.5 w-3.5" />,
                "Bold"
              )}
              {tbBtn(
                editor.isActive("italic"),
                () => editor.chain().focus().toggleItalic().run(),
                <ItalicIcon className="h-3.5 w-3.5" />,
                "Italic"
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {tbBtn(
                editor.isActive("heading", { level: 2 }),
                () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
                <Heading2 className="h-3.5 w-3.5" />,
                "Heading 2"
              )}
              {tbBtn(
                editor.isActive("heading", { level: 3 }),
                () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
                <Heading3 className="h-3.5 w-3.5" />,
                "Heading 3"
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {tbBtn(
                editor.isActive("bulletList"),
                () => editor.chain().focus().toggleBulletList().run(),
                <List className="h-3.5 w-3.5" />,
                "Bulleted list"
              )}
              {tbBtn(
                editor.isActive("orderedList"),
                () => editor.chain().focus().toggleOrderedList().run(),
                <ListOrdered className="h-3.5 w-3.5" />,
                "Numbered list"
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {tbBtn(
                editor.isActive("link"),
                promptLink,
                <LinkIcon className="h-3.5 w-3.5" />,
                "Link"
              )}
              <button
                type="button"
                onClick={openFilePicker}
                title="Image"
                className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
              {tbBtn(
                false,
                () => editor.chain().focus().setHorizontalRule().run(),
                <Minus className="h-3.5 w-3.5" />,
                "Horizontal rule"
              )}
            </>
          )}
        </div>
        <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode("editor")}
            className={cn(
              "px-2 py-0.5 text-xs font-medium",
              mode === "editor" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => switchMode("raw")}
            className={cn(
              "px-2 py-0.5 text-xs font-medium",
              mode === "raw" ? "bg-[#0C0F4C] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            Raw HTML
          </button>
        </div>
      </div>

      {mode === "editor" ? (
        <div className="min-h-[300px] p-3 text-sm">
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:min-h-[260px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
          />
        </div>
      ) : (
        <textarea
          value={rawHtml}
          onChange={(e) => {
            setRawHtml(e.target.value)
            onChange(e.target.value)
          }}
          className="w-full min-h-[300px] p-3 text-sm font-mono bg-white outline-none resize-vertical"
          placeholder="<p>Enter raw HTML here...</p>"
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUploadImage(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
