export const usageStates = [
  "active",
  "testing",
  "repair",
  "optional",
  "paused",
  "retired",
  "reference",
  "unverified",
] as const;
export const usageLabels: Record<string, [string, string]> = {
  active: ["保留方案", "Retained"],
  testing: ["待测试", "Testing"],
  repair: ["待修复验收", "Needs verification"],
  optional: ["可选", "Optional"],
  paused: ["暂停", "Paused"],
  retired: ["弃用", "Retired"],
  reference: ["参考资料", "Reference"],
  unverified: ["待核对", "Unverified"],
};
export const kindLabels: Record<string, [string, string]> = {
  gameplay: ["玩法 Mod", "Gameplay"],
  visual: ["视觉 Mod", "Visual"],
  bundle: ["大型 / 组合 Mod", "Mod collection"],
  tool: ["工具", "Tool"],
  tutorial: ["教程 / 示例", "Tutorial / example"],
};
export type ModBody = {
  title: string;
  title_en: string;
  author: string;
  summary: string;
  summary_en: string;
  description: string;
  description_en: string;
  instructions: string;
  instructions_en: string;
  compatibility: string;
  compatibility_en: string;
  game_version: string;
  mod_code: string;
  source_url: string;
  license: string;
  map_slug: string;
  kind: string;
  usage_status: string;
};
export type ModRecord = {
  id: string;
  owner_id: string | null;
  origin: string;
  body: string;
  status: string;
  revision: number;
  created_at: string;
  updated_at: string;
  feedback: string;
  file_key: string | null;
  file_name: string;
  file_size: number;
  sha256: string;
  review_token: string | null;
};
export type ModEntry = ModBody & {
  id: string;
  origin: string;
  status: string;
  revision: number;
  created_at: string;
  updated_at: string;
  feedback?: string;
  file_name: string;
  file_size: number;
  sha256: string;
  has_file: boolean;
  editable?: boolean;
};
export const emptyMod: ModBody = {
  title: "",
  title_en: "",
  author: "",
  summary: "",
  summary_en: "",
  description: "",
  description_en: "",
  instructions: "",
  instructions_en: "",
  compatibility: "",
  compatibility_en: "",
  game_version: "",
  mod_code: "",
  source_url: "",
  license: "",
  map_slug: "",
  kind: "gameplay",
  usage_status: "testing",
};
