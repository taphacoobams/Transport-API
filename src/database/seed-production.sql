-- =============================================================
-- Seed data — Dakar Mobility Transport API
-- Compatible with production schema (networks table)
-- Networks: TER, BRT, DDD
-- =============================================================

-- Clear existing data
TRUNCATE TABLE connections, zone_stations, zones, fares, operating_hours, 
               transfer_edges, transport_edges, travel_times, route_stations, 
               routes, stations, networks RESTART IDENTITY CASCADE;

-- ─── Networks ────────────────────────────────────────────────
INSERT INTO networks (id, network_code, name, operator, transport_type, corridor_length_km, total_stations) VALUES
    (1, 'TER',  'Train Express Régional',    'SENTER',           'TER',  36,  14),
    (2, 'BRT',  'Bus Rapid Transit Dakar',   'CETUD/Dakar Mobilité', 'BRT',  18.3, 23),
    (3, 'DDD',  'Dakar Dem Dikk',            'DDD SA',           'DDD',  NULL, NULL),
    (4, 'AFTU', 'AFTU Minibus',              'AFTU',             'AFTU', NULL, NULL);

SELECT setval('networks_id_seq', (SELECT MAX(id) FROM networks));

-- ─── TER Stations (id 1–14) ──────────────────────────────────
INSERT INTO stations (id, station_code, station_name, latitude, longitude, network_id, district) VALUES
    ( 1, 'TER-DAK',  'Dakar',              14.6709, -17.4312, 1, 'Plateau'),
    ( 2, 'TER-COL',  'Colobane',           14.6937, -17.4442, 1, 'Colobane'),
    ( 3, 'TER-HAN',  'Hann',               14.7069, -17.4238, 1, 'Hann'),
    ( 4, 'TER-DAL',  'Dalifort',           14.7213, -17.4042, 1, 'Dalifort'),
    ( 5, 'TER-BAU',  'Baux Maraichers',    14.7298, -17.3912, 1, 'Baux Maraichers'),
    ( 6, 'TER-PIK',  'Pikine',             14.7500, -17.3900, 1, 'Pikine'),
    ( 7, 'TER-THI',  'Thiaroye',           14.7560, -17.3680, 1, 'Thiaroye'),
    ( 8, 'TER-YEU',  'Yeumbeul',           14.7620, -17.3380, 1, 'Yeumbeul'),
    ( 9, 'TER-KMS',  'Keur Massar',        14.7700, -17.3080, 1, 'Keur Massar'),
    (10, 'TER-MBA',  'Mbao',               14.7550, -17.2780, 1, 'Mbao'),
    (11, 'TER-RUF',  'PNR Rufisque',       14.7160, -17.2740, 1, 'Rufisque'),
    (12, 'TER-BAR',  'Bargny',             14.6970, -17.2280, 1, 'Bargny'),
    (13, 'TER-DIA',  'Diamniadio',         14.7070, -17.1850, 1, 'Diamniadio'),
    (14, 'TER-AIBD', 'AIBD',               14.6697, -17.0731, 1, 'AIBD');

-- ─── BRT Stations (id 15–37) ─────────────────────────────────
INSERT INTO stations (id, station_code, station_name, latitude, longitude, network_id, district) VALUES
    (15, 'BRT-PGF',  'Papa Gueye Fall',              14.6700, -17.4380, 2, 'Plateau'),
    (16, 'BRT-GMO',  'Grande Mosquee',               14.6750, -17.4420, 2, 'Médina'),
    (17, 'BRT-PLN',  'Place de la Nation',           14.6780, -17.4460, 2, 'Médina'),
    (18, 'BRT-DDI',  'Dial Diop',                    14.6820, -17.4500, 2, 'Médina'),
    (19, 'BRT-GDK',  'Grand Dakar',                  14.6900, -17.4550, 2, 'Grand Dakar'),
    (20, 'BRT-LB1',  'Liberte 1',                    14.6960, -17.4590, 2, 'Liberté'),
    (21, 'BRT-SCO',  'Sacre Coeur',                  14.7030, -17.4630, 2, 'Sacré-Cœur'),
    (22, 'BRT-LB5',  'Liberte 5',                    14.7080, -17.4660, 2, 'Liberté'),
    (23, 'BRT-LB6',  'Liberte 6',                    14.7130, -17.4680, 2, 'Liberté'),
    (24, 'BRT-KYA',  'Khar Yallah',                  14.7200, -17.4700, 2, 'Khar Yallah'),
    (25, 'BRT-SCU',  'Scat Urbam',                   14.7260, -17.4660, 2, 'Parcelles Assainies'),
    (26, 'BRT-CHT',  'Cardinal Hyacinthe Thiandoum', 14.7320, -17.4620, 2, 'Parcelles Assainies'),
    (27, 'BRT-GME',  'Grand Medine',                 14.7380, -17.4580, 2, 'Grand Médine'),
    (28, 'BRT-POP',  'Police Parcelles',             14.7430, -17.4530, 2, 'Parcelles Assainies'),
    (29, 'BRT-C22',  'Croisement 22',                14.7490, -17.4470, 2, 'Parcelles Assainies'),
    (30, 'BRT-PAR',  'Parcelles',                    14.7560, -17.4410, 2, 'Parcelles Assainies'),
    (31, 'BRT-NDI',  'Ndingala',                     14.7620, -17.4330, 2, 'Guédiawaye'),
    (32, 'BRT-GSU',  'Golf Sud',                     14.7680, -17.4250, 2, 'Guédiawaye'),
    (33, 'BRT-DJA',  'Dalal Jam',                    14.7730, -17.4150, 2, 'Guédiawaye'),
    (34, 'BRT-FMI',  'Fith Mith',                    14.7780, -17.4050, 2, 'Guédiawaye'),
    (35, 'BRT-GNO',  'Golf Nord',                    14.7840, -17.3960, 2, 'Guédiawaye'),
    (36, 'BRT-GTA',  'Guediawaye Tapee',             14.7890, -17.3870, 2, 'Guédiawaye'),
    (37, 'BRT-PRE',  'Prefecture Guediawaye',        14.7940, -17.3780, 2, 'Guédiawaye');

-- ─── DDD Stations (id 38–57) - Ligne 1 et 2 ──────────────────
INSERT INTO stations (id, station_code, station_name, latitude, longitude, network_id, district) VALUES
    (38, 'DDD-PLA',  'Place de l''Indépendance',     14.6694, -17.4378, 3, 'Plateau'),
    (39, 'DDD-SAN',  'Sandaga',                      14.6720, -17.4400, 3, 'Plateau'),
    (40, 'DDD-MED',  'Médina',                       14.6850, -17.4480, 3, 'Médina'),
    (41, 'DDD-FAS',  'Fass',                         14.6920, -17.4520, 3, 'Fass'),
    (42, 'DDD-GUE',  'Gueule Tapée',                 14.6980, -17.4560, 3, 'Gueule Tapée'),
    (43, 'DDD-OUA',  'Ouakam',                       14.7220, -17.4780, 3, 'Ouakam'),
    (44, 'DDD-YOF',  'Yoff',                         14.7450, -17.4850, 3, 'Yoff'),
    (45, 'DDD-NAG',  'Ngor',                         14.7520, -17.5050, 3, 'Ngor'),
    (46, 'DDD-ALM',  'Almadies',                     14.7480, -17.5150, 3, 'Almadies'),
    (47, 'DDD-CAM',  'Cambérène',                    14.7680, -17.4620, 3, 'Cambérène'),
    (48, 'DDD-PAT',  'Patte d''Oie',                 14.7350, -17.4550, 3, 'Patte d''Oie'),
    (49, 'DDD-HLM',  'HLM',                          14.7150, -17.4450, 3, 'HLM'),
    (50, 'DDD-CAS',  'Castor',                       14.7280, -17.4380, 3, 'Castor'),
    (51, 'DDD-DER',  'Derklé',                       14.7380, -17.4320, 3, 'Derklé'),
    (52, 'DDD-GRA',  'Grand Yoff',                   14.7480, -17.4280, 3, 'Grand Yoff'),
    (53, 'DDD-PAU',  'Parcelles Unité 17',           14.7620, -17.4380, 3, 'Parcelles Assainies'),
    (54, 'DDD-GUW',  'Guédiawaye',                   14.7850, -17.3950, 3, 'Guédiawaye'),
    (55, 'DDD-PIK',  'Pikine Icotaf',                14.7580, -17.3920, 3, 'Pikine'),
    (56, 'DDD-THA',  'Thiaroye Gare',                14.7620, -17.3720, 3, 'Thiaroye'),
    (57, 'DDD-KMA',  'Keur Massar Centre',           14.7780, -17.3150, 3, 'Keur Massar');

SELECT setval('stations_id_seq', (SELECT MAX(id) FROM stations));

-- ─── Routes ──────────────────────────────────────────────────
INSERT INTO routes (id, route_code, route_name, network_id, route_type, origin_terminal, destination_terminal) VALUES
    (1, 'TER-L1',  'TER Dakar-AIBD',           1, 'express',  'Dakar',            'AIBD'),
    (2, 'BRT-B1',  'BRT Ligne B1 Omnibus',     2, 'omnibus',  'Papa Gueye Fall',  'Prefecture Guediawaye'),
    (3, 'BRT-B2',  'BRT Ligne B2 Express',     2, 'express',  'Papa Gueye Fall',  'Prefecture Guediawaye'),
    (4, 'BRT-B3',  'BRT Ligne B3 Express',     2, 'express',  'Papa Gueye Fall',  'Prefecture Guediawaye'),
    (5, 'DDD-L1',  'DDD Ligne 1 Plateau-Yoff', 3, 'omnibus',  'Place Indépendance', 'Almadies'),
    (6, 'DDD-L2',  'DDD Ligne 2 Plateau-Keur Massar', 3, 'omnibus', 'Place Indépendance', 'Keur Massar');

SELECT setval('routes_id_seq', (SELECT MAX(id) FROM routes));

-- ─── Route stations: TER (route 1) ───────────────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (1,  1,  1), (1,  2,  2), (1,  3,  3), (1,  4,  4), (1,  5,  5),
    (1,  6,  6), (1,  7,  7), (1,  8,  8), (1,  9,  9), (1, 10, 10),
    (1, 11, 11), (1, 12, 12), (1, 13, 13), (1, 14, 14);

-- ─── Route stations: BRT B1 omnibus (route 2) ────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (2, 15,  1), (2, 16,  2), (2, 17,  3), (2, 18,  4), (2, 19,  5),
    (2, 20,  6), (2, 21,  7), (2, 22,  8), (2, 23,  9), (2, 24, 10),
    (2, 25, 11), (2, 26, 12), (2, 27, 13), (2, 28, 14), (2, 29, 15),
    (2, 30, 16), (2, 31, 17), (2, 32, 18), (2, 33, 19), (2, 34, 20),
    (2, 35, 21), (2, 36, 22), (2, 37, 23);

-- ─── Route stations: BRT B2 express (route 3) ────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (3, 15, 1), (3, 17, 2), (3, 19, 3), (3, 21, 4), (3, 27, 5), (3, 33, 6), (3, 37, 7);

-- ─── Route stations: BRT B3 express (route 4) ────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (4, 15, 1), (4, 17, 2), (4, 24, 3), (4, 29, 4), (4, 30, 5), (4, 36, 6), (4, 37, 7);

-- ─── Route stations: DDD Ligne 1 (route 5) ───────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (5, 38, 1), (5, 39, 2), (5, 40, 3), (5, 41, 4), (5, 42, 5),
    (5, 43, 6), (5, 44, 7), (5, 45, 8), (5, 46, 9);

-- ─── Route stations: DDD Ligne 2 (route 6) ───────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (6, 38, 1), (6, 39, 2), (6, 49, 3), (6, 50, 4), (6, 51, 5),
    (6, 52, 6), (6, 53, 7), (6, 54, 8), (6, 55, 9), (6, 56, 10), (6, 57, 11);

-- ─── Travel times: TER (route 1) — total ~55 min ─────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES
    (1,  1,  2,  3), (1,  2,  3,  3), (1,  3,  4,  3), (1,  4,  5,  4),
    (1,  5,  6,  3), (1,  6,  7,  4), (1,  7,  8,  4), (1,  8,  9,  5),
    (1,  9, 10,  4), (1, 10, 11,  4), (1, 11, 12,  4), (1, 12, 13,  5),
    (1, 13, 14, 12);

-- ─── Travel times: BRT B1 omnibus (route 2) ──────────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES
    (2, 15, 16,  2), (2, 16, 17,  2), (2, 17, 18,  2), (2, 18, 19,  2),
    (2, 19, 20,  3), (2, 20, 21,  2), (2, 21, 22,  2), (2, 22, 23,  2),
    (2, 23, 24,  3), (2, 24, 25,  2), (2, 25, 26,  2), (2, 26, 27,  3),
    (2, 27, 28,  3), (2, 28, 29,  2), (2, 29, 30,  3), (2, 30, 31,  2),
    (2, 31, 32,  3), (2, 32, 33,  2), (2, 33, 34,  2), (2, 34, 35,  3),
    (2, 35, 36,  2), (2, 36, 37,  2);

-- ─── Travel times: BRT B2 express (route 3) ──────────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES
    (3, 15, 17,  4), (3, 17, 19,  4), (3, 19, 21,  6), (3, 21, 27,  9),
    (3, 27, 33, 11), (3, 33, 37,  7);

-- ─── Travel times: BRT B3 express (route 4) ──────────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES
    (4, 15, 17,  4), (4, 17, 24, 10), (4, 24, 29,  8), (4, 29, 30,  3),
    (4, 30, 36,  8), (4, 36, 37,  2);

-- ─── Travel times: DDD Ligne 1 (route 5) ─────────────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES
    (5, 38, 39,  3), (5, 39, 40,  5), (5, 40, 41,  4), (5, 41, 42,  4),
    (5, 42, 43,  8), (5, 43, 44,  6), (5, 44, 45,  5), (5, 45, 46,  4);

-- ─── Travel times: DDD Ligne 2 (route 6) ─────────────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES
    (6, 38, 39,  3), (6, 39, 49,  6), (6, 49, 50,  5), (6, 50, 51,  5),
    (6, 51, 52,  6), (6, 52, 53,  7), (6, 53, 54,  8), (6, 54, 55,  6),
    (6, 55, 56,  5), (6, 56, 57, 12);

-- ─── Transport edges (for routing graph) ────────────────────
-- TER edges
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 1;
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 1;

-- BRT B1 edges
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 2;
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 2;

-- BRT B2 edges
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 3;
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 3;

-- BRT B3 edges
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 4;
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 4;

-- DDD L1 edges
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 5;
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 5;

-- DDD L2 edges
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 6;
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times WHERE route_id = 6;

-- ─── Transfer edges (walking connections between networks) ───
-- TER Dakar ↔ BRT Papa Gueye Fall (~800m, 10 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (1, 15, 800, 10), (15, 1, 800, 10);

-- TER Colobane ↔ DDD Médina (~500m, 6 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (2, 40, 500, 6), (40, 2, 500, 6);

-- BRT Sacre Coeur ↔ DDD Patte d'Oie (~400m, 5 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (21, 48, 400, 5), (48, 21, 400, 5);

-- TER Pikine ↔ DDD Pikine Icotaf (~600m, 8 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (6, 55, 600, 8), (55, 6, 600, 8);

-- BRT Prefecture Guediawaye ↔ DDD Guédiawaye (~300m, 4 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (37, 54, 300, 4), (54, 37, 300, 4);

-- TER Thiaroye ↔ DDD Thiaroye Gare (~200m, 3 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (7, 56, 200, 3), (56, 7, 200, 3);

-- TER Keur Massar ↔ DDD Keur Massar Centre (~400m, 5 min walk)
INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes) VALUES
    (9, 57, 400, 5), (57, 9, 400, 5);

-- ─── Zones (fare zones for TER) ──────────────────────────────
INSERT INTO zones (id, zone_code, zone_name, network_id) VALUES
    (1, 'Z1', 'Zone 1 - Dakar Centre',    1),
    (2, 'Z2', 'Zone 2 - Pikine',          1),
    (3, 'Z3', 'Zone 3 - Rufisque',        1),
    (4, 'Z4', 'Zone 4 - Diamniadio-AIBD', 1);

SELECT setval('zones_id_seq', (SELECT MAX(id) FROM zones));

-- ─── Zone stations mapping ───────────────────────────────────
INSERT INTO zone_stations (zone_id, station_id) VALUES
    (1, 1), (1, 2), (1, 3), (1, 4),           -- Zone 1: Dakar, Colobane, Hann, Dalifort
    (2, 5), (2, 6), (2, 7), (2, 8), (2, 9),   -- Zone 2: Baux Maraichers to Keur Massar
    (3, 10), (3, 11), (3, 12),                -- Zone 3: Mbao, Rufisque, Bargny
    (4, 13), (4, 14);                         -- Zone 4: Diamniadio, AIBD

-- ─── Fares ───────────────────────────────────────────────────
-- TER fares (zone-based)
INSERT INTO fares (network_id, zones_travelled, price_fcfa) VALUES
    (1, '1',   500),   -- Same zone
    (1, '1-2', 1000),  -- Zone 1 to Zone 2
    (1, '1-3', 1500),  -- Zone 1 to Zone 3
    (1, '1-4', 2000),  -- Zone 1 to Zone 4
    (1, '2-3', 1000),  -- Zone 2 to Zone 3
    (1, '2-4', 1500),  -- Zone 2 to Zone 4
    (1, '3-4', 1000);  -- Zone 3 to Zone 4

-- BRT fares (fixed)
INSERT INTO fares (network_id, zones_travelled, price_fcfa) VALUES
    (2, 'standard', 500),
    (2, 'express',  500);

-- ─── Operating hours ─────────────────────────────────────────
INSERT INTO operating_hours (route_id, day_type, days, first_departure, last_departure, peak_frequency_minutes, offpeak_frequency_minutes) VALUES
    (1, 'weekday', ARRAY['monday','tuesday','wednesday','thursday','friday'], '05:30', '22:00', 10, 20),
    (1, 'weekend', ARRAY['saturday','sunday'], '06:00', '21:00', 15, 30),
    (2, 'weekday', ARRAY['monday','tuesday','wednesday','thursday','friday'], '05:00', '23:00', 5, 10),
    (2, 'weekend', ARRAY['saturday','sunday'], '06:00', '22:00', 10, 15),
    (3, 'weekday', ARRAY['monday','tuesday','wednesday','thursday','friday'], '06:00', '22:00', 10, 20),
    (4, 'weekday', ARRAY['monday','tuesday','wednesday','thursday','friday'], '06:00', '22:00', 10, 20),
    (5, 'weekday', ARRAY['monday','tuesday','wednesday','thursday','friday'], '05:30', '21:00', 15, 30),
    (6, 'weekday', ARRAY['monday','tuesday','wednesday','thursday','friday'], '05:30', '21:00', 15, 30);

-- ─── Update station geometry (PostGIS) ───────────────────────
UPDATE stations SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ─── Summary ─────────────────────────────────────────────────
SELECT 'Networks:' AS table_name, COUNT(*) AS count FROM networks
UNION ALL SELECT 'Stations:', COUNT(*) FROM stations
UNION ALL SELECT 'Routes:', COUNT(*) FROM routes
UNION ALL SELECT 'Route Stations:', COUNT(*) FROM route_stations
UNION ALL SELECT 'Travel Times:', COUNT(*) FROM travel_times
UNION ALL SELECT 'Transport Edges:', COUNT(*) FROM transport_edges
UNION ALL SELECT 'Transfer Edges:', COUNT(*) FROM transfer_edges
UNION ALL SELECT 'Zones:', COUNT(*) FROM zones
UNION ALL SELECT 'Zone Stations:', COUNT(*) FROM zone_stations
UNION ALL SELECT 'Fares:', COUNT(*) FROM fares
UNION ALL SELECT 'Operating Hours:', COUNT(*) FROM operating_hours;
