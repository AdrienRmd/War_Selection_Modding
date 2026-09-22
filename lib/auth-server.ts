// Server-only account/session helpers for email+password authentication.
// Crypto primitives (PBKDF2 hashing, token generation) use only the WebCrypto
// globals so this module stays runnable in unit tests; D1 access and
// next/headers are imported lazily inside the functions that need them, so
// importing this module never pulls `cloudflare:workers` into a test env.
import type { ChatGPTUser } from "@/app/chatgpt-auth";

export const SESSION_COOKIE = "atlas_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

const PBKDF2_ITERATIONS = 120000;
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

// Best-effort anti brute-force throttle, deliberately isolate-local: each
// Worker isolate keeps its own small in-memory counter per email, with no
// shared state and a full reset on deploy/restart. It is a cheap deterrent,
// not a distributed rate limit.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

export function isAuthThrottled(email: string): boolean {
  const entry = failures.get(email.toLowerCase());
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    failures.delete(email.toLowerCase());
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordAuthFailure(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}
