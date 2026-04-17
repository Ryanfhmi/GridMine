/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js'

// Ganti teks di bawah dengan URL dan Key dari Notepad Anda!
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);