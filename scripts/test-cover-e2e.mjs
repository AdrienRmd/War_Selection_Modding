// V2-P4-fix — E2E local (mode production, base scratch .wrangler/state-e2e-p4fix)
// Preuve complète MINEUR #3 : couverture PNG avec EXIF/tEXt soumise → approuvée
// → SERVIE purgée via /api/atlas/files/{id}?type=cover. Plus contrôles bonus
// MAJEUR #1 (pseudo unique PATCH) en mode production réel.
// Usage : node scripts/test-cover-e2e.mjs http://127.0.0.1:8799
// Serveur : wrangler dev --config dist/server/wrangler.json --local
//   --persist-to <scratch> --ip 127.0.0.1 --port 8799
//   --var ADMIN_EMAILS:<email admin de test>  (l'approbation exige un admin
//   réel ; le shim __sites_local_auth n'existe qu'en dev). Migrations
//   0000→0009 appliquées au scratch avant lancement.
import assert from "node:assert/strict";

const origin = process.argv[2] || "http://127.0.0.1:8799";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const report = [];
function check(name, ok, detail = "") {
  assert.ok(ok, `${name} ${detail}`);
  report.push(`PASS ${name}${detail ? " — " + detail : ""}`);
  console.log("PASS", name, detail);
}

async function api(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  if (method !== "GET") h.Origin = origin;
  let payload = body;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return fetch(origin + path, { method, headers: h, body: payload });
}

async function signup(email, displayName) {
  const r = await api("/api/auth/signup", {
    method: "POST",
    body: { email, password: "correct-horse-42", displayName },
  });
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  return { status: r.status, cookie };
}

// PNG minimal avec chunks eXIf (GPS factice) + tEXt (commentaire secret).
const chars = (s) => Array.from(s).map((c) => c.charCodeAt(0));
const chunk = (type, data) => {
  const body = [
    data.length >>> 24,
    (data.length >>> 16) & 255,
    (data.length >>> 8) & 255,
    data.length & 255,
  ];
  return [...body, ...Array.from(type).map((c) => c.charCodeAt(0)), ...data, 1, 2, 3, 4];
};
const pngWithExif = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  ...chunk("IHDR", new Array(13).fill(1)),
  ...chunk("eXIf", chars("GPS 48.8584,2.2945 EXIF-SECRET")),
  ...chunk("tEXt", [...chars("Auteur"), 0, ...chars("Commentaire secret P4")]),
  ...chunk("IDAT", [1, 2, 3, 4]),
  ...chunk("IEND", []),
]);
const textOf = (bytes) =>
  Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");

const rand = Math.random().toString(36).slice(2, 8);

// --- 1. comptes (auteur 1, voleur 2, admin via ADMIN_EMAILS local)
const a1 = await signup(`e2e-a1-${rand}@example.test`, "E2E Cover Author");
check("signup auteur 201", a1.status === 201, String(a1.status));
const thief = await signup(`e2e-thief-${rand}@example.test`, "E2E Thief");
check("signup voleur 201", thief.status === 201, String(thief.status));
const adminMail = process.env.E2E_ADMIN_EMAIL || "adrien.remond@protonmail.com";
// L'email admin doit être EXACTEMENT celui d'ADMIN_EMAILS (isAdmin compare
// l'email de session à la liste) — signup direct sur la base scratch locale.
const adminExact = await signup(adminMail, "E2E Admin Run");
check("signup admin (email ADMIN_EMAILS) 201", adminExact.status === 201, String(adminExact.status));

// --- 2. MAJEUR #1 : le voleur ne peut pas prendre le pseudo de l'auteur
const steal = await api("/api/account/profile", {
  method: "PATCH",
  cookie: thief.cookie,
  body: { displayName: "e2e cover author" }, // casse différente
});
check("PATCH vers pseudo pris → 400", steal.status === 400, String(steal.status));

// --- 3. soumission avec couverture EXIF
const id = crypto.randomUUID();
const form = new FormData();
form.set("title", "E2E cover EXIF (scratch local)");
form.set("author", "E2E Cover Author");
form.set("summary", "Soumission locale scratch pour prouver la purge EXIF des couvertures.");
form.set("description", "Description locale suffisamment longue pour la validation du formulaire de soumission E2E.");
form.set("game_version", "QA-local");
form.set("players", "8");
form.set("category", "历史战役");
form.set("mods", "无");
form.set("map_code", `map-e2e${rand}`);
form.set("rights", "true");
form.set("cover", new File([pngWithExif], "cover.png", { type: "image/png" }));
const sub = await api("/api/atlas/submissions", {
  method: "POST",
  cookie: a1.cookie,
  headers: { "X-Submission-Id": id },
  body: form,
});
check("soumission avec cover EXIF → 201", sub.status === 201, String(sub.status));

// --- 4. approbation admin (4 checks obligatoires)
const queue = await (await api("/api/atlas/submissions?scope=admin", { cookie: adminExact.cookie })).json();
const mine = queue.items.find((i) => i.id === id);
check("visible en file admin", !!mine);
const rev = await api(`/api/atlas/review/${id}`, {
  method: "PATCH",
  cookie: adminExact.cookie,
  body: {
    status: "approved",
    feedback: "Approbation E2E locale scratch (EXIF cover).",
    revision: mine.revision,
    checks: ["ownership", "files", "gameplay", "description"],
  },
});
check("approbation → 200", rev.status === 200, String(rev.status));

// --- 5. la couverture SERVIE est purgée
const served = await api(`/api/atlas/files/${id}?type=cover`);
check("GET cover servi → 200", served.status === 200, String(served.status));
check("Content-Type = inspection serveur (image/png)", (served.headers.get("content-type") || "").startsWith("image/png"));
check("CSP sandbox inchangée", (served.headers.get("content-security-policy") || "").includes("sandbox"));
const servedBytes = new Uint8Array(await served.arrayBuffer());
const servedText = textOf(servedBytes);
check("servi SANS eXIf/GPS", !servedText.includes("eXIf") && !servedText.includes("GPS"));
check("servi SANS tEXt/secret", !servedText.includes("tEXt") && !servedText.includes("Commentaire secret"));
check("image conservée (IHDR présent)", servedText.includes("IHDR"));
check("taille servie < taille envoyée (métadonnées retirées)", servedBytes.length < pngWithExif.length, `${servedBytes.length} < ${pngWithExif.length}`);

console.log(`\n${report.length} checks PASS — E2E cover EXIF purgé (scratch local, mode production).`);
