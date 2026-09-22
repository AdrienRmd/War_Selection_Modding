/// <reference types="vite/client" />

// Worker entry wrapping the vinext fetch handler.
//
// The `oai-authenticated-user-*` request headers are only trustworthy when
// injected by the hosting platform. When this Worker runs standalone on
// Cloudflare, a direct client could forge them to impersonate a signed-in
// user, so they are stripped from every incoming request before vinext sees
// it. In `vinext dev` the sites-vite-plugin simulates local sign-in by
// injecting those headers at the middleware layer before this Worker runs
// (loopback connections only), so development short-circuits the strip to
// keep the simulation intact. Vite replaces `import.meta.env.DEV` with a
// build-time constant, so the production bundle keeps an unconditional
// strip.
import vinextHandler from "vinext/server/fetch-handler";

// vinext's published types resolve its worker entry through a build-time
// virtual module ("virtual:vinext-worker-entry"), which plain tsc cannot
// type. Pin the expected shape here instead of letting the import stay
// implicitly untyped. The default `Request` generic is intentionally wide:
// it accepts both incoming requests and copies rebuilt via the Request
// constructor.
const handler = vinextHandler as {
  fetch: (
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ) => Response | Promise<Response>;
};

const IDENTITY_HEADER_PREFIX = "oai-authenticated-user-";

function hasIdentityHeader(request: Request): boolean {
  for (const name of request.headers.keys()) {
    if (name.toLowerCase().startsWith(IDENTITY_HEADER_PREFIX)) {
      return true;
    }
  }
  return false;
}

function withoutIdentityHeaders(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.startsWith(IDENTITY_HEADER_PREFIX)) {
      headers.delete(name);
    }
  }
  // The copy constructor preserves method, body and all other request
  // properties; only the headers are replaced.
  return new Request(request, { headers });
}

// In production the trusted reverse proxy (Apache on the VPS) talks plain
// HTTP to the loopback worker, so `request.url` is built as
// "http://ws.aremond.ovh/..." while browsers actually sent "https://..."
// (the `Origin` header included). The proxy transmits the real protocol in
// X-Forwarded-Proto: when it reports https, rewriting the URL scheme keeps
// `req.url` consistent for the same-origin check (lib/atlas-server.ts), the
// Secure-cookie decision (isSecure) and every piece of code building
// absolute URLs. Anything else (no header, plain http hop, already-https
// URL) is returned untouched, so local development is unaffected.
//
// Bodies must be buffered before rebuilding: wiring the live body stream
// through a Request copy makes workerd restart mid-request whenever the
// handler ends up not consuming it (a 403 same-origin rejection, for
// instance). Handlers buffer whole bodies in memory anyway (limitedBody),
// so this only front-loads the same copy.
async function withProxiedHttpsUrl(request: Request): Promise<Request> {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto !== "https" || !request.url.startsWith("http://")) return request;
  const httpsUrl = `https://${request.url.slice("http://".length)}`;
  if (request.method === "GET" || request.method === "HEAD")
    return new Request(httpsUrl, request);
  const body = await request.arrayBuffer();
  return new Request(httpsUrl, {
    method: request.method,
    headers: request.headers,
    body,
  });
}

// Applied to every outgoing response so the Worker stays self-sufficient on
// Cloudflare. No HSTS header: Apache owns it in production and it would break
// plain-http local development. `X-Content-Type-Options` duplicates Apache on
// purpose; identical values stay idempotent.
const SECURITY_HEADERS: readonly (readonly [string, string])[] = [
  ["x-frame-options", "DENY"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ["x-content-type-options", "nosniff"],
  [
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  ],
];

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of SECURITY_HEADERS) {
    // Skip headers the app already set: browsers only honor one CSP
    // (multiple policies intersect), so overriding it could break the app.
    if (headers.get(name) === null) {
      headers.set(name, value);
    }
  }
  // Rebuilding with `response.body` passes the stream through without
  // consuming it. Body-less statuses (204, 304, ...) reject the constructor,
  // in which case the response is returned untouched.
  try {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

export default {
  async fetch(request, env, ctx) {
    // Dev short-circuit: see the file comment. Keep this check first so the
    // simulated identity injected by the dev middleware reaches vinext.
    if (import.meta.env.DEV) {
      return applySecurityHeaders(await handler.fetch(request, env, ctx));
    }
    // Fast path: leave untouched requests completely unmodified.
    const strippedRequest = hasIdentityHeader(request)
      ? withoutIdentityHeaders(request)
      : request;
    // Still prod-only (see the dev short-circuit above): the Apache proxy
    // fronting the standalone worker reports the browser-facing scheme.
    const sanitizedRequest = await withProxiedHttpsUrl(strippedRequest);
    return applySecurityHeaders(await handler.fetch(sanitizedRequest, env, ctx));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
