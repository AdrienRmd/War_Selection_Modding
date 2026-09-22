import { access, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Log, LogLevel, Miniflare } from "miniflare";

// Local diagnostic runner, deliberately bypassing Wrangler's ProxyWorker and
// hot-reload controller. Stop Vite/Wrangler before starting; both share local D1.
// Run only after port 5174 is released: node scripts/preview-mod-roles.mjs
// Then, in a second terminal: node scripts/test-mod-roles.mjs
if (process.argv.length > 2) {
  throw new Error("This preview has no host/port overrides; it is locked to 127.0.0.1:5174.");
}
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const serverRoot = path.join(projectRoot, "dist", "server");
const clientRoot = path.join(projectRoot, "dist", "client");
const scriptPath = path.join(serverRoot, "index.js");
const configPath = path.join(serverRoot, "wrangler.json");
const d1Persist = path.join(projectRoot, ".wrangler", "state", "v3", "d1");
const r2Persist = path.join(projectRoot, ".wrangler", "state", "v3", "r2");
const databaseId = "00000000-0000-4000-8000-000000000000";
const host = "127.0.0.1";
const port = 5174;

await Promise.all([access(scriptPath), access(clientRoot), access(d1Persist)]);
const builtConfig = JSON.parse(await readFile(configPath, "utf8"));
if (!builtConfig.d1_databases?.some(database => database.binding === "DB" && database.database_id === databaseId)) {
  throw new Error("Expected the retained local DB binding and placeholder database ID.");
}
if (!builtConfig.r2_buckets?.some(bucket => bucket.binding === "BUCKET" && bucket.bucket_name === "site-creator-r2")) {
  throw new Error("Expected the retained local BUCKET binding.");
}

// Vinext includes dynamic module specifiers. Miniflare's automatic dependency
// visitor rejects those, so declare the existing build modules explicitly.
// The first module is the entrypoint; source files are not rewritten or bundled.
/** @type {import("miniflare").ModuleDefinition[]} */
const modules = [{ type: "ESModule", path: scriptPath }];
for (const name of (await readdir(serverRoot, { recursive: true })).sort()) {
  if (!/\.m?js$/.test(name) || path.join(serverRoot, name) === scriptPath) continue;
  modules.push({ type: "ESModule", path: path.join(serverRoot, name) });
}

// Fail explicitly if an old preview still occupies the intended loopback port.
// Do not stop, replace, or kill another server from this script.
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(port, host, () => probe.close(error => error ? reject(error) : resolve(undefined)));
});

/** @type {import("miniflare").MiniflareOptions} */
const options = {
  name: "ws-atlas-direct-mod-roles",
  host,
  port,
  modules,
  modulesRoot: serverRoot,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  bindings: { ADMIN_EMAILS: "seedy@sites.test" },
  d1Databases: { DB: databaseId },
  d1Persist,
  // The application requires the binding to exist. Role tests are source-only:
  // no file is uploaded and no R2 object is read or written by those tests.
  r2Buckets: { BUCKET: "site-creator-r2" },
  r2Persist,
  assets: {
    directory: clientRoot,
    binding: "ASSETS",
    routerConfig: {
      has_user_worker: true,
      invoke_user_worker_ahead_of_assets: false
    }
  },
  cf: false,
  log: new Log(LogLevel.INFO)
};

const worker = new Miniflare(options);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await worker.dispose();
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void stop().then(() => process.exit(0), error => {
      console.error("Direct Miniflare shutdown failed:", error);
      process.exit(1);
    });
  });
}
try {
  const ready = await worker.ready;
  if (ready.hostname !== host || ready.port !== String(port)) {
    throw new Error("Miniflare started at an unexpected address: " + ready.href);
  }
  console.log(JSON.stringify({
    ready: ready.origin,
    runtime: "Direct Miniflare; no Wrangler ProxyWorker or hot-reload controller",
    localOnly: true,
    databaseId,
    d1Persist,
    assets: clientRoot,
    roleIdentity: "Local trusted-upstream simulation; not production authentication",
    next: "node scripts/test-mod-roles.mjs"
  }, null, 2));
} catch (error) {
  await stop();
  throw error;
}
