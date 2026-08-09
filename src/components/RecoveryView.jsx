import { useState, useMemo, useEffect } from "react";
import { loadRecoveryData, saveRecoveryData } from "../lib/recoveryData.js";
import { computeScore } from "../lib/scoring.js";
import { INK, PAPER, GREEN, AMBER, RED, MONO, DISPLAY, BODY } from "../lib/theme.js";


// ── Recovery-view color zones (uses shared theme tokens) ──────────────────
const Z = {
  green:  { bg: "#122019", border: GREEN, text: GREEN, fill: GREEN },
  yellow: { bg: "#211a0d", border: AMBER, text: AMBER, fill: AMBER },
  red:    { bg: "#210f0d", border: RED, text: RED, fill: RED },
};
const wColor = { Gym: "#7C8CE8", Run: GREEN, Walk: "#8A8578", Padel: AMBER };
const zColors = ["#8A8578", GREEN, AMBER, "#E8763D", RED];
const zLabels = ["Z1", "Z2", "Z3", "Z4", "Z5"];

// ── Micro components ────────────────────────────────────────────────────
// Instrument strip — replaces a circular gauge with a linear zone-track read,
// closer to how a chest-strap monitor or lab printout actually displays a
// heart-rate zone position than a generic ring gauge.
function Ring({ score, zone }) {
  const c = Z[zone] || Z.yellow;
  const pct = Math.max(2, Math.min(100, score));
  return (
    <div style={{ width: 120 }}>
      <div style={{ fontSize: 42, fontWeight: 700, color: c.fill, fontFamily: MONO, lineHeight: 1, letterSpacing: -1 }}>{score}</div>
      <div style={{ fontSize: 10, color: c.text, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 2, marginTop: 4, marginBottom: 10 }}>{(zone || "").toUpperCase()}</div>
      {/* Readiness strip: red (low score, 0) -> amber -> green (high score, 100).
          Deliberately a different gradient direction from the HR-zone bars elsewhere,
          since low HR zone = good but low readiness score = bad. */}
      <div style={{ position: "relative", height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${RED}, ${AMBER} 50%, ${GREEN})`, opacity: 0.9 }}>
        <div style={{ position: "absolute", left: `${pct}%`, top: -3, width: 2, height: 11, background: PAPER, borderRadius: 1, transform: "translateX(-1px)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }} />
      </div>
    </div>
  );
}

function Pill({ label, value, unit, alert }) {
  return (
    <div style={{ background: alert ? "#1a0f0d" : "#151a16", border: `1px solid ${alert ? RED : "#252b25"}`, borderRadius: 3, padding: "9px 13px", minWidth: 88 }}>
      <div style={{ fontSize: 9, color: "#8A8578", fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: alert ? RED : PAPER, fontFamily: MONO, lineHeight: 1 }}>
        {value ?? "–"}<span style={{ fontSize: 10, color: "#8A8578", marginLeft: 3, fontFamily: BODY }}>{unit}</span>
      </div>
    </div>
  );
}

function ZBar({ z1, z2, z3, z4, z5, compact }) {
  const z = [z1, z2, z3, z4, z5];
  return (
    <div style={{ display: "flex", gap: 1, borderRadius: 2, overflow: "hidden", height: compact ? 5 : 10 }}>
      {z.map((v, i) => v > 0 && <div key={i} style={{ width: `${v}%`, background: zColors[i], minWidth: 2 }} title={`${zLabels[i]}: ${v}%`} />)}
    </div>
  );
}

function Sparkline({ vals, color }) {
  if (!vals || vals.length < 2) return null;
  const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${28 - ((v - min) / range) * 24 - 2}`).join(" ");
  return (
    <svg width="100%" height={32} viewBox="0 0 100 32" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={(vals.length - 1) / (vals.length - 1) * 100} cy={28 - ((vals[vals.length - 1] - min) / range) * 24 - 2} r={2.5} fill={color} />
    </svg>
  );
}

// ── Input components ─────────────────────────────────────────────────────
function InputField({ label, value, onChange, type = "number", placeholder, unit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, color: "#8A8578", fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1 }}>{label}{unit && ` (${unit})`}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "8px 10px", color: PAPER, fontSize: 14, fontFamily: MONO, outline: "none", width: "100%" }} />
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small }) {
  const styles = {
    primary: { background: GREEN, color: INK, border: "none" },
    secondary: { background: "transparent", color: "#8A8578", border: "1px solid #252b25" },
    danger: { background: "transparent", color: RED, border: `1px solid ${RED}` },
    success: { background: GREEN, color: INK, border: "none" },
  };
  return (
    <button onClick={onClick} style={{ ...styles[variant], borderRadius: 3, padding: small ? "6px 12px" : "10px 18px", fontSize: small ? 12 : 13, fontFamily: DISPLAY, fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" }}
      onMouseEnter={e => e.target.style.opacity = "0.8"} onMouseLeave={e => e.target.style.opacity = "1"}>
      {children}
    </button>
  );
}

// ── Main app ─────────────────────────────────────────────────────────────
export default function RecoveryView() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [tab, setTab] = useState("today");
  const [modal, setModal] = useState(null); // "metrics" | "workout"
  const [selected, setSelected] = useState(null);
  const [selectedWk, setSelectedWk] = useState(null);

  // Form state — metrics
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), rhr: "", hrv: "", sleep: "", deep: "", rem: "", spo2: "", vo2max: "", notes: "" });
  // Form state — workout
  const [wForm, setWForm] = useState({ date: new Date().toISOString().slice(0, 10), type: "Gym", dur: "", distance: "", avgHR: "", maxHR: "", z1: "", z2: "", z3: "", z4: "", z5: "", strain: "" });

  useEffect(() => {
    loadRecoveryData().then(d => setData(d)).catch(() => { setData({ entries: [], workouts: [] }); setLoadError(true); });
  }, []);

  function persist(updated) {
    setSaveStatus("saving");
    saveRecoveryData(updated).then(ok => setSaveStatus(ok ? "saved" : "error"))
      .catch(() => setSaveStatus("error"));
  }

  const scored = useMemo(() => data ? computeScore([...data.entries].sort((a, b) => a.date.localeCompare(b.date))) : [], [data]);
  const wkMap = useMemo(() => data ? Object.fromEntries(data.workouts.map(w => [w.date, w])) : {}, [data]);
  // VO2max series: sparse, only present on days it was logged
  const vo2Series = useMemo(() => data ? data.entries.filter(e => e.vo2max).sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ date: e.date, val: e.vo2max })) : [], [data]);
  // Pace-at-HR: for every run with distance+duration+avgHR, pace (min/km) at that effort.
  // A falling pace at similar/rising HR is the direct "running more efficiently" signal —
  // more informative for economy than VO2max alone, which caps out at a physiological ceiling.
  const paceSeries = useMemo(() => data ? data.workouts
    .filter(w => w.type === "Run" && w.distance && w.dur && w.avgHR)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({ date: w.date, pace: w.dur / w.distance, hr: w.avgHR, dist: w.distance }))
    : [], [data]);
  const today = scored.length ? scored[scored.length - 1] : null;
  const yesterday = scored.length > 1 ? scored[scored.length - 2] : null;
  const last30 = scored.slice(-30);

  function saveMetrics() {
    const entry = {
      date: form.date,
      rhr: form.rhr ? Number(form.rhr) : null,
      hrv: form.hrv ? Number(form.hrv) : null,
      sleep: form.sleep ? Number(form.sleep) : null,
      deep: form.deep ? Number(form.deep) : null,
      rem: form.rem ? Number(form.rem) : null,
      spo2: form.spo2 ? Number(form.spo2) : null,
      vo2max: form.vo2max ? Number(form.vo2max) : null,
      notes: form.notes || null,
    };
    setData(d => {
      const filtered = d.entries.filter(e => e.date !== entry.date);
      const updated = { ...d, entries: [...filtered, entry] };
      persist(updated);
      return updated;
    });
    setModal(null);
    setForm({ date: new Date().toISOString().slice(0, 10), rhr: "", hrv: "", sleep: "", deep: "", rem: "", spo2: "", vo2max: "", notes: "" });
  }

  function saveWorkout() {
    const entry = {
      date: wForm.date, type: wForm.type,
      dur: wForm.dur ? Number(wForm.dur) : null,
      distance: wForm.distance ? Number(wForm.distance) : null,
      avgHR: wForm.avgHR ? Number(wForm.avgHR) : null,
      maxHR: wForm.maxHR ? Number(wForm.maxHR) : null,
      z1: wForm.z1 ? Number(wForm.z1) : 0,
      z2: wForm.z2 ? Number(wForm.z2) : 0,
      z3: wForm.z3 ? Number(wForm.z3) : 0,
      z4: wForm.z4 ? Number(wForm.z4) : 0,
      z5: wForm.z5 ? Number(wForm.z5) : 0,
      strain: wForm.strain ? Number(wForm.strain) : null,
    };
    setData(d => {
      const updated = { ...d, workouts: [...d.workouts.filter(w => !(w.date === entry.date && w.type === entry.type)), entry] };
      persist(updated);
      return updated;
    });
    setModal(null);
    setWForm({ date: new Date().toISOString().slice(0, 10), type: "Gym", dur: "", distance: "", avgHR: "", maxHR: "", z1: "", z2: "", z3: "", z4: "", z5: "", strain: "" });
  }

  function deleteEntry(date) {
    setData(d => {
      const updated = { ...d, entries: d.entries.filter(e => e.date !== date) };
      persist(updated);
      return updated;
    });
    setSelected(null);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `health_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.entries && parsed.workouts) { setData(parsed); persist(parsed); }
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
  }

  if (!data) {
    return (
      <div style={{ background: "#0C0F14", minHeight: "100vh", color: "#A8A398", fontFamily: "'Space Grotesk',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
        Loading saved data…
      </div>
    );
  }


  function getRec(d) {
    if (!d) return { icon: "", text: "" };
    if (d.zone === "green") return { icon: "✅", text: "Good to train. Push intensity if planned." };
    if (d.zone === "yellow") return { icon: "⚠️", text: d.rhr > 70 ? "Elevated RHR. Train lighter or rest today." : "Moderate recovery. Avoid max effort." };
    return { icon: "🛑", text: "Rest or walk only. Do not train hard today." };
  }

  const todayZone = today ? (Z[today.zone] || Z.yellow) : Z.yellow;
  const todayWk = today ? wkMap[today.date] : null;

  return (
    <div style={{ background: INK, minHeight: "100vh", color: PAPER, fontFamily: BODY, padding: "0 0 60px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;}
        input:focus{border-color:${GREEN}!important;outline:none;}
        select{appearance:none;}
        @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fade{animation:up 0.2s ease}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#151a16}
        ::-webkit-scrollbar-thumb{background:#252b25;border-radius:2px}
      `}</style>
      {loadError && (
        <div style={{ background: "#3d1a12", color: "#f0b89e", fontSize: 11, padding: "6px 14px", textAlign: "center", fontFamily: MONO }}>
          Couldn't load saved data — starting fresh. New entries will still save going forward.
        </div>
      )}
      {saveStatus !== "idle" && (
        <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 50, fontSize: 10, fontFamily: MONO, padding: "4px 10px", borderRadius: 3, background: saveStatus === "error" ? "#3d1a12" : "#151a16", color: saveStatus === "error" ? "#f0b89e" : saveStatus === "saved" ? GREEN : "#8A8578", border: "1px solid #252b25" }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "⚠ Save failed — use Export as backup"}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#0F1310", borderBottom: "1px solid #252b25", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8A8578", fontFamily: MONO, textTransform: "uppercase", letterSpacing: 3 }}>Recovery Log</div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, fontFamily: DISPLAY }}>Instrument Panel</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => setModal("metrics")} small>+ Metrics</Btn>
          <Btn onClick={() => setModal("workout")} variant="secondary" small>+ Workout</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, background: "#0F1310", borderBottom: "1px solid #252b25", padding: "0 20px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {[["today", "Today"], ["history", "History"], ["workouts", "Workouts"], ["efficiency", "Efficiency"], ["trends", "Trends"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: "12px 16px", border: "none", background: "transparent", color: tab === v ? GREEN : "#8A8578", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, cursor: "pointer", borderBottom: tab === v ? `2px solid ${GREEN}` : "2px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexShrink: 0, paddingLeft: 12 }}>
          <Btn onClick={exportJSON} variant="secondary" small>Export</Btn>
          <label style={{ cursor: "pointer" }}>
            <Btn variant="secondary" small onClick={() => {}}>Import</Btn>
            <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>

        {/* TODAY */}
        {tab === "today" && (
          <div className="fade">
            {!today ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No data yet</div>
                <div style={{ color: "#8A8578", marginBottom: 24, fontSize: 14 }}>Tap "+ Metrics" to log your first reading</div>
                <Btn onClick={() => setModal("metrics")}>Log today's metrics</Btn>
              </div>
            ) : (
              <>
                {/* Score card */}
                <div style={{ background: "#151a16", border: `1px solid ${todayZone.border}`, borderRadius: 4, padding: 20, marginBottom: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <Ring score={today.score} zone={today.zone} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                      {today.date} · Readiness
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: todayZone.fill, marginBottom: 12 }}>{today.label}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                      {today.rhr && <Pill label="RHR" value={today.rhr} unit="bpm" alert={today.rhr > 70} />}
                      {today.hrv && <Pill label="HRV" value={today.hrv?.toFixed(0)} unit="ms" alert={today.hrv < 35} />}
                      {today.vo2max && <Pill label="VO₂ max" value={today.vo2max} unit="ml/kg/min" />}
                      {yesterday && <Pill label="Δ Score" value={(today.score >= yesterday.score ? "+" : "") + (today.score - yesterday.score)} alert={today.score < yesterday.score} />}
                    </div>
                    {today.sleep && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", marginBottom: 6 }}>SLEEP</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: "hidden", display: "flex", gap: 1 }}>
                            {today.deep && <div style={{ width: `${(today.deep / today.sleep) * 100}%`, background: "#4f46e5" }} />}
                            {today.rem && <div style={{ width: `${(today.rem / today.sleep) * 100}%`, background: "#7c3aed" }} />}
                            <div style={{ flex: 1, background: "#252b25" }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{today.sleep}h</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "#8A8578" }}>
                          {today.deep && <span style={{ color: "#818cf8" }}>● Deep {today.deep}h</span>}
                          {today.rem && <span style={{ color: "#a78bfa" }}>● REM {today.rem}h</span>}
                        </div>
                      </div>
                    )}
                    <div style={{ background: todayZone.bg, border: `1px solid ${todayZone.border}`, borderRadius: 3, padding: "8px 12px", fontSize: 13, color: todayZone.text }}>
                      {getRec(today).icon} {getRec(today).text}
                    </div>
                  </div>
                </div>

                {/* Today's workout */}
                {todayWk && (
                  <div style={{ background: "#151a16", borderRadius: 3, padding: 16, border: `1px solid ${wColor[todayWk.type]}44`, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>{todayWk.dur} min{todayWk.distance ? ` · ${todayWk.distance} km` : ""}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: wColor[todayWk.type] }}>{todayWk.type}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>STRAIN</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: todayWk.strain > 50 ? "#ef4444" : todayWk.strain > 35 ? "#f59e0b" : "#10b981" }}>{todayWk.strain}</div>
                      </div>
                    </div>
                    <ZBar {...todayWk} />
                  </div>
                )}

                {/* 30-day summary */}
                {last30.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { l: "30-day avg", v: Math.round(last30.reduce((a, b) => a + b.score, 0) / last30.length), c: GREEN },
                      { l: "Green", v: `${last30.filter(d => d.zone === "green").length}/30`, c: "#059669" },
                      { l: "Yellow", v: `${last30.filter(d => d.zone === "yellow").length}/30`, c: "#ca8a04" },
                      { l: "Red", v: `${last30.filter(d => d.zone === "red").length}/30`, c: "#e11d48" },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, minWidth: 80, background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "10px 12px" }}>
                        <div style={{ fontSize: 9, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{scored.length} entries logged</div>
              <Btn onClick={() => setModal("metrics")} small>+ Add entry</Btn>
            </div>
            {scored.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#8A8578" }}>No entries yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...scored].reverse().map((e, i) => {
                  const c = Z[e.zone] || Z.yellow;
                  const sel = selected?.date === e.date;
                  return (
                    <div key={i}>
                      <div onClick={() => setSelected(sel ? null : e)}
                        style={{ background: "#151a16", border: `1px solid ${sel ? c.border : "#252b25"}`, borderRadius: 3, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "border-color 0.15s" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.bg, border: `2px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: c.fill }}>{e.score}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{e.date}</span>
                            <span style={{ fontSize: 11, color: c.fill, fontFamily: "'IBM Plex Mono',monospace" }}>{e.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#8A8578" }}>
                            {e.rhr && <span>RHR {e.rhr}</span>}
                            {e.hrv && <span>HRV {e.hrv}</span>}
                            {e.sleep && <span>Sleep {e.sleep}h</span>}
                            {wkMap[e.date] && <span style={{ color: wColor[wkMap[e.date].type] }}>● {wkMap[e.date].type}</span>}
                          </div>
                        </div>
                      </div>
                      {sel && (
                        <div style={{ background: "#151a16", border: `1px solid ${c.border}`, borderRadius: "0 0 3px 3px", padding: "12px 14px", animation: "up 0.15s ease", marginTop: -1 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                            {e.rhr && <Pill label="RHR" value={e.rhr} unit="bpm" />}
                            {e.hrv && <Pill label="HRV" value={e.hrv} unit="ms" />}
                            {e.vo2max && <Pill label="VO₂ max" value={e.vo2max} unit="ml/kg/min" />}
                            {e.sleep && <Pill label="Sleep" value={e.sleep} unit="h" />}
                            {e.deep && <Pill label="Deep" value={e.deep} unit="h" />}
                            {e.rem && <Pill label="REM" value={e.rem} unit="h" />}
                            {e.spo2 && <Pill label="SpO2" value={e.spo2} unit="%" />}
                          </div>
                          {e.notes && <div style={{ fontSize: 12, color: "#A8A398", marginBottom: 10, fontStyle: "italic" }}>{e.notes}</div>}
                          <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 3, padding: "7px 10px", fontSize: 12, color: c.text, marginBottom: 10 }}>
                            {getRec(e).icon} {getRec(e).text}
                          </div>
                          <Btn onClick={() => deleteEntry(e.date)} variant="danger" small>Delete entry</Btn>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* WORKOUTS */}
        {tab === "workouts" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{data.workouts.length} workouts logged</div>
              <Btn onClick={() => setModal("workout")} small>+ Log workout</Btn>
            </div>
            {data.workouts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#8A8578" }}>No workouts yet</div>
            ) : (
              <>
                {/* Strain chart */}
                <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: "#A8A398", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>Strain by session</div>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 60, overflowX: "auto" }}>
                    {[...data.workouts].sort((a, b) => a.date.localeCompare(b.date)).filter(w => w.type !== "Walk").map((w, i) => {
                      const maxS = Math.max(...data.workouts.map(x => x.strain || 0), 1);
                      const h = Math.max(4, ((w.strain || 0) / maxS) * 56);
                      return (
                        <div key={i} onClick={() => setSelectedWk(selectedWk?.date === w.date ? null : w)}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", flexShrink: 0, width: 20 }}>
                          <div style={{ width: "100%", borderRadius: "3px 3px 0 0", background: selectedWk?.date === w.date ? "" : wColor[w.type], height: h, transition: "all 0.15s" }} />
                          <div style={{ fontSize: 7, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", writingMode: "vertical-rl", transform: "rotate(180deg)", height: 22, overflow: "hidden" }}>{w.date.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedWk && (
                  <div style={{ background: "#151a16", border: `1px solid ${wColor[selectedWk.type]}`, borderRadius: 3, padding: 16, marginBottom: 16, animation: "up 0.15s ease" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>{selectedWk.date} · {selectedWk.dur} min{selectedWk.distance ? ` · ${selectedWk.distance} km` : ""}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: wColor[selectedWk.type] }}>{selectedWk.type}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>STRAIN</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: (selectedWk.strain || 0) > 50 ? "#ef4444" : (selectedWk.strain || 0) > 35 ? "#f59e0b" : "#10b981" }}>{selectedWk.strain}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                      <Pill label="Avg HR" value={selectedWk.avgHR} unit="bpm" />
                      <Pill label="Max HR" value={selectedWk.maxHR} unit="bpm" />
                      {selectedWk.distance && <Pill label="Distance" value={selectedWk.distance} unit="km" />}
                      {selectedWk.distance && selectedWk.dur && (
                        <Pill label="Pace" value={(selectedWk.dur / selectedWk.distance).toFixed(1)} unit="min/km" />
                      )}
                    </div>
                    <ZBar {...selectedWk} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {[selectedWk.z1, selectedWk.z2, selectedWk.z3, selectedWk.z4, selectedWk.z5].map((v, i) => v > 0 && (
                        <span key={i} style={{ fontSize: 10, background: `${zColors[i]}22`, color: zColors[i], padding: "2px 8px", borderRadius: 3, fontFamily: "'IBM Plex Mono',monospace" }}>{zLabels[i]} {v}%</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...data.workouts].sort((a, b) => b.date.localeCompare(a.date)).map((w, i) => (
                    <div key={i} onClick={() => setSelectedWk(selectedWk?.date === w.date ? null : w)}
                      style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: "11px 14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 3, background: `${wColor[w.type]}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {w.type === "Gym" ? "🏋️" : w.type === "Run" ? "🏃" : w.type === "Padel" ? "🎾" : "🚶"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, color: wColor[w.type] }}>{w.type}</span>
                          <span style={{ fontSize: 11, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>{w.date}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#8A8578", marginBottom: 5, alignItems: "center" }}>
                          <span>{w.dur} min</span>
                          {w.distance ? (
                            <span>{w.distance} km</span>
                          ) : ["Run", "Walk", "Padel", "Cycle"].includes(w.type) ? (
                            <span style={{ color: "#8A8578", fontStyle: "italic" }}>no distance logged</span>
                          ) : null}
                          {w.avgHR && <span>avg {w.avgHR} bpm</span>}
                          {w.strain && <span style={{ color: (w.strain > 45 ? "#ef4444" : w.strain > 35 ? "#f59e0b" : "#10b981"), fontWeight: 700 }}>strain {w.strain}</span>}
                        </div>
                        <ZBar {...w} compact />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* EFFICIENCY */}
        {tab === "efficiency" && (
          <div className="fade">
            {vo2Series.length < 2 && paceSeries.length < 3 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#8A8578" }}>Log a few runs with distance, duration, and avg HR to see efficiency trends</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* VO2max trend */}
                {vo2Series.length >= 2 && (() => {
                  const first = vo2Series[0], last = vo2Series[vo2Series.length - 1];
                  const delta = last.val - first.val;
                  return (
                    <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: DISPLAY }}>VO₂ Max</div>
                          <div style={{ fontSize: 11, color: "#8A8578", marginTop: 2, fontFamily: BODY }}>Aerobic ceiling · {first.date} → {last.date}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 22, fontWeight: 600, color: GREEN, fontFamily: MONO }}>{last.val.toFixed(1)}</div>
                          <div style={{ fontSize: 10, color: delta >= 0 ? GREEN : RED, fontFamily: MONO }}>{delta >= 0 ? "+" : ""}{delta.toFixed(2)} since {first.date}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, height: 40 }}>
                        <Sparkline vals={vo2Series.map(v => v.val)} color={GREEN} />
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                        {vo2Series.slice(-6).map((v, i) => (
                          <span key={i} style={{ fontSize: 9, color: "#8A8578", fontFamily: MONO, background: "#0F1310", padding: "2px 6px", borderRadius: 2 }}>{v.date.slice(5)}: {v.val.toFixed(1)}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Pace at effort — running economy */}
                {paceSeries.length >= 3 && (() => {
                  const maxPace = Math.max(...paceSeries.map(p => p.pace));
                  const minPace = Math.min(...paceSeries.map(p => p.pace));
                  const range = maxPace - minPace || 1;
                  const recent = paceSeries.slice(-8);
                  const early = paceSeries.slice(0, Math.min(4, paceSeries.length));
                  const lateAvgPace = recent.reduce((a, b) => a + b.pace, 0) / recent.length;
                  const lateAvgHR = recent.reduce((a, b) => a + b.hr, 0) / recent.length;
                  const earlyAvgPace = early.reduce((a, b) => a + b.pace, 0) / early.length;
                  const earlyAvgHR = early.reduce((a, b) => a + b.hr, 0) / early.length;
                  const paceImproved = lateAvgPace < earlyAvgPace;
                  return (
                    <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 3, padding: 18 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: DISPLAY, marginBottom: 2 }}>Pace at Effort</div>
                      <div style={{ fontSize: 11, color: "#8A8578", marginBottom: 14, fontFamily: BODY }}>Running economy — pace per km relative to avg HR, per run</div>

                      {/* Mini scatter: x = time order, y = pace (inverted, faster=higher), color = HR zone */}
                      <div style={{ position: "relative", height: 90, display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 10 }}>
                        {paceSeries.map((p, i) => {
                          const h = 8 + ((maxPace - p.pace) / range) * 74;
                          const hrColor = p.hr >= 148 ? RED : p.hr >= 130 ? AMBER : GREEN;
                          return (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }} title={`${p.date}: ${p.pace.toFixed(1)} min/km @ ${p.hr} bpm`}>
                              <div style={{ width: "100%", maxWidth: 10, borderRadius: "2px 2px 0 0", background: hrColor, height: h, opacity: 0.85 }} />
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8A8578", fontFamily: MONO, marginBottom: 14 }}>
                        <span>{paceSeries[0].date}</span>
                        <span>faster ↑</span>
                        <span>{paceSeries[paceSeries.length - 1].date}</span>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Pill label="Early avg" value={earlyAvgPace.toFixed(1)} unit="min/km" />
                        <Pill label="at HR" value={earlyAvgHR.toFixed(0)} unit="bpm" />
                        <Pill label="Recent avg" value={lateAvgPace.toFixed(1)} unit="min/km" />
                        <Pill label="at HR" value={lateAvgHR.toFixed(0)} unit="bpm" />
                      </div>
                      <div style={{ background: paceImproved ? "#122019" : "#211a0d", border: `1px solid ${paceImproved ? GREEN : AMBER}`, borderRadius: 3, padding: "9px 12px", fontSize: 12, color: paceImproved ? GREEN : AMBER, marginTop: 12, fontFamily: BODY, lineHeight: 1.5 }}>
                        {paceImproved
                          ? `Recent runs average ${(earlyAvgPace - lateAvgPace).toFixed(1)} min/km faster than early runs, at a similar avg HR (${lateAvgHR.toFixed(0)} vs ${earlyAvgHR.toFixed(0)} bpm). That's real economy improvement — more speed for the same cardiovascular cost.`
                          : `Recent pace is similar to or slower than early runs at comparable effort. Not necessarily a problem — check if recent runs were deliberately easier, longer, or in worse conditions before reading this as reduced efficiency.`}
                      </div>
                    </div>
                  );
                })()}

                {/* Legend */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 10, color: "#8A8578", fontFamily: MONO, padding: "0 4px" }}>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: GREEN, borderRadius: 2, marginRight: 5 }} />Easy (HR &lt;130)</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: AMBER, borderRadius: 2, marginRight: 5 }} />Moderate (130–147)</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: RED, borderRadius: 2, marginRight: 5 }} />Hard (148+)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRENDS */}
        {tab === "trends" && (
          <div className="fade">
            {scored.length < 3 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#8A8578" }}>Log at least 3 entries to see trends</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Readiness Score", vals: scored.slice(-30).map(d => d.score), color: GREEN, note: "Composite HRV 65% + RHR 35%" },
                  { label: "HRV (ms)", vals: scored.filter(d => d.hrv).slice(-30).map(d => d.hrv), color: "#3b82f6", note: "Higher = better recovered" },
                  { label: "Resting HR (bpm)", vals: scored.filter(d => d.rhr).slice(-30).map(d => d.rhr), color: "#e11d48", note: "Lower = better recovered" },
                  { label: "Sleep (hours)", vals: scored.filter(d => d.sleep).slice(-30).map(d => d.sleep), color: "#7c3aed", note: "Target 7.5–9h" },
                ].filter(c => c.vals.length >= 2).map((chart, i) => {
                  const latest = chart.vals[chart.vals.length - 1];
                  const avg = chart.vals.reduce((a, b) => a + b, 0) / chart.vals.length;
                  return (
                    <div key={i} style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: 4, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{chart.label}</div>
                          <div style={{ fontSize: 11, color: "#8A8578", marginTop: 2 }}>{chart.note}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: chart.color }}>{latest.toFixed(0)}</div>
                          <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace" }}>avg {avg.toFixed(0)}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, height: 40 }}>
                        <Sparkline vals={chart.vals} color={chart.color} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, padding: "0 0 0 0" }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: "#151a16", border: "1px solid #252b25", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 600, animation: "up 0.2s ease", maxHeight: "90vh", overflowY: "auto" }}>

            {modal === "metrics" && (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Log Daily Metrics</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <InputField label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" />
                  <InputField label="Resting HR" value={form.rhr} onChange={v => setForm(f => ({ ...f, rhr: v }))} unit="bpm" placeholder="e.g. 58" />
                  <InputField label="HRV" value={form.hrv} onChange={v => setForm(f => ({ ...f, hrv: v }))} unit="ms" placeholder="e.g. 65" />
                  <InputField label="Sleep Total" value={form.sleep} onChange={v => setForm(f => ({ ...f, sleep: v }))} unit="hrs" placeholder="e.g. 7.5" />
                  <InputField label="Deep Sleep" value={form.deep} onChange={v => setForm(f => ({ ...f, deep: v }))} unit="hrs" placeholder="e.g. 0.8" />
                  <InputField label="REM Sleep" value={form.rem} onChange={v => setForm(f => ({ ...f, rem: v }))} unit="hrs" placeholder="e.g. 1.8" />
                  <InputField label="SpO2" value={form.spo2} onChange={v => setForm(f => ({ ...f, spo2: v }))} unit="%" placeholder="e.g. 97" />
                  <InputField label="VO₂ max" value={form.vo2max} onChange={v => setForm(f => ({ ...f, vo2max: v }))} unit="ml/kg/min" placeholder="e.g. 37.4" />
                </div>
                <div style={{ marginTop: 12 }}>
                  <InputField label="Notes (optional)" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} type="text" placeholder="How do you feel?" />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                  <Btn onClick={() => setModal(null)} variant="secondary">Cancel</Btn>
                  <Btn onClick={saveMetrics} variant="success">Save</Btn>
                </div>
              </>
            )}

            {modal === "workout" && (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Log Workout</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <InputField label="Date" value={wForm.date} onChange={v => setWForm(f => ({ ...f, date: v }))} type="date" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>Type</label>
                    <select value={wForm.type} onChange={e => setWForm(f => ({ ...f, type: e.target.value }))}
                      style={{ background: "#0C0F14", border: "1px solid #252b25", borderRadius: 3, padding: "8px 10px", color: PAPER, fontSize: 14, fontFamily: MONO }}>
                      {["Gym", "Run", "Walk", "Padel", "Cycle", "Swim"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <InputField label="Duration" value={wForm.dur} onChange={v => setWForm(f => ({ ...f, dur: v }))} unit="min" placeholder="e.g. 60" />
                  {["Run", "Walk", "Cycle", "Padel"].includes(wForm.type) && (
                    <InputField label="Distance" value={wForm.distance} onChange={v => setWForm(f => ({ ...f, distance: v }))} unit="km" placeholder="e.g. 3.2" />
                  )}
                  <InputField label="Avg HR" value={wForm.avgHR} onChange={v => setWForm(f => ({ ...f, avgHR: v }))} unit="bpm" placeholder="e.g. 130" />
                  <InputField label="Max HR" value={wForm.maxHR} onChange={v => setWForm(f => ({ ...f, maxHR: v }))} unit="bpm" placeholder="e.g. 165" />
                  <InputField label="Strain" value={wForm.strain} onChange={v => setWForm(f => ({ ...f, strain: v }))} placeholder="0–100" />
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: "#8A8578", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>HR Zones (% of session)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                    {["z1", "z2", "z3", "z4", "z5"].map((z, i) => (
                      <InputField key={z} label={zLabels[i]} value={wForm[z]} onChange={v => setWForm(f => ({ ...f, [z]: v }))} placeholder="%" />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                  <Btn onClick={() => setModal(null)} variant="secondary">Cancel</Btn>
                  <Btn onClick={saveWorkout} variant="success">Save</Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
