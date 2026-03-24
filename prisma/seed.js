const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database…');

  // ─── Networks ─────────────────────────────────────────────────────────────
  const networks = [
    { id: 1, networkCode: 'TER',           name: 'Train Express Régional',  operator: 'SENTER',        transportType: 'train' },
    { id: 2, networkCode: 'BRT',           name: 'Bus Rapid Transit Dakar', operator: 'CETUD',         transportType: 'bus_rapid_transit' },
    { id: 3, networkCode: 'DDD',           name: 'Dakar Dem Dikk',          operator: 'Dakar Dem Dikk', transportType: 'bus' },
    { id: 4, networkCode: 'AFTU',          name: 'AFTU Minibus',            operator: 'AFTU',          transportType: 'minibus' },
    { id: 5, networkCode: 'CAR_RAPIDE',    name: 'Car Rapide',              operator: null,            transportType: 'car_rapide' },
    { id: 6, networkCode: 'NDIAGA_NDIAYE', name: 'Ndiaga Ndiaye',          operator: null,            transportType: 'ndiaga_ndiaye' },
  ];

  for (const n of networks) {
    await prisma.network.upsert({
      where:  { id: n.id },
      update: { name: n.name, operator: n.operator, transportType: n.transportType },
      create: n,
    });
  }
  console.log('Networks:', networks.map(n => n.networkCode).join(', '));

  // ─── TER Stations (id 1–13) ───────────────────────────────────────────────
  const terStations = [
    { id: 1,  stationCode: 'TER_S01', stationName: 'Dakar',           latitude: 14.6709, longitude: -17.4312, district: 'Plateau',         networkId: 1 },
    { id: 2,  stationCode: 'TER_S02', stationName: 'Colobane',        latitude: 14.6937, longitude: -17.4442, district: 'Colobane',         networkId: 1 },
    { id: 3,  stationCode: 'TER_S03', stationName: 'Hann',            latitude: 14.7069, longitude: -17.4238, district: 'Hann',             networkId: 1 },
    { id: 4,  stationCode: 'TER_S04', stationName: 'Dalifort',        latitude: 14.7213, longitude: -17.4042, district: 'Dalifort',         networkId: 1 },
    { id: 5,  stationCode: 'TER_S05', stationName: 'Baux Maraichers', latitude: 14.7298, longitude: -17.3912, district: 'Baux Maraichers',  networkId: 1 },
    { id: 6,  stationCode: 'TER_S06', stationName: 'Pikine',          latitude: 14.7500, longitude: -17.3900, district: 'Pikine',           networkId: 1 },
    { id: 7,  stationCode: 'TER_S07', stationName: 'Thiaroye',        latitude: 14.7560, longitude: -17.3680, district: 'Thiaroye',         networkId: 1 },
    { id: 8,  stationCode: 'TER_S08', stationName: 'Yeumbeul',        latitude: 14.7620, longitude: -17.3380, district: 'Yeumbeul',         networkId: 1 },
    { id: 9,  stationCode: 'TER_S09', stationName: 'Keur Massar',     latitude: 14.7700, longitude: -17.3080, district: 'Keur Massar',      networkId: 1 },
    { id: 10, stationCode: 'TER_S10', stationName: 'Mbao',            latitude: 14.7550, longitude: -17.2780, district: 'Mbao',             networkId: 1 },
    { id: 11, stationCode: 'TER_S11', stationName: 'PNR Rufisque',    latitude: 14.7160, longitude: -17.2740, district: 'Rufisque',         networkId: 1 },
    { id: 12, stationCode: 'TER_S12', stationName: 'Bargny',          latitude: 14.6970, longitude: -17.2280, district: 'Bargny',           networkId: 1 },
    { id: 13, stationCode: 'TER_S13', stationName: 'Diamniadio',      latitude: 14.7070, longitude: -17.1850, district: 'Diamniadio',       networkId: 1 },
  ];

  // ─── BRT Stations (id 14–36) ──────────────────────────────────────────────
  const brtStations = [
    { id: 14, stationCode: 'BRT_S01', stationName: 'Papa Gueye Fall',              latitude: 14.6700, longitude: -17.4380, district: 'Plateau',             networkId: 2 },
    { id: 15, stationCode: 'BRT_S02', stationName: 'Grande Mosquee',               latitude: 14.6750, longitude: -17.4420, district: 'Médina',              networkId: 2 },
    { id: 16, stationCode: 'BRT_S03', stationName: 'Place de la Nation',           latitude: 14.6780, longitude: -17.4460, district: 'Médina',              networkId: 2 },
    { id: 17, stationCode: 'BRT_S04', stationName: 'Dial Diop',                    latitude: 14.6820, longitude: -17.4500, district: 'Médina',              networkId: 2 },
    { id: 18, stationCode: 'BRT_S05', stationName: 'Grand Dakar',                  latitude: 14.6900, longitude: -17.4550, district: 'Grand Dakar',         networkId: 2 },
    { id: 19, stationCode: 'BRT_S06', stationName: 'Liberte 1',                    latitude: 14.6960, longitude: -17.4590, district: 'Liberté',             networkId: 2 },
    { id: 20, stationCode: 'BRT_S07', stationName: 'Sacre Coeur',                  latitude: 14.7030, longitude: -17.4630, district: 'Sacré-Cœur',          networkId: 2 },
    { id: 21, stationCode: 'BRT_S08', stationName: 'Liberte 5',                    latitude: 14.7080, longitude: -17.4660, district: 'Liberté',             networkId: 2 },
    { id: 22, stationCode: 'BRT_S09', stationName: 'Liberte 6',                    latitude: 14.7130, longitude: -17.4680, district: 'Liberté',             networkId: 2 },
    { id: 23, stationCode: 'BRT_S10', stationName: 'Khar Yallah',                  latitude: 14.7200, longitude: -17.4700, district: 'Khar Yallah',         networkId: 2 },
    { id: 24, stationCode: 'BRT_S11', stationName: 'Scat Urbam',                   latitude: 14.7260, longitude: -17.4660, district: 'Parcelles Assainies', networkId: 2 },
    { id: 25, stationCode: 'BRT_S12', stationName: 'Cardinal Hyacinthe Thiandoum', latitude: 14.7320, longitude: -17.4620, district: 'Parcelles Assainies', networkId: 2 },
    { id: 26, stationCode: 'BRT_S13', stationName: 'Grand Medine',                 latitude: 14.7380, longitude: -17.4580, district: 'Grand Médine',        networkId: 2 },
    { id: 27, stationCode: 'BRT_S14', stationName: 'Police Parcelles',             latitude: 14.7430, longitude: -17.4530, district: 'Parcelles Assainies', networkId: 2 },
    { id: 28, stationCode: 'BRT_S15', stationName: 'Croisement 22',                latitude: 14.7490, longitude: -17.4470, district: 'Parcelles Assainies', networkId: 2 },
    { id: 29, stationCode: 'BRT_S16', stationName: 'Parcelles',                    latitude: 14.7560, longitude: -17.4410, district: 'Parcelles Assainies', networkId: 2 },
    { id: 30, stationCode: 'BRT_S17', stationName: 'Ndingala',                     latitude: 14.7620, longitude: -17.4330, district: 'Guédiawaye',          networkId: 2 },
    { id: 31, stationCode: 'BRT_S18', stationName: 'Golf Sud',                     latitude: 14.7680, longitude: -17.4250, district: 'Guédiawaye',          networkId: 2 },
    { id: 32, stationCode: 'BRT_S19', stationName: 'Dalal Jam',                    latitude: 14.7730, longitude: -17.4150, district: 'Guédiawaye',          networkId: 2 },
    { id: 33, stationCode: 'BRT_S20', stationName: 'Fith Mith',                    latitude: 14.7780, longitude: -17.4050, district: 'Guédiawaye',          networkId: 2 },
    { id: 34, stationCode: 'BRT_S21', stationName: 'Golf Nord',                    latitude: 14.7840, longitude: -17.3960, district: 'Guédiawaye',          networkId: 2 },
    { id: 35, stationCode: 'BRT_S22', stationName: 'Guediawaye Tapee',             latitude: 14.7890, longitude: -17.3870, district: 'Guédiawaye',          networkId: 2 },
    { id: 36, stationCode: 'BRT_S23', stationName: 'Prefecture Guediawaye',        latitude: 14.7940, longitude: -17.3780, district: 'Guédiawaye',          networkId: 2 },
  ];

  for (const s of [...terStations, ...brtStations]) {
    await prisma.station.upsert({
      where:  { id: s.id },
      update: { stationName: s.stationName, latitude: s.latitude, longitude: s.longitude, district: s.district },
      create: s,
    });
  }
  console.log(`Stations: ${terStations.length} TER + ${brtStations.length} BRT = ${terStations.length + brtStations.length}`);

  // ─── Routes ───────────────────────────────────────────────────────────────
  const routes = [
    { id: 1, routeCode: 'TER_R1', routeName: 'TER Dakar-Diamniadio', networkId: 1, routeType: 'Principale', originTerminal: 'Dakar',         destinationTerminal: 'Diamniadio' },
    { id: 2, routeCode: 'BRT_B1', routeName: 'BRT B1 Omnibus',       networkId: 2, routeType: 'Omnibus',    originTerminal: 'Papa Gueye Fall', destinationTerminal: 'Prefecture Guediawaye' },
    { id: 3, routeCode: 'BRT_B2', routeName: 'BRT B2 Express',       networkId: 2, routeType: 'Express',    originTerminal: 'Papa Gueye Fall', destinationTerminal: 'Prefecture Guediawaye' },
    { id: 4, routeCode: 'BRT_B3', routeName: 'BRT B3 Express',       networkId: 2, routeType: 'Express',    originTerminal: 'Papa Gueye Fall', destinationTerminal: 'Prefecture Guediawaye' },
  ];

  for (const r of routes) {
    await prisma.route.upsert({
      where:  { id: r.id },
      update: { routeName: r.routeName, routeType: r.routeType },
      create: r,
    });
  }
  console.log('Routes: TER_R1, BRT_B1, BRT_B2, BRT_B3');

  // ─── Route Stations ───────────────────────────────────────────────────────
  const routeStationData = [
    { routeId: 1, order: [1,2,3,4,5,6,7,8,9,10,11,12,13] },
    { routeId: 2, order: [14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36] },
    { routeId: 3, order: [14,16,18,20,26,32,36] },
    { routeId: 4, order: [14,16,23,28,29,35,36] },
  ];

  for (const { routeId, order } of routeStationData) {
    for (let i = 0; i < order.length; i++) {
      await prisma.routeStation.upsert({
        where:  { routeId_stationId: { routeId, stationId: order[i] } },
        update: { stationOrder: i + 1 },
        create: { routeId, stationId: order[i], stationOrder: i + 1 },
      });
    }
  }
  console.log('Route stations: TER(13), BRT_B1(23), BRT_B2(7), BRT_B3(7)');

  // ─── Travel Times ─────────────────────────────────────────────────────────
  const travelTimes = [
    // TER
    { routeId: 1, fromStationId: 1,  toStationId: 2,  travelTimeMinutes: 3  },
    { routeId: 1, fromStationId: 2,  toStationId: 3,  travelTimeMinutes: 3  },
    { routeId: 1, fromStationId: 3,  toStationId: 4,  travelTimeMinutes: 3  },
    { routeId: 1, fromStationId: 4,  toStationId: 5,  travelTimeMinutes: 4  },
    { routeId: 1, fromStationId: 5,  toStationId: 6,  travelTimeMinutes: 3  },
    { routeId: 1, fromStationId: 6,  toStationId: 7,  travelTimeMinutes: 4  },
    { routeId: 1, fromStationId: 7,  toStationId: 8,  travelTimeMinutes: 4  },
    { routeId: 1, fromStationId: 8,  toStationId: 9,  travelTimeMinutes: 5  },
    { routeId: 1, fromStationId: 9,  toStationId: 10, travelTimeMinutes: 4  },
    { routeId: 1, fromStationId: 10, toStationId: 11, travelTimeMinutes: 4  },
    { routeId: 1, fromStationId: 11, toStationId: 12, travelTimeMinutes: 4  },
    { routeId: 1, fromStationId: 12, toStationId: 13, travelTimeMinutes: 5  },
    // BRT B1
    { routeId: 2, fromStationId: 14, toStationId: 15, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 15, toStationId: 16, travelTimeMinutes: 5  },
    { routeId: 2, fromStationId: 16, toStationId: 17, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 17, toStationId: 18, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 18, toStationId: 19, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 19, toStationId: 20, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 20, toStationId: 21, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 21, toStationId: 22, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 22, toStationId: 23, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 23, toStationId: 24, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 24, toStationId: 25, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 25, toStationId: 26, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 26, toStationId: 27, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 27, toStationId: 28, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 28, toStationId: 29, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 29, toStationId: 30, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 30, toStationId: 31, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 31, toStationId: 32, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 32, toStationId: 33, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 33, toStationId: 34, travelTimeMinutes: 3  },
    { routeId: 2, fromStationId: 34, toStationId: 35, travelTimeMinutes: 2  },
    { routeId: 2, fromStationId: 35, toStationId: 36, travelTimeMinutes: 2  },
    // BRT B2
    { routeId: 3, fromStationId: 14, toStationId: 16, travelTimeMinutes: 6  },
    { routeId: 3, fromStationId: 16, toStationId: 18, travelTimeMinutes: 4  },
    { routeId: 3, fromStationId: 18, toStationId: 20, travelTimeMinutes: 6  },
    { routeId: 3, fromStationId: 20, toStationId: 26, travelTimeMinutes: 9  },
    { routeId: 3, fromStationId: 26, toStationId: 32, travelTimeMinutes: 11 },
    { routeId: 3, fromStationId: 32, toStationId: 36, travelTimeMinutes: 7  },
    // BRT B3
    { routeId: 4, fromStationId: 14, toStationId: 16, travelTimeMinutes: 5  },
    { routeId: 4, fromStationId: 16, toStationId: 23, travelTimeMinutes: 13 },
    { routeId: 4, fromStationId: 23, toStationId: 28, travelTimeMinutes: 9  },
    { routeId: 4, fromStationId: 28, toStationId: 29, travelTimeMinutes: 3  },
    { routeId: 4, fromStationId: 29, toStationId: 35, travelTimeMinutes: 8  },
    { routeId: 4, fromStationId: 35, toStationId: 36, travelTimeMinutes: 2  },
  ];

  for (const tt of travelTimes) {
    await prisma.travelTime.upsert({
      where: { routeId_fromStationId_toStationId: { routeId: tt.routeId, fromStationId: tt.fromStationId, toStationId: tt.toStationId } },
      update: { travelTimeMinutes: tt.travelTimeMinutes },
      create: tt,
    });
  }
  console.log(`Travel times: ${travelTimes.length} segments`);
  console.log('Seed TER + BRT complete. Run seed.ddd.js for DDD data.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
