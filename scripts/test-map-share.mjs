import assert from "node:assert/strict";

// V2-P2 — E2E cartes (SB5/SB6/SB7) contre le serveur de dev local :
//   npm run dev  (port 5173)
// Deux identités réelles : un auteur inscrit via /api/auth/signup (non
// admin) et l'admin simulé __sites_local_auth=1 (dévelopement uniquement).
// Parcours : soumission code-only → refus ni-code-ni-zip → avertissements
// modérateur (doublon D6 + format) → approbation → fiche publique (code,
// has_file false, badge créateur vérifié) → statut de test auteur →
// surplomb admin → retrait du doublon.

const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const adminCookie = "__sites_local_auth=1";
const report = [];
function check(name, ok, detail = "") {
  assert.ok(ok, `${name} ${detail}`);
  report.push(`PASS ${name}${detail ? " — " + detail : ""}`);
  console.log("PASS", name, detail);
}

async function api(path, { method = "GET", body, cookie, id, json = true } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (method !== "GET") headers.Origin = origin;
  if (id) headers["X-Submission-Id"] = id;
  let payload = body;
  if (json && body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const r = await fetch(origin + path, { method, headers, body: payload });
  let data = null;
  try {
    data = await r.clone().json();
  } catch {
    data = null;
  }
  return { r, data };
}

function mapForm(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = {
  title: "QA carte code-only（仅本地）",
  author: "Map Author QA",
  summary: "仅用于本地验证分享码投稿流程的测试数据。",
  description:
    "此数据只用于本地测试，不是可玩地图。验证 code-only 投稿、审核、发布与测试状态申报，绝不上传线上。",
  game_version: "QA-local",
  players: "8",
  category: "历史战役",
  mods: "无",
  rights: "true",
};

const stamp = Date.now();
const authorEmail = `qa-map-${stamp}@ws-atlas.test`;
let authorCookie = "";

// ---------------------------------------------------------------- 1. auteur réel
{
  const signup = await api("/api/auth/signup", {
    method: "POST",
    body: { email: authorEmail, password: "carte qa cheval batterie", displayName: "Map Author QA" },
  });
  check("signup auteur 200/201", [200, 201].includes(signup.r.status), String(signup.r.status));
  const cookies = signup.r.headers.getSetCookie?.() || [signup.r.headers.get("set-cookie") || ""];
  const token = cookies.flatMap((c) => [...c.matchAll(/atlas_session=([^;]+)/g)]).map((m) => m[1])[0];
  assert.ok(token, "cookie de session auteur manquant");
  authorCookie = `atlas_session=${token}`;
  const me = await api("/api/atlas/me", { cookie: authorCookie });
  check("auteur authentifié", me.data.signedIn === true);
}

// ---------------------------------------------------------------- 2. SB5 code-only
let mapId = "";
let shareCode = "";
{
  shareCode = `map-${(stamp % 0xffffffff).toString(16).padStart(8, "0")}`;
  const res = await api("/api/atlas/submissions", {
    method: "POST",
    body: mapForm({ ...base, map_code: shareCode }),
    cookie: authorCookie,
    id: crypto.randomUUID(),
    json: false,
  });
  check("soumission code-only 201", res.r.status === 201, `${res.r.status} ${shareCode}`);
  mapId = res.data?.id || "";
}

// contournement direct : ni code ni fichier → 400
{
  const res = await api("/api/atlas/submissions", {
    method: "POST",
    body: mapForm({ ...base, map_code: "" }),
    cookie: authorCookie,
    id: crypto.randomUUID(),
    json: false,
  });
  check("ni code ni ZIP → 400 (requête directe)", res.r.status === 400, String(res.r.status));
}

// ---------------------------------------------------------------- 3. doublon D6 (avertissement)
let dupId = "";
let badId = "";
{
  // Même code que la première carte : variantes d'éditions légitimes →
  // simple avertissement modérateur (D6), jamais un blocage.
  const dup = await api("/api/atlas/submissions", {
    method: "POST",
    body: mapForm({ ...base, title: "QA doublon de code（仅本地）", map_code: shareCode }),
    cookie: authorCookie,
    id: crypto.randomUUID(),
    json: false,
  });
  check("même code accepté (avertissement D6, pas blocage)", dup.r.status === 201, String(dup.r.status));
  dupId = dup.data?.id || "";

  const bad = await api("/api/atlas/submissions", {
    method: "POST",
    body: mapForm({ ...base, title: "QA code invraisemblable（仅本地）", map_code: "not-a-code" }),
    cookie: authorCookie,
    id: crypto.randomUUID(),
    json: false,
  });
  check("code invraisemblable accepté (avertissement, pas blocage)", bad.r.status === 201, String(bad.r.status));
  badId = bad.data?.id || "";
}

// ---------------------------------------------------------------- 4. file admin
{
  const queue = await api("/api/atlas/submissions?scope=admin", { cookie: adminCookie });
  check("file admin accessible", queue.r.status === 200);
  const items = queue.data.items || [];
  const mine = items.find((m) => m.id === mapId);
  const badItem = items.find((m) => m.id === badId);
  check("soumission code-only en file (pending)", mine?.status === "pending");
  check("has_file=false en file", mine?.has_file === false);
  check("author_verified=true (match exact pseudo)", mine?.author_verified === true);
  check("code plausible sans avertissement", mine?.code_implausible === false);
  // Aucun doublon encore approuvé → pas d'avertissement doublon.
  check("doublon: aucun avertissement avant publication", mine?.code_duplicate === false);
  check("format invraisemblable signalé au modérateur", badItem?.code_implausible === true);
}

// ---------------------------------------------------------------- 5. modération → publication
{
  const queue = await api("/api/atlas/submissions?scope=admin", { cookie: adminCookie });
  const mine = queue.data.items.find((m) => m.id === mapId);
  const review = await api(`/api/atlas/review/${mapId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      status: "approved",
      feedback: "QA locale : code vérifié, publication de test.",
      revision: mine.revision,
      checks: ["ownership", "files", "gameplay", "description"],
    },
  });
  check("approbation 200", review.r.status === 200, String(review.r.status));
}

// ---------------------------------------------------------------- 6. fiche publique
{
  const pub = await api(`/api/atlas/maps/${mapId}`);
  check("carte publiée visible", pub.r.status === 200);
  check("code de partage exposé", pub.data.map_code?.startsWith("map-"));
  check("has_file=false (code-only)", pub.data.has_file === false);
  check("statut de test par défaute untested", pub.data.test_status === "untested");
  check("badge créateur vérifié (match exact)", pub.data.author_verified === true);

  const file = await api(`/api/atlas/files/${mapId}`, { cookie: adminCookie });
  check("URL fichier ZIP → 404 (aucun objet R2)", file.r.status === 404, String(file.r.status));

  const html = await fetch(`${origin}/maps/${mapId}`).then((r) => r.text());
  check("fiche HTML contient le code (SSR)", html.includes(pub.data.map_code));
  check("fiche HTML : badge 待实测 (SSR)", html.includes("待实测"));
  check("fiche HTML : mention 由作者申报 (SSR)", html.includes("由作者申报"));
  check("fiche HTML : badge 创作者已验证 (SSR)", html.includes("创作者已验证"));
  check("fiche HTML : pas de bouton ZIP", !html.includes("下载地图 ZIP 包"));

  const submitHtml = await fetch(`${origin}/submit`, {
    headers: { Cookie: authorCookie },
  }).then((r) => r.text());
  check(
    "formulaire /submit pré-remplit l'auteur avec le pseudo (SSR)",
    submitHtml.includes("Map Author QA"),
  );
}

// ---------------------------------------------------------------- 7. SB6 statut de test
{
  const own = await api("/api/atlas/submissions", { cookie: authorCookie });
  const rev = own.data.items.find((m) => m.id === mapId)?.revision;
  const today = new Date().toISOString().slice(0, 10);
  const set = await api(`/api/atlas/test-status/${mapId}`, {
    method: "PATCH",
    cookie: authorCookie,
    body: {
      status: "working",
      tested_at: today,
      game_version: "QA-local",
      notes: "QA locale : 2 parties complètes sans erreur.",
      revision: rev,
    },
  });
  check("auteur déclare « fonctionne »", set.r.status === 200, JSON.stringify(set.data));

  const after = await api(`/api/atlas/maps/${mapId}`);
  check("statut working en public", after.data.test_status === "working");
  check("déclaré par l'auteur", after.data.test_set_by === "author");
  check("notes visibles", (after.data.test_notes || "").includes("QA locale"));
  check("toujours publiée (pas de re-modération)", after.r.status === 200);

  const override = await api(`/api/atlas/test-status/${mapId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      status: "issues",
      tested_at: today,
      notes: "QA locale : surplomb admin — souci signalé.",
      revision: set.data.revision,
    },
  });
  check("surplomb admin accepté", override.r.status === 200, String(override.r.status));
  const final = await api(`/api/atlas/maps/${mapId}`);
  check("surplomb appliqué (issues, admin)", final.data.test_status === "issues" && final.data.test_set_by === "admin");

  // Anonyme ne peut pas déclarer.
  const anon = await api(`/api/atlas/test-status/${mapId}`, {
    method: "PATCH",
    body: { status: "working", tested_at: today, notes: "n", revision: final.data.revision },
  });
  check("anonyme → 401", anon.r.status === 401, String(anon.r.status));
}

// ---------------------------------------------------------------- 8. doublon après publication (D6)
{
  const queue = await api("/api/atlas/submissions?scope=admin", { cookie: adminCookie });
  const items = queue.data.items || [];
  check(
    "D6 : doublon du code publié → avertissement modérateur (pas de blocage)",
    items.find((m) => m.id === dupId)?.code_duplicate === true,
  );
  check(
    "code invraisemblable toujours signalé",
    items.find((m) => m.id === badId)?.code_implausible === true,
  );
}

// ---------------------------------------------------------------- 9. nettoyage (retrait)
{
  const wd1 = await api(`/api/atlas/withdraw/${dupId}`, { method: "POST", cookie: authorCookie });
  check("retrait du doublon", wd1.r.status === 200, String(wd1.r.status));
  const wd2 = await api(`/api/atlas/withdraw/${badId}`, { method: "POST", cookie: authorCookie });
  check("retrait de l'invraisemblable", wd2.r.status === 200, String(wd2.r.status));
}

console.log(`\n${report.length} vérifications PASS`);
