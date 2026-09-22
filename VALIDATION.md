# Validation — v6 expanded workbench, 2026-09-22

- 453 units / 928 work entries / 122 build plans expanded from the same Gameplay 3992 source hash. Every field has bilingual effect explanations; all baseline values lie inside editor bounds. Gzip and JSON catalogs are byte-content equivalent.
- Existing workbench regression checks passed. Expanded checks cover raw/display conversions, boolean types, fixed16 rounding, build/work IDs, ability target guards, duplicate/conflicting shared producer fields, invalid ranges/weights/conditions, four-condition bound, trusted-path imports and v1/v2 roundtrips.
- Six generated scripts executed in a Lua interpreter with mocked engine objects: ordinary edits and two faction build tables, requirements preserving research, numeric conflict abort without writes, retargeted work abort, mismatched build abort, explicit override, and buff target identity rejection. These checks do not reproduce the native game engine or constitute live gameplay certification.
- Browser verified University #194 / Build91 total cost updates, worker prerequisite40, self count3, and exported Lua preserving research prerequisites. English and Chinese UI, 1440px desktop and 390px mobile layouts inspected; mobile document width equals the viewport. Fixed a sidebar overlap at intermediate widths. Test draft cleared, viewport restored, and browser reported no console errors.
- No database schema/API/auth changes and no original game files modified. Existing map and mod catalogs preserved. Hosting migration remains deferred.

## v7 Discord map sources and editions, 2026-09-22

- 114 rendered map-forum posts reviewed. Selected 107 unique codes: 100 new entries and 7 same-code supplements; 172 unique codes in the combined collection. See DISCORD_MAP_IMPORT.md for selection caveats.
- Existing seeds, author credits and persisted administrator overrides are preserved. Same-code Atlantic reposts retain both sources and unresolved player counts. Eight Max original/diplomacy pairs, known gameplay variants, and Austin/Yurky Stalingrad provenance are linked separately.
- 36 targeted local checks passed, including source scoping, deduplication, untested status, relation targets, preserved author credit, existing source-conflict warnings, edit rights, hidden access, stale revision rejection, test-evidence requirements, restoration and route renders. TypeScript passed.
- Browser verified Chinese/English original Stalingrad details, the bidirectional remix link and preserved featured rules; same-code search gives one result and Europe search exposes separate original/diplomacy editions. Browser console showed no warnings/errors during the checked interaction.
- Three local original-post image assets inspected; Stalingrad's historical illustration is explicitly distinguished from an in-game screenshot. Remaining absent previews direct readers to sources instead of claiming that authors supplied no image.
- No game execution, current-game certification, schema migration, production database backfill, original game edits or Discord messages/reactions/follows. Hosted audience and authentication unchanged.

## v5 saved-map collection, 2026-09-22

- Source read through the Google Drive connector with native tab enumeration. Only the map-management branch was imported. 75 map-code occurrences yield 72 unique records; all 72 are explicitly untested.
- Original image references were resolved from the associated document paragraphs. Five codes have no supplied preview. A conflicting duplicate for `map-0c5580a5` and the uncertain Westerplatte association are disclosed. No title, author, game version, test date or download is fabricated.
- 25 targeted local checks passed: unique codes, untested states, preview files, authenticated admin flag, anonymous write and cross-origin denial, unknown records, evidence-required test status, save/readback, immutable map identity, hidden-record access, stale revisions, restoration and five route renders.
- Browser verified English map-code search and successful copy feedback, original preview presentation, and the authenticated record editor. TypeScript passed. Game execution and actual production sign-in are not certified by these checks.
- Existing `featured_maps` storage is reused with revision-checked overrides; no migration or production data backfill. Google document and game files were not changed. Local test edits restored.

## v4 bilingual mod community, 2026-09-22

- New Mod API local tests: 105 assertions plus 4 local-origin guard checks passed. Includes seed count and redaction, anonymous writes, Origin/UUID/rights checks, URL/Mod-code/UTF-8 Lua/ZIP validation, idempotency, manual checklist, private pending files, approval, stale edits, re-review and withdrawal. Test content restored or withdrawn; no synthetic records enter deployment.
- Existing map workflow (29), map editor (22), and unit workbench (18) checks rerun and passed. TypeScript and production build passed.
- Authenticated role isolation: 78 assertions passed against the actual built Worker in direct local Miniflare, with separate owner A / owner B / administrator identities. Other-owner read/edit/withdraw/review attempts denied; personal admin lists exclude other authors' community drafts; explicit moderation scope includes them. Approved owner edits become private pending records again. This simulates trusted upstream identity, not real hosted sign-in.
- Diagnosed an early-rejected upload's unread body resetting local reused HTTP/1.1 connections (Wrangler presented this as a restart 503). Added bounded, allocation-free request-body draining on early return. The same complete role sequence then passed without retries. New scripts `preview-mod-roles.mjs` and `test-mod-roles.mjs` are loopback-only; all test fixtures are withdrawn.
- New Mod components / API targeted ESLint checks pass. Translation checks cover 15 dynamic/prototype cases; 1,122 dictionary entries include UI, reference labels and catalog names. Original Chinese history is explicitly marked rather than silently presented as translated.
- Browser inspected desktop 1440 and mobile 390 layouts; mobile document did not overflow. English Mod details, 3-code diplomacy bundle, successful copy UI, admin editor, language-preserved unsaved text, English unit names/fields, Lua preview after a health edit, and separate Maps / Mods creator tabs checked. New logo visually inspected at header size.
- Curated external metadata and source snapshots are distinct from manual in-game certification. GitHub modules were not executed or newly loaded into the user's game. Original game files unchanged.
- Real hosted OAuth, mainland reachability and real game compatibility are not certified by local tests. Existing Sites audience and login configuration are preserved.

## Earlier update — v3, 2026-09-22

- TypeScript check and production Vinext build passed. New schema-only migration creates `featured_maps`; no local records, credentials or test uploads enter the archive.
- Original 29 local workflow checks passed; 22 new editor assertions passed, including persistent featured edits, restoration, stale revisions, same-origin protection, re-review and private pending files.
- Workbench assertions passed: 453-unit catalog, changed-only Lua, strict JSON roundtrip, rejection of unknown fields/extra properties/stale hashes/duplicates, invalid precision and coordinated range constraints.
- Built Worker checks passed: non-admin featured editor 403, other-owner editor 404, public maps/library/workbench 200. The legacy role script references a historical local file and stalled on that stale fixture, so its old six-check result below is historical, not claimed as rerun success.
- Browser: desktop 1440 and mobile 390 layouts inspected; mobile document width did not exceed viewport. Parameter edit, code preview, empty-input export blocking, reset, JSON file chooser import, author shortcut and successful featured form save verified locally. Browser showed download initiation with no console errors, but its download-event monitor timed out; actual filesystem download completion was not established in the embedded browser.
- Real gameplay execution was not performed; generated Lua must be tested in a private game before public use. No game files or existing mods were modified.
- Mainland China reachability and independent login are not resolved. No alternate account, hosting purchase or migration was made; Sites trusted-header auth is retained.
- Bundled publishing helper disappeared from its installed location during work. Build used the unchanged project's Vinext command; source/packaging recovery is limited to the same opened repository and current public Site.

## Previous validation — 2026-09-09

- Production build: passed using the bundled Sites build helper. Default Worker export contains callable `fetch`; D1/R2 logical bindings and schema-only migration are included.
- TypeScript: `tsc --noEmit` passed.
- Local API workflow: 29 assertions passed, including anonymous reads, identity-header stripping, CSRF origin rejection, ZIP format rejection, pending isolation, idempotency, administrator checklist, publication, optimistic concurrency, takedown, withdrawal and four page renders.
- Local built Worker: 6 authenticated non-admin / cross-owner assertions passed (admin queue, review, withdrawal, file visibility, own records and role flags).
- All synthetic data remained in local D1/R2; the test record was withdrawn. It is not included in migrations or hosted content.
- Browser checks: homepage at 1440 px and map/form at 390 px inspected; map tabs and unit ID filter exercised. Long data tables intentionally scroll horizontally. Viewport override reset after checks.
- WebMCP: `read_stalingrad_configuration` registered with expected schema, returned correct paused Mods plus units 204/444, and rejected an invalid status. Read-only, no publication capabilities.
- Initial hosted verification found a Vinext client-side RSC prefetch/navigation error. All application links now use native anchors via `components/site-link.tsx`, preserving ordinary browser navigation without the incompatible prefetch bridge. No dependency versions were changed.
- Hosted administrator email configured as a secret environment variable; no actual email or credentials are committed in application source. Hosted interactive sign-in with the owner's actual account still requires the owner to use the published page.
- No automated antivirus service is installed: ZIP/image signatures, size limits, private storage and manual administrator checks are explicit on site. ZIP contents are never executed or extracted by the application.
- Real game validation is not part of this website task. Stalingrad map code/release ZIP was not supplied; no fabricated download is shown. Mod statuses remain code-backed editorial statuses, not assertions that the live map has loaded every script.

Source evidence: map author's current local Mod inventory dated 2026-09-09. No game scripts were edited for this website.
