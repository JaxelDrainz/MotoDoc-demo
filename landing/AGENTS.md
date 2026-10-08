# Prototype Instructions

## MotoDoc design decisions

- Selected reference: user attachment `Generated Image September 30, 2026 - 3_57PM.jpg`. Preserve minimal green mechanic sketch, two-column hero, navy headline, smaller green subheading, compact service card, flat navigation, and restrained benefits row.
- The landing and authentication design milestones are complete. The user now authorises a local backend with persistent accounts and app data. Connect driver/garage authentication and core car-care workflows. Preserve the UI. External email, payments, and public deployment require configured services and must not be simulated as completed.
- Remove quotation marks from the headline, retain MotoDoc wordmark identity, and use readable secondary text. Follow selected composition.
- October 7, 2026: the user supplied the official logo (green MD mark with wrench and cross cutouts, `public/assets/motodoc-logo.png`, resized from the original in `../dashboard-next/public/images`) and asked for it and the driver dashboard's design style across the whole app. This supersedes the earlier text-only wordmark rule. The brand is the logo plus the MotoDoc wordmark (`src/Brand.jsx`).
- Shared design system, defined by `../dashboard-next` and mirrored in the block at the end of each stylesheet: page `#f4f8fa`, white cards with `#d7dce0` borders and 12px radius, 24px-radius hero cards with the stepped pixel corner, emerald `#087658`, ink `#111827`, muted `#626a72`, pill buttons (outline in the account area), sticky white top bar. The account area (`/app`) uses a top bar with text tabs, not a sidebar.
- Use local Inter font and Phosphor regular icons. Hero asset: public/assets/mechanic-hero.png. Never replace with code-drawn art.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
