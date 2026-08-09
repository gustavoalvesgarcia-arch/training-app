// Readiness score: 65% HRV-weighted, 35% RHR-weighted, normalized against
// each metric's own mean/stdev within the dataset (so it adapts as more
// history accumulates rather than using fixed population thresholds).
export function computeScore(entries) {
  if (!entries.length) return [];
  const rhrVals = entries.filter(e => e.rhr).map(e => e.rhr);
  const hrvVals = entries.filter(e => e.hrv).map(e => e.hrv);
  const rhrBase = rhrVals.reduce((a, b) => a + b, 0) / (rhrVals.length || 1);
  const hrvBase = hrvVals.reduce((a, b) => a + b, 0) / (hrvVals.length || 1);
  const rhrStd = Math.sqrt(rhrVals.map(v => (v - rhrBase) ** 2).reduce((a, b) => a + b, 0) / (rhrVals.length || 1)) || 1;
  const hrvStd = Math.sqrt(hrvVals.map(v => (v - hrvBase) ** 2).reduce((a, b) => a + b, 0) / (hrvVals.length || 1)) || 1;

  return entries.map(e => {
    const rhrScore = e.rhr ? Math.max(0, Math.min(100, 50 - ((e.rhr - rhrBase) / rhrStd) * 20)) : 50;
    const hrvScore = e.hrv ? Math.max(0, Math.min(100, 50 + ((e.hrv - hrvBase) / hrvStd) * 20)) : 50;
    const score = Math.round(hrvScore * 0.65 + rhrScore * 0.35);
    const zone = score >= 67 ? "green" : score >= 34 ? "yellow" : "red";
    return { ...e, score, zone, label: score >= 67 ? "Recovered" : score >= 34 ? "Moderate" : "Stressed" };
  });
}
