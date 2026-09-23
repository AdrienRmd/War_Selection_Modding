/// <reference types="vite/client" />
// Server-only account/session helpers for email+password authentication.
// Crypto primitives (PBKDF2 hashing, token generation) use only the WebCrypto
// globals so this module stays runnable in unit tests; D1 access and
// next/headers are imported lazily inside the functions that need them, so
// importing this module never pulls `cloudflare:workers` into a test env.
import type { ChatGPTUser } from "@/app/chatgpt-auth";

export const SESSION_COOKIE = "atlas_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

// OWASP Password Storage Cheat Sheet calls for hundreds of thousands of
// PBKDF2 iterations; new hashes use 210,000 (up from the original 120,000).
// hashPassword() only ever emits the current constant while verifyPassword()
// reads the iteration count stored in the hash, so pre-existing 120k hashes
// keep verifying without a migration.
export const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const TOKEN_BYTES = 32;

function b64urlEncode(bytes: Uint8Array): string {
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function deriveBits(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(SALT_BYTES));
  crypto.getRandomValues(salt);
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`;
}

// Well-formed dummy hash (16-byte salt, 32-byte hash) burned for unknown
// emails so signin response timing does not reveal whether the address
// exists. Built from the current PBKDF2_ITERATIONS so the burned work matches
// today's real hashes; verifyPassword() reads the iteration count stored in
// the hash string, so this stays retrocompatible with any legacy count.
export const DUMMY_HASH = `pbkdf2$${PBKDF2_ITERATIONS}$${"A".repeat(22)}$${"A".repeat(43)}`;

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000) return false;
  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array;
  try {
    salt = b64urlDecode(parts[2]);
    expected = b64urlDecode(parts[3]);
  } catch {
    return false;
  }
  if (salt.length === 0) return false;
  // Always derive before any early return so verification burns the same
  // PBKDF2 work whether or not the stored hash is well-formed.
  const actual = await deriveBits(password, salt, iterations);
  if (expected.length !== HASH_BYTES) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

async function db() {
  const { bindings } = await import("@/lib/atlas-server");
  return bindings().DB;
}

// Opaque session token: only its SHA-256 is stored, so a D1 leak cannot be
// replayed. 32 random bytes base64url (~43 chars) is well beyond brute force.
export async function createSession(userId: string): Promise<string> {
  const token = b64urlEncode(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(TOKEN_BYTES))));
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const DB = await db();
  // Opportunistic GC of expired rows, bounded by the expires_at index.
  await DB.batch([
    DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
    DB.prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).bind(tokenHash, userId, expiresAt, now),
  ]);
  return token;
}

export async function sessionUserByToken(token: string | null): Promise<ChatGPTUser | null> {
  if (!token || token.length > 128) return null;
  const tokenHash = await sha256Hex(token);
  const row = await (
    await db()
  )
    .prepare(
      "SELECT u.id AS user_id, u.display_name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    )
    .bind(tokenHash, Date.now())
    .first<{ user_id: string; display_name: string; email: string }>();
  if (!row) return null;
  return { userId: row.user_id, displayName: row.display_name, email: row.email, fullName: null };
}

// Request-context variant (server components / route handlers alike).
export async function getSessionUser(): Promise<ChatGPTUser | null> {
  const { cookies } = await import("next/headers");
  return sessionUserByToken((await cookies()).get(SESSION_COOKIE)?.value || null);
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function destroySession(token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await (await db()).prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

// Reusable GC for expired session rows (cron jobs, opportunistic cleanups...).
export async function deleteExpiredSessions(): Promise<void> {
  await (await db()).prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()).run();
}

// "Sign out everywhere": drop every active session of a user, revoking all
// other devices while keeping multi-device sessions otherwise possible.
export async function revokeAllSessions(userId: string): Promise<void> {
  await (await db()).prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

// Password-change companion to revokeAllSessions(): invalidate every session
// of the user except the one that performed the change, so the current device
// stays signed in while stolen copies of the old password are locked out.
export async function revokeOtherSessions(userId: string, keepToken: string): Promise<void> {
  const keepHash = await sha256Hex(keepToken);
  await (
    await db()
  )
    .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
    .bind(userId, keepHash)
    .run();
}

// ---------------------------------------------------------------------------
// Persisted (D1) brute-force throttling, backed by the auth_attempts table.
//
// Each attempt key ("email:<lower(email)>" or "ip:<ip>") maps to one live
// window row. checkAndRecordFailure() reads the row, starts a fresh window
// when the previous one expired and otherwise bumps the counter while under
// the limit; recordSuccess() clears the row after a successful auth. Counters
// are best-effort: concurrent requests can both slip through a nearly
// exhausted budget, and unavailability of D1 must not break auth flows —
// callers treat a thrown error as "limiting unavailable".
//
// Dev escape hatch: the local scripts/test-*.mjs suites hammer signin/signup
// far beyond any sane budget, so rate limiting is compiled out in dev.
// import.meta.env.DEV is a build-time constant (see app/chatgpt-auth.ts), so
// RATE_LIMITS_ENABLED folds to a literal and every guarded branch vanishes
// from dev bundles; production always enforces the limits.
export const RATE_LIMITS_ENABLED = !import.meta.env.DEV;

export function emailAttemptKey(email: string): string {
  return `email:${email.toLowerCase()}`;
}

export function ipAttemptKey(ip: string): string {
  return `ip:${ip}`;
}

// The site sits behind a trusted reverse proxy configured to RESET
// X-Forwarded-For (Apache kit: `RequestHeader unset X-Forwarded-For early` +
// `RequestHeader set ... "expr=%{REMOTE_ADDR}"`; nginx kit: `$remote_addr`
// instead of $proxy_add_x_forwarded_for). The header therefore contains at
// most the one value our proxy wrote, and any leading hop would be a
// client-forged chain: the LAST hop — the closest to the server, set by the
// proxy we control — is the only trustworthy one, so it is the one used.
// Requests without the header (local dev, direct origin access) collapse into
// the shared "unknown" bucket. The value is capped so it cannot bloat the key.
export function clientIp(req: Request): string {
  const hops = req.headers.get("x-forwarded-for")?.split(",");
  const last = hops?.[hops.length - 1]?.trim();
  return last ? last.slice(0, 64) : "unknown";
}

// Widest window any caller may configure; doubles as the global GC cutoff.
const RATE_WINDOW_CEILING_MS = 60 * 60 * 1000;

export type RateVerdict = { allowed: boolean; retryAfterSec: number };

export async function checkAndRecordFailure(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateVerdict> {
  const now = Date.now();
  const DB = await db();
  const row = await DB.prepare(
    "SELECT window_start, count FROM auth_attempts WHERE attempt_key = ?",
  )
    .bind(key)
    .first<{ window_start: number; count: number }>();
  if (!row || row.window_start + windowMs <= now) {
    // Absent or expired window: open a fresh one and GC stale rows in the
    // same batch (best effort). The upsert absorbs the read/write race.
    await DB.batch([
      DB.prepare("DELETE FROM auth_attempts WHERE window_start < ?").bind(
        now - RATE_WINDOW_CEILING_MS,
      ),
      DB.prepare(
        "INSERT INTO auth_attempts (attempt_key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(attempt_key) DO UPDATE SET window_start = excluded.window_start, count = 1",
      ).bind(key, now),
    ]);
    return { allowed: true, retryAfterSec: 0 };
  }
  if (row.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000)),
    };
  }
  await DB.prepare("UPDATE auth_attempts SET count = count + 1 WHERE attempt_key = ?")
    .bind(key)
    .run();
  return { allowed: true, retryAfterSec: 0 };
}

export async function recordSuccess(key: string): Promise<void> {
  await (await db()).prepare("DELETE FROM auth_attempts WHERE attempt_key = ?").bind(key).run();
}

// ---------------------------------------------------------------------------
// Common-password blacklist.
//
// Embedded top-passwords list (~120 entries, English globals + French
// classics, cf. SecLists/rockyou-style top lists) plus deterministic checks
// for all-repeated and monotonic digit sequences. Comparison is
// case-insensitive and exact: a cheap first line of defense on signup, not a
// strength meter.
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  // EN classics
  "password",
  "password1",
  "password123",
  "password1234",
  "passw0rd",
  "p@ssword",
  "p@ssw0rd",
  "letmein",
  "welcome",
  "welcome1",
  "welcome123",
  "admin",
  "admin123",
  "admin1234",
  "administrator",
  "root",
  "toor",
  "login",
  "guest",
  "test",
  "test123",
  "abc123",
  "iloveyou",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "master",
  "hello",
  "freedom",
  "whatever",
  "trustno1",
  "starwars",
  "superman",
  "batman",
  "spiderman",
  "pokemon",
  "snoopy",
  "shadow",
  "michael",
  "jennifer",
  "jordan",
  "harley",
  "ranger",
  "hunter",
  "buster",
  "charlie",
  "thomas",
  "tigger",
  "pepper",
  "purple",
  "banana",
  "chocolate",
  "cookie",
  "summer",
  // Sports / teams
  "soccer",
  "baseball",
  "football",
  "hockey",
  "basketball",
  "liverpool",
  "chelsea",
  "arsenal",
  "barcelona",
  "realmadrid",
  "psg",
  // Numeric dictionary
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "0987654321",
  "987654321",
  "9876543210",
  "0123456789",
  "123123",
  "112233",
  "111111",
  "000000",
  "121212",
  "123321",
  "654321",
  "159753",
  "147258369",
  "123654789",
  "102030",
  "10203040",
  "12341234",
  "520520",
  "111222",
  "121314",
  "666666",
  "888888",
  // Keyboard rows / patterns (EN + FR layouts)
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "azerty",
  "azerty123",
  "azertyuiop",
  "qwe123",
  "asd123",
  "zxc123",
  "qweasd",
  "asdf",
  "asdfgh",
  "asdfghjkl",
  "zxcvbn",
  "zxcvbnm",
  "qsdfghjklm",
  "wxcvbn",
  "1q2w3e4r",
  "1qaz2wsx",
  "zaq12wsx",
  "qazwsx",
  "qazwsxedc",
  // FR classics
  "motdepasse",
  "motdepasse123",
  "soleil",
  "loulou",
  "louloute",
  "doudou",
  "chouchou",
  "mimi",
  "nounours",
  "marseille",
  "paris",
  "toulouse",
  "bordeaux",
  "lyon",
  "lille",
  "jetaime",
  "chocolat",
  "nicolas",
  "marie",
  "julie",
  "camille",
  "manon",
  "hugo",
]);

// 14 cycles cover any 128-char monotonic run with wrap-around.
const DIGIT_RUN_ASC = "0123456789".repeat(14);
const DIGIT_RUN_DESC = "9876543210".repeat(14);

export function isCommonPassword(password: string): boolean {
  const p = password.toLowerCase();
  if (COMMON_PASSWORDS.has(p)) return true;
  if (/^(.)\1+$/.test(p)) return true; // aaaaaaaaaa, 1111111111...
  if (/^\d{4,}$/.test(p) && (DIGIT_RUN_ASC.includes(p) || DIGIT_RUN_DESC.includes(p))) return true; // 1234567890, 4567890123, 9876543210...
  return false;
}
