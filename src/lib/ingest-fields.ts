// Shared field-mapping logic used by /api/ingest and /api/admin/backfill-players.
// Keep pure (no DB calls, no side effects).

import { parsePhoneNumber } from 'libphonenumber-js'

// ---------------------------------------------------------------------------
// Normalise a form field key: lowercase, keep only a-z0-9
// ---------------------------------------------------------------------------
export function nk(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Title-case a name: trim, collapse spaces, capitalise each word boundary
// ---------------------------------------------------------------------------
export function toTitleCase(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Split "First Last" → ["First", "Last"]
// ---------------------------------------------------------------------------
export function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return [parts[0], '']
  return [parts[0], parts.slice(1).join(' ')]
}

// ---------------------------------------------------------------------------
// Normalise a phone number to E.164 (AU default)
// ---------------------------------------------------------------------------
export function normalizePhone(raw: string): string | null {
  try {
    const parsed = parsePhoneNumber(raw, 'AU')
    if (parsed?.isValid()) return parsed.format('E.164')
  } catch {
    // ignore
  }
  return null
}

// ---------------------------------------------------------------------------
// Built-in field key (normalised) → mapping target
//
// Meta instant form fields are verbose English questions such as
// "What is the player's name?" — nk() strips underscores, spaces and ?
// giving keys like "whatistheplayersname".
// ---------------------------------------------------------------------------
export const BUILTIN: Record<string, string> = {
  // Parent contact — email
  email:                    'contact_email',
  emailaddress:             'contact_email',
  parentemail:              'contact_email',
  guardianemail:            'contact_email',
  // Parent contact — phone
  phone:                    'contact_phone',
  phonenumber:              'contact_phone',
  mobile:                   'contact_phone',
  mobilenumber:             'contact_phone',
  parentphone:              'contact_phone',
  // Parent contact — full name
  fullname:                 'contact_full_name',
  parentname:               'contact_full_name',
  guardianname:             'contact_full_name',
  name:                     'contact_full_name',
  // Parent contact — split name
  firstname:                'contact_first_name',
  parentfirstname:          'contact_first_name',
  lastname:                 'contact_last_name',
  parentlastname:           'contact_last_name',
  surname:                  'contact_last_name',

  // Player name — Meta question style
  whatistheplayersname:     'player_full_name',
  // Player name — generic keys
  playername:               'player_full_name',
  playersname:              'player_full_name',
  playerfullname:           'player_full_name',
  playersfullname:          'player_full_name',
  childname:                'player_full_name',
  childsname:               'player_full_name',
  childfullname:            'player_full_name',
  childsfullname:           'player_full_name',
  kidname:                  'player_full_name',
  kidsname:                 'player_full_name',
  kidfullname:              'player_full_name',
  kidsfullname:             'player_full_name',
  athletename:              'player_full_name',
  athletefullname:          'player_full_name',
  // Player name — split
  playerfirstname:          'player_first_name',
  playersfirstname:         'player_first_name',
  playerfirst:              'player_first_name',
  childfirstname:           'player_first_name',
  childsfirstname:          'player_first_name',
  kidfirstname:             'player_first_name',
  athletefirstname:         'player_first_name',
  playerlastname:           'player_last_name',
  playerslastname:          'player_last_name',
  playerlast:               'player_last_name',
  childlastname:            'player_last_name',
  childslastname:           'player_last_name',
  kidlastname:              'player_last_name',
  athletelastname:          'player_last_name',

  // Birth year — Meta question style
  whatyearwastheplayerborn: 'player_birth_year',
  // Birth year — generic keys
  birthyear:                'player_birth_year',
  yearofbirth:              'player_birth_year',
  playerbirthyear:          'player_birth_year',
  playersbirthyear:         'player_birth_year',
  playersyearofbirth:       'player_birth_year',

  // DOB
  dob:                      'player_dob',
  dateofbirth:              'player_dob',
  birthdate:                'player_dob',
  playerdob:                'player_dob',
  playersdob:               'player_dob',
  playersdateofbirth:       'player_dob',
  childdob:                 'player_dob',
  kiddob:                   'player_dob',

  // Level — Meta question style
  whatleveldoestheplayerplayat: 'player_level',
  // Level — generic keys
  level:                    'player_level',
  league:                   'player_level',
  playerlevel:              'player_level',

  // Club / team
  club:                     'player_club',
  currentclub:              'player_club',
  playerclub:               'player_club',
  team:                     'player_club',
  currentteam:              'player_club',
  playerteam:               'player_club',

  // Position
  position:                 'player_position',
  playerposition:           'player_position',

  // State — Meta question style
  whatstateareyoufrom:      'state',
  // State — generic
  state:                    'state',
  suburb:                   'suburb',
  city:                     'suburb',

  // Message / notes
  message:                  'message',
  comments:                 'message',
  enquiry:                  'message',
  notes:                    'message',

  // Campaign / ad attribution — each stored in its own column
  campaignname:             'campaign_name',
  adsetname:                'adset_name',
  adname:                   'adset_name',
  // form_name overrides the form_type on the lead (e.g. "GGG TO GREECE")
  formname:                 'form_name',
  // Legacy fallback: any custom DB mapping that still uses target='campaign'
  // will be handled by the legacy branch in buildMappedFields.
}

// Normalised keys that indicate the contact is a parent/guardian
export const PARENT_KEYS = new Set([
  'parentname', 'guardianname', 'parentguardianname', 'parentguardian',
  'guardiansname', 'parentemail', 'guardianemail', 'parentguardianemail',
  'parentphone', 'guardianphone', 'parentguardianphone',
  'parentfirstname', 'guardianfirstname', 'parentlastname', 'guardianlastname',
])

export interface MappedFields {
  contact_email?:     string
  contact_phone?:     string
  contact_first_name?: string
  contact_last_name?:  string
  player_first_name?:  string
  player_last_name?:   string
  player_dob?:         string
  player_birth_year?:  string
  player_club?:        string
  player_position?:    string
  player_level?:       string
  suburb?:             string
  state?:              string
  message?:            string
  source_detail?:      string  // legacy: set by target='campaign' custom mappings
  campaign_name?:      string
  adset_name?:         string
  form_name?:          string
}

export type CustomMapping = { source_key: string; target: string; form_type: string | null }

export function buildMappedFields(
  rawFields: Record<string, unknown>,
  customMappings: CustomMapping[],
  formType: string | null | undefined
): { mapped: MappedFields; hasParentField: boolean } {
  // Build lookup: global custom mappings first, then form-specific overwrites
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
      if (!mapped.contact_first_name) mapped.contact_first_name = toTitleCase(fn)
      if (!mapped.contact_last_name && ln) mapped.contact_last_name = toTitleCase(ln)
    } else if (target === 'contact_first_name' && !mapped.contact_first_name) {
      mapped.contact_first_name = toTitleCase(value)
    } else if (target === 'contact_last_name' && !mapped.contact_last_name) {
      mapped.contact_last_name = toTitleCase(value)
    } else if (target === 'player_full_name') {
      const [fn, ln] = splitName(value)
      if (!mapped.player_first_name) mapped.player_first_name = toTitleCase(fn)
      if (!mapped.player_last_name && ln) mapped.player_last_name = toTitleCase(ln)
    } else if (target === 'player_first_name' && !mapped.player_first_name) {
      mapped.player_first_name = toTitleCase(value)
    } else if (target === 'player_last_name' && !mapped.player_last_name) {
      mapped.player_last_name = toTitleCase(value)
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
    } else if (target === 'campaign_name' && !mapped.campaign_name) {
      mapped.campaign_name = value
    } else if (target === 'adset_name' && !mapped.adset_name) {
      mapped.adset_name = value
    } else if (target === 'form_name' && !mapped.form_name) {
      mapped.form_name = value
    } else if (target === 'campaign' && !mapped.source_detail) {
      // Legacy: custom DB mappings that still use target='campaign'
      mapped.source_detail = value
    }
  }

  return { mapped, hasParentField }
}
