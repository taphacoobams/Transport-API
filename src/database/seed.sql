-- =============================================================
-- Seed data — Dakar Mobility Transport API
-- Networks: TER (Dakar Regional Express Train) + BRT (Bus Rapid Transit)
-- =============================================================

-- ─── Transport types ──────────────────────────────────────────
INSERT INTO transport_types (id, name) VALUES
    (1, 'TER'),
    (2, 'BRT');

-- ─── Routes ───────────────────────────────────────────────────
INSERT INTO routes (id, name, transport_type_id) VALUES
    (1, 'TER Dakar-Diamniadio', 1),
    (2, 'BRT B1',               2),
    (3, 'BRT B2',               2),
    (4, 'BRT B3',               2);

-- ─── TER Stations (id 1–13) ───────────────────────────────────
INSERT INTO stations (id, name, transport_type_id, lat, lon, quartier) VALUES
    ( 1, 'Dakar',           1,  14.6709, -17.4312, 'Plateau'),
    ( 2, 'Colobane',        1,  14.6937, -17.4442, 'Colobane'),
    ( 3, 'Hann',            1,  14.7069, -17.4238, 'Hann'),
    ( 4, 'Dalifort',        1,  14.7213, -17.4042, 'Dalifort'),
    ( 5, 'Baux Maraichers', 1,  14.7298, -17.3912, 'Baux Maraichers'),
    ( 6, 'Pikine',          1,  14.7500, -17.3900, 'Pikine'),
    ( 7, 'Thiaroye',        1,  14.7560, -17.3680, 'Thiaroye'),
    ( 8, 'Yeumbeul',        1,  14.7620, -17.3380, 'Yeumbeul'),
    ( 9, 'Keur Massar',     1,  14.7700, -17.3080, 'Keur Massar'),
    (10, 'Mbao',            1,  14.7550, -17.2780, 'Mbao'),
    (11, 'PNR Rufisque',    1,  14.7160, -17.2740, 'Rufisque'),
    (12, 'Bargny',          1,  14.6970, -17.2280, 'Bargny'),
    (13, 'Diamniadio',      1,  14.7070, -17.1850, 'Diamniadio');

-- ─── BRT Stations (id 14–36) ──────────────────────────────────
INSERT INTO stations (id, name, transport_type_id, lat, lon, quartier) VALUES
    (14, 'Papa Gueye Fall',              2,  14.6700, -17.4380, 'Plateau'),
    (15, 'Grande Mosquee',              2,  14.6750, -17.4420, 'Médina'),
    (16, 'Place de la Nation',          2,  14.6780, -17.4460, 'Médina'),
    (17, 'Dial Diop',                   2,  14.6820, -17.4500, 'Médina'),
    (18, 'Grand Dakar',                 2,  14.6900, -17.4550, 'Grand Dakar'),
    (19, 'Liberte 1',                   2,  14.6960, -17.4590, 'Liberté'),
    (20, 'Sacre Coeur',                 2,  14.7030, -17.4630, 'Sacré-Cœur'),
    (21, 'Liberte 5',                   2,  14.7080, -17.4660, 'Liberté'),
    (22, 'Liberte 6',                   2,  14.7130, -17.4680, 'Liberté'),
    (23, 'Khar Yallah',                 2,  14.7200, -17.4700, 'Khar Yallah'),
    (24, 'Scat Urbam',                  2,  14.7260, -17.4660, 'Parcelles Assainies'),
    (25, 'Cardinal Hyacinthe Thiandoum',2,  14.7320, -17.4620, 'Parcelles Assainies'),
    (26, 'Grand Medine',                2,  14.7380, -17.4580, 'Grand Médine'),
    (27, 'Police Parcelles',            2,  14.7430, -17.4530, 'Parcelles Assainies'),
    (28, 'Croisement 22',               2,  14.7490, -17.4470, 'Parcelles Assainies'),
    (29, 'Parcelles',                   2,  14.7560, -17.4410, 'Parcelles Assainies'),
    (30, 'Ndingala',                    2,  14.7620, -17.4330, 'Guédiawaye'),
    (31, 'Golf Sud',                    2,  14.7680, -17.4250, 'Guédiawaye'),
    (32, 'Dalal Jam',                   2,  14.7730, -17.4150, 'Guédiawaye'),
    (33, 'Fith Mith',                   2,  14.7780, -17.4050, 'Guédiawaye'),
    (34, 'Golf Nord',                   2,  14.7840, -17.3960, 'Guédiawaye'),
    (35, 'Guediawaye Tapee',            2,  14.7890, -17.3870, 'Guédiawaye'),
    (36, 'Prefecture Guediawaye',       2,  14.7940, -17.3780, 'Guédiawaye');

-- ─── Route stations: TER (route 1) ────────────────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (1,  1,  1),
    (1,  2,  2),
    (1,  3,  3),
    (1,  4,  4),
    (1,  5,  5),
    (1,  6,  6),
    (1,  7,  7),
    (1,  8,  8),
    (1,  9,  9),
    (1, 10, 10),
    (1, 11, 11),
    (1, 12, 12),
    (1, 13, 13);

-- ─── Route stations: BRT B1 omnibus (route 2) ─────────────────
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (2, 14,  1),
    (2, 15,  2),
    (2, 16,  3),
    (2, 17,  4),
    (2, 18,  5),
    (2, 19,  6),
    (2, 20,  7),
    (2, 21,  8),
    (2, 22,  9),
    (2, 23, 10),
    (2, 24, 11),
    (2, 25, 12),
    (2, 26, 13),
    (2, 27, 14),
    (2, 28, 15),
    (2, 29, 16),
    (2, 30, 17),
    (2, 31, 18),
    (2, 32, 19),
    (2, 33, 20),
    (2, 34, 21),
    (2, 35, 22),
    (2, 36, 23);

-- ─── Route stations: BRT B2 express (route 3) ─────────────────
-- Papa Gueye Fall → Place de la Nation → Grand Dakar → Sacre Coeur
-- → Grand Medine → Dalal Jam → Prefecture Guediawaye
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (3, 14, 1),
    (3, 16, 2),
    (3, 18, 3),
    (3, 20, 4),
    (3, 26, 5),
    (3, 32, 6),
    (3, 36, 7);

-- ─── Route stations: BRT B3 express (route 4) ─────────────────
-- Papa Gueye Fall → Place de la Nation → Khar Yallah → Croisement 22
-- → Parcelles → Guediawaye Tapee → Prefecture Guediawaye
INSERT INTO route_stations (route_id, station_id, station_order) VALUES
    (4, 14, 1),
    (4, 16, 2),
    (4, 23, 3),
    (4, 28, 4),
    (4, 29, 5),
    (4, 35, 6),
    (4, 36, 7);

-- ─── Travel times: TER (route 1) — total ~46 min ──────────────
-- Dakar→Colobane→Hann→Dalifort→Baux Maraichers→Pikine→Thiaroye
-- →Yeumbeul→Keur Massar→Mbao→PNR Rufisque→Bargny→Diamniadio
INSERT INTO travel_times (route_id, from_station_id, to_station_id, minutes) VALUES
    (1,  1,  2,  3),
    (1,  2,  3,  3),
    (1,  3,  4,  3),
    (1,  4,  5,  4),
    (1,  5,  6,  3),
    (1,  6,  7,  4),
    (1,  7,  8,  4),
    (1,  8,  9,  5),
    (1,  9, 10,  4),
    (1, 10, 11,  4),
    (1, 11, 12,  4),
    (1, 12, 13,  5);

-- ─── Travel times: BRT B1 omnibus (route 2) ───────────────────
INSERT INTO travel_times (route_id, from_station_id, to_station_id, minutes) VALUES
    (2, 14, 15,  2),
    (2, 15, 16,  5),
    (2, 16, 17,  2),
    (2, 17, 18,  2),
    (2, 18, 19,  3),
    (2, 19, 20,  2),
    (2, 20, 21,  2),
    (2, 21, 22,  2),
    (2, 22, 23,  3),
    (2, 23, 24,  2),
    (2, 24, 25,  2),
    (2, 25, 26,  3),
    (2, 26, 27,  3),
    (2, 27, 28,  2),
    (2, 28, 29,  3),
    (2, 29, 30,  2),
    (2, 30, 31,  3),
    (2, 31, 32,  2),
    (2, 32, 33,  2),
    (2, 33, 34,  3),
    (2, 34, 35,  2),
    (2, 35, 36,  2);

-- ─── Travel times: BRT B2 express (route 3) ───────────────────
-- Papa Gueye Fall→Place de la Nation: 6
-- Place de la Nation→Grand Dakar: 4
-- Grand Dakar→Sacre Coeur: 6
-- Sacre Coeur→Grand Medine: 9
-- Grand Medine→Dalal Jam: 11
-- Dalal Jam→Prefecture Guediawaye: 7
INSERT INTO travel_times (route_id, from_station_id, to_station_id, minutes) VALUES
    (3, 14, 16,  6),
    (3, 16, 18,  4),
    (3, 18, 20,  6),
    (3, 20, 26,  9),
    (3, 26, 32, 11),
    (3, 32, 36,  7);

-- ─── Travel times: BRT B3 express (route 4) ───────────────────
-- Papa Gueye Fall→Place de la Nation: 5
-- Place de la Nation→Khar Yallah: 13
-- Khar Yallah→Croisement 22: 9
-- Croisement 22→Parcelles: 3
-- Parcelles→Guediawaye Tapee: 8
-- Guediawaye Tapee→Prefecture Guediawaye: 2
INSERT INTO travel_times (route_id, from_station_id, to_station_id, minutes) VALUES
    (4, 14, 16,  5),
    (4, 16, 23, 13),
    (4, 23, 28,  9),
    (4, 28, 29,  3),
    (4, 29, 35,  8),
    (4, 35, 36,  2);
