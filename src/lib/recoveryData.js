import { supabase, USER_ID } from './supabase.js';

export const DEFAULT_DATA = { entries: [], workouts: [] };

export async function loadRecoveryData() {
  const { data, error } = await supabase
    .from('recovery_data')
    .select('payload')
    .eq('user_id', USER_ID)
    .maybeSingle(); // returns null instead of throwing if no row exists yet

  if (error) {
    console.error('loadRecoveryData failed:', error.message);
    return DEFAULT_DATA;
  }
  return data?.payload ?? DEFAULT_DATA;
}

export async function saveRecoveryData(payload) {
  const { error } = await supabase
    .from('recovery_data')
    .upsert(
      { user_id: USER_ID, payload, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) {
    console.error('saveRecoveryData failed:', error.message);
    return false;
  }
  return true;
}
