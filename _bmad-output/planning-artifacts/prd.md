---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping"]
inputDocuments: ["product-brief-Shopify Saas (individual)-2026-02-08.md"]
workflowType: 'prd'
briefCount: 1
researchCount: 0
brainstormingCount: 0
projectDocsCount: 0
classification:
  projectType: SaaS Web App with Platform Integration
  domain: E-commerce Logistics & Delivery Management
  complexity: Moyenne - Élevée
  projectContext: Greenfield
---

# Product Requirements Document - Shopify Saas (individual)

**Author:** Angel
**Date:** 2026-02-08

<!-- Content will be appended sequentially through collaborative PRD workflow -->

---

## Success Criteria

### User Success

#### Pour le Propriétaire de Boutique

| Métrique | Description | Cible |
|----------|-------------|-------|
| **Visibilité des commandes** | % de commandes avec statut mis à jour | >90% |
| **Temps gagné** | Réduction du temps de suivi manuel | -50% |
| **Taux de réponse livreurs** | % de commandes avec action dans les 2h | >80% |
| **Contrôle & Traçabilité** | Accès immédiat à l'état de toutes les commandes | 100% |
| **Satisfaction** | "Cette app vaut le coût" (NPS) | >50 |

#### Pour le Livreur

| Métrique | Description | Cible |
|----------|-------------|-------|
| **Adoption Telegram** | % de livreurs qui connectent leur Telegram | >95% |
| **Utilisation boutons** | % de mises à jour via boutons (vs manuel) | >85% |
| **Réactivité** | Temps moyen pour "Prise en charge" | <30 min |
| **Rétention** | % de livreurs actifs après 30 jours | >80% |

---

### Business Success

#### À 3 mois (Lancement MVP)

| Objectif | Métrique | Cible |
|----------|----------|-------|
| **Acquisition** | Magasins installés | 50 boutiques |
| **Activation** | % qui ajoutent ≥2 livreurs | >70% |
| **Engagement** | Magasins avec ≥1 commande/sem | >60% |
| **Conversion** | Essai → Payant (après 7j) | >25% |

#### À 12 mois

| Objectif | Métrique | Cible |
|----------|----------|-------|
| **Croissance** | Magasins actifs | 500+ boutiques |
| **Revenus** | MRR (Monthly Recurring Revenue) | $5,000+ |
| **Rétention** | Taux de rétention mensuel | >85% |
| **Satisfaction** | Note App Store | >4.5/5 |

---

### Technical Success

| Métrique | Description | Cible |
|----------|-------------|-------|
| **Uptime API** | Disponibilité du backend | >99.5% |
| **Latence notifications** | Temps entre commande Shopify et notification Telegram | <30s |
| **Taux de réussite webhook** | Webhooks Shopify traités avec succès | >99% |
| **Performance widget** | Temps de chargement du widget | <2s |
| **Intégration Shopify** | Approval App Store | ✅ Validé |

---

### Measurable Outcomes

| Outcome | Métrique | Horizon |
|---------|----------|---------|
| **Première notif envoyée** | % propriétaires avec 1ère notif <24h | Jours 1-7 |
| **Premier clic livreur** | % livreurs qui cliquent sur un bouton | Jours 1-30 |
| **Premier widget utilisé** | % boutiques avec widget utilisé par visiteur | Jours 1-30 |
| **Upgrade payant** | % Essai → Payant (après 7j) | Jours 7-30 |
| **100 commandes traitées** | Volume total via l'app | Mois 1-3 |

---

## Product Scope

### MVP - Minimum Viable Product

| Module | Features Core |
|--------|---------------|
| **Installation & Config** | One-click install, Onboarding, Gestion livreurs (CRUD), Base pays africains |
| **Notifications Telegram** | Bot, Message avec détails, Boutons inline, Lien d'invitation |
| **Dashboard Admin** | Liste bons, Filtres, Détails popup, Notifications multi-canal |
| **Webhook & Attribution** | Réception commandes, Algorithme attribution, Gestion statuts |
| **Widget WhatsApp** | Injection auto, Configuration à la volée, Bouton flottant, Sélection pays/contacts |
| **Facturation** | Essai 7j, Plans tiered, Shopify Billing |

### Growth Features (Post-MVP)

| Feature | Description |
|---------|-------------|
| **Assignation manuelle** | Override de l'auto-attribution |
| **Analytics avancés** | Performance livreurs, rapports détaillés |
| **Preuve de livraison** | Photos, signatures |
| **WebSocket temps réel** | Updates instantanés |
| **Multi-boutiques** | Pour grandes entreprises |

### Vision (Future)

- Plateforme logistique pan-africaine
- API ouverte pour intégrations
- Application mobile livreur
- Expansion (WooCommerce, PrestaShop)
- Module de paiement à la livraison

---

## User Journeys

### Journey 1 : Kouamé Alexandre - Le Propriétaire qui Reprend le Contrôle

**📖 Opening Scene**

Kouamé, 32 ans, gère sa boutique e-commerce depuis Abidjan. Il a 5 livreurs indépendants qu'il contacte via WhatsApp personnel. **Le problème** : après avoir envoyé une commande, il est dans le flou total. Le livreur a-t-il reçu ? Est-ce qu'il va livrer ? Ses clients se plaignent du manque d'infos. Il passe des heures à envoyer des messages "Tu as livré ?" sur WhatsApp.

**Son objectif** : Reprendre le contrôle sur sa logistique sans y passer sa journée.

**📈 Rising Action**

1. **Découverte** : Il tombe sur l'app dans le Shopify App Store
2. **Installation** : One-click install, onboarding rapide
3. **Configuration** : Ajoute ses 5 livreurs avec leurs pays/villes
4. **Test** : Sa première commande arrive - notification instantanée
5. **Surprise** : Il voit Idrissa cliquer sur "Pris en charge" en temps réel

**🎯 Climax (Le Moment Aha !)**

> *"Enfin, je vois exactement où en est chaque commande. Je sais quels livreurs sont fiables. Je peux informer mes clients sans attendre. Je reprends le contrôle de mon business !"*

---

### Journey 2 : Idrissa - Le Livreur qui Gagne en Efficacité

**📖 Opening Scene**

Idrissa, 27 ans, livreur pour 3-4 boutiques d'e-commerce. **Le problème** : ses Telegram et WhatsApp sont un chaos. Notifications de partout, formats différents, il oublie des commandes. Parfois il double-livre la même commande par erreur.

**Son objectif** : Une interface claire, des actions rapides, ne rien oublier.

**📈 Rising Action**

1. **Invitation** : Kouamé lui envoie un lien pour connecter son Telegram
2. **Configuration** : Il scanne le QR code du bot, c'est connecté
3. **Première notification** : Une commande arrive avec tous les détails (image, client, adresse)
4. **Action** : Il clique sur "Pris en charge" - 1 seconde, c'est fait !
5. **Livraison** : Après avoir livré, il clique "Livré"

**🎯 Climax (Le Moment Aha !)**

> *"C'est clean ! Je reçois tout au même endroit, je clique sur des boutons, et le marchand est informé direct. Plus besoin d'envoyer des photos sur WhatsApp. Je gagne du temps et je fais moins d'erreurs !"*

---

### Journey 3 : Fatou - La Service Client qui Comprend le Contexte

**📖 Opening Scene**

Fatou, 24 ans, service client pour une boutique. **Le problème** : les clients lui écrivent sans contexte. "Je veux des infos sur ce produit" - mais lequel ? Elle doit demander "Quel produit ? Quelle page ?" à chaque fois.

**Son objectif** : Recevoir des messages avec contexte pour répondre rapidement.

**📈 Rising Action**

1. **Configuration** : Le propriétaire l'ajoute comme "Service Client uniquement"
2. **Widget** : Elle apparaît dans le widget WhatsApp avec son tag
3. **Premier message** : Un client clique sur son nom depuis la page produit
4. **Contexte** : Le message contient déjà le lien de la page courante (produit, collection, FAQ, etc.) et le nom du shop

**🎯 Climax (Le Moment Aha !)**

> *"Enfin ! Je sais tout de suite sur quel produit le client s'interesse. Le lien est là, le nom du shop aussi. Je peux répondre immédiatement sans jouer aux 20 questions !"*

---

### Journey 4 : Awa - La Visiteur qui Trouve Confiance Locale

**📖 Opening Scene**

Awa, 29 ans, visite une boutique e-commerce basée au Togo. **Le problème** : elle a des questions avant d'acheter, mais veut parler à quelqu'un de son pays, pas un bot anonyme.

**Son objectif** : Contacter un humain local en français pour avoir confiance.

**📈 Rising Action**

1. **Navigation** : Elle parcourt la boutique, hésite sur un produit
2. **Bouton flottant** : Elle voit le bouton WhatsApp vert
3. **Sélection pays** : Elle clique sur 🇹🇬 Togo
4. **Liste contacts** : Elle voit "Kofi - Livreur Lomé" et "Méma - Service Client"
5. **Action** : Elle clique sur Kofi
6. **WhatsApp** : Le message s'ouvre déjà écrit avec le lien de la page courante et le nom du shop

**🎯 Climax (Le Moment Aha !)**

> *"Génial ! Je parle à quelqu'un de mon pays, en français. Il a déjà le lien du produit dans le message. Je pose ma question et je commande en confiance !"*

---

### Journey 5 : Kouamé - Edge Case (Gestion des Non-Livrés)

**📖 Opening Scene**

Kouamé reçoit une notification : "Commande #1234 - Non livré". Un client n'a pas reçu son colis.

**📈 Rising Action**

1. **Notification** : Il reçoit l'alerte sur son dashboard + Telegram + Email
2. **Détails** : Il clique pour voir le motif "Client absent" + preuve photo
3. **Action** : Il contacte le client ou reprogramme la livraison

**🎯 Résolution** : Il a la traçabilité complète pour gérer les litiges.

---

### Journey Requirements Summary

Les journeys révèlent les besoins suivants :

| Capability | Requis |
|------------|--------|
| **Onboarding fluide** | Installation, configuration livreurs, test |
| **Notifications multi-canal** | Dashboard + Telegram + Email |
| **Boutons d'action rapides** | Inline keyboard Telegram (1 clic) |
| **Widget intelligent** | Sélection pays, liste contacts, message pré-rempli (lien page courante + nom shop) |
| **Traçabilité complète** | Historique, détails, preuves |
| **Gestion des rôles** | Livreur vs Service Client (différentes notifications) |
| **Gestion des erreurs** | Non-livraison, récupération, reprise |

---

## Innovation & Novel Patterns

### Innovation Areas

| Innovation | Description | Pourquoi c'est unique |
|------------|-------------|------------------------|
| **Notifications Telegram interactives** | Boutons inline pour mise à jour statut en 1 clic | Aucune app Shopify existante n'offre cette interaction |
| **Attribution équitable multi-critères** | Pays → Ville → Charge équilibrée | Les apps existantes attribuent manuellement ou sans algorithme |
| **Widget WhatsApp intelligent par pays** | Sélection pays + contacts + message pré-rempli | Les apps WhatsApp existantes sont génériques |
| **Focus marché africain** | Base de données 54 pays + villes | Les apps existantes visent US/Europe |
| **Modèle hybride Livreur/Service Client** | Distinction des rôles avec notifications différentes | Approche unique pour gérer les deux types d'acteurs |

### Market Context

Selon notre recherche concurrentielle :
- **7+ apps** de livraison locale existent sur Shopify
- **4+ apps** de notifications Telegram existent
- **6+ apps** de widget WhatsApp existent
- **Mais AUCUNE** ne combine ces 3 fonctionnalités avec un focus Afrique

### Validation Approach

| Aspect | Méthode |
|--------|---------|
| **Utilité** | Test MVP avec 10 boutiques ciblées |
| **Adoption** | Mesure taux de connexion Telegram des livreurs |
| **Rétention** | Suivi des upgrades après essai 7j |
| **Feedback** | NPS après 30 jours d'utilisation |

### Risk Mitigation

| Risque | Mitigation |
|--------|------------|
| **Adoption Telegram** | Onboarding simple, lien QR direct |
| **Complexité attribution** | Algorithme simple pour MVP, affichage du livreur assigné |
| **Compétition** | Focus Afrique = barrière à l'entrée |
| **Évolutivité** | Architecture modulaire pour ajouter features post-MVP |

---

## SaaS B2B Specific Requirements

### Tenant Model
- Isolation complète par `shop_id` Shopify
- Configuration indépendante par boutique
- Base de données multi-tenant avec `shop_id` comme clé de partitionnement

### RBAC Matrix

| Rôle | Permissions |
|------|-------------|
| **Propriétaire (Admin Shop)** | CRUD livreurs, voir tous les bons, configurer widget |
| **Livreur** | Voir ses commandes, mettre à jour statut (boutons Telegram) |
| **Service Client** | Apparaître dans widget, ne PAS recevoir notifs commandes |

### Integration List

| Intégration | Purpose |
|-------------|---------|
| **Shopify Admin API** | Webhooks commandes, gestion app |
| **Shopify Billing API** | Facturation récurrente |
| **Telegram Bot API** | Notifications + boutons inline |
| **Email (SMTP)** | Notifications propriétaire |

### Compliance Requirements

- **GDPR** : Consentement, droit à l'oubli pour les livreurs
- **Shopify App Requirements** : Privacy Policy, Terms of Service, Support contact
- **Données clients** : Nom, adresse, téléphone (conservation sécurisée)

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

| Aspect | Décision |
|--------|----------|
| **MVP Approach** | Problem-Solving MVP - Résoudre le problème central |
| **Resource Requirements** | 1 Full-stack dev + 1 part-time UI/UX (ou full-stack solo) |
| **Timeline Target** | 8-12 semaines pour MVP |
| **Success Gate** | 10 boutiques actives, 50 livreurs connectés |

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1 : Propriétaire - Installation, Configuration, Réception notifs
- Journey 2 : Livreur - Connexion Telegram, Réception commande, Actions boutons
- Journey 5 : Edge Case - Gestion non-livrés

**Must-Have Capabilities:**

| Module | Features MVP |
|--------|--------------|
| **Installation** | One-click install, Onboarding simplifié |
| **Gestion Livreurs** | CRUD complet, Pays/Ville (base 54 pays), Types (Livreur/Service Client) |
| **Webhook Shopify** | Réception commandes, Déclenchement attribution |
| **Attribution** | Algorithme pays → ville → moins chargé |
| **Telegram Bot** | Notifications avec détails, Boutons inline (Pris en charge/Livré/Non livré) |
| **Dashboard** | Liste des bons, Filtres basiques, Détails popup |
| **Notifications Propriétaire** | Dashboard + Email |
| **Facturation** | Essai 7j, Plans tiered, Shopify Billing |

**NOT in MVP:**
- Widget WhatsApp frontend
- Notifications Telegram propriétaire
- Analytics
- Multi-boutiques

### Post-MVP Features

**Phase 2 (Growth - 3-6 mois):**

| Feature | Description |
|---------|-------------|
| **Widget WhatsApp** | Injection auto, Sélection pays/contacts |
| **Notif Telegram propriétaire** | Notifications dashboard + Telegram + Email |
| **Assignation manuelle** | Override de l'auto-attribution |
| **Analytics basiques** | Performance livreurs, Taux de livraison |
| **Filtres avancés** | Par date, livreur, statut, produit |

**Phase 3 (Expansion - 6-12 mois):**

| Feature | Description |
|---------|-------------|
| **Preuve de livraison** | Photos, signatures |
| **WebSocket temps réel** | Updates instantanés |
| **Analytics avancés** | Rapports détaillés, export |
| **Multi-boutiques** | Pour grandes entreprises |
| **Extension plateforme** | WooCommerce, PrestaShop |

### Risk Mitigation Strategy

**Technical Risks:**
| Risque | Mitigation |
|--------|------------|
| Complexité intégration Shopify | Utiliser Shopify CLI et boilerplates |
| Latence notifications Telegram | Queue système avec retry |
| Scalabilité widget | Architecture polling 60s, pas WebSocket |

**Market Risks:**
| Risque | Mitigation |
|--------|------------|
| Adoption Telegram par livreurs | Onboarding simple, QR code, guide visuel |
| Concurrence future | Focus Afrique = barrière à l'entrée |

**Resource Risks:**
| Risque | Mitigation |
|--------|------------|
| Solo dev overload | Priorisation stricte MVP, features nice-to-have post-MVP |
