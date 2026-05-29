# Agent Workflow Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code agent/dev workflow layer to shopify-logistics-app — 7 domain sub-agents, 2 test skills, MCP wiring, and CLAUDE.md routing — adapted to this project's commit-direct + Docker auto-deploy workflow.

**Architecture:** Mirror the aipitch-v2 convention: `.claude/agents/*.md` (frontmatter `name`/`description`/`tools`/`model` + body), `.claude/skills/*.md` (frontmatter + body), `.claude/settings.local.json` enabling the 3 project MCPs, and new routing sections appended to `CLAUDE.md`. No code changes to the app itself.

**Tech Stack:** Markdown agent/skill definitions, Claude Code `Agent` tool, MCP servers (`playwright`, `ssh-mcp-contabo-cyrus`, `context7`).

**Reference spec:** `docs/superpowers/specs/2026-05-29-agent-workflow-structure-design.md`

**Note on verification:** These are config/markdown files, not code. "Verification" = frontmatter parses, referenced paths exist, MCP names match `.mcp.json`, and (final task) agents are listed/invocable. There is no unit-test runner involved.

---

## File Structure

| File | Responsibility |
|---|---|
| `.claude/settings.local.json` | Enable the 3 project MCP servers |
| `.claude/agents/README.md` | Agent list, JSON return format, 5-block prompt format, dispatch limitation note |
| `.claude/agents/researcher.md` | haiku, read-only lookup |
| `.claude/agents/shopify-remix-dev.md` | sonnet, Remix/Shopify/Polaris edits |
| `.claude/agents/prisma-db.md` | sonnet, schema/migrations/multi-tenant |
| `.claude/agents/whatsapp-baileys-debugger.md` | opus, Baileys session/socket logic |
| `.claude/agents/browser-automator.md` | sonnet, Playwright E2E |
| `.claude/agents/visual-judge.md` | opus, screenshot analysis |
| `.claude/agents/deploy-ops.md` | sonnet, SSH Contabo / Docker (full auto) |
| `.claude/skills/test-order-e2e.md` | user_invocable, order → WhatsApp → status E2E |
| `.claude/skills/playwright-whatsapp-profile.md` | persistent profile guide |
| `CLAUDE.md` | append agent routing + skill routing sections |

Shared conventions used by every agent file:
- **Frontmatter:** `name`, `description`, `tools`, `model`.
- **`tools` values:** standard Claude Code tools by name (`Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`) plus MCP tools by their full name (e.g. `mcp__playwright__browser_navigate`). For agents with no MCP, omit MCP entries.
- **Body sections (in order):** `## Rôle`, `## Quand m'invoquer`, `## Format d'entrée` (5 blocs), `## Format de sortie` (JSON), `## Règles opérationnelles`, `## Limites connues`.

---

## Task 1: MCP wiring via settings.local.json

**Files:**
- Create: `.claude/settings.local.json`

- [ ] **Step 1: Create the settings file enabling the 3 project MCPs**

```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "playwright",
    "ssh-mcp-contabo-cyrus",
    "context7"
  ],
  "disabledMcpjsonServers": []
}
```

- [ ] **Step 2: Verify the MCP names match `.mcp.json`**

Run: `node -e "const a=require('./.mcp.json').mcpServers, b=require('./.claude/settings.local.json').enabledMcpjsonServers; console.log(b.every(x=>x in a)?'MATCH':'MISMATCH', Object.keys(a))"`
Expected: `MATCH [ 'playwright', 'ssh-mcp-contabo-cyrus', 'context7' ]`

- [ ] **Step 3: Confirm settings.local.json is gitignored**

Run: `git check-ignore .claude/settings.local.json`
Expected: `.claude/settings.local.json`

- [ ] **Step 4: Commit (no push)**

```bash
git add .claude/settings.local.json 2>/dev/null; git status --short
```
Note: file is gitignored, so this is a no-op commit-wise. Skip the commit; the file exists locally. Proceed.

---

## Task 2: agents/README.md (conventions)

**Files:**
- Create: `.claude/agents/README.md`

- [ ] **Step 1: Write the README with the full agent table and return format**

Content must include, verbatim:

The agent roster table:

| Agent | Modèle | MCP | Rôle court |
|---|---|---|---|
| `researcher` | haiku | — | Lookup read-only |
| `shopify-remix-dev` | sonnet | context7 | Routes/loaders/actions, auth, billing, Polaris |
| `prisma-db` | sonnet | context7 | Schéma, migrations, multi-tenant |
| `whatsapp-baileys-debugger` | opus | — | Sessions Baileys, sockets, reconnect |
| `browser-automator` | sonnet | playwright | E2E admin Shopify + WhatsApp Web |
| `visual-judge` | opus | — | Analyse screenshots |
| `deploy-ops` | sonnet | ssh-mcp-contabo-cyrus | SSH Contabo, Docker (full auto) |

The standardized JSON return format:

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | API_LIMIT | BLOCKED | NEEDS_CONTEXT",
  "summary": "1-3 lignes",
  "details": { "filesChanged": [], "actionsPerformed": [], "verificationsPassed": [] },
  "nextStep": null,
  "concerns": []
}
```

The 5-block prompt format: `# CONTEXTE`, `# TÂCHE`, `# CONTRAINTES`, `# RESSOURCES`, `# FORMAT DE RETOUR ATTENDU`.

The dispatch limitation note: "Un sub-agent ne peut pas en dispatcher un autre — l'outil `Agent` est retiré des sous-contextes. Seule la session principale orchestre ; une chaîne A → B se fait via le `nextStep` retourné, ré-orchestré par la session principale."

- [ ] **Step 2: Verify the file renders the table (no broken markdown)**

Run: `grep -c '^|' .claude/agents/README.md`
Expected: a number ≥ 9 (table header + separator + 7 rows).

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/README.md
git commit -m "docs: agent roster README + return/prompt conventions"
```

---

## Task 3: researcher agent

**Files:**
- Create: `.claude/agents/researcher.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: researcher
description: Lookup read-only ultra-rapide — "où est X", grep/glob, lister les fichiers correspondant à un motif. Aucune écriture.
tools: Read, Grep, Glob, Bash
model: haiku
---
```

Body must specify:
- **Rôle:** localiser du code/des fichiers, répondre "où est défini X", "quels fichiers référencent Y". Lecture seule, jamais d'édition.
- **Quand m'invoquer:** recherche large multi-fichiers, inventaire, avant qu'un autre agent édite.
- **Format d'entrée:** 5 blocs.
- **Format de sortie:** JSON standardisé ; `details.actionsPerformed` liste les recherches faites, `summary` donne les chemins+lignes trouvés.
- **Règles:** ne jamais utiliser Edit/Write ; préférer `rg`/Grep ; renvoyer `file_path:line` exploitables.
- **Limites connues:** ne lit que des extraits, peut manquer du contenu hors fenêtre ; pour une analyse complète d'un fichier, le signaler en `concerns`.

- [ ] **Step 2: Verify frontmatter parses and model is haiku**

Run: `awk '/^---$/{c++;next} c==1' .claude/agents/researcher.md | grep -E '^(name|model|tools):'`
Expected: shows `name: researcher`, `tools: ...`, `model: haiku`.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/researcher.md
git commit -m "feat: add researcher sub-agent (haiku, read-only lookup)"
```

---

## Task 4: shopify-remix-dev agent

**Files:**
- Create: `.claude/agents/shopify-remix-dev.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: shopify-remix-dev
description: Développement Remix + Shopify pour ce projet — routes/loaders/actions, authenticate.admin, billing managé, webhooks, UI Polaris/App Bridge. Édite app/routes et app/*.server.ts.
tools: Read, Edit, Write, Grep, Glob, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
model: sonnet
---
```

Body must specify:
- **Rôle:** implémenter/modifier les routes Remix (`app/routes/`), les helpers serveur (`app/*.server.ts`), la config Shopify (auth, billing, scopes), l'UI Polaris. Absorbe le rôle "code-writer" (édits simples dictés).
- **Quand m'invoquer:** "ajoute une route", "modifie le loader/action", "change le billing", "ajuste l'UI admin", édit dicté simple.
- **Format d'entrée / sortie:** 5 blocs / JSON.
- **Règles opérationnelles (critiques, tirées de CLAUDE.md):**
  - Toute requête data DOIT filtrer par `shopId` (ou `shop.domain` pour les webhooks).
  - Routes admin gated par `authenticate.admin(request)`.
  - Widget/scripts cross-origin : jamais d'`innerHTML`, utiliser `safeJsonForScript`, garder `rel="noopener noreferrer"`.
  - Webhooks : valider HMAC, retourner 200 même en cas d'erreur de traitement après HMAC.
  - Utiliser context7 pour la doc à jour de `@shopify/shopify-app-remix`, Remix, Polaris.
- **Limites connues:** ne touche pas `prisma/schema.prisma` (→ `prisma-db`) ni `app/whatsapp.server.ts` (→ `whatsapp-baileys-debugger`).

- [ ] **Step 2: Verify frontmatter and context7 tools present**

Run: `grep -E 'model: sonnet|mcp__context7' .claude/agents/shopify-remix-dev.md`
Expected: shows `model: sonnet` and at least one `mcp__context7__` tool.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/shopify-remix-dev.md
git commit -m "feat: add shopify-remix-dev sub-agent"
```

---

## Task 5: prisma-db agent

**Files:**
- Create: `.claude/agents/prisma-db.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: prisma-db
description: Schéma Prisma, migrations PostgreSQL, invariant multi-tenant (filtrage shopId), indexes. Migrations sûres sous trafic. Édite prisma/.
tools: Read, Edit, Write, Grep, Glob, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
model: sonnet
---
```

Body must specify:
- **Rôle:** modifier `prisma/schema.prisma`, créer/appliquer des migrations, maintenir les indexes `shopId`-composites.
- **Quand m'invoquer:** "ajoute un champ/modèle", "crée une migration", "ajoute un index", question sur le data model.
- **Format d'entrée / sortie:** 5 blocs / JSON.
- **Règles opérationnelles (critiques):**
  - Ne JAMAIS modifier le modèle `Session` (géré par Shopify).
  - Tout modèle applicatif cascade-delete sur `Shop.id`.
  - Migrations doivent être **safe-with-traffic** (appliquées sur prod en cours d'exécution via `prisma migrate deploy`).
  - Commandes : `npx prisma migrate dev --name <slug>` en dev, `npx prisma generate` après changement de schéma.
  - `statusHistory` de `DeliveryBill` est un log JSON append-only.
  - Utiliser context7 pour la doc Prisma.
- **Limites connues:** n'exécute pas de migration sur la prod Contabo (→ `deploy-ops`).

- [ ] **Step 2: Verify frontmatter**

Run: `grep -E '^name: prisma-db|^model: sonnet' .claude/agents/prisma-db.md`
Expected: both lines present.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/prisma-db.md
git commit -m "feat: add prisma-db sub-agent"
```

---

## Task 6: whatsapp-baileys-debugger agent

**Files:**
- Create: `.claude/agents/whatsapp-baileys-debugger.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: whatsapp-baileys-debugger
description: Service WhatsApp Baileys — sérialisation creds/keys (Buffer), lifecycle socket, reconnect, codes 401/405, rate limit Redis, liens de statut HMAC. Édite app/whatsapp.server.ts.
tools: Read, Edit, Write, Grep, Glob, Bash
model: opus
---
```

Body must specify:
- **Rôle:** déboguer/modifier `app/whatsapp.server.ts` (Baileys).
- **Quand m'invoquer:** problème de connexion WhatsApp, QR, session perdue, reconnect, rate limit, format du message de notification.
- **Format d'entrée / sortie:** 5 blocs / JSON.
- **Règles opérationnelles (critiques, tirées de CLAUDE.md):**
  - `serializeForDB`/`deserializeFromDB` : ne jamais remplacer par `JSON.stringify` brut (corrompt les clés noise/signal).
  - `creds.update` doit MERGER, pas remplacer.
  - Codes 401 et 405 → effacer creds/keys pour forcer un nouveau QR ; `loggedOut` stoppe la boucle ; autres → reconnect 5s.
  - Un socket par shop dans `activeSockets` ; `autoReconnectAllShops()` au boot.
  - Rate limit : 250/jour/shop, Redis `whatsapp:rate:{shopId}:{YYYY-MM-DD}` exp 24h.
  - Token statut : `HMAC-SHA256(billId:status, secret).slice(0,16)` — ne pas changer la longueur du slice ni la casse sans mettre à jour `api.bill-status.tsx`.
- **Limites connues:** modèle opus pour la logique signal-key subtile ; ne touche pas le schéma DB (→ `prisma-db`).

- [ ] **Step 2: Verify frontmatter is opus**

Run: `grep -E '^name: whatsapp-baileys-debugger|^model: opus' .claude/agents/whatsapp-baileys-debugger.md`
Expected: both lines present.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/whatsapp-baileys-debugger.md
git commit -m "feat: add whatsapp-baileys-debugger sub-agent (opus)"
```

---

## Task 7: browser-automator agent

**Files:**
- Create: `.claude/agents/browser-automator.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: browser-automator
description: Tests E2E via Playwright MCP — crée une commande dans l'admin Shopify, vérifie la notification sur WhatsApp Web (profil persistant), clique les liens de statut. QA navigateur.
tools: Read, Grep, Glob, Bash, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_wait_for, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages, mcp__playwright__browser_tabs
model: sonnet
---
```

Body must specify:
- **Rôle:** piloter le navigateur pour les parcours E2E et la QA.
- **Quand m'invoquer:** "teste la commande de bout en bout", vérifier une notif WhatsApp Web, QA d'une page admin/widget.
- **Format d'entrée / sortie:** 5 blocs / JSON ; joindre les screenshots clés dans `details`.
- **Règles opérationnelles:**
  - Profil persistant `/home/angel/playwright-profile-shopify-logistics` — voir skill `playwright-whatsapp-profile`. Single-instance.
  - Admin Shopify : `https://admin.shopify.com/store/just-for-test-app-dev/...`.
  - Pour l'analyse visuelle fine d'un screenshot, déléguer à `visual-judge` via `nextStep`.
- **Limites connues:** ne peut pas dispatcher d'agent lui-même ; renvoyer `nextStep` pour `visual-judge`.

- [ ] **Step 2: Verify playwright MCP tools present**

Run: `grep -c 'mcp__playwright__' .claude/agents/browser-automator.md`
Expected: a number ≥ 1.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/browser-automator.md
git commit -m "feat: add browser-automator sub-agent (playwright E2E)"
```

---

## Task 8: visual-judge agent

**Files:**
- Create: `.claude/agents/visual-judge.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: visual-judge
description: Analyse visuelle de screenshots — comparaison before/after, détection d'incohérences UI, OCR, QA du widget storefront. Reçoit des images, ne pilote pas le navigateur.
tools: Read, Grep, Glob
model: opus
---
```

Body must specify:
- **Rôle:** juger des screenshots fournis (alignement, espacement, hiérarchie, lisibilité, présence d'éléments attendus), lire du texte dans une image (OCR).
- **Quand m'invoquer:** après `browser-automator` (via `nextStep`), comparaison visuelle, "est-ce que ça ressemble à X".
- **Format d'entrée / sortie:** 5 blocs (les chemins des images dans `# RESSOURCES`) / JSON ; verdict PASS/FAIL par critère dans `details.verificationsPassed`.
- **Règles opérationnelles:** modèle opus obligatoire pour la fiabilité de l'analyse d'image ; ne pas piloter de navigateur (pas de MCP playwright).
- **Limites connues:** ne capture pas les screenshots lui-même — ils doivent lui être passés.

- [ ] **Step 2: Verify frontmatter is opus and has no MCP tools**

Run: `grep -E '^model: opus' .claude/agents/visual-judge.md && ! grep -q 'mcp__' .claude/agents/visual-judge.md && echo "NO_MCP_OK"`
Expected: `model: opus` line shown, then `NO_MCP_OK`.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/visual-judge.md
git commit -m "feat: add visual-judge sub-agent (opus, screenshot QA)"
```

---

## Task 9: deploy-ops agent

**Files:**
- Create: `.claude/agents/deploy-ops.md`

- [ ] **Step 1: Write the agent file**

Frontmatter (verbatim):

```yaml
---
name: deploy-ops
description: Opérations sur la prod Contabo via SSH MCP — docker logs/ps/compose, prisma migrate deploy, restart, pull. Autonomie totale (root prod). Actions destructives loggées.
tools: Read, Grep, Glob, Bash, mcp__ssh-mcp-contabo-cyrus__exec, mcp__ssh-mcp-contabo-cyrus__sudo-exec
model: sonnet
---
```

Body must specify:
- **Rôle:** diagnostiquer et opérer la prod Contabo (`root@161.97.137.138`), stack docker-compose dans `/root/docker-stack-cyrus`.
- **Quand m'invoquer:** "regarde les logs prod", "redémarre le conteneur", "applique les migrations en prod", "pourquoi le déploiement a échoué".
- **Format d'entrée / sortie:** 5 blocs / JSON ; lister chaque commande exécutée dans `details.actionsPerformed`.
- **Règles opérationnelles:**
  - **Autonomie totale** : peut exécuter restart/migrate/pull sans confirmation.
  - **Convention de sécurité (recommandée)** : `pg_dump`/snapshot avant tout `prisma migrate deploy` ; logger toute action destructive (rm, drop, down, prune) dans `concerns`.
  - Conteneurs : `shopify_app_prod` (main), `shopify_app_staging` (dev).
  - Le déploiement nominal est automatique sur push GitHub — n'intervenir manuellement que pour diagnostic/réparation.
- **Limites connues:** ne modifie pas le code applicatif (→ agents dev) ; agit uniquement sur la prod.

- [ ] **Step 2: Verify ssh MCP tools present**

Run: `grep -c 'mcp__ssh-mcp-contabo-cyrus__' .claude/agents/deploy-ops.md`
Expected: a number ≥ 1.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/agents/deploy-ops.md
git commit -m "feat: add deploy-ops sub-agent (SSH Contabo, full auto)"
```

---

## Task 10: skill playwright-whatsapp-profile

**Files:**
- Create: `.claude/skills/playwright-whatsapp-profile.md`

- [ ] **Step 1: Write the skill file**

Frontmatter (verbatim):

```yaml
---
name: playwright-whatsapp-profile
description: Utiliser Playwright MCP avec le profil Chromium persistant qui contient la session WhatsApp Web (compte Shopify Partner). Ne jamais utiliser --isolated.
user_invocable: false
---
```

Body must specify:
- **Profil:** `/home/angel/playwright-profile-shopify-logistics` (config dans `.mcp.json`, `--user-data-dir`).
- **Problème:** `--isolated` repartirait de zéro → re-scan QR à chaque session. Incompatible avec un profil persistant.
- **Single-instance:** Playwright MCP ne supporte qu'UNE instance Chromium par profil — fermer l'instance précédente avant relance (`mcp__playwright__browser_close`).
- **Première connexion / ré-onboarding (si session WhatsApp expirée):**
  1. `google-chrome --user-data-dir=/home/angel/playwright-profile-shopify-logistics https://web.whatsapp.com`
  2. Scanner le QR (WhatsApp mobile → Appareils connectés), cocher "Rester connecté".
  3. Attendre l'affichage des conversations, fermer Chrome proprement (pas de kill -9).
- **Sécurité:** le profil contient des cookies d'auth — ne jamais committer le dossier (hors repo).
- **Debug:** `ps -ef | grep playwright-mcp` doit montrer `--user-data-dir ...` et PAS `--isolated`.

- [ ] **Step 2: Verify frontmatter and profile path**

Run: `grep -E 'name: playwright-whatsapp-profile|playwright-profile-shopify-logistics' .claude/skills/playwright-whatsapp-profile.md`
Expected: both the name and the profile path appear.

- [ ] **Step 3: Commit (no push)**

```bash
git add .claude/skills/playwright-whatsapp-profile.md
git commit -m "feat: add playwright-whatsapp-profile skill"
```

---

## Task 11: skill test-order-e2e

**Files:**
- Create: `.claude/skills/test-order-e2e.md`

**Pre-req discovery (do these in Step 1, record results in the skill body):**
- Test shop domain: `just-for-test-app-dev.myshopify.com`.
- Admin URL base: `https://admin.shopify.com/store/just-for-test-app-dev`.
- Test courier identity (name, phone/JID, country/city, assigned products) — discover via the app's "Livreurs" admin page (`/app/agents`) and/or DB (`DeliveryAgent` rows for this shop). Record the concrete values found.

- [ ] **Step 1: Discover the test courier + shop state**

Run (via the running app DB or admin): inspect `DeliveryAgent` for the test shop and note name/phone/whatsappJid/country/role. If using DB directly:
`npx prisma studio` → table `DeliveryAgent` (or a `prisma` query). Record the WhatsApp number that should receive the notification.
Expected: at least one active `COURIER`/`BOTH` agent with a WhatsApp number. If none, the skill body must instruct creating one first via `/app/agents`.

- [ ] **Step 2: Write the skill file**

Frontmatter (verbatim):

```yaml
---
name: test-order-e2e
description: Test E2E complet — crée une commande dans l'admin Shopify, vérifie la notification WhatsApp Web reçue par le livreur, clique un lien de statut, vérifie la mise à jour du bon de livraison.
user_invocable: true
---
```

Body must specify, as numbered steps:
1. **Pré-requis:** profil WhatsApp connecté (skill `playwright-whatsapp-profile`) ; au moins un livreur actif avec numéro WhatsApp (valeurs concrètes découvertes en Step 1 inscrites ici).
2. **Créer la commande:** via `browser-automator`, naviguer dans l'admin Shopify (`.../orders`), créer une commande de test (client, adresse avec pays/ville matchant le livreur, 1 produit). Noter l'`orderName` (#NNNN).
3. **Attendre le webhook:** le handler `webhooks.orders-create` crée un `DeliveryBill` (`PENDING` → `ASSIGNED`) et déclenche `assignBestAgent`. Vérifier l'apparition du bon dans `/app/bills` (ou DB).
4. **Vérifier la notif WhatsApp Web:** via Playwright sur le profil persistant, ouvrir `web.whatsapp.com`, ouvrir la conversation du livreur, vérifier le message `🆕 Nouvelle commande` avec l'`orderName`, le produit, et les 3 liens de statut.
5. **Cliquer un lien de statut:** ouvrir le lien `✅ Livré` (`/api/bill-status?id=...&s=DELIVERED&t=...`) — la page renvoie une confirmation HTML.
6. **Vérifier la MAJ:** le `DeliveryBill` passe à `DELIVERED` (vérifier dans `/app/bills` ou DB ; `statusHistory` contient une entrée `source: whatsapp_url_link`).
7. **Rapport:** tableau PASS/FAIL par étape.

Known issues to document:
- Jitter humain 2–5s avant envoi WhatsApp → attendre avant de vérifier la notif.
- Rate limit 250/jour/shop.
- L'attribution échoue silencieusement si aucun livreur éligible (notif jamais envoyée) — vérifier le log d'attribution.

Usage:
```
/test-order-e2e
```

- [ ] **Step 3: Verify frontmatter is user_invocable**

Run: `grep -E 'name: test-order-e2e|user_invocable: true' .claude/skills/test-order-e2e.md`
Expected: both lines present.

- [ ] **Step 4: Commit (no push)**

```bash
git add .claude/skills/test-order-e2e.md
git commit -m "feat: add test-order-e2e skill"
```

---

## Task 12: CLAUDE.md routing sections

**Files:**
- Modify: `CLAUDE.md` (append two new top-level sections after the existing architecture content)

- [ ] **Step 1: Append the agent routing section**

Add a `## Sub-agents` section containing the 7-row routing table (Agent | Modèle | Quand l'invoquer), the dispatch-via-`Agent`-tool note, the 5-block prompt format reference, and a pointer to `.claude/agents/README.md`. Use this table:

| Agent | Modèle | Quand l'invoquer |
|---|---|---|
| `researcher` | haiku | "où est X", lookup read-only large |
| `shopify-remix-dev` | sonnet | route/loader/action, auth, billing, webhook, Polaris, édit simple |
| `prisma-db` | sonnet | schéma, migration, index, data model |
| `whatsapp-baileys-debugger` | opus | connexion WhatsApp, QR, session, reconnect, rate limit, message |
| `browser-automator` | sonnet | test E2E, vérif notif WhatsApp Web, QA navigateur |
| `visual-judge` | opus | analyse screenshot, comparaison before/after, OCR |
| `deploy-ops` | sonnet | logs/restart/migrate prod Contabo, échec déploiement |

- [ ] **Step 2: Append the skill routing section**

Add a `## Skill routing` section stating:
- **Tests:** `/test-order-e2e` (E2E commande → WhatsApp → statut) ; profil géré par le skill `playwright-whatsapp-profile`.
- **Activer:** `/health` (CI typecheck/lint/build), `/qa`, `/investigate`, `/cso`, `/codex`, `context-save`/`context-restore`.
- **NE PAS invoquer** (workflow commit-direct, déploiement auto sur push, pas de PR) : `/ship`, `/land-and-deploy`, `/landing-report`, `/review` PR-based, `finishing-a-development-branch`, `using-git-worktrees`, `requesting-code-review`, `receiving-code-review`.

- [ ] **Step 3: Verify both sections exist and architecture content is intact**

Run: `grep -E '^## (Sub-agents|Skill routing)' CLAUDE.md && grep -c '^## ' CLAUDE.md && grep -q 'Order → notification flow' CLAUDE.md && echo "ARCH_INTACT"`
Expected: both new headings shown, section count increased, `ARCH_INTACT` printed.

- [ ] **Step 4: Commit (no push)**

```bash
git add CLAUDE.md
git commit -m "docs: add sub-agent + skill routing to CLAUDE.md"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Verify all 8 agent files exist (7 agents + README)**

Run: `ls .claude/agents/ | sort`
Expected: `README.md`, `browser-automator.md`, `deploy-ops.md`, `prisma-db.md`, `researcher.md`, `shopify-remix-dev.md`, `visual-judge.md`, `whatsapp-baileys-debugger.md`.

- [ ] **Step 2: Verify both skill files exist**

Run: `ls .claude/skills/ | sort`
Expected: `playwright-whatsapp-profile.md`, `test-order-e2e.md`.

- [ ] **Step 3: Verify every agent frontmatter has the 4 required fields**

Run: `for f in .claude/agents/*.md; do [ "$f" = ".claude/agents/README.md" ] && continue; echo "== $f"; grep -cE '^(name|description|tools|model):' "$f"; done`
Expected: each agent file prints `4`.

- [ ] **Step 4: Verify agents are recognized by Claude Code**

Run: `claude agents list 2>/dev/null || echo "use the Agent tool with subagent_type to confirm"`
Expected: the 7 agents appear, OR (fallback) confirm by dispatching a trivial `researcher` task via the `Agent` tool in-session.

- [ ] **Step 5: Confirm git log shows the feature commits (no push performed)**

Run: `git log --oneline -10 && git status -sb | head -1`
Expected: the feature commits present; branch ahead of origin/main but NOT pushed.

---

## Self-Review

**Spec coverage:**
- Arborescence → Tasks 1–12 ✓
- 7 agents → Tasks 3–9 ✓
- Format JSON + 5 blocs + limitation dispatch → Task 2 ✓
- 2 skills → Tasks 10–11 ✓
- Routing CLAUDE.md (activer/désactiver) → Task 12 ✓
- MCP wiring → Task 1 ✓
- Convention sécurité deploy-ops → Task 9 body ✓
- Critères de succès → Task 13 ✓

**Placeholder scan:** test courier identity is the only "discover at impl" item — Task 11 Step 1 makes the discovery an explicit action with a concrete command and fallback (create an agent if none), so it is not an open placeholder.

**Type/name consistency:** agent `name:` values match the routing tables in Task 2, Task 12, and Task 13 verification. MCP tool names (`mcp__playwright__*`, `mcp__ssh-mcp-contabo-cyrus__*`, `mcp__context7__*`) match `.mcp.json` server keys and the deferred-tool list.
