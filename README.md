# Transport API – Dakar 🇸🇳

API REST construite avec **Node.js / Express** et **PostgreSQL** fournissant le graphe de transport multimodal complet de **Dakar** avec calcul d'itinéraires.

Fait partie de la plateforme **Dakar Mobility** :

- **Transport API** → réseaux de transport, stations, lignes et calcul d'itinéraires (cette API)
- [**Frontières API**](https://github.com/taphacoobams/frontieres_api) → géographie administrative (régions, communes, localités)

---

## 🚀 Fonctionnalités

* 🚍 **4 réseaux de transport** — BRT, TER, Dakar Dem Dikk, AFTU
* 📍 **836 stations** géocodées (Nominatim + OpenStreetMap + interpolation)
* 🛤️ **53 lignes** avec arrêts ordonnés et temps de trajet
* 🔗 **753 transport edges** — connexions entre arrêts consécutifs d'une même ligne
* 🚶 **1 442 transfer edges** — correspondances piétonnes entre réseaux (< 300m)
* 🧭 **Moteur de routage Dijkstra** — itinéraires multimodaux optimaux
* 🗺️ **3 types d'entrée** — coordonnées GPS, ID station, ou nom de lieu
* 🔍 Recherche de stations insensible aux accents
* 🌐 CORS activé
* 🛡️ Sécurité (Helmet, rate limiting 200 req/15 min)
* 📖 Documentation interactive (Redoc + OpenAPI)
* 🧪 Tests fonctionnels

---

## 🚌 Réseaux de transport

| Réseau | Type | Description |
|--------|------|-------------|
| **BRT** | Bus Rapid Transit | Système de bus en site propre |
| **TER** | Train Express Régional | Liaison ferroviaire Dakar–Diamniadio–AIBD |
| **DDD** | Dakar Dem Dikk | Compagnie de bus urbains et suburbains |
| **AFTU** | AFTU Tata | Réseau de minibus desservant les quartiers |

---

## 📊 Données

Les données proviennent de datasets JSON enrichis avec les coordonnées **OpenStreetMap Nominatim** et un fichier **GeoJSON Overpass Turbo**.

| Métrique | Valeur |
|----------|--------|
| Stations géocodées | 836 / 836 |
| Lignes | 53 |
| Transport edges | 753 |
| Transfer edges (correspondances) | 1 442 |
| Types de transport | 3 |

### Sources de géocodage

| Méthode | Stations |
|---------|----------|
| Nominatim (import initial) | 449 |
| OSM GeoJSON (matching exact) | 15 |
| OSM GeoJSON (matching fuzzy) | 10 |
| OSM GeoJSON (mots-clés) | 97 |
| Interpolation de route | 265 |
| **Total** | **836** |

---

## 🗄️ Schéma de la base

```sql
transport_types    (transport_type_id, name, description)
stations           (station_id, station_name, latitude, longitude, transport_network, transport_type_id)
routes             (route_id, route_name, transport_network, transport_type_id, origin_terminal, destination_terminal)
route_stations     (id, route_id, station_id, station_order)
travel_times       (id, route_id, from_station, to_station, travel_time_minutes)
transport_edges    (id, from_station, to_station, route_id, travel_time_minutes)
transfer_edges     (id, from_station, to_station, distance_meters, walking_time_minutes)
```

### Index

* **B-tree** sur `route_id`, `station_id`, `from_station`, `to_station` (clés de liaison)
* **B-tree** sur `transport_network` et `(latitude, longitude)` (recherche spatiale)

---

## 🛠️ Stack technique

* **Node.js** >= 18
* **Express.js** — framework HTTP
* **PostgreSQL** (Neon) — base de données
* **pg** — client PostgreSQL
* **Helmet** — sécurité HTTP
* **express-rate-limit** — limitation de requêtes
* **Redoc** — documentation interactive
* **Jest** + **Supertest** — tests fonctionnels
* **Nominatim** + **Overpass Turbo** — géocodage des stations

---

## 📦 Installation locale

```bash
git clone https://github.com/taphacoobams/Transport-API.git
cd Transport-API
npm install
```

---

## ⚙️ Configuration

Créer un fichier `.env` à la racine :

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
FRONTIERES_API_URL=https://frontieres-api.onrender.com
```

---

## ▶️ Démarrage

```bash
# Initialiser le schéma de la base (à faire une fois)
npm run init-db

# Importer les réseaux de transport (BRT, TER, DDD, AFTU)
npm run import-networks

# Générer les correspondances piétonnes entre réseaux
node scripts/generate_transfers.js

# Compléter les stations manquantes via OSM GeoJSON
node scripts/match_osm.js

# Développement (hot-reload)
npm run dev

# Production
node src/server.js
```

L'API est disponible sur `http://localhost:3000`.

---

## 🌍 Déploiement (Render)

### Variables d'environnement

| Clé | Valeur |
|-----|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Connection string PostgreSQL |
| `FRONTIERES_API_URL` | URL de l'API Frontières |

### Commandes Render

| Rôle | Commande |
|------|----------|
| Build | `npm install` |
| Start | `node src/server.js` |

---

## 📚 Endpoints

### Stations

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/stations` | Liste des stations (filtrable par `network`, `limit`) |
| `GET` | `/api/stations/:id` | Station par ID |
| `GET` | `/api/map/stations` | FeatureCollection GeoJSON des stations |

### Lignes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/routes` | Liste des lignes (filtrable par `network`) |
| `GET` | `/api/routes/:id` | Ligne par ID |
| `GET` | `/api/routes/:id/stations` | Arrêts ordonnés d'une ligne |

### Calcul d'itinéraire

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/route` | Calcul d'itinéraire multimodal |

Le endpoint `/api/route` accepte **3 types d'entrée** pour `from` et `to` :

```
# Par coordonnées GPS
GET /api/route?from_lat=14.73&from_lon=-17.45&to=ter_diamniadio

# Par ID de station
GET /api/route?from=brt_liberte_6&to=brt_prefecture_guediawaye

# Par nom de lieu (insensible aux accents)
GET /api/route?from=liberte 6&to=ngor
```

#### Réponse type

```json
{
  "success": true,
  "data": {
    "origin": "Liberté 6",
    "destination": "Ngor",
    "total_duration_minutes": 22.04,
    "steps": [
      {
        "mode": "walk",
        "from": "Liberté 6",
        "to": "Terminus Liberté 6",
        "to_station_id": "ddd_terminus_liberte_6",
        "duration_minutes": 2.04,
        "distance_meters": 169.23
      },
      {
        "mode": "DDD",
        "route": "DDD 9",
        "route_id": "ddd_DDD_9",
        "from": "Terminus Liberté 6",
        "to": "Rond Point JVC",
        "duration_minutes": 2
      },
      {
        "mode": "DDD",
        "route": "DDD 217",
        "route_id": "ddd_DDD_217",
        "from": "ancienne piste",
        "to": "Ngor",
        "duration_minutes": 12
      }
    ]
  }
}
```

### Types de transport

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/transport-types` | Liste des types de transport |

### Utilitaires

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/health` | Statut serveur |
| `GET` | `/docs` | Documentation Redoc |
| `GET` | `/api/openapi.json` | Spécification OpenAPI |

---

## 🧭 Moteur de routage

Le moteur de routage utilise l'**algorithme de Dijkstra** sur un graphe unifié :

1. **Transport edges** — connexions entre arrêts consécutifs d'une ligne, pondérés par le temps de trajet
2. **Transfer edges** — correspondances piétonnes entre stations de réseaux différents (< 300m), pondérés par le temps de marche (5 km/h)

Le graphe est construit en mémoire au premier appel, puis mis en cache pour les requêtes suivantes.

### Normalisation des entrées

| Type d'entrée | Exemple | Résolution |
|---------------|---------|------------|
| Coordonnées GPS | `from_lat=14.73&from_lon=-17.45` | Station la plus proche (Haversine) |
| ID de station | `from=brt_liberte_6` | Lookup direct en base |
| Nom de lieu | `from=liberte 6` | Recherche insensible aux accents en base, puis Frontières API |

---

## 🏗️ Structure du projet

```
transport-api/
├── scripts/
│   ├── import_networks.js       # Import des 4 réseaux JSON
│   ├── generate_transfers.js    # Génération des correspondances piétonnes
│   ├── match_osm.js             # Matching stations ↔ OSM GeoJSON
│   ├── check_db.js              # Vérification de l'état de la base
│   └── export_all_stations.js   # Export JSON de toutes les stations
├── src/
│   ├── config/
│   │   └── database.js          # Pool PostgreSQL
│   ├── controllers/
│   │   ├── stationController.js # Contrôleur stations
│   │   └── routeController.js   # Contrôleur lignes + itinéraire
│   ├── data/
│   │   ├── brt.json             # Dataset BRT
│   │   ├── ter.json             # Dataset TER
│   │   ├── ddd.json             # Dataset Dakar Dem Dikk
│   │   ├── aftu.json            # Dataset AFTU
│   │   └── export.geojson       # Arrêts OSM (Overpass Turbo)
│   ├── routes/
│   │   └── apiRoutes.js         # Routes Express
│   ├── services/
│   │   ├── localityService.js   # Résolution de lieux (GPS, ID, nom)
│   │   ├── stationService.js    # Recherche de stations
│   │   └── routingService.js    # Moteur Dijkstra
│   ├── utils/
│   │   └── haversine.js         # Calcul de distance Haversine
│   ├── database.js              # Schéma de la base
│   └── server.js                # Serveur Express
├── tests/
│   └── api.test.js
├── openapi.yaml
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🧪 Tests

```bash
npm test
```

---

## 🐳 Docker

### Docker Compose (avec PostGIS local)

```bash
docker-compose up -d
```

### Docker (base externe)

```bash
docker build -t transport-api .
docker run -p 3000:3000 --env-file .env transport-api
```

---

## 🤝 Contribuer

### 1. Fork & Clone

```bash
git clone https://github.com/<ton-username>/Transport-API.git
cd Transport-API
npm install
```

### 2. Créer une branche

```bash
git checkout -b feat/ma-fonctionnalite
```

### 3. Tester

```bash
npm test
```

### 4. Ouvrir une Pull Request

Décris ce que tu as ajouté ou corrigé et référence l'issue si applicable.

### 5. Signaler un bug

Ouvre une [issue GitHub](https://github.com/taphacoobams/Transport-API/issues) avec le comportement observé, attendu, et les étapes pour reproduire.

---

## 💡 Inspiration

Ce projet est inspiré par [**Citymapper**](https://citymapper.com/) et les API de transport public, adapté au contexte dakarois avec les réseaux **BRT**, **TER**, **Dakar Dem Dikk** et **AFTU**. Les coordonnées des stations proviennent d'**OpenStreetMap** (Nominatim + Overpass Turbo).

---

## 📄 Licence

MIT

---

## 👨🏽‍💻 Auteur

**taphacoobams** — [github.com/taphacoobams](https://github.com/taphacoobams)

---

> Projet open-source pour faciliter la mobilité urbaine à Dakar 🇸🇳
