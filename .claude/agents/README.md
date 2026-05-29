# Sub-agents — shopify-logistics-app

Roster des sous-agents Claude Code spécialisés pour ce projet, leurs modèles, leur accès MCP
et leur périmètre. Chaque agent suit les conventions de prompt et de retour décrites ci-dessous.

## Roster

| Agent | Modèle | MCP | Rôle court |
|---|---|---|---|
| `researcher` | haiku | — | Lookup read-only |
| `shopify-remix-dev` | sonnet | context7 | Routes/loaders/actions, auth, billing, Polaris |
| `prisma-db` | sonnet | context7 | Schéma, migrations, multi-tenant |
| `whatsapp-baileys-debugger` | opus | — | Sessions Baileys, sockets, reconnect |
| `browser-automator` | sonnet | playwright | E2E admin Shopify + WhatsApp Web |
| `visual-judge` | opus | — | Analyse screenshots |
| `deploy-ops` | sonnet | ssh-mcp-contabo-cyrus | SSH Contabo, Docker (full auto) |

## Format de retour JSON (standardisé, tous agents)

Chaque agent termine sa réponse par un objet JSON suivant exactement cette forme :

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | API_LIMIT | BLOCKED | NEEDS_CONTEXT",
  "summary": "1-3 lignes",
  "details": { "filesChanged": [], "actionsPerformed": [], "verificationsPassed": [] },
  "nextStep": null,
  "concerns": []
}
```

- `status` — état de la mission (succès, succès avec réserves, limite API, bloqué, contexte manquant).
- `summary` — synthèse de 1 à 3 lignes.
- `details.filesChanged` — chemins des fichiers modifiés.
- `details.actionsPerformed` — actions exécutées (recherches, commandes, édits).
- `details.verificationsPassed` — vérifications passées.
- `nextStep` — `null`, ou une description de l'étape suivante à ré-orchestrer par la session principale (ex. déléguer à un autre agent).
- `concerns` — réserves, risques, ou actions destructives à signaler.

## Format de prompt envoyé aux agents (5 blocs)

Tout prompt adressé à un sous-agent est structuré en 5 blocs, dans cet ordre :

- `# CONTEXTE` — le contexte projet et l'état courant.
- `# TÂCHE` — l'objectif précis à accomplir.
- `# CONTRAINTES` — les règles à respecter (invariants, périmètre, interdits).
- `# RESSOURCES` — fichiers, chemins, URLs, screenshots, données utiles.
- `# FORMAT DE RETOUR ATTENDU` — rappel du format JSON ci-dessus.

## Limitation de dispatch

Un sub-agent ne peut pas en dispatcher un autre — l'outil `Agent` est retiré des sous-contextes.
Seule la session principale orchestre ; une chaîne A → B se fait via le `nextStep` retourné,
ré-orchestré par la session principale.
