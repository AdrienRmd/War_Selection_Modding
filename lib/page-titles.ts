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
  /** Route exacte ou expression régulière (segments dynamiques). */
  path: RegExp;
  meta: PageMeta;
}

// L'ordre compte : les routes spécifiques précèdent les génériques
// (/maps/stalingrad avant /maps/[slug]).
export const pageRoutes: Record<string, PageRoute> = {
  home: {
    path: /^\/$/,
    meta: {
      title: "WS ATLAS · 战场档案",
      description:
        "War Selection 玩家地图与 Mod 社区档案。探索斯大林格勒战场，查阅配置、平衡数值与审核后的社区地图。",
    },
  },
  units: { path: /^\/units$/, meta: { title: "单位档案 | WS ATLAS" } },
  researches: { path: /^\/researches$/, meta: { title: "科技档案 | WS ATLAS" } },
  replay: { path: /^\/replay$/, meta: { title: "回放分析 | WS ATLAS" } },
  modding: { path: /^\/modding$/, meta: { title: "参数档案 | WS ATLAS" } },
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
    path: /^\/workbench$/,
    meta: {
      title: "Mod 工作台 | WS ATLAS",
      description:
        "编辑 War Selection 单位、武器、经济、建造、科技与技能参数，查看效果说明，设置前置条件并导出 Lua。",
    },
  },
  workbenchSimple: {
    path: /^\/workbench\/simple$/,
    meta: {
      title: "简易 Mod 工作台 | WS ATLAS",
      description:
        "三步创建 War Selection 平衡 Mod：选择单位、修改数值（原值可见）、导出 Lua。数据来自当前同步的游戏版本。",
    },
  },
  reference: {
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
