# Third-party content and licensing

This repository does **not** apply a new blanket open-source license to the website, game data, maps, images or third-party code. Keeping a repository private does not transfer ownership of third-party content.

- War Selection names, game reference data and game imagery belong to their respective rights holders. This is an unofficial community project.
- Map images and descriptions were collected from the curator's supplied records and community source posts. They remain attributed through `lib/collection-seeds.json`, `lib/discord-map-seeds.json`, `lib/collection-image-seeds.json` and associated notes. A linked public post is not, by itself, an unrestricted redistribution license.
- Before making the repository public or republishing its assets, review permissions for community screenshots, game-derived data and contributed content. Some entries may require author permission or replacement with source links.
- The Mod library references external GitHub projects. Their licenses apply to their own code and assets; listing a project here does not relicense it.
- The replay analyzer (`lib/replay/`, `public/legacy-ids.json`) is a TypeScript port of the parser from **IbubussI / wsunitstats-static** (https://github.com/IbubussI/wsunitstats-static, last synced 2026-10-28). No LICENSE file was present in that repository at port time; all rights remain with its author. The replay page UX also takes inspiration from **malticNL / WS Replay Stats** (https://warselection.vercel.app). Replay data is fetched client-side from the official game API (games-api.warselect.io) only.
- Retain `vendor/shadcn-tailwind-4.13.0.LICENSE.md`, `build/sites-vite-plugin.LICENSE`, and notices embedded in vendored files. Dependency packages retain their respective licenses.
- AI artwork provenance is documented in `public/artwork-notes.md` and `LOGO-NOTES.md`; it is not a screenshot or proof of actual gameplay.

No license choice has been made on behalf of the owner. Discuss a source-code license separately from licenses for third-party assets before public release.
