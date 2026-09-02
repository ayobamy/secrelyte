# Graph Report - secrelyte  (2026-09-02)

## Corpus Check
- 94 files · ~17,061 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 311 nodes · 338 edges · 64 communities (29 shown, 35 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_CLAUDE.md(httpCLAUDE.md)|[CLAUDE.md](http://CLAUDE.md)]]
- [[_COMMUNITY_env.ts|env.ts]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_site-header.tsx|site-header.tsx]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_product-preview.tsx|product-preview.tsx]]
- [[_COMMUNITY_check-env-format.mjs|check-env-format.mjs]]
- [[_COMMUNITY_check-next-version.mjs|check-next-version.mjs]]
- [[_COMMUNITY_grade-headers.sh|grade-headers.sh]]
- [[_COMMUNITY_contrast.ts|contrast.ts]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_h|h]]
- [[_COMMUNITY_Secrelyte|Secrelyte]]
- [[_COMMUNITY_check-crypto-boundary.sh|check-crypto-boundary.sh]]
- [[_COMMUNITY_check-eslint-boundaries.sh|check-eslint-boundaries.sh]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_eslint.config.mjs|eslint.config.mjs]]
- [[_COMMUNITY_applypatch-msg|applypatch-msg]]
- [[_COMMUNITY_commit-msg|commit-msg]]
- [[_COMMUNITY_post-applypatch|post-applypatch]]
- [[_COMMUNITY_post-checkout|post-checkout]]
- [[_COMMUNITY_post-commit|post-commit]]
- [[_COMMUNITY_post-merge|post-merge]]
- [[_COMMUNITY_post-rewrite|post-rewrite]]
- [[_COMMUNITY_pre-applypatch|pre-applypatch]]
- [[_COMMUNITY_pre-auto-gc|pre-auto-gc]]
- [[_COMMUNITY_pre-commit|pre-commit]]
- [[_COMMUNITY_pre-commit|pre-commit]]
- [[_COMMUNITY_pre-merge-commit|pre-merge-commit]]
- [[_COMMUNITY_pre-push|pre-push]]
- [[_COMMUNITY_pre-rebase|pre-rebase]]
- [[_COMMUNITY_prepare-commit-msg|prepare-commit-msg]]
- [[_COMMUNITY_next.config.ts|next.config.ts]]
- [[_COMMUNITY_playwright.config.ts|playwright.config.ts]]
- [[_COMMUNITY_postcss.config.mjs|postcss.config.mjs]]
- [[_COMMUNITY_check-bundle-secrets.sh|check-bundle-secrets.sh]]
- [[_COMMUNITY_check-gitleaks.sh|check-gitleaks.sh]]
- [[_COMMUNITY_check-next-version.sh script|check-next-version.sh script]]
- [[_COMMUNITY_print-auth-settings.sh|print-auth-settings.sh]]
- [[_COMMUNITY_verify-phase0.sh|verify-phase0.sh]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_README|README.md]]

## God Nodes (most connected - your core abstractions)
1. `scripts` - 22 edges
2. `compilerOptions` - 17 edges
3. `[CLAUDE.md](http://CLAUDE.md)` - 15 edges
4. `Non-negotiable rules` - 10 edges
5. `SiteHeader()` - 6 edges
6. `securityHeaders()` - 6 edges
7. `ProductPreview()` - 5 edges
8. `Uuid` - 5 edges
9. `Envelope` - 5 edges
10. `B64Url` - 4 edges

## Surprising Connections (you probably didn't know these)
- `ShareViewPage()` --calls--> `shareLinkLabel()`  [EXTRACTED]
  app/s/[token]/page.tsx → lib/share-label.ts
- `ProductPreview()` --calls--> `formatRevealSeconds()`  [EXTRACTED]
  components/product-preview.tsx → lib/reveal-timer.ts
- `ProductPreview()` --calls--> `revealRatio()`  [EXTRACTED]
  components/product-preview.tsx → lib/reveal-timer.ts
- `ProductPreview()` --calls--> `revealRemaining()`  [EXTRACTED]
  components/product-preview.tsx → lib/reveal-timer.ts
- `supabaseOrigin()` --calls--> `supabaseOriginFromUrl()`  [EXTRACTED]
  proxy.ts → lib/env.ts

## Import Cycles
- None detected.

## Communities (64 total, 35 thin omitted)

### Community 0 - "[CLAUDE.md](http://CLAUDE.md)"
Cohesion: 0.08
Nodes (24): After every task — commit, push, restart, Architecture — services-first, parallel-friendly, Background jobs and backfills, Check for skills, [CLAUDE.md](http://CLAUDE.md), Completion status protocol, Confusion protocol, Fan-out + harsh critic — for large work (+16 more)

### Community 2 - "env.ts"
Cohesion: 0.14
Nodes (19): ClientEnv, clientEnvSchema, getClientEnv(), getServerEnv(), readClientRaw(), ServerEnv, serverEnvSchema, supabaseOriginFromUrl() (+11 more)

### Community 3 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, audit, build, check:bundle, check:crypto, check:eslint-boundary, check:gitleaks, check:headers (+14 more)

### Community 4 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 5 - "page.tsx"
Cohesion: 0.14
Nodes (9): limits, steps, HeroStage(), LightField(), SiteFooter(), surfaces, HERO_HEADLINE, BANNED_VOICE (+1 more)

### Community 6 - "index.ts"
Cohesion: 0.29
Nodes (13): ProposeShareArgs, ToolProposal, envelope, ErrorCode, ErrorHttpStatus, B64Url, Envelope, Uuid (+5 more)

### Community 7 - "site-header.tsx"
Cohesion: 0.17
Nodes (8): ShareViewPage(), Mark(), MarkProps, navClass(), SiteHeader(), SiteHeaderProps, VaultComposer(), shareLinkLabel()

### Community 8 - "devDependencies"
Cohesion: 0.13
Nodes (14): husky.sh script, devDependencies, eslint, eslint-config-next, husky, @playwright/test, prettier, tailwindcss (+6 more)

### Community 9 - "package.json"
Cohesion: 0.14
Nodes (13): dependencies, next, react, react-dom, server-only, zod, engines, node (+5 more)

### Community 10 - "product-preview.tsx"
Cohesion: 0.42
Nodes (6): CountdownRing(), CountdownRingProps, ProductPreview(), formatRevealSeconds(), revealRatio(), revealRemaining()

### Community 11 - "check-env-format.mjs"
Cohesion: 0.25
Nodes (5): env, envPath, failures, hasSecret, root

### Community 12 - "check-next-version.mjs"
Cohesion: 0.25
Nodes (5): floor, installed, nextPkg, require, root

### Community 13 - "grade-headers.sh"
Cohesion: 0.33
Nodes (5): grade_path(), NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, grade-headers.sh script

### Community 14 - "contrast.ts"
Cohesion: 0.60
Nodes (4): BRAND_SWATCHES, channel(), contrastRatio(), relativeLuminance()

### Community 15 - "layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

## Knowledge Gaps
- **133 isolated node(s):** `husky.sh script`, `geistSans`, `geistMono`, `metadata`, `steps` (+128 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `husky.sh script`, `geistSans`, `geistMono` to the rest of the system?**
  _133 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `[CLAUDE.md](http://CLAUDE.md)` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `env.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14130434782608695 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._