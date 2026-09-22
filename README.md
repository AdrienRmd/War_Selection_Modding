# WS-Lab — WS ATLAS

War Selection 玩家地图档案、Mod 资料库与单位 Mod 工作台。网站支持中文和英文。

This is the source repository for **WS ATLAS**, an unofficial War Selection map archive, mod library, and unit-mod workbench.

## 协作入口 / Start here

- 此仓库是当前网站 v8 的独立源码快照，已补齐 Discord 地图配图：172 份收藏，167 份有图片。图片不等于当前游戏版本实测。
- 网站源码、必要素材、单位参考数据和数据库结构在本仓库内；生产数据库、用户上传文件、登录凭据、本地测试数据和旧 Git 历史不在其中。
- 导出时移除了当前线上网站的项目绑定 ID。`.openai/hosting.json` 只保留本地运行所需的 `DB` / `BUCKET` 逻辑名称。
- 当前线上网站继续独立运行。**推送到 GitHub 不会自动部署，也不会自动改变网站域名或解决国内访问。**
- 登录、投稿、审核与存储目前依赖 Sites / Cloudflare Workers、D1、R2；完整网站不能直接当作 GitHub Pages 静态站发布。

**Contributors:** read [DEVELOPMENT.md](DEVELOPMENT.md) for local setup, current hosting constraints and collaboration notes. Read [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before redistributing assets or making this repository public.

**Security:** never expose the development server or deploy the current identity-header authentication directly on an untrusted host. See [SECURITY.md](SECURITY.md).

## 原项目说明 / Existing project documentation

非官方 War Selection 玩家地图与 Mod 社区门户，首张编辑档案为斯大林格勒。

## v6：扩展 Mod 工作台

- 453 个原版单位，8 个参数分组；新增经济、采集、人口、运输、航空、建造、已有技能与研究队列编辑。每项附中英效果说明、原版值、高级标记及可选 Lua 路径。
- 按 Build ID 编辑各已存在阵营的地基/施工费用并计算总价；按 Work/Ability 映射编辑训练、转化、科技的队列费用和时间。研究效果与新按钮不在本版范围。
- 可添加或更新建造/队列的单位数量门槛；保留原有研究前置。最多四条单位条件；any-of 条件只读。最大数量是游戏条件门槛，不承诺阻止并行队列绕过。
- 默认遇到原版数值或目标映射冲突时整体停止预检，可显式选择覆盖。导出只在 onStart 执行，无新增高频扫描；真实游戏行为仍需私人局测试。
- JSON v2 保存数值、条件与冲突策略，仍接受同一原版哈希的 v1 工程。只读内置路径白名单，不执行上传的 Lua；草稿仍仅在页面内存。
- 内置数据使用约 0.83 MB gzip 传输并保留旧浏览器 JSON 回退。地图、Mod 资料库、现有审核数据及所有游戏文件未更改。

## v5：作者收藏地图导入

- 从作者提供的 Google 文档“地图管理”部分导入 72 个唯一地图码；75 处出现合并为 72 张地图。不导入前面的设计构思、脚本和未发布方案，也不公开整份源文档。
- 全部以“待实测”收录。六张详细记录保留原作者、人数、规则及 Mod 笔记；另外保留一段对应关系尚不确定的韦斯特普拉特说明，以及两处 15v15 / 10v10 标注。未知字段留空，英文界面保留原地图名称。
- 原图仅作辨识参考，不伪造截图、地图包或下载。`map-0c5580a5` 的重复记录存在预览冲突，保留第一次对应预览并标明歧义；五张地图没有预览。
- `/maps` 直接提供收藏搜索、筛选与分页显示，每张地图可以复制地图码、查看详情及原图。原斯大林格勒档案、社区投稿审核和 Mod 资料库均保留。
- 管理员从“我的作品 → 地图 → 管理收藏地图”进入 `/maps/collection/manage`，可编辑资料、记录测试结果、隐藏或恢复。非待测状态要求日期、游戏版本及测试记录。
- 复用 `featured_maps` 保存收藏资料覆盖值；每条记录带修订号，不覆盖斯大林格勒或之后的管理员修改。不新增数据库迁移，不把本地测试数据发布到生产。

## v4：双语创作社区

- 左上角中文 / ENGLISH 即时切换，cookie 记住语言；切换不会清空表单或工作台草稿。未提供翻译的玩家作品保留作者原文；完整历史技术文档明确标注为中文原始资料。
- 原创生成徽记见 `public/atlas-emblem-v4.png`；生成方式与完整提示词见 [LOGO-NOTES.md](LOGO-NOTES.md)。
- 资料库包含 17 项斯大林格勒资料和 6 项 GitHub 项目（其中 1 项参考工具），14 个来源核对的 Mod 发布码；不声称已通过当前游戏实测。外部内容独立收录，不自动启用到地图。
- `/submit/mod` 支持双语介绍、安装 / 依赖 / 冲突说明、逐行 Mod 码、来源 / 许可，以及可选 Lua / ZIP（10 MB）。新投稿至少提供代码、来源链接、文件之一。
- `/mods/:id/edit` 仅作者或管理员可用。管理员可维护精选资料；普通社区投稿和修改均重新审核。`/submissions` 和 `/admin` 分别用地图、Mod 标签管理，非管理员无法审批。
- Mod API `/api/mods` 使用独立待审 / 新投稿额度（3 / 5），同源校验、服务器身份、修订号和四项人工审核。未审 / 撤回文件不公开；上传 Lua 仅当 UTF-8 文本保存，绝不执行。文件替换成功后检查旧对象无引用才清理。
- 新 schema-only 迁移 `drizzle/0002_crazy_goblin_queen.sql` 创建 `community_mods` 与 `mod_reviews`。精选内容为代码中的只读初始值，D1 编辑覆盖；隐藏记录不会被初始值重新公开。
- 本轮仍使用原公开站点和 ChatGPT 登录。未承诺中国大陆可达，未购买、迁移或创建外部托管服务。

本轮更新与工作台边界见 [WORKBENCH-NOTES.md](WORKBENCH-NOTES.md)。

## 产品与内容

- 首页地图档案、审核通过的玩家地图；无虚构下载量、评分或示例投稿。
- 地图 `/maps`、独立 Mod 资料库 `/mods`、单位编辑 `/workbench`；斯大林格勒保留 35 种单位表、经济与改进测试历史档案。
- `lib/stalingrad.ts` 是整理后的界面数据；`lib/reference.ts` 和 `public/stalingrad-reference.md` 为 2026-09-09 文档快照。不是实时游戏数据库。
- 斯大林格勒地图分享码与正式 ZIP 包可由管理员在编辑入口填写；未提供时不生成假下载。
- 此项目没有改动任何原始游戏 Mod 或地图。

## 投稿与审核

`/submit` → pending → 管理员四项检查与意见 → approved / rejected；作者可撤回为 withdrawn。作者可以编辑同一稿件，保存后重新进入 pending，不允许绕过审核直接替换已审文件。

D1 保存地图元数据及审核日志；R2 保存 ZIP 和可选封面。未审核/下架文件仅作者或管理员能下载。公开数据不包含账号 ID 或邮箱。图片签名和 ZIP 签名检查不是病毒扫描；服务器不解压、不执行内容。

限制：ZIP 10 MB，封面 PNG/JPEG 2 MB，总请求 13 MB；每人 3 份待审、24 小时最多 5 次投稿。地图列表按 24 项加载，个人/审核列表最近 100 项。审核动作带修订号，防止旧页面覆盖新结果。

## 身份与部署安全

使用 Sites 提供的 ChatGPT 登录与受信身份头。服务端 `ADMIN_EMAILS` 精确匹配授权邮箱，值仅配置在 Sites 环境变量中。生产默认拒绝未配置的管理员，不让首个访客自动获得管理员。

本地 `.env.example` 仅用于 starter 的回环地址模拟登录账号。`build/sites-vite-plugin.ts` 会剥离伪造身份头，模拟登录只在开发模式的回环地址有效，不构建进生产身份入口。不要把开发服务器暴露到公网；生产必须经 Sites 身份分发层访问。

数据库迁移为 `drizzle/0000_steady_bucky.sql`、`drizzle/0001_public_dark_beast.sql` 和 `drizzle/0002_crazy_goblin_queen.sql`，只有表和索引，无测试或业务种子数据。测试数据始终留在本地 `.wrangler`，不随发布迁移上传。撤回是软下架，当前文件和日志仍保留；Mod 文件替换后清理无引用旧对象。

## 验证与维护

- `node scripts/test-atlas.mjs`：仅允许 localhost / 127.0.0.1，检查 29 个本地 API/页面断言，使用模拟 ZIP；结束自动撤回。
- `npx tsc --noEmit`：类型检查。
- 使用 Sites build/package 脚本打包。保留当前锁文件与项目依赖。
- WebMCP 提供只读 `read_stalingrad_configuration`，不提供跳过审核的发布工具。
- 封面来源与完整生成提示词见 `public/artwork-notes.md`；封面为 AI 插画，地图缩略图是作者提供的本地资料。

---

## 底层开发说明

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Windows, macOS, or Linux; Git is required only for publishing, and Bash is not required for initialization or the project commands

## Sites Lifecycle

The bundled Sites initializer copies this starter into the project and runs its locked dependency install before returning the checkout. Edit the source under `app/`, use `npm run dev` for the Codex local preview, and run the project validation before hosting. The remote Sites builder also runs `npm run build` against the pushed commit. Do not rerun the dependency install unless dependencies are absent or the lockfile changed.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against this checkout's bundled lockfile, explicitly targeting the project and disabling parent-workspace discovery. It includes dev and optional dependencies required for builds and previews even when production/omit settings would exclude them. It defaults Sharp to prebuilt binaries unless the caller explicitly configures Sharp or a source build. It uses `--prefer-offline --no-audit --no-fund`, reuses the configured npm cache, and leaves network concurrency, retries, timeouts, and lifecycle-script policy to npm's configuration. Retain the installer session until it finishes; do not overlap installers for the same checkout.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

`npm run dev` uses `vinext dev` for the live Vite preview with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state and rejects another start for the same checkout while that process is alive; reuse its printed URL. It recovers stale state after a stopped process. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep Codex previews on loopback. Like the Sites package, this relies on Vinext's advisory lock; exactly simultaneous starts can race.

The bundled Sites Vite plugin simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. This does not exercise real ChatGPT OAuth and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

Like the Sites package, `npm run build` runs `vinext build` directly; it does not require a host `timeout` command.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
