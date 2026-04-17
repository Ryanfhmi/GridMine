import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing environment variables.\n' +
    'Pastikan file .env di root project berisi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu restart Vite dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
