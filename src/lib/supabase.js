import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Fails loudly rather than silently — a missing env var should be obvious
  // in the browser console, not a confusing blank screen.
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in your .env.local file (dev) or Vercel project settings (production).'
  );
}

export const supabase = createClient(url, key);

// Single-user app — this identifies "your" row in each table.
// Not real auth; fine for a personal single-user tool, not for anything
// where someone else's data could end up in the same table.
export const USER_ID = 'gustavo';
