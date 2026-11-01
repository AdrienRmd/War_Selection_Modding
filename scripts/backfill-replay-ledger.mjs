#!/usr/bin/env node
/** Backfill du registre profil joueur (V3, 01/11/2026) — outillage local.
 *
 *  Les replays publiés AVANT le 01/11 ont des digests v1 (sans médailles,
 *  unités par âge, records, nations). Ce script recalcule le digest v2 de
 *  chaque replay publié disposant d'une fixture locale
 *  (~/War-Selection/datasets/replays/{wsva,replay}-<code>.json), met à jour
 *  replay_results.data (phase 1), puis reconstruit replay_player_games et
 *  player_stats par SQL direct sur le D1 local (phase 2 — APRÈS application
 *  des digests : le SELECT de rebuild doit lire les données rafraîchies).
 *  Même sémantique que l'endpoint admin POST /api/replay/stats-rebuild.
 *
 *  Usage (depuis la racine du repo, DEV UNIQUEMENT) :
 *    npx tsx scripts/backfill-replay-ledger.mjs [--dry]
 *  Prérequis : backup wrangler-state (règle : sauvegarde avant migration).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetsDir =
  process.env.WUS_DATASETS ?? path.join(root, "..", "War-Selection", "datasets", "replays");
const servedContext = path.join(
  root,
  "..",
  "War-Selection",
  "datasets",
  "served",
  "content",
  "context.json",
);
const dry = process.argv.includes("--dry");

const { ReplayInfoParser } = await import("../lib/replay/parser.ts");
const { buildGameContext } = await import("../lib/replay/context.ts");
const { buildReplayAnalysis } = await import("../lib/replay/analysis.ts");
const { buildReplayDigest } = await import("../lib/replay/digest.ts");
// Pures, dupliquées ici (5 lignes) : lib/replay-stats.ts importe
// cloudflare:workers (runtime worker) — indisponible sous Node/tsx.
const seasonOf = (when) => new Date(when).toISOString().slice(0, 7);
const replaySeason = (startedAtUnixSeconds, fallbackIso) =>
  typeof startedAtUnixSeconds === "number" && startedAtUnixSeconds > 0
    ? seasonOf(startedAtUnixSeconds * 1000)
    : seasonOf(fallbackIso);
const categoryOf = (teamSize) => (teamSize >= 3 ? "big" : "solo");

const d1 = (...args) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--import",
        "./scripts/sites-env.mjs",
        "./node_modules/wrangler/bin/wrangler.js",
        "d1",
        "execute",
        "DB",
        "--local",
        "--config",
        "dist/server/wrangler.json",
        "--persist-to",
        ".wrangler/state",
        "--json",
        ...args,
      ],
      { cwd: root, encoding: "utf8" },
    ),
  );

const sqlLiteral = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(Math.round(v));
  return `'${String(v).replace(/'/g, "''")}'`;
};

const apply = (name, statements) => {
  const file = `/tmp/backfill-${name}.sql`;
  fs.writeFileSync(file, statements.join(";\n") + ";\n");
  d1("--file", file);
};

/* Phase 1 — digests v2 recalculés depuis les fixtures. */
const published = d1(
  "--command",
  "SELECT r.code, r.season, r.category, r.started_at, r.duration_s, r.mode_key, r.team_size, r.region, r.map_code FROM replay_results r JOIN replays p ON p.code = r.code WHERE p.status = 'published'",
);
const rows = published[0]?.results ?? [];
console.log(`[backfill] ${rows.length} replay(s) publié(s) avec digest stocké`);

const context = buildGameContext(JSON.parse(fs.readFileSync(servedContext, "utf8")));
const phase1 = [];
let refreshed = 0;
for (const row of rows) {
  const fixturePath = [
    path.join(datasetsDir, `wsva-${row.code}.json`),
    path.join(datasetsDir, `replay-${row.code}.json`),
  ].find((p) => fs.existsSync(p));
  if (!fixturePath) {
    console.log(`[backfill] ${row.code} : pas de fixture locale → digest v1 conservé`);
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const parser = new ReplayInfoParser(context, `rep-${row.code}`);
  const result = parser.parse(raw);
  if (result.error !== 0) {
    console.log(`[backfill] ${row.code} : parse error ${result.error} → ignoré`);
    continue;
  }
  const analysis = buildReplayAnalysis(result);
  const digest = buildReplayDigest(result, analysis);
  const season = replaySeason(digest.startedAt, row.started_at);
  const category = categoryOf(row.team_size);
  const startedAt = digest.startedAt
    ? new Date(digest.startedAt * 1000).toISOString()
    : row.started_at;
  const now = new Date().toISOString();
  phase1.push(
    `UPDATE replay_results SET data = ${sqlLiteral(JSON.stringify(digest))}, season = ${sqlLiteral(season)}, category = ${sqlLiteral(category)}, started_at = ${sqlLiteral(startedAt)}, duration_s = ${sqlLiteral(digest.durationS)}, region = ${sqlLiteral(digest.region)}, aggregated_at = NULL, updated_at = ${sqlLiteral(now)} WHERE code = ${sqlLiteral(row.code)}`,
  );
  refreshed++;
  console.log(
    `[backfill] ${row.code} : digest v2 recalculé (${digest.players.length} joueurs, ${digest.unitsByAge?.length ?? 0} entrées unités/âge)`,
  );
}
phase1.push("DELETE FROM replay_player_games");
phase1.push("DELETE FROM player_stats");
phase1.push("UPDATE replay_results SET aggregated_at = NULL");
console.log(`[backfill] phase 1 : ${phase1.length} instruction(s), ${refreshed} digest(s) rafraîchi(s)`);
if (dry) {
  apply("dry", phase1.map((s) => `SELECT 1; -- ${s.slice(0, 100)}`));
  console.log("[backfill] --dry : rien d'appliqué");
  process.exit(0);
}
apply("phase1", phase1);

/* Phase 2 — rebuild registre + stats depuis les digets rafraîchis. */
const phase2 = [];
const results = d1(
  "--command",
  "SELECT r.* FROM replay_results r JOIN replays p ON p.code = r.code WHERE p.status = 'published'",
);
const now = new Date().toISOString();
for (const row of results[0]?.results ?? []) {
  let digest;
  try {
    digest = JSON.parse(row.data);
  } catch {
    continue;
  }
  const byName = new Map((digest.unitsByAge ?? []).map(([n, v]) => [n, v]));
  const reach = new Map((digest.ageReach ?? []).map(([n, v]) => [n, v]));
  for (const p of digest.players ?? []) {
    const points = 1 + 2 * (p.w ?? 0) + 2 * (p.m ?? 0) + Math.floor((p.k ?? 0) / 100);
    phase2.push(
      `INSERT OR REPLACE INTO replay_player_games (code, season, category, player_name, won, mvp, impact_pct, mmr, kills, units_lost, points, region, bronze_nation, last_nation, last_age_research, medals, units_by_age, age_reach, started_at, duration_s, team_size, mode_key) VALUES (${[
        row.code,
        row.season,
        row.category,
        p.n,
        p.w ?? 0,
        p.m ?? 0,
        p.s ?? 0,
        p.r ?? null,
        p.k ?? 0,
        p.l ?? 0,
        points,
        row.region,
        p.bn ?? null,
        p.ln ?? null,
        p.la ?? null,
        JSON.stringify(p.md ?? []),
        JSON.stringify(byName.get(p.n) ?? []),
        JSON.stringify(reach.get(p.n) ?? []),
        row.started_at,
        row.duration_s,
        row.team_size,
        row.mode_key,
      ]
        .map(sqlLiteral)
        .join(", ")})`,
    );
  }
  phase2.push(
    `UPDATE replay_results SET aggregated_at = ${sqlLiteral(now)} WHERE code = ${sqlLiteral(row.code)}`,
  );
}
phase2.push(
  `INSERT INTO player_stats (season, category, player_name, games, wins, mvps, kills, losses, points, last_played)
   SELECT season, category, player_name, COUNT(*), SUM(won), SUM(mvp), SUM(kills), SUM(units_lost), SUM(points), MAX(started_at)
   FROM replay_player_games GROUP BY season, category, player_name`,
);
console.log(`[backfill] phase 2 : ${phase2.length} instruction(s) (registre + stats)`);
apply("phase2", phase2);

const check = d1(
  "--command",
  "SELECT (SELECT COUNT(*) FROM replay_player_games) AS ledger, (SELECT COUNT(*) FROM player_stats) AS stats, (SELECT COUNT(*) FROM replay_player_games WHERE medals != '[]') AS avecMedailles, (SELECT COUNT(*) FROM replay_player_games WHERE units_by_age != '[]') AS avecUnites",
);
console.log("[backfill] état final :", JSON.stringify(check[0]?.results ?? []));
