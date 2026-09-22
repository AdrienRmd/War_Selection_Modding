import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

// Run: node scripts/test-mods.mjs [http://localhost:5173]
// This performs LOCAL API mutations only. One community record remains withdrawn
// for audit purposes; one curated record's content is restored (revision advances).
const inputOrigin = process.argv[2] || "http://localhost:5173";
const originUrl = new URL(inputOrigin);
if (
  originUrl.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(originUrl.hostname) ||
  !originUrl.port ||
  originUrl.username ||
  originUrl.password ||
  originUrl.pathname !== "/" ||
  originUrl.search ||
  originUrl.hash
)
  throw new Error("Local-only test: use http://localhost:PORT or http://127.0.0.1:PORT.");
const origin = originUrl.origin;
const cookie = "__sites_local_auth=1";
const communityId = randomUUID();
const curatedId = "ground-balance";
const fullChecks = ["ownership", "files", "gameplay", "description"];
const report = [];
const cleanup = [];
const bodyFields = [
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
const seedIds = [
  "stalingrad-rules",
  "ground-balance",
  "air-logistics",
  "lean-economy",
  "late-game",
  "legendary-heroes",
  "housing",
  "strongpoints",
  "transport",
  "opening-guide",
  "old-territory",
  "general-winter",
  "order-227",
  "old-paratroopers",
  "paratrooper-test",
  "paratrooper-diagnostics",
  "external-config",
  "github-diplomacy",
  "github-wave-winter",
  "github-nuclear-bomb",
  "github-adjust-resources",
  "github-economy-gather",
  "github-wsunitstats",
];
const syntheticBody = {
  title: "QA Local Mod API — not gameplay content",
  title_en: "QA Local Mod API — not gameplay content",
  author: "Local API Test",
  summary: "Synthetic local-only metadata for API validation; not a playable or game-tested mod.",
  summary_en:
    "Synthetic local-only metadata for API validation; not a playable or game-tested mod.",
  description:
    "This local test exercises metadata, moderation, private storage, and revisions. It is not gameplay content. The file contains comments only and is never executed.",
  description_en:
    "This local test exercises metadata, moderation, private storage, and revisions. It is not gameplay content. The file contains comments only and is never executed.",
  instructions: "Local API test only. Do not install, execute, or publish this synthetic fixture.",
  instructions_en:
    "Local API test only. Do not install, execute, or publish this synthetic fixture.",
  compatibility: "No game compatibility was tested.",
  compatibility_en: "No game compatibility was tested.",
  game_version: "Not tested — local API fixture",
  mod_code: "",
  source_url: "https://github.com/AdrienRmd/War_Selection_Modding",
  license: "",
  map_slug: "",
  kind: "tutorial",
  usage_status: "testing",
};
const luaText =
  "-- WS ATLAS LOCAL API TEST ONLY\n-- Inert comment-only fixture; no gameplay commands.\n";
const luaName = "qa-local-comment-only.lua";
const luaHash = createHash("sha256").update(luaText).digest("hex");
let originalCurated;
let curatedMutationAttempted = false;
let createAttempted = false;
let failure;

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  report.push(name);
  console.log("PASS", name);
}
function bodyOf(entry) {
  return Object.fromEntries(bodyFields.map((key) => [key, String(entry[key] ?? "")]));
}
function form(entry = syntheticBody, { revision = entry.revision ?? 0, rights = true, file } = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries(bodyOf(entry))) result.set(key, value);
  result.set("revision", String(revision));
  if (rights) result.set("rights", "true");
  if (file) result.set("file", file);
  return result;
}
function exactRestoreForm(entry, revision) {
  // FormData serialization normalizes text line endings to CRLF. Preserve the
  // read-only snapshot byte-for-byte when restoring a curated text-only record.
  const boundary = "----WSAtlasRestore" + randomUUID().replaceAll("-", "");
  const values = { ...bodyOf(entry), revision: String(revision), rights: "true" };
  const parts = Object.entries(values).map(
    ([key, value]) =>
      "--" +
      boundary +
      '\r\nContent-Disposition: form-data; name="' +
      key +
      '"\r\n\r\n' +
      value +
      "\r\n",
  );
  return {
    body: Buffer.from(parts.join("") + "--" + boundary + "--\r\n", "utf8"),
    headers: { "Content-Type": "multipart/form-data; boundary=" + boundary },
  };
}
async function request(
  path,
  { method = "GET", auth = false, body, id, originHeader = origin, headers = {} } = {},
) {
  if (!path.startsWith("/api/")) throw new Error("Only local API paths are allowed.");
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("Cross-origin request blocked by test harness.");
  const requestHeaders = {
    ...(auth ? { Cookie: cookie } : {}),
    ...(method !== "GET" && originHeader !== null ? { Origin: originHeader } : {}),
    ...(id ? { "X-Submission-Id": id } : {}),
    ...headers,
  };
  // Never follow a redirect that could send cookies or mutations outside localhost.
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* File responses are not JSON. */
  }
  return { response, status: response.status, data, text, bytes };
}
async function entry(id, auth = true) {
  const result = await request("/api/mods/" + id, { auth });
  assert.equal(result.status, 200, "Read entry " + id + ": " + result.text);
  assert.ok(result.data?.item, "Expected an item for " + id);
  return result.data.item;
}
async function listed(id) {
  const result = await request("/api/mods");
  assert.equal(result.status, 200, result.text);
  return result.data.items.some((item) => item.id === id);
}
function review(id, value, auth = true) {
  return request("/api/mods/review/" + id, {
    method: "PATCH",
    auth,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
function withdraw(id, revision, auth = true) {
  return request("/api/mods/withdraw/" + id, {
    method: "POST",
    auth,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision }),
  });
}
function assertRedacted(name, item, allowFeedback = false) {
  const forbidden = ["owner_id", "file_key", "review_token", "body"];
  if (!allowFeedback) forbidden.push("feedback");
  check(
    name,
    forbidden.filter((key) => Object.hasOwn(item, key)),
    [],
  );
}

try {
  const initial = await request("/api/mods");
  check("anonymous list is readable", initial.status, 200);
  check(
    "all 23 curated seed IDs are present",
    seedIds.filter((id) => initial.data.items.some((item) => item.id === id)).length,
    23,
  );
  check(
    "17 Stalingrad seed entries",
    initial.data.items.filter((item) => item.origin === "stalingrad").length,
    17,
  );
  check(
    "6 GitHub seed entries",
    initial.data.items.filter((item) => item.origin === "github").length,
    6,
  );
  check(
    "public list is approved only",
    initial.data.items.every((item) => item.status === "approved"),
    true,
  );
  for (const item of initial.data.items) assertRedacted("public fields redacted: " + item.id, item);
  const reference = initial.data.items.find((item) => item.id === "github-wsunitstats");
  check("reference tool has no fictional Mod code", reference.mod_code, "");
  const me = await request("/api/atlas/me", { auth: true });
  check(
    "local cookie identifies an administrator",
    { status: me.status, signedIn: me.data?.signedIn, admin: me.data?.admin },
    { status: 200, signedIn: true, admin: true },
  );
  check("anonymous management list denied", (await request("/api/mods/submissions")).status, 401);
  check(
    "anonymous admin management list denied",
    (await request("/api/mods/submissions?scope=admin")).status,
    401,
  );
  originalCurated = await entry(curatedId);
  check("curated entry has no fixture file to replace", originalCurated.has_file, false);

  check(
    "anonymous create denied",
    (await request("/api/mods", { method: "POST", id: communityId, body: form() })).status,
    401,
  );
  check(
    "anonymous curated edit denied",
    (await request("/api/mods/" + curatedId, { method: "PATCH", body: form(originalCurated) }))
      .status,
    401,
  );
  check(
    "cross-origin create denied",
    (
      await request("/api/mods", {
        method: "POST",
        auth: true,
        id: communityId,
        body: form(),
        originHeader: "https://attacker.invalid",
      })
    ).status,
    403,
  );
  check(
    "missing Origin create denied",
    (
      await request("/api/mods", {
        method: "POST",
        auth: true,
        id: communityId,
        body: form(),
        originHeader: null,
      })
    ).status,
    403,
  );
  check(
    "cross-origin curated edit denied",
    (
      await request("/api/mods/" + curatedId, {
        method: "PATCH",
        auth: true,
        body: form(originalCurated),
        originHeader: "https://attacker.invalid",
      })
    ).status,
    403,
  );
  check(
    "UUID header required",
    (await request("/api/mods", { method: "POST", auth: true, id: "not-a-uuid", body: form() }))
      .status,
    400,
  );
  check(
    "multipart required",
    (
      await request("/api/mods", {
        method: "POST",
        auth: true,
        id: communityId,
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    400,
  );
  check(
    "upload rights confirmation required",
    (
      await request("/api/mods", {
        method: "POST",
        auth: true,
        id: communityId,
        body: form(syntheticBody, { rights: false }),
      })
    ).status,
    400,
  );
  for (const source_url of ["javascript:alert(1)", "https://user:password@example.invalid/file"]) {
    check(
      "unsafe source URL rejected: " + new URL(source_url).protocol,
      (
        await request("/api/mods", {
          method: "POST",
          auth: true,
          id: communityId,
          body: form({ ...syntheticBody, source_url }),
        })
      ).status,
      400,
    );
  }
  check(
    "malformed Mod code rejected",
    (
      await request("/api/mods", {
        method: "POST",
        auth: true,
        id: communityId,
        body: form({ ...syntheticBody, mod_code: "not-a-valid-code" }),
      })
    ).status,
    400,
  );
  check(
    "source, code, or file required",
    (
      await request("/api/mods", {
        method: "POST",
        auth: true,
        id: communityId,
        body: form({ ...syntheticBody, source_url: "" }),
      })
    ).status,
    400,
  );
  for (const [name, file] of [
    ["unsupported file extension", new File(["fixture"], "fixture.exe")],
    ["invalid ZIP signature", new File(["not a ZIP"], "fixture.zip")],
    ["binary Lua NUL byte", new File([new Uint8Array([45, 45, 0])], "fixture.lua")],
    ["invalid UTF-8 Lua", new File([new Uint8Array([0xc3, 0x28])], "fixture.lua")],
  ])
    check(
      name + " rejected",
      (
        await request("/api/mods", {
          method: "POST",
          auth: true,
          id: communityId,
          body: form(syntheticBody, { file }),
        })
      ).status,
      400,
    );

  const createForm = form();
  createForm.set("status", "approved");
  createForm.set("owner_id", "untrusted-form-value");
  createForm.set("review_token", "untrusted-form-value");
  createAttempted = true;
  const created = await request("/api/mods", {
    method: "POST",
    auth: true,
    id: communityId,
    body: createForm,
  });
  check("one UUID source-only submission created", created.status, 201);
  check("server owns initial moderation state", created.data.item.status, "pending");
  check("new entry is a community record", created.data.item.origin, "community");
  check("optional file can be omitted", created.data.item.has_file, false);
  assertRedacted("creator response omits internal keys", created.data.item, true);
  check("pending metadata absent from public list", await listed(communityId), false);
  check("pending detail private", (await request("/api/mods/" + communityId)).status, 404);
  check(
    "fileless submission has no download",
    (await request("/api/mods/files/" + communityId, { auth: true })).status,
    404,
  );
  const retried = await request("/api/mods", {
    method: "POST",
    auth: true,
    id: communityId,
    body: form({ ...syntheticBody, title: "Retry must not overwrite metadata" }),
  });
  check("UUID retry is idempotent", retried.status, 200);
  check(
    "UUID retry preserves original title and revision",
    { title: retried.data.item.title, revision: retried.data.item.revision },
    { title: syntheticBody.title, revision: 0 },
  );

  const attached = await request("/api/mods/" + communityId, {
    method: "PATCH",
    auth: true,
    body: form(created.data.item, { file: new File([luaText], luaName, { type: "text/plain" }) }),
  });
  check("UTF-8 comment-only Lua accepted", attached.status, 200);
  check("file edit remains pending", attached.data.item.status, "pending");
  check("server records SHA-256", attached.data.item.sha256, luaHash);
  check("server records file byte size", attached.data.item.file_size, Buffer.byteLength(luaText));
  check(
    "pending Lua cannot be downloaded anonymously",
    (await request("/api/mods/files/" + communityId)).status,
    404,
  );
  const privateDownload = await request("/api/mods/files/" + communityId, { auth: true });
  check("creator/admin can read pending file", privateDownload.status, 200);
  check("pending download is unchanged inert text", privateDownload.text, luaText);
  const pending = await entry(communityId);
  const approval = {
    status: "approved",
    feedback: "LOCAL SYNTHETIC API CHECKLIST ONLY; gameplay was not tested.",
    revision: pending.revision,
    checks: fullChecks,
  };
  check("anonymous review denied", (await review(communityId, approval, false)).status, 401);
  for (const missing of fullChecks) {
    check(
      "approval requires check " + missing,
      (
        await review(communityId, {
          ...approval,
          checks: fullChecks.filter((check) => check !== missing),
        })
      ).status,
      400,
    );
  }
  check(
    "all four synthetic checks permit review",
    (await review(communityId, approval)).status,
    200,
  );
  check("approved entry becomes public", await listed(communityId), true);
  const publicEntry = await entry(communityId, false);
  check("public approved detail visible", publicEntry.status, "approved");
  assertRedacted("approved detail redacts feedback and internals", publicEntry);
  const download = await request("/api/mods/files/" + communityId);
  check("approved Lua download is public", download.status, 200);
  check(
    "download is attachment",
    download.response.headers.get("content-disposition")?.startsWith("attachment;"),
    true,
  );
  check(
    "download contains encoded original filename",
    download.response.headers.get("content-disposition")?.includes(encodeURIComponent(luaName)),
    true,
  );
  check(
    "download uses octet-stream",
    download.response.headers.get("content-type"),
    "application/octet-stream",
  );
  check(
    "download prevents MIME sniffing",
    download.response.headers.get("x-content-type-options"),
    "nosniff",
  );
  check(
    "download is not cached",
    download.response.headers.get("cache-control"),
    "private, no-store",
  );
  check(
    "download CSP is sandboxed",
    download.response.headers.get("content-security-policy"),
    "default-src 'none'; sandbox",
  );
  check(
    "downloaded bytes match checksum",
    createHash("sha256").update(download.bytes).digest("hex"),
    luaHash,
  );
  check(
    "stale reviewer revision rejected",
    (
      await review(communityId, {
        ...approval,
        status: "rejected",
        feedback: "Local stale-revision test; must not take effect.",
      })
    ).status,
    409,
  );

  curatedMutationAttempted = true;
  const curatedChange = {
    ...originalCurated,
    summary: originalCurated.summary + " [Local API QA " + communityId.slice(0, 8) + "]",
  };
  const curatedSaved = await request("/api/mods/" + curatedId, {
    method: "PATCH",
    auth: true,
    body: form(curatedChange),
  });
  check("administrator can edit a curated seed", curatedSaved.status, 200);
  check("curated edit stays approved", curatedSaved.data.item.status, "approved");
  check(
    "curated database override is public",
    (await entry(curatedId, false)).summary,
    curatedChange.summary,
  );
  check(
    "stale curated edit rejected",
    (
      await request("/api/mods/" + curatedId, {
        method: "PATCH",
        auth: true,
        body: form(curatedChange),
      })
    ).status,
    409,
  );
  check(
    "curated record cannot use community withdrawal",
    (await withdraw(curatedId, curatedSaved.data.item.revision)).status,
    400,
  );

  const beforeEdit = await entry(communityId);
  const editedBody = {
    ...beforeEdit,
    summary: "Edited synthetic local metadata; publication must wait for a new review.",
  };
  const edited = await request("/api/mods/" + communityId, {
    method: "PATCH",
    auth: true,
    body: form(editedBody),
  });
  check("authenticated creator/admin can edit community metadata", edited.status, 200);
  check("community edit returns to pending", edited.data.item.status, "pending");
  check("editing without a new file keeps its checksum", edited.data.item.sha256, luaHash);
  check("edited entry leaves the public list", await listed(communityId), false);
  check("edited detail is private again", (await request("/api/mods/" + communityId)).status, 404);
  check(
    "edited download is private again",
    (await request("/api/mods/files/" + communityId)).status,
    404,
  );
  check(
    "stale community edit rejected",
    (
      await request("/api/mods/" + communityId, {
        method: "PATCH",
        auth: true,
        body: form(editedBody),
      })
    ).status,
    409,
  );
  check(
    "anonymous withdrawal denied",
    (await withdraw(communityId, edited.data.item.revision, false)).status,
    401,
  );
  check(
    "stale withdrawal rejected",
    (await withdraw(communityId, beforeEdit.revision)).status,
    409,
  );
  check(
    "current revision can be withdrawn",
    (await withdraw(communityId, edited.data.item.revision)).status,
    200,
  );
  const withdrawn = await entry(communityId);
  check("withdrawn state persists", withdrawn.status, "withdrawn");
  check("withdrawn record absent publicly", await listed(communityId), false);
  check(
    "withdrawn file remains private",
    (await request("/api/mods/files/" + communityId)).status,
    404,
  );
  check(
    "duplicate withdrawal rejected",
    (await withdraw(communityId, withdrawn.revision)).status,
    409,
  );
  check(
    "withdrawn record cannot be approved",
    (await review(communityId, { ...approval, revision: withdrawn.revision })).status,
    404,
  );
  const managed = await request("/api/mods/submissions?scope=admin", { auth: true });
  check(
    "admin management list includes withdrawn audit record",
    managed.data.items.some((item) => item.id === communityId && item.status === "withdrawn"),
    true,
  );
} catch (error) {
  failure = error;
} finally {
  // Cleanup runs even after a failed assertion or an uncertain request response.
  if (createAttempted) {
    try {
      const read = await request("/api/mods/" + communityId, { auth: true });
      if (read.status === 200) {
        if (read.data.item.status !== "withdrawn") {
          const result = await withdraw(communityId, read.data.item.revision);
          assert.equal(result.status, 200, "Cleanup withdrawal: " + result.text);
        }
        assert.equal((await entry(communityId)).status, "withdrawn");
        cleanup.push("Community fixture withdrawn; audit record/file retained locally.");
      } else if (read.status === 404) cleanup.push("No community fixture was committed.");
      else throw new Error("Could not inspect community cleanup state: " + read.status);
    } catch (error) {
      cleanup.push("FAILED community cleanup: " + error.message);
      failure = failure ? new AggregateError([failure, error], "Test and cleanup failed") : error;
    }
  }
  if (curatedMutationAttempted && originalCurated) {
    try {
      const current = await entry(curatedId);
      if (JSON.stringify(bodyOf(current)) !== JSON.stringify(bodyOf(originalCurated))) {
        const restored = await request("/api/mods/" + curatedId, {
          method: "PATCH",
          auth: true,
          ...exactRestoreForm(originalCurated, current.revision),
        });
        assert.equal(restored.status, 200, "Curated restoration: " + restored.text);
      }
      const restored = await entry(curatedId);
      assert.deepEqual(bodyOf(restored), bodyOf(originalCurated), "Curated body restored");
      assert.equal(restored.status, originalCurated.status, "Curated public state restored");
      assert.equal(restored.sha256, originalCurated.sha256, "Curated file unchanged");
      cleanup.push(
        "Curated content restored exactly; local revision/audit timestamps may advance.",
      );
    } catch (error) {
      cleanup.push("FAILED curated cleanup: " + error.message);
      failure = failure ? new AggregateError([failure, error], "Test and cleanup failed") : error;
    }
  }
  console.log(
    JSON.stringify(
      {
        passed: report.length,
        scope: origin + " (local only)",
        communityRecord: createAttempted ? communityId : null,
        cleanup,
        notCovered: [
          "Non-admin or cross-owner authorization: local test cookie represents one administrator; no identity headers were forged.",
          "Real gameplay, malware scanning, and Lua execution: fixture is inert text and was never run.",
          "Quota boundary saturation: one record is reused, so pending/daily limits are not exhausted.",
        ],
        result: failure ? "FAILED" : "PASSED",
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
