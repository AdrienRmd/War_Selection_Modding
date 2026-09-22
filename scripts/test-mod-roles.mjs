import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// LOCAL TRUSTED-UPSTREAM SIMULATION ONLY.
// The retained built Worker trusts upstream identity headers. This script tests
// application role checks, not real sign-in or production header authenticity.
// Never point it at a public host or the cookie-based dev dispatcher.
const origin = "http://127.0.0.1:5174";
if (process.argv[2] && process.argv[2] !== origin) {
  throw new Error("Local role tests are locked to http://127.0.0.1:5174.");
}
// Each isolated local run gets fresh simulated identities; this keeps repeated
// diagnostics independent of earlier runs' daily fixture counts.
const roleRunSuffix = randomUUID();
const ownerA = { id: "qa_mod_roles_owner_a_" + roleRunSuffix, email: "mod-owner-a@example.invalid" };
const ownerB = { id: "qa_mod_roles_owner_b_" + roleRunSuffix, email: "mod-owner-b@example.invalid" };
const admin = { id: "qa_mod_roles_admin", email: "seedy@sites.test" };
const id = randomUUID();
const checks = ["ownership", "files", "gameplay", "description"];
const bodyKeys = [
  "title", "title_en", "author", "summary", "summary_en", "description",
  "description_en", "instructions", "instructions_en", "compatibility",
  "compatibility_en", "game_version", "mod_code", "source_url", "license",
  "map_slug", "kind", "usage_status"
];
const fixture = {
  title: "QA Local Mod Role Isolation",
  title_en: "QA Local Mod Role Isolation",
  author: "Local Role Fixture",
  summary: "Synthetic source-only record for local authorization tests; not game content.",
  summary_en: "Synthetic source-only record for local authorization tests; not game content.",
  description: "This record verifies owner isolation and administrator moderation in a local built Worker. It contains no file or executable script and does not claim game compatibility.",
  description_en: "This record verifies owner isolation and administrator moderation in a local built Worker. It contains no file or executable script and does not claim game compatibility.",
  instructions: "Local API fixture only. No installation or gameplay test is intended.",
  instructions_en: "Local API fixture only. No installation or gameplay test is intended.",
  compatibility: "Not game tested.",
  compatibility_en: "Not game tested.",
  game_version: "",
  mod_code: "",
  source_url: "https://github.com/AdrienRmd/War_Selection_Modding",
  license: "",
  map_slug: "",
  kind: "tutorial",
  usage_status: "testing"
};
const passed = [];
const cleanup = [];
let createAttempted = false;
let failure;

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  passed.push(name);
  console.log("PASS", name);
}
function form(value, revision = value.revision ?? 0) {
  const result = new FormData();
  for (const key of bodyKeys) result.set(key, String(value[key] ?? ""));
  result.set("revision", String(revision));
  result.set("rights", "true");
  return result;
}
async function call(path, { user = null, method = "GET", body, submissionId, headers = {} } = {}) {
  if (!path.startsWith("/api/")) throw new Error("Only local API paths are permitted.");
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("Only the locked local origin is permitted.");
  const response = await fetch(url, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(user ? {
        "oai-authenticated-user-id": user.id,
        "oai-authenticated-user-email": user.email
      } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...(submissionId ? { "X-Submission-Id": submissionId } : {}),
      ...headers
    },
    body
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* Report non-JSON error below. */ }
  return { status: response.status, data, text };
}
async function getEntry(user) {
  const result = await call("/api/mods/" + id, { user });
  assert.equal(result.status, 200, result.text);
  assert.ok(result.data?.item);
  return result.data.item;
}
async function list(path, user) {
  const result = await call(path, { user });
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.data?.items));
  return result.data.items;
}
function review(user, revision) {
  return call("/api/mods/review/" + id, {
    user, method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "approved", revision, checks,
      feedback: "LOCAL ROLE TEST: synthetic checklist only; gameplay not tested."
    })
  });
}
function withdraw(user, revision) {
  return call("/api/mods/withdraw/" + id, {
    user, method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision })
  });
}
function redact(name, item, privateFeedback = false) {
  const forbidden = ["owner_id", "file_key", "review_token", "body"];
  if (!privateFeedback) forbidden.push("feedback");
  check(name, forbidden.filter(key => Object.hasOwn(item, key)), []);
}
function onlyError(name, result, status) {
  if (result.status !== status) {
    assert.equal(result.status, status, name + " status; response: " + result.text.slice(0, 800));
  }
  check(name + " status", result.status, status);
  check(name + " reveals no record fields", Object.keys(result.data ?? {}).sort(), ["error"]);
}

try {
  for (const [name, user, expectedAdmin] of [
    ["owner A", ownerA, false], ["owner B", ownerB, false], ["administrator", admin, true]
  ]) {
    const me = await call("/api/atlas/me", { user });
    check(name + " simulated identity has intended role",
      { status: me.status, signedIn: me.data?.signedIn, admin: me.data?.admin },
      { status: 200, signedIn: true, admin: expectedAdmin });
  }
  const anonymous = await call("/api/atlas/me");
  check("missing simulated headers remain anonymous", anonymous.data?.signedIn, false);
  onlyError("missing file target", await call("/api/mods/files"), 404);
  onlyError("authenticated missing file target", await call("/api/mods/files", { user: ownerA }), 404);
  onlyError("anonymous management access", await call("/api/mods/submissions"), 401);
  onlyError("non-admin A cannot access admin scope", await call("/api/mods/submissions?scope=admin", { user: ownerA }), 403);
  onlyError("non-admin B cannot access admin scope", await call("/api/mods/submissions?scope=admin", { user: ownerB }), 403);

  createAttempted = true;
  const created = await call("/api/mods", {
    user: ownerA, method: "POST", submissionId: id, body: form(fixture)
  });
  check("non-admin A creates one source-only UUID record", created.status, 201);
  check("new non-admin submission is pending", created.data.item.status, "pending");
  check("source-only fixture never creates a file", created.data.item.has_file, false);
  check("owner A receives edit permission", created.data.item.editable, true);
  redact("owner response has no internal identifiers", created.data.item, true);

  onlyError("anonymous pending detail", await call("/api/mods/" + id), 404);
  onlyError("anonymous fileless pending download", await call("/api/mods/files/" + id), 404);
  onlyError("owner B pending detail", await call("/api/mods/" + id, { user: ownerB }), 404);
  // No R2 object exists. These calls reject at authorization/file-key checks.
  onlyError("owner B pending download", await call("/api/mods/files/" + id, { user: ownerB }), 404);
  onlyError("owner A fileless download", await call("/api/mods/files/" + id, { user: ownerA }), 404);
  onlyError("owner B cannot edit A's record", await call("/api/mods/" + id, {
    user: ownerB, method: "PATCH", body: form(created.data.item)
  }), 404);
  onlyError("owner B cannot withdraw A's record", await withdraw(ownerB, created.data.item.revision), 404);
  onlyError("owner B cannot review A's record", await review(ownerB, created.data.item.revision), 403);
  onlyError("owner A cannot approve own submission", await review(ownerA, created.data.item.revision), 403);
  onlyError("other owner cannot reuse submission UUID", await call("/api/mods", {
    user: ownerB, method: "POST", submissionId: id, body: form(fixture)
  }), 409);

  check("owner A personal list includes own pending record",
    (await list("/api/mods/submissions", ownerA)).some(item => item.id === id), true);
  check("owner B personal list hides A's pending record",
    (await list("/api/mods/submissions", ownerB)).some(item => item.id === id), false);
  check("administrator My Submissions hides another owner's private community record",
    (await list("/api/mods/submissions", admin)).some(item => item.id === id), false);
  check("administrator explicit admin scope includes private community record",
    (await list("/api/mods/submissions?scope=admin", admin)).some(item => item.id === id), true);
  check("public list hides pending record",
    (await list("/api/mods", null)).some(item => item.id === id), false);

  const aRead = await getEntry(ownerA);
  check("owner A can read own private content", aRead.title, fixture.title);
  const editedFixture = { ...aRead, summary: "Edited by the actual non-admin owner; still a synthetic local pending record." };
  const edited = await call("/api/mods/" + id, {
    user: ownerA, method: "PATCH", body: form(editedFixture)
  });
  check("non-admin owner A can edit pending record", edited.status, 200);
  check("non-admin edit remains pending", edited.data.item.status, "pending");
  check("non-admin edit advances revision", edited.data.item.revision, aRead.revision + 1);
  onlyError("stale non-admin owner edit rejected", await call("/api/mods/" + id, {
    user: ownerA, method: "PATCH", body: form(editedFixture)
  }), 409);
  const curated = await call("/api/mods/ground-balance", { user: ownerA });
  check("ordinary user can read public curated metadata", curated.status, 200);
  check("ordinary user cannot edit curated metadata", curated.data.item.editable, false);
  onlyError("non-admin curated PATCH rejected", await call("/api/mods/ground-balance", {
    user: ownerA, method: "PATCH", body: form(curated.data.item)
  }), 404);

  const adminRead = await getEntry(admin);
  check("administrator can inspect pending record", adminRead.status, "pending");
  check("administrator receives edit permission", adminRead.editable, true);
  redact("administrator detail still redacts internal keys", adminRead, true);
  check("administrator can approve owner A's fixture", (await review(admin, adminRead.revision)).status, 200);
  const approvedAnonymous = await getEntry(null);
  check("approved detail is publicly readable", approvedAnonymous.status, "approved");
  check("public detail is not editable", approvedAnonymous.editable, false);
  redact("approved anonymous detail redacts internal and review fields", approvedAnonymous);
  const approvedOther = await getEntry(ownerB);
  check("owner B may read approved public record", approvedOther.status, "approved");
  check("approval does not give owner B edit rights", approvedOther.editable, false);
  onlyError("owner B still cannot edit approved record", await call("/api/mods/" + id, {
    user: ownerB, method: "PATCH", body: form(approvedOther)
  }), 404);
  check("administrator My Submissions still excludes another owner's community record",
    (await list("/api/mods/submissions", admin)).some(item => item.id === id), false);

  const approvedOwner = await getEntry(ownerA);
  const revised = await call("/api/mods/" + id, {
    user: ownerA, method: "PATCH",
    body: form({ ...approvedOwner, summary: "Post-approval edit by owner A must return this local fixture to pending review." })
  });
  check("non-admin owner can revise an approved record", revised.status, 200);
  check("non-admin approved edit requires fresh review", revised.data.item.status, "pending");
  onlyError("owner B loses access after owner edit", await call("/api/mods/" + id, { user: ownerB }), 404);
  onlyError("anonymous loses access after owner edit", await call("/api/mods/" + id), 404);
  check("administrator personal scope stays isolated after owner edit",
    (await list("/api/mods/submissions", admin)).some(item => item.id === id), false);
} catch (error) {
  failure = error;
} finally {
  if (createAttempted) {
    try {
      const read = await call("/api/mods/" + id, { user: ownerA });
      if (read.status === 200) {
        if (read.data.item.status !== "withdrawn") {
          const result = await withdraw(ownerA, read.data.item.revision);
          assert.equal(result.status, 200, "Owner A cleanup withdrawal: " + result.text);
        }
        check("owner A cleanup leaves record withdrawn", (await getEntry(ownerA)).status, "withdrawn");
        onlyError("withdrawn record stays private from B", await call("/api/mods/" + id, { user: ownerB }), 404);
        onlyError("withdrawn record stays private anonymously", await call("/api/mods/" + id), 404);
        cleanup.push("Source-only community fixture withdrawn by owner A; local audit record retained, no file uploaded.");
      } else if (read.status === 404) {
        cleanup.push("No fixture was committed.");
      } else {
        throw new Error("Could not inspect cleanup state: " + read.status + " " + read.text);
      }
    } catch (error) {
      cleanup.push("FAILED: " + error.message);
      failure = failure ? new AggregateError([failure, error], "Test and cleanup failed") : error;
    }
  }
  console.log(JSON.stringify({
    passed: passed.length, result: failure ? "FAILED" : "PASSED",
    scope: origin + " — local trusted-upstream identity-header simulation only",
    communityRecord: createAttempted ? id : null,
    cleanup,
    limitations: [
      "Does not verify production sign-in or the authenticity/stripping of upstream identity headers.",
      "No uploaded file or R2 object request; no script execution or gameplay validation.",
      "No quota saturation; one new UUID source-only fixture is reused throughout."
    ]
  }, null, 2));
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
