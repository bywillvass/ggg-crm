import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import {
  nk,
  normalizePhone,
  buildMappedFields,
  PARENT_KEYS,
  type MappedFields,
  type CustomMapping,
} from '@/lib/ingest-fields'
import type { Database, Json, TablesUpdate } from '@/lib/database.types'

type LeadSource = Database['public']['Enums']['lead_source']

const VALID_SOURCES: LeadSource[] = [
  'website', 'meta_instant_form', 'newsletter', 'referral', 'manual', 'import', 'other',
]

// ---------------------------------------------------------------------------
// Newsletter contact upsert (no lead created)
// ---------------------------------------------------------------------------
async function upsertNewsletterContact(
  mapped: MappedFields,
  source: LeadSource
): Promise<string> {
  if (mapped.contact_email) {
    const { data: existing } = await serviceClient
      .from('contacts')
      .select('id, tags')
      .eq('email', mapped.contact_email)
      .is('archived_at', null)
      .maybeSingle()

    if (existing) {
      const tags = Array.isArray(existing.tags) ? existing.tags : []
      const updatedTags = tags.includes('newsletter') ? tags : [...tags, 'newsletter']
      await serviceClient
        .from('contacts')
        .update({ marketing_consent: 'express', tags: updatedTags, unsubscribed_at: null })
        .eq('id', existing.id)

      await serviceClient.from('activities').insert({
        type: 'note',
        contact_id: existing.id,
        body: 'Newsletter signup (re-subscribe)',
        created_by: null,
      })
      return existing.id
    }
  }

  const e164 = mapped.contact_phone ? normalizePhone(mapped.contact_phone) : null
  const { data: newContact, error } = await serviceClient
    .from('contacts')
    .insert({
      email: mapped.contact_email ?? null,
      first_name: mapped.contact_first_name ?? null,
      last_name: mapped.contact_last_name ?? null,
      phone: e164,
      marketing_consent: 'express',
      source,
      contact_type: 'other',
      tags: ['newsletter'],
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create newsletter contact: ${error.message}`)

  await serviceClient.from('activities').insert({
    type: 'note',
    contact_id: newContact.id,
    body: 'Newsletter signup',
    created_by: null,
  })

  return newContact.id
}

// ---------------------------------------------------------------------------
// Find or create the parent contact
// ---------------------------------------------------------------------------
async function findOrCreateContact(
  mapped: MappedFields,
  source: LeadSource
): Promise<{ contactId: string; isNew: boolean }> {
  type ContactRow = {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    suburb: string | null
    state: string | null
    notes: string | null
  }
  let existing: ContactRow | null = null

  if (mapped.contact_email) {
    const { data } = await serviceClient
      .from('contacts')
      .select('id, first_name, last_name, phone, suburb, state, notes')
      .eq('email', mapped.contact_email)
      .is('archived_at', null)
      .maybeSingle()
    existing = data
  }

  if (!existing && mapped.contact_phone) {
    const e164 = normalizePhone(mapped.contact_phone)
    if (e164) {
      const { data } = await serviceClient
        .from('contacts')
        .select('id, first_name, last_name, phone, suburb, state, notes')
        .eq('phone', e164)
        .is('archived_at', null)
        .maybeSingle()
      existing = data
    }
  }

  if (existing) {
    // Fill empty fields only — never overwrite
    const updates: TablesUpdate<'contacts'> = {}
    if (!existing.first_name && mapped.contact_first_name)
      updates.first_name = mapped.contact_first_name
    if (!existing.last_name && mapped.contact_last_name)
      updates.last_name = mapped.contact_last_name
    if (!existing.phone && mapped.contact_phone) {
      const e164 = normalizePhone(mapped.contact_phone)
      if (e164) updates.phone = e164
    }
    if (!existing.suburb && mapped.suburb) updates.suburb = mapped.suburb
    if (!existing.state && mapped.state) updates.state = mapped.state
    if (!existing.notes && mapped.message) updates.notes = mapped.message

    if (Object.keys(updates).length > 0) {
      await serviceClient.from('contacts').update(updates).eq('id', existing.id)
    }
    return { contactId: existing.id, isNew: false }
  }

  const e164Phone = mapped.contact_phone ? normalizePhone(mapped.contact_phone) : null
  const { data: newContact, error } = await serviceClient
    .from('contacts')
    .insert({
      email: mapped.contact_email ?? null,
      first_name: mapped.contact_first_name ?? null,
      last_name: mapped.contact_last_name ?? null,
      phone: e164Phone,
      suburb: mapped.suburb ?? null,
      state: mapped.state ?? null,
      notes: mapped.message ?? null,
      source,
      contact_type: 'parent',
      tags: [],
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create contact: ${error.message}`)
  return { contactId: newContact.id, isNew: true }
}

// ---------------------------------------------------------------------------
// Find or create the player and guardian link
// ---------------------------------------------------------------------------
async function findOrCreatePlayer(
  mapped: MappedFields,
  contactId: string,
  isParent: boolean
): Promise<string> {
  const firstName = mapped.player_first_name ?? null
  const lastName = mapped.player_last_name ?? null
  const birthYearNum = mapped.player_birth_year ? parseInt(mapped.player_birth_year, 10) : null

  // Try to find an existing player linked to this contact
  if (firstName && birthYearNum) {
    const { data: linked } = await serviceClient
      .from('player_contacts')
      .select('player_id')
      .eq('contact_id', contactId)

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
      if (match) return match.id
    }
  }

  // Create new player
  const { data: newPlayer, error } = await serviceClient
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

  if (error) throw new Error(`Failed to create player: ${error.message}`)

  // Guardian link — isParent true when contact and player are different people
  const relationship = isParent ? 'guardian' : 'self'
  await serviceClient.from('player_contacts').insert({
    player_id: newPlayer.id,
    contact_id: contactId,
    relationship,
    is_primary: true,
    is_emergency: false,
  })

  return newPlayer.id
}

// ---------------------------------------------------------------------------
// Process one lead from the ingest payload
// ---------------------------------------------------------------------------
interface IngestLeadInput {
  external_id?: string | null
  source?: string | null
  form_type?: string | null
  source_detail?: string | null
  submitted_at?: string | null
  fields?: Record<string, unknown>
}

interface IngestResult {
  external_id: string
  status: 'created' | 'merged' | 'duplicate' | 'error'
  lead_id: string | null
  error: string | null
}

async function processOneLead(
  input: IngestLeadInput,
  customMappings: CustomMapping[]
): Promise<IngestResult> {
  const externalId = input.external_id ?? null

  // Idempotency: never process the same external_id twice
  if (externalId) {
    const { data: existing } = await serviceClient
      .from('ingest_log')
      .select('id, status, lead_id')
      .eq('external_id', externalId)
      .maybeSingle()

    if (existing) {
      return { external_id: externalId, status: 'duplicate', lead_id: existing.lead_id, error: null }
    }
  }

  const rawSource = input.source ?? 'manual'
  const source: LeadSource = VALID_SOURCES.includes(rawSource as LeadSource)
    ? (rawSource as LeadSource)
    : 'other'
  const formType = input.form_type ?? null
  const submittedAt = input.submitted_at ?? new Date().toISOString()
  const rawFields = input.fields ?? {}

  const { mapped, hasParentField } = buildMappedFields(rawFields, customMappings, formType)

  // Newsletter: no lead, just upsert contact
  if (formType?.toLowerCase() === 'newsletter') {
    await upsertNewsletterContact(mapped, source)
    await serviceClient.from('ingest_log').insert({
      received_at: submittedAt,
      external_id: externalId,
      source,
      form_type: formType,
      status: 'created',
      error: null,
      lead_id: null,
    })
    return { external_id: externalId ?? '', status: 'created', lead_id: null, error: null }
  }

  // Determine if contact is a parent:
  //   - explicit parent key in the form (parentname, guardianemail, etc.), OR
  //   - both a contact name AND a player name were supplied (two different people)
  const hasPlayerData = !!(mapped.player_first_name || mapped.player_last_name)
  const contactHasName = !!(mapped.contact_first_name || mapped.contact_last_name)
  const isParent = hasParentField || (hasPlayerData && contactHasName)

  // Find or create parent contact
  const { contactId, isNew: isNewContact } = await findOrCreateContact(mapped, source)

  // Find or create player if player data is present
  let playerId: string | null = null
  if (hasPlayerData) {
    playerId = await findOrCreatePlayer(mapped, contactId, isParent)
  }

  // form_name from the submission overrides the form_type sent in the payload
  // (fixes Meta "Sheet1" tab name being used instead of real form name)
  const resolvedFormType = mapped.form_name || formType

  // source_detail: explicit payload value > campaign_name > legacy source_detail
  const sourceDetail = input.source_detail || mapped.campaign_name || mapped.source_detail || null

  const { data: leadData, error: leadError } = await serviceClient
    .from('leads')
    .insert({
      source,
      form_type: resolvedFormType,
      source_detail: sourceDetail,
      external_id: externalId,
      raw: rawFields as Json,
      contact_id: contactId,
      player_id: playerId,
      stage: 'new',
      submitted_at: submittedAt,
      campaign_name: mapped.campaign_name ?? null,
      adset_name: mapped.adset_name ?? null,
    })
    .select('id')
    .single()

  if (leadError) throw new Error(leadError.message)

  await serviceClient.from('activities').insert({
    type: 'lead_created',
    contact_id: contactId,
    player_id: playerId,
    lead_id: leadData.id,
    body: `Lead received from ${source}${resolvedFormType ? ` (${resolvedFormType})` : ''}`,
    created_by: null,
  })

  const status = isNewContact ? 'created' : 'merged'

  await serviceClient.from('ingest_log').insert({
    received_at: submittedAt,
    external_id: externalId,
    source,
    form_type: resolvedFormType,
    status,
    error: null,
    lead_id: leadData.id,
  })

  return { external_id: externalId ?? '', status, lead_id: leadData.id, error: null }
}

// ---------------------------------------------------------------------------
// POST /api/ingest
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ingestSecret = req.headers.get('x-ingest-secret')
  if (!ingestSecret || ingestSecret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { leads: IngestLeadInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body?.leads)) {
    return NextResponse.json({ error: 'Missing leads array' }, { status: 400 })
  }

  // Load custom mappings once for the whole batch
  const { data: customMappings } = await serviceClient
    .from('ingest_field_mappings')
    .select('source_key, target, form_type')

  const results: IngestResult[] = []
  for (const lead of body.leads) {
    try {
      const result = await processOneLead(lead, customMappings ?? [])
      results.push(result)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      results.push({ external_id: lead.external_id ?? '', status: 'error', lead_id: null, error: errMsg })
      await serviceClient.from('ingest_log').insert({
        received_at: lead.submitted_at ?? new Date().toISOString(),
        external_id: lead.external_id ?? null,
        source: lead.source ?? null,
        form_type: lead.form_type ?? null,
        status: 'error',
        error: errMsg,
        lead_id: null,
      })
    }
  }

  return NextResponse.json({ ok: true, results })
}
