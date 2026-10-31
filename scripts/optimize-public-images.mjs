#!/usr/bin/env node
// Optimisation des visuels publics (WS ATLAS — refonte UI).
// Idempotent : régénère uniquement si la source est plus récente que la cible.
// Produits :
//  - public/stalingrad-art.webp (+ -mobile.webp 750w) : hero accueil, ~10× plus
//    léger que le PNG 2,1 Mo d'origine (le PNG reste en repli <picture>) ;
//  - public/atlas-emblem-96.png / -192.png : en-tête (48px @2x) et favicon,
//    contre le PNG 597 Ko d'origine ;
//  - public/og-cover.png 1200×630 : image Open Graph par défaut.
import { mkdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const PUB = join(ROOT, "public");

const newer = (target, source) =>
  !existsSync(target) || statSync(target).mtimeMs < statSync(source).mtimeMs;

const produce = async (source, name, pipeline) => {
  const out = join(PUB, name);
  if (!newer(out, source)) return console.log(`à jour : ${name}`);
  mkdirSync(dirname(out), { recursive: true });
  await pipeline(sharp(source)).toFile(out);
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`${name} : ${kb} Ko`);
};

// Carte Stalingrad : fond du panneau « sélection » de /maps.
await produce(join(PUB, "stalingrad-map.png"), "stalingrad-map.webp", (s) =>
  s.resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }),
);
// Hero : décor Stalingrad, léger et net à 1920px de large.
await produce(join(PUB, "stalingrad-art.png"), "stalingrad-art.webp", (s) =>
  s.resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }),
);
await produce(join(PUB, "stalingrad-art.png"), "stalingrad-art-mobile.webp", (s) =>
  s.resize({ width: 750, withoutEnlargement: true }).webp({ quality: 76, effort: 4 }),
);
// Emblème : rendus taille utile (48px affiché → 96 @2x ; 192 favicon/OG).
await produce(join(PUB, "atlas-emblem-v4.png"), "atlas-emblem-96.png", (s) =>
  s.resize({ width: 96, height: 96 }).png({ compressionLevel: 9, palette: true }),
);
await produce(join(PUB, "atlas-emblem-v4.png"), "atlas-emblem-192.png", (s) =>
  s.resize({ width: 192, height: 192 }).png({ compressionLevel: 9 }),
);
// Open Graph 1200×630 : emblème posé sur le décor assombri (JPG : les
// plateformes sociales n'exigent pas la transparence, gain de poids ×8).
{
  const out = join(PUB, "og-cover.jpg");
  if (newer(out, join(PUB, "stalingrad-art.png"))) {
    const art = await sharp(join(PUB, "stalingrad-art.png"))
      .resize({ width: 1200, height: 630, fit: "cover", position: "attention" })
      .modulate({ brightness: 0.72, saturation: 0.9 })
      .toBuffer();
    const emblem = await sharp(join(PUB, "atlas-emblem-v4.png"))
      .resize({ width: 150, height: 150 })
      .toBuffer();
    await sharp(art)
      .composite([{ input: emblem, top: 70, left: 525 }])
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(out);
    console.log(`og-cover.jpg : ${Math.round(statSync(out).size / 1024)} Ko`);
  } else console.log("à jour : og-cover.jpg");
}
