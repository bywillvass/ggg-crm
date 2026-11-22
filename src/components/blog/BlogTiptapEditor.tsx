"use client"

import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { Fragment } from "@tiptap/pm/model"
import { useState, useRef } from "react"
import { toast } from "sonner"
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react"
import { cn } from "cn"
import {
  BlockStyle,
  MEDIA_RELEASE_TEMPLATE,
  BLOG_POST_TEMPLATE,
  type ParagraphStyle,
} from "./blockStyles"

type StyleItem = {
  key: string
  label: string
  hint: string
  // Preview classes for the sidebar button, roughly matching the real style
  preview: string
  isActive: (e: Editor) => boolean
  apply: (e: Editor) => void
}

function paragraphStyle(e: Editor, style: ParagraphStyle | null) {
  e.chain().focus().setParagraph().updateAttributes("paragraph", { blockStyle: style }).run()
}

function isPlainBlock(e: Editor) {
  return !e.isActive("blockquote") && !e.isActive("bulletList") && !e.isActive("orderedList")
}

const STYLE_GROUPS: { title: string; items: StyleItem[] }[] = [
  {
    title: "Headings",
    items: [
      {
        key: "headline",
        label: "Headline",
        hint: "Main headline at the top of a release",
        preview: "font-heading text-[15px] font-bold text-navy",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "headline" }),
        apply: (e) => paragraphStyle(e, "headline"),
      },
      {
        key: "h2",
        label: "Heading",
        hint: "Section heading, big bold blue",
        preview: "font-heading text-[13px] font-bold text-navy",
        isActive: (e) => e.isActive("heading", { level: 2 }),
        apply: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        key: "h3",
        label: "Subheading",
        hint: "Smaller heading inside a section",
        preview: "font-heading text-[12px] font-semibold text-navy",
        isActive: (e) => e.isActive("heading", { level: 3 }),
        apply: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        key: "kicker",
        label: "Label",
        hint: "Small gold caps, e.g. MEDIA RELEASE | date",
        preview: "font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C6A15B]",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "kicker" }),
        apply: (e) => paragraphStyle(e, "kicker"),
      },
    ],
  },
  {
    title: "Text",
    items: [
      {
        key: "lead",
        label: "Intro",
        hint: "Larger opening paragraph",
        preview: "text-[13px] font-medium text-navy",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "lead" }),
        apply: (e) => paragraphStyle(e, "lead"),
      },
      {
        key: "body",
        label: "Body copy",
        hint: "Normal paragraph",
        preview: "text-[12px] text-gray-600",
        isActive: (e) =>
          e.isActive("paragraph", { blockStyle: null }) && isPlainBlock(e),
        apply: (e) => {
          if (e.isActive("blockquote")) e.chain().focus().lift("blockquote").run()
          paragraphStyle(e, null)
        },
      },
      {
        key: "quote",
        label: "Pull quote",
        hint: "Gold bar, larger blue text",
        preview: "border-l-2 border-[#C6A15B] pl-2 text-[12px] font-medium text-navy",
        isActive: (e) => e.isActive("blockquote"),
        apply: (e) => e.chain().focus().toggleBlockquote().run(),
      },
      {
        key: "info",
        label: "Details box",
        hint: "Shaded box for When / Where / contact lines",
        preview: "border-l-2 border-[#C6A15B] bg-navy/5 px-2 py-0.5 text-[12px] text-navy",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "info" }),
        apply: (e) => paragraphStyle(e, "info"),
      },
      {
        key: "bullet",
        label: "Bullet list",
        hint: "",
        preview: "text-[12px] text-gray-600",
        isActive: (e) => e.isActive("bulletList"),
        apply: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        key: "ordered",
        label: "Numbered list",
        hint: "",
        preview: "text-[12px] text-gray-600",
        isActive: (e) => e.isActive("orderedList"),
        apply: (e) => e.chain().focus().toggleOrderedList().run(),
      },
    ],
  },
  {
    title: "End of post",
    items: [
      {
        key: "ends",
        label: "End marker",
        hint: "Centred ENDS with rules either side",
        preview: "font-heading text-[10px] font-bold uppercase tracking-[0.2em] text-navy",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "ends" }),
        apply: (e) => paragraphStyle(e, "ends"),
      },
      {
        key: "boilerplate",
        label: "About / boilerplate",
        hint: "Smaller grey 'About GGG' text",
        preview: "text-[11px] text-gray-500",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "boilerplate" }),
        apply: (e) => paragraphStyle(e, "boilerplate"),
      },
      {
        key: "small",
        label: "Small print / credit",
        hint: "Photo credits, notes for editors",
        preview: "text-[10px] text-gray-500",
        isActive: (e) => e.isActive("paragraph", { blockStyle: "small" }),
        apply: (e) => paragraphStyle(e, "small"),
      },
      {
        key: "hr",
        label: "Divider line",
        hint: "",
        preview: "text-[12px] text-gray-600",
        isActive: () => false,
        apply: (e) => e.chain().focus().setHorizontalRule().run(),
      },
    ],
  },
]

const ALL_ITEMS = STYLE_GROUPS.flatMap((g) => g.items)

// Pasting from a PDF leaves a paragraph per line. Merge the top-level paragraphs
// touched by the selection into one, joined with spaces. Wording is untouched.
function joinSelectedLines(editor: Editor) {
  const { state } = editor
  const { from, to } = state.selection
  const blocks: { pos: number; node: import("@tiptap/pm/model").Node }[] = []
  state.doc.forEach((node, pos) => {
    if (pos + node.nodeSize > from && pos < to) blocks.push({ pos, node })
  })
  const paras = blocks.filter((b) => b.node.type.name === "paragraph")
  if (paras.length < 2 || paras.length !== blocks.length) {
    toast.error("Select two or more lines of normal text to join")
    return
  }
  let content = Fragment.empty
  paras.forEach(({ node }, i) => {
    if (node.content.size === 0) return
    if (i > 0 && content.size > 0) {
      const prevText = content.lastChild?.text ?? ""
      if (!/\s$/.test(prevText)) content = content.append(Fragment.from(state.schema.text(" ")))
    }
    content = content.append(node.content)
  })
  const first = paras[0]
  const last = paras[paras.length - 1]
  const merged = state.schema.nodes.paragraph.create(first.node.attrs, content)
  editor.view.dispatch(state.tr.replaceWith(first.pos, last.pos + last.node.nodeSize, merged))
  editor.commands.focus()
}

function removeEmptyLines(editor: Editor) {
  const { state } = editor
  const empties: { pos: number; size: number }[] = []
  state.doc.descendants((node, pos) => {
    if ((node.type.name === "paragraph" || node.type.name === "heading") && node.content.size === 0) {
      empties.push({ pos, size: node.nodeSize })
    }
    return node.type.name !== "paragraph" && node.type.name !== "heading"
  })
  if (!empties.length) {
    toast.success("No empty lines")
    return
  }
  let tr = state.tr
  for (const { pos, size } of empties.reverse()) tr = tr.delete(pos, pos + size)
  editor.view.dispatch(tr)
  toast.success(`Removed ${empties.length} empty line${empties.length === 1 ? "" : "s"}`)
}

export function BlogTiptapEditor({
  value,
  onChange,
  slug,
}: {
  value: string
  onChange: (html: string) => void
  slug: string
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
      BlockStyle,
      Placeholder.configure({ placeholder: "Write your post, or start from a template on the right..." }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setRawHtml(html)
      onChange(html)
    },
  })

  const active = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null
      const styles: Record<string, boolean> = {}
      for (const item of ALL_ITEMS) styles[item.key] = item.isActive(editor)
      return {
        styles,
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        link: editor.isActive("link"),
      }
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

  function insertTemplate(html: string) {
    if (!editor) return
    if (!editor.isEmpty && !window.confirm("Replace the current post body with this template?")) return
    editor.commands.setContent(html, { emitUpdate: true })
    editor.commands.focus("start")
  }

  async function handleUploadImage(file: File) {
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("slug", slug)
      form.append("inline", "true")
      const res = await fetch("/api/blog/image", { method: "POST", body: form })
      if (!res.ok) {
        toast.error("Upload failed")
        return
      }
      const data = await res.json() as { url: string }
      editor?.chain().focus().setImage({ src: data.url }).run()
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
    isActive: boolean,
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
          isActive && "bg-gray-200 text-gray-900"
        )}
      >
        {children}
      </button>
    )
  }

  const sideBtn =
    "w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-700 border border-gray-200 bg-white hover:border-navy/40 transition-colors"

  return (
    <div className="rounded-lg border border-input bg-background overflow-hidden">
      <div className="flex items-center justify-between border-b bg-gray-50 px-2 py-1">
        <div className="flex items-center gap-0.5">
          {editor && mode === "editor" && (
            <>
              {tbBtn(
                active?.bold ?? false,
                () => editor.chain().focus().toggleBold().run(),
                <BoldIcon className="h-3.5 w-3.5" />,
                "Bold"
              )}
              {tbBtn(
                active?.italic ?? false,
                () => editor.chain().focus().toggleItalic().run(),
                <ItalicIcon className="h-3.5 w-3.5" />,
                "Italic"
              )}
              {tbBtn(
                false,
                () => editor.chain().focus().unsetAllMarks().run(),
                <RemoveFormatting className="h-3.5 w-3.5" />,
                "Clear bold / italic"
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {tbBtn(
                active?.link ?? false,
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
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {tbBtn(false, () => editor.chain().focus().undo().run(), <Undo2 className="h-3.5 w-3.5" />, "Undo")}
              {tbBtn(false, () => editor.chain().focus().redo().run(), <Redo2 className="h-3.5 w-3.5" />, "Redo")}
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
        <div className="flex">
          <div className="flex-1 min-w-0 min-h-[400px] px-6 py-5">
            <EditorContent
              editor={editor}
              className="blog-content max-w-[720px] [&_.ProseMirror]:min-h-[360px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
            />
          </div>

          {/* Styles sidebar */}
          {editor && (
            <aside className="w-52 shrink-0 border-l bg-gray-50/70 p-3 space-y-4">
              <div className="sticky top-3 space-y-4">
                {STYLE_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{group.title}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        title={item.hint}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => item.apply(editor)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md border transition-colors",
                          active?.styles[item.key]
                            ? "border-navy bg-white ring-1 ring-navy"
                            : "border-transparent hover:border-gray-200 hover:bg-white"
                        )}
                      >
                        <span className={cn("block leading-tight", item.preview)}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ))}

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tidy up</p>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => joinSelectedLines(editor)}
                    title="Select lines that were split when pasting (e.g. from a PDF) and merge them into one paragraph"
                    className={sideBtn}
                  >
                    Join selected lines
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removeEmptyLines(editor)}
                    className={sideBtn}
                  >
                    Remove empty lines
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Templates</p>
                  <button type="button" onClick={() => insertTemplate(MEDIA_RELEASE_TEMPLATE)} className={sideBtn}>
                    Media release
                  </button>
                  <button type="button" onClick={() => insertTemplate(BLOG_POST_TEMPLATE)} className={sideBtn}>
                    Blog post
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      ) : (
        <textarea
          value={rawHtml}
          onChange={(e) => {
            setRawHtml(e.target.value)
            onChange(e.target.value)
          }}
          className="w-full min-h-[400px] p-3 text-sm font-mono bg-white outline-none resize-vertical"
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
