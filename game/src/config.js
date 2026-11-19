// Neon Bay — every tuning number and colour in one place.
// The world is a fixed 3200x2400 city; the renderer shows a 1280x720 window of it,
// so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** City grid: roads run every ROAD_STEP px, each ROAD_WIDTH px wide. */
export const CITY = {
  roadStep: 400,
  roadWidth: 96,
  sidewalk: 14,
  blockMargin: 26,
};

/** Road centre lines: vertical roads run the full width, horizontal roads stop at the beach. */
export const ROAD_X = [0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200];
export const ROAD_Y = [0, 400, 800, 1200, 1600, 2000];

/** The beach strip along the south edge and the park near the centre. */
export const BEACH = { y: 2160, height: 240 };
export const PARK = { x: 1200, y: 800, width: 400, height: 400 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchDamage: 34,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const GUN = {
  damage: 34,
  range: 420,
  cooldown: 0.28,
  ammoStart: 24,
  ammoMax: 60,
  noise: 520,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 620,
  reverseAccel: 240,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  drag: 0.55,
  health: 100,
  stealTime: 0.0,
};

export const TRAFFIC = { count: 26, speedMin: 130, speedMax: 210, spawnGap: 90 };
export const PEDS = { count: 34, speedMin: 34, speedMax: 62 };

export const POLICE = {
  maxCars: 6,
  spawnInterval: 4.5,
  chaseSpeed: 470,
  ramDamage: 12,
  bustedRange: 46,
  bustedTime: 1.6,
  onFootSpeed: 250,
};

/** Wanted stars: what each crime adds, and how fast heat fades while unseen. */
export const WANTED = {
  stealCar: 1,
  punch: 1,
  shoot: 2,
  killPed: 2,
  killCop: 2,
  wreckCar: 1,
  decayPerSecond: 0.05,
  hideRadius: 620,
  maxStars: 5,
};

/** Cash: what each thing pays. */
export const CASH = {
  mission: [500, 800, 1200, 1500, 2000, 5000],
  pickup: 50,
  taxiFare: 120,
  debt: 300,
};

export const MISSIONS = [
  { id: 1, name: 'First Wheels', brief: 'Steal any car and bring it to the pink marker.', type: 'steal-deliver' },
  { id: 2, name: 'The Pickup', brief: 'Grab the package at the docks, then deliver it to the club.', type: 'fetch' },
  { id: 3, name: 'Hot Wheels', brief: 'Lose a 3-star wanted level. Stay out of sight until the heat dies.', type: 'lose-heat' },
  { id: 4, name: 'Debt Collection', brief: 'Three debtors owe the crew. Collect from all three — fists work.', type: 'collect' },
  { id: 5, name: 'The Drop', brief: 'Deliver the case across town in 90 seconds. Do not stop for anyone.', type: 'timed' },
  { id: 6, name: 'King of Neon Bay', brief: 'Survive the full 5-star assault for 90 seconds. Then the city is yours.', type: 'survive' },
];

export const PALETTE = {
  grass: '#3f7a44',
  parkGrass: '#4c8a4a',
  sand: '#d9c27a',
  water: '#2e7fa8',
  road: '#33373f',
  roadLine: '#d8c95c',
  sidewalk: '#6d6f75',
  building: ['#7a5c8f', '#8f6a4a', '#4a7a8f', '#8f4a5c', '#5c7a4a', '#6a5c7a', '#a07a3a'],
  buildingRoof: ['#5c4470', '#6e5138', '#38606e', '#6e3846', '#466038', '#50465e', '#7a5c2c'],
  player: '#ffd23f',
  playerJacket: '#e8483f',
  ped: ['#e8e3d3', '#9fc3e8', '#e8a3b8', '#a3e8b0', '#e8d29a'],
  cop: '#2e5fd8',
  copCar: '#1f4fd8',
  taxi: '#f2c94c',
  car: ['#c94f4f', '#4f8fc9', '#7ac94f', '#c9c94f', '#8f4fc9', '#e8e8e8', '#3a3a3a'],
  text: '#eef1f5',
  muted: '#9aa3b2',
  panel: 'rgba(12, 16, 24, 0.78)',
  star: '#ffd23f',
  starEmpty: '#5a6068',
  health: '#58d158',
  damage: '#e5534b',
  marker: '#3fd2ff',
  missionMarker: '#ff5ce1',
  cash: '#7be07b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash, missions, best) is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-bay.save.v1';
