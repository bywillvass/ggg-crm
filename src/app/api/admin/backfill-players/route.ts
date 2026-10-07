// GET /api/admin/backfill-players
//
// Fixes existing Meta instant-form leads that were ingested before the
// field-mapping bug was fixed (those leads have a contact but no player).
//
// Query params:
//   dry_run=true  (default) — fast SQL counts only, nothing written
//   dry_run=false           — execute the backfill in batches
//   limit=N                 — leads to process per call in execute mode (default 50)
//
// Usage:
//   1. Dry run:  GET /api/admin/backfill-players?dry_run=true
//   2. Execute:  GET /api/admin/backfill-players?dry_run=false
//      If there are many leads, call it again until "processed" = 0.
//
// Requires an active admin session cookie (same as the CRM login).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { buildMappedFields, normalizePhone } from '@/lib/ingest-fields'

function parseCreatedTime(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  const n = Number(s)
  if (!isNaN(n) && n > 1_000_000_000) return new Date(n * 1000).toISOString()
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // --- Auth check ---
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Log in to the CRM first, then retry this URL.' },
      { status: 401 }
    )
  }
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') !== 'false'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100)

  // -----------------------------------------------------------------------
  // DRY RUN — fast SQL counts only, no per-lead processing
  // -----------------------------------------------------------------------
  if (dryRun) {
    const [totalRes, withPlayerRes, sampleRes] = await Promise.all([
      // Total Meta leads
      serviceClient
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'meta_instant_form')
        .is('archived_at', null),

      // Meta leads that already have a player
      serviceClient
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'meta_instant_form')
        .is('archived_at', null)
        .not('player_id', 'is', null),

      // Sample 5 leads without a player so we can inspect raw keys
      serviceClient
        .from('leads')
        .select('id, form_type, submitted_at, raw')
        .eq('source', 'meta_instant_form')
        .is('player_id', null)
        .is('archived_at', null)
        .limit(5),
    ])

    const total = totalRes.count ?? 0
    const withPlayer = withPlayerRes.count ?? 0
    const withoutPlayer = total - withPlayer

    // Inspect the sample to see which have player data in raw
    const sample = sampleRes.data ?? []
    let sampleHasPlayerData = 0
    let sampleHasCreatedTime = 0

    for (const lead of sample) {
      const raw = (lead.raw ?? {}) as Record<string, unknown>
      const { mapped } = buildMappedFields(raw, [], lead.form_type)
      if (mapped.player_first_name || mapped.player_last_name) sampleHasPlayerData++
      if (raw['created_time']) sampleHasCreatedTime++
    }

    return NextResponse.json({
      dry_run: true,
      total_meta_leads: total,
      already_have_player: withPlayer,
      missing_player: withoutPlayer,
      sample_size: sample.length,
      sample_has_player_data_in_raw: sampleHasPlayerData,
      sample_has_created_time: sampleHasCreatedTime,
      sample_raw_keys: sample[0]
        ? Object.keys((sample[0].raw ?? {}) as Record<string, unknown>).slice(0, 12)
        : [],
      next_step: withoutPlayer > 0
        ? `To execute: GET /api/admin/backfill-players?dry_run=false&limit=${limit}`
        : 'Nothing to do — all Meta leads already have a player.',
    })
  }

  // -----------------------------------------------------------------------
  // EXECUTE — process up to `limit` leads per call
  // -----------------------------------------------------------------------
  const { data: customMappings } = await serviceClient
    .from('ingest_field_mappings')
    .select('source_key, target, form_type')

  const { data: leads } = await serviceClient
    .from('leads')
    .select('id, contact_id, raw, submitted_at, form_type')
    .eq('source', 'meta_instant_form')
    .is('player_id', null)
    .is('archived_at', null)
    .order('submitted_at', { ascending: true })
    .limit(limit)

  const allLeads = leads ?? []
  let fixedSubmittedAt = 0
  let linkedExisting = 0
  let created = 0
  let noData = 0
  const errors: string[] = []

  for (const lead of allLeads) {
    if (!lead.contact_id) { noData++; continue }

    const rawFields = (lead.raw ?? {}) as Record<string, unknown>
    const { mapped, hasParentField } = buildMappedFields(rawFields, customMappings ?? [], lead.form_type)

    // Fix submitted_at from created_time + form_type from form_name
    const correctTime = parseCreatedTime(rawFields['created_time'])
    const correctFormType = (rawFields['form_name'] as string | undefined)?.trim() || null
    const timeNeedsfix = !!correctTime && correctTime !== lead.submitted_at
    const typeNeedsFix = !!correctFormType && lead.form_type !== correctFormType

    if (timeNeedsfix || typeNeedsFix) {
      await serviceClient.from('leads').update({
        ...(timeNeedsfix ? { submitted_at: correctTime! } : {}),
        ...(typeNeedsFix ? { form_type: correctFormType! } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id)
      if (timeNeedsfix) fixedSubmittedAt++
    }

    const hasPlayerData = !!(mapped.player_first_name || mapped.player_last_name)
    if (!hasPlayerData) { noData++; continue }

    const contactHasName = !!(mapped.contact_first_name || mapped.contact_last_name)
    const isParent = hasParentField || (hasPlayerData && contactHasName)
    const firstName = mapped.player_first_name ?? null
    const lastName = mapped.player_last_name ?? null
    const birthYearNum = mapped.player_birth_year ? parseInt(mapped.player_birth_year, 10) : null

    try {
      // Check for existing player linked to this contact
      let existingPlayerId: string | null = null
      if (firstName && birthYearNum) {
        const { data: linked } = await serviceClient
          .from('player_contacts')
          .select('player_id')
          .eq('contact_id', lead.contact_id)

        if (linked?.length) {
          const { data: players } = await serviceClient
            .from('players')
            .select('id, first_name, birth_year')
            .in('id', linked.map((r) => r.player_id))
            .is('archived_at', null)
          const match = players?.find(
            (p) => p.first_name?.toLowerCase() === firstName.toLowerCase() && p.birth_year === birthYearNum
          )
          if (match) existingPlayerId = match.id
        }
      }

      if (existingPlayerId) {
        await serviceClient
          .from('leads')
          .update({ player_id: existingPlayerId, updated_at: new Date().toISOString() })
          .eq('id', lead.id)
        linkedExisting++
      } else {
        const { data: newPlayer, error: playerErr } = await serviceClient
          .from('players')
          .insert({
            first_name: firstName,
            last_name: lastName,
            birth_year: birthYearNum,
            dob: mapped.player_dob ?? null,
            current_club: mapped.player_club ?? null,
            position: mapped.player_position ?? null,
            level: mapped.player_level ?? null,
            state: mapped.state ?? null,
            status: 'prospect',
          })
          .select('id')
          .single()

        if (playerErr) { errors.push(`Lead ${lead.id}: ${playerErr.message}`); continue }

        await serviceClient.from('player_contacts').insert({
          player_id: newPlayer.id,
          contact_id: lead.contact_id,
          relationship: isParent ? 'guardian' : 'self',
          is_primary: true,
          is_emergency: false,
        })

        await serviceClient
          .from('leads')
          .update({ player_id: newPlayer.id, updated_at: new Date().toISOString() })
          .eq('id', lead.id)
        created++
      }
    } catch (err) {
      errors.push(`Lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    dry_run: false,
    processed: allLeads.length,
    fixed_submitted_at: fixedSubmittedAt,
    linked_to_existing_player: linkedExisting,
    created_new_player: created,
    no_player_data: noData,
    errors,
    message: allLeads.length > 0
      ? `Done. If there are more leads, call this URL again.`
      : 'All done — no more leads to process.',
  })
}
