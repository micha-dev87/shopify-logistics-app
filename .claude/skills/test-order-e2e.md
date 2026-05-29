---
name: test-order-e2e
description: Test E2E complet — crée une commande dans l'admin Shopify, vérifie la notification WhatsApp Web reçue par le livreur, clique un lien de statut, vérifie la mise à jour du bon de livraison.
user_invocable: true
---

# Test E2E : commande → WhatsApp → statut

Parcours complet de bout en bout sur le shop de test :

- Shop de test : `just-for-test-app-dev.myshopify.com`
- Base admin Shopify : `https://admin.shopify.com/store/just-for-test-app-dev`

L'agent `browser-automator` pilote le navigateur (profil Playwright persistant,
voir le skill `playwright-whatsapp-profile`).

## Étapes

1. **Pré-requis + découverte du livreur de test (au run-time).**
   - Profil WhatsApp connecté : vérifier via le skill `playwright-whatsapp-profile`
     (sinon ré-onboarder le QR avant de continuer).
   - **Découvrir le livreur de test maintenant** (ne pas se fier à des valeurs
     codées en dur) : ouvrir la page « Livreurs » de l'admin app
     (`/app/agents`) — ou inspecter la table `DeliveryAgent` filtrée sur le shop
     de test — et relever pour un agent actif :
     - `name`
     - `phone` / `whatsappJid` (le numéro qui doit recevoir la notif)
     - `country` / `city`
     - `role` — doit être `COURIER` ou `BOTH` (sinon il ne reçoit pas les notifs)
   - **Si aucun livreur éligible n'existe**, en créer un d'abord via `/app/agents`
     (rôle `COURIER` ou `BOTH`, numéro WhatsApp valide, pays/ville renseignés),
     puis reprendre.
   - Noter les valeurs trouvées : elles servent au matching d'attribution
     (Tier 2 pays/ville) et à savoir quelle conversation WhatsApp vérifier.

2. **Créer la commande (via `browser-automator`).**
   - Naviguer dans l'admin Shopify : `https://admin.shopify.com/store/just-for-test-app-dev/orders`.
   - Créer une commande de test : un client, une **adresse dont pays/ville
     correspondent au livreur découvert en étape 1**, 1 produit.
   - Si le livreur a des produits assignés (`AgentProduct`), choisir un de ces
     produits force l'attribution Tier 1.
   - Noter l'`orderName` affiché (`#NNNN`).

3. **Attendre le webhook.**
   - `webhooks.orders-create` valide le HMAC, crée un `DeliveryBill`
     (`PENDING`), puis lance `assignBestAgent` (→ `ASSIGNED`).
   - Vérifier l'apparition du bon dans `/app/bills` (ou en DB sur `DeliveryBill`
     filtré par le shop de test), avec `orderName` correspondant et un agent
     assigné.

4. **Vérifier la notif WhatsApp Web.**
   - Via Playwright sur le profil persistant, ouvrir `https://web.whatsapp.com`.
   - Ouvrir la conversation du livreur découvert en étape 1 (son numéro WhatsApp).
   - Vérifier le message `🆕 *Nouvelle commande:*` contenant :
     - l'`orderName` (`🔖 Commande n°: #NNNN`),
     - le produit (`🛍️ Produit:`),
     - les **3 liens de statut** (`📦 Pris en charge`, `✅ Livré`, `❌ Non livré`).

5. **Cliquer un lien de statut.**
   - Cliquer / ouvrir le lien `✅ Livré`, de la forme :
     `/api/bill-status?id={billId}&s=DELIVERED&t={token}`
     (URL complète : `{APP_URL}/api/bill-status?id={billId}&s=DELIVERED&t={token}`).
   - Le token est `HMAC-SHA256(billId:status, secret).slice(0,16)` (16 hex),
     déjà inclus dans le lien généré par `app/whatsapp.server.ts` — ne pas le
     recalculer.
   - La page (`api.bill-status.tsx`) renvoie une **confirmation HTML** :
     carte verte « Statut mis à jour » avec l'`orderName` et `✅ Livré`.

6. **Vérifier la MAJ du bon.**
   - Le `DeliveryBill` passe à `DELIVERED` (vérifier dans `/app/bills` ou en DB).
   - `statusHistory` contient une nouvelle entrée
     `{ status: "DELIVERED", source: "whatsapp_url_link", ... }`.

7. **Rapport.**
   - Produire un tableau **PASS / FAIL par étape** (1 → 6), avec l'`orderName`,
     le `billId`, le numéro du livreur notifié, et un screenshot clé par étape
     côté WhatsApp Web et page de confirmation.

## Problèmes connus

- **Jitter humain 2–5 s** avant chaque envoi WhatsApp : attendre quelques
  secondes après la création de la commande avant de vérifier la notif
  (utiliser `mcp__playwright__browser_wait_for`).
- **Rate limit 250/jour/shop** (compteur Redis `whatsapp:rate:{shopId}:{YYYY-MM-DD}`,
  exp 24h) : au-delà, aucune notif n'est envoyée — vérifier le compteur si la
  notif manque.
- **Attribution silencieuse** : si aucun livreur éligible (ni produit Tier 1, ni
  pays/ville Tier 2), `assignBestAgent` n'assigne personne et **aucune notif
  n'est envoyée** — vérifier le log d'attribution et l'adresse/produit de la
  commande de test.

## Usage

```
/test-order-e2e
```
