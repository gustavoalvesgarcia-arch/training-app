// One-time script: pushes SEED_DATA into Supabase's recovery_data table.
// Run once, after setting up your Supabase project and tables, with:
//   node scripts/seed.js
// Requires env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same as
// the app itself — see .env.local).
import { createClient } from '@supabase/supabase-js';
import { SEED_DATA, SEED_LOGS } from '../src/lib/seedData.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Create a .env file with these before running.');
  process.exit(1);
}

const supabase = createClient(url, key);
const USER_ID = 'gustavo';

const { error: recoveryError } = await supabase
  .from('recovery_data')
  .upsert(
    { user_id: USER_ID, payload: SEED_DATA, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

if (recoveryError) {
  console.error('Recovery seed failed:', recoveryError.message);
  process.exit(1);
}
console.log(`Seeded recovery_data: ${SEED_DATA.entries.length} entries, ${SEED_DATA.workouts.length} workouts.`);

const { error: logsError } = await supabase
  .from('training_logs')
  .upsert(
    { user_id: USER_ID, payload: SEED_LOGS, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

if (logsError) {
  console.error('Training logs seed failed:', logsError.message);
  process.exit(1);
}
console.log(`Seeded training_logs: ${SEED_LOGS.bodyLogs.length} body log entries.`);
