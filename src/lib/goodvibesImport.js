// Parses CSV exports from the Goodvibes (Tefal/Rowenta) smart scale app:
// Tracking tab -> clock icon (top right) -> select range -> Share.
//
// Two real quirks confirmed against an actual export, not just docs:
// - The date field uses a full-width comma ("Aug 9， 2026...") rather than
//   ASCII ",", which is why naive comma-splitting doesn't accidentally break
//   the date into two columns.
// - There's a narrow no-break space (U+202F) before AM/PM instead of a
//   regular space. JS's \s in a regex matches it, but it's easy to miss.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function isGoodvibesCsv(text) {
  const firstLine = (text.split(/\r?\n/)[0] || "").toLowerCase();
  return firstLine.includes("time of measurement") && firstLine.includes("weight");
}

function parseDateKey(str) {
  const normalized = str.replace(/，/g, ",").replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(\w+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, monStr, day, year] = m;
  const month = MONTHS[monStr.slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseGoodvibesCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const col = name => header.findIndex(h => h.startsWith(name));
  const iDate = col("time of measurement");
  const iWeight = col("weight");
  const iBmi = col("bmi");
  const iBf = col("body fat");
  const iSubq = col("subcutaneous fat");
  const iVisceral = col("visceral fat");
  const iWater = col("body water");
  const iMuscle = col("muscle mass");
  const iBone = col("bone mass");
  const iBmr = col("basal metabolic rate");
  if (iDate === -1 || iWeight === -1) return [];

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < header.length) continue;
    const date = parseDateKey(cols[iDate]);
    const weight = num(cols[iWeight]);
    if (!date || weight == null) continue;
    entries.push({
      date, weight,
      bmi: iBmi >= 0 ? num(cols[iBmi]) : null,
      bf: iBf >= 0 ? num(cols[iBf]) : null,
      subq: iSubq >= 0 ? num(cols[iSubq]) : null,
      visceral: iVisceral >= 0 ? num(cols[iVisceral]) : null,
      water: iWater >= 0 ? num(cols[iWater]) : null,
      muscle: iMuscle >= 0 ? num(cols[iMuscle]) : null,
      bone: iBone >= 0 ? num(cols[iBone]) : null,
      bmr: iBmr >= 0 ? num(cols[iBmr]) : null,
    });
  }
  return entries;
}

const MERGE_FIELDS = ["weight", "bmi", "bf", "subq", "visceral", "water", "muscle", "bone", "bmr"];

// Merges by date rather than add-or-skip: a new date becomes a new row, but a
// date that already has a record gets that record's fields filled in/updated
// with whatever the CSV supplies (only fields present in the CSV are touched —
// e.g. "lean", which Goodvibes doesn't report, is left alone either way). If a
// date has more than one existing row (allowed by manual entry), only the last
// one is updated, so older same-day rows aren't silently collapsed together.
export function mergeGoodvibesEntries(existingBodyLogs, imported) {
  const lastIndexByDate = new Map();
  existingBodyLogs.forEach((e, i) => lastIndexByDate.set(e.date, i));

  const bodyLogs = [...existingBodyLogs];
  let addedCount = 0, updatedCount = 0;

  for (const entry of imported) {
    const idx = lastIndexByDate.get(entry.date);
    if (idx === undefined) {
      bodyLogs.push({ id: Date.now() + Math.random(), ...entry });
      lastIndexByDate.set(entry.date, bodyLogs.length - 1);
      addedCount++;
      continue;
    }
    const existing = bodyLogs[idx];
    let changed = false;
    const merged = { ...existing };
    for (const key of MERGE_FIELDS) {
      if (entry[key] != null && entry[key] !== existing[key]) { merged[key] = entry[key]; changed = true; }
    }
    if (changed) { bodyLogs[idx] = merged; updatedCount++; }
  }

  return { bodyLogs, addedCount, updatedCount };
}
