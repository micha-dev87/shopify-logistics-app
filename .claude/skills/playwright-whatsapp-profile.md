---
name: playwright-whatsapp-profile
description: Utiliser Playwright MCP avec le profil Chromium persistant qui contient la session WhatsApp Web (compte Shopify Partner). Ne jamais utiliser --isolated.
user_invocable: false
---

# Profil Playwright persistant (session WhatsApp Web)

Ce projet pilote WhatsApp Web via Playwright MCP. La session WhatsApp est
liée à un **profil Chromium persistant** — il doit être réutilisé tel quel à
chaque test, sinon il faut re-scanner le QR.

## Profil

- Chemin : `/home/angel/playwright-profile-shopify-logistics`
- Configuré dans `.mcp.json` (serveur `playwright`) via l'argument
  `--user-data-dir /home/angel/playwright-profile-shopify-logistics`.
- Contient cookies, localStorage et clés de session de WhatsApp Web (compte
  Shopify Partner). C'est ce qui maintient la connexion entre les sessions.

## Ne JAMAIS utiliser `--isolated`

- `--isolated` démarre un profil vierge en mémoire, jeté à la fermeture.
- Conséquence : WhatsApp Web repart de zéro → **re-scan du QR à chaque
  session**, ce qui casse tout test E2E automatisé.
- Le mode isolé est **incompatible** avec un profil persistant. Le `.mcp.json`
  ne doit contenir que `--user-data-dir`, pas `--isolated`.

## Single-instance

- Playwright MCP ne supporte qu'**UNE seule instance Chromium par profil**.
- Lancer une seconde instance sur le même `--user-data-dir` échoue (profil
  verrouillé) ou corrompt la session.
- Avant toute relance, **fermer l'instance précédente** :
  `mcp__playwright__browser_close`.
- Idem si un Chrome manuel a été ouvert sur ce profil : le fermer proprement
  avant de relancer le MCP.

## Première connexion / ré-onboarding (session WhatsApp expirée)

Si WhatsApp Web n'est plus connecté (QR affiché au lieu des conversations) :

1. Ouvrir Chrome manuellement sur le profil :
   `google-chrome --user-data-dir=/home/angel/playwright-profile-shopify-logistics https://web.whatsapp.com`
2. Scanner le QR depuis WhatsApp mobile (**Paramètres → Appareils connectés →
   Connecter un appareil**), en cochant **« Rester connecté »**.
3. Attendre l'affichage complet de la liste des conversations, puis **fermer
   Chrome proprement** (fermer la fenêtre — jamais `kill -9`, qui peut corrompre
   le profil et invalider la session).
4. Relancer ensuite le MCP Playwright : il réutilisera la session fraîche.

## Sécurité

- Le profil contient des **cookies d'authentification et clés de session**.
- Ne **jamais committer** le dossier `/home/angel/playwright-profile-shopify-logistics`
  — il est hors du dépôt par conception, ne pas le déplacer dans le repo.
- Ne pas partager ni copier le dossier hors de la machine.

## Debug

- Vérifier que le MCP tourne avec le bon profil :
  `ps -ef | grep playwright-mcp`
- La ligne de commande doit montrer `--user-data-dir /home/angel/playwright-profile-shopify-logistics`
  et **PAS** `--isolated`.
- Si `--isolated` apparaît : corriger `.mcp.json`, fermer l'instance, relancer.
