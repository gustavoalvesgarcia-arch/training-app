// Built-in reference list of common gym exercises to pick from when adding or
// replacing an exercise in a session. Static and shared — not user data, so it
// isn't stored in Supabase. IDs for exercises already used in the plan's fixed
// gymSessions (RecoveryView.jsx... actually PlanView.jsx) are kept identical
// here so picking one from the library merges with any history already logged
// against that id, instead of fragmenting it under a new id.
export const EXERCISE_LIBRARY = [
  // Legs
  { id: "front-squat",     name: "Front Squat",             muscle: "Legs", icon: "🦵", sets: 3, reps: "8" },
  { id: "back-squat",      name: "Back Squat",               muscle: "Legs", icon: "🦵", sets: 3, reps: "8" },
  { id: "goblet-squat",    name: "Goblet Squat",             muscle: "Legs", icon: "🦵", sets: 3, reps: "10" },
  { id: "leg-press",       name: "Leg Press",                muscle: "Legs", icon: "🦵", sets: 3, reps: "10" },
  { id: "bss",             name: "Bulgarian Split Squat",    muscle: "Legs / Glutes", icon: "🦵", sets: 3, reps: "8 each" },
  { id: "walking-lunge",   name: "Walking Lunge",            muscle: "Legs", icon: "🦵", sets: 3, reps: "10 each" },
  { id: "step-up",         name: "Step-Up",                  muscle: "Legs", icon: "🦵", sets: 3, reps: "10 each" },
  { id: "leg-extension",   name: "Leg Extension",            muscle: "Legs", icon: "🦵", sets: 3, reps: "12" },
  { id: "calf-raise",      name: "Calf Raise",               muscle: "Legs", icon: "🦵", sets: 3, reps: "15" },

  // Posterior chain
  { id: "rdl",              name: "DB Romanian Deadlift",     muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "10" },
  { id: "sl-rdl",            name: "Single-Leg RDL",           muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "8 each" },
  { id: "conventional-deadlift", name: "Conventional Deadlift", muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "5" },
  { id: "hip-thrust",       name: "Hip Thrust",               muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "10" },
  { id: "good-morning",     name: "Good Morning",             muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "10" },
  { id: "back-extension",   name: "Back Extension",           muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "12" },
  { id: "leg-curl",         name: "Leg Curl",                 muscle: "Posterior chain", icon: "🔙", sets: 3, reps: "12" },

  // Chest
  { id: "incline-press",   name: "Incline DB Press",         muscle: "Chest / Shoulders", icon: "💪", sets: 3, reps: "10" },
  { id: "pushup",          name: "Push-Up (or DB Press)",    muscle: "Chest", icon: "💪", sets: 3, reps: "10–12" },
  { id: "flat-bench-press", name: "Flat Bench Press",        muscle: "Chest", icon: "💪", sets: 3, reps: "8" },
  { id: "flat-db-press",   name: "Flat DB Press",            muscle: "Chest", icon: "💪", sets: 3, reps: "10" },
  { id: "chest-fly",       name: "Chest Fly (DB or Machine)", muscle: "Chest", icon: "💪", sets: 3, reps: "12" },
  { id: "dips",            name: "Dips",                     muscle: "Chest", icon: "💪", sets: 3, reps: "10" },

  // Back
  { id: "cable-row",       name: "Cable Row (or DB Row)",    muscle: "Back", icon: "🫸", sets: 3, reps: "10" },
  { id: "lat-pulldown",    name: "Lat Pulldown",             muscle: "Back / Lats", icon: "🫸", sets: 3, reps: "10" },
  { id: "pull-up",         name: "Pull-Up (or Assisted)",    muscle: "Back / Lats", icon: "🫸", sets: 3, reps: "8" },
  { id: "seated-row",      name: "Seated Cable Row",         muscle: "Back", icon: "🫸", sets: 3, reps: "10" },
  { id: "single-arm-row",  name: "Single-Arm DB Row",        muscle: "Back", icon: "🫸", sets: 3, reps: "10 each" },
  { id: "face-pull",       name: "Face Pull",                muscle: "Back", icon: "🫸", sets: 3, reps: "15" },

  // Shoulders
  { id: "ohp",              name: "Overhead Press (DB)",      muscle: "Shoulders", icon: "⬆️", sets: 3, reps: "10" },
  { id: "lateral-raise",   name: "Lateral Raise",            muscle: "Shoulders", icon: "↔️", sets: 3, reps: "12" },
  { id: "arnold-press",    name: "Arnold Press",             muscle: "Shoulders", icon: "⬆️", sets: 3, reps: "10" },
  { id: "rear-delt-fly",   name: "Rear Delt Fly",            muscle: "Shoulders", icon: "↔️", sets: 3, reps: "12" },
  { id: "upright-row",     name: "Upright Row",              muscle: "Shoulders", icon: "⬆️", sets: 3, reps: "10" },

  // Core
  { id: "plank",           name: "Plank",                    muscle: "Core", icon: "⬛", sets: 3, reps: "30s" },
  { id: "dead-bug",        name: "Dead Bug",                 muscle: "Core", icon: "⬛", sets: 3, reps: "8 each" },
  { id: "side-plank",      name: "Side Plank",               muscle: "Core", icon: "⬛", sets: 3, reps: "30s each" },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise",      muscle: "Core", icon: "⬛", sets: 3, reps: "12" },
  { id: "pallof-press",    name: "Pallof Press",             muscle: "Core", icon: "⬛", sets: 3, reps: "10 each" },
  { id: "russian-twist",   name: "Russian Twist",            muscle: "Core", icon: "⬛", sets: 3, reps: "20" },
  { id: "ab-wheel",        name: "Ab Wheel Rollout",         muscle: "Core", icon: "⬛", sets: 3, reps: "10" },

  // Glutes
  { id: "glute-bridge",    name: "Glute Bridge",             muscle: "Glutes", icon: "🍑", sets: 3, reps: "15" },
  { id: "cable-kickback",  name: "Cable Kickback",           muscle: "Glutes", icon: "🍑", sets: 3, reps: "12 each" },
  { id: "clamshell",       name: "Banded Clamshell",         muscle: "Glutes", icon: "🍑", sets: 3, reps: "15 each" },

  // Arms
  { id: "bicep-curl",      name: "Bicep Curl (DB)",          muscle: "Arms", icon: "💪", sets: 3, reps: "12" },
  { id: "hammer-curl",     name: "Hammer Curl",              muscle: "Arms", icon: "💪", sets: 3, reps: "12" },
  { id: "tricep-pushdown", name: "Tricep Pushdown",          muscle: "Arms", icon: "💪", sets: 3, reps: "12" },
  { id: "overhead-tricep-ext", name: "Overhead Tricep Extension", muscle: "Arms", icon: "💪", sets: 3, reps: "12" },

  // Full body / conditioning
  { id: "kettlebell-swing", name: "Kettlebell Swing",        muscle: "Full Body", icon: "🔄", sets: 3, reps: "15" },
  { id: "burpee",           name: "Burpee",                  muscle: "Full Body", icon: "🔄", sets: 3, reps: "10" },
  { id: "farmers-carry",    name: "Farmer's Carry",          muscle: "Full Body", icon: "🔄", sets: 3, reps: "30m" },
  { id: "battle-ropes",     name: "Battle Ropes",            muscle: "Full Body", icon: "🔄", sets: 3, reps: "30s" },
];

export function searchExercises(query, customExercises = []) {
  const all = [...EXERCISE_LIBRARY, ...customExercises];
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
}
