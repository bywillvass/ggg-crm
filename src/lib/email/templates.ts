import { buildStructuredEmail } from "@/lib/email/builder"

// Builder emails are stored as format "html" with the generated HTML in
// body_html and the raw builder fields in body_text behind this prefix, so they
// can be loaded back into the builder for editing.
export const BUILDER_PREFIX = "__builder__:"

export type BuilderFields = {
  eyebrow: string
  heading: string
  subheading: string
  body: string
}

export const EMPTY_BUILDER: BuilderFields = { eyebrow: "", heading: "", subheading: "", body: "" }

export function parseBuilder(bodyText: string | null | undefined): BuilderFields | null {
  if (!bodyText?.startsWith(BUILDER_PREFIX)) return null
  try {
    const b = JSON.parse(bodyText.slice(BUILDER_PREFIX.length))
    return {
      eyebrow: b.eyebrow ?? "",
      heading: b.heading ?? "",
      subheading: b.subheading ?? "",
      body: b.body ?? "",
    }
  } catch {
    return null
  }
}

export function serializeBuilder(b: BuilderFields): string {
  return `${BUILDER_PREFIX}${JSON.stringify(b)}`
}

export function renderBuilder(b: BuilderFields): string {
  return buildStructuredEmail({
    eyebrow: b.eyebrow.trim() || null,
    heading: b.heading.trim(),
    subheading: b.subheading.trim() || null,
    body: b.body,
    unsubscribeUrl: "",
  })
}

export type EditorFormat = "plain" | "html" | "builder"

// What a template or saved email looks like once loaded into an editor
export type LoadedContent = {
  format: EditorFormat
  bodyText: string
  bodyHtml: string
  builder: BuilderFields
}

export function loadContent(t: { format: string; body_html: string | null; body_text: string | null }): LoadedContent {
  const builder = parseBuilder(t.body_text)
  if (builder) return { format: "builder", bodyText: "", bodyHtml: t.body_html ?? "", builder }
  if (t.format === "html" && t.body_html) {
    return { format: "html", bodyText: "", bodyHtml: t.body_html, builder: EMPTY_BUILDER }
  }
  return { format: "plain", bodyText: t.body_text ?? "", bodyHtml: "", builder: EMPTY_BUILDER }
}

// Turns editor state into the columns stored on templates, campaigns and messages
export function saveContent(c: { format: EditorFormat; bodyText: string; bodyHtml: string; builder: BuilderFields }): {
  format: "plain" | "html"
  body_html: string | null
  body_text: string | null
} {
  if (c.format === "builder") {
    return { format: "html", body_html: renderBuilder(c.builder), body_text: serializeBuilder(c.builder) }
  }
  if (c.format === "html") return { format: "html", body_html: c.bodyHtml, body_text: null }
  return { format: "plain", body_html: null, body_text: c.bodyText }
}

// Merge tags the sender fills in (see replaceMergeFields in sender.ts)
export const MERGE_FIELDS = [
  { tag: "contact_first_name", label: "Contact first name" },
  { tag: "contact_last_name", label: "Contact last name" },
  { tag: "player_first_name", label: "Player first name" },
  { tag: "player_last_name", label: "Player last name" },
  { tag: "event_title", label: "Event title" },
  { tag: "event_date", label: "Event date" },
  { tag: "event_time", label: "Event time" },
  { tag: "event_venue", label: "Event venue" },
  { tag: "event_address", label: "Event address" },
] as const

export const TEMPLATE_CATEGORIES = ["general", "event_invite", "reminder", "invoice", "document_request", "newsletter"] as const
