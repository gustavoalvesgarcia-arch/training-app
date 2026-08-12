import { useState, useMemo, useEffect, useRef } from "react";
import { loadTrainingLogs, saveTrainingLogs, DEFAULT_LOGS } from "../lib/trainingData.js";
import { EXERCISE_LIBRARY, searchExercises } from "../lib/exerciseLibrary.js";
import { isGoodvibesCsv, parseGoodvibesCsv, mergeGoodvibesEntries } from "../lib/goodvibesImport.js";
import { INK, SURFACE, SURFACE2, BORDER, PAPER, MUTE, GREEN, AMBER, RED, BLUE, DISPLAY, MONO, BODY } from "../lib/theme.js";

// ── Plan data ─────────────────────────────────────────────────────────────
const gymSessions = {
  "A-base": {
    label: "Gym A — Full Body", duration: "~60 min (incl. finisher)",
    focus: "Compound foundation. Squat pattern, push, pull, hinge.",
    warmup: "5 min row or bike + 2×10 bodyweight squat + arm circles",
    tempo: "Straight sets, no supersets — keep rest to 60–75s between sets to stay on time.",
    exercises: [
      { id: "front-squat",     name: "Front Squat",             sets: 3, reps: "8",  muscle: "Legs",               icon: "🦵", note: "Swapped from Goblet Squat (29 Jun). Started at 40kg — adjust by feel, prioritise depth and bracing over load early on." },
      { id: "rdl",             name: "DB Romanian Deadlift",    sets: 3, reps: "10", muscle: "Posterior chain",     icon: "🔙", note: "Hip hinge, soft knees, flat back." },
      { id: "incline-press",   name: "Incline DB Press",        sets: 3, reps: "10", muscle: "Chest / Shoulders",   icon: "💪", note: "60% effort. Full range." },
      { id: "cable-row",       name: "Cable Row (or DB Row)",   sets: 3, reps: "10", muscle: "Back",                icon: "🫸", note: "Retract scapula. No jerking." },
      { id: "ohp",             name: "Overhead Press (DB)",     sets: 3, reps: "10", muscle: "Shoulders",           icon: "⬆️", note: "Core braced. Don't flare ribs." },
      { id: "plank",           name: "Plank",                   sets: 3, reps: "30s", muscle: "Core",               icon: "⬛", note: "Rest 45s between. Quality over duration." },
    ],
    finisher: "5 min, moderate-hard, continuous — whichever's free: kettlebell swings, rowing machine, incline treadmill walk, or stationary bike. Not a max-effort test, just steady work to close out the session.",
    cooldown: "5 min walk + hip flexor stretch + thoracic rotation",
    progression: "Add 2.5kg per movement when you complete all reps with clean form for 2 consecutive sessions.",
  },
  "B-base": {
    label: "Gym B — Full Body (Variation)", duration: "~60 min (incl. finisher)",
    focus: "Same patterns, different angles. Unilateral work.",
    warmup: "5 min walk + 2×10 hip circle + banded clamshell",
    tempo: "Straight sets, no supersets — keep rest to 60–75s between sets to stay on time.",
    exercises: [
      { id: "bss",             name: "Bulgarian Split Squat",   sets: 3, reps: "8 each", muscle: "Legs / Glutes",   icon: "🦵", note: "Bodyweight or light DB. Back foot elevated." },
      { id: "sl-rdl",          name: "Single-Leg RDL",          sets: 3, reps: "8 each", muscle: "Posterior chain", icon: "🔙", note: "Light. Balance > load." },
      { id: "pushup",          name: "Push-Up (or DB Press)",   sets: 3, reps: "10–12", muscle: "Chest",            icon: "💪", note: "Full range. No partial reps." },
      { id: "lat-pulldown",    name: "Lat Pulldown",            sets: 3, reps: "10", muscle: "Back / Lats",         icon: "🫸", note: "Pull to chin. No swinging." },
      { id: "lateral-raise",   name: "Lateral Raise",           sets: 3, reps: "12", muscle: "Shoulders",           icon: "↔️", note: "Light. Controlled lowering." },
      { id: "dead-bug",        name: "Dead Bug",                sets: 3, reps: "8 each", muscle: "Core",            icon: "⬛", note: "Slow. Lower back stays on floor." },
    ],
    finisher: "5 min, moderate-hard, continuous — whichever's free: kettlebell swings, rowing machine, incline treadmill walk, or stationary bike. Not a max-effort test, just steady work to close out the session.",
    cooldown: "Pigeon stretch 60s each side + chest opener + hamstring stretch",
    progression: "If split squat feels unstable, regress to reverse lunge.",
  },
};

const gymSessionMap = {
  "1-Mon": "A-base", "1-Thu": "B-base",
  "2-Mon": "A-base", "2-Thu": "B-base",
  "3-Mon": "A-base", "3-Thu": "B-base",
  "4-Mon": "A-base", "4-Thu": "B-base",
  "5-Mon": "A-base", "5-Thu": "B-base",
  "6-Mon": "A-base", "6-Thu": "B-base",
  "7-Mon": "A-base", "7-Thu": "B-base",
  "8-Mon": "A-base", "8-Sat": "A-base",
  // Week 9's Mon is "Bodyweight A" (no gym access) — intentionally not mapped, uses its own detail text
  "10-Thu": "A-base",
  "11-Mon": "B-base",
  "12-Mon": "A-base",
  "13-Mon": "B-base",
  "14-Mon": "A-base",
};


const plan = {
  weeks: [
    { week: 1, focus: "Establish rhythm", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Run/Walk",    intensity: "low",    detail: "25 min · 3 min run / 2 min walk · HR <145 bpm" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Walk or stretch." },
      { day: "Thu", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Fri", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · Conversational pace" },
      { day: "Sat", type: "rest", label: "Rest",        intensity: "rest",   detail: "Optional 30 min walk." },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 2, focus: "Build duration", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Run/Walk",    intensity: "low",    detail: "28 min · 4 min run / 2 min walk · HR <145 bpm" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Rest or 20 min walk." },
      { day: "Thu", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Fri", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · Pure conversational pace" },
      { day: "Sat", type: "rest", label: "Rest",        intensity: "rest",   detail: "Optional walk." },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 3, focus: "Introduce intervals + 3rd run", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Intervals",   intensity: "high",   detail: "30 min · 5 min warmup · 6×(90s hard / 90s walk)" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Non-negotiable rest after intervals." },
      { day: "Thu", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Fri", type: "run",  label: "Long Easy",   intensity: "low",    detail: "30 min easy · Walk if needed" },
      { day: "Sat", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · HR below 130 · Pure Z2 · Visceral fat session" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 4, focus: "Deload — −20% volume", days: [
      { day: "Mon", type: "gym",  label: "Gym A ↓",    intensity: "low",    detail: null },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · No intervals this week" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "gym",  label: "Gym B ↓",    intensity: "low",    detail: null },
      { day: "Fri", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · Maintain the habit" },
      { day: "Sat", type: "run",  label: "Easy Run",    intensity: "low",    detail: "15 min easy · Deload volume — shorter than usual · HR below 130" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 5, focus: "Push running duration", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Run/Walk",    intensity: "low",    detail: "35 min · 6 min run / 1 min walk" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Rest or easy walk." },
      { day: "Thu", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Fri", type: "run",  label: "Intervals",   intensity: "high",   detail: "30 min · 5 min warmup · 8×(2 min hard / 90s walk)" },
      { day: "Sat", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · HR below 130 · Recovery from Friday intervals" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 6, focus: "First 20 min continuous run", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Continuous",  intensity: "medium", detail: "20 min continuous · Walk only if HR >160" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Rest." },
      { day: "Thu", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Fri", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · Recovery run" },
      { day: "Sat", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · HR below 130 · Conversational pace only" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 7, focus: "Extend continuous running", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Continuous",  intensity: "medium", detail: "25 min continuous · No walk breaks" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Rest." },
      { day: "Thu", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Fri", type: "run",  label: "Intervals",   intensity: "high",   detail: "35 min · 10×(2 min hard / 60s walk) · HR into Z4" },
      { day: "Sat", type: "run",  label: "Easy Run",    intensity: "low",    detail: "30 min easy · HR below 130 · Longest easy run to date · Build aerobic base" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 8, focus: "5k continuous — milestone", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · Taper before 5k" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest. Sleep well." },
      { day: "Thu", type: "run",  label: "5k 🏁",       intensity: "high",   detail: "Run 5k continuously · Slow pace is fine · Note your time" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Rest. You earned it." },
      { day: "Sat", type: "gym",  label: "Gym (opt)",   intensity: "low",    detail: null },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 9, focus: "Consolidate at 5k — no distance increase yet · no gym access", days: [
      { day: "Mon", type: "gym",  label: "Bodyweight A", intensity: "medium", detail: "No gym this week — bodyweight circuit instead: 3× (15 squats, 10 push-ups, 12 walking lunges/leg, 30s plank, 15 glute bridges). Rest 60-90s between rounds. Keeps the strength stimulus without equipment." },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · HR below 140" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "run",  label: "5k Repeat",   intensity: "medium", detail: "Run 5k continuously again · Aim for a steadier pace than Week 8, not necessarily faster" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Sat", type: "run",  label: "Max HR Test",  intensity: "high",   detail: "10 min easy warmup · then 3 min progressively harder to a final all-out 60-90s effort · walk to full recovery after · Note the highest HR reached — this replaces the assumed 185 max used for all current zones" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 10, focus: "Reset week — HRV recovery first, capability re-baseline", days: [
      { day: "Mon", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest. HRV was still below baseline as of Aug 6 after 2 weeks of holiday volume (incl. swimming/extra walking not in this plan) — prioritise recovery over training stimulus this week." },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min genuinely easy · HR below 135 · gauge how the body feels, not a fitness test" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "gym",  label: "Gym A",       intensity: "low",    detail: "Light session, first gym in 2+ weeks — don't chase pre-holiday weights, rebuild from a lower load." },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Sat", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25-30 min easy · Recovery confirmed strong as of Aug 8 (RHR 49, HRV 108, best deep sleep of the program) — this run can be a normal easy pace rather than an extra-cautious feel-it-out session. Still no need to push." },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest. Recovery checkpoint passed on Aug 8 — RHR and HRV both back to/above pre-holiday baseline. Week 11 proceeds as scheduled, no extension needed." },
    ]},
    { week: 11, focus: "Resume progression from actual current level, not original Week 11 targets", days: [
      { day: "Mon", type: "gym",  label: "Gym B",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · HR below 140" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "run",  label: "Tempo",       intensity: "medium", detail: "25 min · middle 10 min at a steady, comfortably-hard pace — real fitness has moved past where this was originally calibrated, so this may feel easier than expected" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Sat", type: "run",  label: "Long Run",    intensity: "medium", detail: "7k continuous · easy conversational pace · holiday running already proved 10k+ is achievable, so this is a controlled step, not a stretch" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 12, focus: "Long run → 8k · intervals return", days: [
      { day: "Mon", type: "gym",  label: "Gym A",       intensity: "medium", detail: null },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "25 min easy · HR below 140" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "run",  label: "Intervals",   intensity: "high",   detail: "30 min · 6×2 min hard / 90s walk · first intervals since before the holiday — recheck how it feels against pre-holiday sessions, don't assume it'll feel identical" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Sat", type: "run",  label: "Long Run",    intensity: "medium", detail: "8k continuous · easy conversational pace · matches what was already run unplanned on holiday, now done deliberately with a taper into it" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 13, focus: "Deload — −20% volume before peak week", days: [
      { day: "Mon", type: "gym",  label: "Gym B ↓",     intensity: "low",    detail: null },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · light week" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · no intervals this week" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Sat", type: "run",  label: "Long Run ↓",  intensity: "low",    detail: "6k continuous · deload distance, easy pace · absorb Weeks 11-12 before the final build" },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 14, focus: "Peak week → 9k, then begin taper", days: [
      { day: "Mon", type: "gym",  label: "Gym (light)", intensity: "low",    detail: "Last gym session before the race — keep it light, no new exercises, no heavy loads." },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · HR below 140" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "run",  label: "Easy Run",    intensity: "low",    detail: "20 min easy · short, sharp, nothing heroic" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Sat", type: "run",  label: "Peak Long Run", intensity: "medium", detail: "9k continuous · easy pace · this is the longest deliberately-paced run before race day. Note: holiday running already proved 10k+ is physically achievable — the point here isn't testing capability, it's rehearsing race-week pacing discipline. Do not try to run it fast." },
      { day: "Sun", type: "rest", label: "Off",         intensity: "rest",   detail: "Full rest." },
    ]},
    { week: 15, focus: "Race week — taper · 10k on Sunday 13 Sep", days: [
      { day: "Mon", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest. Taper has started — less is more this week." },
      { day: "Tue", type: "run",  label: "Easy Run",    intensity: "low",    detail: "15 min very easy · just to keep legs moving, nothing more" },
      { day: "Wed", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest." },
      { day: "Thu", type: "run",  label: "Shakeout",    intensity: "low",    detail: "10 min very easy with 3×20s light strides · primes the legs without creating fatigue" },
      { day: "Fri", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest. Hydrate well, sleep well — this matters more than any training stimulus now." },
      { day: "Sat", type: "rest", label: "Rest",        intensity: "rest",   detail: "Full rest. Light stretching only. Prepare race kit, plan logistics, eat a carb-comfortable dinner." },
      { day: "Sun", type: "run",  label: "RACE DAY 🏁🎉", intensity: "high",  detail: "10k. Start controlled — you have trained for this distance, the goal is to finish strong, not to set a personal best on pace alone." },
    ]},
  ],
};

// Week 1 starts Monday 1 Jun 2026 — derived from the race day (Week 15's Sunday, 13 Sep 2026).
const WEEK1_MONDAY = new Date("2026-06-01T00:00:00");
function getCurrentWeekIndex() {
  const daysSince = Math.floor((new Date() - WEEK1_MONDAY) / 86400000);
  const idx = Math.floor(daysSince / 7);
  return Math.max(0, Math.min(plan.weeks.length - 1, idx));
}

// ── View-specific color maps (uses shared theme tokens from import) ───────
const typeColor = {
  gym:  { bg: "#171a2e", border: BLUE, text: "#a8b3f0", dot: BLUE },
  run:  { bg: "#122019", border: GREEN, text: GREEN, dot: GREEN },
  rest: { bg: SURFACE2, border: BORDER, text: MUTE, dot: BORDER },
};
const intColor = { low: GREEN, medium: AMBER, high: RED, rest: BORDER };
const muscleColor = {
  "Legs": "#B48CE0", "Posterior chain": "#E8873D", "Chest / Shoulders": BLUE,
  "Shoulders": "#4DBFC4", "Back": "#D9739F", "Back / Lats": "#D9739F",
  "Core": MUTE, "Legs / Glutes": "#B48CE0", "Chest": BLUE,
  "Glutes": "#EC7FAE", "Arms": "#60A5FA", "Full Body": "#E8A83D",
};
const MUSCLE_GROUPS = ["Legs", "Posterior chain", "Chest", "Chest / Shoulders", "Back", "Back / Lats", "Shoulders", "Core", "Glutes", "Legs / Glutes", "Arms", "Full Body"];

// ── Exercise overrides ───────────────────────────────────────────────────
// Resolves the effective exercise list for one session instance by layering
// permanent per-session-type overrides first, then one-off overrides scoped
// to this exact date on top — so a same-day edit can even override a
// standing permanent swap. Each resolved exercise is tagged with where it
// came from (_source/_replacedId) so the UI can show a badge + one-click undo.
function resolveExercises(baseExercises, sessionKey, date, sessionOverrides, dayOverrides) {
  let list = baseExercises.map(e => ({ ...e, _source: "base" }));

  function apply(ov, scope) {
    if (!ov) return;
    if (ov.removedIds?.length) list = list.filter(e => !ov.removedIds.includes(e.id));
    if (ov.replacements) {
      list = list.map(e => {
        const repl = ov.replacements[e.id];
        return repl ? { ...repl, _source: `replaced-${scope}`, _replacedId: e.id, _replacedName: e.name } : e;
      });
    }
    if (ov.added?.length) list = [...list, ...ov.added.map(e => ({ ...e, _source: `added-${scope}` }))];
  }
  apply(sessionOverrides[sessionKey], "permanent");
  apply(dayOverrides[date], "day");
  return list;
}

function makeCustomExerciseId(name) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `custom-${slug || "exercise"}-${Date.now().toString(36)}`;
}

// ── Components ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", small, full }) {
  const s = {
    primary:   { background: GREEN, color: INK, border: "none" },
    secondary: { background: "transparent", color: MUTE, border: `1px solid ${BORDER}` },
    success:   { background: GREEN, color: INK, border: "none" },
    danger:    { background: "transparent", color: RED, border: `1px solid ${RED}` },
    ghost:     { background: SURFACE2, color: MUTE, border: `1px solid ${BORDER}` },
  };
  return (
    <button onClick={onClick} style={{ ...s[variant], borderRadius: 3, padding: small ? "5px 10px" : "9px 16px", fontSize: small ? 11 : 13, fontFamily: DISPLAY, fontWeight: 700, cursor: "pointer", width: full ? "100%" : undefined, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.target.style.opacity = "0.8"} onMouseLeave={e => e.target.style.opacity = "1"}>
      {children}
    </button>
  );
}

function InputField({ label, value, onChange, type = "number", placeholder, unit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, color: MUTE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1 }}>{label}{unit ? ` (${unit})` : ""}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: INK, border: `1px solid ${BORDER}`, borderRadius: 3, padding: "7px 9px", color: PAPER, fontSize: 13, fontFamily: MONO, outline: "none", width: "100%" }} />
    </div>
  );
}

// Modal: search the built-in library / custom exercises, or define a new one,
// then choose whether the change applies just to this date or every time this
// session type comes up. Used both for "+ Add exercise" (mode="add", no
// target) and per-row "⇄ Replace" (mode="replace", target = exercise being swapped).
function ExercisePicker({ mode, target, customExercises, onCreateCustom, onConfirm, onRemove, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // exercise object, or {_remove:true}
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState(MUSCLE_GROUPS[0]);

  const results = useMemo(() => searchExercises(query, customExercises), [query, customExercises]);

  function createCustom() {
    if (!customName.trim()) return;
    const ex = { id: makeCustomExerciseId(customName), name: customName.trim(), muscle: customMuscle, icon: "🏋️", sets: 3, reps: "10" };
    onCreateCustom(ex);
    setSelected(ex);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#151a16", border: `1px solid ${BORDER}`, borderRadius: "16px 16px 0 0", padding: 20, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto", animation: "up 0.2s ease" }}>

        {!selected ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              {mode === "replace" ? `Replace ${target.name}` : "Add an exercise"}
            </div>
            <div style={{ fontSize: 11, color: MUTE, marginBottom: 14 }}>
              {mode === "replace" ? "Pick a substitute, or remove it without replacing." : "Search the exercise library, or add your own."}
            </div>
            <InputField label="Search" value={query} onChange={setQuery} type="text" placeholder="e.g. lunge, shoulders…" />

            <div style={{ marginTop: 12, maxHeight: 260, overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: 3 }}>
              {results.length === 0 ? (
                <div style={{ padding: 14, fontSize: 12, color: MUTE, textAlign: "center" }}>No matches — add it as a custom exercise below.</div>
              ) : results.map(ex => {
                const mc = muscleColor[ex.muscle] || "#8A8578";
                return (
                  <div key={ex.id} onClick={() => setSelected(ex)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}>
                    <span style={{ fontSize: 15 }}>{ex.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "#EDEAE2" }}>{ex.name}</span>
                    <span style={{ fontSize: 9, background: `${mc}22`, color: mc, padding: "2px 7px", borderRadius: 3, fontFamily: MONO, whiteSpace: "nowrap" }}>{ex.muscle}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, color: MUTE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Can't find it? Add your own</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <InputField label="Name" value={customName} onChange={setCustomName} type="text" placeholder="e.g. Trap Bar Deadlift" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 9, color: MUTE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1 }}>Muscle</label>
                  <select value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}
                    style={{ background: INK, border: `1px solid ${BORDER}`, borderRadius: 3, padding: "7px 9px", color: PAPER, fontSize: 13, fontFamily: MONO }}>
                    {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <Btn onClick={createCustom} variant="secondary" small>+ Add custom exercise</Btn>
            </div>

            {mode === "replace" && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                <Btn onClick={() => setSelected({ _remove: true })} variant="danger" small full>🗑 Remove without replacement</Btn>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <Btn onClick={onClose} variant="secondary" small full>Cancel</Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              {selected._remove ? `Remove ${target.name}` : mode === "replace" ? `Replace with ${selected.name}` : `Add ${selected.name}`}
            </div>
            <div style={{ fontSize: 11, color: MUTE, marginBottom: 16 }}>How long should this change apply?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn onClick={() => (selected._remove ? onRemove("day") : onConfirm(selected, "day"))} variant="success" full>Just this session (today)</Btn>
              <Btn onClick={() => (selected._remove ? onRemove("permanent") : onConfirm(selected, "permanent"))} variant="primary" full>Every time — permanent</Btn>
              <Btn onClick={() => setSelected(null)} variant="secondary" small full>← Back</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Weight log panel for a single exercise
function ExerciseRow({ ex, weekNum, sessionDate, logs, onLog, onReplace, onUndo }) {
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const mc = muscleColor[ex.muscle] || "#8A8578";
  const isOverride = ex._source && ex._source !== "base";
  const isDayScoped = ex._source?.endsWith("-day");
  const badgeLabel = ex._source === "replaced-day" ? `swapped in for ${ex._replacedName} · today`
    : ex._source === "replaced-permanent" ? `swapped in for ${ex._replacedName}`
    : ex._source === "added-day" ? "added · today"
    : ex._source === "added-permanent" ? "added" : null;

  // History for this exercise
  const history = useMemo(() =>
    logs.filter(l => l.exerciseId === ex.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  , [logs, ex.id]);

  const lastEntry = history[0];

  function submit() {
    if (!weight && !reps) return;
    onLog({
      id: Date.now(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      date: sessionDate || new Date().toISOString().slice(0, 10),
      week: weekNum,
      sets: sets ? Number(sets) : ex.sets,
      reps: reps || ex.reps,
      weight_kg: weight ? Number(weight) : null,
    });
    setWeight(""); setReps(""); setSets("");
    setLogOpen(false);
  }

  return (
    <div style={{ borderBottom: "1px solid #252b25" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 28, height: 28, borderRadius: 3, background: "#151a16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{ex.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#EDEAE2" }}>{ex.name}</div>
          <div style={{ fontSize: 11, color: "#8A8578" }}>{ex.sets}×{ex.reps}{lastEntry ? ` · last: ${lastEntry.weight_kg ? lastEntry.weight_kg + "kg" : "BW"} ×${lastEntry.reps}` : ""}</div>
          {badgeLabel && (
            <div style={{ fontSize: 9, color: isDayScoped ? AMBER : BLUE, fontFamily: MONO, marginTop: 2 }}>↺ {badgeLabel}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, background: `${mc}22`, color: mc, padding: "2px 7px", borderRadius: 3, fontFamily: "'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{ex.muscle}</span>
          <button onClick={e => { e.stopPropagation(); setLogOpen(l => !l); }} style={{ background: GREEN, border: "none", borderRadius: 3, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}>+ Log</button>
          {isOverride ? (
            <button onClick={e => { e.stopPropagation(); onUndo(); }} title="Undo" style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 3, color: "#8A8578", fontSize: 11, padding: "4px 7px", cursor: "pointer", flexShrink: 0 }}>↺</button>
          ) : (
            <button onClick={e => { e.stopPropagation(); onReplace(); }} title="Replace" style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 3, color: "#8A8578", fontSize: 11, padding: "4px 7px", cursor: "pointer", flexShrink: 0 }}>⇄</button>
          )}
          <span style={{ fontSize: 12, color: "#8A8578", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>

      {/* Coaching note */}
      {open && (
        <div style={{ background: "#151a16", borderRadius: 3, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "#A8A398", lineHeight: 1.6 }}>
          {ex.note && <><strong style={{ color: "#EDEAE2" }}>Note:</strong> {ex.note}</>}
          {history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Recent sets</div>
              {history.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8A8578", marginBottom: 3 }}>
                  <span>{h.date}</span>
                  <span style={{ color: "#A8A398" }}>W{h.week} · {h.sets}×{h.reps} {h.weight_kg ? `@ ${h.weight_kg}kg` : "BW"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log form */}
      {logOpen && (
        <div style={{ background: "#252b25", borderRadius: 3, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A398", marginBottom: 10, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>Log this set</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <InputField label="Weight" value={weight} onChange={setWeight} unit="kg" placeholder={lastEntry?.weight_kg || "BW"} />
            <InputField label="Sets" value={sets} onChange={setSets} placeholder={String(ex.sets)} />
            <InputField label="Reps" value={reps} onChange={setReps} type="text" placeholder={ex.reps} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={submit} variant="success" small>Save</Btn>
            <Btn onClick={() => setLogOpen(false)} variant="secondary" small>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function GymSession({ sessionKey, weekNum, sessionDate, logs, onLog, customExercises, sessionOverrides, dayOverrides, onAddExercise, onUndoAddExercise, onReplaceExercise, onUndoReplace, onRemoveExercise, onCreateCustomExercise }) {
  const [picker, setPicker] = useState(null); // { mode: "add"|"replace", target?: exercise }
  const s = gymSessions[sessionKey];
  if (!s) return <div style={{ color: "#8A8578", fontSize: 13 }}>Session details not found.</div>;

  const exercises = resolveExercises(s.exercises, sessionKey, sessionDate, sessionOverrides, dayOverrides);

  // Rows only ever offer "undo" once they're already an override (base rows offer
  // "replace" instead), so this always targets a replaced-* or added-* exercise.
  function undo(ex) {
    const scope = ex._source.endsWith("-day") ? "day" : "permanent";
    if (ex._source.startsWith("replaced")) onUndoReplace(scope, ex._replacedId);
    else onUndoAddExercise(scope, ex.id);
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: GREEN, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>{s.duration}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#EDEAE2", marginTop: 2 }}>{s.label}</div>
        <div style={{ fontSize: 12, color: "#8A8578", marginTop: 3 }}>{s.focus}</div>
        {s.tempo && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4, fontStyle: "italic" }}>{s.tempo}</div>}
      </div>
      <div style={{ background: "#151a16", borderRadius: 3, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#818cf8" }}>
        <strong>Warm-up:</strong> {s.warmup}
      </div>
      <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Exercises</div>
      <div style={{ background: "#131c2e", border: "1px solid #252b25", borderRadius: 3, padding: "0 12px" }}>
        {exercises.map((ex, i) => (
          <ExerciseRow key={ex.id + "-" + i} ex={ex} weekNum={weekNum} sessionDate={sessionDate} logs={logs} onLog={onLog}
            onReplace={() => setPicker({ mode: "replace", target: ex })}
            onUndo={() => undo(ex)} />
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <Btn onClick={() => setPicker({ mode: "add" })} variant="secondary" small>+ Add exercise</Btn>
      </div>
      {s.finisher && (
        <div style={{ background: "#2a1a0f", border: "1px solid #78350f", borderRadius: 3, padding: "8px 12px", marginTop: 10, fontSize: 12, color: "#fdba74" }}>
          <strong>Finisher:</strong> {s.finisher}
        </div>
      )}
      <div style={{ background: "#151a16", borderRadius: 3, padding: "8px 12px", marginTop: 10, fontSize: 12, color: "#a78bfa" }}>
        <strong>Cool-down:</strong> {s.cooldown}
      </div>
      <div style={{ background: "#064e3b", borderRadius: 3, padding: "8px 12px", marginTop: 6, fontSize: 12, color: "#6ee7b7" }}>
        <strong>Progression:</strong> {s.progression}
      </div>

      {picker && (
        <ExercisePicker
          mode={picker.mode}
          target={picker.target}
          customExercises={customExercises}
          onCreateCustom={onCreateCustomExercise}
          onClose={() => setPicker(null)}
          onConfirm={(exercise, scope) => {
            if (picker.mode === "replace") onReplaceExercise(scope, picker.target.id, exercise);
            else onAddExercise(scope, exercise);
            setPicker(null);
          }}
          onRemove={(scope) => { onRemoveExercise(scope, picker.target.id); setPicker(null); }}
        />
      )}
    </div>
  );
}

// ── Progression chart for one exercise ───────────────────────────────────
function ProgressionChart({ logs }) {
  const exercises = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (l.weight_kg) {
        if (!map[l.exerciseName]) map[l.exerciseName] = [];
        map[l.exerciseName].push({ date: l.date, kg: l.weight_kg, week: l.week });
      }
    });
    return Object.entries(map).filter(([, v]) => v.length >= 2).map(([name, entries]) => ({
      name,
      entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [logs]);

  const [selected, setSelected] = useState(null);
  const active = selected ? exercises.find(e => e.name === selected) : exercises[0];

  if (!exercises.length) return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A8578" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#A8A398", marginBottom: 4 }}>No progression data yet</div>
      <div style={{ fontSize: 12 }}>Log weights in at least 2 sessions for an exercise to see its trend</div>
    </div>
  );

  const vals = active ? active.entries.map(e => e.kg) : [];
  const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1;
  const latest = vals[vals.length - 1];
  const first = vals[0];
  const gained = latest - first;

  return (
    <div>
      {/* Exercise picker */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {exercises.map((e, i) => (
          <button key={i} onClick={() => setSelected(e.name)}
            style={{ padding: "5px 12px", borderRadius: 20, border: "1.5px solid", borderColor: (selected || exercises[0]?.name) === e.name ? GREEN : "#252b25", background: (selected || exercises[0]?.name) === e.name ? GREEN : "transparent", color: (selected || exercises[0]?.name) === e.name ? "#fff" : "#8A8578", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", cursor: "pointer" }}>
            {e.name}
          </button>
        ))}
      </div>

      {active && (
        <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#EDEAE2" }}>{active.name}</div>
              <div style={{ fontSize: 11, color: "#8A8578", marginTop: 2 }}>{active.entries.length} sessions logged</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: gained >= 0 ? GREEN : RED }}>{latest}kg</div>
              <div style={{ fontSize: 11, color: gained >= 0 ? GREEN : RED, fontFamily: "'IBM Plex Mono',monospace" }}>
                {gained >= 0 ? "+" : ""}{gained.toFixed(1)}kg from start
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <svg width="100%" height={60} viewBox="0 0 100 60" preserveAspectRatio="none" style={{ marginBottom: 8 }}>
            <polyline
              points={vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${54 - ((v - min) / range) * 48}`).join(" ")}
              fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round"
            />
            {vals.map((v, i) => (
              <circle key={i} cx={(i / (vals.length - 1)) * 100} cy={54 - ((v - min) / range) * 48} r={3}
                fill={i === vals.length - 1 ? GREEN : "#252b25"} stroke={GREEN} strokeWidth={1.5} />
            ))}
          </svg>

          {/* Session history */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...active.entries].reverse().slice(0, 6).map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #252b25" }}>
                <span style={{ color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>{e.date}</span>
                <span style={{ fontWeight: 700, color: "#EDEAE2" }}>W{e.week} · {e.kg}kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Body composition log ──────────────────────────────────────────────────
// Compute linear regression slope over last N entries to determine trend
function trendSlope(vals) {
  if (vals.length < 2) return 0;
  const n = vals.length;
  const meanX = (n - 1) / 2;
  const meanY = vals.reduce((a, b) => a + b, 0) / n;
  const num = vals.reduce((sum, y, x) => sum + (x - meanX) * (y - meanY), 0);
  const den = vals.reduce((sum, _, x) => sum + (x - meanX) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

function TrendArrow({ slope, goodDirection, size = 14 }) {
  // goodDirection: "down" means falling is good (weight, BF, fat mass)
  //                "up"   means rising is good (lean mass)
  const threshold = 0.03; // ignore noise below this per-day change
  const isUp   = slope > threshold;
  const isDown = slope < -threshold;
  const isFlat = !isUp && !isDown;

  let arrow, color;
  if (isFlat) {
    arrow = "→"; color = "#8A8578";
  } else if (isUp) {
    arrow = "↑";
    color = goodDirection === "up" ? GREEN : RED;
  } else {
    arrow = "↓";
    color = goodDirection === "down" ? GREEN : RED;
  }

  const absSlope = Math.abs(slope);
  const label = isFlat ? "stable"
    : absSlope > 0.2 ? "fast"
    : absSlope > 0.08 ? "moderate"
    : "slow";

  return (
    <span title={`${label} ${isUp ? "increase" : isDown ? "decrease" : "change"} (${slope.toFixed(3)}/day)`}
      style={{ fontSize: size, fontWeight: 800, color, marginLeft: 4, lineHeight: 1 }}>
      {arrow}
    </span>
  );
}

const COMPOSITION_SHIFT_DATE = "2026-07-08"; // scale's BF%/muscle calculation changed around this date — confirmed via 3+ consistent readings in chat, cause unresolved with Goodvibes

function MaxHRTestLog({ result, onLog }) {
  const [val, setVal] = useState("");
  if (result) {
    const newZones = calcZones(result.observedMaxHR);
    return (
      <div style={{ marginTop: 14, background: "#052e16", border: "1px solid #166534", borderRadius: 3, padding: 12 }}>
        <div style={{ fontSize: 11, color: "#86efac", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", marginBottom: 4 }}>Result logged · {result.date}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f0fdf4" }}>{result.observedMaxHR} bpm</div>
        <div style={{ fontSize: 11, color: "#86efac", marginTop: 6 }}>Recalculated zones (was: Z1&lt;111 · Z2 111-129 · Z3 130-147 · Z4 148-166 · Z5≥167, assuming max 185):</div>
        <div style={{ fontSize: 11, color: "#f0fdf4", fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>
          Z1&lt;{newZones.z1} · Z2 {newZones.z1}-{newZones.z2} · Z3 {newZones.z2+1}-{newZones.z3} · Z4 {newZones.z3+1}-{newZones.z4} · Z5≥{newZones.z4+1}
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-end" }}>
      <InputField label="Highest HR reached" value={val} onChange={setVal} unit="bpm" placeholder="e.g. 178" />
      <Btn small variant="success" onClick={() => { if (val) { onLog({ date: new Date().toISOString().slice(0,10), observedMaxHR: Number(val) }); setVal(""); } }}>Log result</Btn>
    </div>
  );
}

function calcZones(maxHR) {
  // Same % boundaries as the current 185-based zones (~60%, 70%, 80%, 90%)
  return {
    z1: Math.round(maxHR*0.60),
    z2: Math.round(maxHR*0.70),
    z3: Math.round(maxHR*0.80),
    z4: Math.round(maxHR*0.90),
  };
}

function BodyLog({ logs, onLog, onDelete }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), weight: "", bf: "", lean: "", muscle: "", visceral: "", bmr: "", water: "", bmi: "", subq: "", bone: "" });
  const [adding, setAdding] = useState(false);

  // Sort ascending for trend calc, descending for display
  const sortedAsc  = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const sorted     = [...sortedAsc].reverse();
  const latest     = sorted[0];
  const lowest     = logs.length ? logs.reduce((a, b) => b.weight < a.weight ? b : a, logs[0]) : null;

  // Last 10 days of data for trend (by date, not count)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recent = sortedAsc.filter(r => r.date >= cutoffStr);
  const trendStraddlesShift = recent.length && recent[0].date < COMPOSITION_SHIFT_DATE && recent[recent.length-1].date >= COMPOSITION_SHIFT_DATE;

  const weightSlope   = trendSlope(recent.filter(r => r.weight).map(r => r.weight));
  const bfSlope       = trendSlope(recent.filter(r => r.bf).map(r => r.bf));
  const leanSlope     = trendSlope(recent.filter(r => r.lean).map(r => r.lean));
  const fatMassSlope  = trendSlope(
    recent.filter(r => r.weight && r.bf).map(r => r.weight * r.bf / 100)
  );

  // Per-row delta vs previous entry
  function delta(field, currentIdx) {
    const prev = sorted[currentIdx + 1];
    if (!prev || !sorted[currentIdx][field] || !prev[field]) return null;
    return sorted[currentIdx][field] - prev[field];
  }

  function DeltaBadge({ val, goodDirection }) {
    if (val === null || val === undefined) return null;
    const isGood = goodDirection === "down" ? val < -0.01 : val > 0.01;
    const isNeutral = Math.abs(val) <= 0.01;
    const color = isNeutral ? "#8A8578" : isGood ? GREEN : RED;
    const sign = val > 0 ? "+" : "";
    return (
      <span style={{ fontSize: 10, color, fontFamily: "'IBM Plex Mono',monospace", marginLeft: 4 }}>
        {sign}{val.toFixed(2)}
      </span>
    );
  }

  function submit() {
    if (!form.weight) return;
    onLog({ id: Date.now(), date: form.date, weight: Number(form.weight),
      bf: form.bf ? Number(form.bf) : null,
      lean: form.lean ? Number(form.lean) : null,
      muscle: form.muscle ? Number(form.muscle) : null,
      visceral: form.visceral ? Number(form.visceral) : null,
      bmr: form.bmr ? Number(form.bmr) : null,
      water: form.water ? Number(form.water) : null,
      bmi: form.bmi ? Number(form.bmi) : null,
      subq: form.subq ? Number(form.subq) : null,
      bone: form.bone ? Number(form.bone) : null,
    });
    setForm({ date: new Date().toISOString().slice(0, 10), weight: "", bf: "", lean: "", muscle: "", visceral: "", bmr: "", water: "", bmi: "", subq: "", bone: "" });
    setAdding(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Body Composition</div>
        <Btn onClick={() => setAdding(a => !a)} small>{adding ? "Cancel" : "+ Log"}</Btn>
      </div>

      {adding && (
        <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <InputField label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" />
            <InputField label="Weight" value={form.weight} onChange={v => setForm(f => ({ ...f, weight: v }))} unit="kg" placeholder="79.5" />
            <InputField label="Body Fat" value={form.bf} onChange={v => setForm(f => ({ ...f, bf: v }))} unit="%" placeholder="17.0" />
            <InputField label="Muscle mass" value={form.muscle} onChange={v => setForm(f => ({ ...f, muscle: v }))} unit="kg" placeholder="62.6" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <InputField label="Visceral fat" value={form.visceral} onChange={v => setForm(f => ({ ...f, visceral: v }))} placeholder="9" />
            <InputField label="BMR" value={form.bmr} onChange={v => setForm(f => ({ ...f, bmr: v }))} unit="kcal" placeholder="1794" />
            <InputField label="Body water" value={form.water} onChange={v => setForm(f => ({ ...f, water: v }))} unit="%" placeholder="60.1" />
            <InputField label="Lean mass" value={form.lean} onChange={v => setForm(f => ({ ...f, lean: v }))} unit="kg" placeholder="65.9" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <InputField label="BMI" value={form.bmi} onChange={v => setForm(f => ({ ...f, bmi: v }))} placeholder="27.2" />
            <InputField label="Subcutaneous fat" value={form.subq} onChange={v => setForm(f => ({ ...f, subq: v }))} unit="%" placeholder="24.1" />
            <InputField label="Bone mass" value={form.bone} onChange={v => setForm(f => ({ ...f, bone: v }))} unit="kg" placeholder="2.89" />
          </div>
          <Btn onClick={submit} variant="success" small>Save</Btn>
        </div>
      )}

      {logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "#8A8578", fontSize: 13 }}>No body measurements yet</div>
      ) : (
        <>
          {trendStraddlesShift && (
            <div style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: 3, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#fdba74" }}>
              ⚠ This trend window spans ~8 Jul, when the scale's BF%/muscle calculation shifted (confirmed via multiple consistent readings — cause unresolved). BF%/muscle/lean slopes below mix two different measurement baselines and aren't reliable. Weight and visceral fat are unaffected.
            </div>
          )}
          {/* Trend legend */}
          {recent.length >= 2 && (
            <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "8px 12px", marginBottom: 12, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>10-day trend</div>
              {[
                { label: "Weight", slope: weightSlope,  good: "down" },
                { label: "BF%",    slope: bfSlope,      good: "down" },
                { label: "Lean",   slope: leanSlope,    good: "up"   },
                { label: "Fat",    slope: fatMassSlope, good: "down" },
              ].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#A8A398" }}>
                  <span>{t.label}</span>
                  <TrendArrow slope={t.slope} goodDirection={t.good} size={13} />
                </div>
              ))}
              <div style={{ fontSize: 9, color: "#252b25", marginLeft: "auto" }}>based on {recent.length} entries</div>
            </div>
          )}

          {/* Summary pills with trend arrows */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              { l: "Weight",    v: latest?.weight?.toFixed(1), u: "kg", slope: weightSlope,  good: "down" },
              { l: "BMI",       v: latest?.bmi,                 u: "",   slope: null,         good: null   },
              { l: "Body Fat",  v: latest?.bf?.toFixed(1),     u: "%",  slope: bfSlope,      good: "down" },
              { l: "Muscle",    v: latest?.muscle?.toFixed(1) || latest?.lean?.toFixed(1), u: "kg", slope: leanSlope, good: "up" },
              { l: "Visceral",  v: latest?.visceral,            u: "",   slope: null,         good: null   },
              { l: "BMR",       v: latest?.bmr,                 u: "kcal", slope: null,       good: null   },
              { l: "Low ever",  v: lowest?.weight?.toFixed(1), u: "kg", slope: null,         good: null   },
            ].filter(s => s.v != null).map((s, i) => (
              <div key={i} style={{ background: "#151a16", border: `1px solid ${s.l==="Visceral" && latest?.visceral >= 10 ? RED : "#252b25"}`, borderRadius: 3, padding: "10px 14px", flex: 1, minWidth: 80 }}>
                <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.l==="Visceral" && latest?.visceral >= 10 ? RED : "#EDEAE2", display: "flex", alignItems: "center" }}>
                  {s.v}<span style={{ fontSize: 11, color: "#8A8578", marginLeft: 2 }}>{s.u}</span>
                  {s.slope !== null && recent.length >= 2 && <TrendArrow slope={s.slope} goodDirection={s.good} size={16} />}
                </div>
              </div>
            ))}
          </div>

          {/* Table with extended metrics */}
          <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #252b25" }}>
                  {["Date", "Weight", "BMI", "BF%", "SubQ%", "Muscle", "Bone", "Fat kg", "Visceral", "BMR", "Water%", "Δ kg"].map(h => (
                    <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const fatMass = r.bf && r.weight ? (r.weight * r.bf / 100).toFixed(1) : "–";
                  const isLatest = i === 0;
                  const dWeight = delta("weight", i);
                  const isShiftBoundary = r.date >= COMPOSITION_SHIFT_DATE && (sorted[i+1] ? sorted[i+1].date < COMPOSITION_SHIFT_DATE : true);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #252b25", background: isLatest ? "#1e1b4b22" : "transparent" }}>
                      <td style={{ padding: "8px 10px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#A8A398", whiteSpace: "nowrap" }}>
                        {r.date}{isLatest && <span style={{ marginLeft: 4, fontSize: 8, background: GREEN, color: "#fff", borderRadius: 4, padding: "1px 4px" }}>now</span>}
                        {isShiftBoundary && <span style={{ marginLeft: 4, fontSize: 8, background: "#92400e", color: "#fdba74", borderRadius: 4, padding: "1px 4px" }} title="Scale's BF%/muscle calculation shifted around here">calc shift ↑</span>}
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#EDEAE2" }}>{r.weight}</td>
                      <td style={{ padding: "8px 10px", color: "#A8A398" }}>{r.bmi ?? "–"}</td>
                      <td style={{ padding: "8px 10px", color: RED }}>{r.bf ? `${r.bf}%` : "–"}</td>
                      <td style={{ padding: "8px 10px", color: AMBER }}>{r.subq ? `${r.subq}%` : "–"}</td>
                      <td style={{ padding: "8px 10px", color: "#34d399" }}>{r.muscle ? `${r.muscle}` : r.lean ? `${r.lean}` : "–"}</td>
                      <td style={{ padding: "8px 10px", color: "#A8A398" }}>{r.bone ?? "–"}</td>
                      <td style={{ padding: "8px 10px", color: "#A8A398" }}>{fatMass}</td>
                      <td style={{ padding: "8px 10px", color: r.visceral >= 10 ? RED : "#A8A398" }}>{r.visceral ?? "–"}</td>
                      <td style={{ padding: "8px 10px", color: "#A8A398" }}>{r.bmr ?? "–"}</td>
                      <td style={{ padding: "8px 10px", color: "#A8A398" }}>{r.water ?? "–"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {dWeight !== null && (
                          <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: dWeight < -0.05 ? GREEN : dWeight > 0.05 ? RED : "#8A8578" }}>
                            {dWeight > 0 ? "+" : ""}{dWeight.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <button onClick={() => onDelete(r.id)} style={{ background: "transparent", border: "none", color: "#8A8578", cursor: "pointer", fontSize: 13 }}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function PlanView() {
  const [logs, setLogs] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekIndex);
  const [selectedDay, setSelectedDay] = useState(null);
  const [tab, setTab] = useState("plan");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const importInputRef = useRef(null);

  useEffect(() => {
    loadTrainingLogs().then(l => setLogs(l)).catch(() => { setLogs(DEFAULT_LOGS); setLoadError(true); });
  }, []);

  function persist(updated) {
    setSaveStatus("saving");
    saveTrainingLogs(updated).then(ok => setSaveStatus(ok ? "saved" : "error"))
      .catch(() => setSaveStatus("error"));
  }

  function addWeightLog(entry) {
    setLogs(l => {
      const updated = { ...l, weightLogs: [...l.weightLogs, entry] };
      persist(updated);
      return updated;
    });
  }

  function addBodyLog(entry) {
    setLogs(l => {
      const updated = { ...l, bodyLogs: [...l.bodyLogs, entry] };
      persist(updated);
      return updated;
    });
  }

  function deleteBodyLog(id) {
    setLogs(l => {
      const updated = { ...l, bodyLogs: l.bodyLogs.filter(b => b.id !== id) };
      persist(updated);
      return updated;
    });
  }

  function setMaxHRTest(result) {
    setLogs(l => {
      const updated = { ...l, maxHRTest: result };
      persist(updated);
      return updated;
    });
  }

  function addCustomExercise(ex) {
    setLogs(l => {
      const updated = { ...l, customExercises: [...l.customExercises, ex] };
      persist(updated);
      return updated;
    });
  }

  // scope "day" edits apply to one session date only; "permanent" edits apply to
  // every future occurrence of that session type (e.g. every "A-base" session).
  function mutateOverrides(scope, sessionKey, sessionDate, mutateFn) {
    const bucket = scope === "day" ? "dayOverrides" : "sessionOverrides";
    const scopeKey = scope === "day" ? sessionDate : sessionKey;
    setLogs(l => {
      const current = l[bucket][scopeKey] || {};
      const next = mutateFn({
        replacements: { ...(current.replacements || {}) },
        added: [...(current.added || [])],
        removedIds: [...(current.removedIds || [])],
      });
      const updated = { ...l, [bucket]: { ...l[bucket], [scopeKey]: next } };
      persist(updated);
      return updated;
    });
  }

  function addExerciseToSession(scope, sessionKey, sessionDate, exercise) {
    mutateOverrides(scope, sessionKey, sessionDate, cur => ({ ...cur, added: [...cur.added, exercise] }));
  }

  function undoAddExercise(scope, sessionKey, sessionDate, exerciseId) {
    mutateOverrides(scope, sessionKey, sessionDate, cur => ({ ...cur, added: cur.added.filter(e => e.id !== exerciseId) }));
  }

  function replaceExercise(scope, sessionKey, sessionDate, oldId, newExercise) {
    mutateOverrides(scope, sessionKey, sessionDate, cur => ({ ...cur, replacements: { ...cur.replacements, [oldId]: newExercise } }));
  }

  function undoReplace(scope, sessionKey, sessionDate, replacedId) {
    mutateOverrides(scope, sessionKey, sessionDate, cur => {
      const { [replacedId]: _omit, ...rest } = cur.replacements;
      return { ...cur, replacements: rest };
    });
  }

  function removeExercise(scope, sessionKey, sessionDate, exerciseId) {
    mutateOverrides(scope, sessionKey, sessionDate, cur => ({ ...cur, removedIds: [...cur.removedIds, exerciseId] }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `training_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;

      if (isGoodvibesCsv(text)) {
        const imported = parseGoodvibesCsv(text);
        if (!imported.length) { alert("Couldn't find any readings in this Goodvibes CSV."); return; }
        // Merge onto the latest server data, not whatever's in this tab's memory —
        // see the equivalent fix in RecoveryView's Health Auto Export import.
        loadTrainingLogs().then(latest => {
          const { bodyLogs, addedCount, updatedCount } = mergeGoodvibesEntries(latest.bodyLogs, imported);
          const updated = { ...latest, bodyLogs };
          setLogs(updated);
          persist(updated);
          const parts = [];
          if (addedCount) parts.push(`${addedCount} new reading(s)`);
          if (updatedCount) parts.push(`${updatedCount} existing entry(ies) updated`);
          alert(parts.length ? `Imported from Goodvibes: ${parts.join(", ")}.` : "Nothing new to import — already up to date.");
        }).catch(() => alert("Couldn't reach the server to import — check your connection and try again."));
        return;
      }

      try {
        const parsed = JSON.parse(text);
        if (parsed.weightLogs && parsed.bodyLogs) { setLogs(parsed); persist(parsed); }
        else { alert("Unrecognized file — expected a Training Log backup or a Goodvibes CSV export."); }
      } catch { alert("Invalid file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (!logs) {
    return (
      <div style={{ background: "#0C0F14", minHeight: "100vh", color: "#A8A398", fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
        Loading saved logs…
      </div>
    );
  }

  const week = plan.weeks[selectedWeek];
  const gymKey = selectedDay?.type === "gym" ? gymSessionMap[`${week.week}-${selectedDay.day}`] : null;

  return (
    <div style={{ background: "#0C0F14", minHeight: "100vh", color: "#EDEAE2", fontFamily: BODY, paddingBottom: 60 }}>
      {loadError && (
        <div style={{ background: "#7c2d12", color: "#fed7aa", fontSize: 11, padding: "6px 14px", textAlign: "center" }}>
          Couldn't load saved logs — starting fresh. Your data will still save going forward.
        </div>
      )}
      {saveStatus !== "idle" && (
        <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 50, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", padding: "4px 10px", borderRadius: 3, background: saveStatus === "error" ? "#7c2d12" : "#151a16", color: saveStatus === "error" ? "#fed7aa" : saveStatus === "saved" ? "#34d399" : "#8A8578", border: "1px solid #252b25" }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "⚠ Save failed — use Export as backup"}
        </div>
      )}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;}
        input:focus,select:focus{border-color:#35C48A!important;outline:none;}
        @keyframes up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .fade{animation:up 0.2s ease}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#151a16}
        ::-webkit-scrollbar-thumb{background:#252b25;border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ background: "#0F1310", borderBottom: "1px solid #252b25", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 2 }}>15-Week Program · 10k Sep 13</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Training Plan</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={exportData} variant="secondary" small>Export</Btn>
          <Btn onClick={() => importInputRef.current?.click()} variant="secondary" small>Import</Btn>
          <input ref={importInputRef} type="file" accept=".json,.csv" onChange={importData} style={{ display: "none" }} />
        </div>
      </div>
      <div style={{ fontSize: 9, color: "#8A8578", textAlign: "center", padding: "4px 0", background: "#0C0F14" }}>
        Logs save automatically. Export is a manual backup, not required.
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#0F1310", borderBottom: "1px solid #252b25", padding: "0 20px" }}>
        {[["plan","Plan"],["progress","Progress"],["body","Body"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: "12px 16px", border: "none", background: "transparent", color: tab === v ? GREEN : "#8A8578", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", borderBottom: tab === v ? "2px solid #35C48A" : "2px solid transparent", transition: "all 0.15s" }}>{l}</button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>

        {/* PLAN TAB */}
        {tab === "plan" && (
          <div className="fade">
            {/* Week selector */}
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
              {plan.weeks.map((w, i) => (
                <button key={i} onClick={() => { setSelectedWeek(i); setSelectedDay(null); }} style={{
                  padding: "6px 12px", borderRadius: 20, border: "1.5px solid",
                  borderColor: selectedWeek === i ? GREEN : "#252b25",
                  background: selectedWeek === i ? GREEN : "transparent",
                  color: selectedWeek === i ? "#fff" : "#8A8578",
                  fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                }}>W{w.week}{i === 3 ? " 🔄" : i === 7 ? " 🏁" : ""}</button>
              ))}
            </div>

            {/* Week header */}
            <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>
                  {selectedWeek === 3 ? "DELOAD WEEK" : selectedWeek === 7 ? "MILESTONE WEEK" : `Week ${week.week} of ${plan.weeks.length}`}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{week.focus}</div>
              </div>
              {selectedWeek === 3 && <span style={{ background: "#064e3b", color: "#6ee7b7", fontSize: 10, padding: "3px 10px", borderRadius: 20, fontFamily: "'IBM Plex Mono',monospace" }}>−20% volume</span>}
              {selectedWeek === 7 && <span style={{ background: "#4c0519", color: "#fda4af", fontSize: 10, padding: "3px 10px", borderRadius: 20, fontFamily: "'IBM Plex Mono',monospace" }}>5k target</span>}
            </div>

            {/* Session date picker */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>Session date:</div>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "5px 9px", color: "#EDEAE2", fontSize: 12, fontFamily: "'Space Grotesk',sans-serif" }} />
            </div>

            {/* Day grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 14 }}>
              {week.days.map((d, i) => {
                const c = typeColor[d.type];
                const sel = selectedDay?.day === d.day;
                return (
                  <div key={i} onClick={() => setSelectedDay(sel ? null : d)} style={{ background: sel ? c.border : c.bg, border: `1.5px solid ${c.border}`, borderRadius: 3, padding: "8px 5px", cursor: "pointer", textAlign: "center", transition: "all 0.15s", transform: sel ? "translateY(-2px)" : "none", boxShadow: sel ? `0 4px 14px ${c.border}44` : "none" }}>
                    <div style={{ fontSize: 8, color: sel ? "rgba(255,255,255,0.6)" : "#8A8578", fontFamily: "'IBM Plex Mono',monospace", marginBottom: 3 }}>{d.day}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: sel ? "#fff" : c.text, lineHeight: 1.2, marginBottom: 5 }}>{d.label}</div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: sel ? "rgba(255,255,255,0.5)" : intColor[d.intensity], margin: "0 auto" }} />
                  </div>
                );
              })}
            </div>

            {/* Day detail */}
            {selectedDay ? (
              <div style={{ background: "#151a16", border: `1.5px solid ${typeColor[selectedDay.type].border}`, borderRadius: 3, padding: 18, animation: "up 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" }}>{selectedDay.day} · Week {week.week}</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedDay.label}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: intColor[selectedDay.intensity], marginTop: 8 }} />
                </div>

                {selectedDay.type === "gym" && gymKey ? (
                  <GymSession
                    sessionKey={gymKey} weekNum={week.week} sessionDate={sessionDate}
                    logs={logs.weightLogs} onLog={addWeightLog}
                    customExercises={logs.customExercises}
                    sessionOverrides={logs.sessionOverrides}
                    dayOverrides={logs.dayOverrides}
                    onCreateCustomExercise={addCustomExercise}
                    onAddExercise={(scope, ex) => addExerciseToSession(scope, gymKey, sessionDate, ex)}
                    onUndoAddExercise={(scope, id) => undoAddExercise(scope, gymKey, sessionDate, id)}
                    onReplaceExercise={(scope, oldId, newEx) => replaceExercise(scope, gymKey, sessionDate, oldId, newEx)}
                    onUndoReplace={(scope, replacedId) => undoReplace(scope, gymKey, sessionDate, replacedId)}
                    onRemoveExercise={(scope, id) => removeExercise(scope, gymKey, sessionDate, id)}
                  />
                ) : (
                  <div style={{ fontSize: 14, color: "#A8A398", lineHeight: 1.7 }}>{selectedDay.detail || "Rest day."}</div>
                )}
                {selectedDay.label === "Max HR Test" && (
                  <MaxHRTestLog result={logs.maxHRTest} onLog={setMaxHRTest} />
                )}
              </div>
            ) : (
              <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: 18, textAlign: "center", color: "#8A8578", fontSize: 13 }}>
                Tap a day to see the session
              </div>
            )}

            {/* Legend */}
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              {Object.entries(typeColor).map(([t, c]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: c.text }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c.border }} />{t}
                </div>
              ))}
              {[["low","Easy"],["medium","Moderate"],["high","Hard"]].map(([k, l]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8578" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: intColor[k] }} />{l}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROGRESS TAB */}
        {tab === "progress" && (
          <div className="fade">
            <div style={{ fontSize: 13, color: "#8A8578", marginBottom: 20 }}>
              Weight progression per exercise — logged across sessions.
              {logs.weightLogs.length > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>{logs.weightLogs.length} sets logged</span>}
            </div>
            <ProgressionChart logs={logs.weightLogs} />

            {logs.weightLogs.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#A8A398" }}>All logged sets</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[...logs.weightLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((l, i) => (
                    <div key={i} style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{l.exerciseName}</div>
                        <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>{l.date} · W{l.week}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{l.weight_kg ? `${l.weight_kg}kg` : "BW"}</div>
                        <div style={{ fontSize: 10, color: "#8A8578" }}>{l.sets}×{l.reps}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {tab === "body" && (
          <div className="fade">
            <BodyLog logs={logs.bodyLogs} onLog={addBodyLog} onDelete={deleteBodyLog} />
          </div>
        )}
      </div>
    </div>
  );
}
