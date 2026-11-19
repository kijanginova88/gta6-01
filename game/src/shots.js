// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (drive to the mission marker, keep off the buildings, lose the
// heat by hiding), so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { BEACH, ROAD_X, ROAD_Y, STEP, WORLD } from './config.js';
import { MISSIONS } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = 1 / 30;

/** Steer the car toward a heading (radians), full throttle forward. */
function steerToward(world, want) {
  const pl = world.state.player;
  const d = want - pl.angle;
  const norm = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const steer = norm > 0.15 ? 1 : norm < -0.15 ? -1 : 0;
  // Slow down for sharp turns so the car turns tight at intersections.
  const throttle = Math.abs(norm) > 0.6 ? -0.35 : -1;
  world.step(STEP, { mx: steer, my: throttle, shoot: false, enter: false, punch: false, aimX: pl.x, aimY: pl.y });
}

/** Drive straight along the road the car is already facing (nearest cardinal). */
function driveForward(world, seconds, maxDist) {
  const state = world.state;
  const steps = Math.floor(seconds / STEP);
  const startAngle = state.player.inCar ? state.player.inCar.angle : 0;
  const heading = Math.round(startAngle / (Math.PI / 2)) * (Math.PI / 2);
  const sx = state.player.x;
  const sy = state.player.y;
  for (let i = 0; i < steps; i += 1) {
    if (!state.player.inCar || state.wasted || state.busted) break;
    if (Math.hypot(state.player.x - sx, state.player.y - sy) >= maxDist) break;
    steerToward(world, heading);
  }
}

/**
 * Pick the parked car with the longest clear run ahead of it, so a straight
 * drive stays inside the city instead of ending on the beach or a wall.
 */
function pickParkedCarWithRoom(state) {
  let best = null;
  let bestRoom = -1;
  for (const car of state.cars) {
    if (car.driver !== 'parked') continue;
    const a = ((car.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let room;
    if (a < Math.PI / 4 || a > Math.PI * 1.75) room = WORLD.width - car.x; // east
    else if (a < Math.PI * 0.75) room = BEACH.y - car.y; // south
    else if (a < Math.PI * 1.25) room = car.x; // west
    else room = car.y; // north
    if (room > bestRoom) { bestRoom = room; best = car; }
  }
  return { car: best, room: bestRoom };
}

/**
 * Drive to (tx, ty) along the roads via intersection waypoints: first along
 * the road the car is already on to the next intersection ahead, then along
 * the cross road, then to the target. Turns only happen at intersections,
 * where there is open space, so the car never arcs into a building.
 */
function driveToward(world, tx, ty, seconds) {
  const state = world.state;
  const car = state.player.inCar;
  if (!car) return;
  const xRoad = ROAD_X.reduce((best, r) => (Math.abs(car.x - r) < Math.abs(car.x - best) ? r : best), ROAD_X[0]);
  const yRoad = ROAD_Y.reduce((best, r) => (Math.abs(car.y - r) < Math.abs(car.y - best) ? r : best), ROAD_Y[0]);
  const onVertical = Math.abs(car.x - xRoad) < 70;
  const onHorizontal = Math.abs(car.y - yRoad) < 70;
  const legs = [];
  const pushLeg = (x, y) => {
    const last = legs[legs.length - 1] || { x: car.x, y: car.y };
    if (Math.hypot(x - last.x, y - last.y) > 60) legs.push({ x, y });
  };
  if (onVertical && !onHorizontal) {
    // Heading along a vertical road: next cross road ahead, then across, then in.
    const headingSouth = Math.sin(car.angle) > 0;
    const cross = headingSouth
      ? ROAD_Y.find((r) => r > car.y + 40) ?? ROAD_Y[ROAD_Y.length - 1]
      : [...ROAD_Y].reverse().find((r) => r < car.y - 40) ?? ROAD_Y[0];
    pushLeg(xRoad, cross);
    pushLeg(tx, cross);
    pushLeg(tx, ty);
  } else if (onHorizontal) {
    const headingEast = Math.cos(car.angle) > 0;
    const cross = headingEast
      ? ROAD_X.find((r) => r > car.x + 40) ?? ROAD_X[ROAD_X.length - 1]
      : [...ROAD_X].reverse().find((r) => r < car.x - 40) ?? ROAD_X[0];
    pushLeg(cross, yRoad);
    pushLeg(cross, ty);
    pushLeg(tx, ty);
  } else {
    pushLeg(tx, ty);
  }
  const deadline = Math.floor(seconds / STEP);
  for (const leg of legs) {
    for (let i = 0; i < deadline; i += 1) {
      const pl = state.player;
      if (!pl.inCar || state.wasted || state.busted) return;
      const dx = leg.x - pl.x;
      const dy = leg.y - pl.y;
      if (Math.hypot(dx, dy) < 50) break;
      steerToward(world, Math.atan2(dy, dx));
    }
  }
}

/** Walk the player toward (tx, ty) on foot. */
function walkToward(world, tx, ty, seconds) {
  const state = world.state;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const pl = state.player;
    if (pl.inCar) break;
    const dx = tx - pl.x;
    const dy = ty - pl.y;
    const len = Math.hypot(dx, dy) || 1;
    const ctl = { mx: dx / len, my: dy / len, shoot: false, enter: false, punch: false, aimX: tx, aimY: ty };
    world.step(STEP, ctl);
    if (state.wasted || state.busted) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a live city. drive: the player stealing and driving a car
 * through traffic. chase: 3 wanted stars with police cars closing in.
 * mission: the first mission's marker with the player driving toward it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < 5 / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, shoot: false, enter: false, punch: false, aimX: 0, aimY: 0 });
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'drive') {
    // Steal the parked car with the longest run ahead, then drive down the avenue.
    const pick = pickParkedCarWithRoom(state);
    const car = pick.car;
    if (car) {
      state.player.x = car.x - 40;
      state.player.y = car.y;
      world.step(STEP, { mx: 0, my: 0, shoot: false, enter: true, punch: false, aimX: car.x, aimY: car.y });
    }
    driveForward(world, 7, Math.min(pick.room - 200, 1500));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    const pick = pickParkedCarWithRoom(state);
    const car = pick.car;
    if (car) {
      state.player.x = car.x - 40;
      state.player.y = car.y;
      world.step(STEP, { mx: 0, my: 0, shoot: false, enter: true, punch: false, aimX: car.x, aimY: car.y });
    }
    state.wanted = 3;
    for (let i = 0; i < 3; i += 1) world.spawnCopCar();
    driveForward(world, 6, Math.min(pick.room - 200, 1200));
    return { screen: SCREEN_PLAY };
  }
  // mission: drive toward the first mission's club marker, along the roads.
  const car = state.cars.find((c) => c.driver === 'parked');
  if (car) {
    state.player.x = car.x - 40;
    state.player.y = car.y;
    world.step(STEP, { mx: 0, my: 0, shoot: false, enter: true, punch: false, aimX: car.x, aimY: car.y });
  }
  const target = state.missionTarget || { x: 2960, y: 400 };
  // Snap the stop point to the intersection nearest the marker.
  const ix = Math.round(target.x / 400) * 400;
  const iy = Math.round(target.y / 400) * 400;
  driveToward(world, ix, iy, 9);
  void MISSIONS;
  return { screen: SCREEN_PLAY };
}
