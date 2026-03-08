-- Seed data for Transport API
-- Dakar public transport systems

-- Transport types
INSERT INTO transport_types (name, description) VALUES
    ('Dakar Bus Rapid Transit', 'Bus Rapid Transit system operating dedicated lanes across Dakar metropolitan area.'),
    ('Dakar Regional Express Train', 'Regional express rail service (TER) connecting Dakar to Diamniadio and AIBD.'),
    ('Dakar Dem Dikk', 'Public bus company operating urban and suburban routes in Dakar.'),
    ('AFTU Tata', 'Association de Financement des Transports Urbains — minibus (Tata) network serving Dakar neighborhoods.'),
    ('Car Rapide', 'Informal colorful minibuses operating fixed routes across the Dakar region.'),
    ('Ndiaga Ndiaye', 'Larger informal buses providing affordable transport on major corridors in Dakar.')
ON CONFLICT (name) DO NOTHING;

-- Sample BRT stations
INSERT INTO stations (name, transport_type_id, lat, lon) VALUES
    ('Gare de Guédiawaye', 1, 14.7645, -17.3934),
    ('Parcelles Assainies', 1, 14.7630, -17.4120),
    ('Grand Médine', 1, 14.7440, -17.4550),
    ('Petersen', 1, 14.6710, -17.4380),
    ('Gare de Dakar', 1, 14.6820, -17.4410)
ON CONFLICT DO NOTHING;

-- Sample TER stations
INSERT INTO stations (name, transport_type_id, lat, lon) VALUES
    ('Dakar TER', 2, 14.6817, -17.4410),
    ('Hann TER', 2, 14.7140, -17.4190),
    ('Thiaroye TER', 2, 14.7430, -17.3680),
    ('Rufisque TER', 2, 14.7160, -17.2740),
    ('Diamniadio TER', 2, 14.7070, -17.1850)
ON CONFLICT DO NOTHING;

-- Sample DDD stations
INSERT INTO stations (name, transport_type_id, lat, lon) VALUES
    ('Plateau DDD', 3, 14.6690, -17.4340),
    ('Médina DDD', 3, 14.6900, -17.4470),
    ('Fann DDD', 3, 14.6930, -17.4660),
    ('Mermoz DDD', 3, 14.7050, -17.4780),
    ('Ouakam DDD', 3, 14.7180, -17.4880)
ON CONFLICT DO NOTHING;

-- Sample BRT route
INSERT INTO routes (name, transport_type_id) VALUES
    ('BRT Ligne 1 — Guédiawaye / Gare de Dakar', 1)
ON CONFLICT DO NOTHING;

-- Sample TER route
INSERT INTO routes (name, transport_type_id) VALUES
    ('TER Ligne 1 — Dakar / Diamniadio', 2)
ON CONFLICT DO NOTHING;

-- Sample DDD route
INSERT INTO routes (name, transport_type_id) VALUES
    ('DDD Ligne 7 — Plateau / Ouakam', 3)
ON CONFLICT DO NOTHING;

-- Route stations for BRT Ligne 1
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (1, 1, 1),
    (1, 2, 2),
    (1, 3, 3),
    (1, 4, 4),
    (1, 5, 5)
ON CONFLICT DO NOTHING;

-- Route stations for TER Ligne 1
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (2, 6, 1),
    (2, 7, 2),
    (2, 8, 3),
    (2, 9, 4),
    (2, 10, 5)
ON CONFLICT DO NOTHING;

-- Route stations for DDD Ligne 7
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (3, 11, 1),
    (3, 12, 2),
    (3, 13, 3),
    (3, 14, 4),
    (3, 15, 5)
ON CONFLICT DO NOTHING;

-- Travel times for BRT Ligne 1
INSERT INTO travel_times (route_id, from_station_id, to_station_id, avg_minutes) VALUES
    (1, 1, 2, 8),
    (1, 2, 3, 12),
    (1, 3, 4, 15),
    (1, 4, 5, 6)
ON CONFLICT DO NOTHING;

-- Travel times for TER Ligne 1
INSERT INTO travel_times (route_id, from_station_id, to_station_id, avg_minutes) VALUES
    (2, 6, 7, 5),
    (2, 7, 8, 7),
    (2, 8, 9, 12),
    (2, 9, 10, 15)
ON CONFLICT DO NOTHING;

-- Travel times for DDD Ligne 7
INSERT INTO travel_times (route_id, from_station_id, to_station_id, avg_minutes) VALUES
    (3, 11, 12, 10),
    (3, 12, 13, 8),
    (3, 13, 14, 7),
    (3, 14, 15, 9)
ON CONFLICT DO NOTHING;
