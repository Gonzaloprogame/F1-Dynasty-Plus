// Datos base del juego. Todos los equipos y pilotos son ficticios.
'use strict';

const TEAMS = [
  { id: 'halcon',   name: 'Halcón Motorsport',    short: 'HAL', color: '#d7263d', budget: 140, rep: 85, car: { aero: 86, power: 84, chassis: 85, rel: 82 }, crew: 82 },
  { id: 'nordlicht',name: 'Nordlicht GP',         short: 'NOR', color: '#19b5c9', budget: 150, rep: 90, car: { aero: 88, power: 87, chassis: 84, rel: 86 }, crew: 86 },
  { id: 'vortex',   name: 'Vortex Racing',        short: 'VTX', color: '#3d5afe', budget: 135, rep: 82, car: { aero: 85, power: 83, chassis: 86, rel: 80 }, crew: 84 },
  { id: 'solaris',  name: 'Solaris Corse',        short: 'SOL', color: '#ff8f1f', budget: 115, rep: 72, car: { aero: 81, power: 82, chassis: 80, rel: 79 }, crew: 80 },
  { id: 'kestrel',  name: 'Kestrel Grand Prix',   short: 'KES', color: '#2fbf71', budget: 100, rep: 65, car: { aero: 79, power: 78, chassis: 79, rel: 81 }, crew: 77 },
  { id: 'meridian', name: 'Meridian Racing',      short: 'MER', color: '#c9a227', budget: 90,  rep: 58, car: { aero: 77, power: 79, chassis: 76, rel: 77 }, crew: 75 },
  { id: 'tempest',  name: 'Tempest Engineering',  short: 'TMP', color: '#9b5de5', budget: 85,  rep: 55, car: { aero: 76, power: 75, chassis: 77, rel: 78 }, crew: 74 },
  { id: 'orion',    name: 'Orion Velocity',       short: 'ORI', color: '#f15bb5', budget: 75,  rep: 48, car: { aero: 74, power: 76, chassis: 74, rel: 75 }, crew: 72 },
  { id: 'cobalt',   name: 'Cobalt Racing Team',   short: 'COB', color: '#4a6fa5', budget: 65,  rep: 42, car: { aero: 73, power: 72, chassis: 74, rel: 74 }, crew: 70 },
  { id: 'ferrolux', name: 'Ferrolux',             short: 'FLX', color: '#8d99ae', budget: 55,  rep: 35, car: { aero: 71, power: 72, chassis: 71, rel: 72 }, crew: 68 },
];

// pace = velocidad pura, craft = adelantamientos/defensa, cons = consistencia, pot = potencial
const DRIVERS = [
  ['Mateo Rivas', 'ESP', 27, 92, 90, 88, 94, 'halcon', 18, 3],
  ['Lukas Brandt', 'GER', 24, 90, 86, 85, 95, 'halcon', 12, 2],
  ['Aiden Cole', 'GBR', 29, 93, 89, 91, 93, 'nordlicht', 22, 2],
  ['Kenji Morita', 'JPN', 22, 88, 84, 82, 95, 'nordlicht', 9, 3],
  ['Théo Fournier', 'FRA', 31, 89, 92, 90, 89, 'vortex', 15, 1],
  ['Rafael Duarte', 'BRA', 25, 89, 87, 83, 93, 'vortex', 11, 3],
  ['Nico Valenti', 'ITA', 33, 86, 90, 92, 86, 'solaris', 10, 1],
  ['Oskar Lind', 'SWE', 23, 86, 82, 80, 92, 'solaris', 6, 2],
  ['Sam Whitaker', 'AUS', 28, 85, 85, 86, 87, 'kestrel', 7, 2],
  ['Diego Castaño', 'MEX', 26, 85, 86, 81, 89, 'kestrel', 6, 1],
  ['Emil Novak', 'CZE', 30, 83, 84, 87, 84, 'meridian', 5, 2],
  ['Liam O\'Hara', 'IRL', 21, 83, 79, 77, 93, 'meridian', 3, 3],
  ['Pieter de Vos', 'NED', 34, 82, 88, 89, 82, 'tempest', 5, 1],
  ['Tomás Echeverría', 'ARG', 22, 83, 81, 78, 91, 'tempest', 3, 2],
  ['Jae-won Park', 'KOR', 25, 82, 80, 82, 87, 'orion', 3, 2],
  ['Marco Bellini', 'ITA', 29, 81, 83, 84, 83, 'orion', 3, 1],
  ['Ethan Brooks', 'USA', 23, 81, 78, 79, 88, 'cobalt', 2, 2],
  ['Ville Koskinen', 'FIN', 32, 80, 81, 86, 80, 'cobalt', 2, 1],
  ['Andrés Restrepo', 'COL', 20, 80, 77, 74, 92, 'ferrolux', 1.5, 2],
  ['Hugo Marchand', 'BEL', 28, 79, 80, 82, 81, 'ferrolux', 1.5, 1],
  // Agentes libres / reservas
  ['Felipe Arancibia', 'CHI', 19, 77, 74, 72, 91, null, 1, 0],
  ['Callum Reid', 'SCO', 26, 80, 79, 81, 83, null, 2, 0],
  ['Yusuf Demir', 'TUR', 24, 79, 80, 77, 86, null, 1.5, 0],
  ['Arjun Mehta', 'IND', 21, 78, 76, 75, 89, null, 1, 0],
  ['Max Hoffmann', 'AUT', 35, 81, 85, 87, 81, null, 2.5, 0],
  ['Rui Carvalho', 'POR', 22, 78, 77, 76, 87, null, 1, 0],
].map((d, i) => ({
  id: 'd' + i, name: d[0], nat: d[1], age: d[2], pace: d[3], craft: d[4], cons: d[5], pot: d[6],
  teamId: d[7], salary: d[8], contract: d[9], titles: 0, wins: 0, podiums: 0, starts: 0,
}));

// df = carga aerodinámica, pw = peso del motor, wear = desgaste de neumáticos, ovt = facilidad de adelantar
const CIRCUITS = [
  { name: 'GP de Baréin',          city: 'Sakhir',        laps: 57, base: 94, df: 0.9, pw: 1.1, wear: 1.3, ovt: 0.7, rain: 0.02, sc: 0.35 },
  { name: 'GP de Australia',       city: 'Melbourne',     laps: 58, base: 80, df: 1.0, pw: 1.0, wear: 0.9, ovt: 0.5, rain: 0.15, sc: 0.55 },
  { name: 'GP de Japón',           city: 'Suzuka',        laps: 53, base: 92, df: 1.3, pw: 0.9, wear: 1.1, ovt: 0.4, rain: 0.25, sc: 0.35 },
  { name: 'GP de China',           city: 'Shanghái',      laps: 56, base: 96, df: 1.0, pw: 1.1, wear: 1.2, ovt: 0.65, rain: 0.2, sc: 0.4 , sprint: true },
  { name: 'GP de Miami',           city: 'Miami',         laps: 57, base: 91, df: 0.9, pw: 1.1, wear: 1.0, ovt: 0.55, rain: 0.15, sc: 0.5 , sprint: true },
  { name: 'GP de la Riviera',      city: 'Montecarlo',    laps: 78, base: 74, df: 1.5, pw: 0.5, wear: 0.6, ovt: 0.05, rain: 0.1, sc: 0.6 },
  { name: 'GP de España',          city: 'Barcelona',     laps: 66, base: 77, df: 1.2, pw: 0.9, wear: 1.2, ovt: 0.35, rain: 0.08, sc: 0.25 },
  { name: 'GP de Canadá',          city: 'Montreal',      laps: 70, base: 75, df: 0.7, pw: 1.3, wear: 0.9, ovt: 0.6, rain: 0.25, sc: 0.65 },
  { name: 'GP de Austria',         city: 'Spielberg',     laps: 71, base: 66, df: 0.8, pw: 1.2, wear: 1.0, ovt: 0.6, rain: 0.25, sc: 0.35 , sprint: true },
  { name: 'GP de Gran Bretaña',    city: 'Silverstone',   laps: 52, base: 88, df: 1.2, pw: 1.0, wear: 1.3, ovt: 0.5, rain: 0.35, sc: 0.4 },
  { name: 'GP de Bélgica',         city: 'Spa',           laps: 44, base: 106, df: 0.8, pw: 1.3, wear: 1.0, ovt: 0.7, rain: 0.4, sc: 0.45 },
  { name: 'GP de Hungría',         city: 'Budapest',      laps: 70, base: 78, df: 1.4, pw: 0.7, wear: 1.0, ovt: 0.2, rain: 0.15, sc: 0.3 },
  { name: 'GP de Italia',          city: 'Monza',         laps: 53, base: 82, df: 0.5, pw: 1.6, wear: 0.8, ovt: 0.75, rain: 0.15, sc: 0.35 },
  { name: 'GP de Singapur',        city: 'Marina Bay',    laps: 62, base: 93, df: 1.4, pw: 0.7, wear: 0.9, ovt: 0.2, rain: 0.3, sc: 0.85 },
  { name: 'GP de las Américas',    city: 'Austin',        laps: 56, base: 96, df: 1.1, pw: 1.0, wear: 1.2, ovt: 0.6, rain: 0.1, sc: 0.4 , sprint: true },
  { name: 'GP de Brasil',          city: 'São Paulo',     laps: 71, base: 71, df: 1.0, pw: 1.1, wear: 1.0, ovt: 0.65, rain: 0.4, sc: 0.6 , sprint: true },
  { name: 'GP de Abu Dabi',        city: 'Yas',           laps: 58, base: 86, df: 1.0, pw: 1.1, wear: 0.9, ovt: 0.5, rain: 0.01, sc: 0.3 },
];

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

const SPONSOR_NAMES = [
  'Zentra Energy', 'Bluepeak Telecom', 'Arcadia Bank', 'Nimbus Cloud', 'Volta Drinks', 'Krest Tyres',
  'Ostara Watches', 'Helix Logistics', 'Lumen Airways', 'Pioneer Fintech', 'Quasar Gaming', 'Sierra Oil',
];

const FIRST_NAMES = ['Álex', 'Bruno', 'Carlos', 'Dante', 'Elías', 'Finn', 'Gabriel', 'Iker', 'Jonas', 'Kai', 'Leo', 'Matías', 'Noah', 'Oliver', 'Pablo', 'Rémi', 'Santiago', 'Tobias', 'Valentín', 'Yuki', 'Zane', 'Lucas', 'Joaquín', 'Enzo'];
const LAST_NAMES = ['Acosta', 'Becker', 'Costa', 'Dubois', 'Esposito', 'Fischer', 'García', 'Hansen', 'Ibáñez', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Olsen', 'Petrov', 'Ramos', 'Silva', 'Tanaka', 'Urrutia', 'Vidal', 'Weber', 'Zamora', 'Holm'];
const NATS = ['ESP', 'GER', 'FRA', 'ITA', 'GBR', 'BRA', 'ARG', 'MEX', 'JPN', 'NED', 'DEN', 'POL', 'USA', 'AUS', 'CHI', 'URU'];
