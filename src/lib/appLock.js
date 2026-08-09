// Local device lock: WebAuthn biometric (Face ID / Touch ID) with a PIN fallback.
// The app has no server-side accounts — there's nothing to "log in" to — so this
// is a local privacy screen, not an authentication system. WebAuthn's create()/get()
// only resolve after the OS confirms user verification (biometric or device passcode),
// so a successful call is a reliable local signal even without server-side
// signature verification, which isn't needed here since nothing is being protected
// remotely.

const CREDENTIAL_KEY = "applock_credential_id";
const PIN_KEY = "applock_pin"; // JSON {salt, hash}
const ATTEMPTS_KEY = "applock_pin_attempts";
const LOCKOUT_KEY = "applock_pin_lockout_until";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export function describeWebAuthnError(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError") return "Face ID / Touch ID was cancelled, denied, or timed out.";
  if (name === "SecurityError") return "This page's address doesn't match what the credential expects — try closing and reopening the app.";
  if (name === "InvalidStateError") return "A credential already exists for this device.";
  if (name === "NotSupportedError") return "This browser/device doesn't support the requested authenticator type.";
  if (name === "AbortError") return "The request was aborted.";
  if (name === "ConstraintError") return "Face ID / Touch ID isn't available to the browser on this device.";
  return err?.message || "Something went wrong with Face ID / Touch ID.";
}

export function hasCredential() {
  return !!localStorage.getItem(CREDENTIAL_KEY);
}
export function hasPin() {
  return !!localStorage.getItem(PIN_KEY);
}
export function isSetUp() {
  return hasPin(); // PIN is always required; biometric is an optional layer on top
}

export async function biometricAvailable() {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

function randomBytes(n) {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function registerBiometric() {
  if (!window.PublicKeyCredential) throw new Error("WebAuthn isn't supported in this browser.");
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Recovery Log", id: window.location.hostname },
      user: { id: randomBytes(16), name: "gustavo", displayName: "Gustavo" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!credential) throw new Error("No credential returned");
  localStorage.setItem(CREDENTIAL_KEY, bufToBase64(credential.rawId));
}

export async function verifyBiometric() {
  const storedId = localStorage.getItem(CREDENTIAL_KEY);
  if (!storedId) throw new Error("No biometric credential registered on this device");
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: window.location.hostname,
      allowCredentials: [{ id: base64ToBuf(storedId), type: "public-key", transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function setPin(pin) {
  const salt = bufToBase64(randomBytes(16));
  const hash = await sha256Hex(salt + pin);
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash }));
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

export function pinLockoutRemainingMs() {
  const until = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
  return Math.max(0, until - Date.now());
}

export async function verifyPin(pin) {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) throw new Error("No PIN set on this device");
  const { salt, hash } = JSON.parse(stored);
  const attemptHash = await sha256Hex(salt + pin);
  if (attemptHash === hash) {
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_KEY);
    return true;
  }
  const attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    localStorage.removeItem(ATTEMPTS_KEY);
  }
  return false;
}

// Exposed for a future "reset lock" settings action — not wired to any UI yet.
export function resetLock() {
  localStorage.removeItem(CREDENTIAL_KEY);
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}
