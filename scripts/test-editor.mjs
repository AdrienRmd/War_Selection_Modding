import assert from "node:assert/strict";
const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw Error("Local only");
let passed = 0;
async function req(path, { auth = false, method = "GET", body, extra = {} } = {}) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      ...(auth ? { Cookie: "__sites_local_auth=1" } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...extra,
    },
    body,
  });
  return {
    r,
    data: await r
      .clone()
      .json()
      .catch(() => null),
    text: await r.text(),
  };
}
function check(name, a, b) {
  assert.equal(a, b, name);
  console.log("PASS", name);
  passed++;
}
function form(m) {
  const f = new FormData();
  for (const k of [
    "title",
    "author",
    "summary",
    "description",
    "game_version",
    "category",
    "players",
    "mods",
    "map_code",
    "revision",
  ])
    f.set(k, String(m[k] ?? ""));
  if (m.rules) f.set("rules", JSON.stringify(m.rules));
  return f;
}
const original = (await req("/api/featured")).data;
check("anonymous featured read", original.id, "stalingrad");
check("anonymous editor denied", (await req("/api/editor/stalingrad")).r.status, 401);
const initial = (await req("/api/editor/stalingrad", { auth: true })).data;
check("admin reads editable featured", initial.id, "stalingrad");
check(
  "cross origin edit blocked",
  (
    await req("/api/editor/stalingrad", {
      auth: true,
      method: "PATCH",
      body: form(initial),
      extra: { Origin: "https://attacker.invalid" },
    })
  ).r.status,
  403,
);
let changed = false;
try {
  const edited = {
    ...initial,
    summary: "这是一段仅在本地执行的编辑校验文字，测试完成后立即恢复原有说明。",
  };
  const saved = await req("/api/editor/stalingrad", {
    auth: true,
    method: "PATCH",
    body: form(edited),
  });
  check("featured edit persists", saved.r.status, 200);
  changed = true;
  check("public reads saved edit", (await req("/api/featured")).data.summary, edited.summary);
  check(
    "stale revision blocked",
    (await req("/api/editor/stalingrad", { auth: true, method: "PATCH", body: form(edited) })).r
      .status,
    409,
  );
  check(
    "missing map cannot be edited",
    (await req("/api/editor/nonexistent", { auth: true })).r.status,
    404,
  );
  for (const path of [
    "/maps",
    "/mods",
    "/mods/ground-balance",
    "/workbench",
    "/maps/stalingrad/edit",
    "/admin",
    "/submissions",
  ])
    check("renders " + path, (await req(path, { auth: true })).r.status, 200);
  check(
    "featured edit UI present",
    (await req("/maps/stalingrad/edit", { auth: true })).text.includes("保存并更新档案"),
    true,
  );
  check(
    "admin edit shortcut present",
    (await req("/admin", { auth: true })).text.includes("编辑斯大林格勒"),
    true,
  );
  const prior = (await req("/api/atlas/submissions", { auth: true })).data.items.find(
    (m) => m.title === "QA 测试地图（仅本地）" && m.status === "withdrawn",
  );
  if (!prior) throw Error("Run test-atlas.mjs first");
  const data = (await req("/api/editor/" + prior.id, { auth: true })).data;
  const updated = await req("/api/editor/" + prior.id, {
    auth: true,
    method: "PATCH",
    body: form(data),
  });
  check("owner can edit existing map", updated.r.status, 200);
  check("edited community map needs review", updated.data.status, "pending");
  check(
    "edited pending file stays private",
    (await req("/api/atlas/files/" + prior.id)).r.status,
    404,
  );
  check(
    "owner stale edit blocked",
    (await req("/api/editor/" + prior.id, { auth: true, method: "PATCH", body: form(data) })).r
      .status,
    409,
  );
  await req("/api/atlas/withdraw/" + prior.id, { auth: true, method: "POST" });
} finally {
  if (changed) {
    const current = (await req("/api/featured")).data;
    check(
      "restore local featured test text",
      (
        await req("/api/editor/stalingrad", {
          auth: true,
          method: "PATCH",
          body: form({ ...initial, revision: current.revision }),
        })
      ).r.status,
      200,
    );
  }
}
console.log(
  JSON.stringify({ passed, scope: "local only; featured text restored; test map withdrawn" }),
);
