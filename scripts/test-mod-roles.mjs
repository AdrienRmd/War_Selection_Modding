import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// LOCAL DEV-SERVER SESSION TEST ONLY.
// Accounts are created through the real /api/auth/signup endpoint (falling
// back to /api/auth/signin when they already exist) and every scenario runs
// with the issued atlas_session cookie. The administrator uses the dev
// dispatcher shim (__sites_local_auth=1 → seedy@sites.test via ADMIN_EMAILS).
// Never point this script at a public host.
const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
  throw new Error("Local role tests are locked to a localhost origin.");
}
const password = "qa-local-password-123";
// Real per-run accounts; cookies are filled in by establishAccounts below.
const ownerA = {
  email: "mod-owner-a@test.local",
  displayName: "QA Mod Owner A",
  cookie: null,
};
const ownerB = {
  email: "mod-owner-b@test.local",
  displayName: "QA Mod Owner B",
  cookie: null,
};
const admin = "__sites_local_auth=1";
const id = randomUUID();
const checks = ["ownership", "files", "gameplay", "description"];
const bodyKeys = [
  "title",
  "title_en",
  "author",
  "summary",
  "summary_en",
  "description",
  "description_en",
  "instructions",
  "instructions_en",
  "compatibility",
  "compatibility_en",
  "game_version",
  "mod_code",
  "source_url",
  "license",
  "map_slug",
  "kind",
  "usage_status",
];
const fixture = {
  title: "QA Local Mod Role Isolation",
  title_en: "QA Local Mod Role Isolation",
  author: "Local Role Fixture",
  summary: "Synthetic source-only record for local authorization tests; not game content.",
  summary_en: "Synthetic source-only record for local authorization tests; not game content.",
  description:
    "This record verifies owner isolation and administrator moderation in a local dev server. It contains no file or executable script and does not claim game compatibility.",
  description_en:
    "This record verifies owner isolation and administrator moderation in a local dev server. It contains no file or executable script and does not claim game compatibility.",
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
  usage_status: "testing",
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
async function call(
  path,
  { cookie = null, method = "GET", body, submissionId, headers = {} } = {},
) {
  if (!path.startsWith("/api/")) throw new Error("Only local API paths are permitted.");
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("Only the locked local origin is permitted.");
  const response = await fetch(url, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...(submissionId ? { "X-Submission-Id": submissionId } : {}),
      ...headers,
    },
    body,
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* Report non-JSON error below. */
  }
  return { status: response.status, data, text };
}
// signup returns 201 for a new account; 409 means an earlier run created it,
// so sign in through the real endpoint instead. The issued atlas_session
// cookie drives every authenticated request below.
async function establishAccount(account) {
  let res = await fetch(origin + "/api/auth/signup", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: account.email,
      password,
      displayName: account.displayName,
    }),
  });
  if (res.status === 409) {
    res = await fetch(origin + "/api/auth/signin", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password }),
    });
  }
  assert.ok(
    res.status === 200 || res.status === 201,
    account.email + " signup/signin status " + res.status,
  );
  const setCookie = res.headers.get("set-cookie");
  assert.ok(setCookie && setCookie.startsWith("atlas_session="), "session cookie issued");
  account.cookie = setCookie.split(";")[0];
}
async function getEntry(cookie) {
  const result = await call("/api/mods/" + id, { cookie });
  assert.equal(result.status, 200, result.text);
  assert.ok(result.data?.item);
  return result.data.item;
}
async function list(path, cookie) {
  const result = await call(path, { cookie });
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.data?.items));
  return result.data.items;
}
function review(cookie, revision) {
  return call("/api/mods/review/" + id, {
    cookie,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "approved",
      revision,
      checks,
      feedback: "LOCAL ROLE TEST: synthetic checklist only; gameplay not tested.",
    }),
  });
}
function withdraw(cookie, revision) {
  return call("/api/mods/withdraw/" + id, {
    cookie,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision }),
  });
}
function redact(name, item, privateFeedback = false) {
  const forbidden = ["owner_id", "file_key", "review_token", "body"];
  if (!privateFeedback) forbidden.push("feedback");
  check(
    name,
    forbidden.filter((key) => Object.hasOwn(item, key)),
    [],
  );
}
function onlyError(name, result, status) {
  if (result.status !== status) {
    assert.equal(result.status, status, name + " status; response: " + result.text.slice(0, 800));
  }
  check(name + " status", result.status, status);
  check(name + " reveals no record fields", Object.keys(result.data ?? {}).sort(), ["error"]);
}

try {
  await establishAccount(ownerA);
  await establishAccount(ownerB);
  check(
    "owner accounts hold real session cookies",
    [ownerA.cookie, ownerB.cookie].every((c) => c?.startsWith("atlas_session=")),
    true,
  );
  for (const [name, cookie, expectedAdmin] of [
    ["owner A", ownerA.cookie, false],
    ["owner B", ownerB.cookie, false],
    ["administrator", admin, true],
  ]) {
    const me = await call("/api/atlas/me", { cookie });
    check(
      name + " session has intended role",
      { status: me.status, signedIn: me.data?.signedIn, admin: me.data?.admin },
      { status: 200, signedIn: true, admin: expectedAdmin },
    );
  }
  const anonymous = await call("/api/atlas/me");
  check("requests without cookies remain anonymous", anonymous.data?.signedIn, false);
  onlyError("missing file target", await call("/api/mods/files"), 404);
  onlyError(
    "authenticated missing file target",
    await call("/api/mods/files", { cookie: ownerA.cookie }),
    404,
  );
  onlyError("anonymous management access", await call("/api/mods/submissions"), 401);
  onlyError(
    "non-admin A cannot access admin scope",
    await call("/api/mods/submissions?scope=admin", { cookie: ownerA.cookie }),
    403,
  );
  onlyError(
    "non-admin B cannot access admin scope",
    await call("/api/mods/submissions?scope=admin", { cookie: ownerB.cookie }),
    403,
  );

  createAttempted = true;
  const created = await call("/api/mods", {
    cookie: ownerA.cookie,
    method: "POST",
    submissionId: id,
    body: form(fixture),
  });
  check("non-admin A creates one source-only UUID record", created.status, 201);
  check("new non-admin submission is pending", created.data.item.status, "pending");
  check("source-only fixture never creates a file", created.data.item.has_file, false);
  check("owner A receives edit permission", created.data.item.editable, true);
  redact("owner response has no internal identifiers", created.data.item, true);

  onlyError("anonymous pending detail", await call("/api/mods/" + id), 404);
  onlyError("anonymous fileless pending download", await call("/api/mods/files/" + id), 404);
  onlyError(
    "owner B pending detail",
    await call("/api/mods/" + id, { cookie: ownerB.cookie }),
    404,
  );
  // No R2 object exists. These calls reject at authorization/file-key checks.
  onlyError(
    "owner B pending download",
    await call("/api/mods/files/" + id, { cookie: ownerB.cookie }),
    404,
  );
  onlyError(
    "owner A fileless download",
    await call("/api/mods/files/" + id, { cookie: ownerA.cookie }),
    404,
  );
  onlyError(
    "owner B cannot edit A's record",
    await call("/api/mods/" + id, {
      cookie: ownerB.cookie,
      method: "PATCH",
      body: form(created.data.item),
    }),
    404,
  );
  onlyError(
    "owner B cannot withdraw A's record",
    await withdraw(ownerB.cookie, created.data.item.revision),
    404,
  );
  onlyError(
    "owner B cannot review A's record",
    await review(ownerB.cookie, created.data.item.revision),
    403,
  );
  onlyError(
    "owner A cannot approve own submission",
    await review(ownerA.cookie, created.data.item.revision),
    403,
  );
  onlyError(
    "other owner cannot reuse submission UUID",
    await call("/api/mods", {
      cookie: ownerB.cookie,
      method: "POST",
      submissionId: id,
      body: form(fixture),
    }),
    409,
  );

  check(
    "owner A personal list includes own pending record",
    (await list("/api/mods/submissions", ownerA.cookie)).some((item) => item.id === id),
    true,
  );
  check(
    "owner B personal list hides A's pending record",
    (await list("/api/mods/submissions", ownerB.cookie)).some((item) => item.id === id),
    false,
  );
  check(
    "administrator My Submissions hides another owner's private community record",
    (await list("/api/mods/submissions", admin)).some((item) => item.id === id),
    false,
  );
  check(
    "administrator explicit admin scope includes private community record",
    (await list("/api/mods/submissions?scope=admin", admin)).some((item) => item.id === id),
    true,
  );
  check(
    "public list hides pending record",
    (await list("/api/mods", null)).some((item) => item.id === id),
    false,
  );

  const aRead = await getEntry(ownerA.cookie);
  check("owner A can read own private content", aRead.title, fixture.title);
  const editedFixture = {
    ...aRead,
    summary: "Edited by the actual non-admin owner; still a synthetic local pending record.",
  };
  const edited = await call("/api/mods/" + id, {
    cookie: ownerA.cookie,
    method: "PATCH",
    body: form(editedFixture),
  });
  check("non-admin owner A can edit pending record", edited.status, 200);
  check("non-admin edit remains pending", edited.data.item.status, "pending");
  check("non-admin edit advances revision", edited.data.item.revision, aRead.revision + 1);
  onlyError(
    "stale non-admin owner edit rejected",
    await call("/api/mods/" + id, {
      cookie: ownerA.cookie,
      method: "PATCH",
      body: form(editedFixture),
    }),
    409,
  );
  const curated = await call("/api/mods/ground-balance", { cookie: ownerA.cookie });
  check("ordinary user can read public curated metadata", curated.status, 200);
  check("ordinary user cannot edit curated metadata", curated.data.item.editable, false);
  onlyError(
    "non-admin curated PATCH rejected",
    await call("/api/mods/ground-balance", {
      cookie: ownerA.cookie,
      method: "PATCH",
      body: form(curated.data.item),
    }),
    404,
  );

  const adminRead = await getEntry(admin);
  check("administrator can inspect pending record", adminRead.status, "pending");
  check("administrator receives edit permission", adminRead.editable, true);
  redact("administrator detail still redacts internal keys", adminRead, true);
  check(
    "administrator can approve owner A's fixture",
    (await review(admin, adminRead.revision)).status,
    200,
  );
  const approvedAnonymous = await getEntry(null);
  check("approved detail is publicly readable", approvedAnonymous.status, "approved");
  check("public detail is not editable", approvedAnonymous.editable, false);
  redact("approved anonymous detail redacts internal and review fields", approvedAnonymous);
  const approvedOther = await getEntry(ownerB.cookie);
  check("owner B may read approved public record", approvedOther.status, "approved");
  check("approval does not give owner B edit rights", approvedOther.editable, false);
  onlyError(
    "owner B still cannot edit approved record",
    await call("/api/mods/" + id, {
      cookie: ownerB.cookie,
      method: "PATCH",
      body: form(approvedOther),
    }),
    404,
  );
  check(
    "administrator My Submissions still excludes another owner's community record",
    (await list("/api/mods/submissions", admin)).some((item) => item.id === id),
    false,
  );

  const approvedOwner = await getEntry(ownerA.cookie);
  const revised = await call("/api/mods/" + id, {
    cookie: ownerA.cookie,
    method: "PATCH",
    body: form({
      ...approvedOwner,
      summary: "Post-approval edit by owner A must return this local fixture to pending review.",
    }),
  });
  check("non-admin owner can revise an approved record", revised.status, 200);
  check("non-admin approved edit requires fresh review", revised.data.item.status, "pending");
  onlyError(
    "owner B loses access after owner edit",
    await call("/api/mods/" + id, { cookie: ownerB.cookie }),
    404,
  );
  onlyError("anonymous loses access after owner edit", await call("/api/mods/" + id), 404);
  check(
    "administrator personal scope stays isolated after owner edit",
    (await list("/api/mods/submissions", admin)).some((item) => item.id === id),
    false,
  );
} catch (error) {
  failure = error;
} finally {
  if (createAttempted) {
    try {
      const read = await call("/api/mods/" + id, { cookie: ownerA.cookie });
      if (read.status === 200) {
        if (read.data.item.status !== "withdrawn") {
          const result = await withdraw(ownerA.cookie, read.data.item.revision);
          assert.equal(result.status, 200, "Owner A cleanup withdrawal: " + result.text);
        }
        check(
          "owner A cleanup leaves record withdrawn",
          (await getEntry(ownerA.cookie)).status,
          "withdrawn",
        );
        onlyError(
          "withdrawn record stays private from B",
          await call("/api/mods/" + id, { cookie: ownerB.cookie }),
          404,
        );
        onlyError("withdrawn record stays private anonymously", await call("/api/mods/" + id), 404);
        cleanup.push(
          "Source-only community fixture withdrawn by owner A; local audit record retained, no file uploaded.",
        );
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
  for (const [name, account] of [
    ["owner A", ownerA],
    ["owner B", ownerB],
  ]) {
    if (account.cookie) {
      try {
        const res = await fetch(origin + "/api/auth/signout", {
          method: "POST",
          headers: { Origin: origin, Cookie: account.cookie },
        });
        assert.equal(res.status, 200, name + " signout status");
        account.cookie = null;
      } catch (error) {
        cleanup.push("FAILED " + name + " signout: " + error.message);
        failure = failure ? new AggregateError([failure, error], "Test and cleanup failed") : error;
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        passed: passed.length,
        result: failure ? "FAILED" : "PASSED",
        scope: origin + " — real session-cookie accounts via /api/auth, local dev server only",
        communityRecord: createAttempted ? id : null,
        cleanup,
        limitations: [
          "The administrator uses the local dev dispatcher shim, not a real seedy@sites.test password session.",
          "No uploaded file or R2 object request; no script execution or gameplay validation.",
          "No quota saturation; one new UUID source-only fixture is reused throughout.",
        ],
      },
      null,
      2,
    ),
  );
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
