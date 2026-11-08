import { translate, type Locale } from "./i18n";

// Registre des <title> / descriptions meta par page, pour les trois locales.
// Les chaînes sont des clés zh-source : en/fr se résolvent via les
// dictionnaires (mécanisme zh-source inchangé). Le registre est isomorphe :
// serveur (generateMetadata via lib/page-metadata) et client
// (synchronisation de document.title dans LocaleProvider).

export interface PageMeta {
  /** Clé zh du titre localisé. */
  title: string;
  /** Clé zh de la meta description, si la page en expose une. */
  description?: string;
}

export interface PageRoute {
  /** Chemin canonique absolu du site (SEO 08/11) — vide pour la racine,
   *  absent pour les routes à paramètres (passé par la page). */
  canonical?: string;
  /** Route exacte ou expression régulière (segments dynamiques). */
  path: RegExp;
  meta: PageMeta;
}

// L'ordre compte : les routes spécifiques précèdent les génériques
// (/maps/stalingrad avant /maps/[slug]).
export const pageRoutes: Record<string, PageRoute> = {
  home: {
    canonical: "/",
    path: /^\/$/,
    meta: {
      title: "WS ATLAS · 战场档案",
      description:
        "War Selection 玩家地图与 Mod 社区档案。探索斯大林格勒战场，查阅配置、平衡数值与审核后的社区地图。",
    },
  },
  units: {
    canonical: "/units",
    path: /^\/units$/,
    meta: {
      title: "War Selection 单位档案 | WS ATLAS",
      description: "War Selection 全部单位的档案：属性、时代、克制与数据图鉴。",
    },
  },
  researches: {
    canonical: "/researches",
    path: /^\/researches$/,
    meta: {
      title: "War Selection 科技档案 | WS ATLAS",
      description: "War Selection 全部科技树：名称、说明、解锁单位与数据。",
    },
  },
  replay: {
    canonical: "/replay",
    path: /^\/replay$/,
    meta: {
      title: "War Selection 回放分析 | WS ATLAS",
      description:
        "粘贴回放代码，得到逐帧统计：人口曲线、MVP、奖章、K/D 与玩家排行数据。",
    },
  },
  players: {
    canonical: "/players",
    path: /^\/players$/,
    meta: {
      title: "War Selection 玩家排行榜 | WS ATLAS",
      description:
        "每赛季的玩家积分榜：参赛、胜利、MVP 与击杀都折算成积分。数据来自已公开的回放。",
    },
  },
  seasonStats: {
    canonical: "/season-statistics",
    path: /^\/season-statistics$/,
    meta: {
      title: "赛期统计 | WS ATLAS",
      description:
        "已公开回放汇总：流行模式、平均时长、服务器地区与产量最高的单位。",
    },
  },
  modding: { path: /^\/modding$/, meta: { title: "参数档案 | WS ATLAS" } },
  methodology: {
    canonical: "/methodologie",
    path: /^\/methodologie$/,
    meta: {
      title: "War Selection 统计方法：MVP 怎么算 | WS ATLAS",
      description:
        "MVP 分数怎么算、人口曲线为什么是估算、奖章条件、排行榜积分——本页逐项公开每个数字背后的公式。",
    },
  },
  creators: {
    canonical: "/createurs",
    path: /^\/createurs$/,
    meta: {
      title: "内容创作者 | WS ATLAS",
      description:
        "制作地图与 Mod 的创作者们：作品、频道与社区，一站呈现。",
    },
  },
  // Ordre : la route STATIQUE candidature doit précéder le profil
  // dynamique [^/]+ (résolution par première correspondance).
  creatorApply: {
    canonical: "/createurs/candidature",
    path: /^\/createurs\/candidature$/,
    meta: { title: "申请成为创作者 | WS ATLAS" },
  },
  creatorProfile: {
    path: /^\/createurs\/[^/]+$/,
    meta: { title: "创作者档案 | WS ATLAS" },
  },
  maps: { path: /^\/maps$/, meta: { title: "地图档案 | WS ATLAS" } },
  mapsStalingrad: {
    path: /^\/maps\/stalingrad$/,
    meta: { title: "斯大林格勒 · 地图档案 | WS ATLAS" },
  },
  mapsCollectionManage: {
    path: /^\/maps\/collection\/manage$/,
    meta: { title: "收藏地图管理 | WS ATLAS" },
  },
  mapsSlugEdit: {
    path: /^\/maps\/[^/]+\/edit$/,
    meta: { title: "编辑地图 | WS ATLAS" },
  },
  mapsSlug: {
    path: /^\/maps\/[^/]+$/,
    meta: { title: "玩家地图档案 | WS ATLAS" },
  },
  mods: { path: /^\/mods$/, meta: { title: "Mod 资料库 | WS ATLAS" } },
  modsSlugEdit: {
    path: /^\/mods\/[^/]+\/edit$/,
    meta: { title: "编辑 Mod | WS ATLAS" },
  },
  modsSlug: { path: /^\/mods\/[^/]+$/, meta: { title: "Mod 档案 | WS ATLAS" } },
  submit: { path: /^\/submit$/, meta: { title: "提交地图 | WS ATLAS" } },
  submitMod: { path: /^\/submit\/mod$/, meta: { title: "提交 Mod | WS ATLAS" } },
  workbench: {
    canonical: "/workbench",
    path: /^\/workbench$/,
    meta: {
      title: "Mod 工作台 | WS ATLAS",
      description:
        "编辑 War Selection 单位、武器、经济、建造、科技与技能参数，查看效果说明，设置前置条件并导出 Lua。",
    },
  },
  workbenchSimple: {
    canonical: "/workbench/simple",
    path: /^\/workbench\/simple$/,
    meta: {
      title: "简易 Mod 工作台 | WS ATLAS",
      description:
        "三步创建 War Selection 平衡 Mod：选择单位、修改数值（原值可见）、导出 Lua。数据来自当前同步的游戏版本。",
    },
  },
  reference: {
    canonical: "/reference",
    path: /^\/reference$/,
    meta: { title: "斯大林格勒完整技术档案 | WS ATLAS" },
  },
  guidelines: { path: /^\/guidelines$/, meta: { title: "投稿与审核规范 | WS ATLAS" } },
  signin: { path: /^\/signin$/, meta: { title: "登录 | WS ATLAS" } },
  signup: { path: /^\/signup$/, meta: { title: "创建账号 | WS ATLAS" } },
  account: { path: /^\/account$/, meta: { title: "我的账号 | WS ATLAS" } },
  submissions: { path: /^\/submissions$/, meta: { title: "我的创作 | WS ATLAS" } },
  admin: { path: /^\/admin$/, meta: { title: "管理员审核台 | WS ATLAS" } },
  legal: { path: /^\/legal$/, meta: { title: "法律声明 — WS ATLAS" } },
  contact: {
    canonical: "/contact",
    path: /^\/contact$/,
    meta: {
      title: "联系我们 — 开发者 | WS ATLAS",
      description: "WS ATLAS 的开发者与联系方式：GitHub 与电子邮件。",
    },
  },
  terms: { path: /^\/terms$/, meta: { title: "使用条款 — WS ATLAS" } },
  privacy: { path: /^\/privacy$/, meta: { title: "隐私政策 — WS ATLAS" } },
};

/** Trouve la méta d'une page par chemin (sans query) ; undefined si inconnue. */
export function resolvePageMeta(pathname: string | null | undefined): PageMeta | undefined {
  if (!pathname) return undefined;
  const path = pathname.split("?")[0];
  for (const route of Object.values(pageRoutes)) {
    if (route.path.test(path)) return route.meta;
  }
  return undefined;
}

/** Localise title/description pour une locale (translate, zh = identité). */
export function localizePageMeta(meta: PageMeta, locale: Locale): LocalizedPageMeta {
  return {
    title: translate(meta.title, locale),
    ...(meta.description
      ? { description: translate(meta.description, locale) }
      : {}),
  };
}

export interface LocalizedPageMeta {
  title: string;
  description?: string;
}
