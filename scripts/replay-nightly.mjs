#!/usr/bin/env node
// replay-nightly.mjs — récolte automatique des replays (socle SITE, mission
// 07/11 ; option B de l'étude ~/War-Selection/docs/2026-11-07-etude-recolte-
// auto-replays.md). Appelé par scripts/replay-nightly.sh (flock, rapports) ;
// CONVENTION ws-data (cron 02:30 UTC) :
//
//   node --import tsx scripts/replay-nightly.mjs [--dry-run] [--resume]
//        [--backfill N] [--max-fetch N] [--index-url URL] [--api-base URL]
//        [--ingest-url URL] [--state PATH] [--context PATH]
//
// Étapes :
//   1. GET index ws-stats (saveFile) avec ETag If-None-Match → 304 = rien.
//   2. Diff codes inconnus vs état local (fichier JSON d'état, cf. --state).
//   3. Pour chaque code (du plus récent au plus ancien — politesse) :
//      GET games-api (délai inter-req ≥ 1 s, disjoncteur 429 : pauses
//      5→15→30 min, max 3 puis échec propre — patron wus-lib) → parse local
//      (lib/replay via tsx, context wus local) → digest → POST
//      $INGEST_URL/api/replay/ingest (header X-Ingest-Secret).
//
// Garde-fous : --dry-run (aucune écriture réseau ni état), plafonds
// --backfill (défaut 300) et --max-fetch, garde disque (> 90 % sur le FS de
// l'état → backfill sauté + avertissement), UA identifiable, JAMAIS de
// contournement de défi humain, codes historiques « # » ignorés.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";

const UA = "ws-atlas-replay-nightly/1.0 (+https://ws.aremond.ovh)";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const DRY_RUN = flag("dry-run");
const RESUME = flag("resume");
const BACKFILL = Math.max(1, Number(opt("backfill", "300")) || 300);
const MAX_FETCH = Math.max(1, Number(opt("max-fetch", String(BACKFILL))) || BACKFILL);
const INDEX_URL = opt("index-url", "https://ws-stats.pl/saveFile");
const API_BASE = opt("api-base", "https://games-api.warselect.io/getByReplay?code=");
const INGEST_URL = opt("ingest-url", "http://127.0.0.1:8787/api/replay/ingest");
const STATE_PATH = opt(
  "state",
  "/home/ubuntu/War-Selection/datasets/replays/auto-ingest/state.json",
);
const CONTEXT_PATH = opt(
  "context",
  "/home/ubuntu/War-Selection/datasets/served/content/context.json",
);
// Tests : pauses/disjoncteur raccourcis via env (jamais en cron).
const PAUSES_MS = String(process.env.REPLAY_429_PAUSES_MS || "300000,900000,1800000")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0);
const MAX_PAUSES = PAUSES_MS.length;
// Seuils du disjoncteur (patron wus-lib : 15 consécutifs / 50 cumulés) —
// surcharge de TEST UNIQUEMENT (jamais en cron) : REPLAY_429_CONSEC,
// REPLAY_429_CUMUL, REPLAY_429_PAUSES_MS (ms, virgules).
const THRESHOLD_CONSEC = Number(process.env.REPLAY_429_CONSEC || "15") || 15;
const THRESHOLD_CUMUL = Number(process.env.REPLAY_429_CUMUL || "50") || 50;
const MIN_DELAY_MS = Number(process.env.REPLAY_MIN_DELAY_MS || "1000");

const startedAt = Date.now();
const REPORT_FILE = opt("report-file", null);
const report = {
  runId: new Date().toISOString(),
  dryRun: DRY_RUN,
  resume: RESUME,
  durationMs: null,
  index: { status: null, etag: null, etagReused: null, entries: 0 },
  disk: { usedPct: null, backfillSkipped: false },
  fetches: 0,
  ingest: { created: 0, conflict: 0, errors: 0 },
  transient: 0,
  warnings: [],
  parse: { ok: 0, failed: 0 },
  newCodes: 0,
  processed: 0,
  errors: [],
};

const log = (msg) => console.log(`[replay-nightly] ${msg}`);
/** Erreur FATALE du run (disjoncteur, index inaccessible…) → exit ≠ 0. */
const fail = (msg) => {
  report.errors.push(msg.slice(0, 300));
  log(`ERREUR: ${msg}`);
};
/** Anomalie RÉCUPÉRABLE (5xx/timeout/réseau/parse KO passager) : le code
 *  reste pending, repris au run suivant — le run peut se terminer OK. */
const warn = (msg) => {
  report.warnings.push(msg.slice(0, 300));
  log(`ATTENTION: ${msg}`);
};

// ---------- état local (codes vus + ETag) ----------
function loadState() {
  if (!existsSync(STATE_PATH)) return { etag: null, codes: {}, pending: [] };
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    return {
      etag: parsed.etag ?? null,
      codes: parsed.codes ?? {},
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
    };
  } catch {
    return { etag: null, codes: {}, pending: [] };
  }
}
function saveState(state) {
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, STATE_PATH); // atomique
}

// ---------- garde disque (FS de l'état) ----------
function diskUsedPct() {
  try {
    const stat = readFileSync("/proc/mounts", "utf8");
    const target = path.dirname(STATE_PATH);
    // premier mount qui couvre le chemin (heuristique : montage le plus long)
    let best = null;
    for (const line of stat.split("\n")) {
      const [, mnt] = line.split(/\s+/);
      if (mnt && target.startsWith(mnt) && (!best || mnt.length > best.length)) best = mnt;
    }
    if (!best) return null;
    const df = dfOf(best);
    const line = df.split("\n")[1] || "";
    const cols = line.trim().split(/\s+/);
    return Number(cols[4]?.replace("%", "")) || null;
  } catch {
    return null;
  }
}
import { spawnSync } from "node:child_process";
function dfOf(mountPoint) {
  return spawnSync("df", ["-P", mountPoint], { encoding: "utf8" }).stdout || "";
}

// ---------- disjoncteur 429 (patron wus-lib) ----------
let consecutive429 = 0;
let total429 = 0;
let pausesUsed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function breakerOn429() {
  consecutive429 += 1;
  total429 += 1;
  if (consecutive429 >= THRESHOLD_CONSEC || total429 >= THRESHOLD_CUMUL) {
    if (pausesUsed >= MAX_PAUSES) {
      throw new Error(
        `disjoncteur 429 ouvert (${consecutive429} consécutifs / ${total429} cumulés) après ${pausesUsed} pauses — échec propre`,
      );
    }
    const pause = PAUSES_MS[pausesUsed++];
    log(`429 en salve — pause ${Math.round(pause / 60000)} min (palier ${pausesUsed}/${MAX_PAUSES})`);
    await sleep(pause);
  }
}

// ---------- fetch index (ETag) ----------
async function fetchIndex(etag) {
  const headers = { "User-Agent": UA };
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(INDEX_URL, { headers });
  report.index.status = res.status;
  if (res.status === 304) return { notModified: true, etag, body: null };
  if (!res.ok) throw new Error(`index ${INDEX_URL} → HTTP ${res.status}`);
  const body = await res.json();
  report.index.etag = res.headers.get("etag");
  return { notModified: false, etag: res.headers.get("etag"), body };
}

// ---------- fetch un replay ----------
// Classification (revue 07/11) — le code doit-il être consommé ?
//   TRANSIENT (5xx, timeout, erreur réseau) → code PENDING, repris au run
//   suivant ; DÉFINITIF (4xx hors 429, API error) → code VU (on n'insiste
//   pas sur un code refusé par l'API officielle).
async function fetchReplay(code) {
  let res;
  try {
    // Timeout matériel : 30 s — un hang réseau est TRANSIENT, jamais bloquant.
    res = await fetch(`${API_BASE}${code}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { transient: true, error: "réseau/timeout" };
  }
  if (res.status === 429) {
    await breakerOn429();
    return { retry: true };
  }
  consecutive429 = 0; // un 200 remet le compteur
  if (res.status >= 500) return { transient: true, error: `HTTP ${res.status}` };
  if (!res.ok) return { error: `HTTP ${res.status}` }; // 4xx : définitif
  let json;
  try {
    json = await res.json();
  } catch {
    return { transient: true, error: "corps non-JSON" };
  }
  if (json.error !== 0 && json.error !== undefined) return { error: `API error ${json.error}` };
  return { json };
}

// ---------- parse local (lib TS via tsx) → digest ----------
const { ReplayInfoParser } = await import("../lib/replay/parser.ts");
const { buildGameContext } = await import("../lib/replay/context.ts");
const { buildReplayAnalysis } = await import("../lib/replay/analysis.ts");
const { buildReplayDigest } = await import("../lib/replay/digest.ts");
const gameContext = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));

function parseReplay(code, json) {
  const isLegacy = json?.data?.extraData?.["7"] == null;
  const result = new ReplayInfoParser(gameContext, code).parse(json);
  if (result.error !== 0) return { error: result.message };
  const analysis = buildReplayAnalysis(result);
  const mvp = [...result.players].sort((a, b) => (b.mvpScore ?? 0) - (a.mvpScore ?? 0))[0];
  return {
    payload: {
      code,
      source: "auto",
      teamSize: analysis.verdict.teamSize,
      modeKey: analysis.verdict.modeKey,
      mvpName: mvp?.nickname ?? null,
      digest: buildReplayDigest(result, analysis),
    },
  };
}

// ---------- ingest ----------
const INGEST_SECRET = process.env.INGEST_SECRET || "";
async function ingest(payload) {
  if (!INGEST_SECRET) throw new Error("INGEST_SECRET absent de l'environnement (crawler)");
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Ingest-Secret": INGEST_SECRET },
    body: JSON.stringify(payload),
  });
  if (res.status === 201) return { created: true };
  if (res.status === 409) return { conflict: true };
  return { error: `ingest HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
}

// ============================ RUN ============================
try {
  if (!INGEST_SECRET && !DRY_RUN) {
    fail("INGEST_SECRET absent — arrêt (aucune ingestion sans secret)");
    process.exit(2);
  }

  const usedPct = diskUsedPct();
  report.disk.usedPct = usedPct;
  if (usedPct !== null && usedPct > 90) {
    report.disk.backfillSkipped = true;
    log(`AVERTISSEMENT disque ${usedPct}% > 90% sur ${path.dirname(STATE_PATH)} — backfill SAUTÉ`);
  }

  const state = loadState();
  report.index.etagReused = !!state.etag;
  log(`index ${INDEX_URL} (ETag ${state.etag ? "présent" : "absent"})…`);
  const index = await fetchIndex(state.etag);

  // File à traiter : codes inconnus du NOUVEL index (200) — du plus récent
  // au plus ancien (createdAt local UTC+1 : l'ordre suffit, la saison vient
  // de data.start games-api) — OU codes PENDING d'un run précédent (304 :
  // codes vus mais non traités : hors plafond, ou interrompus par 429).
  let queue = [];
  if (index.notModified) {
    log(`304 Not Modified — ${state.pending.length} code(s) en attente de reprise`);
    queue = state.pending.filter((code) => !state.codes[code]);
  } else {
    report.index.entries = Object.keys(index.body ?? {}).length;
    log(`index reçu : ${report.index.entries} entrées (ETag ${index.etag})`);
    const fresh = Object.entries(index.body ?? {})
      .filter(([code, meta]) => /^[A-Za-z0-9]{11}$/.test(code) && meta && typeof meta.createdAt === "string")
      .filter(([code]) => !state.codes[code])
      .filter(([code]) => !state.pending.includes(code))
      .sort((a, b) => (a[1].createdAt < b[1].createdAt ? 1 : -1));
    queue = [...state.pending.filter((code) => !state.codes[code]), ...fresh.map(([code]) => code)];
    state.etag = index.etag ?? state.etag;
  }
  // Idempotence : un code déjà vu de l'état ne repasse jamais.
  queue = queue.filter((code) => !state.codes[code]);
  report.newCodes = queue.length;
  log(`codes à traiter : ${queue.length}${report.disk.backfillSkipped ? " (backfill SAUTÉ — disque)" : ""}`);

  const batch = report.disk.backfillSkipped ? [] : queue.slice(0, Math.min(BACKFILL, MAX_FETCH));
  const processed = new Set(batch);
  for (const code of batch) {
    report.processed += 1;
    await sleep(MIN_DELAY_MS); // ≥ 1 s entre requêtes games-api (politesse)
    report.fetches += 1;
    const fetched = await fetchReplay(code);
    if (fetched.retry) {
      // 429 isolé : code en pending (repris au run suivant), on continue la
      // file (le disjoncteur global tranche en salve).
      continue;
    }
    if (fetched.transient) {
      // 5xx/timeout/réseau : TRANSIENT — code PENDING, non consommé
      // (revue 07/11 : un 502 passager ne doit pas perdre le code).
      report.transient += 1;
      warn(`${code}: fetch ${fetched.error} (transient — repris au prochain run)`);
      continue;
    }
    if (fetched.error) { fail(`fetch ${code}: ${fetched.error}`); state.codes[code] = 1; continue; }
    const parsed = parseReplay(code, fetched.json);
    if (parsed.error) {
      // Parse KO : TRANSIENT au sens reprise (le JSON officiel peut évoluer,
      // le parser aussi) — code PENDING, non consommé (revue 07/11).
      warn(`${code}: parse ${parsed.error} (pending — repris au prochain run)`);
      report.parse.failed += 1;
      continue;
    }
    report.parse.ok += 1;
    if (!DRY_RUN) {
      const result = await ingest(parsed.payload);
      if (result.created) report.ingest.created += 1;
      else if (result.conflict) report.ingest.conflict += 1;
      else if (result.warning === "stats-pending") {
        // Publié mais stats non agrégées (assainissement serveur) : le
        // replay_results reste aggregated_at=NULL, rattrapé plus tard — le
        // code est VU (le replay EST en base, re-POST = 409).
        report.ingest.created += 1;
        warn(`${code}: publié avec stats en attente (agrégation différée)`);
      } else if (result.error && /HTTP 4[0-9][0-9]/.test(result.error)) {
        // 4xx DÉTERMINISTE du site (payload refusé) : notre bug — marquer le
        // code pour ne pas boucler chaque nuit, et échouer le run (visible).
        state.codes[code] = 1;
        fail(`ingest ${code}: ${result.error} (code marqué — payload déterministe refusé)`);
        continue;
      } else {
        // 5xx ingest : TRANSIENT — code PENDING, repris au run suivant.
        warn(`${code}: ingest ${result.error} (transient — repris au prochain run)`);
        continue;
      }
      state.codes[code] = 1; // créé, 409 ou stats-pending : le replay EST en base
    } else {
      log(`dry-run ${code}: digest prêt (${parsed.payload.teamSize}v${parsed.payload.teamSize})`);
    }
  }
  // ÉTAT : codes traités avec succès marqués vus ; les autres (hors plafond,
  // 429, erreur ingest) restent PENDING pour le prochain run (--resume).
  // En salve 429 (disjoncteur ouvert) on n'écrit RIEN : reprise intégrale.
  if (!DRY_RUN) {
    state.pending = queue.filter((code) => !state.codes[code]);
    saveState(state);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  report.durationMs = Date.now() - startedAt;
  process.exitCode = report.errors.length > 0 ? 1 : 0;
  if (REPORT_FILE) {
    mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
}
