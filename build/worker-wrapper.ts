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

export default {
  async fetch(request, env, ctx) {
    // Dev short-circuit: see the file comment. Keep this check first so the
    // simulated identity injected by the dev middleware reaches vinext.
    if (import.meta.env.DEV) {
      return handler.fetch(request, env, ctx);
    }
    // Fast path: leave untouched requests completely unmodified.
    const sanitizedRequest = hasIdentityHeader(request)
      ? withoutIdentityHeaders(request)
      : request;
    return handler.fetch(sanitizedRequest, env, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
