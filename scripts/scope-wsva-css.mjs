// Scope le design-system wsva (vendor/wsva-design-system.css, capture du
// 01/11/2026 de warselection.vercel.app — design-system-TB7qPhyN.css, 91863 o)
// en `app/wsva.css`, namespacé sous `.rp` pour les pages replay résultat et
// profil joueur SANS contaminer le reste d'ATLAS.
//
// Transformations (toutes documentées, déterministes, rejouables) :
//  1. @font-face supprimés — nous n'embarquons pas les woff2 d'Inter ;
//     `--font-family` retombe sur la pile système (écart assumé : métriques
//     voisines, aucun asset externe).
//  2. `:root` → `.rp` : les tokens deviennent des custom properties du scope.
//  3. Sélecteurs préfixés `.rp ` (y compris dans @media/@supports) ;
//     `html`/`body`/`:root` mappés sur `.rp` ; `*` → `.rp *` ; les
//     pseudo-sélecteurs (éven­tements focus/hover) et combinators préservés.
//  4. @keyframes conservés MAIS renommés `rp-<nom>` (aucune collision
//     globale), références animation: mises à jour.
//  5. `--page-image: url(/images/loading-industrial.jpg)` neutralisé (asset
//     wsva absent) → none ; le dégradé de fond reste.
//  6. url(/assets/inter-*.woff2) — supprimés avec les @font-face.
//
// Usage : node scripts/scope-wsva-css.mjs   (écrit app/wsva.css)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "vendor/wsva-design-system.css"), "utf8");

// 1. Retirer les @font-face (blocs imbriqués simples : une paire {} interne).
let css = src.replace(/@font-face\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "");

// 2. Collecter et retirer les @keyframes (corps sans imbrication profonde).
const keyframes = new Map();
css = css.replace(/@keyframes\s+([\w-]+)\{((?:[^{}]*\{[^{}]*\})[^{}]*)*\}/g, (_, name, body) => {
  keyframes.set(name, body);
  return "";
});

// 3. Découper en blocs top-level : at-rules (@media/@supports) vs règles.
const out = [];
// itération prudente : split sur les accolades top-level.
let i = 0;
const len = css.length;
let buf = "";
const flushRule = () => {
  const rule = buf.trim();
  buf = "";
  if (!rule) return;
  out.push(scopeRule(rule));
};
while (i < len) {
  const ch = css[i];
  if (ch === "@") {
    // at-rule top-level (@media, @supports, @property…) : capturer jusqu'à la
    // fin de son bloc en comptant la profondeur.
    let j = i;
    let depth = 0;
    while (j < len) {
      if (css[j] === "{") {
        if (depth === 0) start = j;
        depth++;
      } else if (css[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    const block = css.slice(i, j + 1);
    out.push(scopeAtRule(block));
    i = j + 1;
    continue;
  }
  if (ch === "}") {
    flushRule();
    i++;
    continue;
  }
  if (ch === "{") {
    // règle ordinaire : sélecteur déjà dans buf, corps jusqu'à } correspondant.
    let j = i;
    let depth = 0;
    while (j < len) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    const sel = buf.trim();
    const body = css.slice(i + 1, j);
    buf = "";
    if (sel) out.push(`${scopeSelectorList(sel)}{${body}}`);
    i = j + 1;
    continue;
  }
  buf += ch;
  i++;
}
flushRule();

function scopeSelectorList(list) {
  return list
    .split(",")
    .map((raw) => scopeSelector(raw.trim()))
    .filter(Boolean)
    .join(",");
}

function scopeSelector(sel) {
  if (!sel) return "";
  let s = sel;
  s = s.replace(/(^|[\s,>+~])html([\s.:,[>+~]|$)/g, "$1.rp$2");
  s = s.replace(/(^|[\s,>+~])body([\s.:,[>+~]|$)/g, "$1.rp$2");
  s = s.replace(/:root/g, ".rp");
  if (s === "*" || s.startsWith("*") || s.startsWith(":root")) {
    return s === "*" ? ".rp,.rp *" : ".rp" + s.replace(/^\*?/, " ");
  }
  // Sélecteur déjà préfixé (rare) : ne pas doubler.
  if (/^\.rp([ .:[>+~]|$)/.test(s)) return s;
  return `.rp ${s}`;
}

function scopeRule(rule) {
  // Règle isolée sans bloc (devrait être rare ici) : la renvoyer scopée.
  return scopeSelectorList(rule);
}

function scopeAtRule(block) {
  const m = block.match(/^@([\w-]+)([^{]*)\{([\s\S]*)\}$/);
  if (!m) return block;
  const [, name, prelude, body] = m;
  if (name === "media" || name === "supports" || name === "container") {
    // Récursif : scoper les règles internes (les @keyframes internes restent
    // globaux renommés).
    const inner = scopeBody(body);
    return `@${name}${prelude}{${inner}}`;
  }
  if (name === "property" || name === "layer" || name === "charset") {
    return block; // globaux par nature, sans effet visuel sur ATLAS
  }
  return block;
}

function scopeBody(body) {
  // Découpe naïve des règles internes (profondeur 1) et rescope.
  let result = "";
  let i = 0;
  const len = body.length;
  let sel = "";
  while (i < len) {
    const ch = body[i];
    if (ch === "{") {
      let j = i;
      let depth = 0;
      while (j < len) {
        if (body[j] === "{") depth++;
        else if (body[j] === "}") {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      const s = sel.trim();
      const inner = body.slice(i + 1, j);
      sel = "";
      if (s.startsWith("@keyframes")) {
        const km = s.match(/@keyframes\s+([\w-]+)/);
        const renamed = km ? `rp-${km[1]}` : s;
        result += `${s.replace(/@keyframes\s+[\w-]+/, `@keyframes ${renamed}`)}{${inner}}`;
      } else if (s) {
        result += `${scopeSelectorList(s)}{${inner}}`;
      } else {
        result += `{${inner}}`;
      }
      i = j + 1;
      continue;
    }
    if (ch === "}") {
      sel = "";
      i++;
      continue;
    }
    sel += ch;
    i++;
  }
  return result;
}

let result = out.filter(Boolean).join("\n");

// 4. Ré-émettre les @keyframes renommés (top-level).
for (const [name, body] of keyframes) {
  result += `\n@keyframes rp-${name}{${body}}`;
}

// 5. Références animation aux keyframes renommés.
for (const name of keyframes.keys()) {
  const re = new RegExp(`(animation(?:-name)?\\s*:[^;}]*)\\b${name}\\b`, "g");
  result = result.replace(re, `$1rp-${name}`);
}

// 6. Asset wsva absent : fond image neutralisé (dégradé conservé).
result = result.replace(
  /--page-image:url\([^)]*\)/g,
  "--page-image:none",
);

const header = `/* AUTO-GÉNÉRÉ par scripts/scope-wsva-css.mjs — NE PAS ÉDITER À LA MAIN.
 * Design-system wsva (vendor/wsva-design-system.css, malticNL) scopé sous
 * .rp pour les pages /replay (résultat) et /player/[name].
 * @font-face Inter retirés (pile système), @keyframes renommés rp-*,
 * --page-image neutralisé. Crédit : cf. THIRD_PARTY_NOTICES.md. */
`;

fs.writeFileSync(path.join(root, "app/wsva.css"), header + result + "\n");

const lines = (header + result).split("\n").length;
console.log(
  `[scope-wsva-css] app/wsva.css écrit — ${lines} lignes, ` +
    `${keyframes.size} @keyframes renommés (rp-*), @font-face retirés.`,
);
