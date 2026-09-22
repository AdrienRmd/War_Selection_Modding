# Development / 开发协作

## What this repository contains

- `app/`, `components/`, `lib/`: bilingual website, APIs and curated map/mod records.
- `public/map-collection/`: saved map images; source links and qualification notes are in the collection seed files.
- `public/unit-catalog.json(.gz)`: reference data used by the Mod Workbench.
- `drizzle/`: schema-only database migrations. No production database contents.
- `build/` and `scripts/`: required development/build helpers. The `build/` directory is source code, not disposable compiled output.

The repository starts from a clean snapshot of website v8. Existing Sites Git history, local databases, credentials and player uploads are intentionally not copied. The original live checkout remains separate.

## Local setup

Use Node.js 22.13 or newer and npm. Keep the included lockfile.

```sh
npm run install:ci
```

Copy `.env.example` to `.env` using your editor or file manager. It contains only the fake local administrator identity, not a real account credential.

Build once to generate the local Worker configuration:

```sh
npm run build
```

For a **new empty local database only**, apply these three schema migrations in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_steady_bucky.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_public_dark_beast.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_crazy_goblin_queen.sql
```

Do not replay applied migration files against an existing database. These commands intentionally use `--local` and must not be changed to `--remote` for routine development.

```sh
npm run dev
```

Open the localhost URL printed by the server (normally port 5173). Local ChatGPT sign-in is a development simulation. It does not log into the production site or represent real OAuth.

## Validation

```sh
npx tsc --noEmit
npm run build
```

With the local server and local schema ready:

```sh
node scripts/test-collection.mjs
node scripts/test-collection-images.mjs
```

The collection tests use localhost only; one test temporarily changes and then restores a local record. Never point tests at production.

## Current hosting boundary

This is a full-stack Cloudflare Worker application, not a static HTML export. GitHub stores source and supports collaboration; it is not a deployment configuration for this app. No automatic deployment workflow is enabled.

The current production login trusts identity headers inserted by the Sites gateway. A future host needs its own verified session authentication, administrator setup, D1/R2 or storage adapters, migrations and backups. Do not copy this authentication trust to a directly accessible server. GitHub Pages alone cannot host the current backend: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

The exported `.openai/hosting.json` declares only logical local bindings; it does not connect contributors to the owner's live Site. Do not invent or copy a live project ID when testing locally.

## Collaboration

Use a branch per change and open a pull request to the owner. Include the intent, changed screenshots if applicable, and tests performed. Do not overwrite the main branch with force pushes. Do not add player account data, real emails in environment examples, credentials, production exports or local runtime folders.

地图与 Mod 的“已实测”状态必须有测试日期、游戏版本和测试记录；请保留原作者、原帖链接，以及原版/改编版关联。不要把参考图片标成此版本的独立实测截图。

Sharing the repository does not itself invite a collaborator. The owner must choose the correct GitHub account and access level before adding anyone.
