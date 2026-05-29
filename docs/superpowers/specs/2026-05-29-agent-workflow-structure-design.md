# Design — Couche de workflow agent (Claude Code) pour shopify-logistics-app

Date : 2026-05-29
Statut : approuvé (brainstorming)

## Contexte

Le projet `shopify-logistics-app` n'a aujourd'hui aucune infrastructure agent Claude Code :
pas de `.claude/`, pas de sub-agents, pas de skills projet. Le `CLAUDE.md` actuel (100 lignes)
est une pure documentation d'architecture. Les MCPs `playwright`, `ssh-mcp-contabo-cyrus` et
`context7` viennent d'être ajoutés dans `.mcp.json` (gitignored).

Le projet aipitch-v2 dispose d'une couche mature (10 sub-agents, skills de test E2E, routing
CLAUDE.md à 4 phases). L'objectif est de doter ce projet d'un équivalent **adapté à sa réalité**,
pas une copie : le workflow git, la stack de tests et la cible E2E diffèrent fondamentalement.

### Différences structurantes vs aipitch-v2

| Axe | aipitch-v2 | shopify-logistics-app |
|---|---|---|
| Git | commit direct `alpha`, pas de PR, déploiement FTP | commit direct `main`/`dev`, pas de PR, déploiement Docker auto sur push |
| Stack tests | aucune (pas de lint/types) | `typecheck` + `lint` + `build` en CI |
| Cible E2E | site Wix live, 4 envs | admin Shopify → notif WhatsApp Web → lien de statut |
| Prod | hébergement Wix/FTP | VPS Contabo `root@161.97.137.138`, Docker Compose |

## Objectif

Mettre en place la **couche complète A + B** :
- **A — Couche de test/QA** : skills décrivant les parcours de test (commande → WhatsApp Web → statut)
  et la gestion du profil Playwright persistant.
- **B — Couche d'orchestration dev** : ~7 sub-agents spécialisés + routing skills/agents dans `CLAUDE.md`.

## Décisions validées

1. **Périmètre** : couche complète A + B.
2. **Roster d'agents** : ~7, adaptés au domaine (pas les 10 d'aipitch-v2).
3. **Autorité `deploy-ops`** : **autonomie totale** sur la prod Contabo (root), sans confirmation.
4. **Workflow git** : commit direct sur `main`/`dev`, pas de PR. Push = déploiement auto.
5. **Layout** : miroir de la convention aipitch-v2 (`.claude/agents/*.md`, `.claude/skills/*.md`,
   routing dans `CLAUDE.md`, `agents/README.md` avec format de retour JSON).

## Architecture

### Arborescence cible

```
.claude/
  agents/
    README.md                      # liste + format de retour JSON standardisé + format prompt 5 blocs
    researcher.md                  # haiku  — lookup read-only
    shopify-remix-dev.md           # sonnet — routes/loaders/actions, auth, billing, webhooks, Polaris
    prisma-db.md                   # sonnet — schéma, migrations, invariant multi-tenant
    whatsapp-baileys-debugger.md   # opus   — sessions Baileys, sockets, reconnect, rate limit
    browser-automator.md           # sonnet — Playwright E2E (admin Shopify + WhatsApp Web)
    visual-judge.md                # opus   — analyse screenshots, QA visuelle widget
    deploy-ops.md                  # sonnet — SSH Contabo, Docker, migrate (FULL AUTO)
  skills/
    test-order-e2e.md              # user_invocable — parcours commande → notif → statut
    playwright-whatsapp-profile.md # guide profil persistant WhatsApp Web (non user_invocable)
  settings.local.json              # active les 3 MCPs projet (déjà gitignored)
CLAUDE.md                          # + sections routing agents/skills
docs/superpowers/specs/2026-05-29-agent-workflow-structure-design.md  # ce fichier
```

### Roster d'agents (7)

`code-writer` fusionné dans `shopify-remix-dev` (redondant). Git/push reste à la **session
principale** (push = déploiement auto, action délibérée non déléguée à un agent).

| Agent | Modèle | MCP | Rôle | Édite |
|---|---|---|---|---|
| `researcher` | haiku | — | "où est X", grep/read rapide, listing | rien (read-only) |
| `shopify-remix-dev` | sonnet | context7 | Remix routes/loaders/actions, Shopify auth/billing/webhooks, Polaris UI | `app/routes/`, `app/*.server.ts`, `app/*.ts(x)` |
| `prisma-db` | sonnet | context7 | `schema.prisma`, migrations safe-with-traffic, filtrage `shopId`, indexes | `prisma/` |
| `whatsapp-baileys-debugger` | opus | — | sérialisation creds (Buffer), lifecycle socket, 401/405, reconnect, rate limit Redis | `app/whatsapp.server.ts` |
| `browser-automator` | sonnet | playwright | E2E : crée commande admin Shopify → vérifie notif WhatsApp Web → clic lien statut | tests/QA only |
| `visual-judge` | opus | — | analyse screenshots, before/after, OCR, QA visuelle widget | rien (analyse) |
| `deploy-ops` | sonnet | ssh-mcp-contabo-cyrus | `docker logs/ps/compose`, `prisma migrate deploy`, restart, pull — **autonome** | prod Contabo |

Choix des modèles : **opus** pour les agents à raisonnement subtil (logique Baileys/signal-keys ;
analyse visuelle), **sonnet** pour le dev/ops courant, **haiku** pour le lookup pur.

### Format de retour standardisé (tous agents)

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | API_LIMIT | BLOCKED | NEEDS_CONTEXT",
  "summary": "1-3 lignes",
  "details": { "filesChanged": [], "actionsPerformed": [], "verificationsPassed": [] },
  "nextStep": null,
  "concerns": []
}
```

### Format prompt envoyé aux agents (5 blocs)

`# CONTEXTE`, `# TÂCHE`, `# CONTRAINTES`, `# RESSOURCES`, `# FORMAT DE RETOUR ATTENDU`.

### Limitation Claude Code à documenter

Un sub-agent ne peut pas en dispatcher un autre (l'outil `Agent` est retiré des sous-contextes).
Seule la session principale orchestre. Si une chaîne A → B est nécessaire, la session principale
ré-orchestre via le `nextStep` retourné.

## Skills

### `test-order-e2e` (user_invocable)

Parcours de validation de bout en bout :
1. Créer une commande de test dans l'admin Shopify (`just-for-test-app-dev.myshopify.com`).
2. Attendre le webhook `orders/create` → création du `DeliveryBill` (statut `PENDING` → `ASSIGNED`).
3. Vérifier via Playwright (profil persistant) que la notification arrive sur WhatsApp Web,
   sur le compte du livreur de test.
4. Cliquer un des 3 liens de statut HMAC (`/api/bill-status?...`).
5. Vérifier la mise à jour du statut du `DeliveryBill` (page admin `app.bills` ou DB).

L'identité exacte du livreur de test (JID/numéro), l'état de la boutique et les données produit
seront découverts à l'implémentation via l'admin Shopify et la DB — non figés dans ce spec.

### `playwright-whatsapp-profile` (non user_invocable)

Guide du profil persistant `/home/angel/playwright-profile-shopify-logistics` :
- Toujours `--user-data-dir`, **jamais** `--isolated`.
- Single-instance Chromium par profil (fermer l'instance précédente avant relance).
- Procédure pour re-scanner le QR si la session WhatsApp Web expire.
- Ne jamais committer le dossier de profil (contient les cookies d'auth).

## Routing CLAUDE.md (inversé vs aipitch-v2)

- **Activer** : `/health` (CI typecheck/lint/build existe), `/qa`, `/investigate`, `/cso`,
  `/codex`, `context-save` / `context-restore`.
- **Désactiver** : `/ship`, `/land-and-deploy`, `/landing-report`, `/review` (PR-based),
  `finishing-a-development-branch`, `using-git-worktrees`, `requesting-code-review`,
  `receiving-code-review` → workflow commit-direct, déploiement auto sur push.
- Ajouter : table de routing des 7 agents, format prompt 5 blocs, format retour JSON,
  pointeurs vers les 2 skills de test.

## Convention de sécurité deploy-ops (recommandée)

Malgré l'autonomie totale validée :
- **`pg_dump` / snapshot avant tout `prisma migrate deploy`** sur prod.
- Logger toute action destructive (rm, drop, down, prune) dans la synthèse de retour.

Recommandation non bloquante — l'utilisateur reste libre de l'ignorer.

## Hors périmètre (YAGNI)

- Pas d'agent `git-deployer` (git reste à la session principale).
- Pas de framework de tests unitaires (jest/vitest) — la stack actuelle n'en a pas.
- Pas de skill de génération de slides / Airtable / n8n (spécifiques aipitch-v2).
- Pas de Session Continuity / handoff automatique pour l'instant (pourra s'ajouter plus tard).

## Critères de succès

1. `.claude/agents/` contient les 7 fichiers + README, chacun avec frontmatter
   (`name`, `description`, `tools`, `model`) valide.
2. `.claude/skills/` contient les 2 skills, frontmatter valide.
3. `.claude/settings.local.json` active les 3 MCPs projet.
4. `CLAUDE.md` contient les sections routing agents + routing skills sans casser la doc
   d'architecture existante.
5. Les agents sont invocables via le tool `Agent` (`subagent_type` = nom).
6. `test-order-e2e` est invocable et documente le parcours complet.
