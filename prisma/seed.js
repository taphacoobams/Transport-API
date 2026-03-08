const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ─── Transport types ──────────────────────────────────────────
  const ter = await prisma.transportType.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'TER' },
  });

  const brt = await prisma.transportType.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: 'BRT' },
  });

  console.log(`Transport types: ${ter.name}, ${brt.name}`);

  // ─── Routes ───────────────────────────────────────────────────
  await prisma.route.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'TER Dakar-Diamniadio', transportTypeId: 1 } });
  await prisma.route.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'BRT B1', transportTypeId: 2 } });
  await prisma.route.upsert({ where: { id: 3 }, update: {}, create: { id: 3, name: 'BRT B2', transportTypeId: 2 } });
  await prisma.route.upsert({ where: { id: 4 }, update: {}, create: { id: 4, name: 'BRT B3', transportTypeId: 2 } });

  console.log('Routes created: TER Dakar-Diamniadio, BRT B1, BRT B2, BRT B3');

  // ─── TER Stations (id 1–13) ───────────────────────────────────
  const terStations = [
    { id: 1,  name: 'Dakar',           lat: 14.6709, lon: -17.4312, quartier: 'Plateau',         transportTypeId: 1 },
    { id: 2,  name: 'Colobane',        lat: 14.6937, lon: -17.4442, quartier: 'Colobane',         transportTypeId: 1 },
    { id: 3,  name: 'Hann',            lat: 14.7069, lon: -17.4238, quartier: 'Hann',             transportTypeId: 1 },
    { id: 4,  name: 'Dalifort',        lat: 14.7213, lon: -17.4042, quartier: 'Dalifort',         transportTypeId: 1 },
    { id: 5,  name: 'Baux Maraichers', lat: 14.7298, lon: -17.3912, quartier: 'Baux Maraichers',  transportTypeId: 1 },
    { id: 6,  name: 'Pikine',          lat: 14.7500, lon: -17.3900, quartier: 'Pikine',           transportTypeId: 1 },
    { id: 7,  name: 'Thiaroye',        lat: 14.7560, lon: -17.3680, quartier: 'Thiaroye',         transportTypeId: 1 },
    { id: 8,  name: 'Yeumbeul',        lat: 14.7620, lon: -17.3380, quartier: 'Yeumbeul',         transportTypeId: 1 },
    { id: 9,  name: 'Keur Massar',     lat: 14.7700, lon: -17.3080, quartier: 'Keur Massar',      transportTypeId: 1 },
    { id: 10, name: 'Mbao',            lat: 14.7550, lon: -17.2780, quartier: 'Mbao',             transportTypeId: 1 },
    { id: 11, name: 'PNR Rufisque',    lat: 14.7160, lon: -17.2740, quartier: 'Rufisque',         transportTypeId: 1 },
    { id: 12, name: 'Bargny',          lat: 14.6970, lon: -17.2280, quartier: 'Bargny',           transportTypeId: 1 },
    { id: 13, name: 'Diamniadio',      lat: 14.7070, lon: -17.1850, quartier: 'Diamniadio',       transportTypeId: 1 },
  ];

  // ─── BRT Stations (id 14–36) ──────────────────────────────────
  const brtStations = [
    { id: 14, name: 'Papa Gueye Fall',              lat: 14.6700, lon: -17.4380, quartier: 'Plateau',             transportTypeId: 2 },
    { id: 15, name: 'Grande Mosquee',               lat: 14.6750, lon: -17.4420, quartier: 'Médina',              transportTypeId: 2 },
    { id: 16, name: 'Place de la Nation',           lat: 14.6780, lon: -17.4460, quartier: 'Médina',              transportTypeId: 2 },
    { id: 17, name: 'Dial Diop',                    lat: 14.6820, lon: -17.4500, quartier: 'Médina',              transportTypeId: 2 },
    { id: 18, name: 'Grand Dakar',                  lat: 14.6900, lon: -17.4550, quartier: 'Grand Dakar',         transportTypeId: 2 },
    { id: 19, name: 'Liberte 1',                    lat: 14.6960, lon: -17.4590, quartier: 'Liberté',             transportTypeId: 2 },
    { id: 20, name: 'Sacre Coeur',                  lat: 14.7030, lon: -17.4630, quartier: 'Sacré-Cœur',          transportTypeId: 2 },
    { id: 21, name: 'Liberte 5',                    lat: 14.7080, lon: -17.4660, quartier: 'Liberté',             transportTypeId: 2 },
    { id: 22, name: 'Liberte 6',                    lat: 14.7130, lon: -17.4680, quartier: 'Liberté',             transportTypeId: 2 },
    { id: 23, name: 'Khar Yallah',                  lat: 14.7200, lon: -17.4700, quartier: 'Khar Yallah',         transportTypeId: 2 },
    { id: 24, name: 'Scat Urbam',                   lat: 14.7260, lon: -17.4660, quartier: 'Parcelles Assainies', transportTypeId: 2 },
    { id: 25, name: 'Cardinal Hyacinthe Thiandoum', lat: 14.7320, lon: -17.4620, quartier: 'Parcelles Assainies', transportTypeId: 2 },
    { id: 26, name: 'Grand Medine',                 lat: 14.7380, lon: -17.4580, quartier: 'Grand Médine',        transportTypeId: 2 },
    { id: 27, name: 'Police Parcelles',             lat: 14.7430, lon: -17.4530, quartier: 'Parcelles Assainies', transportTypeId: 2 },
    { id: 28, name: 'Croisement 22',                lat: 14.7490, lon: -17.4470, quartier: 'Parcelles Assainies', transportTypeId: 2 },
    { id: 29, name: 'Parcelles',                    lat: 14.7560, lon: -17.4410, quartier: 'Parcelles Assainies', transportTypeId: 2 },
    { id: 30, name: 'Ndingala',                     lat: 14.7620, lon: -17.4330, quartier: 'Guédiawaye',          transportTypeId: 2 },
    { id: 31, name: 'Golf Sud',                     lat: 14.7680, lon: -17.4250, quartier: 'Guédiawaye',          transportTypeId: 2 },
    { id: 32, name: 'Dalal Jam',                    lat: 14.7730, lon: -17.4150, quartier: 'Guédiawaye',          transportTypeId: 2 },
    { id: 33, name: 'Fith Mith',                    lat: 14.7780, lon: -17.4050, quartier: 'Guédiawaye',          transportTypeId: 2 },
    { id: 34, name: 'Golf Nord',                    lat: 14.7840, lon: -17.3960, quartier: 'Guédiawaye',          transportTypeId: 2 },
    { id: 35, name: 'Guediawaye Tapee',             lat: 14.7890, lon: -17.3870, quartier: 'Guédiawaye',          transportTypeId: 2 },
    { id: 36, name: 'Prefecture Guediawaye',        lat: 14.7940, lon: -17.3780, quartier: 'Guédiawaye',          transportTypeId: 2 },
  ];

  for (const s of [...terStations, ...brtStations]) {
    await prisma.station.upsert({
      where: { id: s.id },
      update: { name: s.name, lat: s.lat, lon: s.lon, quartier: s.quartier },
      create: s,
    });
  }

  console.log(`Stations created: ${terStations.length} TER + ${brtStations.length} BRT = ${terStations.length + brtStations.length} total`);

  // ─── Route stations: TER (route 1) ────────────────────────────
  const terOrder = [1,2,3,4,5,6,7,8,9,10,11,12,13];
  for (let i = 0; i < terOrder.length; i++) {
    await prisma.routeStation.upsert({
      where: { routeId_stationId: { routeId: 1, stationId: terOrder[i] } },
      update: { stationOrder: i + 1 },
      create: { routeId: 1, stationId: terOrder[i], stationOrder: i + 1 },
    });
  }

  // ─── Route stations: BRT B1 omnibus (route 2) ─────────────────
  const b1Order = [14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36];
  for (let i = 0; i < b1Order.length; i++) {
    await prisma.routeStation.upsert({
      where: { routeId_stationId: { routeId: 2, stationId: b1Order[i] } },
      update: { stationOrder: i + 1 },
      create: { routeId: 2, stationId: b1Order[i], stationOrder: i + 1 },
    });
  }

  // ─── Route stations: BRT B2 express (route 3) ─────────────────
  const b2Order = [14,16,18,20,26,32,36];
  for (let i = 0; i < b2Order.length; i++) {
    await prisma.routeStation.upsert({
      where: { routeId_stationId: { routeId: 3, stationId: b2Order[i] } },
      update: { stationOrder: i + 1 },
      create: { routeId: 3, stationId: b2Order[i], stationOrder: i + 1 },
    });
  }

  // ─── Route stations: BRT B3 express (route 4) ─────────────────
  const b3Order = [14,16,23,28,29,35,36];
  for (let i = 0; i < b3Order.length; i++) {
    await prisma.routeStation.upsert({
      where: { routeId_stationId: { routeId: 4, stationId: b3Order[i] } },
      update: { stationOrder: i + 1 },
      create: { routeId: 4, stationId: b3Order[i], stationOrder: i + 1 },
    });
  }

  console.log('Route stations created: TER(13), B1(23), B2(7), B3(7)');

  // ─── Travel times ──────────────────────────────────────────────
  const travelTimes = [
    // TER route 1 — ~46 min total
    { routeId: 1, fromStationId: 1,  toStationId: 2,  minutes: 3 },
    { routeId: 1, fromStationId: 2,  toStationId: 3,  minutes: 3 },
    { routeId: 1, fromStationId: 3,  toStationId: 4,  minutes: 3 },
    { routeId: 1, fromStationId: 4,  toStationId: 5,  minutes: 4 },
    { routeId: 1, fromStationId: 5,  toStationId: 6,  minutes: 3 },
    { routeId: 1, fromStationId: 6,  toStationId: 7,  minutes: 4 },
    { routeId: 1, fromStationId: 7,  toStationId: 8,  minutes: 4 },
    { routeId: 1, fromStationId: 8,  toStationId: 9,  minutes: 5 },
    { routeId: 1, fromStationId: 9,  toStationId: 10, minutes: 4 },
    { routeId: 1, fromStationId: 10, toStationId: 11, minutes: 4 },
    { routeId: 1, fromStationId: 11, toStationId: 12, minutes: 4 },
    { routeId: 1, fromStationId: 12, toStationId: 13, minutes: 5 },
    // BRT B1 route 2
    { routeId: 2, fromStationId: 14, toStationId: 15, minutes: 2 },
    { routeId: 2, fromStationId: 15, toStationId: 16, minutes: 5 },
    { routeId: 2, fromStationId: 16, toStationId: 17, minutes: 2 },
    { routeId: 2, fromStationId: 17, toStationId: 18, minutes: 2 },
    { routeId: 2, fromStationId: 18, toStationId: 19, minutes: 3 },
    { routeId: 2, fromStationId: 19, toStationId: 20, minutes: 2 },
    { routeId: 2, fromStationId: 20, toStationId: 21, minutes: 2 },
    { routeId: 2, fromStationId: 21, toStationId: 22, minutes: 2 },
    { routeId: 2, fromStationId: 22, toStationId: 23, minutes: 3 },
    { routeId: 2, fromStationId: 23, toStationId: 24, minutes: 2 },
    { routeId: 2, fromStationId: 24, toStationId: 25, minutes: 2 },
    { routeId: 2, fromStationId: 25, toStationId: 26, minutes: 3 },
    { routeId: 2, fromStationId: 26, toStationId: 27, minutes: 3 },
    { routeId: 2, fromStationId: 27, toStationId: 28, minutes: 2 },
    { routeId: 2, fromStationId: 28, toStationId: 29, minutes: 3 },
    { routeId: 2, fromStationId: 29, toStationId: 30, minutes: 2 },
    { routeId: 2, fromStationId: 30, toStationId: 31, minutes: 3 },
    { routeId: 2, fromStationId: 31, toStationId: 32, minutes: 2 },
    { routeId: 2, fromStationId: 32, toStationId: 33, minutes: 2 },
    { routeId: 2, fromStationId: 33, toStationId: 34, minutes: 3 },
    { routeId: 2, fromStationId: 34, toStationId: 35, minutes: 2 },
    { routeId: 2, fromStationId: 35, toStationId: 36, minutes: 2 },
    // BRT B2 route 3
    { routeId: 3, fromStationId: 14, toStationId: 16, minutes: 6  },
    { routeId: 3, fromStationId: 16, toStationId: 18, minutes: 4  },
    { routeId: 3, fromStationId: 18, toStationId: 20, minutes: 6  },
    { routeId: 3, fromStationId: 20, toStationId: 26, minutes: 9  },
    { routeId: 3, fromStationId: 26, toStationId: 32, minutes: 11 },
    { routeId: 3, fromStationId: 32, toStationId: 36, minutes: 7  },
    // BRT B3 route 4
    { routeId: 4, fromStationId: 14, toStationId: 16, minutes: 5  },
    { routeId: 4, fromStationId: 16, toStationId: 23, minutes: 13 },
    { routeId: 4, fromStationId: 23, toStationId: 28, minutes: 9  },
    { routeId: 4, fromStationId: 28, toStationId: 29, minutes: 3  },
    { routeId: 4, fromStationId: 29, toStationId: 35, minutes: 8  },
    { routeId: 4, fromStationId: 35, toStationId: 36, minutes: 2  },
  ];

  for (const tt of travelTimes) {
    await prisma.travelTime.upsert({
      where: { routeId_fromStationId_toStationId: { routeId: tt.routeId, fromStationId: tt.fromStationId, toStationId: tt.toStationId } },
      update: { minutes: tt.minutes },
      create: tt,
    });
  }

  console.log(`Travel times created: ${travelTimes.length} segments`);
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
