/** Aides de rendu « façon wsva » pour la page résultat et le profil joueur.
 *
 *  Sources de vérité (aucune valeur codée en dur non documentée) :
 *  - lib/researches-index.json : noms localisés (en/fr/cn) et icônes
 *    (upgrade/<gameId>.png) des recherches — y compris les transitions d'âge,
 *    qui fournissent les libellés exacts « Iron Age of Europe » et les icônes
 *    d'âge (ids 1, 3, 5, 15, 59, 93 — mêmes ids que wsva).
 *  - lib/units-index.json : noms localisés des unités (id de fiche = gameId
 *    privé du préfixe « WarSelection/ », correspondance 453/453 vérifiée).
 *  - /wus-data/content/images/ : icônes officielles du jeu (unit/, upgrade/).
 *  - Âges des unités : dossier du chemin gameId (1..5) — cf. UNIT_AGE_BY_FOLDER
 *    (écart documenté vs wsva : leur découpe Iron/Early Med/Late Med du
 *    dossier 3 repose sur des données internes non publiées ; nous utilisons
 *    les 5 dossiers réels du jeu). */
import type { Locale } from "@/lib/i18n";
import {
  localizedResearchName,
  researchesIndex,
  type ResearchEntry,
} from "@/lib/researches";
import { unitsIndex, localizedUnitName, type UnitIndexEntry } from "@/lib/units";

const researches: ResearchEntry[] = researchesIndex.researches ?? [];
const researchById = new Map<number, ResearchEntry>(researches.map((r) => [r.gameId, r]));

const unitsByFicheId = new Map<string, UnitIndexEntry>(
  unitsIndex.units.map((u) => [u.id, u]),
);

/* ------------------------------------------------------------------ */
/* Jeu de données des images                                           */
/* ------------------------------------------------------------------ */

export const WUS_IMAGES = "/wus-data/content/images";

/** Icône d'une unité du jeu (gameId complet « WarSelection/3/ew/knight »). */
export function unitIconUrl(gameId: string): string {
  return `${WUS_IMAGES}/unit/${gameId}.png`;
}

/** Icône d'une recherche / transition d'âge (id numérique). */
export function researchIconUrl(researchId: number): string {
  const entry = researchById.get(researchId);
  return entry?.image ? `${WUS_IMAGES}/${entry.image}` : "";
}

/** Nom localisé d'une unité du jeu par gameId complet. */
export function unitDisplayName(gameId: string, locale: Locale): string {
  const entry = unitsByFicheId.get(gameId.replace(/^WarSelection\//, ""));
  if (!entry) {
    const slug = gameId.split("/").pop() ?? gameId;
    return slug.replace(/[_-]+/g, " ");
  }
  return localizedUnitName(entry, locale);
}

/** Nom localisé d'une recherche (transition d'âge, pays IR…). */
export function researchDisplayName(researchId: number, locale: Locale): string {
  const entry = researchById.get(researchId);
  return entry ? localizedResearchName(entry, locale) : "";
}

/* ------------------------------------------------------------------ */
/* Âges                                                                */
/* ------------------------------------------------------------------ */

/** Ids de recherche des transitions d'âge (icônes façon wsva). */
export const AGE_TRANSITION_ICONS = {
  stone: 0,
  bronze: 3,
  iron: 1,
  earlyMedieval: 5,
  lateMedieval: 15,
  industrial1: 59,
  industrial2: 93,
} as const;

/** Buckets d'âge des UNITES (dossier du chemin gameId — 5 dossiers réels). */
export type UnitAgeBucket = "stone" | "bronze" | "iron" | "industrial1" | "industrial2";

export const UNIT_AGE_BUCKETS: Array<{ key: UnitAgeBucket; folder: string; researchIcon: number }> =
  [
    { key: "stone", folder: "1", researchIcon: 0 },
    { key: "bronze", folder: "2", researchIcon: AGE_TRANSITION_ICONS.bronze },
    { key: "iron", folder: "3", researchIcon: AGE_TRANSITION_ICONS.iron },
    { key: "industrial1", folder: "4", researchIcon: AGE_TRANSITION_ICONS.industrial1 },
    { key: "industrial2", folder: "5", researchIcon: AGE_TRANSITION_ICONS.industrial2 },
  ];

/** Bucket d'âge d'une unité depuis son gameId (« WarSelection/3/ew/knight »). */
export function unitAgeBucket(gameId: string): UnitAgeBucket | null {
  const folder = gameId.split("/")[1];
  const bucket = UNIT_AGE_BUCKETS.find((b) => b.folder === folder);
  return bucket?.key ?? null;
}

/** Icône d'un bucket d'âge (0 = pierre : pas d'icône dédiée, gemme du roi). */
export function unitAgeBucketIcon(bucket: UnitAgeBucket): string {
  const meta = UNIT_AGE_BUCKETS.find((b) => b.key === bucket)!;
  if (bucket === "stone") return unitIconUrl("WarSelection/1/king");
  return researchIconUrl(meta.researchIcon);
}

/* ------------------------------------------------------------------ */
/* Formateurs                                                          */
/* ------------------------------------------------------------------ */

/** Format compact façon wsva : 30 400 → « 30k », 1 100 → « 1.1k ». */
export function compactNumber(value: number, locale: Locale): string {
  const fmt = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return fmt.format(Math.max(0, Math.round(value)));
}

/** Horloge de replay « m:ss » (ou « h:mm:ss » au-delà d'une heure). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/* ------------------------------------------------------------------ */
/* Métriques de la timeline (puces de sélection)                       */
/* ------------------------------------------------------------------ */

export interface TimelineMetric {
  key: string;
  /** Jeu de données scalaire par joueur (cf. analysis.playerSeries). */
  dataset: string | null;
  /** L'impact est notre série calculée impactRate, pas un dataset. */
  impact: boolean;
  icon: string;
}

/** Les 9 métriques façon wsva — toutes disponibles dans nos données. */
export const TIMELINE_METRICS: TimelineMetric[] = [
  { key: "impact", dataset: null, impact: true, icon: "/icons/crown.png" },
  { key: "kills", dataset: "replayDatasetUnitKillPoints", impact: false, icon: "/icons/swords.png" },
  {
    key: "army",
    dataset: "replayDatasetUnitCreatePoints",
    impact: false,
    icon: "/icons/manpower.png",
  },
  {
    key: "production",
    dataset: "replayDatasetResourcesSpent",
    impact: false,
    icon: "/icons/coins.png",
  },
  {
    key: "stockpile",
    dataset: "replayDatasetResourcesNow",
    impact: false,
    icon: "/icons/industrial.png",
  },
  {
    key: "workers",
    dataset: "replayDatasetWorkerPoints",
    impact: false,
    icon: "/icons/worker.png",
  },
  {
    key: "gatherEfficiency",
    dataset: "replayDatasetGatherEfficiency",
    impact: false,
    icon: "/icons/trend-up.png",
  },
  {
    key: "researches",
    dataset: "replayDatasetResearches",
    impact: false,
    icon: "/icons/report.png",
  },
  { key: "territory", dataset: "replayDatasetLandPoints", impact: false, icon: "/icons/map.png" },
];
