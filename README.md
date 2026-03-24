# Transport API — Dakar Mobility 🇸🇳

API REST de transport multimodal pour **Dakar, Sénégal**. Fournit les données complètes des réseaux **BRT**, **TER** et **Dakar Dem Dikk** (stations, lignes, horaires, tarifs, zones) ainsi qu'un **moteur de routage Dijkstra** pour le calcul d'itinéraires multimodaux.

Fait partie de la plateforme **Dakar Mobility** :

- **Transport API** → réseaux de transport, stations, lignes, itinéraires (cette API)
- **Frontières API** → géographie administrative (régions, communes, localités)

---

## Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Réseaux de transport](#-réseaux-de-transport)
- [Données en base](#-données-en-base)
- [Schéma de la base](#️-schéma-de-la-base)
- [Stack technique](#️-stack-technique)
- [Installation](#-installation)
- [Configuration](#️-configuration)
- [Démarrage](#️-démarrage)
- [Endpoints API](#-endpoints-api)
- [Moteur de routage](#-moteur-de-routage)
- [Service de tarification](#-service-de-tarification)
- [Structure du projet](#️-structure-du-projet)
- [Docker](#-docker)
- [Tests](#-tests)

---

## 🚀 Fonctionnalités

- **3 réseaux de transport** — BRT (4 lignes), TER (1 ligne), Dakar Dem Dikk (44 lignes)
- **534 stations** géocodées avec coordonnées GPS et quartier
- **49 lignes** avec arrêts ordonnés, temps de trajet inter-stations et métriques calculées
- **1 361 transport edges** — arêtes entre stations consécutives sur une même ligne
- **104 transfer edges** — correspondances piétonnes entre réseaux différents (< 300m)
- **6 zones tarifaires** (3 BRT + 3 TER) avec assignation de stations
- **7 tarifs** — par zone (BRT, TER) et par distance (DDD)
- **49 horaires d'exploitation** — fréquences semaine/dimanche par ligne
- **Moteur Dijkstra** — itinéraires multimodaux optimaux avec correspondances
- **3 types d'entrée** — coordonnées GPS, ID station, ou nom de lieu
- **GeoJSON** — export des stations et tracés de lignes pour cartographie
- **Tarification automatique** — calcul du prix par segment (DDD distance, BRT fixe, TER zones)
- **Résolution de lieux** — recherche insensible aux accents + API Frontières pour les localités
- **Sécurité** — Helmet, CORS configurable, rate limiting (200 req/15 min)
- **Documentation interactive** — Redoc + OpenAPI 3.0
- **Docker** — Dockerfile + docker-compose prêts à l'emploi

---

## 🚌 Réseaux de transport

### BRT — Bus Rapid Transit (Sunu BRT)

Corridor de 18.3 km reliant Petersen à Guédiawaye en site propre.

| Ligne | Type | Terminus | Stations | Durée |
|-------|------|----------|----------|-------|
| **B1** | Omnibus | Papa Gueye Fall → Préfecture Guédiawaye | 23 | ~54 min |
| **B2** | Semi-express | Papa Gueye Fall → Préfecture Guédiawaye | 7 | ~43 min |
| **B3** | Semi-express | Papa Gueye Fall → Préfecture Guédiawaye | 7 | ~40 min |
| **B4** | Express | Papa Gueye Fall → Grand Médine | 6 | ~30 min |

**Zones tarifaires BRT :**

| Zone | Stations | Étendue |
|------|----------|---------|
| Zone 1 | 9 | Petersen → Liberté 6 |
| Zone 2 | 8 | Khar Yalla → Ndingala |
| Zone 3 | 6 | Golf Sud → Guédiawaye |

**Tarifs BRT :** même zone = 400 FCFA, zones différentes = 500 FCFA

### TER — Train Express Régional (SETER)

Ligne ferroviaire de 36 km entre Dakar et Diamniadio.

| Ligne | Stations | Durée |
|-------|----------|-------|
| **TER** | 14 | ~44 min |

**Zones tarifaires TER :**

| Zone | Stations | Étendue |
|------|----------|---------|
| Zone 1 | 7 | Dakar → Thiaroye |
| Zone 2 | 6 | Yeumbeul → Bargny |
| Zone 3 | 1 | Diamniadio |

**Tarifs TER :** 1 zone = 500, 2 zones = 1 000, 3 zones = 1 500, 1ère classe = 2 500 FCFA

### DDD — Dakar Dem Dikk

| Lignes | Stations |
|--------|----------|
| 44 | 498 |

---

## 📊 Données en base

| Table | Nombre | Description |
|-------|--------|-------------|
| `networks` | 3 | DDD, BRT, TER |
| `stations` | 534 | Stations géocodées (498 DDD + 23 BRT + 14 TER) |
| `routes` | 49 | Lignes de transport (44 DDD + 4 BRT + 1 TER) |
| `route_stations` | 1 431 | Stations par ligne, ordonnées |
| `travel_times` | 1 361 | Temps de trajet entre stations consécutives |
| `transport_edges` | 1 361 | Arêtes du graphe de transport |
| `transfer_edges` | 104 | Correspondances piétonnes inter-réseau (< 300m) |
| `zones` | 6 | Zones tarifaires (3 BRT + 3 TER) |
| `zone_stations` | 37 | Assignation station → zone |
| `fares` | 7 | Grille tarifaire par réseau |
| `operating_hours` | 49 | Horaires et fréquences par ligne |

---

## 🗄️ Schéma de la base

11 tables PostgreSQL avec clés étrangères, index B-tree et triggers `updated_at`.

```
networks
  id, network_code, name, operator, transport_type, corridor_length_km, total_stations

stations
  id, station_code, station_name, latitude, longitude, network_id → networks, district

routes
  id, route_code, route_name, network_id → networks, route_type,
  origin_terminal, destination_terminal, station_count, total_distance_km, estimated_duration_min

route_stations
  id, route_id → routes, station_id → stations, station_order
  UNIQUE(route_id, station_id), UNIQUE(route_id, station_order)

travel_times
  id, route_id → routes, from_station_id → stations, to_station_id → stations, travel_time_minutes
  UNIQUE(route_id, from_station_id, to_station_id)

transport_edges
  id, from_station_id → stations, to_station_id → stations, route_id → routes, travel_time_minutes
  UNIQUE(from_station_id, to_station_id, route_id)

transfer_edges
  id, from_station_id → stations, to_station_id → stations,
  distance_meters, walking_time_minutes, connection_type, is_active
  UNIQUE(from_station_id, to_station_id)

zones
  id, zone_code, zone_name, network_id → networks
  UNIQUE(zone_code, network_id)

zone_stations
  id, zone_id → zones, station_id → stations
  UNIQUE(zone_id, station_id)

fares
  id, network_id → networks, zones_travelled, price_fcfa
  UNIQUE(network_id, zones_travelled)

operating_hours
  id, route_id → routes, day_type, days[], first_departure, last_departure,
  peak_frequency_minutes, offpeak_frequency_minutes
```

**Index :** `network_id`, `station_id`, `route_id`, `from_station_id`, `to_station_id`, `(latitude, longitude)`, `zone_id`

---

## 🛠️ Stack technique

| Catégorie | Technologie |
|-----------|-------------|
| **Runtime** | Node.js >= 18 |
| **Framework** | Express.js |
| **Base de données** | PostgreSQL (Neon) |
| **Client DB** | pg (node-postgres) |
| **ORM (legacy)** | Prisma |
| **Sécurité** | Helmet, express-rate-limit |
| **Documentation** | Redoc + OpenAPI 3.0 (YAML) |
| **Tests** | Jest + Supertest |
| **Container** | Docker + docker-compose |

---

## 📦 Installation

```bash
git clone <repo-url>
cd transport_api
npm install
```

---

## ⚙️ Configuration

Créer un fichier `.env` à la racine (voir `.env.example`) :

```env
# Base de données (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Serveur
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=*

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
```

---

## ▶️ Démarrage

```bash
# 1. Créer les tables (DROP + CREATE)
node scripts/initDb.js

# 2. Importer les données (DDD, BRT, TER)
node scripts/importData.js

# 3. Démarrer en développement (hot-reload)
npm run dev

# 4. Démarrer en production
npm start
```

L'API est disponible sur `http://localhost:3000`
Documentation interactive : `http://localhost:3000/docs`

### Scripts disponibles

| Commande | Description |
|----------|-------------|
| `node scripts/initDb.js` | Initialise le schéma (11 tables) |
| `node scripts/importData.js` | Importe les données JSON → PostgreSQL |
| `node scripts/audit.js` | Audit complet des données en base |
| `npm run dev` | Serveur avec hot-reload (nodemon) |
| `npm start` | Serveur de production |
| `npm test` | Lancer les tests |

---

## 📚 Endpoints API

### Health & Documentation

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/health` | Statut de l'API, version, timestamp |
| `GET` | `/docs` | Documentation interactive Redoc |
| `GET` | `/api/openapi.json` | Spécification OpenAPI 3.0 |

### Réseaux & Statistiques

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/networks` | Liste des réseaux (id, code, nom, opérateur, type) |
| `GET` | `/api/stats` | Statistiques complètes de la base de données |

### Stations

| Méthode | Endpoint | Paramètres | Description |
|---------|----------|------------|-------------|
| `GET` | `/api/stations` | `?network_id=2&limit=100&offset=0` | Liste paginée, filtrable par réseau |
| `GET` | `/api/stations/:id` | | Détails d'une station |
| `GET` | `/api/map/stations` | `?network_id=2` | Stations en GeoJSON FeatureCollection |

### Lignes (Routes)

| Méthode | Endpoint | Paramètres | Description |
|---------|----------|------------|-------------|
| `GET` | `/api/routes` | `?network_id=2` | Liste des lignes, filtrable par réseau |
| `GET` | `/api/routes/:id` | | Détails d'une ligne (métriques incluses) |
| `GET` | `/api/routes/:id/stations` | | Stations ordonnées de la ligne |
| `GET` | `/api/travel-time` | `?route=5&from=501&to=502` | Temps entre 2 stations sur une ligne |

### Cartes GeoJSON

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/map/stations` | Stations en GeoJSON (Point) |
| `GET` | `/api/map/routes` | Tracés des lignes en GeoJSON (LineString) avec couleur par réseau |

Couleurs des réseaux sur la carte :

| Réseau | Couleur | Épaisseur |
|--------|---------|-----------|
| BRT | `#008F4C` (vert) | 5 |
| TER | `#6B4F2A` (marron) | 4 |
| DDD | `#005F73` (bleu) | 3 |
| AFTU | `#E07A5F` (orange) | 3 |

### Calcul d'itinéraire

Deux endpoints de routage sont disponibles :

#### `/api/route` — Routage multimodal avancé (Dijkstra)

Accepte 3 types d'entrée pour `from` et `to` :

```bash
# Par coordonnées GPS
GET /api/route?from_lat=14.73&from_lon=-17.45&to_lat=14.77&to_lon=-17.39

# Par ID de station
GET /api/route?from=brt_liberte_6&to=brt_prefecture_guediawaye

# Par nom de lieu (insensible aux accents)
GET /api/route?from=liberté 6&to=guediawaye
```

**Résolution des entrées :**

| Priorité | Type | Méthode |
|----------|------|---------|
| 1 | Coordonnées GPS | Direct |
| 2 | ID station | Lookup en base par `station_code` |
| 3 | Nom de station | Recherche insensible aux accents (exact puis LIKE) |
| 4 | Nom de lieu | API Frontières (géocodage) |

**Réponse type :**

```json
{
  "success": true,
  "data": {
    "origin": "Liberté 6",
    "destination": "Préfecture Guédiawaye",
    "total_duration_minutes": 32.5,
    "total_price": 500,
    "steps": [
      {
        "mode": "walk",
        "from": "Liberté 6",
        "to": "Liberté 6",
        "to_station_id": "brt_liberte_6",
        "duration_minutes": 1.2,
        "distance_meters": 100
      },
      {
        "mode": "BRT",
        "route": "Ligne B1",
        "route_id": "BRT_B1",
        "from": "Liberté 6",
        "to": "Préfecture Guédiawaye",
        "duration_minutes": 29,
        "distance_meters": 5800,
        "estimated_price": 500
      },
      {
        "mode": "walk",
        "from": "Préfecture Guédiawaye",
        "to": "Préfecture Guédiawaye",
        "duration_minutes": 2.3,
        "distance_meters": 190
      }
    ]
  }
}
```

#### `/api/itinerary` — Routage par coordonnées GPS (top 3)

```bash
GET /api/itinerary?origin_lat=14.73&origin_lon=-17.45&destination_lat=14.77&destination_lon=-17.39
```

Retourne jusqu'à **3 suggestions** triées par durée (direct + avec correspondance).

---

## 📈 Endpoint Statistiques (`/api/stats`)

Retourne les statistiques complètes de la base de données en un seul appel.

```bash
GET /api/stats
```

**Réponse :**

```json
{
  "success": true,
  "data": {
    "totals": {
      "total_stations": 534,
      "total_routes": 49,
      "total_networks": 3,
      "total_zones": 6,
      "total_fares": 7,
      "total_transport_edges": 1361,
      "total_transfer_edges": 104,
      "total_operating_hours": 49,
      "stations_with_correspondance": 80
    },
    "networks": [
      {
        "network_code": "DDD",
        "name": "Dakar Dem Dikk",
        "transport_type": "bus",
        "operator": "Dakar Dem Dikk SA",
        "stations": 497,
        "routes": 44,
        "zones": 0,
        "fares": 0,
        "stations_with_correspondance": 52
      },
      {
        "network_code": "BRT",
        "name": "Sunu BRT",
        "transport_type": "brt",
        "operator": "Sunu BRT",
        "corridor_length_km": "18.30",
        "stations": 23,
        "routes": 4,
        "zones": 3,
        "fares": 3,
        "stations_with_correspondance": 22
      },
      {
        "network_code": "TER",
        "name": "Train Express Régional",
        "transport_type": "train",
        "operator": "SETER",
        "corridor_length_km": "36.00",
        "stations": 14,
        "routes": 1,
        "zones": 3,
        "fares": 4,
        "stations_with_correspondance": 6
      }
    ],
    "correspondances": [
      { "network_a": "BRT", "network_b": "DDD", "pairs": 46, "avg_distance_meters": 192, "avg_walking_minutes": 2.3 },
      { "network_a": "DDD", "network_b": "TER", "pairs": 6, "avg_distance_meters": 234, "avg_walking_minutes": 2.8 }
    ],
    "top_correspondances": [
      { "station_a": "Gueule Tapée", "network_a": "BRT", "station_b": "Arrêt Dial Mbaye", "network_b": "DDD", "distance_meters": 19, "walking_time_minutes": 0.2 },
      { "station_a": "Papa Gueye Fall", "network_a": "BRT", "station_b": "Petersen", "network_b": "DDD", "distance_meters": 47, "walking_time_minutes": 0.6 }
    ],
    "fares": [
      { "network_code": "BRT", "zones_travelled": 1, "price_fcfa": 400 },
      { "network_code": "BRT", "zones_travelled": 2, "price_fcfa": 500 },
      { "network_code": "TER", "zones_travelled": 1, "price_fcfa": 500 },
      { "network_code": "TER", "zones_travelled": 2, "price_fcfa": 1000 },
      { "network_code": "TER", "zones_travelled": 3, "price_fcfa": 1500 }
    ],
    "horaires": [
      { "network_code": "BRT", "route_code": "BRT_B1", "route_name": "Ligne B1", "day_type": "weekday", "first_departure": "06:00", "last_departure": "21:00", "peak_frequency_minutes": 6, "offpeak_frequency_minutes": 6 }
    ]
  }
}
```

| Champ | Description |
|-------|-------------|
| `totals` | Totaux globaux : stations, routes, zones, tarifs, edges, correspondances |
| `networks` | Détails par réseau : stations, routes, zones, tarifs, stations avec correspondance |
| `correspondances` | Paires inter-réseau avec nombre, distance moyenne et temps de marche moyen |
| `top_correspondances` | Les 10 correspondances les plus proches (station ↔ station) |
| `fares` | Grille tarifaire complète par réseau et zones |
| `horaires` | Horaires d'exploitation par ligne et jour |

### Correspondances dans `/api/stations/:id`

Chaque station inclut désormais ses **lignes** et **correspondances** :

```bash
GET /api/stations/500
```

```json
{
  "success": true,
  "data": {
    "id": 500,
    "station_name": "Grande Mosquée",
    "network_name": "Bus Rapid Transit Dakar",
    "latitude": 14.7418,
    "longitude": -17.4425,
    "lines": [
      { "route_code": "BRT_B1", "route_name": "Ligne B1", "network_code": "BRT" },
      { "route_code": "BRT_B4", "route_name": "Ligne B4", "network_code": "BRT" }
    ],
    "correspondances": [
      { "station_name": "Gibraltar", "network_code": "DDD", "distance_meters": 157, "walking_time_minutes": 1.9 },
      { "station_name": "Mosquée Santhiaba", "network_code": "DDD", "distance_meters": 259, "walking_time_minutes": 3.1 }
    ]
  }
}
```

| Champ | Description |
|-------|-------------|
| `lines` | Lignes de transport desservant cette station (route_code, nom, réseau) |
| `correspondances` | Stations proches d'autres réseaux (< 300m) avec distance et temps de marche |

---

## 🧭 Moteur de routage

### Architecture du graphe

Le moteur construit un **graphe orienté pondéré** en mémoire à partir de la base de données :

- **Nœuds** = stations (534)
- **Arêtes transport** = segments entre stations consécutives, pondérés par `travel_time_minutes` (1 361)
- **Arêtes transfer** = correspondances piétonnes inter-réseau (< 300m), pondérées par `walking_time_minutes` (104)

### Algorithme

1. **Résolution** des entrées (GPS → station la plus proche, nom → géocodage)
2. **Dijkstra** sur le graphe unifié (transport + transfer edges)
3. **Reconstruction** du chemin optimal
4. **Regroupement** des segments consécutifs sur une même ligne
5. **Calcul du prix** par segment (pricing service)
6. **Cache** du graphe en mémoire (invalidable après re-import)

### Deux moteurs

| Moteur | Endpoint | Stratégie |
|--------|----------|-----------|
| `routingService.js` | `/api/route` | Dijkstra sur graphe complet, cache mémoire, pricing intégré |
| `routing.service.js` | `/api/itinerary` | Recherche directe + correspondance simple, top 3 résultats |

---

## 💰 Service de tarification

Le `pricingService` calcule automatiquement le prix de chaque segment d'itinéraire :

| Réseau | Méthode | Détail |
|--------|---------|--------|
| **DDD** | Par distance | 150–500 FCFA selon 8 paliers de distance (3–25+ km) |
| **BRT** | Fixe / zone | Standard 400 FCFA, express 500 FCFA |
| **TER** | Par zone | 500 / 1 000 / 1 500 FCFA (1 / 2 / 3 zones) |

**Paliers DDD :**

| Distance max | Tarif |
|--------------|-------|
| 3 km | 150 FCFA |
| 5 km | 200 FCFA |
| 8 km | 250 FCFA |
| 12 km | 300 FCFA |
| 16 km | 350 FCFA |
| 20 km | 400 FCFA |
| 25 km | 450 FCFA |
| 25+ km | 500 FCFA |

---

## 🏗️ Structure du projet

```
transport_api/
├── scripts/
│   ├── schema.sql              # Schéma SQL complet (11 tables)
│   ├── initDb.js               # Exécute schema.sql
│   ├── importData.js           # Import JSON → PostgreSQL (DDD, BRT, TER)
│   └── audit.js                # Audit des données en base
├── src/
│   ├── config/
│   │   ├── db.js               # Pool PostgreSQL (pg)
│   │   ├── database.js         # Pool PostgreSQL (legacy)
│   │   ├── pricing.js          # Configuration tarifaire (DDD, BRT, TER)
│   │   ├── networkStyles.js    # Couleurs et styles par réseau (carte)
│   │   └── prisma.js           # Client Prisma (legacy)
│   ├── controllers/
│   │   ├── stationController.js      # GET /api/stations (apiRoutes)
│   │   ├── stations.controller.js    # GET /api/stations + GeoJSON
│   │   ├── routeController.js        # GET /api/routes + /api/route (Dijkstra)
│   │   ├── routes.controller.js      # GET /api/routes/:id + /api/travel-time
│   │   ├── itinerary.controller.js   # GET /api/itinerary
│   │   ├── transport.controller.js   # GET /api/networks
│   │   └── mapController.js          # GET /api/map/routes (GeoJSON)
│   ├── routes/
│   │   ├── apiRoutes.js              # Routes principales (stations, routes, map, route)
│   │   ├── stations.routes.js        # /api/stations, /api/map/stations
│   │   ├── routes.routes.js          # /api/routes/:id, /api/travel-time
│   │   ├── itinerary.routes.js       # /api/itinerary
│   │   └── transport.routes.js       # /api/networks
│   ├── services/
│   │   ├── database.service.js       # Requêtes SQL centralisées (stations, routes, edges)
│   │   ├── stationService.js         # Recherche stations (Haversine JS)
│   │   ├── routingService.js         # Moteur Dijkstra (graphe, cache, pricing)
│   │   ├── routing.service.js        # Routage direct + correspondance simple (top 3)
│   │   ├── localityService.js        # Résolution lieux (GPS, station, nom, Frontières API)
│   │   ├── mapService.js             # Génération GeoJSON des lignes
│   │   └── pricingService.js         # Calcul tarifaire par segment
│   ├── utils/
│   │   ├── haversine.js              # Distance Haversine (mètres)
│   │   └── geo.utils.js              # Validation coords, GeoJSON, Haversine (km)
│   ├── data/
│   │   ├── ddd.json                  # 44 lignes, 498 stations DDD
│   │   ├── brt.json                  # 4 lignes, 23 stations, zones, tarifs BRT
│   │   ├── ter.json                  # 1 ligne, 14 stations, zones, tarifs TER
│   │   └── aftu.json                 # Données AFTU (à compléter)
│   └── server.js                     # Point d'entrée Express
├── tests/
│   └── api.test.js
├── prisma/
│   └── schema.prisma                 # Schéma Prisma (legacy)
├── openapi.yaml                      # Spécification OpenAPI 3.0
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

---

## 🐳 Docker

### Docker Compose

```bash
docker-compose up -d
```

### Docker seul (base externe)

```bash
docker build -t transport-api .
docker run -p 3000:3000 --env-file .env transport-api
```

Le Dockerfile utilise `node:18-alpine`, expose le port 3000 et inclut un healthcheck.

---

## 🧪 Tests

```bash
# Lancer les tests
npm test

# Avec couverture
npm run test:coverage
```

---

## 🔄 Pipeline de données

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐
│  ddd.json    │    │  brt.json    │    │  ter.json            │
│  44 lignes   │    │  4 lignes    │    │  1 ligne             │
│  498 stations│    │  23 stations │    │  14 stations         │
└──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘
       │                   │                       │
       └───────────┬───────┘───────────────────────┘
                   │
           ┌───────▼────────┐
           │ importData.js  │  INSERT networks, stations, routes,
           │                │  route_stations, travel_times,
           │                │  transport_edges, operating_hours,
           │                │  fares, zones, zone_stations
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │ transfer_edges │  Calcul automatique des correspondances
           │ (< 300m)       │  piétonnes inter-réseau (Haversine)
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │  PostgreSQL    │  534 stations, 49 routes, 1361 edges,
           │  (Neon)        │  104 transfers, 6 zones, 7 fares
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │  Express API   │  REST endpoints + Dijkstra routing
           │  :3000         │  + GeoJSON + Pricing
           └────────────────┘
```

---

## 💡 Inspiration

Inspiré par [Citymapper](https://citymapper.com/) et les API GTFS, adapté au contexte dakarois.

---

## 📄 Licence

**Propriétaire** — Tous droits réservés.

---

## 👨🏽‍💻 Auteur

**taphacoobams**
