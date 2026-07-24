# Vendored processor logic

`reader.ts`, `normalize.ts`, `models.ts`, `history.ts` are vendored verbatim
from `resideo-nextgen-dashboard/processor/src` (the shipped static
dashboard's build-time Allure processor). `dashboard-data.ts` is the
`DashboardData` interface from that repo's `writer.ts` (lines 14-23), pulled
into its own file since `writer.ts`'s two functions are the file-I/O boundary
this SaaS ingestion path replaces with Postgres (see `api/_lib/history-db.ts`).

**Intentional edit**: relative import specifiers had their `.js` suffixes
stripped (`./models.js` → `./models`, `./reader.js` → `./reader`). The source
repo uses TypeScript's NodeNext module resolution, where `.js`-suffixed
specifiers in `.ts` source are required and resolve to the eventual compiled
output. This repo uses `bundler` moduleResolution (Vite on the frontend,
`@vercel/node`'s esbuild-based bundler for `/api`), where extension-less
specifiers are the correct convention instead. No other line was touched.

This is intentional short-term duplication, not an architecture pattern to
replicate: these files have zero npm dependencies (pure `node:fs`/`node:path`),
so a copy carries no supply-chain cost, but it does mean bug fixes must be
ported back to `resideo-nextgen-dashboard/processor/src` by hand and re-copied
here. A `file:../resideo-nextgen-dashboard/processor` dependency was
considered and rejected — it works locally but breaks on Vercel, which only
clones this repo, not its sibling. Revisit via a published shared package or
git submodule once this product stabilizes.
