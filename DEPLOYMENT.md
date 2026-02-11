# Documentation de Déploiement - Shopify Logistics SaaS

## 📋 Résumé

Ce document explique comment configurer et déployer l'application Shopify Logistics SaaS sur votre VPS Contabo.

## 🚀 Configuration Initiale

### 1. GitHub Repository

**URL du repository**: https://github.com/micha-dev87/shopify-logistics-app

**Branches**:
- `main` - Environnement de production
- `dev` - Environnement de staging

### 2. Configuration des Secrets GitHub

Ajoutez les secrets suivants dans votre repository GitHub (Settings > Secrets > Actions):

```bash
VPS_HOST=your-vps-ip
VPS_USER=root
VPS_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
... votre clé SSH ...
-----END OPENSSH PRIVATE KEY-----
```

### 3. Configuration du VPS

Le VPS doit déjà avoir:
- Docker et Docker Compose installés
- Les containers `postgres`, `redis`, et `caddy` en cours d'exécution
- Le réseau `app_network` créé

## 🔄 Processus de Déploiement

### Déploiement Automatique (Recommandé)

Le déploiement est automatisé via GitHub Actions:

1. **Push sur `main`**: Déploie en production
2. **Push sur `dev`**: Déploie en staging
3. **Manuel**: Via l'interface GitHub Actions

### Déploiement Manuel

Si besoin, vous pouvez déployer manuellement:

```bash
# Sur le VPS
cd /root/docker-stack-cyrus/shopify-logistics-app

# Construire l'image Docker
docker build -t shopify-logistics-app:latest .

# Sauvegarder l'image
docker save shopify-logistics-app:latest | gzip > shopify-logistics-app.tar.gz

# Copier sur le VPS (si fait depuis un autre serveur)
scp shopify-logistics-app.tar.gz user@vps:/root/docker-stack-cyrus/shopify-logistics-app/

# Sur le VPS
docker image load -i shopify-logistics-app.tar.gz
docker compose -f docker-compose.yml up -d app
```

## 📁 Structure du VPS

```
/root/docker-stack-cyrus/
├── shopify-logistics-app/
│   ├── docker-compose.yml    # Configuration Docker
│   ├── config/
│   │   └── Caddyfile       # Configuration reverse proxy
│   ├── logs/               # Logs de l'application
│   └── deploy.sh           # Script de déploiement
├── .env                    # Variables d'environnement
└── docker-compose.yml      # Configuration complète (postgres, redis, caddy)
```

## 🔧 Variables d'Environnement

### Fichier `/root/docker-stack-cyrus/.env`

```bash
# Database (postgres existant)
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Shopify
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret

# App
NODE_ENV=production
PORT=3000
```

### Fichier `.env` (pour le local)

Copiez `c:\Users\angel\OneDrive\Mes projets\Shopify Saas (individual)\shopify-logistics-app\.env.example` en `.env` et configurez les valeurs.

## 🌐 Configuration du Reverse Proxy

L'application est accessible via:
- **Port 3000**: Directement (développement)
- **Port 8080**: Via Caddy (production)

Pour configurer un domaine:

1. Mettre à jour le Caddyfile:
```bash
{
  "apps": {
    "http": {
      "servers": {
        "app": {
          "listen": [":80", ":443"],
          "routes": [
            {
              "match": [{"host": ["votre-domaine.com"]}],
              "handle": [
                {"handler": "reverse_proxy", "upstreams": [{"dial": "app:3000"}]}
              ]
            }
          ]
        }
      }
    }
  }
}
```

2. Redémarrer Caddy:
```bash
docker restart caddy
```

## 📊 Monitoring

### Health Checks

L'application expose un endpoint de health check:
```bash
curl http://localhost:3000/api/health
```

### Logs

```bash
# Logs de l'application
docker logs shopify-logistics-app-app -f

# Logs du reverse proxy
docker logs caddy-app -f

# Tous les logs
docker compose logs -f app
```

## 🔍 Dépannage

### Problèmes courants

1. **Image Docker introuvable**
   ```bash
   docker build -t shopify-logistics-app:latest .
   ```

2. **Container ne démarre pas**
   ```bash
   docker compose logs app
   docker compose restart app
   ```

3. **Problème de connexion à la base**
   - Vérifier que postgres est en cours d'exécution
   - Vérifier les variables d'environnement
   - Tester la connexion: `docker exec postgres psql -U postgres -d shopify_logistics`

4. **Problème de connexion à Redis**
   - Vérifier que redis est en cours d'exécution
   - Tester: `docker exec redis redis-cli ping`

### Redéploiement

```bash
# Forcer un redéploiement
docker compose down app
docker compose up -d app

# Avec reconstruction
docker compose build --no-cache app
docker compose up -d app
```

## 📈 Scaling

### Répliquer l'application

Pour gérer plus de charge:

```bash
# Créer plusieurs instances
docker compose up -d --scale app=3 app
```

### Mémoire

Vérifier l'utilisation de la mémoire:
```bash
docker stats
```

## 🛡️ Sécurité

1. **Mettre à jour régulièrement** les images Docker
2. **Utiliser des mots de passe forts** pour les bases de données
3. **Limiter l'accès** au port 3000 (firewall)
4. **Ne pas exposer** les variables sensibles dans les logs
5. **Sauvegarder régulièrement** la base de données

## 🔄 Sauvegardes

### Base de données

```bash
# Sauvegarde complète
docker exec postgres pg_dump -U postgres shopify_logistics > backup.sql

# Sauvegarde compressée
docker exec postgres pg_dump -U postgres shopify_logistics | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Configuration

Sauvegarder les fichiers de configuration:
```bash
tar -czf config-backup-$(date +%Y%m%d).tar.gz /root/docker-stack-cyrus
```

---

*Ce document doit être mis à jour à mesure que le projet évolue.*