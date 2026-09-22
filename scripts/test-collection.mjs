import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw Error("Local test only");
const seeds = JSON.parse(
  await readFile(new URL("../lib/collection-seeds.json", import.meta.url), "utf8"),
);
const discord = JSON.parse(
  await readFile(new URL("../lib/discord-map-seeds.json", import.meta.url), "utf8"),
);
let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  passed++;
  console.log("PASS", label);
}
async function req(path, { auth = false, method = "GET", body, headers = {} } = {}) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      ...(auth ? { Cookie: "__sites_local_auth=1" } : {}),
      ...(method === "PATCH" ? { "Content-Type": "application/json", Origin: origin } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
check("72 unique imported maps", seeds.length, 72);
check("codes are unique", new Set(seeds.map((x) => x.id)).size, 72);
check(
  "all imported maps untested",
  seeds.every((x) => x.test_status === "untested" && !x.tested_at),
  true,
);
check(
  "source conflict flagged",
  seeds.find((x) => x.id === "map-0c5580a5").source_note.includes("歧义"),
  true,
);
check(
  "Westerplatte association qualified",
  seeds.find((x) => x.id === "map-981104b9").title.includes("待确认"),
  true,
);
check("107 unique Discord codes", new Set(discord.map((x) => x.id)).size, 107);
check(
  "100 new codes, not 107 duplicate cards",
  new Set([...seeds, ...discord].map((x) => x.id)).size,
  172,
);
check(
  "all Discord entries untested",
  discord.every((x) => x.test_status === "untested" && !x.tested_at && !x.game_version),
  true,
);
const codes = new Set([...seeds, ...discord].map((x) => x.id));
check(
  "all source links are scoped Discord posts",
  discord.every(
    (x) =>
      x.sources.length &&
      x.sources.every((s) =>
        /^https:\/\/discord\.com\/channels\/632289073075322911\/1110626120317014066\/threads\/\d+$/.test(
          s.url,
        ),
      ),
  ),
  true,
);
check(
  "all related archives exist",
  discord.every((x) =>
    (x.related_maps || []).every((r) => codes.has(r.id) || r.id === "stalingrad"),
  ),
  true,
);
check(
  "Atlantic sources combined without choosing disputed count",
  discord.find((x) => x.id === "map-9844843c").sources.length === 2 &&
    discord.find((x) => x.id === "map-9844843c").players === null,
  true,
);
for (const m of discord)
  for (const p of m.images) await access(new URL("../public" + p, import.meta.url));
check(
  "original Stalingrad code preserved",
  (await req("/api/collection/map-00200088")).data.map_code,
  "map-00200088",
);
check(
  "PVE authorship preserved",
  (await req("/api/collection/map-00318438")).data.author,
  "大筒木萤草",
);
check(
  "duplicate supplemented with source",
  (await req("/api/collection/map-00318438")).data.sources.length,
  1,
);
check(
  "separate no-mod Europe",
  (await req("/api/collection/map-903504a4")).data.edition,
  "original",
);
check(
  "original/remix link",
  (await req("/api/collection/map-00200088")).data.related_maps[0].id,
  "stalingrad",
);
for (const m of seeds) {
  assert.match(m.id, /^map-[a-f0-9]{8}$/);
  for (const p of m.images) await access(new URL("../public" + p, import.meta.url));
}
passed++;
console.log("PASS every preview file exists");
const id = "map-1c54042c",
  path = "/api/collection/" + id;
const original = (await req(path, { auth: true })).data;
check("admin edit flag", original.editable, true);
check("anonymous is not editable", (await req(path)).data.editable, false);
check("unknown code", (await req("/api/collection/map-ffffffff")).status, 404);
check(
  "anonymous write denied",
  (await req(path, { method: "PATCH", body: { body: original, revision: original.revision } }))
    .status,
  401,
);
check(
  "cross-origin write denied",
  (
    await req(path, {
      auth: true,
      method: "PATCH",
      body: { body: original, revision: original.revision },
      headers: { Origin: "https://not-this-site.invalid" },
    })
  ).status,
  403,
);
check(
  "cannot certify without test evidence",
  (
    await req(path, {
      auth: true,
      method: "PATCH",
      body: { body: { ...original, test_status: "working" }, revision: original.revision },
    })
  ).status,
  400,
);
let changed = false;
try {
  const save = await req(path, {
    auth: true,
    method: "PATCH",
    body: {
      body: {
        ...original,
        title: "QA local collection test",
        visibility: "hidden",
        id: "stalingrad",
        map_code: "map-ffffffff",
      },
      revision: original.revision,
    },
  });
  check("admin saves", save.status, 200);
  changed = true;
  check("map identity cannot be changed", save.data.id, id);
  check("map code cannot be changed", save.data.map_code, id);
  check("hidden entry private to admin", (await req(path)).status, 404);
  check("admin sees hidden entry", (await req(path, { auth: true })).data.visibility, "hidden");
  check(
    "stale write rejected",
    (
      await req(path, {
        auth: true,
        method: "PATCH",
        body: { body: original, revision: original.revision },
      })
    ).status,
    409,
  );
} finally {
  if (changed) {
    const current = (await req(path, { auth: true })).data;
    check(
      "restore test changes",
      (
        await req(path, {
          auth: true,
          method: "PATCH",
          body: { body: original, revision: current.revision },
        })
      ).status,
      200,
    );
  }
}
check("restored title", (await req(path)).data.title, original.title);
for (const p of [
  "/maps",
  "/maps/map-00318438",
  "/maps/map-1c54042c",
  "/maps/map-00318438/edit",
  "/maps/collection/manage",
]) {
  const r = await fetch(origin + p, { headers: { Cookie: "__sites_local_auth=1" } });
  check("page renders " + p, r.status, 200);
  await r.text();
}
console.log(JSON.stringify({ passed, scope: "local only; test record restored" }));
