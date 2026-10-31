/** Contexte de jeu consommé par le parser de replay : unités (catégorie,
 *  valeur de combat) et recherches (type, image), depuis le dataset public
 *  /wus-data/content/context.json (même exporteur que wsunitstats). */

export interface ReplayUnitContext {
  /** Identifiant de chemin (ex. « WarSelection/3/ew/knight »). */
  gameId: string;
  category?: string;
  killValue?: number;
  name?: string;
  image?: string;
}

export interface ReplayResearchContext {
  /** Identifiant numérique de recherche. */
  gameId: number;
  type: string;
  name?: string;
  image?: string;
}

export interface ReplayGameContext {
  units: Map<string, ReplayUnitContext>;
  researches: Map<number, ReplayResearchContext>;
  /** Valeur de combat par unité (raccourci pour le K/D). */
  killValues: Map<string, number>;
}

interface RawContextUnit {
  gameId?: unknown;
  category?: unknown;
  killValue?: unknown;
  name?: unknown;
  image?: unknown;
}

interface RawContextResearch {
  gameId?: unknown;
  type?: unknown;
  name?: unknown;
  image?: unknown;
}

/** Normalise le context.json brut (valeurs parfois en chaînes). */
export function buildGameContext(raw: {
  units?: RawContextUnit[];
  researches?: RawContextResearch[];
}): ReplayGameContext {
  const units = new Map<string, ReplayUnitContext>();
  const killValues = new Map<string, number>();
  for (const unit of raw.units ?? []) {
    if (typeof unit.gameId !== "string" || unit.gameId.length === 0) continue;
    const killValue =
      typeof unit.killValue === "number" ? unit.killValue : Number.parseFloat(String(unit.killValue ?? ""));
    const entry: ReplayUnitContext = {
      gameId: unit.gameId,
      category: typeof unit.category === "string" ? unit.category : undefined,
      killValue: Number.isFinite(killValue) ? killValue : undefined,
      name: typeof unit.name === "string" ? unit.name : undefined,
      image: typeof unit.image === "string" ? unit.image : undefined,
    };
    units.set(unit.gameId, entry);
    if (entry.killValue !== undefined) killValues.set(unit.gameId, entry.killValue);
  }
  const researches = new Map<number, ReplayResearchContext>();
  for (const research of raw.researches ?? []) {
    const gameId =
      typeof research.gameId === "number"
        ? research.gameId
        : Number.parseInt(String(research.gameId ?? ""), 10);
    if (!Number.isInteger(gameId)) continue;
    researches.set(gameId, {
      gameId,
      type: typeof research.type === "string" ? research.type : "researchTypeOther",
      name: typeof research.name === "string" ? research.name : undefined,
      image: typeof research.image === "string" ? research.image : undefined,
    });
  }
  return { units, researches, killValues };
}

/** Charge le contexte depuis le dataset servi (Apache, gzip statique). */
export async function loadGameContext(fetchImpl: typeof fetch = fetch): Promise<ReplayGameContext> {
  const response = await fetchImpl("/wus-data/content/context.json");
  if (!response.ok) {
    throw new Error(`context.json: HTTP ${response.status}`);
  }
  return buildGameContext(await response.json());
}
