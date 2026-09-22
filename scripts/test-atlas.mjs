import assert from "node:assert/strict";
const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");
const adminCookie = "__sites_local_auth=1";
const report = [];
async function request(
  path,
  { method = "GET", body, auth = false, originHeader = origin, id, headers = {} } = {},
) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      ...(auth ? { Cookie: adminCookie } : {}),
      ...(method !== "GET" ? { Origin: originHeader } : {}),
      ...(id ? { "X-Submission-Id": id } : {}),
      ...headers,
    },
    body,
  });
  let data;
  try {
    data = await r.clone().json();
  } catch {
    data = null;
  }
  return { r, data };
}
function check(name, actual, expected) {
  assert.equal(actual, expected, name);
  report.push(name);
  console.log("PASS", name);
}
function submission() {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    title: "QA 测试地图（仅本地）",
    author: "自动化测试",
    summary: "这是一份仅用于验证投稿与审核流程的本地测试数据。",
    description:
      "此数据只用于本地测试，不是可玩地图。验证文件隐私、身份校验、并发审核与发布撤回流程，绝不上传线上。",
    game_version: "QA-local",
    players: "30",
    category: "历史战役",
    mods: "无",
    map_code: "",
    rights: "true",
  }))
    f.set(k, v);
  f.set(
    "file",
    new File([new Uint8Array([80, 75, 5, 6, ...Array(18).fill(0)])], "qa-empty.zip", {
      type: "application/zip",
    }),
  );
  return f;
}
let id;
try {
  check("public map list", (await request("/api/atlas/maps")).r.status, 200);
  check(
    "anonymous cannot inspect submissions",
    (await request("/api/atlas/submissions")).r.status,
    401,
  );
  check(
    "anonymous cannot access admin queue",
    (await request("/api/atlas/submissions?scope=admin")).r.status,
    401,
  );
  check(
    "spoofed identity headers are stripped by local dispatcher",
    (
      await request("/api/atlas/me", {
        headers: {
          "oai-authenticated-user-id": "attacker",
          "oai-authenticated-user-email": "seedy@sites.test",
        },
      })
    ).data.signedIn,
    false,
  );
  // Identity now comes exclusively from the session database, so forged
  // upstream headers must yield a fully anonymous caller: 401 on protected
  // routes even when the forged email is a local administrator address.
  check(
    "forged headers stay anonymous on protected routes",
    (
      await request("/api/atlas/submissions", {
        headers: {
          "oai-authenticated-user-id": "attacker",
          "oai-authenticated-user-email": "seedy@sites.test",
        },
      })
    ).r.status,
    401,
  );
  check(
    "forged headers cannot access admin queue",
    (
      await request("/api/atlas/submissions?scope=admin", {
        headers: {
          "oai-authenticated-user-id": "attacker",
          "oai-authenticated-user-email": "seedy@sites.test",
        },
      })
    ).r.status,
    401,
  );
  const me = await request("/api/atlas/me", { auth: true });
  check("local authenticated administrator", me.data.admin, true);
  check(
    "cross-origin mutations rejected",
    (
      await request("/api/atlas/submissions", {
        method: "POST",
        auth: true,
        originHeader: "https://attacker.invalid",
        id: crypto.randomUUID(),
        body: submission(),
      })
    ).r.status,
    403,
  );
  const invalid = submission();
  invalid.set("file", new File(["not a zip"], "fake.zip"));
  check(
    "invalid archive signature rejected",
    (
      await request("/api/atlas/submissions", {
        method: "POST",
        auth: true,
        id: crypto.randomUUID(),
        body: invalid,
      })
    ).r.status,
    400,
  );
  id = crypto.randomUUID();
  const posted = await request("/api/atlas/submissions", {
    method: "POST",
    auth: true,
    id,
    body: submission(),
  });
  check("submission saved as pending", posted.r.status, 201);
  check("pending state is server-owned", posted.data.status, "pending");
  check(
    "idempotent submission retry",
    (
      await request("/api/atlas/submissions", {
        method: "POST",
        auth: true,
        id,
        body: submission(),
      })
    ).r.status,
    200,
  );
  check(
    "pending map absent from public list",
    (await request("/api/atlas/maps")).data.items.some((x) => x.id === id),
    false,
  );
  check(
    "pending detail cannot be read anonymously",
    (await request("/api/atlas/maps/" + id)).r.status,
    404,
  );
  check(
    "pending archive cannot be downloaded anonymously",
    (await request("/api/atlas/files/" + id)).r.status,
    404,
  );
  check(
    "author can download pending archive",
    (await request("/api/atlas/files/" + id, { auth: true })).r.status,
    200,
  );
  const patch = (value, auth = true) =>
    request("/api/atlas/review/" + id, {
      method: "PATCH",
      auth,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  check(
    "anonymous cannot approve",
    (
      await patch(
        { status: "approved", feedback: "已检查测试结果", revision: 0, checks: [] },
        false,
      )
    ).r.status,
    401,
  );
  check(
    "approval requires all manual checks",
    (await patch({ status: "approved", feedback: "已检查测试结果", revision: 0, checks: [] })).r
      .status,
    400,
  );
  check(
    "approval publishes after checklist",
    (
      await patch({
        status: "approved",
        feedback: "本地模拟检查通过，仅测试流程。",
        revision: 0,
        checks: ["ownership", "files", "gameplay", "description"],
      })
    ).r.status,
    200,
  );
  check(
    "approved map enters public list",
    (await request("/api/atlas/maps")).data.items.some((x) => x.id === id),
    true,
  );
  const download = await request("/api/atlas/files/" + id);
  check("approved archive downloadable anonymously", download.r.status, 200);
  check(
    "archive served as attachment",
    download.r.headers.get("content-disposition").startsWith("attachment"),
    true,
  );
  check(
    "stale reviewer revision rejected",
    (await patch({ status: "rejected", feedback: "过期的审核操作", revision: 0, checks: [] })).r
      .status,
    409,
  );
  check(
    "published map can be taken down",
    (
      await patch({
        status: "rejected",
        feedback: "本地测试结束，退回修改。",
        revision: 1,
        checks: [],
      })
    ).r.status,
    200,
  );
  check(
    "taken-down map removed from public list",
    (await request("/api/atlas/maps")).data.items.some((x) => x.id === id),
    false,
  );
  check(
    "taken-down download private again",
    (await request("/api/atlas/files/" + id)).r.status,
    404,
  );
  check(
    "author withdrawal",
    (await request("/api/atlas/withdraw/" + id, { method: "POST", auth: true })).r.status,
    200,
  );
  for (const path of ["/", "/maps/stalingrad", "/reference", "/guidelines"])
    check("render " + path, (await request(path)).r.status, 200);
  console.log(JSON.stringify({ passed: report.length, scope: "local-only", record: id }, null, 2));
} finally {
  if (id) await request("/api/atlas/withdraw/" + id, { method: "POST", auth: true });
}
