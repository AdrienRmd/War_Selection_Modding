import { mods } from "@/lib/stalingrad";

// Explicit slug assignment keyed by each mod's unique archive name
// (lib/stalingrad.ts entries carry no slug field). The previous positional
// index pairing silently reshuffled URLs whenever either array was reordered;
// an unknown or duplicated name now fails loudly instead.
const slugsByName = new Map<string, string>([
  ["斯大林格勒 · 主体规则", "stalingrad-rules"],
  ["地面与防空平衡", "ground-balance"],
  ["空军与飞行后勤", "air-logistics"],
  ["精简经济", "lean-economy"],
  ["后期经济与奇迹", "late-game"],
  ["大学传奇英雄", "legendary-heroes"],
  ["双倍房屋人口", "housing"],
  ["三城区据点", "strongpoints"],
  ["载具运输", "transport"],
  ["中英开局指南", "opening-guide"],
  ["旧领土系统", "old-territory"],
  ["冬将军", "general-winter"],
  ["227 号命令", "order-227"],
  ["旧意大利自定义伞兵", "old-paratroopers"],
  ["伞兵三按钮 · 独立测试", "paratrooper-test"],
  ["新版伞兵接口诊断", "paratrooper-diagnostics"],
  ["环境资源与外部配置", "external-config"],
]);

export const modLibrary = mods.map((m) => {
  const slug = slugsByName.get(m.name);
  if (!slug) throw new Error("Missing slug for Stalingrad mod: " + m.name);
  return {
    ...m,
    slug,
    map: "斯大林格勒",
    asOf: "2026-09-09",
  };
});
