# Transport API

Production-ready REST API for public transport data in **Dakar, Senegal**.

Part of the **Dakar Mobility** platform, which combines:

- **Transport API** → transport networks, routes, stations, and itinerary planning (this API)
- **Frontières API** → administrative geography (regions, communes, localities)

## Transport Systems

| System | Description |
|--------|-------------|
| Dakar Bus Rapid Transit | BRT dedicated-lane bus system |
| Dakar Regional Express Train | TER rail service (Dakar–Diamniadio–AIBD) |
| Dakar Dem Dikk | Public urban/suburban bus company |
| AFTU Tata | Minibus network serving Dakar neighborhoods |
| Car Rapide | Informal colorful minibuses |
| Ndiaga Ndiaye | Larger informal buses on major corridors |

## Tech Stack

- **Runtime:** Node.js >= 18
- **Framework:** Express.js
- **Database:** Neon PostgreSQL + PostGIS
- **Security:** Helmet, CORS, express-rate-limit
- **Testing:** Jest + Supertest
- **Documentation:** OpenAPI 3.0 + Redoc

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Neon database URL
```

### 3. Initialize database

```bash
npm run init-db
```

### 4. Start development server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/transport-types` | List transport systems |
| GET | `/api/stations` | List stations (paginated) |
| GET | `/api/stations/:id` | Get station by ID |
| GET | `/api/map/stations` | Stations as GeoJSON |
| GET | `/api/routes` | List routes |
| GET | `/api/routes/:id` | Get route by ID |
| GET | `/api/routes/:id/stations` | Stations along a route |
| GET | `/api/travel-time` | Travel time between stations |
| GET | `/api/itinerary` | Compute itinerary |
| GET | `/docs` | Redoc documentation |
| GET | `/api/openapi.json` | OpenAPI spec |

## Documentation

Interactive API documentation is available at:

- **Redoc:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI JSON:** [http://localhost:3000/api/openapi.json](http://localhost:3000/api/openapi.json)

## Itinerary Planning

The `/api/itinerary` endpoint computes multi-modal routes:

```
GET /api/itinerary?origin_lat=14.7645&origin_lon=-17.3934&destination_lat=14.6820&destination_lon=-17.4410
```

The routing engine:

1. Finds nearest stations using PostGIS spatial queries
2. Searches for direct routes between origin and destination stations
3. Attempts single-transfer routes across different transport systems
4. Returns up to 3 itinerary options sorted by total travel time

**Note:** Destination localities can come from the Frontières API, which the Dakar Mobility frontend queries separately.

## Testing

```bash
npm test
```

## Docker

### Using Docker Compose (with local PostGIS)

```bash
docker-compose up -d
```

### Using Docker (Neon database)

```bash
docker build -t transport-api .
docker run -p 3000:3000 --env-file .env transport-api
```

## Project Structure

```
transport-api/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── itinerary.controller.js
│   │   ├── routes.controller.js
│   │   ├── stations.controller.js
│   │   └── transport.controller.js
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.sql
│   ├── routes/
│   │   ├── itinerary.routes.js
│   │   ├── routes.routes.js
│   │   ├── stations.routes.js
│   │   └── transport.routes.js
│   ├── services/
│   │   ├── database.service.js
│   │   └── routing.service.js
│   ├── utils/
│   │   └── geo.utils.js
│   └── server.js
├── tests/
│   └── api.test.js
├── openapi.yaml
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## License

MIT
