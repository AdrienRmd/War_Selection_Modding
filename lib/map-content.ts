export type EditableMap = {
  id: string;
  title: string;
  author: string;
  summary: string;
  description: string;
  game_version: string;
  players: number;
  category: string;
  mods: string;
  map_code: string;
  revision: number;
  status?: string;
  file_name: string;
  file_size: number;
  sha256: string;
  has_cover: boolean;
  has_file: boolean;
  updated_at?: string;
  rules?: { label: string; value: string }[];
};
export const stalingradDefault: EditableMap = {
  id: "stalingrad",
  title: "斯大林格勒",
  author: "Austin",
  summary: "伏尔加河畔的工业之城。争夺三大城区，在步兵、装甲与空军的协同中守住最后一道防线。",
  description:
    "1942 年，伏尔加河畔的工业重镇成为东线战场焦点。本图以城区争夺、装甲推进与大规模协作为核心。\n\n南城区、中心城区与北城区每 5 秒检查归属。每处据点每 120 秒向占领方各位置发放 500 肉 / 木 / 铁；双方争夺或无人时保留归属，易手后重新计时。\n\n下方技术资料依据 2026-09-09 本地代码整理，配置完成不等于实机验收。正式地图包与分享码由作者在编辑入口补充。",
  game_version: "待作者填写实测版本",
  players: 30,
  category: "历史战役",
  map_code: "",
  revision: 0,
  mods: "平衡 → 英雄 → 后期。英雄玩法与视觉必须配对。经济与旧 Storage 二选一。冬将军、227、旧 territory 与自定义伞兵不计入当前正式保留方案。",
  status: "editorial",
  file_name: "",
  file_size: 0,
  sha256: "",
  has_cover: false,
  has_file: false,
  rules: [
    { label: "阵营规模", value: "15 vs 15" },
    { label: "大学造价", value: "3000 / 2000 / 500" },
    { label: "大学条件", value: "20 名工人 · 最多 3 座" },
    { label: "工业二条件", value: "至少 40 名工人 201" },
    { label: "英雄限额", value: "每种 1 名 · 待验收" },
    { label: "工业工人", value: "201 生产入口限 60 · 待测" },
  ],
};
