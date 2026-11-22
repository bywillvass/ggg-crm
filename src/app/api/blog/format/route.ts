import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/role"
import { AUTO_STYLES } from "@/components/blog/autoFormat"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const PlanSchema = z.object({
  blocks: z.array(
    z.object({
      style: z.enum(AUTO_STYLES),
      lines: z.array(z.number().int()),
    })
  ),
})

const SYSTEM = `You lay out blog posts and media releases for Ginga Global Group, an Australian football (soccer) organisation. You decide structure only. You never rewrite, add or remove words.

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

export async function POST(request: NextRequest) {
  await requireAdmin()
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
  }

  const { lines } = (await request.json()) as { lines?: string }
  if (!lines?.trim()) return NextResponse.json({ error: "Nothing to format" }, { status: 400 })

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(PlanSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: lines }],
    })
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't format this post, try again" }, { status: 502 })
    }
    return NextResponse.json(response.parsed_output)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI is busy, try again in a minute" }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic API key is invalid" }, { status: 500 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI error ${err.status}: ${err.message}` }, { status: 502 })
    }
    throw err
  }
}
