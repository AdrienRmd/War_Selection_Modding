import { z } from "zod";
import { generateGameplayLua } from "./mod-export.mjs";
export type Guard = {
  producerId: number;
  workId: number;
  abilityId: number;
  abilityType?: number;
  targetId?: number;
  researchId?: number;
};
export type Field = {
  key: string;
  label: string;
  labelEn?: string;
  path: string;
  raw: number;
  scale: number;
  value: number;
  group: string;
  min: number;
  max: number;
  step: number;
  kind?: "number" | "boolean";
  help?: string;
  helpEn?: string;
  advanced?: boolean;
  defaulted?: boolean;
  round?: boolean;
  scope?: string;
  buildId?: number;
  productionGuard?: Guard;
};
export type Rule = {
  unitId: number;
  targetKey: string;
  requiredUnitId: number;
  min: number;
  max: number;
};
export type RuleTarget = {
  key: string;
  label: string;
  labelEn: string;
  path: string;
  buildId?: number;
  guard?: Guard;
  requirements: {
    unitsAll: boolean;
    units: { id: number; min: number; max: number }[];
    researchAny: number[];
    researchAll: number[];
  };
};
export type Unit = {
  id: number;
  name: string;
  nameEn: string;
  nation: string;
  category: string;
  population: number | null;
  fields: Field[];
  weapons: {
    key: string;
    label: string;
    enabled: boolean;
    fields: string[];
    rangeMin: number | null;
    rangeMax: number | null;
    rangeStop: number | null;
  }[];
  armor: { index: number; thickness: number; probabilityWeight: number | null; fieldKey: string }[];
  trainingSources: {
    producerId: number;
    producerName: string;
    workId: number;
    count: number;
    fields: string[];
    enabled: boolean;
    phases: string[];
  }[];
  workItems: {
    workId: number;
    abilityId: number;
    type: number;
    label: string;
    labelEn: string;
    fields: string[];
    ruleKey: string;
  }[];
  buildingCosts: { buildId: number; fields: string[]; ruleKey: string }[];
  ruleTargets: RuleTarget[];
  abilityItems: { id: number; type: number; research?: number; target?: number; action: boolean }[];
};
export type Catalog = {
  schemaVersion: number;
  provenance: {
    steamBuild: string;
    gameplayVersion: number;
    sourceSha256: string;
    sourceUpdatedAt: string;
    extractedAt: string;
  };
  units: Unit[];
};
export type Edit = { unitId: number; fieldKey: string; value: number };
export type Draft = Record<string, string>;
export type ConflictMode = "abort" | "overwrite";
export const editKey = (id: number, key: string) => id + ":" + key;
export function validateDraft(
  c: Catalog,
  draft: Draft,
  rules: Rule[] = [],
  mode: ConflictMode = "abort",
) {
  const edits: Edit[] = [];
  for (const [key, text] of Object.entries(draft)) {
    const [id, ...parts] = key.split(":"),
      fieldKey = parts.join(":");
    const u = c.units.find((u) => u.id === Number(id)),
      f = u?.fields.find((f) => f.key === fieldKey);
    if (!u || !f) throw new Error("包含未知的单位或数值字段，请重新导入。");
    const value = Number(text),
      raw = value * f.scale;
    if (
      !text.trim() ||
      !Number.isFinite(value) ||
      value < f.min ||
      value > f.max ||
      (!f.round && Math.abs(raw - Math.round(raw)) > 1e-7)
    )
      throw new Error(
        u.name +
          " #" +
          u.id +
          " · " +
          f.label +
          "：请填写 " +
          f.min +
          "–" +
          f.max +
          " 之间的有效数值（最小精度 " +
          1 / f.scale +
          "）。",
      );
    if (Math.round(raw) !== f.raw) edits.push({ unitId: u.id, fieldKey, value });
  }
  if (edits.length || rules.length)
    try {
      generateGameplayLua(c, edits, "validation", rules, mode);
    } catch (e) {
      throw new Error(
        "导出校验未通过，请检查改动：" + (e instanceof Error ? e.message : String(e)),
      );
    }
  return edits;
}
const ruleSchema = z
  .object({
    unitId: z.number().int().nonnegative(),
    targetKey: z.string().max(80),
    requiredUnitId: z.number().int().nonnegative(),
    min: z.number().int().min(0).max(65535),
    max: z.number().int().min(0).max(65535),
  })
  .strict();
const base = z.object({
  format: z.literal("ws-atlas-unit-project"),
  name: z.string().trim().min(1).max(80),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  steamBuild: z.string().max(30),
  edits: z
    .array(
      z
        .object({
          unitId: z.number().int().min(0).max(100000),
          fieldKey: z.string().max(120),
          value: z.number().finite(),
        })
        .strict(),
    )
    .max(500),
});
const projectSchema = z.union([
  base.extend({ schemaVersion: z.literal(1) }).strict(),
  base
    .extend({
      schemaVersion: z.literal(2),
      rules: z.array(ruleSchema).max(100),
      conflictMode: z.enum(["abort", "overwrite"]),
    })
    .strict(),
]);
export function readProject(text: string, c: Catalog) {
  if (text.length > 1024 * 1024) throw new Error("工程文件不能超过 1 MB。");
  let p;
  try {
    p = projectSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "不是有效的 WS ATLAS 工程文件；只接受工作台导出的 JSON，不执行 Lua 或外部路径。",
    );
  }
  if (p.sourceSha256 !== c.provenance.sourceSha256 || p.steamBuild !== c.provenance.steamBuild)
    throw new Error("工程使用不同的原版数据快照，暂不自动迁移。请保留旧工程，核对数值后重新建立。");
  const draft: Draft = {};
  for (const e of p.edits) {
    const key = editKey(e.unitId, e.fieldKey);
    if (Object.hasOwn(draft, key)) throw new Error("工程包含重复改动。");
    draft[key] = String(e.value);
  }
  const rules = p.schemaVersion === 2 ? p.rules : [],
    conflictMode = p.schemaVersion === 2 ? p.conflictMode : "abort";
  return {
    name: p.name,
    draft,
    rules,
    conflictMode,
    edits: validateDraft(c, draft, rules, conflictMode),
  };
}
export function projectJSON(
  c: Catalog,
  edits: Edit[],
  name: string,
  rules: Rule[] = [],
  conflictMode: ConflictMode = "abort",
) {
  return JSON.stringify(
    {
      format: "ws-atlas-unit-project",
      schemaVersion: 2,
      name,
      sourceSha256: c.provenance.sourceSha256,
      steamBuild: c.provenance.steamBuild,
      edits,
      rules,
      conflictMode,
    },
    null,
    2,
  );
}
export function lua(
  c: Catalog,
  edits: Edit[],
  name: string,
  rules: Rule[] = [],
  mode: ConflictMode = "abort",
) {
  return generateGameplayLua(c, edits, name, rules, mode);
}
