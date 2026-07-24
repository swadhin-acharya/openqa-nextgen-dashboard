# Vendored processor logic

`reader.ts`, `normalize.ts`, `models.ts`, `history.ts` are vendored verbatim
from `resideo-nextgen-dashboard/processor/src` (the shipped static
dashboard's build-time Allure processor). `dashboard-data.ts` is the
`DashboardData` interface from that repo's `writer.ts` (lines 14-23), pulled
into its own file since `writer.ts`'s two functions are the file-I/O boundary
this SaaS ingestion path replaces with Postgres (see `api/_lib/history-db.ts`).

**No edits**: these 4 files are byte-identical to
`resideo-nextgen-dashboard/processor/src`, including their `.js`-suffixed
relative imports (`./models.js`, `./reader.js`). An earlier version of this
vendoring stripped those suffixes on the (wrong) assumption that Vercel's
`/api` build bundles imports the way Vite does. It doesn't: Vercel's Node
runtime transpiles each `.ts` file individually and runs the result with
plain Node ESM, which requires the exact `.js`-suffixed specifier to resolve
- extension-less imports fail at runtime with `ERR_MODULE_NOT_FOUND` (caught
by actually deploying and hitting `/api/ingest`, not by local type-checking,
since `moduleResolution: bundler` happily accepts either form). So `.js`
suffixes are correct and required here, same as the source repo, and every
`api/*.ts`/`api/_lib/*.ts` file's own relative imports use them too.

This is intentional short-term duplication, not an architecture pattern to
replicate: these files have zero npm dependencies (pure `node:fs`/`node:path`),
so a copy carries no supply-chain cost, but it does mean bug fixes must be
ported back to `resideo-nextgen-dashboard/processor/src` by hand and re-copied
here. A `file:../resideo-nextgen-dashboard/processor` dependency was
considered and rejected — it works locally but breaks on Vercel, which only
clones this repo, not its sibling. Revisit via a published shared package or
git submodule once this product stabilizes.
