import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/role"
import { AUTO_STYLES, FORMAT_INSTRUCTIONS } from "@/components/blog/autoFormat"
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


// Lets the editor show the one-click button only when a key is configured
export async function GET() {
  await requireAdmin()
  return NextResponse.json({ enabled: !!process.env.ANTHROPIC_API_KEY })
}

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
      system: FORMAT_INSTRUCTIONS,
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
