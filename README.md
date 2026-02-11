# Shopify Logistics SaaS

Une application Shopify SaaS pour la gestion logistique des livreurs avec notifications Telegram interactives et widget WhatsApp intelligent.

## 🚀 Features

- **Gestion des Livreurs** (CRUD multi-tenant)
- **Notifications Telegram Interactives**
- **Webhook Shopify & Attribution automatique**
- **Dashboard Admin Shopify** avec Polaris Design System
- **Widget WhatsApp Frontend**
- **Facturation & Abonnements**

## 🏗️ Stack Technique

- **Frontend**: Remix (React) + TypeScript + Polaris
- **Backend**: Node.js + API routes
- **Database**: PostgreSQL via Prisma ORM
- **Cache**: Redis pour les queues et le cache
- **Infrastructure**: Docker Compose
- **Reverse Proxy**: Caddy avec HTTPS automatique

## 📁 Structure du Projet

```
shopify-logistics-app/
├── app/                    # Application Remix
│   ├── routes/             # Routes (loaders + actions)
│   ├── components/         # Composants React
│   ├── lib/                # Utilitaires
│   └── services/           # Services métier
├── prisma/                # Schéma de base de données
├── public/                 # Fichiers statiques
├── tests/                 # Tests
├── .env.example           # Variables d'environnement
├── docker-compose.yml     # Configuration Docker
├── Dockerfile            # Build Docker
└── Caddyfile            # Configuration Caddy
```

## 🚀 Installation

1. Cloner le repository
2. Copier `.env.example` en `.env` et configurer
3. Lancer les services:
   ```bash
   docker-compose up -d
   ```

## 🔧 Configuration

### Variables d'environnement

Voir `.env.example` pour la liste complète des variables requises.

### Shopify App

1. Créer une application Shopify dans le Shopify Partners Dashboard
2. Configurer les OAuth scopes:
   - `read_orders`
   - `write_products`
   - `read_products`
   - `read_customers`
   - `read_all_orders`

## 📊 CI/CD

Le déploiement est automatisé via GitHub Actions:

- **Push sur `main`**: Déploiement en production
- **Push sur `dev`**: Déploiement en staging

## 🛡️ Sécurité

- Multi-tenancy par `shop_id`
- Authentification OAuth 2.0 Shopify
- Vérification des webhooks HMAC
- Protection contre les injections

## 📈 Monitoring

- Health checks disponibles à `/api/health`
- Logs avec Winston
- Monitoring des containers Docker

## 📝 License

SEE LICENSE IN LICENSE.md