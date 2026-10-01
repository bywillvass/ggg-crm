import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { parsePhoneNumber } from 'libphonenumber-js'
import type { Database, Json, TablesUpdate } from '@/lib/database.types'

type LeadSource = Database['public']['Enums']['lead_source']

const VALID_SOURCES: LeadSource[] = [
  'website', 'meta_instant_form', 'newsletter', 'referral', 'manual', 'import', 'other',
]

// Built-in field key (normalised) -> mapping target
const BUILTIN: Record<string, string> = {
  email: 'contact_email',
  emailaddress: 'contact_email',
  parentemail: 'contact_email',
  guardianemail: 'contact_email',
  phone: 'contact_phone',
  phonenumber: 'contact_phone',
  mobile: 'contact_phone',
  mobilenumber: 'contact_phone',
  parentphone: 'contact_phone',
  fullname: 'contact_full_name',
  parentname: 'contact_full_name',
  guardianname: 'contact_full_name',
  name: 'contact_full_name',
  firstname: 'contact_first_name',
  parentfirstname: 'contact_first_name',
  lastname: 'contact_last_name',
  parentlastname: 'contact_last_name',
  surname: 'contact_last_name',
  playername: 'player_full_name',
  childname: 'player_full_name',
  playerfullname: 'player_full_name',
  childsname: 'player_full_name',
  playerfirstname: 'player_first_name',
  playerlastname: 'player_last_name',
  dob: 'player_dob',
  dateofbirth: 'player_dob',
  birthdate: 'player_dob',
  playerdob: 'player_dob',
  birthyear: 'player_birth_year',
  yearofbirth: 'player_birth_year',
  playerbirthyear: 'player_birth_year',
  club: 'player_club',
  currentclub: 'player_club',
  position: 'player_position',
  playerposition: 'player_position',
  level: 'player_level',
  league: 'player_level',
  suburb: 'suburb',
  city: 'suburb',
  state: 'state',
  message: 'message',
  comments: 'message',
  enquiry: 'message',
  notes: 'message',
  campaignname: 'campaign',
  adname: 'campaign',
  adsetname: 'campaign',
  formname: 'campaign',
}

// Normalised keys that indicate the contact is a parent/guardian (not the player)
const PARENT_KEYS = new Set([
  'parentname', 'guardianname', 'parentemail', 'guardianemail',
  'parentphone', 'parentfirstname', 'parentlastname',
])

function nk(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizePhone(raw: string): string | null {
  try {
    const parsed = parsePhoneNumber(raw, 'AU')
    if (parsed?.isValid()) return parsed.format('E.164')
  } catch {
    // ignore parse errors
  }
  return null
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return [parts[0], '']
  return [parts[0], parts.slice(1).join(' ')]
}

interface MappedFields {
  contact_email?: string
  contact_phone?: string
  contact_first_name?: string
  contact_last_name?: string
  player_first_name?: string
  player_last_name?: string
  player_dob?: string
  player_birth_year?: string
  player_club?: string
  player_position?: string
  player_level?: string
  suburb?: string
  state?: string
  message?: string
  source_detail?: string
}

type CustomMapping = { source_key: string; target: string; form_type: string | null }

function buildMappedFields(
  rawFields: Record<string, unknown>,
  customMappings: CustomMapping[],
  formType: string | null | undefined
): { mapped: MappedFields; hasParentField: boolean } {
  // Build lookup: normalised key -> target (global first, then form-specific overwrites)
  const lookup: Record<string, string> = {}
  for (const row of customMappings) {
    if (!row.form_type) lookup[nk(row.source_key)] = row.target
  }
  for (const row of customMappings) {
    if (row.form_type === formType) lookup[nk(row.source_key)] = row.target
  }

  const mapped: MappedFields = {}
  let hasParentField = false

  for (const [rawKey, rawValue] of Object.entries(rawFields)) {
    const value = rawValue?.toString().trim()
    if (!value) continue
    const normalizedKey = nk(rawKey)
    if (PARENT_KEYS.has(normalizedKey)) hasParentField = true
    const target = lookup[normalizedKey] ?? BUILTIN[normalizedKey]
    if (!target) continue

    if (target === 'contact_email' && !mapped.contact_email) {
      mapped.contact_email = value.toLowerCase()
    } else if (target === 'contact_phone' && !mapped.contact_phone) {
      mapped.contact_phone = value
    } else if (target === 'contact_full_name') {
      const [fn, ln] = splitName(value)
      if (!mapped.contact_first_name) mapped.contact_first_name = fn
      if (!mapped.contact_last_name && ln) mapped.contact_last_name = ln
    } else if (target === 'contact_first_name' && !mapped.contact_first_name) {
      mapped.contact_first_name = value
    } else if (target === 'contact_last_name' && !mapped.contact_last_name) {
      mapped.contact_last_name = value
    } else if (target === 'player_full_name') {
      const [fn, ln] = splitName(value)
      if (!mapped.player_first_name) mapped.player_first_name = fn
      if (!mapped.player_last_name && ln) mapped.player_last_name = ln
    } else if (target === 'player_first_name' && !mapped.player_first_name) {
      mapped.player_first_name = value
    } else if (target === 'player_last_name' && !mapped.player_last_name) {
      mapped.player_last_name = value
    } else if (target === 'player_dob' && !mapped.player_dob) {
      mapped.player_dob = value
    } else if (target === 'player_birth_year' && !mapped.player_birth_year) {
      mapped.player_birth_year = value
    } else if (target === 'player_club' && !mapped.player_club) {
      mapped.player_club = value
    } else if (target === 'player_position' && !mapped.player_position) {
      mapped.player_position = value
    } else if (target === 'player_level' && !mapped.player_level) {
      mapped.player_level = value
    } else if (target === 'suburb' && !mapped.suburb) {
      mapped.suburb = value
    } else if (target === 'state' && !mapped.state) {
      mapped.state = value
    } else if (target === 'message' && !mapped.message) {
      mapped.message = value
    } else if (target === 'campaign' && !mapped.source_detail) {
      mapped.source_detail = value
    }
  }

  return { mapped, hasParentField }
}

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

  // Create new contact
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

async function findOrCreateContact(
  mapped: MappedFields,
  source: LeadSource
): Promise<{ contactId: string; isNew: boolean }> {
  let existing: { id: string; first_name: string | null; last_name: string | null; phone: string | null; suburb: string | null; state: string | null; notes: string | null } | null = null

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
      tags: [],
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create contact: ${error.message}`)
  return { contactId: newContact.id, isNew: true }
}

async function findOrCreatePlayer(
  mapped: MappedFields,
  contactId: string,
  hasParentField: boolean
): Promise<string> {
  const firstName = mapped.player_first_name ?? null
  const lastName = mapped.player_last_name ?? null
  const birthYearNum = mapped.player_birth_year ? parseInt(mapped.player_birth_year, 10) : null

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
      status: 'prospect',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create player: ${error.message}`)

  const relationship = hasParentField ? 'guardian' : 'self'
  await serviceClient.from('player_contacts').insert({
    player_id: newPlayer.id,
    contact_id: contactId,
    relationship,
    is_primary: true,
    is_emergency: false,
  })

  return newPlayer.id
}

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

  // Idempotency check
  if (externalId) {
    const { data: existing } = await serviceClient
      .from('ingest_log')
      .select('id, status, lead_id')
      .eq('external_id', externalId)
      .maybeSingle()

    if (existing) {
      return {
        external_id: externalId,
        status: 'duplicate',
        lead_id: existing.lead_id,
        error: null,
      }
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

  // Newsletter: no lead, upsert contact only
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

  // Find or create contact
  const { contactId, isNew: isNewContact } = await findOrCreateContact(mapped, source)

  // Find or create player if player data present
  let playerId: string | null = null
  if (mapped.player_first_name || mapped.player_last_name) {
    playerId = await findOrCreatePlayer(mapped, contactId, hasParentField)
  }

  // Payload source_detail takes precedence over field-mapped campaign value
  const sourceDetail = input.source_detail ?? mapped.source_detail ?? null

  const { data: leadData, error: leadError } = await serviceClient
    .from('leads')
    .insert({
      source,
      form_type: formType,
      source_detail: sourceDetail,
      external_id: externalId,
      raw: rawFields as Json,
      contact_id: contactId,
      player_id: playerId,
      stage: 'new',
      submitted_at: submittedAt,
    })
    .select('id')
    .single()

  if (leadError) throw new Error(leadError.message)

  await serviceClient.from('activities').insert({
    type: 'lead_created',
    contact_id: contactId,
    player_id: playerId,
    lead_id: leadData.id,
    body: `Lead received from ${source}${formType ? ` (${formType})` : ''}`,
    created_by: null,
  })

  const status = isNewContact ? 'created' : 'merged'

  await serviceClient.from('ingest_log').insert({
    received_at: submittedAt,
    external_id: externalId,
    source,
    form_type: formType,
    status,
    error: null,
    lead_id: leadData.id,
  })

  return {
    external_id: externalId ?? '',
    status,
    lead_id: leadData.id,
    error: null,
  }
}

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

  // Load custom mappings once for all leads in this batch
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
      results.push({
        external_id: lead.external_id ?? '',
        status: 'error',
        lead_id: null,
        error: errMsg,
      })
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
