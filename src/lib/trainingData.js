import { supabase, USER_ID } from './supabase.js';

export const DEFAULT_LOGS = {
  weightLogs: [],
  bodyLogs: [],
  maxHRTest: null,
};

export async function loadTrainingLogs() {
  const { data, error } = await supabase
    .from('training_logs')
    .select('payload')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (error) {
    console.error('loadTrainingLogs failed:', error.message);
    return DEFAULT_LOGS;
  }
  // Merge with defaults so an older stored payload missing a newer field
  // (e.g. maxHRTest, added after the first save) doesn't break destructuring.
  return { ...DEFAULT_LOGS, ...(data?.payload ?? {}) };
}

export async function saveTrainingLogs(payload) {
  const { error } = await supabase
    .from('training_logs')
    .upsert(
      { user_id: USER_ID, payload, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) {
    console.error('saveTrainingLogs failed:', error.message);
    return false;
  }
  return true;
}
