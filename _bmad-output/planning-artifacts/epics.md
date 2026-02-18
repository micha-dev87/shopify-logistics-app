---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics"]
inputDocuments: ["prd.md", "architecture.md", "product-brief-Shopify Saas (individual)-2026-02-08.md", ".bmad/rules/deployment-infrastructure.md"]
workflowType: 'epics'
---

# Shopify Saas (individual) - Epic Breakdown

## Overview

Ce document fournit la breakdown complète des epics et stories pour **Shopify Logistics App**, décomposant les exigences du PRD et de l'Architecture en stories implémentables.

## Requirements Inventory

### Functional Requirements

| FR | Description |
|-----|-------------|
| **FR1** | Installation one-click Shopify avec onboarding simplifié |
| **FR2** | CRUD complet des livreurs (création, modification, suppression) |
| **FR3** | Association Pays/Ville pour chaque livreur (base 54 pays africains) |
| **FR4** | Gestion des rôles : Livreur, Service Client, Les deux |
| **FR5** | Bot Telegram avec notifications de nouvelles commandes |
| **FR6** | Boutons inline Telegram pour actions rapides (Pris en charge, Livré, Non livré) |
| **FR7** | Messages Telegram riches (image produit, détails client, adresse) |
| **FR8** | Webhook Shopify pour réception automatique des commandes |
| **FR9** | Algorithme d'attribution : Pays → Ville → Livreur le moins chargé |
| **FR10** | Dashboard admin avec liste des bons de livraison |
| **FR11** | Filtres basiques sur les bons (statut, date, livreur) |
| **FR12** | Détails popup des bons (produit, livreur, client) |
| **FR13** | Notifications multi-canal propriétaire (Dashboard + Email) |
| **FR14** | Gestion des statuts de livraison (Pending, Assigned, In Progress, Delivered, Not Delivered) |
| **FR15** | Widget WhatsApp avec injection automatique via Theme Extension |
| **FR16** | Configuration widget à la volée (sélection pays/contacts) |
| **FR17** | Essai 7 jours gratuit |
| **FR18** | Plans tiered (Basique: 2, Gold: 5, Pro: 10 livreurs) |
| **FR19** | Shopify Billing API pour facturation récurrente |
| **FR20** | Isolation multi-tenant par `shop_id` |

### NonFunctional Requirements

| NFR | Description | Cible |
|------|-------------|---------|
| **NFR1** | Latence notifications < 30 secondes | <30s |
| **NFR2** | Uptime API > 99.5% | >99.5% |
| **NFR3** | Performance widget < 2 secondes | <2s |
| **NFR4** | Taux de réussite webhooks > 99% | >99% |
| **NFR5** | Disponibilité base pays africains (54 pays) | 100% |
| **NFR6** | Sécurité : Isolation multi-tenant par `shop_id` | GDPR compliant |
| **NFR7** | Rate limiting Telegram (30 msgs/s) | 30 msg/s |

### Additional Requirements

| Type | Exigence |
|-------|------------|
| **Starter Template** | Shopify CLI avec template Remix (TypeScript, Prisma, Polaris) |
| **Infrastructure** | Docker Compose multi-container (app, postgres, redis, caddy) |
| **Database** | PostgreSQL 16 avec Prisma ORM |
| **Multi-tenancy** | `shop_id` comme clé de partitionnement toutes tables |
| **Queue** | Redis existant + BullMQ pour notifications Telegram |
| **Rate Limiting** | Gestion limite 30 msgs/s Telegram avec backoff exponentiel |
| **Idempotency** | `orderId` unique pour webhooks Shopify |
| **Monitoring** | Health check endpoint + Winston logger (MVP) |
| **Webhook Security** | Vérification HMAC Shopify obligatoire |
| **Scopes Shopify** | `read_orders`, `write_products`, `read_products`, `read_customers`, `read_all_orders` |
| **Widget Polling** | 60 secondes pour récupération configuration |
| **OAuth Flow** | Flow OAuth 2.0 Shopify (fourni par starter) |
| **VPS Integration** | Réutilisation containers postgres/redis existants |

### FR Coverage Map

| FR | Epic | Description |
|-----|------|-------------|
| FR1 | Epic 1 | Installation one-click Shopify |
| FR2 | Epic 2 | CRUD livreurs |
| FR3 | Epic 2 | Association Pays/Ville |
| FR4 | Epic 2 | Gestion des rôles |
| FR5 | Epic 4 | Bot Telegram notifications |
| FR6 | Epic 4 | Boutons inline Telegram |
| FR7 | Epic 4 | Messages Telegram riches |
| FR8 | Epic 3 | Webhook Shopify |
| FR9 | Epic 3 | Algorithme d'attribution |
| FR10 | Epic 5 | Dashboard bons de livraison |
| FR11 | Epic 5 | Filtres basiques |
| FR12 | Epic 5 | Détails popup |
| FR13 | Epic 5 | Notifications multi-canal |
| FR14 | Epic 3 | Gestion des statuts |
| FR15 | Epic 6 | Widget WhatsApp |
| FR16 | Epic 6 | Configuration widget |
| FR17 | Epic 1 | Essai 7 jours |
| FR18 | Epic 1 | Plans tiered |
| FR19 | Epic 1 | Shopify Billing API |
| FR20 | Epic 1 | Isolation multi-tenant |

## Epic List

### Epic 1 : Installation & Configuration de Base
Le marchand peut installer l'app depuis le Shopify App Store, compléter l'onboarding, et accéder au dashboard admin de base avec facturation active et isolation multi-tenant.
**FRs couvertes :** FR1, FR17, FR18, FR19, FR20

### Epic 2 : Gestion des Livreurs
Le marchand peut créer, modifier et supprimer des livreurs, leur assigner un pays/ville parmi les 54 pays africains et un rôle (Livreur, Service Client, Les deux).
**FRs couvertes :** FR2, FR3, FR4

### Epic 3 : Réception & Attribution des Commandes
Les commandes Shopify sont automatiquement reçues via webhook sécurisé (HMAC) et attribuées au livreur le moins chargé selon le pays/ville du client, avec gestion complète des statuts de livraison.
**FRs couvertes :** FR8, FR9, FR14

### Epic 4 : Notifications Telegram & Actions Livreur
Les livreurs reçoivent les notifications de nouvelles commandes via bot Telegram avec messages riches (image produit, détails client, adresse) et peuvent mettre à jour le statut via boutons inline (Pris en charge, Livré, Non livré).
**FRs couvertes :** FR5, FR6, FR7

### Epic 5 : Dashboard Admin & Suivi des Livraisons
Le marchand peut suivre tous les bons de livraison depuis le dashboard admin, filtrer par statut/date/livreur, voir les détails complets en popup, et recevoir des notifications multi-canal (Dashboard + Email).
**FRs couvertes :** FR10, FR11, FR12, FR13

### Epic 6 : Widget WhatsApp
Les visiteurs de la boutique Shopify peuvent contacter le service client via un widget WhatsApp injecté automatiquement par Theme Extension, configurable par pays et contacts à la volée.
**FRs couvertes :** FR15, FR16

---

## Epic 1 : Installation & Configuration de Base

Le marchand peut installer l'app depuis le Shopify App Store, compléter l'onboarding, et accéder au dashboard admin de base avec facturation active et isolation multi-tenant.

### Story 1.1 : Initialisation du Projet avec Shopify CLI Remix

As a développeur,
I want initialiser le projet avec le starter template Shopify CLI Remix (TypeScript, Prisma, Polaris),
So that la base technique est prête avec OAuth, session management, et le schéma Prisma de base.

**Acceptance Criteria:**

**Given** le starter template Shopify CLI Remix est disponible
**When** le projet est initialisé avec `shopify app init`
**Then** l'application démarre localement avec TypeScript, Prisma et Polaris configurés
**And** le flow OAuth Shopify fonctionne (installation et authentification)
**And** le schéma Prisma inclut le modèle `Session` fourni par le starter
**And** la configuration Docker Compose est créée (app, postgres, redis, caddy)
**And** le fichier `.env` contient les variables d'environnement nécessaires (SHOPIFY_API_KEY, SHOPIFY_API_SECRET, DATABASE_URL, REDIS_URL)

### Story 1.2 : Schéma de Base et Isolation Multi-Tenant

As a marchand Shopify,
I want que mes données soient isolées des autres marchands,
So that la sécurité et la confidentialité de mes données sont garanties.

**Acceptance Criteria:**

**Given** le projet est initialisé avec Prisma
**When** le schéma de base est créé
**Then** le modèle `Shop` est créé avec les champs : id, domain (unique), name, plan, accessToken, isActive, createdAt, updatedAt
**And** `shop_id` est défini comme clé de partitionnement pour l'isolation multi-tenant
**And** les migrations Prisma s'exécutent correctement
**And** un middleware d'authentification vérifie le `shop_id` sur chaque requête
**And** aucune donnée d'un shop n'est accessible par un autre shop

### Story 1.3 : Plans d'Abonnement et Facturation Shopify Billing

As a marchand Shopify,
I want choisir un plan d'abonnement (Basique, Gold, Pro) avec un essai gratuit de 7 jours,
So that je peux commencer à utiliser l'app gratuitement puis payer selon mes besoins.

**Acceptance Criteria:**

**Given** le marchand installe l'app pour la première fois
**When** l'onboarding est lancé
**Then** les 3 plans sont proposés : Basique (2 livreurs), Gold (5 livreurs), Pro (10 livreurs)
**And** chaque plan inclut un essai gratuit de 7 jours
**And** la facturation est gérée via Shopify Billing API (`recurringApplicationCharge`)
**And** le plan choisi est enregistré dans le modèle `Shop` (champ `plan`)
**And** si le marchand n'a pas de plan actif, il est redirigé vers la page de sélection de plan

### Story 1.4 : Page d'Accueil Dashboard Admin

As a marchand Shopify,
I want accéder à un dashboard admin dans mon interface Shopify,
So that j'ai un point d'entrée centralisé pour gérer mes livraisons.

**Acceptance Criteria:**

**Given** le marchand est authentifié et a un plan actif
**When** il accède à l'application
**Then** la page d'accueil du dashboard s'affiche dans l'iframe Shopify Admin avec Polaris
**And** la navigation principale est visible (Accueil, Livreurs, Bons de livraison, Widget WhatsApp, Paramètres)
**And** la page affiche un résumé de base (nombre de livreurs actifs, nombre de bons en cours)
**And** l'app utilise App Bridge pour l'intégration Shopify Admin
**And** un health check endpoint `/api/health` est disponible et retourne le statut de l'app

---

## Epic 2 : Gestion des Livreurs

Le marchand peut créer, modifier et supprimer des livreurs, leur assigner un pays/ville parmi les 54 pays africains et un rôle (Livreur, Service Client, Les deux).

### Story 2.1 : Création d'un Livreur avec Pays/Ville et Rôle

As a marchand Shopify,
I want créer un livreur en renseignant son nom, téléphone, pays, ville et rôle,
So that j'ai un livreur prêt à recevoir des commandes dans sa zone géographique.

**Acceptance Criteria:**

**Given** le marchand est authentifié et a un plan actif
**When** il accède à la page "Livreurs" et clique sur "Ajouter un livreur"
**Then** un formulaire Polaris s'affiche avec les champs : nom, téléphone, pays (sélection parmi 54 pays africains), ville (optionnel), rôle (Livreur/Service Client/Les deux), Telegram User ID (optionnel)
**And** le modèle Prisma `DeliveryAgent` est créé avec les champs : id, shopId, name, phone, country, city, role (enum COURIER/SUPPORT/BOTH), telegramUserId, isActive, createdAt, updatedAt
**And** la liste des 54 pays africains est disponible en données de référence
**And** le livreur créé est isolé par `shop_id`
**And** le nombre de livreurs est limité selon le plan actif (Basique: 2, Gold: 5, Pro: 10)
**And** un message d'erreur s'affiche si la limite du plan est atteinte

### Story 2.2 : Liste et Modification des Livreurs

As a marchand Shopify,
I want voir la liste de mes livreurs et modifier leurs informations,
So that je peux maintenir mon équipe de livraison à jour.

**Acceptance Criteria:**

**Given** le marchand a au moins un livreur créé
**When** il accède à la page "Livreurs"
**Then** une liste Polaris affiche tous les livreurs actifs avec : nom, téléphone, pays, ville, rôle, statut
**And** il peut cliquer sur un livreur pour modifier ses informations (nom, téléphone, pays, ville, rôle, Telegram User ID)
**And** les modifications sont sauvegardées et un toast de confirmation s'affiche
**And** seuls les livreurs du shop courant sont affichés (isolation `shop_id`)

### Story 2.3 : Désactivation et Suppression des Livreurs

As a marchand Shopify,
I want désactiver ou supprimer un livreur,
So that je peux gérer les départs et les changements dans mon équipe.

**Acceptance Criteria:**

**Given** le marchand a au moins un livreur créé
**When** il sélectionne un livreur et choisit "Désactiver" ou "Supprimer"
**Then** la désactivation met `isActive` à `false` et le livreur n'apparaît plus dans les attributions
**And** la suppression est une suppression logique (soft delete via `isActive = false`) si le livreur a des bons de livraison associés
**And** la suppression est définitive si le livreur n'a aucun bon de livraison
**And** une confirmation est demandée avant toute suppression/désactivation
**And** un toast de confirmation s'affiche après l'action

---

## Epic 3 : Réception & Attribution des Commandes

Les commandes Shopify sont automatiquement reçues via webhook sécurisé (HMAC) et attribuées au livreur le moins chargé selon le pays/ville du client, avec gestion complète des statuts de livraison.

### Story 3.1 : Réception des Commandes via Webhook Shopify

As a marchand Shopify,
I want que les nouvelles commandes soient automatiquement reçues par l'application,
So that je n'ai pas besoin de saisir manuellement chaque commande.

**Acceptance Criteria:**

**Given** l'app est installée et les scopes `read_orders`, `read_customers` sont actifs
**When** une nouvelle commande est créée dans Shopify
**Then** le webhook `orders/create` est reçu par l'endpoint `/api/webhooks`
**And** la signature HMAC du webhook est vérifiée pour la sécurité
**And** le modèle Prisma `DeliveryBill` est créé avec : id, shopId, orderId (unique), orderName, customerName, customerAddress, customerPhone, productTitle, productImage, productQuantity, status (PENDING), createdAt, updatedAt
**And** l'idempotency est garantie via la contrainte `orderId @unique` (les doublons sont ignorés)
**And** le webhook retourne un statut 200 rapidement pour éviter les retry Shopify

### Story 3.2 : Algorithme d'Attribution Automatique

As a marchand Shopify,
I want que chaque commande soit automatiquement attribuée au livreur le plus approprié,
So that la distribution des livraisons est équitable et géographiquement cohérente.

**Acceptance Criteria:**

**Given** une nouvelle commande est reçue avec l'adresse du client
**When** l'algorithme d'attribution s'exécute
**Then** le pays du client est extrait de l'adresse de livraison
**And** les livreurs actifs du même pays sont identifiés
**And** si des livreurs de la même ville existent, ils sont priorisés
**And** parmi les livreurs éligibles, celui avec le moins de bons en cours (statut != DELIVERED/NOT_DELIVERED/CANCELLED) est sélectionné
**And** le `assignedAgentId` du bon est mis à jour avec le livreur sélectionné
**And** le statut du bon passe de PENDING à ASSIGNED
**And** si aucun livreur n'est trouvé, le bon reste en PENDING et le marchand est notifié

### Story 3.3 : Gestion des Statuts de Livraison

As a marchand Shopify,
I want suivre l'évolution du statut de chaque livraison,
So that je sais exactement où en est chaque commande.

**Acceptance Criteria:**

**Given** un bon de livraison existe dans le système
**When** le statut est mis à jour
**Then** les transitions de statut suivent le workflow : PENDING → ASSIGNED → IN_PROGRESS → DELIVERED ou NOT_DELIVERED
**And** chaque changement de statut est horodaté dans `statusHistory` (champ JSON)
**And** le statut CANCELLED est disponible à tout moment
**And** les transitions invalides sont rejetées (ex: DELIVERED → PENDING)
**And** l'index `[shopId, status]` permet des requêtes performantes par statut

### Story 3.4 : Enregistrement du Webhook Shopify

As a développeur,
I want que le webhook `orders/create` soit automatiquement enregistré lors de l'installation,
So that l'app reçoit les commandes dès son activation.

**Acceptance Criteria:**

**Given** le marchand installe l'application
**When** le flow OAuth est complété
**Then** le webhook `orders/create` est enregistré via l'API Shopify avec l'URL de callback
**And** les scopes nécessaires (`read_orders`, `read_products`, `read_customers`, `read_all_orders`) sont vérifiés
**And** si le webhook existe déjà, il n'est pas dupliqué
**And** un log Winston confirme l'enregistrement réussi du webhook

---

## Epic 4 : Notifications Telegram & Actions Livreur

Les livreurs reçoivent les notifications de nouvelles commandes via bot Telegram avec messages riches (image produit, détails client, adresse) et peuvent mettre à jour le statut via boutons inline (Pris en charge, Livré, Non livré).

### Story 4.1 : Configuration du Bot Telegram et Envoi de Notifications

As a livreur,
I want recevoir une notification Telegram quand une commande m'est attribuée,
So that je suis informé immédiatement d'une nouvelle livraison à effectuer.

**Acceptance Criteria:**

**Given** un livreur a un `telegramUserId` configuré et une commande lui est attribuée
**When** le statut du bon passe à ASSIGNED
**Then** un job BullMQ est créé dans la queue `telegram-notifications`
**And** le bot Telegram envoie un message au livreur avec les détails : nom du client, adresse, téléphone, produit, quantité
**And** si le produit a une image (`productImage`), elle est incluse dans le message
**And** la notification est envoyée en moins de 30 secondes (NFR1)
**And** le rate limiting respecte la limite de 30 msgs/s avec backoff exponentiel
**And** le champ `telegramNotified` est mis à `true` et `telegramMessageId` est sauvegardé
**And** si le livreur n'a pas de `telegramUserId`, aucune notification n'est envoyée et un log est créé

### Story 4.2 : Boutons Inline Telegram pour Actions Rapides

As a livreur,
I want mettre à jour le statut de livraison directement depuis Telegram,
So that je peux signaler l'avancement sans quitter mon application de messagerie.

**Acceptance Criteria:**

**Given** le livreur a reçu une notification Telegram pour un bon
**When** le message est affiché
**Then** trois boutons inline sont disponibles : "Pris en charge", "Livré", "Non livré"
**And** cliquer "Pris en charge" met le statut à IN_PROGRESS
**And** cliquer "Livré" met le statut à DELIVERED
**And** cliquer "Non livré" met le statut à NOT_DELIVERED
**And** après un clic, le message est mis à jour pour refléter le nouveau statut
**And** les boutons déjà utilisés sont retirés ou désactivés
**And** le callback_query Telegram est traité via un endpoint webhook `/api/telegram/callback`

### Story 4.3 : Configuration du Bot Telegram par le Marchand

As a marchand Shopify,
I want configurer mon bot Telegram (token) dans les paramètres de l'app,
So that les notifications sont envoyées via mon propre bot.

**Acceptance Criteria:**

**Given** le marchand accède à la page "Paramètres"
**When** il saisit le token de son bot Telegram
**Then** le token est sauvegardé de manière sécurisée dans le modèle `Shop` (champ `telegramBotToken`)
**And** un test de connexion est effectué pour valider le token (appel `getMe` sur l'API Telegram)
**And** un message de confirmation ou d'erreur s'affiche selon le résultat
**And** le webhook Telegram est configuré automatiquement pour recevoir les callbacks
**And** le token est isolé par `shop_id`

---

## Epic 5 : Dashboard Admin & Suivi des Livraisons

*(Stories à détailler ultérieurement)*

---

## Epic 6 : Widget WhatsApp

Les visiteurs de la boutique Shopify peuvent contacter le service client via un widget WhatsApp injecté automatiquement, configurable par pays et contacts à la volée.

### Story 6.1 : Page de Configuration Widget WhatsApp (Admin)

As a marchand Shopify,
I want configurer le widget WhatsApp depuis mon interface admin,
So that je contrôle quels contacts sont visibles pour les visiteurs de ma boutique.

**Acceptance Criteria:**

**Given** le marchand est authentifié et accède à la page "Widget WhatsApp"
**When** la page se charge
**Then** un formulaire Polaris s'affiche avec :
- Un toggle global pour activer/désactiver le widget sur la boutique
- Un numéro WhatsApp principal (champ téléphone avec indicatif pays)
- Un message par défaut personnalisable
- Une section "Contacts par pays" listant les livreurs/service client existants (issus du modèle `DeliveryAgent`) groupés par pays
- Des checkboxes pour sélectionner quels contacts apparaissent dans le widget
**And** seuls les agents avec le rôle `SUPPORT` ou `BOTH` sont proposés par défaut, mais les `COURIER` peuvent aussi être sélectionnés manuellement
**And** les modifications sont sauvegardées via l'action du formulaire (Remix action)
**And** un toast de confirmation s'affiche après la sauvegarde
**And** la configuration est isolée par `shop_id`

### Story 6.2 : Injection Automatique du Widget sur la Boutique

As a marchand Shopify,
I want que le widget soit injecté automatiquement sur ma boutique quand je l'active,
So that je n'ai pas besoin de toucher au code de mon thème.

**Acceptance Criteria:**

**Given** le marchand active le toggle du widget dans la page de configuration
**When** il clique sur "Activer le widget automatiquement"
**Then** un ScriptTag est créé via l'API Shopify REST (`POST /admin/api/script_tags.json`) pointant vers l'endpoint `/api/widget-script?shop={domain}`
**And** le champ `widgetEnabled` du modèle `Shop` est mis à `true`
**And** un toast de confirmation s'affiche : "Widget activé sur votre boutique"
**And** si le widget est déjà activé, le bouton affiche "Désactiver le widget" et supprime le ScriptTag
**And** l'endpoint `/api/widget-script` retourne le JavaScript du widget avec la configuration dynamique du shop (contacts, pays, message)
**And** le widget se charge en moins de 2 secondes (NFR3)
**And** en cas d'erreur API (ex: scope manquant), un banner d'erreur explicite s'affiche

### Story 6.3 : Widget Frontend — Bouton Flottant et Sélection Pays

As a visiteur de la boutique,
I want voir un bouton WhatsApp flottant et sélectionner mon pays,
So that je puisse contacter quelqu'un de ma zone géographique.

**Acceptance Criteria:**

**Given** le widget est activé sur la boutique et le script est chargé
**When** la page se charge (n'importe quelle page de la boutique)
**Then** un bouton flottant vert WhatsApp apparaît en bas à droite de la page
**And** le bouton est responsive (adapté mobile et desktop)
**And** au clic sur le bouton, un panneau s'ouvre affichant la liste des pays disponibles (ceux qui ont au moins un contact sélectionné)
**And** chaque pays est affiché avec son drapeau emoji et son nom (ex: 🇹🇬 Togo, 🇨🇮 Côte d'Ivoire)
**And** si un seul pays est configuré, le panneau saute l'étape de sélection pays et affiche directement les contacts
**And** un bouton "✕" permet de fermer le panneau
**And** le panneau ne bloque pas la navigation sur le site

### Story 6.4 : Widget Frontend — Liste des Contacts et Ouverture WhatsApp

As a visiteur de la boutique,
I want voir les contacts disponibles dans mon pays et les contacter via WhatsApp,
So that je puisse poser mes questions à un humain local.

**Acceptance Criteria:**

**Given** le visiteur a sélectionné un pays (ou le pays unique a été auto-sélectionné)
**When** la liste des contacts s'affiche
**Then** chaque contact est affiché avec : nom, ville (si renseignée), rôle (badge "Livreur" ou "Service Client")
**And** au clic sur un contact, WhatsApp s'ouvre (via `https://wa.me/{numéro}?text={message}`)
**And** le message pré-rempli contient :
  - Le nom du shop
  - L'URL de la page courante où se trouve le visiteur (pas uniquement les pages produits — toute page du site)
  - Le message par défaut configuré par le marchand
  - Format : `Bonjour, je vous contacte depuis {shopName} ({currentPageUrl}). {defaultMessage}`
**And** sur mobile, WhatsApp app s'ouvre directement ; sur desktop, WhatsApp Web s'ouvre dans un nouvel onglet
**And** un bouton "← Retour" permet de revenir à la sélection pays
**And** si aucun contact n'est disponible pour le pays, un message "Aucun contact disponible pour ce pays" s'affiche avec le numéro WhatsApp principal comme fallback

### Story 6.5 : Endpoint API Widget Script Dynamique

As a développeur,
I want que l'endpoint `/api/widget-script` retourne un script JavaScript dynamique basé sur la configuration du shop,
So that le widget affiche les bons contacts et la bonne configuration pour chaque boutique.

**Acceptance Criteria:**

**Given** le ScriptTag pointe vers `/api/widget-script?shop={domain}`
**When** le navigateur du visiteur charge le script
**Then** l'endpoint retourne du JavaScript (Content-Type: `application/javascript`)
**And** le script contient la configuration embarquée : liste des contacts par pays (nom, ville, rôle, numéro WhatsApp), message par défaut, nom du shop
**And** le script injecte le DOM du widget (bouton flottant + panneau) dans la page
**And** le script capture `window.location.href` pour le message pré-rempli
**And** les données sensibles ne sont PAS exposées (pas de tokens, pas d'IDs internes — uniquement nom, ville, rôle, numéro WhatsApp)
**And** le script est mis en cache côté navigateur (Cache-Control) avec un TTL raisonnable (ex: 5 minutes)
**And** si le shop n'est pas trouvé ou le widget est désactivé, le script retourne un commentaire vide (pas d'erreur visible)
