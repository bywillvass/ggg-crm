// POST /api/admin/backfill-players
//
// Fixes existing Meta instant-form leads that were ingested before the
// field-mapping bug was fixed.  Those leads have a contact but no player.
//
// Query params:
//   dry_run=true  (default) — report what WOULD change, write nothing
//   dry_run=false           — actually create players and update leads
//
// Also fixes submitted_at on any Meta lead whose raw data contains created_time.
//
// Usage:
//   Dry run:  GET /api/admin/backfill-players?dry_run=true
//   Execute:  GET /api/admin/backfill-players?dry_run=false
//
// This route requires an active admin session cookie (same as the CRM login).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import {
  buildMappedFields,
  normalizePhone,
} from '@/lib/ingest-fields'

// ---------------------------------------------------------------------------
// Parse Meta's created_time (Unix seconds or date string) → ISO string
// ---------------------------------------------------------------------------
function parseCreatedTime(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  const n = Number(s)
  if (!isNaN(n) && n > 1_000_000_000) {
    // Unix timestamp in seconds
    return new Date(n * 1000).toISOString()
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  // --- Auth: require admin session ---
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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

  // --- Load custom field mappings once ---
  const { data: customMappings } = await serviceClient
    .from('ingest_field_mappings')
    .select('source_key, target, form_type')

  // --- Load all Meta leads without a player ---
  const { data: leads, error: leadsError } = await serviceClient
    .from('leads')
    .select('id, contact_id, raw, submitted_at, form_type')
    .eq('source', 'meta_instant_form')
    .is('player_id', null)
    .is('archived_at', null)
    .order('submitted_at', { ascending: true })

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }

  const allLeads = leads ?? []

  // Counters
  let wouldFixSubmittedAt = 0
  let wouldLinkExisting = 0
  let wouldCreate = 0
  let noPlayerData = 0
  const errors: string[] = []

  for (const lead of allLeads) {
    if (!lead.contact_id) {
      noPlayerData++
      continue
    }

    const rawFields = (lead.raw ?? {}) as Record<string, unknown>

    // Build mapped fields using the updated BUILTIN (includes Meta question keys)
    const { mapped, hasParentField } = buildMappedFields(
      rawFields,
      customMappings ?? [],
      lead.form_type
    )

    // Determine if the contact is a parent
    const hasPlayerData = !!(mapped.player_first_name || mapped.player_last_name)
    const contactHasName = !!(mapped.contact_first_name || mapped.contact_last_name)
    const isParent = hasParentField || (hasPlayerData && contactHasName)

    // Check if submitted_at needs fixing
    const correctTime = parseCreatedTime(rawFields['created_time'])
    const needsTimefix = !!correctTime && correctTime !== lead.submitted_at

    if (needsTimefix) {
      wouldFixSubmittedAt++
      if (!dryRun) {
        await serviceClient
          .from('leads')
          .update({ submitted_at: correctTime, updated_at: new Date().toISOString() })
          .eq('id', lead.id)
      }
    }

    if (!hasPlayerData) {
      noPlayerData++
      continue
    }

    const firstName = mapped.player_first_name ?? null
    const lastName = mapped.player_last_name ?? null
    const birthYearNum = mapped.player_birth_year ? parseInt(mapped.player_birth_year, 10) : null

    try {
      // Check for an existing player linked to this contact
      let existingPlayerId: string | null = null

      if (firstName && birthYearNum) {
        const { data: linked } = await serviceClient
          .from('player_contacts')
          .select('player_id')
          .eq('contact_id', lead.contact_id)

        if (linked && linked.length > 0) {
          const playerIds = linked.map((r) => r.player_id)
          const { data: players } = await serviceClient
            .from('players')
            .select('id, first_name, birth_year')
            .in('id', playerIds)
            .is('archived_at', null)

          const match = players?.find(
            (p) =>
              p.first_name?.toLowerCase() === firstName.toLowerCase() &&
              p.birth_year === birthYearNum
          )
          if (match) existingPlayerId = match.id
        }
      }

      if (existingPlayerId) {
        wouldLinkExisting++
        if (!dryRun) {
          await serviceClient
            .from('leads')
            .update({ player_id: existingPlayerId, updated_at: new Date().toISOString() })
            .eq('id', lead.id)
        }
      } else {
        wouldCreate++
        if (!dryRun) {
          // Create player
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

          if (playerErr) {
            errors.push(`Lead ${lead.id}: ${playerErr.message}`)
            continue
          }

          // Guardian link
          const relationship = isParent ? 'guardian' : 'self'
          await serviceClient.from('player_contacts').insert({
            player_id: newPlayer.id,
            contact_id: lead.contact_id,
            relationship,
            is_primary: true,
            is_emergency: false,
          })

          // Update lead
          await serviceClient
            .from('leads')
            .update({ player_id: newPlayer.id, updated_at: new Date().toISOString() })
            .eq('id', lead.id)
        }
      }
    } catch (err) {
      errors.push(`Lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const phone_fix_sample = allLeads
    .slice(0, 3)
    .map((l) => {
      const raw = (l.raw ?? {}) as Record<string, unknown>
      return {
        lead_id: l.id,
        form_type: l.form_type,
        raw_keys: Object.keys(raw).slice(0, 8),
      }
    })

  return NextResponse.json({
    dry_run: dryRun,
    total_meta_leads_without_player: allLeads.length,
    would_fix_submitted_at: wouldFixSubmittedAt,
    would_link_to_existing_player: wouldLinkExisting,
    would_create_new_player: wouldCreate,
    no_player_data_in_raw: noPlayerData,
    errors,
    sample_leads: phone_fix_sample,
    message: dryRun
      ? 'Dry run complete — nothing written. Add ?dry_run=false to execute.'
      : `Backfill complete. Created ${wouldCreate} players, linked ${wouldLinkExisting} existing players, fixed ${wouldFixSubmittedAt} submitted_at dates.`,
  })
}
