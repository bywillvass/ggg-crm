import { createClient } from '@supabase/supabase-js'

// SERVER-SIDE ONLY. Never import this file from a client component.
export const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
