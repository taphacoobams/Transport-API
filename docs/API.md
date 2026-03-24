# Transport API - Documentation des Endpoints

> API REST pour le réseau de transport multimodal de Dakar (TER, BRT, DDD)

**Base URL:** `http://localhost:3000/api`

---

## 📋 Table des matières

- [Health Check](#health-check)
- [Réseaux de transport](#réseaux-de-transport)
- [Stations](#stations)
- [Routes](#routes)
- [Itinéraires](#itinéraires)
- [Cartes GeoJSON](#cartes-geojson)

---

## Health Check

### `GET /api/health`

Vérifie l'état de santé de l'API.

**Réponse:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "Transport API",
  "version": "1.0.0",
  "timestamp": "2026-03-24T03:00:00.000Z"
}
```

---

## Réseaux de transport

### `GET /api/transport-types`

Retourne la liste des réseaux de transport disponibles.

**Réponse:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "network_code": "TER",
      "name": "Train Express Régional",
      "operator": "SENTER",
      "transport_type": "TER"
    },
    {
      "id": 2,
      "network_code": "BRT",
      "name": "Bus Rapid Transit Dakar",
      "operator": "CETUD/Dakar Mobilité",
      "transport_type": "BRT"
    },
    {
      "id": 3,
      "network_code": "DDD",
      "name": "Dakar Dem Dikk",
      "operator": "DDD SA",
      "transport_type": "DDD"
    }
  ]
}
```

---

## Stations

### `GET /api/stations`

Retourne la liste de toutes les stations.

**Paramètres de requête:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `network` | string | Filtrer par réseau (TER, BRT, DDD) |
| `limit` | number | Nombre max de résultats (défaut: 500) |
| `offset` | number | Décalage pour pagination (défaut: 0) |

**Exemple:** `GET /api/stations?network=BRT&limit=10`

**Réponse:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "station_id": 15,
      "station_name": "Préfecture de Guédiawaye",
      "transport_network": "BRT",
      "latitude": 14.7724172,
      "longitude": -17.3875895,
      "network_id": 2,
      "network_name": "Bus Rapid Transit Dakar"
    }
  ]
}
```

---

### `GET /api/stations/:id`

Retourne les détails d'une station spécifique.

**Paramètres:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `id` | number | ID de la station |

**Exemple:** `GET /api/stations/15`

**Réponse:**
```json
{
  "success": true,
  "data": {
    "station_id": 15,
    "station_name": "Préfecture de Guédiawaye",
    "transport_network": "BRT",
    "latitude": 14.7724172,
    "longitude": -17.3875895,
    "network_id": 2,
    "network_name": "Bus Rapid Transit Dakar"
  }
}
```

**Erreur 404:**
```json
{
  "success": false,
  "error": "Station not found"
}
```

---

## Routes

### `GET /api/routes`

Retourne la liste de toutes les lignes/routes.

**Paramètres de requête:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `network` | string | Filtrer par réseau (TER, BRT, DDD) |

**Exemple:** `GET /api/routes?network=TER`

**Réponse:**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "route_id": 1,
      "route_name": "TER Dakar - Diamniadio",
      "transport_network": "TER",
      "origin_terminal": "Dakar",
      "destination_terminal": "Diamniadio",
      "network_id": 1,
      "network_name": "Train Express Régional"
    }
  ]
}
```

---

### `GET /api/routes/:id`

Retourne les détails d'une route spécifique.

**Paramètres:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `id` | number | ID de la route |

**Exemple:** `GET /api/routes/1`

**Réponse:**
```json
{
  "success": true,
  "data": {
    "route_id": 1,
    "route_name": "TER Dakar - Diamniadio",
    "transport_network": "TER",
    "origin_terminal": "Dakar",
    "destination_terminal": "Diamniadio",
    "network_name": "Train Express Régional"
  }
}
```

---

### `GET /api/routes/:id/stations`

Retourne les stations d'une route dans l'ordre.

**Paramètres:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `id` | number | ID de la route |

**Exemple:** `GET /api/routes/1/stations`

**Réponse:**
```json
{
  "success": true,
  "data": [
    {
      "station_order": 1,
      "station_id": 1,
      "station_name": "Dakar",
      "latitude": 14.6767288,
      "longitude": -17.4338252
    },
    {
      "station_order": 2,
      "station_id": 2,
      "station_name": "Colobane",
      "latitude": 14.7004304,
      "longitude": -17.441666
    }
  ]
}
```

---

### `GET /api/travel-time`

Retourne le temps de trajet entre deux stations sur une route.

**Paramètres de requête:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `from` | number | ID station de départ (requis) |
| `to` | number | ID station d'arrivée (requis) |
| `route` | number | ID de la route (requis) |

**Exemple:** `GET /api/travel-time?from=1&to=2&route=1`

**Réponse:**
```json
{
  "success": true,
  "data": {
    "from_station_id": 1,
    "to_station_id": 2,
    "route_id": 1,
    "travel_time_minutes": 4
  }
}
```

**Erreur 400:**
```json
{
  "error": "Missing required parameters: from, to, route"
}
```

---

## Itinéraires

### `GET /api/itinerary`

Calcule un itinéraire multimodal entre deux points.

**Paramètres de requête:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `origin_lat` | number | Latitude du point de départ (requis) |
| `origin_lon` | number | Longitude du point de départ (requis) |
| `destination_lat` | number | Latitude de la destination (requis) |
| `destination_lon` | number | Longitude de la destination (requis) |

**Exemple:** `GET /api/itinerary?origin_lat=14.7645&origin_lon=-17.3934&destination_lat=14.6820&destination_lon=-17.4410`

**Réponse:**
```json
{
  "success": true,
  "data": {
    "origin": "14.7645, -17.3934",
    "destination": "14.6820, -17.4410",
    "total_duration_minutes": 45,
    "total_price": 500,
    "steps": [
      {
        "mode": "walk",
        "from": "Origine",
        "to": "Pikine",
        "duration_minutes": 5,
        "distance_meters": 400
      },
      {
        "mode": "TER",
        "route": "TER Dakar - Diamniadio",
        "from": "Pikine",
        "to": "Colobane",
        "duration_minutes": 15,
        "distance_meters": 8500,
        "estimated_price": 500
      },
      {
        "mode": "walk",
        "from": "Colobane",
        "to": "Destination",
        "duration_minutes": 8,
        "distance_meters": 650
      }
    ]
  }
}
```

**Erreur 400:**
```json
{
  "error": "Missing required parameters: origin_lat, origin_lon, destination_lat, destination_lon"
}
```

---

### `GET /api/route`

Calcule un itinéraire multimodal (endpoint alternatif).

**Paramètres de requête:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `from` | string | Nom du lieu de départ |
| `to` | string | Nom de la destination |
| `from_lat` | number | Latitude du départ |
| `from_lon` | number | Longitude du départ |
| `to_lat` | number | Latitude de la destination |
| `to_lon` | number | Longitude de la destination |

**Exemple:** `GET /api/route?from_lat=14.7645&from_lon=-17.3934&to_lat=14.6820&to_lon=-17.4410`

---

## Cartes GeoJSON

### `GET /api/map/stations`

Retourne toutes les stations au format GeoJSON FeatureCollection.

**Paramètres de requête:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `network_id` | number | Filtrer par ID de réseau |

**Réponse:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-17.4338252, 14.6767288]
      },
      "properties": {
        "id": 1,
        "station_name": "Dakar",
        "network_name": "Train Express Régional",
        "transport_type": "TER"
      }
    }
  ]
}
```

---

### `GET /api/map/routes`

Retourne toutes les routes avec leurs tracés au format GeoJSON.

**Réponse:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-17.4338252, 14.6767288],
          [-17.441666, 14.7004304]
        ]
      },
      "properties": {
        "route_id": 1,
        "route_name": "TER Dakar - Diamniadio",
        "network": "TER",
        "color": "#E30613",
        "weight": 5
      }
    }
  ]
}
```

---

## Documentation interactive

### `GET /docs`

Page de documentation interactive (Redoc).

### `GET /api/openapi.json`

Spécification OpenAPI au format JSON.

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 400 | Paramètres manquants ou invalides |
| 404 | Ressource non trouvée |
| 429 | Trop de requêtes (rate limit) |
| 500 | Erreur serveur interne |

---

## Rate Limiting

- **Fenêtre:** 15 minutes
- **Max requêtes:** 200 par fenêtre

---

## Exemples cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Liste des stations BRT
curl "http://localhost:3000/api/stations?network=BRT"

# Détails d'une station
curl http://localhost:3000/api/stations/15

# Liste des routes TER
curl "http://localhost:3000/api/routes?network=TER"

# Stations d'une route
curl http://localhost:3000/api/routes/1/stations

# Calcul d'itinéraire
curl "http://localhost:3000/api/itinerary?origin_lat=14.7645&origin_lon=-17.3934&destination_lat=14.6820&destination_lon=-17.4410"

# Stations en GeoJSON
curl http://localhost:3000/api/map/stations

# Routes en GeoJSON
curl http://localhost:3000/api/map/routes
```
