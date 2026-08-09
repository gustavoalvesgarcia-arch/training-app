import { useState, useEffect, useRef } from "react";
import * as lock from "../lib/appLock.js";
import { INK, SURFACE, BORDER, PAPER, MUTE, GREEN, RED, DISPLAY, MONO, BODY } from "../lib/theme.js";

function Screen({ children }) {
  return (
    <div style={{ background: INK, minHeight: "100vh", color: PAPER, fontFamily: BODY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 340 }}>{children}</div>
    </div>
  );
}

function PinInput({ value, onChange, placeholder, autoFocus }) {
  return (
    <input
      type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus={autoFocus}
      value={value} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder={placeholder}
      style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "14px 16px", color: PAPER, fontSize: 24, letterSpacing: 8, textAlign: "center", fontFamily: MONO, outline: "none", boxSizing: "border-box" }}
    />
  );
}

function Btn({ children, onClick, variant = "primary", disabled }) {
  const s = {
    primary: { background: GREEN, color: INK, border: "none" },
    secondary: { background: "transparent", color: MUTE, border: `1px solid ${BORDER}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...s[variant], width: "100%", borderRadius: 4, padding: "13px 16px", fontSize: 14, fontFamily: DISPLAY, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

// Gates its children behind a local device lock — Face ID/Touch ID via WebAuthn
// with a PIN fallback. There are no server accounts in this app, so this is a
// privacy screen for the device, not a login system: nothing here is verified
// against a backend, and the lock only ever needs to answer "is this device's
// owner present," which WebAuthn's userVerification can answer locally.
export default function AppLock({ children }) {
  const [phase, setPhase] = useState("checking"); // checking | setup-bio | setup-pin | locked-bio | locked-pin | unlocked
  const [error, setError] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinAttempt, setPinAttempt] = useState("");
  const [lockoutMs, setLockoutMs] = useState(0);
  const attemptedAutoBio = useRef(false);

  useEffect(() => {
    (async () => {
      const avail = await lock.biometricAvailable();
      setBioAvailable(avail);
      if (!lock.isSetUp()) { setPhase(avail ? "setup-bio" : "setup-pin"); return; }
      setPhase(lock.hasCredential() && avail ? "locked-bio" : "locked-pin");
    })();
  }, []);

  // Tick the lockout countdown so the PIN field re-enables on its own.
  useEffect(() => {
    if (phase !== "locked-pin") return;
    const id = setInterval(() => setLockoutMs(lock.pinLockoutRemainingMs()), 500);
    setLockoutMs(lock.pinLockoutRemainingMs());
    return () => clearInterval(id);
  }, [phase]);

  async function tryBiometric() {
    setError("");
    try { await lock.verifyBiometric(); setPhase("unlocked"); }
    catch { setError("Face ID / Touch ID failed or was cancelled."); }
  }

  // Auto-prompt once when the lock screen first appears — saves a tap on the
  // common path, but only ever fires once so a cancel doesn't loop the prompt.
  useEffect(() => {
    if (phase === "locked-bio" && !attemptedAutoBio.current) {
      attemptedAutoBio.current = true;
      tryBiometric();
    }
  }, [phase]);

  async function registerBio() {
    setError("");
    try { await lock.registerBiometric(); setPhase("setup-pin"); }
    catch { setError("Couldn't set up Face ID / Touch ID on this device — you can still set a PIN."); setPhase("setup-pin"); }
  }

  async function submitPinSetup() {
    if (!/^\d{4,6}$/.test(pinDraft)) { setError("PIN must be 4–6 digits."); return; }
    if (pinDraft !== pinConfirm) { setError("PINs don't match."); return; }
    await lock.setPin(pinDraft);
    setPhase("unlocked");
  }

  async function submitPinUnlock() {
    setError("");
    if (lock.pinLockoutRemainingMs() > 0) return;
    const ok = await lock.verifyPin(pinAttempt);
    setPinAttempt("");
    if (ok) setPhase("unlocked");
    else {
      setLockoutMs(lock.pinLockoutRemainingMs());
      setError(lock.pinLockoutRemainingMs() > 0 ? "Too many attempts — try again shortly." : "Incorrect PIN.");
    }
  }

  if (phase === "unlocked") return children;

  if (phase === "checking") {
    return <Screen><div style={{ textAlign: "center", color: MUTE, fontSize: 13 }}>Checking device…</div></Screen>;
  }

  if (phase === "setup-bio") {
    return (
      <Screen>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Set up device lock</div>
          <div style={{ fontSize: 13, color: MUTE, lineHeight: 1.6 }}>Protect this app with Face ID / Touch ID. You'll also set a PIN as a backup in case biometrics aren't available.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={registerBio}>Set up Face ID / Touch ID</Btn>
          <Btn onClick={() => setPhase("setup-pin")} variant="secondary">Skip — use PIN only</Btn>
        </div>
        {error && <div style={{ color: RED, fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</div>}
      </Screen>
    );
  }

  if (phase === "setup-pin") {
    return (
      <Screen>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Set a PIN</div>
          <div style={{ fontSize: 13, color: MUTE }}>Used if Face ID / Touch ID isn't available. 4–6 digits.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <PinInput value={pinDraft} onChange={setPinDraft} placeholder="New PIN" autoFocus />
          <PinInput value={pinConfirm} onChange={setPinConfirm} placeholder="Confirm PIN" />
        </div>
        <Btn onClick={submitPinSetup} disabled={!pinDraft || !pinConfirm}>Save PIN</Btn>
        {error && <div style={{ color: RED, fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</div>}
      </Screen>
    );
  }

  if (phase === "locked-bio") {
    return (
      <Screen>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Locked</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={tryBiometric}>Unlock with Face ID / Touch ID</Btn>
          {lock.hasPin() && <Btn onClick={() => setPhase("locked-pin")} variant="secondary">Use PIN instead</Btn>}
        </div>
        {error && <div style={{ color: RED, fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</div>}
      </Screen>
    );
  }

  // locked-pin
  const locked = lockoutMs > 0;
  return (
    <Screen>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Enter PIN</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <PinInput value={pinAttempt} onChange={setPinAttempt} placeholder="PIN" autoFocus />
      </div>
      <Btn onClick={submitPinUnlock} disabled={!pinAttempt || locked}>
        {locked ? `Try again in ${Math.ceil(lockoutMs / 1000)}s` : "Unlock"}
      </Btn>
      {bioAvailable && lock.hasCredential() && (
        <div style={{ marginTop: 10 }}>
          <Btn onClick={() => setPhase("locked-bio")} variant="secondary">Use Face ID / Touch ID instead</Btn>
        </div>
      )}
      {error && <div style={{ color: RED, fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</div>}
    </Screen>
  );
}
