import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev instead of silently hitting undefined/undefined.
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your ' +
      'Supabase project URL and anon key (Project Settings -> API).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // This app does its own staff-table login (see AuthContext + the
    // staff_login RPC in supabase/migration_react_client.sql) rather than
    // Supabase Auth, so there is no Supabase session to persist here.
    persistSession: false,
  },
});
