# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run via Shopify CLI (runs `prisma migrate deploy` + Remix dev)
npm run build        # Build Remix app (vite:build)
npm run start        # Serve built app (production)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run setup        # prisma generate && prisma migrate deploy
npm run deploy       # shopify app deploy (push extensions + config)
npm run config:link  # Link to a Shopify app from shopify.app.toml
```

There is no test runner configured — CI (`.github/workflows/test.yml`) only runs typecheck, lint, build, and a Docker build smoke check.

Database/Prisma:
```bash
npx prisma migrate dev --name <slug>   # Create + apply migration in dev
npx prisma migrate deploy              # Apply pending migrations (used at boot / in Docker)
npx prisma generate                    # Regenerate Prisma client after schema.prisma changes
npx prisma studio                      # Browse DB locally
```

Required env vars: see [.env.example](.env.example). Postgres + Redis are required for full functionality. `SHOPIFY_WEBHOOK_SIGNING_SECRET` is checked first for HMAC verification, falling back to `SHOPIFY_API_SECRET`.

## Architecture

Shopify embedded app on **Remix + Vite + Polaris + App Bridge**, with **Prisma/PostgreSQL** for state and **Redis** for rate-limit counters. Multi-tenant by `shopId`. Distributed as a Docker image published to GHCR by GitHub Actions and deployed via SSH to a VPS running docker-compose.

### Three runtime surfaces

1. **Embedded admin (`app/routes/app.*`)** — Polaris UI inside Shopify admin. Routes are gated by `authenticate.admin(request)` from `app/shopify.server.ts`. Nav menu defined in [app/routes/app.tsx](app/routes/app.tsx).
2. **Public APIs (`app/routes/api.*`, `app/routes/webhooks.*`)** — webhooks (HMAC-verified), QR/pairing/status endpoints, status-update link handler, dynamic widget script.
3. **Storefront widget** — two delivery paths to the same widget:
   - Theme App Extension at [extensions/whatsapp-widget/blocks/widget.liquid](extensions/whatsapp-widget/blocks/widget.liquid) (merchant enables in theme editor).
   - Dynamic script at [app/routes/api.widget-script.ts](app/routes/api.widget-script.ts) served as `application/javascript` cross-origin. **Both must stay XSS-safe**: never use `innerHTML`, embed JSON via the `safeJsonForScript` helper, and keep `rel="noopener noreferrer"` on outbound WhatsApp links.

Routes use Remix file-based routing via `@remix-run/fs-routes` ([app/routes.ts](app/routes.ts)).

### Shopify integration

[app/shopify.server.ts](app/shopify.server.ts) configures `shopifyApp` with:
- `PrismaSessionStorage` → sessions live in the `Session` table (managed by Shopify; do not modify the model in [prisma/schema.prisma](prisma/schema.prisma)).
- `AppDistribution.AppStore` + three managed billing plans (`Basique` $4.99, `Gold` $9.99, `Pro` $19.99), defined in [app/billing-plans.ts](app/billing-plans.ts) with per-plan agent limits.
- `unstable_newEmbeddedAuthStrategy: true` and `expiringOfflineAccessTokens: true`.

Scopes live in [shopify.app.toml](shopify.app.toml) under `[access_scopes]` (currently a broad set including orders, fulfillments, products, customers, locations, shipping, script_tags, themes). Webhooks API version is `2026-01`.

### Order → notification flow

[app/routes/webhooks.orders-create.ts](app/routes/webhooks.orders-create.ts) is the core business pipeline. Note that this is a **manual webhook handler** (HMAC verified inline against `SHOPIFY_WEBHOOK_SIGNING_SECRET`) — not declared in `shopify.app.toml`, so it must be registered separately on the Shopify side or behind the configured `direct_webhook_path = "/webhooks"`.

Flow:
1. Verify HMAC (constant-time-ish via base64 compare).
2. Look up `Shop` by domain (must exist — no auto-create here).
3. Idempotency: bail if `DeliveryBill.orderId` already exists.
4. Create `DeliveryBill` with status `PENDING`.
5. `assignBestAgent(...)` — two-tier attribution:
   - Tier 1: agents who have the Shopify product ID in their `AgentProduct` join table.
   - Tier 2 (fallback): agents matching the customer's country, then narrowed to city if any match.
   - Within each tier, pick the agent with the **fewest active bills** (`PENDING | ASSIGNED | IN_PROGRESS`).
6. Notify via WhatsApp (`notifyAgentViaWhatsApp` in [app/whatsapp.server.ts](app/whatsapp.server.ts)).

Always return 200 even on processing errors after HMAC validates — Shopify retries on non-2xx and we'd rather log + investigate than thrash.

### WhatsApp service ([app/whatsapp.server.ts](app/whatsapp.server.ts))

Built on **Baileys** (`@whiskeysockets/baileys`). Critical patterns to preserve:

- **Session persistence in Postgres** via the `WhatsAppSession` model. Baileys credentials contain `Buffer`s; `serializeForDB` / `deserializeFromDB` round-trip them as `{type:'Buffer', data:[numbers]}` and also accept the legacy base64 form. Don't replace with plain `JSON.stringify` — it will corrupt the noise/signal keys.
- **One socket per shop** held in an in-memory `Map` (`activeSockets`). Module-load side effect calls `autoReconnectAllShops()` after 3s to restore all `connected: true` sessions on boot.
- **`creds.update` must MERGE**, not replace — Baileys emits partial updates. See the `socket.ev.on("creds.update", ...)` handler.
- **Disconnect codes 401 and 405 clear credentials** (set `creds: {}`, `keys: {}`) so the next connect generates a fresh QR. Other disconnects schedule a 5s reconnect; `loggedOut` stops the loop.
- `disconnect()` also wipes credentials on purpose — otherwise the next connect silently re-uses the old session instead of showing a QR.
- **Rate limit**: 250 sends/day per shop (WhatsApp unverified-account ceiling), tracked in Redis under `whatsapp:rate:{shopId}:{YYYY-MM-DD}` with a 24h expiry, mirrored to `Shop.whatsappDailyCount`.
- **Human-like jitter**: every delivery notification sleeps 2–5s before sending.
- **Status callback links**: outgoing messages embed three HMAC-signed URLs (`/api/bill-status?id=...&s=...&t=...`) built by `generateStatusToken`. The token is `HMAC-SHA256(billId:status, secret).slice(0,16)`. Don't change the slice length or status casing without updating both the message formatter and [api.bill-status.tsx](app/routes/api.bill-status.tsx) verifier.
- WhatsApp button replies (`messages.upsert` → `buttonsResponseMessage`) are also wired but the primary UX is link-based.

### Data model ([prisma/schema.prisma](prisma/schema.prisma))

- `Shop` — one row per installed shop; holds Telegram + WhatsApp + widget config and the daily WhatsApp counter.
- `DeliveryAgent` — couriers / support reps. `role` (`COURIER` | `SUPPORT` | `BOTH`) controls whether they receive order notifications vs appear in the widget. `showInWidget` is the widget-visibility flag.
- `AgentProduct` — many-to-many between agents and Shopify product IDs; drives Tier-1 attribution.
- `WhatsAppSession` — Baileys creds/keys/QR per shop (1:1 with `Shop`).
- `DeliveryBill` — one per Shopify order (`orderId` is unique → idempotency key). `statusHistory` is an append-only JSON log; every status change should push an entry with `{status, timestamp, source, ...}`.

All app models cascade-delete on `Shop.id`.

### Multi-tenancy invariant

Every query that touches app data MUST filter by `shopId` (or by `shop.domain` for webhook entry points). Indexes are designed around `shopId` composites — keep them in sync if you add filters. Authenticated routes get the shop from `authenticate.admin(request)`; webhook routes get it from `X-Shopify-Shop-Domain` → DB lookup.

### Deploy

`.github/workflows/deploy.yml`: push to `main` builds `:latest` and deploys service `shopify-app` (container `shopify_app_prod`); push to `dev` builds `:dev` and deploys `shopify-app-staging`. The deploy job SSHs to the VPS, `docker compose pull && up -d`, then runs `prisma migrate deploy` inside the container. Migrations must be safe to apply with traffic running.

## Sub-agents

7 sub-agents Claude Code spécialisés sont définis dans [.claude/agents/](.claude/agents/) — voir le [README](.claude/agents/README.md) pour le format de retour JSON standardisé et le format de prompt à 5 blocs.

| Agent | Modèle | Quand l'invoquer |
|---|---|---|
| `researcher` | haiku | "où est X", lookup read-only large |
| `shopify-remix-dev` | sonnet | route/loader/action, auth, billing, webhook, Polaris, édit simple |
| `prisma-db` | sonnet | schéma, migration, index, data model |
| `whatsapp-baileys-debugger` | opus | connexion WhatsApp, QR, session, reconnect, rate limit, message |
| `browser-automator` | sonnet | test E2E, vérif notif WhatsApp Web, QA navigateur |
| `visual-judge` | opus | analyse screenshot, comparaison before/after, OCR |
| `deploy-ops` | sonnet | logs/restart/migrate prod Contabo, échec déploiement |

Dispatcher via le tool `Agent` (`subagent_type` = nom de l'agent), avec un prompt au format 5 blocs (`# CONTEXTE`, `# TÂCHE`, `# CONTRAINTES`, `# RESSOURCES`, `# FORMAT DE RETOUR ATTENDU`). Un sub-agent ne peut pas en dispatcher un autre — la session principale ré-orchestre via le `nextStep` retourné.

## Skill routing

- **Tests** : `/test-order-e2e` (E2E commande → WhatsApp Web → statut). Le profil Playwright/WhatsApp est géré par le skill `playwright-whatsapp-profile` ([.claude/skills/](.claude/skills/)).
- **Activer** : `/health` (CI typecheck/lint/build existe), `/qa`, `/investigate`, `/cso`, `/codex`, `context-save` / `context-restore`.
- **NE PAS invoquer** (workflow commit-direct sur `main`/`dev`, déploiement auto sur push, pas de PR) : `/ship`, `/land-and-deploy`, `/landing-report`, `/review` (PR-based), `finishing-a-development-branch`, `using-git-worktrees`, `requesting-code-review`, `receiving-code-review`.
