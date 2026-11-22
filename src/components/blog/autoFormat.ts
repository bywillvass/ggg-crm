// Auto-format: the editor's HTML is split into numbered lines, Claude returns a
// plan (which lines form each block and what style it gets), and the post is
// rebuilt here from the original lines. The model never writes the text itself,
// so wording can't change.

export const AUTO_STYLES = [
  "kicker",
  "headline",
  "lead",
  "body",
  "heading",
  "subheading",
  "quote",
  "info",
  "bullet",
  "numbered",
  "ends",
  "boilerplate",
  "small",
] as const
export type AutoStyle = (typeof AUTO_STYLES)[number]

export const FORMAT_INSTRUCTIONS = `You lay out blog posts and media releases for Ginga Global Group, an Australian football (soccer) organisation. You decide structure only. You never rewrite, add or remove words.

You receive the post as numbered lines: "<number> [<current tag>] <text>". The text is often pasted from a PDF or Word document, so one paragraph may be split across several lines mid-sentence, and the current tags are often wrong (for example a heading pasted as a bullet point, or every line a separate paragraph).

Return blocks in reading order. Each block lists the line numbers that form it (consecutive lines of one paragraph go in the same block) and one style:
- kicker: small label line above a headline, e.g. "MEDIA RELEASE | FOR IMMEDIATE RELEASE | 20th November 2026"
- headline: the main headline of a media release, near the top (at most one)
- lead: the opening paragraph that summarises the story (usually the first body paragraph; at most one)
- body: normal paragraph
- heading: a section heading (short line, no full stop, introduces the text after it)
- subheading: a smaller heading, e.g. "Media contact", "Notes for editors", or a heading nested inside a section
- quote: a standalone pull quote set apart from the text. Quotes in a media release with "said ..." attribution are body, not quote.
- info: short key/value detail lines such as "When: ...", "Where: ...", "Time: ...", or contact lines (name, phone, email, web). One line per block.
- bullet / numbered: list items, one item per block
- ends: the end-of-release marker, e.g. "ENDS" or "###"
- boilerplate: the "about the organisation" paragraph after the end marker
- small: small print such as notes for editors, photo credits, disclaimers

Rules:
- Use every line number exactly once, in order. Never skip a line.
- Only join lines that belong to the same sentence or paragraph. Keep each "Label: value" line and each contact line as its own block.
- Lines shown as [IMAGE] or [DIVIDER] go in a block of their own (any style).
- A normal blog post (not a media release) usually has no kicker, headline, ends or boilerplate.`

// For pasting into a normal Claude chat (no API key): instructions, the JSON
// shape to reply with, and the numbered lines.
export function buildChatPrompt(lines: string): string {
  return `${FORMAT_INSTRUCTIONS}

Reply with only JSON in this exact shape, no other text:
{"blocks":[{"style":"kicker","lines":[0]},{"style":"lead","lines":[2,3,4]}]}

Allowed styles: ${AUTO_STYLES.join(", ")}

The post:
${lines}`
}

// Pull the plan out of a pasted chat reply (may include code fences or extra text)
export function parsePlan(reply: string): FormatPlan | null {
  const start = reply.indexOf("{")
  const end = reply.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(reply.slice(start, end + 1)) as Partial<FormatPlan>
    if (!Array.isArray(data.blocks)) return null
    const blocks = data.blocks
      .filter((b) => b && Array.isArray(b.lines))
      .map((b) => ({
        style: (AUTO_STYLES as readonly string[]).includes(b.style) ? b.style : "body",
        lines: b.lines.map(Number),
      }))
    return blocks.length ? { blocks } : null
  } catch {
    return null
  }
}

export type FormatPlan = { blocks: { style: AutoStyle; lines: number[] }[] }

type Unit =
  | { kind: "text"; tag: string; html: string; text: string }
  | { kind: "raw"; tag: string; html: string; text: string }

function textOf(html: string): string {
  const el = document.createElement("div")
  el.innerHTML = html
  return (el.textContent ?? "").replace(/\s+/g, " ").trim()
}

export function extractUnits(html: string): Unit[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const units: Unit[] = []

  const pushText = (tag: string, inner: string) => {
    // A pasted paragraph can hold several lines separated by <br>
    for (const part of inner.split(/<br\s*\/?>/i)) {
      const text = textOf(part)
      if (text) units.push({ kind: "text", tag, html: part.trim(), text })
    }
  }

  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase()
      if (tag === "hr") {
        units.push({ kind: "raw", tag, html: "<hr>", text: "[DIVIDER]" })
      } else if (tag === "img") {
        units.push({ kind: "raw", tag, html: child.outerHTML, text: "[IMAGE]" })
      } else if (child.querySelector("img") && !textOf(child.innerHTML)) {
        child.querySelectorAll("img").forEach((img) =>
          units.push({ kind: "raw", tag: "img", html: img.outerHTML, text: "[IMAGE]" })
        )
      } else if (tag === "ul" || tag === "ol") {
        for (const li of Array.from(child.children)) {
          const ps = li.querySelectorAll(":scope > p")
          if (ps.length) ps.forEach((p) => pushText(tag === "ul" ? "bullet" : "numbered", p.innerHTML))
          else pushText(tag === "ul" ? "bullet" : "numbered", li.innerHTML)
        }
      } else if (tag === "blockquote") {
        const ps = child.querySelectorAll("p")
        if (ps.length) ps.forEach((p) => pushText("quote", p.innerHTML))
        else pushText("quote", child.innerHTML)
      } else if (/^(p|h[1-6])$/.test(tag)) {
        const cls = child.getAttribute("class")
        pushText(cls ? `${tag}.${cls}` : tag, child.innerHTML)
      } else if (child.children.length) {
        walk(child)
      } else {
        pushText("p", child.innerHTML)
      }
    }
  }
  walk(doc.body.firstElementChild!)
  return units
}

// Lines as the model sees them: "12 [h2] More than a football trip"
export function unitsToPrompt(units: Unit[]): string {
  return units.map((u, i) => `${i} [${u.tag}] ${u.text}`).join("\n")
}

const stripMarks = (html: string) => html.replace(/<\/?(strong|b|em|i|u)>/gi, "").trim()

function joinInline(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(" ")
}

// "When: Saturday" -> "<strong>When:</strong> Saturday"
function boldLabel(html: string): string {
  if (/^<strong>/i.test(html)) return html
  const m = html.match(/^([A-Z][A-Za-z/& ]{0,24}:)(\s)/)
  return m ? `<strong>${m[1]}</strong>${html.slice(m[1].length)}` : html
}

export function buildHtml(units: Unit[], plan: FormatPlan): string {
  const used = new Set<number>()
  const blocks: { style: AutoStyle | "raw"; lines: number[] }[] = []

  for (const b of plan.blocks) {
    const lines = [...new Set(b.lines)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < units.length && !used.has(i))
      .sort((a, z) => a - z)
    // Images and dividers always stand alone
    const text = lines.filter((i) => units[i].kind === "text")
    for (const i of lines) {
      used.add(i)
      if (units[i].kind === "raw") blocks.push({ style: "raw", lines: [i] })
    }
    if (text.length) blocks.push({ style: AUTO_STYLES.includes(b.style) ? b.style : "body", lines: text })
  }
  // Anything the plan missed is kept as body copy (or as-is) in its place
  units.forEach((u, i) => {
    if (!used.has(i)) blocks.push({ style: u.kind === "raw" ? "raw" : "body", lines: [i] })
  })
  blocks.sort((a, z) => a.lines[0] - z.lines[0])

  const out: string[] = []
  let listOpen: "ul" | "ol" | null = null
  let quoteOpen = false
  const closeGroups = () => {
    if (listOpen) out.push(`</${listOpen}>`)
    if (quoteOpen) out.push("</blockquote>")
    listOpen = null
    quoteOpen = false
  }

  for (const b of blocks) {
    const html = joinInline(b.lines.map((i) => units[i].html))
    if (b.style === "bullet" || b.style === "numbered") {
      const tag = b.style === "bullet" ? "ul" : "ol"
      if (listOpen !== tag) {
        closeGroups()
        out.push(`<${tag}>`)
        listOpen = tag
      }
      out.push(`<li><p>${html}</p></li>`)
      continue
    }
    if (b.style === "quote") {
      if (!quoteOpen) {
        closeGroups()
        out.push("<blockquote>")
        quoteOpen = true
      }
      out.push(`<p>${html}</p>`)
      continue
    }
    closeGroups()
    switch (b.style) {
      case "raw":
        out.push(html)
        break
      case "heading":
        out.push(`<h2>${stripMarks(html)}</h2>`)
        break
      case "subheading":
        out.push(`<h3>${stripMarks(html)}</h3>`)
        break
      case "headline":
      case "kicker":
      case "ends":
        out.push(`<p class="${b.style}">${stripMarks(html)}</p>`)
        break
      case "info":
        out.push(`<p class="info">${boldLabel(html)}</p>`)
        break
      case "body":
        out.push(`<p>${html}</p>`)
        break
      default:
        out.push(`<p class="${b.style}">${html}</p>`)
    }
  }
  closeGroups()
  return out.join("")
}
