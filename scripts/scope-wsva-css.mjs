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

// 2. Collecter et retirer les @keyframes (corps imbriqué d'un niveau :
//    0%{...}to{...}). Extraction par comptage d'accolades — une regex à
//    groupe capturant quantifié ne convient pas : un groupe répété ne
//    conserve que sa DERNIÈRE itération. C'est ce défaut qui produisait
//    `@keyframes rp-tab-panel-in{{opacity:1;transform:none}}` (corps tronqué
//    à sa dernière étape + double accolade) : règle invalide, dropée par le
//    parseur CSS → fade-in des .tab-panel inopérants.
const keyframes = new Map();
{
  const kf = /@keyframes\s+([\w-]+)[^{]*\{/g;
  let m;
  while ((m = kf.exec(css))) {
    const name = m[1];
    const open = m.index + m[0].length; // position juste après '{'
    let depth = 1;
    let j = open;
    while (j < css.length) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (j >= css.length) throw new Error(`@keyframes ${name} : accolade fermante introuvable`);
    const body = css.slice(open, j);
    keyframes.set(name, body);
    css = css.slice(0, m.index) + css.slice(j + 1);
    kf.lastIndex = 0; // css raccourci : reprendre le scan depuis le début
  }
}

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

// 7. EXTENSIONS manuelles historiques (V2 verdict « archivé », V4
//    transferts + onglets Player statistics) — point backlog de la revue
//    précédente : ces blocs vivaient en fin de app/wsva.css SANS être dans
//    le générateur (une régénération les effaçait). Ils sont désormais
//    intégrés ICI : toute extension future du canvas .rp se fait dans ce
//    bloc, jamais à la main dans app/wsva.css.
const extensions = `
/* ============================================================
   Field Archive (V2) — verdict « archivé » : cadre à coins cornés,
   filigrane emblème et cachet incliné. Scopé .rp (pages résultat et
   profil), harmonisé aux teintes bronze/or du canvas — contrastes et
   graphes wsva inchangés.
   ============================================================ */
.rp .verdict-archive{position:relative;display:block;padding:var(--space-4) var(--space-4) var(--space-3);border:1px solid var(--edge);border-radius:var(--radius-panel);background:url("/atlas-emblem-watermark.png") right -14px bottom -14px/140px no-repeat,var(--panel-glass);padding-right:118px}
.rp .verdict-archive::before,.rp .verdict-archive::after{content:"";position:absolute;width:20px;height:20px;border:2px solid var(--accent-bronze);opacity:.65;pointer-events:none}
.rp .verdict-archive::before{top:8px;left:8px;border-right:0;border-bottom:0;border-top-left-radius:6px}
.rp .verdict-archive::after{right:8px;bottom:8px;border-left:0;border-top:0;border-bottom-right-radius:6px}
.rp .archive-cachet{position:absolute;top:12px;right:14px;transform:rotate(-6deg);padding:3px 9px;border:1.5px solid var(--accent-bronze);border-radius:4px;font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap;color:var(--gold);background:rgb(194 122 62 / .08)}
.rp .verdict-archive + .label-text{margin-top:var(--space-3)}
@media (width<=640px){.rp .verdict-archive{padding:var(--space-3) var(--space-3) var(--space-2);padding-right:var(--space-3)}.rp .archive-cachet{position:static;display:inline-flex;margin-top:var(--space-2);transform:rotate(-3deg)}}
/* ============================================================
   Transferts de ressources (V4 wsstats-detail) — sections
   « Sent by » / « Transactions » de la page résultat : tableaux
   denses façon ws-stats.pl, badges discrets, classes .rp du
   design-system wsva. Colonne 2+ alignée à droite (les valeurs
   par âge précèdent Total/Generosity ou suivent From).
   ============================================================ */
.rp .transfers-panel{gap:var(--space-3);display:grid}
.rp .transfers-heading{gap:var(--space-1);display:grid}
.rp .transfers-heading .label-text{margin:0}
.rp .transfers-table th:nth-child(n+2),.rp .transfers-table td:nth-child(n+2){text-align:right}
.rp .transfers-table .cell-left,.rp .transfers-table td.cell-left{text-align:left}
.rp .table-caption{caption-side:top;text-align:left;padding:0 0 var(--space-2);font-weight:600;color:var(--text-primary)}
.rp .cell-mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.rp .cell-strong{font-weight:600;color:var(--text-primary)}
.rp .transfer-badge{font-size:11px;font-weight:600}
.rp .transfer-gen-veryGenerous{border-color:var(--gold);color:var(--gold)}
.rp .transfer-gen-fair{border-color:var(--silver);color:var(--silver)}
.rp .transfer-gen-small{color:var(--text-muted)}
.rp .transfer-cert-veryLikely{border-color:#4cc9f080;color:var(--highlight)}
.rp .transfer-cert-likely{color:var(--text-muted)}
.rp .transfers-panel .table-scroll+.table-scroll{margin-top:var(--space-2)}
.rp .transfers-direction{color:var(--text-muted)}
/* ============================================================
   Player statistics (V4 wsstats-detail) — onglets du détail
   joueur (Resources/Units/Defeated/Buildings/Research, icônes
   lucide), cartes denses, sections repliables par catégorie,
   tuiles unité icône+nom+nombre (structure ws-stats.pl).
   ============================================================ */
.rp .player-stats{gap:var(--space-3);display:grid}
.rp .player-stats-tabs{flex-wrap:wrap}
.rp .player-stats-tab-icon{width:14px;height:14px;flex:none}
.rp .player-stats-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:var(--space-2)}
.rp .player-stats-tile{border:1px solid var(--edge);border-radius:var(--radius-tile);background:var(--panel-raised);padding:var(--space-2) var(--space-3);gap:var(--space-1);display:grid}
.rp .player-stats-tile-head{align-items:center;gap:var(--space-2);color:var(--text-muted);font-size:var(--text-small);font-weight:600;display:flex}
.rp .player-stats-tile-rows{gap:2px;display:grid}
.rp .player-stats-tile-row{justify-content:space-between;align-items:baseline;gap:var(--space-3);display:flex}
.rp .player-stats-tile-value{font-size:20px;font-weight:600;color:var(--text-primary)}
.rp .player-stats-groups{gap:var(--space-2);display:grid}
.rp .player-stats-groups-title{font-size:var(--text-h3);font-weight:600;color:var(--text-primary);margin:0}
.rp .player-stats-group{border:1px solid var(--edge);border-radius:var(--radius-tile);overflow:hidden}
.rp .player-stats-group-toggle{width:100%;justify-content:flex-start;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);font:inherit;font-weight:600;color:var(--text-default);cursor:pointer;background:var(--panel-raised);border:0;display:flex}
.rp .player-stats-group-toggle:hover{background:var(--row-hover)}
.rp .player-stats-group-toggle:focus-visible{outline:2px solid var(--focus-ring);outline-offset:-2px}
.rp .player-stats-chevron{width:16px;height:16px;flex:none;transition:transform var(--collapse-open-ms) var(--ease-out);color:var(--text-muted)}
.rp .player-stats-chevron-open{transform:rotate(0deg)}
.rp .player-stats-chevron:not(.player-stats-chevron-open){transform:rotate(-90deg)}
.rp .player-stats-group-count{margin-left:auto;white-space:nowrap}
.rp .player-stats-unit-grid{padding:var(--space-2);gap:var(--space-2);background:var(--panel-inset);grid-template-columns:repeat(auto-fill,minmax(150px,1fr));display:grid}
.rp .player-stats-unit-tile{align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);border:1px solid var(--edge);border-radius:var(--radius-chip);background:var(--panel-raised);display:flex}
.rp .player-stats-unit-icon{width:28px;height:28px;object-fit:contain;flex:none;background:#0006;border-radius:4px}
.rp .player-stats-unit-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--text-small)}
.rp .player-stats-unit-count{margin-left:auto;min-width:2.5ch;text-align:right;flex:none}
.rp .player-stats-defeated{gap:var(--space-4);display:grid}
.rp .player-stats-research .research-image{width:22px;height:22px;object-fit:contain;background:#0006;border-radius:4px}

/* ============================================================
   Interface façon ws-stats.pl (V C 02/11) — patrons ergonomiques
   adoptés sur fond Field Archive sombre : en-têtes de section
   repliables (icône + chevron), sélecteur de métriques en tuiles
   denses, tables à filets fins.
   ============================================================ */
.rp .rp-section{gap:var(--space-2);display:grid;grid-template-columns:minmax(0,1fr)}
.rp .rp-section>.rp-section-toggle,.rp .rp-section>.rp-section-body{min-width:0}
.rp .rp-section-body>*{min-width:0}
.rp .rp-section-toggle{width:100%;justify-content:flex-start;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);font:inherit;font-family:var(--font-display);font-weight:600;font-size:var(--text-h3);color:var(--text-primary);cursor:pointer;background:0 0;border:0;display:flex}
.rp .rp-section-toggle:hover{color:var(--gold)}
.rp .rp-section-toggle:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
.rp .rp-section-chevron{width:16px;height:16px;flex:none;margin-left:auto;transition:transform var(--collapse-open-ms) var(--ease-out);color:var(--text-muted)}
.rp .rp-section-chevron:not(.rp-section-chevron-open){transform:rotate(-90deg)}
.rp .rp-section-body{gap:var(--space-3);display:grid;grid-template-columns:minmax(0,1fr)}
/* Sélecteur de métriques : tuiles denses alignées (icône + libellé),
   cible tactile ≥ 44 px, état actif souligné or — façon ws-stats. */
.rp .timeline-header .chip-group{gap:var(--space-1);width:100%;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr))}
.rp .timeline-header .chip{min-height:48px;flex-direction:column;justify-content:center;align-items:center;gap:5px;padding:8px 6px;border-color:var(--edge);background:var(--panel-raised);text-align:center;line-height:1.2}
.rp .timeline-header .chip:hover{border-color:var(--edge-strong);color:var(--text-primary)}
.rp .timeline-header .chip-active{border-color:var(--line-gold);color:var(--text-primary);background:var(--row-open);box-shadow:inset 0 -2px 0 var(--line-gold)}
.rp .timeline-header .chip .icon{width:20px;height:20px}
/* Tables denses : filets fins entre lignes (units-table des onglets). */
.rp .units-table td,.rp .units-table th{border-bottom:1px solid var(--edge)}
.rp .units-table tbody tr:last-child td{border-bottom:0}
/* ============================================================
   Charts sombres (refonte 03/11) — lisibilité des graphiques replay/
   profil sur le canvas Field Archive (#101413) :
   . les SVG .rp-chart remplissent leur conteneur (l'ancienne grille
     .timeline-chart-row 150px+1fr, pensée « label + chart » wsva,
     enfermait nos figures seules dans la colonne de 150 px) ;
   . légende interactive .rp-legend : chip estompé (opacité .45,
     pastille vidée) SANS text-decoration:line-through — neutralise
     aussi la règle vendor dormante .chart-legend-item (barré) ;
   . info-bulle .rp-chart-tip (HTML superposé, non mise à l'échelle) ;
   . courbe de points profil : encre/grille réhaussées (.graph-*).
   Palette et dégradés : components/replay/chart-theme.ts.
   ============================================================ */
.rp .timeline-chart-row{grid-template-columns:minmax(0,1fr)}
.rp .chart-frame{height:auto}
.rp .rp-chart{display:block;width:100%;height:auto;cursor:crosshair;touch-action:pan-y}
.rp .rp-chart-wrap{position:relative;min-width:0}
.rp .rp-stage{margin:0;min-width:0}
.rp .rp-stage-caption{margin-top:6px;color:var(--text-muted);font-size:12px;line-height:1.45}
.rp .rp-legend{flex-wrap:wrap;gap:4px 8px;margin-top:10px;min-width:0;display:flex}
.rp .rp-legend-chip{align-items:center;gap:6px;max-width:160px;min-width:0;padding:3px 10px;border:1px solid var(--edge);border-radius:999px;background:var(--panel-raised);color:var(--text-default);font:inherit;font-size:12px;cursor:pointer;display:inline-flex;transition:opacity .16s var(--ease-out),border-color .16s var(--ease-out)}
.rp .rp-legend-chip:hover,.rp .rp-legend-chip:focus-visible{border-color:var(--edge-strong);outline:2px solid var(--focus-ring);outline-offset:1px}
.rp .rp-legend-chip[aria-pressed="false"]{opacity:.45}
.rp .rp-legend-chip[aria-pressed="false"]:hover,.rp .rp-legend-chip[aria-pressed="false"]:focus-visible{opacity:.8}
.rp .rp-legend-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.rp .rp-legend-swatch{width:11px;height:11px;border-radius:3px;flex:none;border:1.5px solid #ffffff38}
.rp .rp-legend-chip[aria-pressed="false"] .rp-legend-swatch{background:0 0!important;border-color:currentColor}
.rp .rp-chart-tip{transform:translate(-50%,calc(-100% - 10px));pointer-events:none;background:#1d221cf2;border:1px solid #ffffff2e;border-radius:8px;padding:5px 10px;font-size:12px;color:#eef1e8;box-shadow:0 6px 18px #000a;white-space:nowrap;z-index:6;display:grid;gap:2px;position:absolute}
.rp .rp-chart-tip strong{color:#fff;font-variant-numeric:tabular-nums}
.rp .rp-chart-tip-swatch{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}
.rp .rp-chart-tip-clock{color:#aab3a0;font-variant-numeric:tabular-nums}
/* Vendor dormant : décoché = estompé, JAMAIS barré (retour utilisateur). */
.rp .chart-legend-item:has(.player-checkbox:not(:checked)) .player-chip{text-decoration:none;opacity:.45}
.rp .chart-legend-item:has(.player-checkbox:not(:checked)):hover .player-chip,.rp .chart-legend-item:has(.player-checkbox:not(:checked)):focus-within .player-chip{opacity:.8}
/* Courbe de points profil : grille/encre réhaussées pour le fond sombre. */
.rp .points-panel .points-chart svg{min-width:0}
.rp .graph-grid{stroke:#ffffff1a}
.rp .graph-axis{stroke:#ffffff3d}
.rp .graph-label{fill:#c8cfbf;font-size:12px}
.rp .graph-line{fill:none;stroke:#ffd166;stroke-width:2.4px;stroke-linejoin:round}
.rp .graph-dot{fill:#14161a;stroke:#ffd166;stroke-width:1.8px;cursor:pointer;transition:r .16s var(--ease-out)}
.rp .graph-dot:hover{r:5.5}
`;

// 8. Override « Field Archive » (V B 02/11) : encre et dégradé de page du
//    canvas .rp réchaudés en olive/sépia NUIT assortis à l'enveloppe ATLAS
//    (--background #101413) — remplace le sépia V3 (#181209→#0c0a07 sur
//    encre #0d0b08, vendor : #0a0a0a→#000). Panneaux, textes et courbes
//    wsva inchangés ; contrastes re-mesurés ≥ 4.5:1
//    (cf. ~/War-Selection/validation/design/voletB-contrastes.txt).
result += extensions;
result += `
/* Override Field Archive (VB 02/11) — injecté par scripts/scope-wsva-css.mjs,
 * NE PAS ÉDITER À LA MAIN : régénérer via le script. */
.rp{
  --ink:#0e100d;
  --page-gradient:linear-gradient(180deg,#151810 0%,#0a0c09 100%);
}
`;

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
