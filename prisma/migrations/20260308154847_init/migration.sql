-- Enable PostGIS extension (required for geometry type)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Auto-populate geom from lat/lon on insert/update
CREATE OR REPLACE FUNCTION update_station_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTable
CREATE TABLE "transport_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "transport_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "transport_type_id" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "quartier" VARCHAR(255),
    "geom" geometry(Point, 4326),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "transport_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stations" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "station_id" INTEGER NOT NULL,
    "station_order" INTEGER NOT NULL,

    CONSTRAINT "route_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_times" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "from_station_id" INTEGER NOT NULL,
    "to_station_id" INTEGER NOT NULL,
    "minutes" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "travel_times_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transport_types_name_key" ON "transport_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "route_stations_route_id_station_id_key" ON "route_stations"("route_id", "station_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_stations_route_id_station_order_key" ON "route_stations"("route_id", "station_order");

-- CreateIndex
CREATE UNIQUE INDEX "travel_times_route_id_from_station_id_to_station_id_key" ON "travel_times"("route_id", "from_station_id", "to_station_id");

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_transport_type_id_fkey" FOREIGN KEY ("transport_type_id") REFERENCES "transport_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_transport_type_id_fkey" FOREIGN KEY ("transport_type_id") REFERENCES "transport_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stations" ADD CONSTRAINT "route_stations_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stations" ADD CONSTRAINT "route_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_times" ADD CONSTRAINT "travel_times_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_times" ADD CONSTRAINT "travel_times_from_station_id_fkey" FOREIGN KEY ("from_station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_times" ADD CONSTRAINT "travel_times_to_station_id_fkey" FOREIGN KEY ("to_station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
