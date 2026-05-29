# Design — Notification WhatsApp au propriétaire lors d'un changement de statut

Date : 2026-05-29
Statut : approuvé (brainstorming)

## Contexte

Aujourd'hui, quand un livreur change le statut d'un bon de livraison (via le lien HMAC
ou le bouton WhatsApp), seuls le bon en DB et une éventuelle confirmation au livreur sont
mis à jour. Le **propriétaire de la boutique** n'est pas notifié.

Objectif : envoyer une notification WhatsApp sur le **compte WhatsApp connecté du propriétaire**
(la session Baileys elle-même = `Shop.whatsappPhone`) à chaque changement de statut effectué
par un livreur, avec l'image du produit et les détails du bon.

## Décisions validées

1. **Déclenchement** : tous les changements de statut livreur (`IN_PROGRESS`, `DELIVERED`,
   `NOT_DELIVERED`), sur **les deux chemins** : lien HMAC ([api.bill-status.tsx](../../app/routes/api.bill-status.tsx))
   et bouton WhatsApp (`handleButtonClick` dans [whatsapp.server.ts](../../app/whatsapp.server.ts)).
2. **Hors quota** : la notif propriétaire **n'incrémente pas** le compteur Redis des 250/jour
   (chemin d'envoi dédié non compté).
3. **Lien** : vers le bon dans l'admin de l'app (`/app/bills`), via deep link Shopify admin.
4. **Champs** : image produit, nom produit, lien, « Assigné à [livreur] », statut actuel,
   **+** n° commande, client (nom + téléphone), ancien → nouveau statut, heure, quantité.
5. **Approche A** : nouvelle méthode dédiée `sendOwnerNotification` (n'altère pas la fonction
   critique `sendDeliveryNotification`).

## Architecture

### Nouveau chemin d'envoi (non compté) — Approche A

Dans `WhatsAppService` ([whatsapp.server.ts](../../app/whatsapp.server.ts)), ajouter :

```
async sendOwnerNotification(jid, text, imageUrl?): Promise<{success, messageId?, error?}>
```

- Récupère le socket depuis `activeSockets`, avec la **même logique d'auto-reconnect** que
  `sendDeliveryNotification` (reconnecte si le socket est tombé, attend jusqu'à 15 s).
- Envoie `image: { url }, caption: text` si `imageUrl` commence par `http`, sinon `text`.
- **N'appelle JAMAIS `incrementRateLimit`** ni `checkRateLimit` → hors quota.
- Best-effort : retourne `{success:false, error}` au lieu de lever ; aucune exception ne remonte.
- Pas de jitter humain nécessaire (faible volume, message interne) — envoi direct.

### Fonction d'orchestration

Exporter de [whatsapp.server.ts](../../app/whatsapp.server.ts) :

```
async function notifyOwnerOnStatusChange(
  shopId: string,
  billId: string,
  previousStatus: string,
  newStatus: string,
  source: string
): Promise<void>
```

Logique :
1. Charger le bon avec `shop` + `assignedAgent` (`prisma.deliveryBill.findUnique({ where:{id:billId}, include:{ shop:true, assignedAgent:true }})`).
2. Si `bill` absent → return.
3. Récupérer le numéro propriétaire : `bill.shop.whatsappPhone`. Si absent → return (skip silencieux).
   Vérifier aussi que la session est connectée (`WhatsAppSession.connected`) ; sinon return.
4. **Construire le JID propriétaire** : retirer le suffixe d'appareil `:NN` de `whatsappPhone`
   (ex. `14508221064:85` → `14508221064`), puis `${digits}@s.whatsapp.net`.
   (Garde-fou : ne garder que les chiffres avant le `:`.)
5. Construire le message (voir format ci-dessous) et le lien admin.
6. Appeler `service.sendOwnerNotification(ownerJid, message, bill.productImage ?? undefined)`.
7. Logger succès/échec. Ne jamais throw.

### Lien admin de l'app

Deep link : `https://admin.shopify.com/store/{storeHandle}/apps/{appHandle}/app/bills`

- `storeHandle` = `bill.shop.domain` sans le suffixe `.myshopify.com`
  (ex. `just-for-test-app-dev.myshopify.com` → `just-for-test-app-dev`).
- `appHandle` = **nouvelle variable d'environnement** `ADMIN_APP_HANDLE` (défaut : `logistics-app-9`).
  Documentée dans [.env.example](../../.env.example).

### Format du message

```
🔔 *Mise à jour de livraison* — {shopName}

🔖 *Commande:* {orderName}
🛍️ *Produit:* {productTitle} (×{productQuantity})
🔗 {lien admin /app/bills}

🚚 *Assigné à:* {agentName}
📊 *Statut:* {ancienLabel} → {nouveauLabel}
🕒 {dd mmm yyyy, HH:MM}

🧑 *Client:* {customerName}
📞 *Téléphone:* {customerPhone ou "Non renseigné"}
```

- Image en tête : `bill.productImage` si elle commence par `http`, sinon message texte seul.
- `agentName` : `bill.assignedAgent?.name` ou « Non assigné » si null.
- Labels de statut (réutiliser/étendre la map existante) :
  `PENDING` → « ⏳ En attente », `ASSIGNED` → « 📋 Assigné »,
  `IN_PROGRESS` → « 📦 Pris en charge », `DELIVERED` → « ✅ Livré »,
  `NOT_DELIVERED` → « ❌ Non livré », `CANCELLED` → « 🚫 Annulé ».
- Heure : `toLocaleString('fr-FR', { timeZone:'Africa/Lagos', ... })` (cohérent avec la notif livreur).

### Déclencheurs

**1. Lien HMAC — [api.bill-status.tsx](../../app/routes/api.bill-status.tsx)**
- Capturer `previousStatus = bill.status` avant l'update (déjà disponible).
- Après `prisma.deliveryBill.update(...)`, appeler
  `await notifyOwnerOnStatusChange(bill.shopId, billId, bill.status, status, "whatsapp_url_link")`
  dans un `try/catch` qui n'empêche pas le rendu de la page HTML de confirmation.

**2. Bouton WhatsApp — `handleButtonClick` (whatsapp.server.ts)**
- Après l'update du statut et l'envoi de la confirmation au livreur, appeler
  `notifyOwnerOnStatusChange(shopId, billId, bill.status, newStatus, "whatsapp_callback")`
  en best-effort.

## Invariants & sécurité

- **Multi-tenant** : tout est dérivé du `shopId`/`bill.shop` ; pas d'accès cross-tenant.
- **Best-effort** : un échec d'envoi propriétaire ne doit jamais casser la mise à jour de statut
  ni le rendu de la page de confirmation (les deux chemins).
- **Hors quota** confirmé : aucun appel à `incrementRateLimit`.
- **Auto-message** : envoyer au propre numéro du compte connecté atterrit dans le chat « Vous » —
  comportement attendu et voulu.

## Hors périmètre (YAGNI)

- Pas de préférence on/off par boutique pour cette notif (toujours active si WhatsApp connecté).
- Pas de notif pour les changements de statut faits depuis l'admin (uniquement déclenchés par le livreur).
- Pas de persistance d'un `productUrl` sur `DeliveryBill` (le lien pointe vers l'admin, pas le produit).
- Pas de modification du modèle Prisma.

## Critères de succès

1. À chaque clic d'un lien de statut (Pris en charge / Livré / Non livré), le propriétaire
   reçoit sur son WhatsApp connecté un message avec image produit + tous les champs listés.
2. Idem via le bouton WhatsApp.
3. Le compteur Redis des 250/jour **n'augmente pas** à cause de ces notifs.
4. Si le produit n'a pas d'image, le message part en texte seul (pas d'échec).
5. Un échec d'envoi propriétaire n'empêche pas la mise à jour du statut ni la page de confirmation.
6. Le lien ouvre la page « Bons de livraison » de l'app dans l'admin Shopify.
