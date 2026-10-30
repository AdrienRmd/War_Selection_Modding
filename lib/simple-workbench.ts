import { z } from "zod";
import { generateGameplayLua } from "./mod-export.mjs";

// Mode simple de l'atelier mods (/workbench/simple) : chargement du catalogue
// généré (scripts/gen-simple-catalog.mjs, données synchronisées wus-data),
// validation des brouillons, export Lua via LE MÊME moteur que l'atelier v6
// (lib/mod-export.mjs — aucun format réinventé), projets JSON avec version du
// dataset + valeurs d'origine pour détecter l'obsolescence des mods.
// Aucune valeur de jeu n'est codée ici : tout vient du catalogue généré.

export type SimpleGroup = "construction" | "combat" | "economy";

export interface SimpleField {
  key: string;
  group: SimpleGroup;
  label: string;
  labelEn: string;
  labelFr: string;
  help: string;
  helpEn: string;
  helpFr: string;
  path: string;
  raw: number;
  scale: number;
  value: number;
  min: number;
  max: number;
  step: number;
  kind?: "number" | "boolean";
  advanced?: boolean;
  round?: boolean;
  scope?: string;
  buildId?: number;
  productionGuard?: {
    producerId: number;
    workId: number;
    abilityId: number;
    abilityType?: number;
    targetId?: number;
    researchId?: number;
  };
  buildWorkerGuard?: { unitId: number; index: number };
}

export interface SimpleWeapon {
  key: string;
  fields: string[];
  rangeMin: number | null;
  rangeMax: number | null;
  rangeStop: number | null;
}

export interface SimpleUnit {
  /** Identifiant de fiche du dataset (ex. « 1/temple »), clé dans units-index. */
  id: string;
  /** Slot unitType du jeu (identifiant moteur utilisé dans les chemins Lua). */
  slot: number;
  name: string;
  nameEn: string;
  nameFr: string;
  fields: SimpleField[];
  weapons: SimpleWeapon[];
}

export interface SimpleCatalog {
  format: "ws-atlas-simple-catalog";
  schemaVersion: number;
  provenance: {
    datasetId: string;
    gameVersion: string;
    gameVersionNumber: number;
    steamBuild: string;
    gameplayVersion: number;
    catalogGeneratedAt: string;
    unitSlots: number;
    unitCount: number;
    ficheCount: number;
  };
  resources: { id: number; zh: string; en: string; fr: string }[];
  units: SimpleUnit[];
}

/** Brouillon du mode simple : unité (id fiche) → champ → texte saisi. */
export type SimpleDraft = Record<string, Record<string, string>>;

export interface SimpleEdit {
  unitId: string;
  fieldKey: string;
  value: number;
}

export const SIMPLE_CATALOG_URL = "/simple-catalog.json";
export const SIMPLE_CATALOG_GZ_URL = "/simple-catalog.json.gz";

export const isSimpleCatalog = (data: unknown): data is SimpleCatalog => {
  const c = data as SimpleCatalog;
  return (
    c?.format === "ws-atlas-simple-catalog" &&
    c?.schemaVersion === 1 &&
    Array.isArray(c?.units) &&
    c.units.length > 0 &&
    typeof c?.provenance?.datasetId === "string" &&
    c.units.every((u) => Array.isArray(u.fields))
  );
};

/** Catalogue du mode simple → forme attendue par le moteur d'export v6. */
const engineCatalog = (catalog: SimpleCatalog) => ({
  provenance: {
    steamBuild: catalog.provenance.steamBuild,
    gameplayVersion: catalog.provenance.gameplayVersion,
  },
  units: catalog.units.map((u) => ({
    id: u.slot,
    name: u.name,
    fields: u.fields,
    weapons: u.weapons,
    armor: [],
    ruleTargets: [],
  })),
});

const unitById = (catalog: SimpleCatalog) => {
  const map = new Map<string, SimpleUnit>();
  for (const u of catalog.units) map.set(u.id, u);
  return map;
};

/** Aplatit un brouillon en edits moteur (unitId = slot), en ignorant les vides. */
export function draftEdits(catalog: SimpleCatalog, draft: SimpleDraft): SimpleEdit[] {
  const byId = unitById(catalog);
  const edits: SimpleEdit[] = [];
  for (const [unitId, fields] of Object.entries(draft)) {
    const unit = byId.get(unitId);
    if (!unit) continue;
    for (const [fieldKey, text] of Object.entries(fields)) {
      if (!text || !text.trim()) continue;
      edits.push({ unitId, fieldKey, value: Number(text) });
    }
  }
  return edits;
}

/**
 * Valide un brouillon (bornes, précision, cohérence armes) et exécute le
 * précheck complet du moteur v6 (garde de production, chemins, conflits).
 * Renvoie les edits valeur ≠ baseline ; lève une Error expliquée sinon.
 */
export function validateSimpleDraft(catalog: SimpleCatalog, draft: SimpleDraft): SimpleEdit[] {
  const byId = unitById(catalog);
  const edits: { unitId: number; fieldKey: string; value: number }[] = [];
  for (const edit of draftEdits(catalog, draft)) {
    const unit = byId.get(edit.unitId);
    const field = unit?.fields.find((f) => f.key === edit.fieldKey);
    if (!unit || !field) throw new Error(`未知字段 ${edit.unitId} · ${edit.fieldKey}`);
    const text = draft[edit.unitId][edit.fieldKey];
    const value = Number(text);
    const raw = value * field.scale;
    if (
      !text.trim() ||
      !Number.isFinite(value) ||
      value < field.min ||
      value > field.max ||
      (!field.round && Math.abs(raw - Math.round(raw)) > 1e-7) ||
      (field.kind === "boolean" && value !== 0 && value !== 1)
    )
      throw new Error(
        `${unit.name} · ${field.label}：请输入 ${field.min}–${field.max} 之间的有效数值（最小精度 ${1 / field.scale}）。`,
      );
    if (Math.round(raw) !== field.raw)
      edits.push({ unitId: unit.slot, fieldKey: field.key, value });
  }
  if (edits.length) generateGameplayLua(engineCatalog(catalog), edits, "validation", [], "abort");
  return edits.map((e) => {
    const unit = catalog.units.find((u) => u.slot === e.unitId);
    if (!unit) throw new Error(`未知单位 slot ${e.unitId}`);
    return { unitId: unit.id, fieldKey: e.fieldKey, value: e.value };
  });
}

/** Export Lua : réutilise tel quel le moteur v6 (même format de sortie). */
export function simpleLua(catalog: SimpleCatalog, draft: SimpleDraft, title: string): string {
  const byId = unitById(catalog);
  const edits = draftEdits(catalog, draft).map((e) => {
    const unit = byId.get(e.unitId);
    if (!unit) throw new Error(`未知单位 ${e.unitId}`);
    return { unitId: unit.slot, fieldKey: e.fieldKey, value: e.value };
  });
  return generateGameplayLua(engineCatalog(catalog), edits, title, [], "abort");
}

// --- Projets JSON (mode simple) ----------------------------------------------------

export interface SimpleProjectEdit {
  unit: string;
  field: string;
  value: number;
  baselineRaw: number;
}

const projectSchema = z
  .object({
    format: z.literal("ws-atlas-simple-project"),
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(80),
    dataset: z
      .object({
        id: z.string().max(60),
        gameVersion: z.string().max(30),
        catalogGeneratedAt: z.string().max(40),
      })
      .strict(),
    edits: z
      .array(
        z
          .object({
            unit: z.string().min(1).max(80),
            field: z.string().min(1).max(120),
            value: z.number().finite(),
            baselineRaw: z.number().finite(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

export interface StaleField {
  unit: string;
  unitName: string;
  fieldKey: string;
  label: string;
  labelEn: string;
  labelFr: string;
  /** Valeur d'origine au moment de la création du mod (affichage). */
  wasValue: number;
  /** Valeur actuelle du jeu (affichage). */
  nowValue: number;
  /** Valeur choisie par le mod. */
  modValue: number;
}

export interface MissingField {
  unit: string;
  fieldKey: string;
}

export interface ImportedProject {
  name: string;
  dataset: { id: string; gameVersion: string; catalogGeneratedAt: string };
  /** Vrai quand le projet vient d'une autre version du dataset. */
  datasetChanged: boolean;
  draft: SimpleDraft;
  stale: StaleField[];
  missing: MissingField[];
}

export function readSimpleProject(text: string, catalog: SimpleCatalog): ImportedProject {
  if (text.length > 1024 * 1024) throw new Error("工程文件不能超过 1 MB。");
  let p;
  try {
    p = projectSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "不是有效的 WS ATLAS 简易模式工程文件；只接受本页面导出的 JSON，不执行 Lua 或外部路径。",
    );
  }
  const byId = unitById(catalog);
  const draft: SimpleDraft = {};
  const stale: StaleField[] = [];
  const missing: MissingField[] = [];
  for (const e of p.edits) {
    const unit = byId.get(e.unit);
    const field = unit?.fields.find((f) => f.key === e.field);
    if (!unit || !field) {
      missing.push({ unit: e.unit, fieldKey: e.field });
      continue;
    }
    const bucket = (draft[e.unit] ??= {});
    if (Object.hasOwn(bucket, e.field)) throw new Error("工程包含重复改动。");
    bucket[e.field] = String(e.value);
    if (e.baselineRaw !== field.raw)
      stale.push({
        unit: e.unit,
        unitName: unit.name,
        fieldKey: e.field,
        label: field.label,
        labelEn: field.labelEn,
        labelFr: field.labelFr,
        wasValue: e.baselineRaw / field.scale,
        nowValue: field.raw / field.scale,
        modValue: e.value,
      });
  }
  return {
    name: p.name,
    dataset: p.dataset,
    datasetChanged: p.dataset.id !== catalog.provenance.datasetId,
    draft,
    stale,
    missing,
  };
}

/** Sauvegarde du projet : baseline = valeurs actuelles du dataset synchronisé. */
export function simpleProjectJSON(
  catalog: SimpleCatalog,
  draft: SimpleDraft,
  name: string,
): string {
  const byId = unitById(catalog);
  const edits: SimpleProjectEdit[] = [];
  for (const edit of draftEdits(catalog, draft)) {
    const unit = byId.get(edit.unitId);
    const field = unit?.fields.find((f) => f.key === edit.fieldKey);
    if (!unit || !field) continue;
    edits.push({
      unit: unit.id,
      field: field.key,
      value: edit.value,
      baselineRaw: field.raw,
    });
  }
  return JSON.stringify(
    {
      format: "ws-atlas-simple-project",
      schemaVersion: 1,
      name,
      dataset: {
        id: catalog.provenance.datasetId,
        gameVersion: catalog.provenance.gameVersion,
        catalogGeneratedAt: catalog.provenance.catalogGeneratedAt,
      },
      edits,
    },
    null,
    2,
  );
}
