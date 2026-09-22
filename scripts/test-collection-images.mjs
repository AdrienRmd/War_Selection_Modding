import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const origin = process.argv[2] || "http://localhost:5173";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/, "Local test only");
const readJson = async (file) =>
  JSON.parse(await readFile(new URL("../lib/" + file, import.meta.url), "utf8"));
const old = await readJson("collection-seeds.json");
const discord = await readJson("discord-map-seeds.json");
const images = await readJson("collection-image-seeds.json");
const known = new Map([...old, ...discord].map((m) => [m.id, m]));
const imagePaths = new Set();
for (const [id, preview] of Object.entries(images)) {
  assert(known.has(id), `Unknown map ${id}`);
  assert(["map", "shared", "art"].includes(preview.preview_kind));
  assert(preview.preview_note && preview.preview_note_en);
  assert.match(
    preview.image_source_url,
    /^https:\/\/discord\.com\/channels\/632289073075322911\/1110626120317014066\/threads\/\d+$/,
  );
  for (const path of preview.images) {
    assert.match(path, /^\/map-collection\/[\w-]+\.(webp|png|jpg)$/);
    await access(new URL("../public" + path, import.meta.url));
    imagePaths.add(path);
  }
}
let cursor = 0;
const paths = [...imagePaths];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < paths.length) {
      const path = paths[cursor++];
      const r = await fetch(origin + path);
      assert.equal(r.status, 200, path);
      assert.match(r.headers.get("content-type"), /^image\//);
      assert((await r.arrayBuffer()).byteLength > 0);
    }
  }),
);
const samples = ["map-88208080", "map-903504a4", "map-14140429", "map-8c448418"];
for (const id of samples) {
  const r = await fetch(origin + "/api/collection/" + id);
  assert.equal(r.status, 200);
  const map = await r.json();
  for (const path of images[id].images)
    assert(map.images.includes(path), `${id} supplement is served`);
  assert.equal(map.preview_kind, images[id].preview_kind);
  for (const path of old.find((m) => m.id === id)?.images || [])
    assert(map.images.includes(path), `${id} old image retained`);
}
const oldById = new Map(old.map((m) => [m.id, m]));
const newRows = discord.filter((m) => !oldById.has(m.id));
assert(
  newRows.every((m) => m.images.length || images[m.id]?.images.length),
  "Every newly collected map has a source image or labelled reference",
);
const combined = [
  ...new Map(
    [...old, ...discord].map((m) => [
      m.id,
      {
        ...m,
        images: [
          ...new Set([
            ...(oldById.get(m.id)?.images || []),
            ...m.images,
            ...(images[m.id]?.images || []),
          ]),
        ],
      },
    ]),
  ).values(),
];
console.log(
  JSON.stringify({
    supplements: Object.keys(images).length,
    localAssets: imagePaths.size,
    newMaps: newRows.length,
    newMapsCovered: newRows.filter((m) => m.images.length || images[m.id]?.images.length).length,
    archivesWithImages: combined.filter((m) => m.images.length).length,
    totalArchives: combined.length,
  }),
);
